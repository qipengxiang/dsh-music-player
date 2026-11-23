/**
 * Qishui (汽水音乐, accounts key "soda") via the qishui-music-api car-protocol client
 * (open.qishui.com / open.douyin.com only). QR login is a douyin-app scan; the deviceId and
 * login session live in the state file, bridged through callbacks owned by index.js.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createQishuiApi, createQishuiDeviceId, isQishuiDeviceId } = require('qishui-music-api')

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
 * shortcut: VIP full tracks never resolve over the car protocol — the QR scope has no media
 * grant and the upstream only issues full URLs behind official-client signatures (X-Helios/X-Medusa),
 * so logged-in accounts still get the 60s preview. The preview flag lets the client say why.
 */
export async function songUrl(id) {
  const data = await req('audio', { id, quality: 'standard' })
  if (!data.url) return { error: data.preview ? '该歌曲为试听片段' : '该歌曲需要汽水 VIP，暂不支持' }
  return { url: String(data.url), ...(data.preview ? { preview: true } : {}) }
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
