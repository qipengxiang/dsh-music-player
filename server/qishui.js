/**
 * Qishui (汽水音乐, accounts key "soda") via the qishui-music-api car-protocol client
 * (open.qishui.com / open.douyin.com only). QR login is a douyin-app scan; the deviceId and
 * login session live in the state file, bridged through callbacks owned by index.js.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const { createQishuiApi, createQishuiDeviceId, isQishuiDeviceId } = require('qishui-music-api')
// package exports only expose '.', so reach the protocol helpers by absolute path (pinned 0.2.1)
const { QISHUI_PREFIX, QISHUI_UA, qishuiParams, qishuiGuardHeaders } = require(
  join(dirname(require.resolve('qishui-music-api')), 'src/protocol.cjs'))

// In-memory mirror of accounts.soda; the file is the durable truth, hydrated in ensure().
// One shared client: the lib keeps its pending-QR map per instance, so recreating it per
// request would orphan a key between qr-start and qr-create. Recreated only by dropMem().
let mem = { deviceId: '', session: null, api: null }
let saves = []
let persist = null // { saveSession(session|null), saveDeviceId(id) } from index.js

/** Hydrate the bridge before any qishui call. `helpers` is only needed once. */
export async function ensure(state, helpers) {
  if (helpers) persist = helpers
  if (!mem.deviceId) {
    const stored = state?.accounts?.soda?.deviceId ?? ''
    if (isQishuiDeviceId(stored)) {
      mem.deviceId = stored
    } else {
      mem.deviceId = createQishuiDeviceId()
      if (persist?.saveDeviceId) await persist.saveDeviceId(mem.deviceId)
    }
  }
  if (!mem.session && state?.accounts?.soda?.session && typeof state.accounts.soda.session === 'object') {
    mem.session = state.accounts.soda.session
  }
}

export function dropMem() {
  mem.session = null
  mem.api = null
  saves = []
}

function client() {
  if (!mem.deviceId) throw new Error('汽水模块未初始化')
  if (!mem.api) {
    mem.api = createQishuiApi({
      deviceId: mem.deviceId,
      sessions: {
        deviceId: mem.deviceId,
        get revision() { return saves.length },
        get: () => mem.session,
        set: (s) => {
          mem.session = s
          if (persist?.saveSession) saves.push(persist.saveSession(s).catch(() => {}))
        },
        clear: () => {
          mem.session = null
          if (persist?.saveSession) saves.push(persist.saveSession(null).catch(() => {}))
        },
      },
      fetch: globalThis.fetch,
    })
  }
  return mem.api
}

/** Await pending session writes so a following state write cannot race them. */
export function flush() {
  const all = Promise.all(saves)
  saves = []
  return all
}

async function req(op, params) {
  const r = await client().request(op, params)
  if (!r.ok) throw new Error(r.error?.message || '汽水接口错误')
  return r.data
}

const artistOf = (t) => (t.related_info?.artist_links ?? []).map((a) => a.name).filter(Boolean).join('/') || '未知歌手'

const trackOf = (t) => ({
  id: String(t.id ?? t.base_info?.id ?? ''),
  title: String(t.base_info?.name ?? t.name ?? '').trim(),
  artist: artistOf(t),
  cover: '',
  duration: Math.round(Number(t.base_info?.duration_ms ?? t.duration_ms ?? 0) / 1000) || 0,
  source: 'qishui',
})

export async function search(q, page = 1) {
  const data = await req('search', { query: q, limit: 30, offset: (page - 1) * 30 })
  return { tracks: (data.items ?? []).map(trackOf).filter((t) => t.id && t.title) }
}

export async function searchPlaylists(q) {
  const data = await req('search_playlists', { query: q, limit: 20, offset: 0 })
  return {
    playlists: (data.items ?? []).map((p) => ({
      id: String(p.id ?? p.base_info?.id ?? ''),
      title: String(p.title ?? p.base_info?.title ?? '未命名歌单').trim(),
      count: Number(p.track_count ?? p.base_info?.track_count ?? 0) || 0,
    })).filter((p) => p.id),
  }
}

/**
 * Pick the best plaintext full-track URL from player_info, mirroring the lib's
 * playback.cjs ranking. Pure function so tests can feed fixtures.
 * shortcut: no url_player_info fallback; BYD car service always lists video_model first.
 */
