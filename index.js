/**
 * dsh-music-player server half.
 *
 * Owns the durable state (playlists, settings, account cookies — cookies never go back to the
 * page), the local audio/file endpoints and the referer-aware stream proxy the <audio> element
 * plays through, plus the per-platform API adapters.
 */
import { mkdir, open as fsOpen, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { request as httpsRequest } from 'node:https'
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import QRCode from 'qrcode'

import { httpBin, isBlockedHost, parseCustomPlaylist, publicState, refererFor, sanitizeState, UA } from './server/util.js'
import * as netease from './server/netease.js'
import * as bilibili from './server/bilibili.js'
import * as kuwo from './server/kuwo.js'
import * as kugou from './server/kugou.js'
import * as qq from './server/qq.js'
import * as pan from './server/pan.js'
import * as fivesing from './server/5sing.js'
import * as wusunk from './server/wusunk.js'
import * as qishui from './server/qishui.js'
import { tagFile } from './server/id3.js'

export const name = 'dsh-music-player'

// last window that started playing; in-memory single-play arbitration
let playOwner = null
/** In-flight download progress by `${source}:${id}` — polled by the ring button in the page. */
const dlProgress = new Map()
const dlKey = (source, id) => `${source}:${id}`
function setDl(key, info) {
  for (const [k, v] of dlProgress) if (Date.now() - (v.at ?? 0) > 10 * 60 * 1000) dlProgress.delete(k)
  dlProgress.set(key, { ...info, at: Date.now() })
}

const ROUTE_PREFIX = '/dsh-music-player'
const STATE_PATH = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-music-player.json')
const DEFAULT_DL_DIR = join(homedir(), 'Music', 'dsh-music-player')

const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.oga', '.wav', '.opus', '.aiff', '.aif', '.wma'])
const MIME = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.wav': 'audio/wav', '.opus': 'audio/ogg',
  '.aiff': 'audio/aiff', '.aif': 'audio/aiff', '.wma': 'audio/x-ms-wma',
  '.lrc': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
}

const downloadDirOf = (state) => (state.settings.downloadDir || DEFAULT_DL_DIR)

// lazily probe file durations for entries downloaded before probing existed; persists once
async function backfillDownloadDurations(state) {
  const dir = downloadDirOf(state)
  let changed = false
  for (const d of state.downloads) {
    if (d.duration || !d.file) continue
    const dur = await probeDuration(join(dir, d.file))
    if (dur > 0) { d.duration = dur; changed = true }
  }
  if (changed) await writeState(sanitizeState(state))
}

