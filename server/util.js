import { request as httpsRequest } from 'node:https'

/**
 * Pure helpers shared by the music sources: netease weapi crypto, bilibili wbi signing,
 * playlist-text parsing and state sanitising. No cordis, no DOM — self-check.mjs runs these.
 */
import crypto from 'node:crypto'

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export function md5hex(text) {
  return crypto.createHash('md5').update(text).digest('hex')
}

export function randomKey(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < len; i += 1) out += chars[crypto.randomInt(chars.length)]
  return out
}

export function modPow(base, exp, mod) {
  let result = 1n
  let b = base % mod
  let e = exp
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod
    b = (b * b) % mod
    e >>= 1n
  }
  return result
}

function aesCbcB64(text, key) {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from('0102030405060708', 'utf8'))
  return Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]).toString('base64')
}

// Constants cross-checked across jitwxs/163MusicLyrics, codezjx/netease-cloud-music-dl and
// Siy0822/NeteaseCloudMusicTasks — all agree byte for byte.
const NE_MODULUS =
  '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'

/** NetEase weapi form fields: params = double AES-CBC, encSecKey = RSA(no padding) of the random key. */
export function weapi(payload) {
  const text = JSON.stringify(payload)
  const secret = randomKey(16)
  const params = aesCbcB64(aesCbcB64(text, '0CoJUm6Qyw8W8jud'), secret)
  let hex = ''
  for (const byte of Buffer.from([...secret].reverse().join(''), 'utf8')) hex += byte.toString(16).padStart(2, '0')
  const encSecKey = modPow(BigInt('0x' + hex), 0x10001n, BigInt('0x' + NE_MODULUS)).toString(16).padStart(256, '0')
  return { params, encSecKey }
}

// bilibili wbi reordering table (SocialSisterYi/bilibili-API-collect, stable since 2023).
const MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
]

export function mixinKey(imgKey, subKey) {
  const raw = imgKey + subKey
  let out = ''
  for (const n of MIXIN_TAB) out += raw[n]
  return out.slice(0, 32)
}

/** Signed query string (wts + w_rid) for bilibili /wbi/ endpoints. */
export function wbiSign(params, imgKey, subKey) {
  const key = mixinKey(imgKey, subKey)
  const query = new URLSearchParams()
  query.set('wts', String(Math.floor(Date.now() / 1000)))
  for (const [k, v] of Object.entries(params)) query.set(k, String(v).replace(/[!'()*]/g, ''))
  query.sort()
  const text = query.toString().replace(/\+/g, '%20')
  return `${text}&w_rid=${md5hex(text + key)}`
}

/** fetch with UA/timeout; returns { status, json, setCookie } so login flows can keep cookies. */
// shortcut: some hosts (kuwo) soft-block the proxy exit IP; `direct` bypasses the host's
// global undici dispatcher with a plain node:https call. No redirect following.
function directJson(url, { method = 'GET', headers = {}, body, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpsRequest({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => { if (chunks.reduce((n, b) => n + b.length, 0) < 1024 * 1024) chunks.push(c) })
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = JSON.parse(text) } catch { json = { raw: text } }
        resolve({ status: res.statusCode ?? 0, json, setCookie: res.headers['set-cookie'] ?? [] })
      })
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => req.destroy(new Error('请求超时')))
    if (body) req.write(body)
    req.end()
  })
}

export async function httpJson(url, opts = {}) {
  if (opts.direct) return directJson(url, opts)
  const { method = 'GET', headers = {}, body, timeout = 15000 } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      method,
      headers: { 'user-agent': UA, ...headers },
      body,
      signal: controller.signal,
      redirect: 'follow',
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
    return { status: res.status, json, setCookie: typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [] }
  } finally {
    clearTimeout(timer)
  }
}

/** fetch raw bytes with UA/referer/timeout + size cap; used by the download flow. */
export async function httpBin(url, { headers = {}, maxBytes = 128 * 1024 * 1024, timeout = 60000, onProgress } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'zh-CN,zh;q=0.9', ...headers },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length')) || 0
    const chunks = []
    let size = 0
    for await (const chunk of res.body) {
      size += chunk.length
      if (size > maxBytes) throw new Error('文件过大（>128MB），已取消')
      chunks.push(Buffer.from(chunk))
      onProgress?.(size, total)
    }
    return { buf: Buffer.concat(chunks), contentType: res.headers.get('content-type') ?? '' }
  } finally {
    clearTimeout(timer)
  }
}

/** Custom playlist text: one track per line, "标题 - 步手 URL" or a bare URL; #EXTM3U/#EXTINF
 * lines are honoured when present so real .m3u files paste cleanly.
 */
