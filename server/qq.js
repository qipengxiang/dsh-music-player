/**
 * QQ Music without an account: anonymous search, trial-grade vkey via musicu.fcg, GBK lyrics.
 * Full-quality playback needs a real login, which is not wired in this version.
 */
import { httpJson } from './util.js'

const REFERER = 'https://y.qq.com/'

/** Playlist search via musicu desktop search (search_type 3); tracks playable via CgiGetDiss. */
export async function searchPlaylists(q) {
  const { json } = await httpJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: { referer: REFERER, 'content-type': 'application/json' },
    body: JSON.stringify({
      comm: { ct: 19, cv: 1859, uin: 0 },
      req: { module: 'music.search.SearchCgiService', method: 'DoSearchForQQMusicDesktop', param: { query: q, num_per_page: 20, page_num: 1, search_type: 3 } },
    }),
  })
  const list = json?.req?.data?.body?.songlist?.list ?? json?.req?.data?.body?.playlist?.list ?? []
  const playlists = list.map((p) => ({
    id: String(p.dissid ?? p.tid ?? ''),
    title: String(p.dissname ?? p.title ?? ''),
    count: Number(p.song_count ?? p.song_cnt ?? p.total_song_num ?? 0),
  })).filter((p) => p.id)
  return { playlists }
}

export async function search(q, page = 1) {
  const { json } = await httpJson(
    `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(q)}&format=json&n=30&cr=1&p=${page}`,
    { headers: { referer: REFERER } },
  )
  const list = json?.data?.song?.list ?? []
  return {
    tracks: list.map((s) => ({
      id: s.songmid,
      title: s.songname ?? '',
      artist: (s.singer ?? []).map((x) => x.name).join('/'),
      cover: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg` : '',
      duration: Number(s.interval ?? 0),
      vip: Number(s.pay?.payplay ?? 0) === 1,
      source: 'qq',
    })).filter((t) => t.id),
  }
}

export async function songUrl(id, cookie = '') {
  const uin = (cookie.match(/uin=(\d+)/) ?? [])[1] ?? '0'
  const { json } = await httpJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: { referer: REFERER, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({
      comm: { ct: 19, cv: 1859, uin: Number(uin) },
      req_1: {
        module: 'vkey.GetVkeyServerBase64',
        method: 'CgiGetVkey',
        param: { guid: String(10000 + Math.floor(Math.random() * 89999)), songmid: [id], songtype: [0], uin, format: 'json', cid: '205361747' },
      },
    }),
  })
  const info = json?.req_1?.data?.midurlinfo?.[0]
  const sip = json?.req_1?.data?.sip?.[0] ?? 'https://dl.stream.qqmusic.qq.com/'
  if (!info?.purl) return { error: '该歌曲需要 QQ 音乐 VIP，暂不支持' }
  return { url: sip + info.purl }
}

export async function lyric(id) {
  const { json } = await httpJson(
    `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(id)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`,
    { headers: { referer: REFERER } },
  )
  const b64 = json?.lyric ?? ''
  if (!b64) return { lrc: '' }
  try {
    return { lrc: new TextDecoder('gbk').decode(Buffer.from(b64, 'base64')) }
  } catch {
    return { lrc: '' }
  }
}

// ---------- QR login (ptlogin2 → graph oauth → musicu QQLogin) ----------
// Node fetch filters headers on redirect:'manual', so this chain uses raw https requests.
import { request as httpsRequest } from 'node:https'

const PTLOGIN_APP_ID = '716027609'
const CONNECT_CLIENT_ID = '100497308'
const LOGIN_JUMP = 'https://graph.qq.com/oauth2.0/login_jump'

function rawReq(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpsRequest({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => { if (chunks.reduce((n, b) => n + b.length, 0) < 1024 * 1024) chunks.push(c) })
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        location: res.headers.location ?? '',
        setCookies: res.headers['set-cookie'] ?? [],
        buf: Buffer.concat(chunks),
      }))
    })
    req.on('error', reject)
    req.setTimeout(20000, () => req.destroy(new Error('请求超时')))
    if (body) req.write(body)
    req.end()
  })
}

function hash33(value, initial) {
  let result = initial
  for (const ch of String(value ?? '')) result += (result << 5) + ch.charCodeAt(0)
  return result & 0x7fffffff
}

const cookieValue = (setCookies, name) => {
  for (const line of setCookies) {
    const m = String(line).match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
    if (m) return m[1]
  }
  return ''
}

export async function qrStart() {
  const r = await rawReq(
    `https://xui.ptlogin2.qq.com/ssl/ptqrshow?appid=${PTLOGIN_APP_ID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=383&pt_3rd_aid=${CONNECT_CLIENT_ID}&u1=${encodeURIComponent(LOGIN_JUMP)}`,
    { headers: { referer: 'https://xui.ptlogin2.qq.com/' } },
  )
  const qrsig = cookieValue(r.setCookies, 'qrsig')
  if (!qrsig) throw new Error('二维码创建失败')
  return { key: qrsig, qrimg: `data:image/png;base64,${r.buf.toString('base64')}` }
}

export async function qrPoll(qrsig) {
  const r = await rawReq(
    `https://xui.ptlogin2.qq.com/ssl/ptqrlogin?u1=${encodeURIComponent(LOGIN_JUMP)}&from_ui=1&aid=${PTLOGIN_APP_ID}&daid=383&pt_3rd_aid=${CONNECT_CLIENT_ID}&ptqrtoken=${hash33(qrsig, 0)}`,
    { headers: { cookie: `qrsig=${qrsig}`, referer: 'https://xui.ptlogin2.qq.com/' } },
  )
  const text = r.buf.toString('utf8')
  const m = text.match(/ptuiCB\('(\d+)','[^']*','([^']*)'/)
  if (!m) return { code: 801 }
  if (m[1] === '66') return { code: 801 }
  if (m[1] === '67') return { code: 802 }
  if (m[1] === '65') return { code: 800 }
  if (m[1] !== '0') return { code: 801 }
  // success: run the oauth exchange chain
  const sig = await rawReq(m[2], { headers: { cookie: `qrsig=${qrsig}` } })
  const pSkey = cookieValue(sig.setCookies, 'p_skey')
  const graphCookie = ['p_uin', 'p_skey', 'pt4_token', 'pt_oauth_token']
    .map((n) => `${n}=${cookieValue(sig.setCookies, n)}`).filter((s) => !s.endsWith('=')).join('; ')
  if (!graphCookie.includes('p_skey')) throw new Error('登录交换失败（缺少 p_skey）')
  const jump = new URL(sig.location || LOGIN_JUMP)
  await rawReq(jump.href, { headers: { cookie: graphCookie } })
  const state = Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
  const form = new URLSearchParams({
    response_type: 'code',
    client_id: CONNECT_CLIENT_ID,
    redirect_uri: 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F',
    scope: 'get_user_info,get_app_friends',
    state,
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '1',
    openapi: '1010_1030',
    g_tk: String(hash33(pSkey, 5381)),
    auth_time: String(Date.now()),
    ui: crypto.randomUUID(),
  }).toString()
  const auth = await rawReq('https://graph.qq.com/oauth2.0/authorize', {
    method: 'POST',
    headers: { cookie: graphCookie, 'content-type': 'application/x-www-form-urlencoded', referer: 'https://graph.qq.com/' },
    body: form,
  })
  const code = new URL(auth.location).searchParams.get('code')
  if (!code) throw new Error('登录交换失败（没有拿到 code）')
  const { json } = await httpJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: { referer: REFERER, 'content-type': 'application/json' },
    body: JSON.stringify({
      comm: { g_tk: 5381, platform: 'yqq', ct: 19, cv: 1859, uin: 0 },
      req: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { code } },
    }),
  })
  const data = json?.req?.data
  const musicid = String(data?.musicid ?? '')
  const musickey = String(data?.musickey ?? '')
  if (!musicid || !musickey) throw new Error('QQ 登录失败（musicu 未返回凭据）')
  const cookie = `uin=${musicid}; qqmusic_key=${musickey}; qm_keyst=${musickey}; tmeLoginType=2`
  const nickname = await userInfo(cookie).then((u) => u.nickname).catch(() => '')
  return { code: 803, nickname: nickname || musicid, cookie, uid: musicid }
}

async function musicu(payload, cookie = '') {
  const uin = (cookie.match(/uin=(\d+)/) ?? [])[1] ?? '0'
  const { json } = await httpJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: { referer: REFERER, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ comm: { ct: 19, cv: 1859, uin: Number(uin), format: 'json', tmeAppID: 'qqmusic' }, ...payload }),
  })
  return json
}

