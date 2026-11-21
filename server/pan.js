/**
 * 免费聚合源（下歌吧，so.liumingye.cn / xiageba.liumingye.cn 的公开 JSON API，来自用户给的
 * 知乎文章里的 liumingye 工具站）。原 MyFreeMP3 直链 API（api.liumingye.cn）已下线（CF 522），
 * 该源只能搜索 + 拿歌词 + 给网盘链接，多数歌曲无直链。
 */
import { httpJson } from './util.js'

const SO = 'https://so.liumingye.cn'
const HEADERS = { accept: 'application/json', referer: 'https://xiageba.liumingye.cn/' }

/** Pure mapping so tests can pin the shape without network. */
export function mapPanTracks(json) {
  const list = Array.isArray(json?.data) ? json.data : []
  return {
    tracks: list.map((s) => ({
      id: `pan:${s.id}`,
      title: String(s.title ?? '').trim() || '未命名',
      artist: Array.isArray(s.artist) ? s.artist.join(',') : String(s.artist ?? ''),
      url: '',
      cover: String(s.cover ?? ''),
      duration: 0,
      source: 'pan',
    })),
  }
}

export async function search(q, page = 1) {
  const { status, json } = await httpJson(
    `${SO}/api/music/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=30`,
    { headers: HEADERS },
  )
  if (status !== 200) throw new Error('免费源搜索失败')
  return mapPanTracks(json)
}

/** Song detail: lyrics (plain text), playUrl (rarely filled), downloads (netdisk links). */
export async function detail(id) {
  const key = String(id ?? '').replace(/^pan:/, '')
  const { status, json } = await httpJson(`${SO}/api/music/${encodeURIComponent(key)}`, { headers: HEADERS })
  if (status !== 200 || !json) throw new Error('免费源详情获取失败')
  return json
}

export async function songUrl(id) {
  const d = await detail(id)
  if (d.playUrl && /^https?:\/\//.test(d.playUrl)) return { url: d.playUrl }
  throw new Error('该歌曲为网盘资源，无在线直链：可在搜索结果里复制网盘链接手动下载')
}

export async function lyric(id) {
  const d = await detail(id)
  return { lrc: String(d.lyrics ?? '') }
}

export async function links(id) {
  const d = await detail(id)
  return {
    links: (Array.isArray(d.downloads) ? d.downloads : [])
      .filter((x) => x && typeof x === 'object' && typeof x.url === 'string')
      .map((x) => ({ url: x.url, quality: String(x.quality ?? '') })),
  }
}
