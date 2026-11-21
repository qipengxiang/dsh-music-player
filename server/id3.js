/**
 * Minimal ID3v2.3 writer: enough to make downloaded mp3s carry title/artist/album/词曲作者/
 * lyrics/cover in any player. Hand-rolled (~90 lines) instead of pulling a dependency; FLAC/M4A
 * keep metadata in the plugin's library + sidecar .lrc only.
 * v2.3 frame sizes are plain 32-bit big-endian (sync-safe is v2.4), no unsynchronisation.
 */
import { readFile, writeFile } from 'node:fs/promises'

const ENC_UTF16 = Buffer.from([0x01])
const BOM = Buffer.from([0xff, 0xfe])

function utf16(text) {
  return Buffer.concat([BOM, Buffer.from(String(text ?? '') + '\0', 'utf16le')])
}

function latin1(text) {
  return Buffer.from(String(text ?? '') + '\0', 'latin1')
}

function frame(id, ...parts) {
  const body = Buffer.concat(parts)
  const head = Buffer.alloc(10)
  head.write(id, 0, 'latin1')
  head.writeUInt32BE(body.length, 4)
  return Buffer.concat([head, body])
}

function textFrame(id, text) {
  if (!text) return null
  return frame(id, ENC_UTF16, utf16(text))
}

/** Build a complete ID3v2.3 tag from tag fields. */
export function buildId3({ title, artist, album, lyricist, composer, lyrics, coverBuf, coverMime }) {
  const frames = [
    textFrame('TIT2', title),
    textFrame('TPE1', artist),
    textFrame('TALB', album),
    textFrame('TEXT', lyricist),
    textFrame('TCOM', composer),
    lyrics
      ? frame('USLT', ENC_UTF16, Buffer.from('chi', 'latin1'), BOM, Buffer.from(String(lyrics), 'utf16le'))
      : null,
    coverBuf && coverBuf.length
      ? frame(
          'APIC',
          Buffer.from([0x00]),
          Buffer.from(coverMime === 'image/png' ? 'image/png' : 'image/jpeg', 'latin1'),
          Buffer.from([0x00, 0x03]),
          latin1(''),
          coverBuf,
        )
      : null,
  ].filter(Boolean)
  const body = Buffer.concat(frames)
  const header = Buffer.alloc(10)
  header.write('ID3', 0, 'latin1')
  header[3] = 0x03 // version 2.3
  header[4] = 0x00 // revision
  header[5] = 0x00 // flags
  header[6] = (body.length >>> 21) & 0x7f // sync-safe total frame bytes
  header[7] = (body.length >>> 14) & 0x7f
  header[8] = (body.length >>> 7) & 0x7f
  header[9] = body.length & 0x7f
  return Buffer.concat([header, body])
}

/** Length in bytes of a leading ID3v2 tag, or 0. */
export function id3Size(buf) {
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return 0
  const syncSafe = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
  return 10 + syncSafe + (buf[5] & 0x10 ? 10 : 0) // +footer when flag set
}

/** Rewrite an mp3 in place: strip any existing ID3v2 tag, prepend a fresh one. */
export async function tagFile(path, tags) {
  const raw = await readFile(path)
  const skip = id3Size(raw)
  const out = Buffer.concat([buildId3(tags), raw.subarray(skip)])
  await writeFile(path, out)
  return out.length
}
