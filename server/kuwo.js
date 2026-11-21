/**
 * Kuwo: anonymous search + playback URL.
 * Web API auth (since ~2024): GET kuwo.cn sets an Hm_Iuvt_* session cookie; requests must carry
 * a `Secret` header derived from it via an LCG stream cipher + 8-hex nonce (scheme from
 * landv/kuwo-cli). Playback falls back: antiserver convert_url3 -> mobi.s car-player -> signed web playUrl.
 */
import { randomUUID } from 'node:crypto'
import { httpJson } from './util.js'

// all kuwo traffic goes direct: the host's global proxy dispatcher exit IP is soft-blocked by kuwo
const kwJson = (url, opts = {}) => httpJson(url, { ...opts, direct: true })

const SESSION_COOKIE = 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324'

let session = { cookie: '', at: 0 }

async function ensureSession() {
  if (session.cookie && Date.now() - session.at < 30 * 60 * 1000) return session.cookie
  const { setCookie } = await kwJson('https://www.kuwo.cn/', {})
  const value = (setCookie ?? []).find((c) => c.startsWith(SESSION_COOKIE + '='))?.split(';')[0] ?? ''
  if (!value) throw new Error('酷我会话获取失败')
  session = { cookie: value, at: Date.now() }
  return value
}

/**
 * Secret header (true web algorithm, ported verbatim from the kuwo.cn login bundle's axios
 * interceptor): XOR each cookie char with an LCG byte derived from the cookie NAME, hex-encode,
 * append 8-hex nonce. /api/www/* rejects anything else as "The request is illegal!".
 */
export function buildSecret(cookie, name = SESSION_COOKIE) {
  let nd = ''
  for (const ch of name) nd += ch.charCodeAt(0).toString()
  const o = Math.floor(nd.length / 5)
  const r = parseInt(nd[o] + nd[2 * o] + nd[3 * o] + nd[4 * o] + nd[5 * o])
  const c = Math.ceil(name.length / 2)
  const l = 2 ** 31 - 1
  const d = Math.round(1e9 * Math.random()) % 1e8
  let n = nd + String(d)
  while (n.length > 10) n = (parseInt(n.slice(0, 10)) + parseInt(n.slice(10))).toString()
  n = (r * Number(n) + c) % l
  let out = ''
  for (const ch of cookie) {
    const f = ch.charCodeAt(0) ^ Math.floor((n / l) * 255)
    out += f.toString(16).padStart(2, '0')
    n = (r * n + c) % l
  }
  return out + d.toString(16).padStart(8, '0')
}

/** The web interceptor always appends these query params; /api/www/* checks them. */
function withWebParams(url) {
  const u = new URL(url)
  u.searchParams.set('httpsStatus', '1')
  u.searchParams.set('reqId', randomUUID())
  u.searchParams.set('plat', 'web_www')
  u.searchParams.set('from', '')
  return u.toString()
}

const illegal = (j) => typeof j === 'object' && j !== null && String(j.message ?? '').includes('illegal')

const extractList = (j) => j?.data?.list ?? j?.abslist ?? []

// Secret is computed over the session cookie VALUE only, not the NAME=value pair.
const secretFor = (cookieStr) => {
  const pair = cookieStr.split('; ')[0]
  return buildSecret(pair.slice(pair.indexOf('=') + 1))
}

async function signedGet(url, referer, extraCookie = '') {
  const cookie = [await ensureSession(), extraCookie].filter(Boolean).join('; ')
  const target = withWebParams(url)
  const { status, json } = await kwJson(target, {
    headers: { Secret: secretFor(cookie), cookie, referer },
  })
  if (status === 401 || status === 403 || illegal(json)) {
    session = { cookie: '', at: 0 } // one retry with a fresh session
    const retryCookie = [await ensureSession(), extraCookie].filter(Boolean).join('; ')
    const retry = await kwJson(withWebParams(url), {
      headers: { Secret: secretFor(retryCookie), cookie: retryCookie, referer },
    })
    if (retry.status !== 200 || illegal(retry.json)) throw new Error('酷我接口拒绝访问')
    return retry.json
  }
  if (status !== 200) throw new Error(`酷我接口 HTTP ${status}`)
  return json
}

