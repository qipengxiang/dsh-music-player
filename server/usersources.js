/**
 * LX-Music-style user source scripts (自定义音源): user-supplied JS that hooks play-URL
 * resolution for a platform. Mirrors lx-music-desktop's contract — header comments
 * (@name/@description/@version/@author/@homepage), globalThis.lx API (EVENT_NAMES/on/send/
 * request/utils), and the inited handshake announcing {sources:{kw/kg/tx/wy:{actions,qualitys}}}.
 * Scripts run in a node:vm sandbox on the server half; failures fall back to built-in sources.
 */
import { createHash, createCipheriv, publicEncrypt, constants as cryptoConstants, randomBytes as nodeRandomBytes } from 'node:crypto'
import { inflate, deflate } from 'node:zlib'
import { runInContext, createContext } from 'node:vm'

/** LX platform key → our source id (mg/local have no builtin counterpart to hook). */
const LX_KEY_TO_SOURCE = { kw: 'kuwo', kg: 'kugou', tx: 'qq', wy: 'netease' }
const SOURCE_TO_LX_KEY = Object.fromEntries(Object.entries(LX_KEY_TO_SOURCE).map(([k, v]) => [v, k]))

/** Parse the mandatory header block; returns meta with sane fallbacks. */
export function parseScriptHeader(script) {
  const head = String(script ?? '').slice(0, 4000)
  const grab = (tag) => (head.match(new RegExp(`@${tag}\\s+(.+)`, '')) ?? [])[1]?.trim() ?? ''
  return {
    name: grab('name').slice(0, 60) || '未命名源',
    description: grab('description').slice(0, 120),
    version: grab('version').slice(0, 40),
    author: grab('author').slice(0, 60),
    homepage: grab('homepage').slice(0, 300),
  }
}

const EVENT_NAMES = { inited: 'inited', request: 'request', updateAlert: 'updateAlert' }

function lxUtils() {
  return {
    buffer: {
      from: Buffer.from,
      bufToString: (buf, format) => Buffer.from(buf).toString(format),
    },
    crypto: {
      aesEncrypt: (buffer, mode, key, iv) => createCipheriv(mode, key, iv).update(buffer),
      md5: (str) => createHash('md5').update(String(str)).digest('hex'),
      randomBytes: (size) => nodeRandomBytes(Number(size) || 8).toString('hex'),
      rsaEncrypt: (buffer, key) => publicEncrypt({ key, padding: cryptoConstants.RSA_PKCS1_PADDING }, buffer),
    },
    zlib: {
      inflate: (buf) => inflate(Buffer.from(buf)),
      deflate: (buf) => deflate(Buffer.from(buf)),
    },
  }
}

/** lx.request: callback-style CORS-free HTTP; returns a cancel fn. shortcut: no formData/binary body support. */
function lxRequest(url, options, callback) {
  const ctrl = new AbortController()
  const cb = typeof callback === 'function' ? callback : () => {}
  const opts = options && typeof options === 'object' ? options : {}
  const headers = { ...(opts.headers ?? {}) }
  let { body } = opts
  if (opts.form && typeof opts.form === 'object') {
    headers['content-type'] ??= 'application/x-www-form-urlencoded'
    body = new URLSearchParams(opts.form).toString()
  }
  const timer = setTimeout(() => ctrl.abort(), Math.min(Number(opts.timeout) || 15000, 30000))
  fetch(String(url), {
    method: String(opts.method || 'GET').toUpperCase(),
    headers,
    body: body === undefined ? undefined : String(body),
    signal: ctrl.signal,
  }).then(async (resp) => {
    const text = Buffer.from(await resp.arrayBuffer()).toString('utf-8')
    cb(null, { statusCode: resp.status, headers: Object.fromEntries(resp.headers), body: text }, text)
  }).catch((err) => cb(err, null, null)).finally(() => clearTimeout(timer))
  return () => ctrl.abort()
}

/** Run one script in a sandbox; resolves {sources} from the inited handshake or {error}. */
async function bootScript(entry) {
  const meta = parseScriptHeader(entry.script)
  let resolveInited
  const inited = new Promise((r) => { resolveInited = r })
  const lx = {
    version: '1.0.0',
    env: 'desktop',
    currentScriptInfo: { ...meta, rawScript: entry.script },
    EVENT_NAMES,
    on: (event, handler) => { if (event === EVENT_NAMES.request) lx.$handler = handler },
    send: (event, data) => { if (event === EVENT_NAMES.inited) resolveInited(data ?? {}) },
    request: lxRequest,
    utils: lxUtils(),
  }
  const timeout = setTimeout(() => resolveInited(null), 5000)
  try {
    const ctx = createContext({ console, setTimeout, clearTimeout, lx })
    runInContext(entry.script, ctx, { timeout: 5000, filename: `usersource:${entry.id}` })
    const info = await inited
    if (!info || typeof info !== 'object') throw new Error('脚本未在 5 秒内完成 inited 握手')
    const sources = info.sources && typeof info.sources === 'object' ? info.sources : {}
    const platforms = Object.entries(LX_KEY_TO_SOURCE)
      .filter(([k]) => Array.isArray(sources[k]?.actions) && sources[k].actions.includes('musicUrl'))
      .map(([, v]) => v)
    return { meta, platforms, sources, handler: (...a) => lx.$handler(...a) }
  } catch (err) {
    return { meta, platforms: [], sources: {}, handler: null, error: String(err?.message ?? err).slice(0, 300) }
  } finally {
    clearTimeout(timeout)
  }
}

// id → { fingerprint, runtime }; rebuilt lazily whenever state.musicSources changes shape.
const loaded = new Map()

async function sync(state) {
  const entries = Array.isArray(state?.musicSources) ? state.musicSources.filter((e) => e.enabled !== false) : []
  const fp = entries.map((e) => `${e.id}:${e.script.length}`).join('|')
  const current = [...loaded.values()].map((r) => r.fingerprint).join('|')
  if (fp === current) return
  loaded.clear()
  for (const e of entries) loaded.set(e.id, { fingerprint: `${e.id}:${e.script.length}`, runtime: await bootScript(e) })
}

/** First matching script URL for our source id, or null so the caller falls back to builtin. */
export async function resolveScripted(state, source, musicInfo) {
  const lxKey = SOURCE_TO_LX_KEY[source]
  if (!lxKey) return null
  await sync(state)
  for (const { runtime } of loaded.values()) {
    const def = runtime.sources?.[lxKey]
    if (!Array.isArray(def?.actions) || !def.actions.includes('musicUrl') || typeof runtime.handler !== 'function') continue
    const qualitys = Array.isArray(def.qualitys) ? def.qualitys.filter((q) => typeof q === 'string') : []
    const type = qualitys.includes('320k') ? '320k' : qualitys[0] ?? '128k'
    const url = await Promise.race([
      runtime.handler({ source: lxKey, action: 'musicUrl', info: { type, musicInfo } }),
      new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
    ]).catch(() => null)
    if (typeof url === 'string' && /^https?:\/\//.test(url)) return url
  }
  return null
}

/** Boot (or re-boot) every enabled script and return their {platforms, error} for storage. */
export async function describeAll(state) {
  const out = []
  for (const e of Array.isArray(state?.musicSources) ? state.musicSources : []) {
    if (e.enabled === false) { out.push({ id: e.id, platforms: [], error: '' }); continue }
    const runtime = await bootScript(e)
    out.push({ id: e.id, platforms: runtime.platforms, error: runtime.error ?? '' })
  }
  return out
}
