/**
 * LX-Music-style user source script runtime (自定义音源): the node:vm half of the feature.
 * Mirrors lx-music-desktop's contract — globalThis.lx API (EVENT_NAMES/on/send/request/utils)
 * and the inited handshake announcing {sources:{kw/kg/tx/wy:{actions,qualitys}}}.
 *
 * Loaded ONLY inside a Worker thread (usersource-worker.js). node:vm is not a boundary: a script
 * reaches this realm's `process` through any function it is handed, so nothing from the DSH main
 * thread may ever be passed in here — the supervisor in usersources.js talks in plain messages.
 */
import { createHash, createCipheriv, publicEncrypt, constants as cryptoConstants, randomBytes as nodeRandomBytes } from 'node:crypto'
import { inflate, deflate } from 'node:zlib'
import { runInContext, createContext } from 'node:vm'

const EVENT_NAMES = { inited: 'inited', request: 'request', updateAlert: 'updateAlert' }
/** LX platform keys that map onto a builtin of ours (mg/local have no counterpart to hook). */
const LX_KEYS = ['kw', 'kg', 'tx', 'wy']

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
  // script callbacks may throw sync OR return rejected promises; both must stay contained
  const cb = (err, resp, body) => {
    if (typeof callback !== 'function') return
    try { Promise.resolve(callback(err, resp, body)).catch(() => {}) } catch {}
  }
  // stamp delivered errors so a script letting them escape unhandled stays identifiable
  const tag = (err) => { try { if (err && typeof err === 'object') Object.defineProperty(err, '$dshmpScript', { value: true }) } catch {} return err }
  const opts = options && typeof options === 'object' ? options : {}
  const headers = { ...(opts.headers ?? {}) }
  let { body } = opts
  if (opts.form && typeof opts.form === 'object') {
    headers['content-type'] ??= 'application/x-www-form-urlencoded'
    body = new URLSearchParams(opts.form).toString()
  }
  const timer = setTimeout(() => { try { ctrl.abort() } catch {} }, Math.min(Number(opts.timeout) || 15000, 30000))
  fetch(String(url), {
    method: String(opts.method || 'GET').toUpperCase(),
    headers,
    body: body === undefined ? undefined : String(body),
    signal: ctrl.signal,
  }).then(async (resp) => {
    const text = Buffer.from(await resp.arrayBuffer()).toString('utf-8')
    cb(null, { statusCode: resp.status, headers: Object.fromEntries(resp.headers), body: text }, text)
  }).catch((err) => {
    cb(tag(err), null, null)
  }).finally(() => clearTimeout(timer))
  return () => { try { ctrl.abort() } catch {} }
}

/**
 * Scripts share our event loop; a kill-switched or buggy third-party script throws from a
 * microtask the vm cannot contain, and an unhandled rejection crashes modern Node. The guard
 * is installed permanently at module load: promise rejections only reach the fatal
 * triggerUncaughtException path when NO unhandledRejection listener exists, so a permanent
 * listener routes everything through us. We swallow rejections that originate from user
 * scripts — identified by `usersource:` frames (also inside AggregateError.errors[]) or by
 * the tag we stamp on errors delivered through lx.request — and rethrow anything else,
 * preserving default semantics for host code.
 */
function onStrayRejection(err) {
  if (err?.$dshmpScript) return
  const s = String(err?.stack ?? err) + (Array.isArray(err?.errors) ? err.errors.map((e) => `${e?.stack ?? e}${e?.$dshmpScript ? ' $dshmpScript' : ''}`).join('\n') : '')
  if (s.includes('usersource:')) return
  throw err
}
process.on('unhandledRejection', onStrayRejection)

/** Sandbox timers: wrapped so callback throws stay contained, tracked so replaced runtimes don't leak. */
function makeTimers() {
  const handles = new Set()
  return {
    setTimeout: (fn, ms, ...args) => {
      if (typeof fn !== 'function') return 0
      const t = setTimeout(() => { handles.delete(t); try { fn(...args)?.catch?.(() => {}) } catch {} }, Number(ms) || 0)
      handles.add(t)
      return t
    },
    clearTimeout: (t) => { clearTimeout(t); handles.delete(t) },
    dispose: () => { for (const t of handles) clearTimeout(t); handles.clear() },
  }
}

/**
 * Run the script and resolve once it sent `inited` (or threw). The supervisor owns the time
 * limit: a script that never handshakes is simply terminated.
 */
export async function boot(entry) {
  let resolveInited
  const inited = new Promise((r) => { resolveInited = r })
  const timers = makeTimers()
  const lx = {
    version: '1.0.0',
    env: 'desktop',
    currentScriptInfo: { ...entry.meta, rawScript: entry.script },
    EVENT_NAMES,
    on: (event, handler) => { if (event === EVENT_NAMES.request) lx.$handler = handler },
    send: (event, data) => { if (event === EVENT_NAMES.inited) resolveInited(data ?? {}) },
    request: lxRequest,
    utils: lxUtils(),
  }
  try {
    const ctx = createContext({ console, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, lx })
    runInContext(entry.script, ctx, { timeout: 5000, filename: `usersource:${entry.id}` })
    const info = await inited
    if (!info || typeof info !== 'object') throw new Error('inited 握手数据无效')
    const raw = info.sources && typeof info.sources === 'object' ? info.sources : {}
    // copy out plain data only: `sources` is script-made and may carry getters or odd shapes
    const sources = {}
    for (const k of LX_KEYS) {
      const def = raw[k]
      if (!def || !Array.isArray(def.actions) || !def.actions.includes('musicUrl')) continue
      sources[k] = Array.isArray(def.qualitys) ? def.qualitys.filter((q) => typeof q === 'string') : []
    }
    return { sources, handler: (...a) => lx.$handler(...a), dispose: timers.dispose, error: '' }
  } catch (err) {
    timers.dispose()
    return { sources: {}, handler: null, dispose: null, error: String(err?.message ?? err).slice(0, 300) }
  }
}

/** Run the script's musicUrl handler; only an http(s) string counts, anything else is a miss. */
export async function musicUrl(runtime, { lxKey, quality, musicInfo }) {
  if (typeof runtime?.handler !== 'function') return null
  try {
    const url = await runtime.handler({ source: lxKey, action: 'musicUrl', info: { type: quality, musicInfo: { ...musicInfo, source: lxKey } } })
    return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null
  } catch {
    return null
  }
}
