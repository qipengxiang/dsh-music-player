/**
 * Hosts exactly one user source script on its own thread. In: {type:'boot', id, script, meta} and
 * {type:'resolve', id, lxKey, quality, musicInfo}. Out: {type:'booted', sources, error} and
 * {type:'resolved', id, url}. Whatever a script does to this realm — crash, spin, exhaust its
 * memory, reach `process` — ends with this thread and nothing else.
 */
import { parentPort } from 'node:worker_threads'
import { boot, musicUrl } from './usersource-sandbox.js'

let runtime = null
parentPort.on('message', (m) => {
  if (m.type === 'boot') {
    void boot(m).then((rt) => {
      runtime = rt
      parentPort.postMessage({ type: 'booted', sources: rt.sources, error: rt.error })
    })
  } else if (m.type === 'resolve') {
    void musicUrl(runtime, m).then((url) => parentPort.postMessage({ type: 'resolved', id: m.id, url }))
  }
})
