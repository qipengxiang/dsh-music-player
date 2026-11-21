/**
 * NetEase Cloud Music over the weapi endpoint: anonymous search/lyrics/song-url, QR login,
 * account playlists. Song URLs need the account cookie when the track is VIP-only.
 */
import { httpJson, weapi } from './util.js'

const BASE = 'https://music.163.com'

async function ne(path, payload, cookie = '') {
  const body = new URLSearchParams(weapi(payload)).toString()
  const { json } = await httpJson(BASE + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: BASE,
      ...(cookie ? { cookie } : {}),
    },
    body,
  })
  return json
}

function mapSong(s) {
  return {
    id: String(s.id),
    title: s.name ?? '',
    artist: (s.ar ?? []).map((a) => a.name).filter(Boolean).join('/') || (s.artists ?? []).map((a) => a.name).join('/'),
    cover: String(s.al?.picUrl ?? s.album?.picUrl ?? '').replace(/^http:/, 'https:'),
    duration: Math.round((s.dt ?? s.duration ?? 0) / 1000),
    vip: s.fee === 1 || s.fee === 4, // fee: 1 VIP 曲, 4 需购专辑; 0 免费, 8 免费低音质
    source: 'netease',
  }
}

export async function search(q, page = 1) {
  // cloudsearch rejects anonymous callers with code 50000005; the legacy endpoint still works.
  const r = await ne('/weapi/search/get', { s: q, type: 1, offset: (page - 1) * 30, total: true, limit: 30 })
  return { tracks: (r?.result?.songs ?? []).map(mapSong) }
}

/** Legacy search drops al.picUrl; song/detail gives album name + cover for the download flow. */
export async function songDetail(id) {
  const r = await ne('/weapi/v3/song/detail', { c: JSON.stringify([{ id: String(id).replace(/^\D+/, '') }]), ids: [String(id).replace(/^\D+/, '')] })
  const s = r?.songs?.[0]
  return { cover: String(s?.al?.picUrl ?? '').replace(/^http:/, 'https:'), album: String(s?.al?.name ?? '') }
}

export async function searchPlaylists(q) {
  const r = await ne('/weapi/search/get', { s: q, type: 1000, offset: 0, total: true, limit: 20 })
  return {
    playlists: (r?.result?.playlists ?? []).map((p) => ({
      id: String(p.id),
      title: p.name,
      cover: String(p.coverImgUrl ?? '').replace(/^http:/, 'https:'),
      count: p.trackCount ?? 0,
    })),
  }
}

export async function playlistTracks(pid) {
  const r = await ne('/weapi/v6/playlist/detail', { id: Number(pid), n: 1000, s: 8 })
  return { tracks: (r?.playlist?.tracks ?? []).map(mapSong) }
}

export async function songUrl(id, cookie = '') {
  // url/v1 is eapi-only; the legacy enhance/player/url weapi still answers (VIP tracks -> code -110).
  const r = await ne('/weapi/song/enhance/player/url', { ids: [Number(id)], br: 128000 }, cookie)
  const url = r?.data?.[0]?.url
  if (url) return { url: url.replace(/^http:/, 'https:') }
  return { error: '该歌曲需要 VIP 或暂无版权' }
}

export async function lyric(id) {
  const r = await ne('/weapi/song/lyric', { id: Number(id), lv: 1, kv: 1, tv: -1 })
  return { lrc: r?.lrc?.lyric ?? '' }
}

export async function qrStart() {
  const r = await ne('/weapi/login/qrcode/unikey', { type: 1 })
  const key = r?.unikey ?? r?.data?.qrcodeunikey ?? r?.data?.unikey ?? ''
  return { key, qrurl: key ? `https://music.163.com/login?codekey=${key}` : '' }
}

export async function qrPoll(key) {
  const r = await ne('/weapi/login/qrcode/client/login', { key, type: 3 })
  const code = Number(r?.code ?? 0)
  const out = { code }
  if (code === 802) out.nickname = r?.nickname ?? ''
  if (code === 803) {
    out.cookie = r?.cookie ?? ''
    if (out.cookie) {
      const account = await account(out.cookie).catch(() => ({}))
      out.nickname = account.nickname ?? ''
      out.uid = account.uid ?? ''
    }
  }
  return out
}

export async function account(cookie) {
  const r = await ne('/weapi/w/nuser/account/get', {}, cookie)
  if (!r?.account?.id) throw new Error('cookie 已失效')
  return { uid: String(r.account.id), nickname: r.profile?.nickname ?? `用户${r.account.id}` }
}

export async function userPlaylists(uid, cookie = '') {
  const r = await ne('/weapi/user/playlist', { uid: Number(uid), offset: 0, limit: 50, includeVideo: true }, cookie)
  return {
    playlists: (r?.playlist ?? []).map((p) => ({
      id: String(p.id),
      title: p.name,
      cover: String(p.coverImgUrl ?? '').replace(/^http:/, 'https:'),
      count: p.trackCount ?? 0,
    })),
  }
}