export async function search(q, page = 1) {
  const params = new URLSearchParams({
    vipver: '1', client: 'kt', ft: 'music', cluster: '0', strategy: '2012',
    encoding: 'utf8', rformat: 'json', mobi: '1', issubtitle: '1',
    show_copyright_off: '1', pn: String(page - 1), rn: '30', all: q, reqId: randomUUID(),
  })
  const target = `https://www.kuwo.cn/search/searchMusicBykeyWord?${params}`
  const referer = `https://www.kuwo.cn/search/list?key=${encodeURIComponent(q)}`
  // signedGet mints a session on demand and goes direct (kuwo blocks the host proxy's exit
  // IP); anonymous is only a fallback for when signing itself fails.
  let list = []
  try { list = extractList(await signedGet(target, referer)) } catch { /* fall through */ }
  if (!list.length) {
    const { json } = await kwJson(withWebParams(target), { headers: { referer } })
    list = extractList(json)
  }
  return {
    tracks: list.map((s) => {
      const id = String(s.MUSICRID ?? s.rid ?? s.id ?? '').replace(/^MUSIC_/i, '').trim()
      return {
        id,
        title: String(s.name ?? s.SONGNAME ?? '').trim(),
        artist: String(s.artist ?? s.ARTIST ?? '').trim(),
        cover: '',
        duration: Math.round(Number(s.duration ?? 0) || 0),
        vip: s.payInfo?.feeType?.vip === '1' || s.payInfo?.listen_fragment === '1',
        source: 'kuwo',
      }
    }).filter((t) => t.id),
  }
}

export async function songUrl(id) {
  // 1. antiserver: no auth, text/json url
  try {
    const { json } = await kwJson(
      `http://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=MUSIC_${encodeURIComponent(id)}&format=mp3&response=json`,
    )
    let url = json?.url ?? ''
    if (!url && typeof json?.raw === 'string') url = json.raw.match(/https?:\/\/\S+/)?.[0] ?? ''
    if (url) return { url: url.replace(/^http:/, 'https:') }
  } catch { /* fall through */ }
  // 2. mobi.s car-player spoof: full-quality, no signature needed
  try {
    const user = `C_APK_guanwang_${Date.now()}${Math.floor(Math.random() * 1000000)}`
    const params = new URLSearchParams({
      f: 'web', source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC',
      type: 'convert_url_with_sign', br: '128kmp3', rid: String(id), user,
    })
    const { json } = await kwJson(`https://mobi.kuwo.cn/mobi.s?${params}`, { headers: { 'user-agent': 'okhttp/3.10.0' } })
    const url = json?.data?.url ?? ''
    if (url) return { url: String(url) }
  } catch { /* fall through */ }
  // 3. signed web playUrl
  const params = new URLSearchParams({ mid: String(id), type: 'music', httpsStatus: '1', reqId: randomUUID() })
  const json = await signedGet(`https://www.kuwo.cn/api/v1/www/music/playUrl?${params}`, 'https://www.kuwo.cn/')
  const url = json?.data?.url ?? ''
  if (!url) return { error: '该歌曲暂时无法获取播放地址' }
  return { url: String(url) }
}

/**
 * Playlist detail (anonymous-OK with the true Secret): pid = numeric playlist id.
 */
export async function playlistTracks(pid, cookie = '') {
  const pn = 1, rn = 100
  const json = await signedGet(
    `https://www.kuwo.cn/api/www/playlist/playListInfo?pid=${encodeURIComponent(pid)}&pn=${pn}&rn=${rn}`,
    'https://www.kuwo.cn/playlist_detail/',
    cookie,
  )
  const list = json?.data?.musicList ?? json?.data?.list ?? []
  return {
    tracks: list.map((s) => ({
      id: String(s.rid ?? s.musicrid ?? '').replace(/^MUSIC_/i, '').trim(),
      title: String(s.name ?? s.songName ?? '').trim(),
      artist: String(s.artist ?? '').trim(),
      cover: String(s.pic ?? s.albumpic ?? '').trim(),
      duration: Math.round(Number(s.duration ?? 0) > 10000 ? Number(s.duration) / 1000 : Number(s.duration ?? 0)) || 0,
      vip: s.payInfo?.feeType?.vip === '1' || s.payInfo?.listen_fragment === '1',
      source: 'kuwo',
    })).filter((t) => t.id),
  }
}