export async function userInfo(cookie) {
  const json = await musicu({ req: { module: 'music.UserInfo.userInfoServer', method: 'GetLoginUserInfo', param: {} } }, cookie)
  const d = json?.req?.data
  return { nickname: String(d?.nick ?? d?.nickname ?? ''), uid: String(d?.musicid ?? d?.uin ?? '') }
}

export async function userPlaylists(cookie) {
  const uin = (cookie.match(/uin=(\d+)/) ?? [])[1] ?? ''
  const json = await musicu({ req: { module: 'music.musicasset.PlaylistBaseRead', method: 'GetPlaylistByUin', param: { uin } } }, cookie)
  const d = json?.req?.data
  const list = d?.v_playlist ?? d?.playlistList ?? d?.playlists ?? d?.list ?? []
  const playlists = list.map((p) => ({
    id: String(p.tid ?? p.dissid ?? p.dirid ?? ''),
    title: String(p.dname ?? p.dissname ?? p.name ?? p.title ?? ''),
    count: Number(p.song_cnt ?? p.songCnt ?? p.total ?? 0),
  })).filter((p) => p.id)
  if (!playlists.length) throw new Error('没有获取到歌单')
  return { playlists }
}

export async function playlistTracks(id, cookie = '') {
  const json = await musicu({
    req: {
      module: 'music.srfDissInfo.DissInfo',
      method: 'CgiGetDiss',
      param: { disstid: Number(id), dirid: 0, tag: true, song_begin: 0, song_num: 200, userinfo: true, orderlist: true, onlysonglist: false },
    },
  }, cookie)
  const list = json?.req?.data?.songlist ?? json?.req?.data?.list ?? []
  return {
    tracks: list.map((s) => ({
      id: String(s.songmid ?? s.mid ?? ''),
      title: String(s.songname ?? s.name ?? ''),
      artist: (s.singer ?? []).map((x) => x.name).join('/'),
      cover: (s.albummid ?? s.album?.mid) ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid ?? s.album?.mid}.jpg` : '',
      duration: Number(s.interval ?? 0),
      vip: Number(s.pay?.payplay ?? 0) === 1,
      source: 'qq',
    })).filter((t) => t.id),
  }
}
