// Kugou: QR login + gateway search/playUrl/playlists (algorithm from MakcRe/KuGouMusicApi, MIT).
import { md5hex, randomKey, modPow, httpJson } from './util.js'

const GATEWAY = 'https://gateway.kugou.com'
const LOGIN_API = 'https://login-user.kugou.com'
const APPID = 1005
const CLIENTVER = 20489
const SRCAPPID = 2919
const ANDROID_SALT = 'OIlwieks28dk2k092lksi2UIkp'
const WEB_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'
const KEY_SALT = '57ae12eb6890223e355ccfcb74edf70d'
const KG_RSA_N = 0xc8006ed03842d2628209bd314984ca5ed6cfe06e30c95f9d4704d9c49791d7a935ba950ecb0bc8ebf5f5994f0bac927a7eb151b3c1de343303fa539c83136eccfd7d7e511e2dbce18eaa9f784c9b50d443e75865979e0a5e216e46c684066a8d6b998580bbaa22d73f5790286bb14742e83244e44db6d707ffe162c5c7002d45n
const KG_RSA_E = 0x10001n

// Device MID survives only this process; kugou accepts a fresh device per session.
const MID = (() => {
  let v = 0n
  for (const ch of md5hex(randomKey(24))) v = v * 16n + BigInt(parseInt(ch, 16))
  return v.toString()
})()

export function parseKgCookie(cookie = '') {
  const token = /(?:^|;\s*)token=([^;]+)/.exec(cookie)?.[1] ?? ''
  const userid = /(?:^|;\s*)userid=([^;]+)/.exec(cookie)?.[1] ?? '0'
  return { token, userid: Number(userid) || 0 }
}

function sigWeb(params) {
  const s = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('')
  return md5hex(WEB_SALT + s + WEB_SALT)
}
function sigAndroid(params, data = '') {
  const s = Object.keys(params).sort()
    .map((k) => `${k}=${typeof params[k] === 'object' ? JSON.stringify(params[k]) : params[k]}`).join('')
  return md5hex(ANDROID_SALT + s + data + ANDROID_SALT)
}

function kgHeaders(clienttime, xRouter) {
  const h = {
    dfid: '-', clienttime: String(clienttime), mid: MID,
    'kg-rc': '1', 'kg-thash': '5d816a0', 'kg-rec': '1', 'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
  }
  if (xRouter) h['x-router'] = xRouter
  return h
}

async function loginApi(path, params) {
  const clienttime = Math.floor(Date.now() / 1000)
  const p = { dfid: '-', mid: MID, uuid: '-', appid: APPID, clientver: CLIENTVER, clienttime, ...params }
  p.signature = sigWeb(p)
  const r = await httpJson(`${LOGIN_API}${path}?${new URLSearchParams(p)}`, { headers: kgHeaders(clienttime) })
  if (r.json?.status !== 1) throw new Error(`酷狗 ${path} 失败`)
  return r.json.data ?? {}
}

async function gateway(path, { method = 'GET', params = {}, data, xRouter, cookie = '', noSignature = false, keyFromHash = false } = {}) {
  const { token, userid } = parseKgCookie(cookie)
  const clienttime = Math.floor(Date.now() / 1000)
  const p = { dfid: '-', mid: MID, uuid: '-', appid: APPID, clientver: CLIENTVER, clienttime, ...params }
  if (token) p.token = token
  if (userid) p.userid = userid
  const body = data ? JSON.stringify(data) : ''
  if (keyFromHash && p.hash) p.key = md5hex(`${p.hash}${KEY_SALT}${p.appid}${p.mid}${userid || 0}`)
  if (!noSignature) p.signature = sigAndroid(p, body)
  const r = await httpJson(`${GATEWAY}${path}?${new URLSearchParams(p)}`, {
    method, headers: kgHeaders(clienttime, xRouter), body: body || undefined,
  })
  const j = r.json
  if (j?.status === 0 || (j?.error_code && j.error_code !== 0)) throw new Error(`酷狗 ${path} 失败（${j?.error_code ?? ''}）`)
  return j
}

function clean(s) { return String(s ?? '').replace(/<\/?em>/g, '') }

export async function search(q, page = 1) {
  const j = await gateway('/v2/search/song', {
    params: { keyword: q, page, pagesize: 30, platform: 'AndroidFilter', iscorrection: 1, privilegefilter: 0, area_code: 1, dopicfull: 1 },
    xRouter: 'complexsearch.kugou.com',
  })
  const lists = j?.data?.lists ?? []
  return {
    tracks: lists.map((s) => ({
      id: String(s.FileHash ?? s.fileHash ?? '').toLowerCase(),
      title: clean(s.SongName ?? s.songname),
      artist: clean(s.SingerName ?? s.singername),
      cover: String(s.Img ?? s.img ?? '').replace('{size}', '240') || undefined,
      duration: Number(s.Duration ?? s.duration ?? 0) || 0,
      vip: Number(s.PayType ?? s.payType ?? 0) === 3 || Number(s.Privilege ?? s.privilege ?? 0) > 0, // 实测: 免费行 pay/priv 全 0
      source: 'kugou',
    })).filter((t) => t.id),
  }
}