export function parseCustomPlaylist(text) {
  const tracks = []
  let pending = null
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#EXTM3U')) continue
    if (/^#EXTINF:/i.test(line)) {
      const rest = line.slice(8)
      const m = rest.match(/^(?:(\d+(?:\.\d+)?)\s*,\s*)?([\s\S]*)$/)
      pending = { duration: m?.[1] ? Math.round(Number(m[1])) : 0, hint: (m?.[2] ?? '').trim() }
      continue
    }
    if (line.startsWith('#')) continue
    const m = line.match(/^(.*?)(https?:\/\/\S+)\s*$/)
    if (!m) {
      pending = null
      continue
    }
    const url = m[2]
    let head = m[1].trim().replace(/[\s\-|，,]+$/, '')
    let duration = 0
    if (pending?.hint) {
      head = pending.hint
      duration = pending.duration
    }
    let title = head
    let artist = ''
    const dash = head.lastIndexOf(' - ')
    if (dash > 0) {
      title = head.slice(0, dash).trim()
      artist = head.slice(dash + 3).trim()
    }
    if (!title) {
      try {
        title = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').replace(/\.[a-z0-9]{2,5}$/i, '')
      } catch {
        title = ''
      }
    }
    tracks.push({
      id: 'custom:' + url,
      title: title || '未命名',
      artist,
      url,
      cover: '',
      duration,
      source: 'custom',
    })
    pending = null
  }
  return tracks
}

export const SOURCES = ['local', 'custom', 'netease', 'bilibili', 'kuwo', 'qq', 'kugou', 'pan', '5sing', 'wusunk', 'qishui']
export const MODES = ['order', 'shuffle', 'single']
export const PLATFORMS = ['netease', 'bilibili', 'kuwo', 'qq', 'kugou', 'soda']

/** 平台默认快捷键：mac 用 ⌥(Alt)+键，其余 Ctrl+Alt+键；←/→ 切歌、P 播放暂停、M 播放模式。 */
export function defaultHotkeys(platform = process.platform) {
  const m = platform === 'darwin' ? 'Alt' : 'Ctrl+Alt'
  return { prev: `${m}+ArrowLeft`, next: `${m}+ArrowRight`, toggle: `${m}+P`, mode: `${m}+M` }
}

