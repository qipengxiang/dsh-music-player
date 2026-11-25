/**
 * LX-Music-style user source scripts (自定义音源): user-supplied JS that hooks play-URL
 * resolution for a platform. Mirrors lx-music-desktop's contract — header comments
 * (@name/@description/@version/@author/@homepage), globalThis.lx API (EVENT_NAMES/on/send/
 * request/utils), and the inited handshake announcing {sources:{kw/kg/tx/wy:{actions,qualitys}}}.
 *
 * This is the supervisor half. node:vm alone is no boundary — a script reaches this process
 * through any host function it is handed — so each script runs on its own Worker thread
 * (usersource-worker.js) and only plain data crosses. A script that crashes, spins, exhausts
 * its memory or takes down its thread merely drops out; the caller falls back to builtin sources.
 */
import { Worker } from 'node:worker_threads'

const WORKER_URL = new URL('./usersource-worker.js', import.meta.url)
/** LX platform key → our source id (mg/local have no builtin counterpart to hook). */
const LX_KEY_TO_SOURCE = { kw: 'kuwo', kg: 'kugou', tx: 'qq', wy: 'netease' }
const SOURCE_TO_LX_KEY = Object.fromEntries(Object.entries(LX_KEY_TO_SOURCE).map(([k, v]) => [v, k]))
const HANDSHAKE_MS = 5000
const RESOLVE_MS = 15000

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

// id → { script, runtime }; rebuilt lazily whenever state.musicSources changes.
const loaded = new Map()
let seq = 0
let syncing = null

function disposeRuntime(runtime) {
  if (!runtime?.worker) return
  const worker = runtime.worker
  runtime.worker = null
  runtime.disposed = true
  // terminate() interrupts the thread even mid infinite-loop
  Promise.resolve()
    .then(() => worker.terminate())
    .catch(() => {})
}

/** The runtime is unusable (crashed, exited, hung): settle its requests and drop it from the
 *  cache so the next lookup boots the script afresh. */
function fail(runtime, message) {
  runtime.error = String(message).slice(0, 300)
  for (const req of runtime.pending.values()) {
    clearTimeout(req.timer)
    req.resolve(null)
  }
  runtime.pending.clear()
  disposeRuntime(runtime)
  if (loaded.get(runtime.id)?.runtime === runtime) loaded.delete(runtime.id)
}

/** Boot one script on a fresh thread. Always resolves a runtime; `error` is set when it failed. */
function spawnRuntime(entry) {
  return new Promise((resolve) => {
    const runtime = { id: entry.id, worker: null, pending: new Map(), sources: {}, platforms: [], error: '', disposed: false }
    let settled = false
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(runtime) }
    const die = (message) => { fail(runtime, message); finish() }
    let timer = setTimeout(() => die('脚本未在 5 秒内完成 inited 握手'), HANDSHAKE_MS)
    let worker
    try {
      // execArgv: [] — a worker must not inherit flags of the host process (--input-type, -e, loaders…); they would make it fail to start
      worker = new Worker(WORKER_URL, { execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128 } })
    } catch (err) {
      die(err?.message ?? err)
      return
    }
    runtime.worker = worker
    worker.on('message', (m) => {
      if (m?.type === 'booted') {
        if (settled) return
        if (m.error) return die(m.error)
        runtime.sources = m.sources && typeof m.sources === 'object' ? m.sources : {}
        runtime.platforms = Object.keys(runtime.sources).map((k) => LX_KEY_TO_SOURCE[k]).filter(Boolean)
        finish()
      } else if (m?.type === 'resolved') {
        const req = runtime.pending.get(m.id)
        if (!req) return
        runtime.pending.delete(m.id)
        clearTimeout(req.timer)
        req.resolve(typeof m.url === 'string' ? m.url : null)
      }
    })
    worker.on('error', (err) => die(err?.message ?? err))
    worker.on('exit', (code) => { if (!runtime.disposed) die(`脚本异常退出（code ${code}）`) })
    // a script's thread must never keep the host process alive; the message listener above refs it, so this comes last
    worker.unref()
    try {
      worker.postMessage({ type: 'boot', id: entry.id, script: entry.script, meta: parseScriptHeader(entry.script) })
    } catch (err) {
      die(err?.message ?? err)
    }
  })
}