function safeName(text) {
  return String(text ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || '未命名'
}

async function uniquePath(dir, base, ext) {
  let candidate = join(dir, `${base}${ext}`)
  for (let n = 2; ; n += 1) {
    if (!(await stat(candidate).catch(() => null))) return candidate
    candidate = join(dir, `${base} (${n})${ext}`)
  }
}

async function readState() {
  try {
    return sanitizeState(JSON.parse(await readFile(STATE_PATH, 'utf8')))
  } catch {
    return sanitizeState({})
  }
}

async function writeState(state) {
  await mkdir(dirname(STATE_PATH), { recursive: true })
  const temp = `${STATE_PATH}.tmp`
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`)
  await rename(temp, STATE_PATH)
}

function sendJSON(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJSON(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_048_576) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Recursive audio scan; pairs same-stem .lrc files as the track's lyric source. */
/**
 * 歌词文件的中文站点多存 GBK/GB18030：先按 UTF-8 严格解码，失败再退回 GB18030。
 * @param {Buffer} buf - 文件字节
 * @returns {string} 解码后的文本
 */
export function decodeText(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buf)
    } catch {
      return buf.toString('utf8')
    }
  }
}

/** 从文件名拆歌手与歌名：'0063程响-世界这么大还是遇见你' -> 程响 / 世界这么大还是遇见你。
 *  shortcut: 只认文件名里的短横线，名字无分隔符且没写 ID3 的文件歌手留空 */
export function parseTrackName(stem) {
  const name = String(stem || '').trim()
  const m = name.match(/^(.{1,60}?)\s*[-–—]\s*(.+)$/)
  if (!m) return { title: name, artist: '' }
  const artist = m[1].replace(/^[\s\d.、_#]+/, '').trim()
  const title = m[2].trim()
  if (!artist || !title) return { title: name, artist: '' }
  return { title, artist }
}

export async function scanFolder(root) {
  const dir = resolve(String(root || ''))
  const info = await stat(dir)
  if (!info.isDirectory()) throw new Error('路径不是文件夹')
  const tracks = []
  const lrcs = new Set()
  const walk = async (folder, depth) => {
    if (depth > 6 || tracks.length >= 3000) return
    const entries = await readdir(folder, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = join(folder, entry.name)
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
      } else {
        const dot = entry.name.lastIndexOf('.')
        const ext = dot >= 0 ? entry.name.slice(dot).toLowerCase() : ''
        if (AUDIO_EXT.has(ext)) {
          const named = parseTrackName(entry.name.slice(0, dot > 0 ? dot : undefined))
          tracks.push({
            id: 'local:' + full,
            title: named.title,
            artist: named.artist,
            url: full,
            cover: '',
            duration: 0,
            source: 'local',
            lrcPath: '',
          })
        } else if (ext === '.lrc') {
          lrcs.add(full.slice(0, full.length - entry.name.length + dot))
        }
      }
    }
  }
  await walk(dir, 0)
  // Pair lyrics after the walk: the .lrc may sort after the audio file.
  for (const track of tracks) {
    const dot = track.url.lastIndexOf('.')
    const stem = dot >= 0 ? track.url.slice(0, dot) : track.url
    if (lrcs.has(stem)) track.lrcPath = `${stem}.lrc`
  }
  tracks.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
  return { root: dir, tracks }
}

/** Stream a local file with Range support; only paths under a saved local playlist root
 *  (or the download dir) pass. */
function fileWithinRoots(state, target) {
  const dir = resolve(downloadDirOf(state))
  if (target === dir || target.startsWith(dir + sep)) return true
  for (const pl of state.playlists) {
    if (pl.kind !== 'local' || !pl.root) continue
    const root = resolve(pl.root)
    if (target === root || target.startsWith(root + sep)) return true
  }
  return false
}

async function pipeFile(req, res, filePath, contentType) {
  const info = await stat(filePath)
  const range = req.headers.range
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/)
    const start = m && m[1] ? Number(m[1]) : 0
    const end = m && m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1
    if (start >= info.size) {
      res.writeHead(416, { 'content-range': `bytes */${info.size}` })
      return res.end()
    }
    res.writeHead(206, {
      'content-type': contentType,
      'content-length': end - start + 1,
      'content-range': `bytes ${start}-${end}/${info.size}`,
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    })
    const { createReadStream } = await import('node:fs')
    createReadStream(filePath, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': info.size,
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
  })
  const { createReadStream } = await import('node:fs')
  createReadStream(filePath).pipe(res)
}

/** Remote proxy for audio/covers: public hosts only, referer per host, Range passthrough. */
// node:https GET that bypasses the host's global undici dispatcher (proxy);
// Readable stream with .headers.get() and .body for parity with fetch's Response.
function directStream(url, headers) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: 'GET', headers }, (res) => {
      resolve({ status: res.statusCode, headers: { get: (k) => res.headers[k.toLowerCase()] ?? null }, body: res })
    })
    req.on('error', reject)
    req.setTimeout(20000, () => req.destroy(new Error('direct stream timeout')))
    req.end()
  })
}

async function pipeRemote(req, res, target) {
  let url
  try {
    url = new URL(target)
  } catch {
    return sendJSON(res, 400, { error: 'bad url' })
  }
  if (!/^https?:$/.test(url.protocol) || isBlockedHost(url.hostname)) {
    return sendJSON(res, 403, { error: '该地址不允许代理' })
  }
  const headers = {
    'user-agent': UA,
    accept: '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
  }
  const ref = refererFor(target)
  if (ref) headers.referer = ref
  if (req.headers.range) headers.range = req.headers.range
  const upstream = url.hostname.endsWith('.kuwo.cn')
    // kuwo blocks the host proxy's exit IP: stream its hosts over a direct node:https call
    ? await directStream(url, headers)
    : await fetch(url, { headers, redirect: 'follow' })
  const outHeaders = {
    'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'cache-control': 'no-store',
  }
  for (const key of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(key)
    if (value) outHeaders[key] = value
  }
  res.writeHead(upstream.status, outHeaders)
  if (upstream.body) {
    for await (const chunk of upstream.body) {
      if (res.write(chunk) === false) await new Promise((done) => res.once('drain', done))
    }
  }
  res.end()
}

function cookieOf(state, platform) {
  return state.accounts[platform]?.cookie ?? ''
}

// qishui (汽水) bridge: durable bits live in accounts.soda, written via read-modify-write here.
const qishuiHelpers = {
  async saveSession(session) {
    const s = await readState()
    const soda = { ...(s.accounts.soda ?? {}) }
    if (session) soda.session = session
    else delete soda.session
    await writeState(sanitizeState({ ...s, accounts: { ...s.accounts, soda } }))
  },
  async saveDeviceId(deviceId) {
    const s = await readState()
    await writeState(sanitizeState({ ...s, accounts: { ...s.accounts, soda: { ...(s.accounts.soda ?? {}), deviceId } } }))
  },
}

/** Raw remote stream URL per source (no proxy wrapper) — shared by play + download flows. */
async function remoteSongUrl(state, source, id) {
  const out =
    source === 'netease' ? await netease.songUrl(id, cookieOf(state, 'netease'))
    : source === 'bilibili' ? await bilibili.songUrl(id, cookieOf(state, 'bilibili'))
    : source === 'kuwo' ? await kuwo.songUrl(id)
    : source === 'kugou' ? await kugou.songUrl(id, cookieOf(state, 'kugou'))
    : source === 'qq' ? await qq.songUrl(id, cookieOf(state, 'qq'))
    : source === 'pan' ? await pan.songUrl(id)
    : source === '5sing' ? await fivesing.songUrl(id)
    : source === 'qishui' ? (await qishui.ensure(state, qishuiHelpers), await qishui.songUrl(id))
    : { url: '' }
  if (out.error) throw new Error(out.error)
  if (!out.url) throw new Error('没有拿到播放地址')
  return out.url
}

async function lyricOf(state, source, id) {
  if (source === 'netease') return (await netease.lyric(id)).lrc ?? ''
  if (source === 'qq') return (await qq.lyric(id)).lrc ?? ''
  if (source === 'pan') return (await pan.lyric(id)).lrc ?? ''
  if (source === '5sing') return (await fivesing.lyric(id)).lrc ?? ''
  if (source === 'qishui') { await qishui.ensure(state, qishuiHelpers); return (await qishui.lyric(id)).lrc ?? '' }
  return ''
}

// shortcut: Layer III only, CBR estimate from the first frame's bitrate, m4a assumes moov up front
export async function probeDuration(path) {
  const ext = extname(path).toLowerCase()
  if (ext !== '.mp3' && ext !== '.m4a' && ext !== '.mp4' && ext !== '.aac') return 0
  try {
    const fh = await fsOpen(path, 'r')
    try {
      const { size } = await fh.stat()
      // mp3 audio frames start after the (sometimes huge, cover-art) ID3v2 tag
      let offset = 0
      if (ext === '.mp3') {
        const ten = Buffer.alloc(10)
        const r = await fh.read(ten, 0, 10, 0)
        if (r.bytesRead === 10 && ten.toString('latin1', 0, 3) === 'ID3') {
          offset = 10 + (((ten[6] & 0x7f) << 21) | ((ten[7] & 0x7f) << 14) | ((ten[8] & 0x7f) << 7) | (ten[9] & 0x7f))
        }
      }
      const head = Buffer.alloc(Math.min(64 * 1024, Math.max(0, size - offset)))
      const { bytesRead } = await fh.read(head, 0, head.length, offset)
      const buf = head.subarray(0, bytesRead)
      if (ext !== '.mp3') {
        const i = buf.indexOf(Buffer.from('mvhd'))
        if (i < 0 || i + 40 > buf.length) return 0
        if (buf[i + 8] === 1) {
          const scale = buf.readUInt32BE(i + 28)
          return scale ? Math.round(Number(buf.readBigUInt64BE(i + 32)) / scale) : 0
        }
        const scale = buf.readUInt32BE(i + 20)
        return scale ? Math.round(buf.readUInt32BE(i + 24) / scale) : 0
      }
      for (let i = 0; i + 4 <= buf.length; i += 1) {
        if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue
        const verBits = (buf[i + 1] >> 3) & 3
        const srIdx = (buf[i + 2] >> 2) & 3
        const brIdx = (buf[i + 2] >> 4) & 15
        if (verBits === 1 || srIdx === 3 || brIdx === 0 || brIdx === 15) continue
        const mpeg1 = verBits === 3
        const mpeg25 = verBits === 2
        const sampleRate = (mpeg1 ? [44100, 48000, 32000] : mpeg25 ? [11025, 12000, 8000] : [22050, 24000, 16000])[srIdx]
        const samplesPerFrame = mpeg1 ? 1152 : 576
        const xing = buf.indexOf(Buffer.from('Xing'), i)
        const info = buf.indexOf(Buffer.from('Info'), i)
        const at = xing >= 0 && xing - i < 200 ? xing : info >= 0 && info - i < 200 ? info : -1
        if (at >= 0 && (buf.readUInt32BE(at + 4) & 1)) {
          const frames = buf.readUInt32BE(at + 8)
          if (frames > 0) return Math.round((frames * samplesPerFrame) / sampleRate)
        }
        const kbps = (mpeg1
          ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
          : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0])[brIdx]
        return kbps > 0 ? Math.round(((size - offset - i) * 8) / (kbps * 1000)) : 0
      }
      return 0
    } finally { await fh.close() }
  } catch { return 0 }
}

function audioExtOf(url, contentType) {
  const byType = {
    'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a',
    'audio/aac': '.aac', 'audio/flac': '.flac', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
    'video/mp4': '.m4a',
  }[String(contentType ?? '').split(';')[0].trim().toLowerCase()]
  if (byType) return byType
  try {
    const ext = extname(new URL(url).pathname).toLowerCase()
    if (AUDIO_EXT.has(ext)) return ext === '.m4s' ? '.m4a' : ext
  } catch {}
  return '.mp3'
}

export function apply(ctx) {
  function route(req, res) {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://dsh.invalid')
      const action = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+|\/+$/g, '')
      try {
        const state = await readState()

        if (action === 'play-start' && req.method === 'POST') {
          const body = await readJSON(req).catch(() => ({}))
          playOwner = { winId: String(body.winId || '').slice(0, 64), ts: Date.now() }
          return sendJSON(res, 200, { ok: true })
        }
        if (action === 'play-owner' && req.method === 'GET') {
          return sendJSON(res, 200, playOwner || {})
        }

        if (action === 'state' && (req.method === 'GET' || req.method === 'HEAD')) {
          await backfillDownloadDurations(state)
          return sendJSON(res, 200, publicState(state))
        }

        if (action === 'settings' && req.method === 'POST') {
          const body = await readJSON(req)
          const hk = state.settings.hotkeys ?? {}
          const bodyHk = body.hotkeys ?? {}
          const next = sanitizeState({
            ...state,
            settings: {
              mode: body.mode ?? state.settings.mode,
              downloadDir: body.downloadDir !== undefined ? body.downloadDir : state.settings.downloadDir,
              pageSize: body.pageSize !== undefined ? body.pageSize : state.settings.pageSize,
              defaultSource: body.defaultSource !== undefined ? body.defaultSource : state.settings.defaultSource,
              accent: body.accent !== undefined ? body.accent : state.settings.accent,
              hotkeys: {
                prev: bodyHk.prev !== undefined ? bodyHk.prev : hk.prev,
                next: bodyHk.next !== undefined ? bodyHk.next : hk.next,
                toggle: bodyHk.toggle !== undefined ? bodyHk.toggle : hk.toggle,
                mode: bodyHk.mode !== undefined ? bodyHk.mode : hk.mode,
              },
            },
          })
          if (body.downloadDir !== undefined && next.settings.downloadDir === '') {
            throw new Error('下载目录需要是绝对路径（以 / 开头）')
          }
          if (next.settings.downloadDir && next.settings.downloadDir !== state.settings.downloadDir) {
            await mkdir(next.settings.downloadDir, { recursive: true })
          }
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        if (action === 'playlist/add-folder' && req.method === 'POST') {
          const body = await readJSON(req)
          const { root, tracks } = await scanFolder(body.root)
          const pl = {
            id: `local:${root}`,
            name: String(body.name ?? '').trim() || root.split(sep).pop() || '本地音乐',
            kind: 'local', source: 'local', refId: '', root, tracks,
          }
          const next = sanitizeState({ ...state, playlists: [...state.playlists.filter((p) => p.id !== pl.id), pl] })
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        if (action === 'playlist/add-custom' && req.method === 'POST') {
          const body = await readJSON(req)
          const tracks = parseCustomPlaylist(body.text)
          if (tracks.length === 0) throw new Error('没有解析出任何歌曲（每行需要带播放地址）')
          const pl = {
            id: `custom:${Date.now().toString(36)}`,
            name: String(body.name ?? '').trim() || '网络歌单',
            kind: 'custom', source: 'custom', refId: '', root: '', tracks,
          }
          const next = sanitizeState({ ...state, playlists: [...state.playlists, pl] })
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        if (action === 'playlist/add-platform' && req.method === 'POST') {
          const body = await readJSON(req)
          const pl = {
            id: `platform:${body.source}:${body.refId}`,
            name: String(body.name ?? '').trim() || '平台歌单',
            kind: 'platform', source: String(body.source ?? ''), refId: String(body.refId ?? ''), root: '', tracks: [],
          }
          const next = sanitizeState({ ...state, playlists: [...state.playlists.filter((p) => p.id !== pl.id), pl] })
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        if (action === 'playlist/remove' && req.method === 'POST') {
          const body = await readJSON(req)
          const next = sanitizeState({ ...state, playlists: state.playlists.filter((p) => p.id !== body.id) })
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        if (action === 'playlist/track-update' && req.method === 'POST') {
          const body = await readJSON(req)
          let hit = false
          const next = sanitizeState({
            ...state,
            playlists: state.playlists.map((p) => ((p.kind !== 'local' && p.kind !== 'custom') ? p : {
              ...p,
              tracks: p.tracks.map((t) => {
                if (t.id !== body.id) return t
                hit = true
                return {
                  ...t,
                  title: String(body.title ?? '').trim().slice(0, 300) || t.title,
                  artist: String(body.artist ?? '').trim().slice(0, 300),
                }
              }),
            })),
          })
          if (!hit) return sendJSON(res, 404, { error: '歌曲不存在' })
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        if (action === 'playlist/tracks' && req.method === 'GET') {
          const pl = state.playlists.find((p) => p.id === url.searchParams.get('id'))
          if (!pl) return sendJSON(res, 404, { error: '歌单不存在' })
          if (pl.kind === 'platform') {
            if (pl.source === 'netease') return sendJSON(res, 200, await netease.playlistTracks(pl.refId))
            if (pl.source === 'bilibili') return sendJSON(res, 200, await bilibili.playlistTracks(pl.refId, cookieOf(state, 'bilibili')))
            if (pl.source === 'kugou') return sendJSON(res, 200, await kugou.playlistTracks(pl.refId, cookieOf(state, 'kugou')))
            if (pl.source === 'kuwo') return sendJSON(res, 200, await kuwo.playlistTracks(pl.refId, cookieOf(state, 'kuwo')))
            if (pl.source === 'qq') return sendJSON(res, 200, await qq.playlistTracks(pl.refId, cookieOf(state, 'qq')))
            if (pl.source === 'qishui') {
              await qishui.ensure(state, qishuiHelpers)
              return sendJSON(res, 200, await qishui.playlistTracks(pl.refId))
            }
            return sendJSON(res, 400, { error: '该平台暂不支持歌单' })
          }
          if (pl.kind === 'local') {
            // lazily backfill durations and the artist split for tracks scanned by older versions
            let changed = false
            for (const t of pl.tracks) {
              if (!t.url) continue
              if (!t.artist) {
                const stem = String(t.title || '').replace(/\.[a-z0-9]+$/i, '')
                const named = parseTrackName(stem)
                if (named.artist && named.artist !== t.artist) { t.title = named.title; t.artist = named.artist; changed = true }
              }
              if (t.duration > 0) continue
              const dur = await probeDuration(t.url)
              if (dur > 0) { t.duration = dur; changed = true }
            }
            if (changed) {
              const next = sanitizeState(state)
              await writeState(next)
              return sendJSON(res, 200, { tracks: next.playlists.find((p) => p.id === pl.id)?.tracks ?? pl.tracks })
            }
          }
          return sendJSON(res, 200, { tracks: pl.tracks })
        }

        if (action === 'search' && req.method === 'GET') {
          const q = url.searchParams.get('q') ?? ''
          const source = url.searchParams.get('source') ?? 'netease'
          const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
          if (!q.trim()) return sendJSON(res, 200, { tracks: [] })
          if (source === 'netease') return sendJSON(res, 200, await netease.search(q, page))
          if (source === 'bilibili') return sendJSON(res, 200, await bilibili.search(q, page))
          if (source === 'kuwo') return sendJSON(res, 200, await kuwo.search(q, page))
          if (source === 'kugou') return sendJSON(res, 200, await kugou.search(q, page))
          if (source === 'qq') return sendJSON(res, 200, await qq.search(q, page))
          if (source === 'pan') return sendJSON(res, 200, await pan.search(q, page))
          if (source === '5sing') return sendJSON(res, 200, await fivesing.search(q, page))
          if (source === 'wusunk') return sendJSON(res, 200, await wusunk.search(q, page))
          if (source === 'qishui') {
            await qishui.ensure(state, qishuiHelpers)
            return sendJSON(res, 200, await qishui.search(q, page))
          }
          return sendJSON(res, 400, { error: '未知音源' })
        }

        if (action === 'search-playlists' && req.method === 'GET') {
          const q = url.searchParams.get('q') ?? ''
          const source = url.searchParams.get('source') ?? 'netease'
          if (!q.trim()) return sendJSON(res, 200, { playlists: [] })
          if (source === 'qishui') {
            await qishui.ensure(state, qishuiHelpers)
            return sendJSON(res, 200, await qishui.searchPlaylists(q))
          }
          return sendJSON(res, 200, source === 'qq' ? await qq.searchPlaylists(q) : await netease.searchPlaylists(q))
        }

        if (action === 'song-url' && req.method === 'GET') {
          const id = url.searchParams.get('id') ?? ''
          const source = url.searchParams.get('source') ?? ''
          const remote = await remoteSongUrl(state, source, id).catch((error) => ({ error: String(error?.message ?? error) }))
          if (remote.error) return sendJSON(res, 404, { error: remote.error })
          return sendJSON(res, 200, { url: `${ROUTE_PREFIX}/stream?u=${encodeURIComponent(remote)}` })
        }

        if (action === 'lyrics' && req.method === 'GET') {
          const source = url.searchParams.get('source') ?? ''
          const id = url.searchParams.get('id') ?? ''
          if (source === 'local') {
            const pl = state.playlists.find((p) => p.tracks.some((t) => t.id === id))
            const track = pl?.tracks.find((t) => t.id === id)
            if (!track?.lrcPath) return sendJSON(res, 200, { lrc: '' })
            const rawLrc = await readFile(track.lrcPath).catch(() => null)
            return sendJSON(res, 200, { lrc: rawLrc ? decodeText(rawLrc) : '' })
          }
          if (source === 'netease') return sendJSON(res, 200, await netease.lyric(id))
          if (source === 'qq') return sendJSON(res, 200, await qq.lyric(id))
          if (source === 'pan') return sendJSON(res, 200, await pan.lyric(id))
          if (source === '5sing') return sendJSON(res, 200, await fivesing.lyric(id))
          if (source === 'qishui') {
            await qishui.ensure(state, qishuiHelpers)
            return sendJSON(res, 200, await qishui.lyric(id))
          }
          return sendJSON(res, 200, { lrc: '' })
        }

        if (action === 'pan-link' && req.method === 'GET') {
          const id = url.searchParams.get('id') ?? ''
          return sendJSON(res, 200, id.startsWith('wusunk:') ? await wusunk.links(id) : await pan.links(id))
        }

        if (action === 'qr-start' && req.method === 'POST') {
          const body = await readJSON(req).catch(() => ({}))
          const platform = String(body.platform ?? 'netease')
          if (platform === 'qishui' || platform === 'soda') {
            await qishui.ensure(state, qishuiHelpers)
            const r = await qishui.qrStart()
            return sendJSON(res, 200, { key: r.key, qrimg: r.qrimg })
          }
          const r = platform === 'kugou' ? await kugou.qrStart()
            : platform === 'qq' ? await qq.qrStart()
            : await netease.qrStart()
          if (!r.key) throw new Error('二维码创建失败')
          const qrimg = r.qrimg ?? await QRCode.toDataURL(r.qrurl, { margin: 1, width: 220 })
          return sendJSON(res, 200, { key: r.key, qrimg })
        }

        if (action === 'qr-poll' && req.method === 'GET') {
          const key = url.searchParams.get('key') ?? ''
          const platform = url.searchParams.get('platform') ?? 'netease'
          if (platform === 'qishui' || platform === 'soda') {
            await qishui.ensure(state, qishuiHelpers)
            const r = await qishui.qrPoll(key)
            if (r.state === 'confirmed') {
              await qishui.flush()
              const acc = await qishui.account()
              const next = sanitizeState({
                ...state,
                accounts: { ...state.accounts, soda: { ...state.accounts.soda, name: acc.name, uid: acc.uid } },
              })
              await writeState(next)
              return sendJSON(res, 200, { code: 803, nickname: acc.name, account: { name: acc.name, uid: acc.uid, loggedIn: true } })
            }
            const code = { waiting: 801, scanned: 802, expired: 804, error: 805 }[r.state] ?? 801
            return sendJSON(res, 200, { code })
          }
          const r = platform === 'kugou' ? await kugou.qrPoll(key)
            : platform === 'qq' ? await qq.qrPoll(key)
            : await netease.qrPoll(key)
          if (r.code === 803 && r.cookie) {
            const next = sanitizeState({
              ...state,
              accounts: { ...state.accounts, [platform]: { name: r.nickname || `${platform}用户`, cookie: r.cookie, uid: r.uid } },
            })
            await writeState(next)
            return sendJSON(res, 200, { code: 803, nickname: r.nickname, account: { name: r.nickname, uid: r.uid, loggedIn: true } })
          }
          return sendJSON(res, 200, { code: r.code, nickname: r.nickname ?? '' })
        }

        if (action === 'login-cookie' && req.method === 'POST') {
          const body = await readJSON(req)
          const cookie = String(body.cookie ?? '').trim()
          if (!cookie) throw new Error('cookie 不能为空')
          const out = await bilibili.loginByCookie(cookie)
          const next = sanitizeState({
            ...state,
            accounts: { ...state.accounts, bilibili: { name: out.nickname, cookie, uid: out.uid } },
          })
          await writeState(next)
          return sendJSON(res, 200, { name: out.nickname, uid: out.uid, loggedIn: true })
        }

        if (action === 'kuwo-captcha' && req.method === 'GET') {
          return sendJSON(res, 200, await kuwo.captchaGet())
        }

        if (action === 'kuwo-sms' && req.method === 'POST') {
          const body = await readJSON(req)
          const mobile = String(body.mobile ?? '').trim()
          if (!/^1\d{10}$/.test(mobile)) throw new Error('请输入符合中国大陆的手机号')
          return sendJSON(res, 200, await kuwo.smsSend(mobile, String(body.verifyCode ?? '').trim(), String(body.token ?? '')))
        }

        if (action === 'kuwo-login' && req.method === 'POST') {
          const body = await readJSON(req)
          const out = await kuwo.loginByMobile(String(body.mobile ?? '').trim(), String(body.smsCode ?? '').trim(), String(body.tm ?? ''))
          const next = sanitizeState({
            ...state,
            accounts: { ...state.accounts, kuwo: { name: out.name, cookie: out.cookie, uid: out.uid } },
          })
          await writeState(next)
          return sendJSON(res, 200, { name: out.name, uid: out.uid, loggedIn: true })
        }

        if (action === 'logout' && req.method === 'POST') {
          const body = await readJSON(req)
          if (body.platform === 'soda' || body.platform === 'qishui') qishui.dropMem()
          const accounts = { ...state.accounts }
          delete accounts[String(body.platform ?? '')]
          const next = sanitizeState({ ...state, accounts })
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        if (action === 'account-playlists' && req.method === 'GET') {
          const source = url.searchParams.get('source') ?? ''
          if (source === 'netease') {
            const acc = state.accounts.netease
            if (!acc?.cookie) throw new Error('未登录')
            return sendJSON(res, 200, await netease.userPlaylists(acc.uid, acc.cookie))
          }
          if (source === 'bilibili') {
            const acc = state.accounts.bilibili
            if (!acc?.cookie) throw new Error('未登录')
            return sendJSON(res, 200, await bilibili.userPlaylists(acc.uid, acc.cookie))
          }
          if (source === 'kugou') {
            const acc = state.accounts.kugou
            if (!acc?.cookie) throw new Error('未登录')
            return sendJSON(res, 200, await kugou.userPlaylists(acc.cookie))
          }
          if (source === 'kuwo') {
            const acc = state.accounts.kuwo
            if (!acc?.cookie) throw new Error('未登录')
            return sendJSON(res, 200, await kuwo.userPlaylists(acc.uid, acc.cookie))
          }
          if (source === 'qq') {
            const acc = state.accounts.qq
            if (!acc?.cookie) throw new Error('未登录')
            return sendJSON(res, 200, await qq.userPlaylists(acc.cookie))
          }
          if (source === 'qishui' || source === 'soda') {
            await qishui.ensure(state, qishuiHelpers)
            if (!state.accounts.soda?.session) throw new Error('未登录')
            return sendJSON(res, 200, await qishui.userPlaylists())
          }
          return sendJSON(res, 400, { error: '该平台暂不支持账号歌单' })
        }

        if (action === 'file' && req.method === 'GET') {
          const target = resolve(String(url.searchParams.get('p') ?? ''))
          if (!fileWithinRoots(state, target)) return sendJSON(res, 403, { error: '路径不在已添加的本地歌单内' })
          const dot = target.lastIndexOf('.')
          const ext = dot >= 0 ? target.slice(dot).toLowerCase() : ''
          if (!MIME[ext]) return sendJSON(res, 400, { error: '不支持的文件类型' })
          return pipeFile(req, res, target, MIME[ext])
        }

        if (action === 'stream' && req.method === 'GET') {
          const target = url.searchParams.get('u') ?? ''
          if (/^https?:\/\//i.test(target)) return pipeRemote(req, res, target)
          // Local paths come through the same endpoint from the client's track objects.
          const local = resolve(target)
          if (!fileWithinRoots(state, local)) return sendJSON(res, 403, { error: '该地址不允许代理' })
          const dot = local.lastIndexOf('.')
          const ext = dot >= 0 ? local.slice(dot).toLowerCase() : ''
          if (!MIME[ext]) return sendJSON(res, 400, { error: '不支持的文件类型' })
          return pipeFile(req, res, local, MIME[ext])
        }

        if (action === 'downloads/tracks' && req.method === 'GET') {
          const dir = downloadDirOf(state)
          await backfillDownloadDurations(state)
          return sendJSON(res, 200, {
            tracks: state.downloads.map((d) => ({
              id: d.id,
              title: d.title,
              artist: d.artist,
              url: join(dir, d.file),
              cover: d.cover ? join(dir, d.cover) : '',
              duration: d.duration,
              source: 'local',
              origin: d.source,
              lrcPath: d.lrc ? join(dir, d.lrc) : '',
            })),
          })
        }

        if (action === 'open-download-dir' && req.method === 'POST') {
          const dir = downloadDirOf(state)
          const st2 = await stat(dir).catch(() => null)
          if (!st2?.isDirectory()) throw new Error('下载目录不存在，请先保存有效目录')
          const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
          execFile(opener, [dir], () => {})
          return sendJSON(res, 200, { ok: true })
        }

        if (action === 'download-progress' && req.method === 'GET') {
          const key = url.searchParams.get('key') ?? ''
          return sendJSON(res, 200, dlProgress.get(key) ?? {})
        }

        if (action === 'download' && req.method === 'POST') {
          const body = await readJSON(req)
          const source = String(body.source ?? '')
          const id = String(body.id ?? '')
          if (!source || !id) throw new Error('缺少歌曲信息')
          const key = dlKey(source, id)
          setDl(key, { phase: 'linking' })
          try {
            const remote = await remoteSongUrl(state, source, id)
            const headers = {}
            const ref = refererFor(remote)
            if (ref) headers.referer = ref
            const { buf, contentType } = await httpBin(remote, {
              headers,
              onProgress: (received, total) => setDl(key, { phase: 'downloading', received, total }),
            })
            setDl(key, { phase: 'saving', received: buf.length, total: buf.length })
          const dir = downloadDirOf(state)
          await mkdir(dir, { recursive: true })

          const title = safeName(body.title)
          const artist = safeName(body.artist)
          const ext = audioExtOf(remote, contentType)
          const base = safeName(artist ? `${artist} - ${title}` : title)
          const audioPath = await uniquePath(dir, base, ext)

          const meta = { album: String(body.album ?? ''), cover: String(body.cover ?? '') }
          if (source === 'netease' && !meta.cover) {
            try { Object.assign(meta, await netease.songDetail(id)) } catch {}
          }
          if (source === '5sing' && !meta.cover) {
            try { Object.assign(meta, await fivesing.detail(id)) } catch {}
          }
          body.album = meta.album

          let lrc = ''
          try { lrc = await lyricOf(state, source, id) } catch {}
          let coverBuf = null
          let coverMime = ''
          let coverPath = ''
          const coverUrl = meta.cover
          if (/^https?:\/\//.test(coverUrl) && !isBlockedHost(new URL(coverUrl).hostname)) {
            try {
              const r = await httpBin(coverUrl, { maxBytes: 5 * 1024 * 1024 })
              coverBuf = r.buf
              coverMime = r.contentType.includes('png') ? 'image/png' : 'image/jpeg'
              coverPath = await uniquePath(dir, base, coverMime === 'image/png' ? '.png' : '.jpg')
            } catch {}
          }

          await writeFile(audioPath, buf)
          if (coverBuf && coverPath) await writeFile(coverPath, coverBuf)
          let lrcFile = ''
          if (lrc) {
            lrcFile = join(dir, `${basename(audioPath, ext)}.lrc`)
            await writeFile(lrcFile, lrc, 'utf8')
          }
          if (ext === '.mp3') {
            await tagFile(audioPath, {
              title: String(body.title ?? ''), artist: String(body.artist ?? ''),
              album: String(body.album ?? ''), lyricist: String(body.lyricist ?? ''),
              composer: String(body.composer ?? ''), lyrics: lrc, coverBuf, coverMime,
            })
          }

          const entry = {
            id: `dl:${Date.now().toString(36)}:${basename(audioPath)}`,
            file: basename(audioPath),
            lrc: lrcFile ? basename(lrcFile) : '',
            cover: coverPath ? basename(coverPath) : '',
            title: String(body.title ?? '') || '未命名',
            artist: String(body.artist ?? ''),
            album: String(body.album ?? ''),
            lyricist: String(body.lyricist ?? ''),
            composer: String(body.composer ?? ''),
            duration: Number(body.duration) || 0,
            source, sourceId: id,
          }
          // Same song downloaded again replaces the old entry + files.
          const stale = state.downloads.filter((d) => d.source === source && d.sourceId === id)
          const downloads = [...state.downloads.filter((d) => !(d.source === source && d.sourceId === id)), entry]
          const next = sanitizeState({ ...state, downloads })
          await writeState(next)
          for (const d of stale) {
            for (const f of [d.file, d.lrc, d.cover]) {
              if (f) await unlink(join(downloadDirOf(state), f)).catch(() => {})
            }
          }
          setDl(key, { phase: 'done' })
          return sendJSON(res, 200, { download: entry })
          } catch (e) {
            setDl(key, { phase: 'error', message: String(e.message ?? e) })
            throw e
          }
        }

        if (action === 'download-update' && req.method === 'POST') {
          const body = await readJSON(req)
          const entry = state.downloads.find((d) => d.id === body.id)
          if (!entry) return sendJSON(res, 404, { error: '下载记录不存在' })
          const dir = downloadDirOf(state)
          const next = {
            ...entry,
            title: body.title !== undefined ? String(body.title).slice(0, 300) : entry.title,
            artist: body.artist !== undefined ? String(body.artist).slice(0, 300) : entry.artist,
            album: body.album !== undefined ? String(body.album).slice(0, 300) : entry.album,
            lyricist: body.lyricist !== undefined ? String(body.lyricist).slice(0, 300) : entry.lyricist,
            composer: body.composer !== undefined ? String(body.composer).slice(0, 300) : entry.composer,
          }
          const ext = extname(entry.file)
          const newBase = safeName(next.artist ? `${next.artist} - ${next.title}` : next.title)
          const renames = []
          if (newBase && safeName(basename(entry.file, ext)) !== newBase) {
            renames.push([join(dir, entry.file), await uniquePath(dir, newBase, ext)])
            next.file = basename(renames[renames.length - 1][1])
          }
          let coverBuf = null
          let coverMime = ''
          const coverUrl = String(body.cover ?? '')
          if (/^https?:\/\//.test(coverUrl) && !isBlockedHost(new URL(coverUrl).hostname)) {
            const r = await httpBin(coverUrl, { maxBytes: 5 * 1024 * 1024 }).catch(() => null)
            if (r) {
              coverBuf = r.buf
              coverMime = r.contentType.includes('png') ? 'image/png' : 'image/jpeg'
              const target = await uniquePath(dir, newBase || safeName(next.title), coverMime === 'image/png' ? '.png' : '.jpg')
              if (entry.cover) await unlink(join(dir, entry.cover)).catch(() => {})
              await writeFile(target, coverBuf)
              next.cover = basename(target)
            }
          }
          for (const [from, to] of renames) {
            if (from !== to) await rename(from, to).catch(() => {})
          }
          if (next.lrc && renames.length > 0) {
            const from = join(dir, entry.lrc)
            const to = join(dir, basename(next.file, ext) + '.lrc')
            if (from !== to) await rename(from, to).catch(() => {})
            next.lrc = basename(to)
          }
          if (ext === '.mp3') {
            const lrcText = next.lrc ? await readFile(join(dir, next.lrc), 'utf8').catch(() => '') : ''
            if (!coverBuf && next.cover) {
              const raw = await readFile(join(dir, next.cover)).catch(() => null)
              if (raw) {
                coverBuf = raw
                coverMime = next.cover.endsWith('.png') ? 'image/png' : 'image/jpeg'
              }
            }
            await tagFile(join(dir, next.file), {
              title: next.title, artist: next.artist, album: next.album,
              lyricist: next.lyricist, composer: next.composer,
              lyrics: lrcText, coverBuf, coverMime,
            })
          }
          const downloads = state.downloads.map((d) => (d.id === entry.id ? next : d))
          const nextState = sanitizeState({ ...state, downloads })
          await writeState(nextState)
          return sendJSON(res, 200, publicState(nextState))
        }

        if (action === 'download-delete' && req.method === 'POST') {
          const body = await readJSON(req)
          const ids = new Set(Array.isArray(body.ids) ? body.ids.map((x) => String(x)) : body.id != null ? [String(body.id)] : [])
          const hit = state.downloads.filter((d) => ids.has(d.id))
          if (hit.length === 0) return sendJSON(res, 404, { error: '下载记录不存在' })
          const dir = downloadDirOf(state)
          for (const entry of hit) {
            for (const f of [entry.file, entry.lrc, entry.cover]) {
              if (f) await unlink(join(dir, f)).catch(() => {})
            }
          }
          const next = sanitizeState({ ...state, downloads: state.downloads.filter((d) => !ids.has(d.id)) })
          await writeState(next)
          return sendJSON(res, 200, publicState(next))
        }

        return sendJSON(res, 404, { error: `unknown action ${action}` })
      } catch (error) {
        return sendJSON(res, 500, { error: String(error?.message ?? error) })
      }
    })()
  }

  ctx.inject(['webServer'], (scope) => {
    const off = scope.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: route })
    return () => {
      try {
        off()
      } catch {}
    }
  })
}