function str(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

/** Whitelist rebuild: a hand-edited state file or a stray POST cannot invent shapes. */
export function sanitizeState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const out = {
    playlists: [],
    settings: {
      mode: MODES.includes(s.settings?.mode) ? s.settings.mode : 'order',
      downloadDir: typeof s.settings?.downloadDir === 'string' && s.settings.downloadDir.startsWith('/')
        ? s.settings.downloadDir.slice(0, 2000)
        : '',
      pageSize: Number.isFinite(Number(s.settings?.pageSize)) ? Math.min(100, Math.max(5, Math.round(Number(s.settings.pageSize)))) : 10,
      // defaultSource: builtin whitelist, or custom:<id> matching an existing user source
      defaultSource: ['netease','bilibili','kuwo','kugou','qq','qishui','pan','5sing','wusunk'].includes(s.settings?.defaultSource)
        || (typeof s.settings?.defaultSource === 'string' && s.settings.defaultSource.startsWith('custom:') && (s.musicSources ?? []).some((m) => m.id === s.settings.defaultSource.slice(7)))
        ? s.settings.defaultSource : 'bilibili',
      accent: typeof s.settings?.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.settings.accent) ? s.settings.accent : '',
      hotkeys: {
        prev: typeof s.settings?.hotkeys?.prev === 'string' ? s.settings.hotkeys.prev.slice(0, 40) : '',
        next: typeof s.settings?.hotkeys?.next === 'string' ? s.settings.hotkeys.next.slice(0, 40) : '',
        toggle: typeof s.settings?.hotkeys?.toggle === 'string' ? s.settings.hotkeys.toggle.slice(0, 40) : '',
        mode: typeof s.settings?.hotkeys?.mode === 'string' ? s.settings.hotkeys.mode.slice(0, 40) : '',
      },
      // 首次运行（或升级前从未配置快捷键）播种一套平台默认值，之后不再干预（用户可清除）
      hk: s.settings?.hk === true || s.settings?.hk === 1,
    },
    accounts: {},
    downloads: [],
  }
  if (!out.settings.hk) {
    out.settings.hk = true
    const hk = out.settings.hotkeys
    if (!hk.prev && !hk.next && !hk.toggle && !hk.mode) out.settings.hotkeys = defaultHotkeys()
  }
  let seq = 0
  for (const p of (Array.isArray(s.playlists) ? s.playlists : []).slice(0, 100)) {
    if (!p || typeof p !== 'object') continue
    const kind = ['local', 'custom', 'platform'].includes(p.kind) ? p.kind : 'custom'
    if (kind === 'local' && !str(p.root, 2000)) continue
    const pl = {
      id: str(p.id, 120) || `pl${Date.now().toString(36)}${(seq += 1)}`,
      name: str(p.name, 200) || '未命名',
      kind,
      source: SOURCES.includes(p.source) ? p.source : '',
      refId: str(p.refId, 300),
      root: str(p.root, 2000),
      tracks: [],
    }
    for (const t of (Array.isArray(p.tracks) ? p.tracks : []).slice(0, 2000)) {
      if (!t || typeof t !== 'object') continue
      pl.tracks.push({
        id: str(t.id, 600),
        title: str(t.title, 300) || '未命名',
        artist: str(t.artist, 300),
        url: str(t.url, 4000),
        cover: str(t.cover, 4000),
        duration: Number.isFinite(t.duration) && t.duration >= 0 ? Math.min(Math.round(t.duration), 36000) : 0,
        source: SOURCES.includes(t.source) ? t.source : '',
        lrcPath: str(t.lrcPath, 4000),
      })
    }
    out.playlists.push(pl)
  }
  const acc = s.accounts && typeof s.accounts === 'object' ? s.accounts : {}
  for (const k of PLATFORMS) {
    const a = acc[k]
    if (a && typeof a === 'object') {
      const entry = { name: str(a.name, 150), cookie: str(a.cookie, 20000), uid: str(a.uid, 80) }
      // qishui car-protocol login keeps a structured credential (never exposed to the page)
      if (k === 'soda' && a.session && typeof a.session === 'object') {
        const json = JSON.stringify(a.session)
        if (json.length <= 20000) entry.session = a.session
        entry.deviceId = str(a.deviceId, 64)
      }
      out.accounts[k] = entry
    }
  }
  // Download library: filenames are stored as bare names — a hand-edited file cannot aim
  // the delete/rename routes outside the download dir.
  const base = (v) => str(v, 300).split('/').pop().split('\\').pop()
  for (const d of (Array.isArray(s.downloads) ? s.downloads : []).slice(0, 500)) {
    if (!d || typeof d !== 'object') continue
    out.downloads.push({
      id: str(d.id, 120) || `dl${Date.now().toString(36)}${out.downloads.length}`,
      file: base(d.file),
      lrc: base(d.lrc),
      cover: base(d.cover),
      title: str(d.title, 300) || '未命名',
      artist: str(d.artist, 300),
      album: str(d.album, 300),
      lyricist: str(d.lyricist, 300),
      composer: str(d.composer, 300),
      duration: Number.isFinite(d.duration) && d.duration >= 0 ? Math.min(Math.round(d.duration), 36000) : 0,
      source: SOURCES.includes(d.source) ? d.source : '',
      sourceId: str(d.sourceId, 600),
    })
  }
  // LX-style user source scripts: raw script text stays server-side only (publicState strips it)
  out.musicSources = []
  for (const m of (Array.isArray(s.musicSources) ? s.musicSources : []).slice(0, 20)) {
    if (!m || typeof m !== 'object' || typeof m.script !== 'string' || !m.script.trim()) continue
    out.musicSources.push({
      id: str(m.id, 120) || `src${Date.now().toString(36)}${out.musicSources.length}`,
      name: str(m.name, 60) || '未命名源',
      description: str(m.description, 120),
      version: str(m.version, 40),
      author: str(m.author, 60),
      homepage: str(m.homepage, 300),
      script: m.script.slice(0, 200000),
      enabled: m.enabled !== false,
      platforms: (Array.isArray(m.platforms) ? m.platforms : []).filter((p) => ['kuwo', 'kugou', 'qq', 'netease'].includes(p)).slice(0, 8),
      error: str(m.error, 300),
    })
  }
  return out
}

/** Client-facing view: cookies and raw user-source scripts never leave the server half. */
export function publicState(state) {
  return {
    playlists: state.playlists,
    settings: state.settings,
    downloads: state.downloads,
    musicSources: (state.musicSources ?? []).map(({ script, ...meta }) => meta),
    accounts: Object.fromEntries(
      Object.entries(state.accounts).map(([k, v]) => [k, { name: v.name, uid: v.uid, loggedIn: Boolean(v.cookie || v.uid) }]),
    ),
  }
}

/** Local proxy guards: only public hosts, so the endpoint cannot be aimed at loopback services. */
export function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase()
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (h.includes(':')) {
    // IPv6 literal: block loopback/link-local/ULA.
    return h === '::1' || h.startsWith('::ffff:127.') || h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd')
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const a = h.split('.').map(Number)
    if (a[0] === 0 || a[0] === 10 || a[0] === 127) return true
    if (a[0] === 192 && a[1] === 168) return true
    if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return true
    if (a[0] === 169 && a[1] === 254) return true
    return a[0] >= 224
  }
  return false
}

/** Referer policy: bilibili CDN and netease hosts need one, everything else goes without. */
export function refererFor(url) {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return ''
  }
  if (host.endsWith('hdslb.com') || host.includes('bilivideo') || host.includes('biliapi')) return 'https://www.bilibili.com/'
  if (host.endsWith('music.126.net')) return 'https://music.163.com/'
  if (host.endsWith('gtimg.cn')) return 'https://y.qq.com/'
  return ''
}