export async function songUrl(hash, cookie = '') {
  // shortcut: IsFreePart=1 returns a preview url without login; full url requires a logged-in cookie
  const j = await gateway('/v5/url', {
    params: {
      album_id: 0, area_code: 1, hash: String(hash).toLowerCase(), ssa_flag: 'is_fromtrack',
      version: 11430, page_id: 151369488, quality: 128, album_audio_id: 0, behavior: 'play',
      pid: 2, cmd: 26, pidversion: 3001, IsFreePart: 0, ppage_id: '463467626,350369493,788954147',
      cdnBackup: 1, module: '',
    },
    xRouter: 'trackercdn.kugou.com', keyFromHash: true, cookie,
  })
  let url = Array.isArray(j?.url) ? (j.url[0] ?? '') : (j?.url ?? '')
  if (!url) {
    const j2 = await gateway('/v5/url', {
      params: {
        album_id: 0, area_code: 1, hash: String(hash).toLowerCase(), ssa_flag: 'is_fromtrack',
        version: 11430, page_id: 151369488, quality: 128, album_audio_id: 0, behavior: 'play',
        pid: 2, cmd: 26, pidversion: 3001, IsFreePart: 1, ppage_id: '463467626,350369493,788954147',
        cdnBackup: 1, module: '',
      },
      xRouter: 'trackercdn.kugou.com', keyFromHash: true, cookie,
    })
    url = Array.isArray(j2?.url) ? (j2.url[0] ?? '') : (j2?.url ?? '')
  }
  if (!url) throw new Error('该歌曲需要酷狗 VIP 或暂无版权')
  return { url }
}

export async function qrStart() {
  const data = await loginApi('/v2/qrcode', {
    appid: 1001, type: 1, plat: 4,
    qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${APPID}&`,
    srcappid: SRCAPPID,
  })
  const key = data?.qrcode
  if (!key) throw new Error('二维码创建失败')
  return { key, qrurl: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${key}` }
}

// status: 0 expired, 1 waiting, 2 scanned, 4 confirmed (returns token+userid)
export async function qrPoll(key) {
  const data = await loginApi('/v2/get_userinfo_qrcode', { plat: 4, srcappid: SRCAPPID, qrcode: key })
  if (data?.status === 4) {
    const token = String(data.token ?? '')
    const userid = Number(data.userid) || 0
    if (!token || !userid) throw new Error('酷狗登录响应异常')
    const name = await nickname(token, userid).catch(() => '')
    return { code: 803, nickname: name || `酷狗用户${userid}`, cookie: `token=${token}; userid=${userid}`, uid: userid }
  }
  if (data?.status === 2) return { code: 802, nickname: String(data.nick_name ?? '') }
  if (data?.status === 0) return { code: 800 }
  return { code: 801 }
}

// /v3/get_my_info wants p = RSA(textbook modPow over zero-right-padded utf8 json), hex uppercase.
async function nickname(token, userid) {
  const clienttime = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({ token, clienttime }), 'utf8')
  const padded = Buffer.concat([payload, Buffer.alloc(128 - payload.length)])
  let m = 0n
  for (const b of padded) m = (m << 8n) | BigInt(b)
  const p = modPow(m, KG_RSA_E, KG_RSA_N).toString(16).padStart(256, '0').toUpperCase()
  const j = await gateway('/v3/get_my_info', {
    method: 'POST', params: { plat: 1 }, xRouter: 'usercenter.kugou.com',
    data: { visit_time: clienttime, usertype: 1, p, userid },
  })
  return String(j?.data?.nick_name ?? '')
}

export async function userPlaylists(cookie = '') {
  const { token, userid } = parseKgCookie(cookie)
  if (!token) throw new Error('未登录酷狗')
  const j = await gateway('/v7/get_all_list', {
    method: 'POST', params: { plat: 1, userid, token },
    data: { userid, token, total_ver: 979, type: 2, page: 1, pagesize: 30 },
    xRouter: 'cloudlist.service.kugou.com', cookie,
  })
  const lists = j?.data?.lists ?? []
  return { playlists: lists.map((l) => ({ id: String(l.global_collection_id ?? l.specialid ?? ''), title: clean(l.name), count: Number(l.total ?? 0) })) }
}

export async function playlistTracks(gcid, cookie = '') {
  const { token, userid } = parseKgCookie(cookie)
  const j = await gateway('/v3/get_list_info', {
    method: 'POST', data: { data: [{ global_collection_id: gcid }], userid, token },
    xRouter: 'pubsongs.kugou.com', cookie,
  })
  const node = Array.isArray(j?.data) ? j.data[0] : j?.data
  const musics = node?.musics ?? node?.lists?.[0]?.musics ?? []
  return {
    tracks: musics.map((m) => ({
      id: String(m.hash ?? '').toLowerCase(),
      title: clean(m.name ?? m.songname),
      artist: clean(m.singer ?? m.SingerName),
      duration: Number(m.timelength ?? m.duration ?? 0) || 0,
      vip: Number(m.PayType ?? m.payType ?? 0) === 3,
      source: 'kugou',
    })).filter((t) => t.id),
  }
}
