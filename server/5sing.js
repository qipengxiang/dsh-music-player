/**
 * 5sing（中国原创音乐基地，5sing.kugou.com）公开接口：匿名 JSON 搜索 + 直链播放
 * （mobileapi SQ/HQ/LQ 三档回退）+ newget 歌词（dynamicWords 为 LRC 格式）。
 * 歌曲类型 yc=原创 / fc=翻唱 / bz=伴奏。
 */
import { httpJson } from './util.js'

const SEARCH_API = 'http://search.5sing.kugou.com/home/json'
const MOBILE_API = 'http://mobileapi.5sing.kugou.com'
const HEADERS = { referer: 'https://5sing.kugou.com/' }

const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '')

/** Pure mapping so tests can pin the shape without network. */
export function map5singTracks(json) {
  const list = Array.isArray(json?.list) ? json.list : []
  return {
    tracks: list.map((s) => ({
      id: `5sing:${s.songId}:${s.typeEname || 'yc'}`,
      title: stripTags(s.songName).trim() || '未命名',
      artist: String(s.singer ?? '').trim(),
      url: '',
      cover: '',
      duration: Math.round((Number(s.songSize) || 0) * 8 / 320000) || 0, // size @320kbps 近似
      source: '5sing',
    })),
  }
}

export async function search(q, page = 1) {
  const { status, json } = await httpJson(
    `${SEARCH_API}?keyword=${encodeURIComponent(q)}&sort=1&page=${page}&filter=0&type=0`,
    { headers: HEADERS },
  )
  if (status !== 200) throw new Error('5sing 搜索失败')
  return map5singTracks(json)
}

/** SQ → SQ backup → HQ → HQ backup → LQ 逐档回退。 */
export async function songUrl(id) {
  const m = /^5sing:(\d+):(yc|fc|bz)$/.exec(String(id ?? ''))
  if (!m) throw new Error('5sing 歌曲 ID 无效')
  const { status, json } = await httpJson(
    `${MOBILE_API}/song/getSongUrl?songid=${m[1]}&songtype=${m[2]}`,
    { headers: HEADERS },
  )
  const d = json?.data ?? {}
  const url = [d.squrl, d.squrl_backup, d.hqurl, d.hqurl_backup, d.lqurl, d.lqurl_backup]
    .find((u) => typeof u === 'string' && /^https?:\/\//.test(u))
  if (status !== 200 || json?.code !== 1000 || !url) throw new Error('5sing 未返回播放地址')
  return { url }
}

/** newget：歌词（dynamicWords，LRC）+ 上传者头像（当封面用）。 */
export async function detail(id) {
  const m = /^5sing:(\d+):(yc|fc|bz)$/.exec(String(id ?? ''))
  if (!m) throw new Error('5sing 歌曲 ID 无效')
  const { status, json } = await httpJson(
    `${MOBILE_API}/song/newget?songid=${m[1]}&songtype=${m[2]}`,
    { headers: HEADERS },
  )
  if (status !== 200 || !json?.data) throw new Error('5sing 详情获取失败')
  return {
    lrc: String(json.data.dynamicWords ?? '').replace(/\r\n/g, '\n'),
    cover: String(json.data.user?.I ?? '').replace(/^http:/, 'https:'),
    album: '',
  }
}

export async function lyric(id) {
  return { lrc: (await detail(id)).lrc }
}
