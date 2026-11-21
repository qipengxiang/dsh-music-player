# dsh-music-player

A mini music player plugin for the DSH desktop app (DeepSeek Harness): injects a compact player into the top-right of the session title bar (left of the sidebar toggle) and shows the current lyric on the right of the second title row.

[中文说明](README.zh.md)

## Features

- **Play modes**: sequential / shuffle / single-loop (toggled at the bottom of the popup).
- **Local folders**: the ＋ button opens the native folder picker (falls back to a path input if unavailable) and recursively scans audio files (mp3/flac/m4a/aac/ogg/oga/wav/opus/aiff/wma); matching `.lrc` files pair up as lyrics automatically.
- **Network playlists**: paste a text playlist (one `title - artist http://…mp3` per line) or a standard M3U (`#EXTINF`).
- **Accounts**:
  - NetEase Cloud: QR login, load "my playlists"; free search/play without login.
  - Bilibili: paste Cookie (SESSDATA etc.), play favorites; anonymous audio search.
  - Kuwo / QQ Music: anonymous search & preview; **QQ supports QR login** (mobile QQ scan → musicu credentials) for playlists and account-gated URLs (VIP depends on your account); **Kuwo supports SMS login**.
  - Kugou: QR login (Kugou app); anonymous users get preview clips.
  - Qishui (Soda): QR login via the **Douyin app** (vehicle-open protocol); search/play/lyrics work anonymously. Credentials stay server-side only.
- **Free aggregate source** (pan): xiageba (so.liumingye.cn, same author as MyFreeMP3) — search + lyrics; play URLs are mostly net-disk links (auto-copied on click).
- **5sing** (5sing.kugou.com): anonymous search for originals/covers/accs, SQ→HQ→LQ direct streams, downloadable.
- **Wusun Kong** (wusunk.com): lossless collection posts; clicking a result copies the net-disk link.
- **Downloads**: the **⬇** on any search row downloads to the download dir (default `~/Music/dsh-music-player`) with lyrics (`.lrc` sidecar + USLT) and cover art (sidecar + APIC).
- **Download management**: edit metadata (ID3v2.3 rewrite + file rename), single delete (red icon + confirm bubble), and multi-select batch delete.
- **Settings**: open via **⚙** in the ••• popup (centered modal): accounts, download dir, accent color & page size (progress bar and sung lyric share the accent color), hotkeys. A single bottom save button stays fixed while content scrolls; results appear as a toast.
- **Global hotkeys** (sensible per-OS defaults, editable): macOS `⌥+←/→` prev/next, `⌥+P` play/pause, `⌥+M` cycle mode; Windows/Linux use `Ctrl+Alt+` with the same keys.
- **Search**: songs across 9 sources or playlists (NetEase, QQ, Qishui); paginated results, fixed search box.

## Install

Prerequisite: DSH desktop (DeepSeek Harness) and Node.js ≥ 20.

```bash
git clone git@github.com:qipengxiang/dsh-music-player.git
```

To install a specific version, clone its tag (see the repo tags for all versions):

```bash
git clone --branch v0.4.21 --depth 1 git@github.com:qipengxiang/dsh-music-player.git
```

Register the plugin in your DSH profile (default `~/.dsh`):

1. In the profile `package.json`, add to `dependencies`:

   ```json
   "dsh-music-player": "link:<absolute path to the cloned repo>/dsh-music-player"
   ```

2. Add `"dsh-music-player"` to the `dsh.profile.bundles` array (the plugin won't load without it).
3. Run `pnpm install` in the profile directory, then fully quit and restart DSH (`Cmd+Q` on macOS).

After install the mini player appears top-right of the title bar, and "Music player" shows up in the plugin manager list.

## Usage

1. Click **•••** to open the popup:
   - Playlist tab: local / downloaded music (＋ to add a folder or URL playlist, ▶ to play all).
   - Search tab: pick a source, search songs or playlists; **⬇** downloads.
   - Playlists·Accounts tab: manage platform logins.
2. While playing, the current lyric shows on the second title row (sung part tinted with your accent color).
3. **⚙** in the popup opens settings: accounts, download dir, accent color, hotkeys.

## Notes

- Server (`index.js`) serves `/dsh-music-player/*` routes: state persistence (`~/.dsh/dsh-music-player.json`, atomic writes), folder scanning, music-source APIs (self-implemented weapi/wbi signing), Range streaming, remote stream proxy (Referer/UA spoofing + private-address blocking).
- Client (`client.js`) renders via the `conversation.session.header.utilities` slot; lyrics attach to the `.tabs` row through a MutationObserver.
- Account cookies never leave the server-side state file.

## Self-check

```bash
node --test tests/self-check.mjs
```
