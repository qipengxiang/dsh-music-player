/**
 * Offline self-check: crypto helpers, playlist parsing, state sanitising, lyric parsing and the
 * client plugin's slot registration + pure helpers. No network, no browser.
 *
 *   node --test tests/self-check.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mixinKey, parseCustomPlaylist, publicState, sanitizeState, wbiSign, weapi, isBlockedHost, refererFor, modPow } from '../server/util.js'

test('weapi produces the documented two-layer form', () => {
  const { params, encSecKey } = weapi({ hello: '世界' })
  assert.match(encSecKey, /^[0-9a-f]{256}$/)
  // params is base64 of AES-CBC ciphertext: decodable, padded to 16-byte blocks.
  const raw = Buffer.from(params, 'base64')
  assert.equal(raw.length % 16, 0)
  assert.ok(raw.length > 16)
})

test('modPow agrees with BigInt pow on small numbers', () => {
  assert.equal(modPow(4n, 13n, 497n), 4n ** 13n % 497n)
  assert.equal(modPow(123456789n, 0n, 1000000007n), 1n)
})

test('wbi signing uses the reordered 32-char mixin key', () => {
  // Keys from the bilibili-API-collect example.
  const key = mixinKey('7cd084941338484aae1ad9425b84077c', '4932caff0ff746eab6f01bf08b70ac45')
  assert.equal(key.length, 32)
  assert.equal(key, 'ea1db124af3c7062474693fa704f4ff8')
  const q = wbiSign({ foo: '114', bar: '514', baz: 1919810 }, '7cd084941338484aae1ad9425b84077c', '4932caff0ff746eab6f01bf08b70ac45')
  assert.match(q, /^bar=514&baz=1919810&foo=114&wts=\d+&w_rid=[0-9a-f]{32}$/)
})

test('custom playlist text: plain lines, m3u and garbage', () => {
  const tracks = parseCustomPlaylist([
    '晴天 - 周杰伦 https://example.com/a.mp3',
    'https://example.com/b.flac',
    '#EXTM3U',
    '#EXTINF:213,五月天 - 倔强',
    'https://example.com/c.mp3',
    '没有地址的行',
    '',
  ].join('\n'))
  assert.equal(tracks.length, 3)
  assert.equal(tracks[0].title, '晴天')
  assert.equal(tracks[0].artist, '周杰伦')
  assert.equal(tracks[1].title, 'b')
  assert.equal(tracks[1].artist, '')
  assert.equal(tracks[2].title, '五月天')
  assert.equal(tracks[2].artist, '倔强')
  assert.equal(tracks[2].duration, 213)
  assert.equal(tracks[2].source, 'custom')
})

test('sanitizeState whitelists shapes and drops cookies from the public view', () => {
  const state = sanitizeState({
    playlists: [
      { id: 'p1', name: 'x'.repeat(999), kind: 'local', root: '/tmp/m', tracks: [{ id: 't', title: 'a', url: '/tmp/m/a.mp3', source: 'local' }] },
      { id: 'p2', kind: 'local' }, // local without root: dropped
      { id: 'p3', kind: 'weird', tracks: 'nope' },
    ],
    settings: { mode: 'hack', downloadDir: 'relative/path' },
    accounts: { netease: { name: '我', cookie: 'MUSIC_U=secret', uid: '1' }, soda: 'junk' },
    downloads: [
      { id: 'd1', file: '../../etc/passwd', lrc: 'a.lrc', cover: 'c.jpg', title: 't', artist: 'a', source: 'kugou', sourceId: 'h1' },
      { id: 'd2', file: 'x.mp3', source: 'bogus' },
      'junk',
    ],
  })
  assert.equal(state.playlists.length, 2)
  assert.equal(state.playlists[0].name.length, 200)
  assert.equal(state.playlists[1].kind, 'custom')
  assert.equal(state.settings.mode, 'order')
  assert.equal(state.settings.downloadDir, '') // relative paths never survive
  assert.equal(state.accounts.netease.cookie, 'MUSIC_U=secret')
  assert.equal(state.accounts.soda, undefined)
  assert.equal(state.downloads.length, 2)
  assert.equal(state.downloads[0].file, 'passwd') // path traversal flattened to a bare name
  assert.equal(state.downloads[0].source, 'kugou')
  assert.equal(state.downloads[1].source, '')
  const pub = publicState(state)
  assert.equal(pub.accounts.netease.loggedIn, true)
  assert.equal(pub.accounts.netease.cookie, undefined)
  assert.equal(pub.downloads.length, 2)
})

test('sanitizeState clamps pageSize, validates accent and hotkey strings', () => {
  const bad = sanitizeState({ settings: { pageSize: 3, accent: 'red', hotkeys: { prev: 'x'.repeat(99), next: 123 } } })
  assert.equal(bad.settings.pageSize, 5) // clamped up
  assert.equal(bad.settings.accent, '')
  assert.equal(bad.settings.hotkeys.prev.length, 40) // truncated
  assert.equal(bad.settings.hotkeys.next, '') // non-string dropped
  assert.equal(bad.settings.hotkeys.toggle, '')
  const good = sanitizeState({ settings: { pageSize: '25', accent: '#aB12Cd', hotkeys: { prev: 'Ctrl+ArrowLeft' } } })
  assert.equal(good.settings.pageSize, 25)
  assert.equal(good.settings.accent, '#aB12Cd')
  assert.equal(good.settings.hotkeys.prev, 'Ctrl+ArrowLeft')
  const dflt = sanitizeState({})
  assert.equal(dflt.settings.pageSize, 10)
  assert.equal(dflt.settings.accent, '')
  assert.ok(dflt.settings.hk === true) // seeded flag
})

test('sanitizeState seeds default hotkeys once, never after hk flag', () => {
  const first = sanitizeState({}) // all four empty → seeded
  assert.equal(first.settings.hotkeys.prev, 'Alt+ArrowLeft') // darwin host
  assert.equal(first.settings.hotkeys.toggle, 'Alt+P')
  const cleared = sanitizeState({ settings: { hk: true, hotkeys: { prev: '', next: '', toggle: '', mode: '' } } }) // user cleared all
  assert.equal(cleared.settings.hotkeys.prev, '') // no re-seed
  const kept = sanitizeState({ settings: { hotkeys: { prev: 'Ctrl+B' } } }) // partial existing → untouched
  assert.equal(kept.settings.hotkeys.prev, 'Ctrl+B')
})

test('sanitizeState keeps kugou platform playlists and an absolute download dir', () => {
  const state = sanitizeState({
    playlists: [{ id: 'kg', kind: 'platform', source: 'kugou', refId: 'g1', name: '我的收藏' }],
    settings: { downloadDir: '/tmp/music-dl' },
    downloads: [{ id: 'd', file: 'a.mp3', source: 'pan', sourceId: 'pan:x' }],
  })
  assert.equal(state.playlists[0].source, 'kugou')
  assert.equal(state.settings.downloadDir, '/tmp/music-dl')
  assert.equal(state.downloads[0].source, 'pan')
})

test('proxy guard blocks loopback/private hosts, allows public CDNs', () => {
  for (const bad of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.1.2', '172.16.0.9', '169.254.169.254', '224.0.0.1', '::1', 'fe80::1', 'fc00::5']) {
    assert.equal(isBlockedHost(bad), true, bad)
  }
  for (const ok of ['music.163.com', 'm701.music.126.net', 'upos-sz-mirror08h.bilivideo.com', 'i0.hdslb.com', 'antiserver.kuwo.cn', 'dl.stream.qqmusic.qq.com']) {
    assert.equal(isBlockedHost(ok), false, ok)
  }
})

test('referer policy for the known CDN families', () => {
  assert.equal(refererFor('https://i0.hdslb.com/bfs/wbi/x.png'), 'https://www.bilibili.com/')
  assert.equal(refererFor('https://upos-sz-mirror08h.bilivideo.org/audio.m4s'), 'https://www.bilibili.com/')
  assert.equal(refererFor('https://p1.music.126.net/a.mp3'), 'https://music.163.com/')
  assert.equal(refererFor('https://y.gtimg.cn/music/a.jpg'), 'https://y.qq.com/')
  assert.equal(refererFor('https://antiserver.kuwo.cn/anti.s'), '')
})

// ---------- download/id3 half ----------

test('id3: build → strip roundtrip, UTF-16 frames parse back, tagFile rewrites in place', async () => {
  const { buildId3, id3Size, tagFile } = await import('../server/id3.js')
  const tag = buildId3({
    title: '晴天', artist: '周杰伦', album: '叶惠美', lyricist: '方文山', composer: '周杰伦',
    lyrics: '[00:01.00]故事的小黄花', coverBuf: Buffer.from([0xff, 0xd8, 0xff, 0x00]), coverMime: 'image/jpeg',
  })
  assert.equal(tag.toString('latin1', 0, 3), 'ID3')
  assert.equal(tag[3], 0x03) // v2.3
  assert.equal(id3Size(tag), tag.length)
  // Frame walk: TIT2 payload is UTF-16LE with BOM.
  const body = tag.subarray(10)
  const readFrame = (off) => {
    const id = body.toString('latin1', off, off + 4)
    const size = body.readUInt32BE(off + 4)
    return [id, size, off + 10]
  }
  const decodeText = (buf) => buf.toString('utf16le').replace(/^\ufeff/, '').replace(/\0/g, '')
  const [id0, size0, start0] = readFrame(0)
  assert.equal(id0, 'TIT2')
  assert.equal(decodeText(body.subarray(start0 + 1, start0 + size0)), '晴天')
  // Strip: id3Size lets a reader skip the whole tag.
  const mp3Bytes = Buffer.concat([tag, Buffer.from('fakeaudio')])
  assert.equal(mp3Bytes.subarray(id3Size(mp3Bytes)).toString(), 'fakeaudio')
  // tagFile in place on a real temp file.
  const fs = await import('node:fs')
  const dir = await import('node:fs/promises').then((f) => f.mkdtemp('/tmp/dshmp-id3-'))
  const path = `${dir}/x.mp3`
  await fs.promises.writeFile(path, Buffer.concat([tag, Buffer.from('fakeaudio')]))
  await tagFile(path, { title: '新歌名', artist: '新歌手' })
  const reread = await fs.promises.readFile(path)
  assert.equal(reread.subarray(id3Size(reread)).toString(), 'fakeaudio')
  const body2 = reread.subarray(10)
  const [id1, size1, start1] = readFrame2(0)
  function readFrame2(off) {
    const id = body2.toString('latin1', off, off + 4)
    const size = body2.readUInt32BE(off + 4)
    return [id, size, off + 10]
  }
  assert.equal(id1, 'TIT2')
  assert.equal(decodeText(body2.subarray(start1 + 1, start1 + size1)), '新歌名')
  await fs.promises.rm(dir, { recursive: true, force: true })
})

test('pan source maps the so.liumingye.cn search payload to tracks', async () => {
  const { mapPanTracks } = await import('../server/pan.js')
  const { tracks } = mapPanTracks({
    data: [
      { id: 'abc', title: '晴天', artist: '周杰伦', cover: 'https://s3.liumingye.cn/files/a.jpg', quality: ['夸克MP3'] },
      { id: 'def', title: '', artist: '', cover: '' },
    ],
    total: 2,
  })
  assert.equal(tracks.length, 2)
  assert.equal(tracks[0].id, 'pan:abc')
  assert.equal(tracks[0].source, 'pan')
  assert.equal(tracks[1].title, '未命名')
  assert.deepEqual(mapPanTracks({}), { tracks: [] })
})

test('5sing source maps search JSON and rejects bad ids', async () => {
  const { map5singTracks, songUrl } = await import('../server/5sing.js')
  const { tracks } = map5singTracks({
    list: [
      { songId: 15622111, songName: '<em class="keyword">晴天</em>', singer: 'Vk', typeEname: 'fc', songSize: 10462607 },
      { songId: 1, songName: '', singer: '', typeEname: 'yc' },
    ],
  })
  assert.equal(tracks[0].id, '5sing:15622111:fc')
  assert.equal(tracks[0].title, '晴天')
  assert.equal(tracks[0].duration, Math.round(10462607 * 8 / 320000))
  assert.equal(tracks[1].title, '未命名')
  assert.deepEqual(map5singTracks({}), { tracks: [] })
  await assert.rejects(songUrl('nonsense'), /ID 无效/)
})

test('wusunk source parses WordPress posts and netdisk links', async () => {
  const { mapWusunkPosts, extractNetdiskLinks } = await import('../server/wusunk.js')
  const html = '<ul class="search-page"><li class="search-inf">2026年10月13日</li><li class="entry-title"><a href="https://wusunk.com/38583.html" rel="bookmark">《晴天》合集[MP3]百度云网盘下载</a></li></ul>'
  const { tracks } = mapWusunkPosts(html)
  assert.equal(tracks[0].id, 'wusunk:https://wusunk.com/38583.html')
  assert.equal(tracks[0].source, 'wusunk')
  assert.deepEqual(mapWusunkPosts('<p>no match</p>'), { tracks: [] })
  const { links } = extractNetdiskLinks('看 <a href="https://pan.baidu.com/s/1abc?pwd=x">盘</a> 与 https://pan.quark.cn/s/7ef &amp; end')
  assert.equal(links.length, 2)
  assert.equal(links[0].url, 'https://pan.baidu.com/s/1abc?pwd=x')
})

test('index.js exports the server plugin shape and scans a folder', async () => {  const mod = await import('../index.js')
  assert.equal(mod.name, 'dsh-music-player')
  assert.equal(typeof mod.apply, 'function')
  // scanFolder pairs .lrc files regardless of iteration order and keeps audio only.
  const dir = await import('node:fs/promises').then((fs) => fs.mkdtemp('/tmp/dshmp-test-'))
  const fs = await import('node:fs')
  await fs.promises.writeFile(`${dir}/b.flac`, 'x')
  await fs.promises.writeFile(`${dir}/b.lrc`, '[00:01.00]hello')
  await fs.promises.writeFile(`${dir}/a.mp3`, 'x')
  await fs.promises.writeFile(`${dir}/readme.txt`, 'x')
  await fs.promises.mkdir(`${dir}/sub`)
  await fs.promises.writeFile(`${dir}/sub/c.m4a`, 'x')
  const { root, tracks } = await mod.scanFolder(dir)
  assert.equal(root, dir)
  assert.deepEqual(tracks.map((t) => t.title), ['a', 'b', 'c']) // sorted, audio only
  assert.equal(tracks.find((t) => t.title === 'b').lrcPath, `${dir}/b.lrc`)
  await fs.promises.rm(dir, { recursive: true, force: true })
})

// ---------- client half ----------

const CLIENT = new URL('../client.js', import.meta.url)

async function loadClient() {
  let states = []
  let cursor = 0
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(9) }),
    useState: (initial) => {
      const value = states[cursor++]
      return [value === undefined ? initial : value, () => {}]
    },
    useEffect: () => {},
    useRef: () => ({}),
  }
  let plugin
  globalThis.window = {
    __ModuleLoader__: {
      load(spec) {
        plugin = spec.factory((id) => {
          assert.equal(id, 'react', 'the client half may only require react')
          return react
        })
      },
    },
  }
  await import(`${CLIENT.href}?stub=${Math.random()}`)
  return { plugin }
}

test('client registers the mini player and the settings page slots', async () => {
  const { plugin } = await loadClient()
  assert.deepEqual(plugin.inject, ['slots'])
  const slots = []
  const disposers = []
  plugin.apply({
    slots: {
      inject: (name, run) => { slots.push([name, run()]) },
      register: (meta, Component) => { disposers.push({ meta, Component }); return () => {} },
    },
  })
  assert.deepEqual(slots.map(([n]) => n), ['conversation.session.header.utilities', 'settings.section', 'settings.section.icon'])
  assert.equal(typeof slots[0][1], 'function') // register() was called, returning a component-bound disposer slot
  assert.equal(disposers[0].meta.id, 'dsh-music-player')
  assert.equal(typeof disposers[0].Component, 'function')
  assert.equal(disposers[1].meta.id, 'dsh-music-player')
  assert.equal(disposers[1].meta.label, '音乐播放器')
  assert.equal(typeof disposers[1].Component, 'function')
  assert.equal(disposers[2].meta.id, 'dsh-music-player', 'icon registration id matches the section id')
  assert.equal(typeof disposers[2].Component, 'function')
})

test('client pure helpers: lrc parsing, time format, next-track policy', async () => {
  const { plugin } = await loadClient()
  const { parseLrc, fmtTime, pickNextIndex, nextMode, decodeBytes, dlRing, PAGE_SIZE, safePage, comboOf } = plugin.__pure
  // 快捷键组合规范化：修饰键顺序固定、单字符大写、空格是 Space、裸修饰键返回 null
  assert.equal(comboOf({ key: 'ArrowLeft', altKey: true }), 'Alt+ArrowLeft')
  assert.equal(comboOf({ key: 'a', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+A')
  assert.equal(comboOf({ key: ' ' }), 'Space')
  assert.equal(comboOf({ key: 'MediaTrackNext' }), 'MediaTrackNext')
  assert.equal(comboOf({ key: 'Shift' }), null)
  assert.equal(comboOf({ key: 'x', metaKey: true, altKey: true }), 'Alt+Meta+X')
  const lines = parseLrc('[00:01.50]第一句\n[00:03:20][00:09]双时间戳\n[02:03.05]后半\n[bad]nope\nplain line')
  assert.deepEqual(lines, [
    { t: 1.5, text: '第一句' },
    { t: 3 + 20 / 100, text: '双时间戳' },
    { t: 9, text: '双时间戳' },
    { t: 123.05, text: '后半' },
  ])
  assert.equal(fmtTime(0), '0:00')
  assert.equal(fmtTime(65), '1:05')
  assert.equal(fmtTime(3661), '61:01')
  assert.equal(pickNextIndex('order', 2, 3), 0)
  assert.equal(pickNextIndex('order', 0, 1), 0)
  assert.equal(pickNextIndex('shuffle', 1, 5, () => 0.999), 4)
  assert.equal(pickNextIndex('shuffle', 4, 5, () => 0), 0)
  assert.equal(nextMode('order'), 'shuffle')
  assert.equal(nextMode('shuffle'), 'single')
  assert.equal(nextMode('single'), 'order')
  assert.equal(nextMode(undefined), 'order')
  // GBK .lrc files: utf-8 strict read must fail, gb18030 fallback must recover the text.
  assert.equal(decodeBytes(new Uint8Array([0x5b, 0x61, 0x72, 0x3a, 0xb3, 0xcc, 0xcf, 0xec, 0x5d])), '[ar:程响]')
  assert.equal(decodeBytes(new TextEncoder().encode('[ti:歌]')), '[ti:歌]')
  // pager page sizes: bilibili serves 20/page, scraped wusunk has no page 2 (next stays disabled)
  assert.equal(PAGE_SIZE.netease, 30)
  assert.equal(PAGE_SIZE.bilibili, 20)
  assert.equal(PAGE_SIZE.wusunk > 100, true)
  // safePage: onClick: doSearch passes a MouseEvent — must coerce, not stringify
  assert.equal(safePage({ target: 1 }), 1)
  assert.equal(safePage(undefined), 1)
  assert.equal(safePage('3'), 3)
  assert.equal(safePage(2), 2)
  assert.equal(safePage(-5), 1)
  // App Store 风格下载圆环：进度→dashoffset 换算
  const RING = 2 * Math.PI * 16
  assert.equal(dlRing(null).offset, RING)
  assert.equal(dlRing({ phase: 'linking' }).offset, RING)
  assert.equal(dlRing({ phase: 'downloading', received: 25, total: 100 }).offset, RING * 0.75)
  assert.equal(dlRing({ phase: 'saving' }).offset, 0)
  assert.equal(dlRing({ phase: 'downloading', received: 5, total: 0 }).indet, true)
})

test('kuwo SMS login wiring: form renders for kuwo and calls the three routes', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(CLIENT, 'utf8'))
  assert.ok(src.includes("pop.login === 'kuwo'"), 'LoginModal routes kuwo to the SMS form')
  assert.ok(src.includes('function KuwoSmsForm'), 'SMS form component exists')
  for (const route of ["'/kuwo-captcha'", "'/kuwo-sms'", "'/kuwo-login'"]) {
    assert.ok(src.includes(route), `client calls ${route}`)
  }
  assert.ok(!src.includes("id === 'netease' || id === 'bilibili' || id === 'kugou' || id === 'qq'\n"), 'no stale supported list without kuwo')
})

test('qishui (soda) wiring: source option, QR login path and account-playlists route', async () => {
  const fs = await import('node:fs')
  const src = fs.readFileSync(CLIENT, 'utf8')
  assert.ok(src.includes("value: 'qishui'"), 'search source select offers qishui')
  assert.ok(src.includes("pop.login === 'soda'"), 'LoginModal offers soda QR')
  assert.ok(src.includes("请用抖音 App 扫码"), 'soda QR hint present')
  assert.ok(src.includes("loadAccountLists('soda')"), 'account-playlists button for soda')
  const idx = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  for (const probe of ["qishui.qrStart()", "qishui.qrPoll(key)", "qishui.userPlaylists()", "qishui.playlistTracks(pl.refId)", "qishui.searchPlaylists(q)"]) {
    assert.ok(idx.includes(probe), `index.js wires ${probe}`)
  }
  const { parseQishuiLyric } = await import('../server/qishui.js')
  const lines = parseQishuiLyric('[0,1000]<0,200,0>你<200,300,0>好<500,500,0>呀\n[5300,2000]<0,2000,0>世界\nnope')
  assert.deepEqual(lines, [{ t: 0, text: '你好呀' }, { t: 5.3, text: '世界' }])
})

test('sanitizeState keeps structured soda session but publicState never exposes it', async () => {
  const { sanitizeState, publicState } = await import('../server/util.js')
  const session = { version: 1, user: { id: 42, nickname: '汽水用户' }, ticket: 't' }
  const s = sanitizeState({ playlists: [], settings: {}, accounts: { soda: { name: 'x', uid: '42', session, deviceId: 'dev-abc' } } })
  assert.deepEqual(s.accounts.soda.session, session)
  assert.equal(s.accounts.soda.deviceId, 'dev-abc')
  const p = publicState(s)
  assert.equal(p.accounts.soda.session, undefined)
  assert.equal(p.accounts.soda.deviceId, undefined)
  assert.equal(p.accounts.soda.loggedIn, true)
  // oversized session blob is dropped, not fatal
  const big = sanitizeState({ playlists: [], settings: {}, accounts: { soda: { session: { junk: 'x'.repeat(30000) } } } })
  assert.equal(big.accounts.soda.session, undefined)
})

test('settings section icon overrides the default gear glyph', async () => {
  const fs = await import('node:fs')
  const src = fs.readFileSync(CLIENT, 'utf8')
  assert.ok(src.includes("function SettingsSectionIcon"), 'icon component exists')
  assert.ok(src.includes("ctx.slots.inject('settings.section.icon'"), 'icon slot registered')
  assert.ok(src.includes("register({ name: 'settings.section.icon', id: 'dsh-music-player' }"), 'registered under the section id so the shell matches it')
})

test('search marks vip-only songs per platform (netease/qq/kugou field semantics)', async () => {
  const realFetch = globalThis.fetch
  const jsonRes = (j) => new Response(JSON.stringify(j), { status: 200, headers: { 'content-type': 'application/json' } })
  const canned = {
    'music.163.com': jsonRes({ result: { songs: [
      { id: 1, name: 'VIP 曲', fee: 1 },
      { id: 2, name: '免费曲', fee: 0 },
      { id: 3, name: '免费低音质', fee: 8 },
    ] } }),
    'c.y.qq.com': jsonRes({ data: { song: { list: [
      { songmid: 'a', songname: '付费', pay: { payplay: 1 } },
      { songmid: 'b', songname: '免费', pay: { payplay: 0 } },
    ] } } }),
    'gateway.kugou.com': jsonRes({ data: { lists: [
      { FileHash: 'h1', SongName: 'VIP', PayType: 3, Privilege: 10 },
      { FileHash: 'h2', SongName: '免费', PayType: 0, Privilege: 0 },
    ] } }),
  }
  globalThis.fetch = (url) => {
    const u = String(url)
    for (const [host, res] of Object.entries(canned)) if (u.includes(host)) return Promise.resolve(res)
    return Promise.reject(new Error('unexpected fetch ' + u))
  }
  try {
    const ne = (await (await import('../server/netease.js')).search('x')).tracks
    assert.deepEqual(ne.map((t) => !!t.vip), [true, false, false], 'netease fee 1/0/8')
    const qs = (await (await import('../server/qq.js')).search('x')).tracks
    assert.deepEqual(qs.map((t) => !!t.vip), [true, false], 'qq pay.payplay')
    const kg = (await (await import('../server/kugou.js')).search('x')).tracks
    assert.deepEqual(kg.map((t) => !!t.vip), [true, false], 'kugou PayType 3 / Privilege>0')
  } finally { globalThis.fetch = realFetch }
})

test('sortRows sorts by title/artist/duration and nextSort cycles asc/desc/off', async () => {
  const { sortRows, nextSort } = (await loadClient()).plugin.__pure
  const rows = [
    { title: 'B 歌', artist: '张三', duration: 30 },
    { title: 'A 歌', artist: '李四', duration: 100 },
    { title: 'C 歌', artist: '王五', duration: 5 },
  ]
  assert.deepEqual(sortRows(rows, { key: 'duration', dir: 1 }).map((r) => r.duration), [5, 30, 100])
  assert.deepEqual(sortRows(rows, { key: 'duration', dir: -1 }).map((r) => r.duration), [100, 30, 5])
  assert.deepEqual(sortRows(rows, { key: 'title', dir: 1 }).map((r) => r.title), ['A 歌', 'B 歌', 'C 歌'])
  assert.equal(sortRows(rows, { key: '', dir: 1 })[0].title, 'B 歌')
  assert.deepEqual(rows.map((r) => r.title), ['B 歌', 'A 歌', 'C 歌'])
  assert.deepEqual(nextSort({ key: '', dir: 1 }, 'title'), { key: 'title', dir: 1 })
  assert.deepEqual(nextSort({ key: 'title', dir: 1 }, 'title'), { key: 'title', dir: -1 })
  assert.deepEqual(nextSort({ key: 'title', dir: -1 }, 'title'), { key: '', dir: 1 })
})

test('sortRows 来源列按展示的渠道标签排序，同渠道相邻', async () => {
  const { sortRows } = (await loadClient()).plugin.__pure
  const rows = [
    { title: 'A', origin: 'kuwo' },
    { title: 'B', origin: '5sing' },
    { title: 'C', source: 'netease' },
    { title: 'D', origin: 'kuwo' },
    { title: 'E', source: 'local' },
  ]
  const up = sortRows(rows, { key: 'source', dir: 1 }).map((r) => r.title)
  assert.equal(up.length, 5)
  // 本地（ben）在酷我（ku）之前；两条酷我相邻
  assert.ok(up.indexOf('E') < up.indexOf('A'), `本地应在酷我前: ${up}`)
  assert.equal(Math.abs(up.indexOf('A') - up.indexOf('D')), 1, `同渠道应相邻: ${up}`)
  const down = sortRows(rows, { key: 'source', dir: -1 }).map((r) => r.title)
  assert.ok(down.indexOf('C') < down.indexOf('E'), `降序时网易云应在本地前: ${down}`)
  assert.equal(Math.abs(down.indexOf('A') - down.indexOf('D')), 1, `降序同渠道也应相邻: ${down}`)
})

test('parseTrackName splits 曲目号 歌手 - 歌名 from a filename', async () => {
  const { parseTrackName } = await import('../index.js')
  assert.deepEqual(parseTrackName('0063程响-世界这么大还是遇见你'), { title: '世界这么大还是遇见你', artist: '程响' })
  assert.deepEqual(parseTrackName('01. 周杰伦 - 晴天'), { title: '晴天', artist: '周杰伦' })
  assert.deepEqual(parseTrackName('2002年的第一场雪'), { title: '2002年的第一场雪', artist: '' })
  assert.deepEqual(parseTrackName('晴天 - '), { title: '晴天 -', artist: '' })
})

test('probeDuration reads mp3 CBR/Xing and m4a mvhd durations', async () => {  const mod = await import('../index.js')
  const { mkdtemp, writeFile } = await import('node:fs/promises')
  const dir = await mkdtemp('/tmp/dshmp-dur-')
  // CBR: ID3(tag size 0) + MPEG1 L3 128kbps 44100Hz frame header + payload → (size-tag)*8/128000 = 1s
  const cbr = Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.alloc(7),
    Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(16000 - 4)])
  await writeFile(`${dir}/cbr.mp3`, cbr)
  assert.equal(await mod.probeDuration(`${dir}/cbr.mp3`), 1)
  // Xing VBR: frame header + side info + Xing flags=1 + frame count 100
  const xing = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(32),
    Buffer.from('Xing', 'latin1'), Buffer.from([0, 0, 0, 1]), Buffer.from([0, 0, 0, 100]), Buffer.alloc(64)])
  await writeFile(`${dir}/xing.mp3`, xing)
  assert.equal(await mod.probeDuration(`${dir}/xing.mp3`), Math.round((100 * 1152) / 44100))
  // m4a: mvhd v0, timescale 1000, duration 65000 → 65s
  const mvhd = Buffer.alloc(64)
  mvhd.write('mvhd', 0, 'latin1')
  mvhd.writeUInt32BE(1000, 20)
  mvhd.writeUInt32BE(65000, 24)
  await writeFile(`${dir}/a.m4a`, mvhd)
  assert.equal(await mod.probeDuration(`${dir}/a.m4a`), 65)
  assert.equal(await mod.probeDuration(`${dir}/nope.flac`), 0)
})