// ---------- SMS login (flow ported from the kuwo.cn login bundle) ----------

const KW_ERR = {
  '-102': '图形验证码错误，请重试',
  1108: '短信验证码不正确，请重试',
  1107: '短信验证码已过期，请重新获取',
  1100: '请输入符合中国大陆的手机号',
  1157: '操作过于频繁，请稍后再试',
}

/** Step 1: fetch the image captcha. Returns { token, img (dataURL) }. */
export async function captchaGet() {
  const { json } = await kwJson('https://www.kuwo.cn/api/common/captcha/getcode', {
    headers: { referer: 'https://www.kuwo.cn/' },
  })
  if (json?.code !== 200 || !json.data?.token) throw new Error('获取图形验证码失败')
  return { token: String(json.data.token), img: String(json.data.img ?? '') }
}

/** Step 2: send the SMS code. Needs the captcha answer for this token. */
export async function smsSend(mobile, verifyCode, token) {
  const body = new URLSearchParams({ verifyCode, verifyCodeToken: token, mobile, userIp: '' })
  const { json } = await kwJson('https://www.kuwo.cn/api/sms/mobileLoginCode', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://www.kuwo.cn/' },
  })
  if (json?.code !== 200) throw new Error(KW_ERR[json?.code] ?? `发送短信失败（${json?.code}）`)
  return { tm: String(json.data?.tm ?? '') }
}

/** Step 3: login with the SMS code. Returns the account name + cookie string. */
export async function loginByMobile(mobile, smsCode, tm) {
  const body = new URLSearchParams({ mobile, verifyCode: '', smsCode, tm })
  const { json } = await kwJson('https://wapi.kuwo.cn/api/www/login/loginByMobile', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://www.kuwo.cn/' },
  })
  if (json?.code !== 200 || !json.data?.cookies) throw new Error(KW_ERR[json?.code] ?? `登录失败（${json?.code}）`)
  const jar = json.data.cookies
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
  const name = String(jar.username ?? jar.uname ?? jar.nickname ?? '').trim() || `${mobile.slice(0, 3)}****${mobile.slice(-4)}`
  const uid = String(jar.userid ?? jar.uid ?? '').trim()
  return { name, uid, cookie }
}

/** Login-state probe: readable only with a valid cookie. */
export async function account(cookie) {
  const json = await signedGet('https://mobi.kuwo.cn/mobi.s?f=kuwo&q=CM103&couponId=1', 'https://www.kuwo.cn/', cookie)
  if (!json?.uid) throw new Error('酷我登录态无效')
  return { uid: String(json.uid), name: String(json.nickname ?? json.uname ?? json.uid) }
}

/**
 * Logged-in user playlists. Endpoint unknown to the public web bundle (it only renders after
 * login), so probe the known families and return the first that yields a list.
 * shortcut: endpoint list is empirical, extend when a real login capture shows the real path
 */
export async function userPlaylists(uid = '', cookie = '') {
  const targets = [
    ['www-userplaylist', `https://www.kuwo.cn/api/www/playlist/userplaylist?uid=${encodeURIComponent(uid)}&pn=1&rn=100`],
    ['www-my', 'https://www.kuwo.cn/api/www/playlist/myPlayList?pn=1&rn=100'],
    ['www-user', 'https://www.kuwo.cn/api/www/user/playlists?pn=1&rn=100'],
  ]
  for (const [, url] of targets) {
    let json
    try { json = await signedGet(url, 'https://www.kuwo.cn/mymusic/', cookie) } catch { continue }
    const list = json?.data?.data ?? json?.data?.list ?? json?.data ?? json?.musicList ?? json?.playlistList ?? (Array.isArray(json) ? json : null)
    if (!Array.isArray(list) || list.length === 0) continue
    return {
      playlists: list.map((p) => ({
        id: String(p.id ?? p.pid ?? p.playlistid ?? ''),
        title: String(p.name ?? p.title ?? p.playlistname ?? '未命名歌单'),
        count: Number(p.num ?? p.total ?? p.musicNum ?? 0) || 0,
      })).filter((p) => p.id),
    }
  }
  throw new Error('未能获取酷我账号歌单（端点待登录后确认）')
}