/** Send one musicUrl request to the script's thread; null on timeout or once the thread is gone. */
function ask(runtime, lxKey, musicInfo, type) {
  const worker = runtime.worker
  if (!worker) return Promise.resolve(null)
  return new Promise((resolve) => {
    const id = ++seq
    const timer = setTimeout(() => { fail(runtime, '脚本响应超时'); resolve(null) }, RESOLVE_MS)
    runtime.pending.set(id, { timer, resolve })
    try {
      worker.postMessage({ type: 'resolve', id, lxKey, quality: type, musicInfo })
    } catch {
      clearTimeout(timer)
      runtime.pending.delete(id)
      resolve(null)
    }
  })
}

/** Make `loaded` match the enabled scripts, reusing runtimes whose script text is unchanged.
 *  Concurrent callers share one pass: a runtime replaced behind the loop's back would be
 *  orphaned, and an orphaned thread is never terminated. */
function sync(state) {
  if (!syncing) {
    syncing = (async () => {
      const entries = Array.isArray(state?.musicSources) ? state.musicSources.filter((e) => e.enabled !== false) : []
      const live = new Set(entries.map((e) => e.id))
      for (const [id, { runtime }] of [...loaded]) {
        if (!live.has(id)) {
          disposeRuntime(runtime)
          loaded.delete(id)
        }
      }
      for (const e of entries) {
        const kept = loaded.get(e.id)
        if (kept?.script === e.script) continue
        // A script that failed its handshake stays cached as failed until its text changes;
        // one whose thread died after boot (evicted by fail) is booted again here.
        if (kept) {
          disposeRuntime(kept.runtime)
          loaded.delete(e.id)
        }
        loaded.set(e.id, { script: e.script, runtime: await spawnRuntime(e) })
      }
      // lookup order = list order: a re-booted script must not drop to the end of the chain
      for (const e of entries) {
        const hit = loaded.get(e.id)
        if (hit) { loaded.delete(e.id); loaded.set(e.id, hit) }
      }
    })().finally(() => { syncing = null })
  }
  return syncing
}

/** First matching script URL for our source id, or null so the caller falls back to builtin.
 * preferId: when the user picked a specific custom source (custom:<id>), only that script runs. */
export async function resolveScripted(state, source, musicInfo, preferId = '') {
  const lxKey = SOURCE_TO_LX_KEY[source]
  if (!lxKey) return null
  await sync(state)
  for (const [id, { runtime }] of loaded) {
    if (preferId && id !== preferId) continue
    const qualitys = runtime.sources[lxKey]
    if (!Array.isArray(qualitys)) continue
    const type = qualitys.includes('320k') ? '320k' : qualitys[0] ?? '128k'
    const url = await ask(runtime, lxKey, musicInfo, type)
    if (url) return url
  }
  return null
}

/** Boot every script once and return their {platforms, error} for storage. Runs when the user
 *  saves a script, so a cached runtime that had failed gets a fresh boot on the next lookup. */
export async function describeAll(state) {
  const out = []
  for (const e of Array.isArray(state?.musicSources) ? state.musicSources : []) {
    if (e.enabled === false) { out.push({ id: e.id, platforms: [], error: '' }); continue }
    const runtime = await spawnRuntime(e)
    out.push({ id: e.id, platforms: runtime.platforms, error: runtime.error })
    disposeRuntime(runtime)
    if (loaded.get(e.id)?.runtime.error) loaded.delete(e.id)
  }
  return out
}

/** Terminate every script thread; called when the plugin unloads. */
export function disposeAll() {
  for (const { runtime } of loaded.values()) disposeRuntime(runtime)
  loaded.clear()
}
