/**
 * Bilibili audio: wbi-signed search + playurl (DASH audio only), cookie-paste login,
 * favourites as the account's playlists.
 */
import { httpJson, randomKey, wbiSign } from './util.js'

const API = 'https://api.bilibili.com'
let keyCache = { img: '', sub: '', at: 0 }

function anonCookie() {
  return `buvid3=${randomKey(32).toUpperCase()}`
}

async function getKeys(cookie = '') {
  if (keyCache.img && Date.now() - keyCache.at < 30 * 60 * 1000) return keyCache
  const { json } = await httpJson(`${API}/x/web-interface/nav`, { headers: { cookie: cookie || anonCookie() } })
  const img = json?.data?.wbi_img?.img_url?.split('/').pop()?.replace(/\.\w+$/, '') ?? ''
  const sub = json?.data?.wbi_img?.sub_url?.split('/').pop()?.replace(/\.\w+$/, '') ?? ''
  if (img && sub) keyCache = { img, sub, at: Date.now() }
  return keyCache
}

async function signedGet(path, params, cookie = '') {
  const keys = await getKeys(cookie)
  const query = wbiSign(params, keys.img, keys.sub)
  const { json } = await httpJson(`${API}${path}?${query}`, { headers: { cookie: cookie || anonCookie(), referer: 'https://www.bilibili.com/' } })
  if (json?.code !== 0) throw new Error(json?.message || `bilibili ${path} 失败`)
  return json.data
}

function parseDuration(text) {
  const m = String(text ?? '').match(/^(?:(\d+):)?(\d+):(\d+)$/)
  if (!m) return 0
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

const stripEm = (title) => String(title ?? '').replace(/<[^>]+>/g, '')

export async function search(q, page = 1) {
  const data = await signedGet('/x/web-interface/wbi/search/type', { search_type: 'video', keyword: q, page })
  return {
    tracks: (data?.result ?? [])
      .filter((v) => v.type === 'video')
      .map((v) => ({
        id: v.bvid,
        title: stripEm(v.title),
        artist: v.author ?? '',
        cover: String(v.pic ?? '').replace(/^http:/, 'https:'),
        duration: parseDuration(v.duration),
        source: 'bilibili',
      })),
  }
}

export async function view(bvid) {
  const { json } = await httpJson(`${API}/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`)
  if (json?.code !== 0) throw new Error('视频不存在或已失效')
  const d = json.data
  return { cid: d.cid, duration: d.duration, title: d.title, artist: d.owner?.name ?? '', cover: d.pic }
}

/** Highest-bandwidth DASH audio stream; must be fetched with a bilibili referer (the proxy adds it). */
export async function songUrl(bvid, cookie = '') {
  const v = await view(bvid)
  // wbi/playurl 404s for anonymous callers since late 2025; the plain player endpoint still works.
  const { json } = await httpJson(
    `${API}/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${v.cid}&fnval=16&qn=64&platform=pc`,
    { headers: { cookie: cookie || anonCookie(), referer: 'https://www.bilibili.com/' } },
  )
  if (json?.code !== 0) return { error: json?.message || '获取音频流失败' }
  const audio = (json?.data?.dash?.audio ?? []).sort((a, b) => (b.bandwidth ?? 0) - (a.bandwidth ?? 0))[0]
  if (audio?.baseUrl) return { url: audio.baseUrl.replace(/^http:/, 'https:') }
  const durl = json?.data?.durl?.[0]?.url
  if (durl) return { url: durl.replace(/^http:/, 'https:') } // html5 fallback returns an mp4
  return { error: '该视频没有可播放的音频流' }
}

export async function loginByCookie(cookie) {
  const { json } = await httpJson(`${API}/x/web-interface/nav`, { headers: { cookie } })
  if (json?.code !== 0 || !json?.data?.isLogin) throw new Error('cookie 无效或未登录')
  return { uid: String(json.data.mid), nickname: json.data.uname ?? `用户${json.data.mid}` }
}

export async function userPlaylists(mid, cookie = '') {
  if (!cookie) throw new Error('未登录')
  const { json } = await httpJson(`${API}/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}`, { headers: { cookie } })
  if (json?.code !== 0) throw new Error(json?.message || '收藏夹读取失败')
  return {
    playlists: (json?.data?.list ?? []).map((f) => ({
      id: String(f.id),
      title: f.title,
      cover: '',
      count: f.media_count ?? 0,
    })),
  }
}

export async function playlistTracks(fid, cookie = '') {
  if (!cookie) throw new Error('未登录')
  const { json } = await httpJson(
    `${API}/x/v3/fav/resource/list?media_id=${encodeURIComponent(fid)}&pn=1&ps=20&keyword=&order=mtime&type=0&tid=0&platform=web`,
    { headers: { cookie } },
  )
  if (json?.code !== 0) throw new Error(json?.message || '收藏夹读取失败')
  return {
    tracks: (json?.data?.medias ?? []).map((m) => ({
      id: m.bvid,
      title: stripEm(m.title),
      artist: m.upper?.name ?? '',
      cover: String(m.cover ?? '').replace(/^http:/, 'https:'),
      duration: m.duration ?? 0,
      source: 'bilibili',
    })),
  }
}