export function pickAudioUrl(player) {
  if (!player) return null
  const rank = { standard: 0, high: 1, lossless: 2, hires: 3 }
  for (const variant of ['full', 'preview']) {
    const info = player[variant]?.video_model_info
    if (!info?.video_model) continue
    let model
    try { model = typeof info.video_model === 'string' ? JSON.parse(info.video_model) : info.video_model }
    catch { return null }
    const encrypted = (item) => Boolean(item.encrypt_info?.encrypt || item.encrypt_info?.spade_a || item.PlayAuth || Number(item.Encrypt || 0))
    const levels = { medium: 'standard', higher: 'high', highest: 'high', lossless: 'lossless', hi_res: 'hires' }
    const cands = (model.video_list || []).filter((i) => !encrypted(i) && i.main_url)
      .map((i) => ({ url: i.main_url, q: levels[i.video_meta?.quality] ?? 'standard', br: Number(i.video_meta?.bitrate || 0) }))
    if (!cands.length) continue
    const ok = cands.filter((c) => rank[c.q] <= rank.standard)
    const best = (ok.length ? ok : cands).sort((a, b) => rank[b.q] - rank[a.q] || b.br - a.br)[0]
    return { url: best.url, preview: variant === 'preview' }
  }
  return null
}

/**
 * Signed /media/mget/ with the logged-in credential. The lib's 'audio' op always reads
 * anonymously (catalog.track passes no credential), so copyright tracks only expose the
 * 60s preview; this asks with ticket-guard headers so the account's full variant shows up.
 */
async function signedAudio(id) {
  const c = mem.session
  if (!c) return null
  const qs = new URLSearchParams(qishuiParams(c.deviceId))
  const res = await fetch(`https://open.douyin.com${QISHUI_PREFIX}/media/mget/?${qs}`, {
    method: 'POST',
    headers: { 'user-agent': QISHUI_UA, 'content-type': 'application/json', ...qishuiGuardHeaders(c, '/media/mget/') },
    body: JSON.stringify({ media_list: [{ id, type: 'track' }], card_context: {}, common_params: c.userId ? { user_id: c.userId } : {} }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  if (Number(data?.err_no ?? 0)) return null
  const media = (data?.data?.media_list ?? []).find((m) => String(m.media_id || m.track_entity?.base_info?.id) === id)
  return pickAudioUrl(media?.track_entity?.player_info)
}

export async function songUrl(id) {
  const signed = await signedAudio(id).catch(() => null)
  if (signed?.url) return { url: String(signed.url) }
  const data = await req('audio', { id, quality: 'standard' })
  if (!data.url) return { error: data.preview ? '该歌曲为试听片段' : '该歌曲需要汽水 VIP，暂不支持' }
  return { url: String(data.url) }
}

/** Word-timed lyric "[offset,dur]<..>字<..>..." -> plain lines with second offsets. */
export function parseQishuiLyric(raw) {
  const out = []
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const m = line.match(/^\[(\d+),(\d+)\](.*)$/)
    if (!m) continue
    const text = m[3].replace(/<[^>]*>/g, '')
    if (text.trim()) out.push({ t: Number(m[1]) / 1000, text: text.trim() })
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

const lrcStamp = (sec) => {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `[${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}]`
}

export async function lyric(id) {
  const data = await req('lyrics', { id })
  const lines = parseQishuiLyric(data.lyric_entity?.content)
  return { lrc: lines.map((l) => lrcStamp(l.t) + l.text).join('\n') }
}

export async function qrStart() {
  const { key } = await req('login_qr_key')
  const { imageUrl } = await req('login_qr_create', { key })
  return { key, qrimg: imageUrl }
}

/** waiting|scanned|confirmed|expired|error — on confirm the session is already persisted. */
export async function qrPoll(key) {
  const data = await req('login_qr_check', { key })
  return { state: String(data.state ?? 'waiting') }
}

/** Login-state check (also refreshes an expiring credential). */
export async function status() {
  const data = await req('login_status')
  return { uid: String(data.id ?? ''), name: String(data.nickname ?? '') }
}

export async function account() {
  const s = mem.session
  if (!s?.user) throw new Error('汽水登录态无效')
  return { name: s.user.nickname || `汽水用户${String(s.user.id).slice(-4)}`, uid: String(s.user.id) }
}

export async function userPlaylists() {
  await req('login_status') // refresh credential if near expiry
  const data = await req('user_playlists')
  const list = data.items ?? data.playlists ?? []
  return {
    playlists: list.map((p) => ({
      id: String(p.id ?? p.playlist_id ?? ''),
      title: String(p.title ?? p.name ?? '未命名歌单').trim(),
      count: Number(p.track_count ?? p.count ?? 0) || 0,
    })).filter((p) => p.id),
  }
}

export async function playlistTracks(pid) {
  const data = await req('playlist_tracks', { id: String(pid) })
  const list = data.items ?? data.tracks ?? []
  return { tracks: list.map(trackOf).filter((t) => t.id && t.title) }
}
