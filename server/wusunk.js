/**
 * 无损控（wusunk.com，WordPress 站，知乎文章推荐站之一）：搜索走 WordPress `?s=`，
 * 结果为文章（合集/专辑帖），详情页里是百度云/夸克等网盘链接——与「免费源」同类，
 * 只能搜索 + 复制网盘链接，无在线直链。
 */
import { httpBin } from './util.js'

const BASE = 'https://wusunk.com'
const HEADERS = { referer: 'https://wusunk.com/' }

/** Pure parsing so tests can pin the shape without network. */
export function mapWusunkPosts(html) {
  const re = /<li class="entry-title"><a href="(https:\/\/wusunk\.com\/\d+\.html)"[^>]*>([^<]+)<\/a><\/li>/g
  const tracks = []
  for (const m of html.matchAll(re)) {
    tracks.push({
      id: `wusunk:${m[1]}`,
      title: decodeHtmlEntities(m[2]).trim(),
      artist: '',
      url: '',
      cover: '',
      duration: 0,
      source: 'wusunk',
    })
    if (tracks.length >= 30) break
  }
  return { tracks }
}

export function extractNetdiskLinks(html) {
  const re = /https?:\/\/[a-z0-9.-]*(?:pan\.baidu|quark|aliyundrive|alipan|123pan|lanzou|ctfile|cloud\.189|weiyun)[^"'\s<)]*/gi
  const seen = new Set()
  const links = []
  for (const m of html.matchAll(re)) {
    const url = m[0].replace(/&amp;/g, '&')
    if (!seen.has(url)) { seen.add(url); links.push({ url, quality: '' }) }
  }
  return { links }
}

const decodeHtmlEntities = (s) => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')

export async function search(q, page = 1) {
  // shortcut: scraped HTML list has no page 2, ignore the param
  const { buf } = await httpBin(`${BASE}/?s=${encodeURIComponent(q)}`, { headers: HEADERS, maxBytes: 2 * 1024 * 1024 })
  return mapWusunkPosts(buf.toString('utf8'))
}

export async function links(id) {
  const url = String(id ?? '').replace(/^wusunk:/, '')
  if (!/^https:\/\/wusunk\.com\/\d+\.html$/.test(url)) throw new Error('无损控文章地址无效')
  const { buf } = await httpBin(url, { headers: HEADERS, maxBytes: 2 * 1024 * 1024 })
  return extractNetdiskLinks(buf.toString('utf8'))
}
