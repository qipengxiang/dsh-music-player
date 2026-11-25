window.__ModuleLoader__.load({
  id: 'dsh-music-player',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const API = '/dsh-music-player'

    const css = [
      '.dshmp{display:flex;flex-direction:column;gap:2px;align-items:flex-end;margin-top:8px;margin-bottom:-8px;font:var(--dsw-font-xxs-12,var(--dsw-font-xs-13,12px sans-serif))}',
      '.dshmp-row{display:flex;align-items:center;gap:2px;height:28px}',
      '.dshmp-cover{width:24px;height:24px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2,#dcdcdc);background:var(--dsw-alias-bg-layer-2,#8882) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:11px;flex:none;box-sizing:border-box}',
      '.dshmp-btn{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;width:28px;height:28px;border-radius:var(--dsw-radius-sm,4px);display:inline-flex;align-items:center;justify-content:center;padding:0;line-height:1;box-sizing:border-box;flex:none}',
      '.dshmp-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshmp-btn:disabled{opacity:.4;cursor:default}',
      '.dshmp-more{appearance:none;width:28px;height:28px;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;line-height:1;box-sizing:border-box;flex:none}',
      '.dshmp-more-ring{width:18px;height:18px;border:1px solid currentColor;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}',
      '.dshmp-more:hover{color:var(--dsw-alias-label-primary)}',
      '.dshmp-row2{display:flex;align-items:center;gap:6px;width:100%;height:14px}',
      '.dshmp-bar{flex:1;height:14px;display:flex;align-items:center;cursor:pointer}',
      '.dshmp-track{flex:1;height:4px;border-radius:2px;background:rgba(128,138,152,.35);overflow:hidden}',
      '.dshmp-bar-fill{height:100%;background:#8ab4f8;border-radius:2px;transition:width .2s linear}',
      '.dshmp-time{color:var(--dsw-alias-label-tertiary);font-size:10px;font-variant-numeric:tabular-nums;min-width:32px;text-align:right}',
      '.dshmp-lyric{position:absolute;top:50%;transform:translateY(calc(-50% - 5px));left:auto;right:8px;max-width:calc(100% - 16px);font:var(--dsw-font-xxs-12,12px sans-serif);color:transparent;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;text-align:left;--dshmp-lyr-pos:0%;background:linear-gradient(90deg,var(--dshmp-lyr-accent,#8ab4f8) var(--dshmp-lyr-pos),var(--dsw-alias-label-tertiary,#8a8f99) var(--dshmp-lyr-pos));-webkit-background-clip:text;background-clip:text}',
      '@property --dshmp-lyr-pos{syntax:\'<percentage>\';inherits:false;initial-value:0%}',
      '.dshmp-covertip{position:fixed;z-index:95;background:var(--dsw-alias-bg-layer-2,#2e2f33);color:var(--dsw-alias-label-primary,#fff);padding:4px 10px;border-radius:6px;font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 4px 14px rgb(0 0 0/.22);pointer-events:none}',
      '.dshmp-pop{position:fixed;z-index:80;width:min(400px,92vw);max-height:min(460px,70vh);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:var(--dsw-radius-md,8px);box-shadow:0 8px 24px rgb(0 0 0/.16);overflow:hidden}',
      '.dshmp-pop-head{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,#eee);font:var(--dsw-font-xs-13,13px sans-serif);color:var(--dsw-alias-label-primary);min-height:20px}',
      '.dshmp-pop-head .grow{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshmp-pop-set{margin-left:auto;flex:none}',
      '.dshmp-setmodal{width:min(560px,92vw);max-height:min(620px,86vh)}',
      '.dshmp-srcmodal{width:min(720px,92vw);max-height:min(680px,88vh)}',
      '.dshmp-codebox{position:relative;flex:1;min-height:320px;border:1px solid var(--dsw-alias-border-l2,#dcdcdc);border-radius:var(--dsw-radius-sm,4px);overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff)}',
      '.dshmp-codehl,.dshmp-codehl code,.dshmp-codeta{margin:0;padding:10px 12px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;tab-size:2;white-space:pre-wrap;word-break:break-all;overflow:auto;box-sizing:border-box}',
      '.dshmp-codehl{position:absolute;inset:0;pointer-events:none;color:var(--dsw-alias-label-primary,#333)}',
      '.dshmp-codeta{position:relative;width:100%;height:100%;min-height:320px;border:none;background:0 0;color:transparent;caret-color:var(--dsw-alias-label-primary,#333);resize:none;outline:none}',
      '.dshmp-tok-c{color:var(--dsw-alias-label-tertiary,#6a737d);font-style:italic}',
      '.dshmp-tok-s{color:#a31585}',
      '.dshmp-tok-k{color:#0000c0;font-weight:600}',
      '.dshmp-tok-n{color:#098658}',
      '.dshmp-srclist{display:flex;flex-direction:column;gap:2px}',
      '.dshmp-srclist .hd{display:flex;align-items:center;gap:6px;padding:0 6px 2px;border-bottom:1px solid var(--dsw-alias-border-l2,#eee)}',
      '.dshmp-srclist{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dshmp-srclist .rw{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:var(--dsw-radius-sm,4px)}',
      '.dshmp-srclist .rw:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshmp-srclist .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshmp-srclist .v,.dshmp-srclist .a{flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}',
      '.dshmp-srclist .v{width:86px}',
      '.dshmp-srclist .a{width:120px}',
      '.dshmp-srclist .o{flex:none;display:flex;gap:4px;align-items:center}',
      // 保存条走常规流式布局（不悬浮、不遮挡）：外层限高后，内容区自身滚动，保存条始终占位在底部。
      '.dshmp-setwrap{flex:1;min-height:0;display:flex;flex-direction:column;max-height:100%}',
      '.dshmp-setwrap .dshmp-settings{flex:1;min-height:0;overflow:auto;padding:10px 12px}',
      '.dshmp-setfoot{flex:none;display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l2,#eee)}',
      '.dshmp-setfoot .grow{flex:1}',
      '.dshmp-toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:130;background:rgba(28,30,34,.94);color:#eee;font-size:12px;line-height:1.2;padding:8px 14px;border-radius:8px;pointer-events:none;opacity:0;transition:opacity .18s;box-shadow:0 4px 14px rgb(0 0 0/.4);max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshmp-toast.on{opacity:1}',
      '.dshmp-pop-x{flex:none}',
      '.dshmp-tabs{display:flex;gap:2px;padding:6px 8px 0}',
      '.dshmp-tab{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:4px 8px;border-radius:var(--dsw-radius-sm,4px);font-size:12px}',
      '.dshmp-tab.on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshmp-subtabs{display:flex;gap:2px;margin-bottom:6px;padding-bottom:2px;border-bottom:1px solid var(--dsw-alias-border-l2,#333)}',
      '.dshmp-subtabs .dshmp-addbtn{margin-left:auto}',
      '.dshmp-body{flex:1;overflow:auto;padding:8px 10px;display:flex;flex-direction:column;gap:4px}',
      '.dshmp-tab-fill{flex:1;min-height:0;display:flex;flex-direction:column;gap:4px}',
      '.dshmp-tab-scroll{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:4px}',
      '.dshmp-pager{display:flex;align-items:center;justify-content:center;gap:6px;padding-top:2px}',
      '.dshmp-pgnum{font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.dshmp-modal{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgb(0 0 0/.32)}',
      '.dshmp-foot{display:flex;align-items:center;gap:8px;padding:6px 10px;border-top:1px solid var(--dsw-alias-border-l2,#eee)}',
      '.dshmp-rowitem{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:var(--dsw-radius-sm,4px);cursor:pointer;font-size:12px;color:var(--dsh-alias-label-secondary,var(--dsw-alias-label-secondary))}',
      '.dshmp-rowitem:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshmp-rowitem .t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshmp-rowitem .sub{color:var(--dsw-alias-label-tertiary);font-size:11px;flex:none;width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshmp-rowitem .x{flex:none;opacity:.55;font-size:11px}',
      '.dshmp-rowitem .x:hover{opacity:1;color:var(--dsh-alias-state-danger,var(--dsw-alias-state-danger,#e54d42))}',
      '.dshmp-rowitem.playing .t{color:var(--dsw-alias-state-business-primary)}',
      '.dshmp-input{appearance:none;border:1px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm,4px);padding:5px 8px;font-size:12px;outline:none;flex:1;min-width:0}',
      '.dshmp-input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.dshmp-inputarea{resize:vertical;min-height:64px;font-family:inherit}',
      '.dshmp-caprow{display:flex;gap:6px;align-items:center}',
      '.dshmp-capimg{height:34px;width:100px;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:4px;object-fit:cover;cursor:pointer;flex:none}',
      '.dshmp-mini{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:4px 8px;border-radius:var(--dsw-radius-sm,4px);font-size:12px;flex:none}',
      '.dshmp-mini:disabled{opacity:.4;cursor:default}',
      '.dshmp-vip{display:inline-block;font-size:10px;line-height:1;padding:2px 3px;margin-right:5px;border-radius:3px;color:#e6a23c;border:1px solid currentColor;vertical-align:1px;flex:none}',
      '.dshmp-tag{display:inline-block;font-size:10px;line-height:1;padding:2px 4px;margin-right:5px;border-radius:3px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2,#c8c8c8);vertical-align:1px;flex:none}',
      '.dshmp-dur{flex:none;width:40px;font-size:11px;color:var(--dsw-alias-label-tertiary,#999);text-align:right;white-space:nowrap}',
      '.dshmp-thead{display:flex;align-items:center;gap:6px;padding:0 6px 2px;border-bottom:1px solid var(--dsw-alias-border-l2,#eee);flex:none}',
      '.dshmp-th{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;cursor:pointer;padding:2px 0;text-align:left;flex:none;white-space:nowrap}',
      '.dshmp-th:hover{color:var(--dsw-alias-label-primary)}',
      '.dshmp-th.t{flex:1;overflow:hidden;text-overflow:ellipsis}',
      '.dshmp-th.s{width:96px}',
      '.dshmp-th.r{width:52px}',
      '.dshmp-src{flex:none;width:52px;font-size:11px;color:var(--dsw-alias-label-tertiary,#999);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshmp-th.d{width:40px;text-align:right}',
      '.dshmp-th.act{width:64px;text-align:right}',
      '.dshmp-act{flex:none;width:64px;display:flex;align-items:center;justify-content:flex-end;gap:2px;overflow:hidden}',
      '.dshmp-act2{display:flex;align-items:center;gap:2px;flex:none}',
      '.dshmp-libline{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.dshmp-xbtn{appearance:none;border:none;background:0 0;color:inherit;cursor:pointer;padding:0 0 0 2px;font-size:10px;line-height:1;opacity:.7}',
      '.dshmp-xbtn:hover{opacity:1;color:var(--dsw-alias-state-danger,#e54d42)}',
      '.dshmp-delwrap{position:relative;flex:none;display:inline-flex}',
      '.dshmp-delbtn{appearance:none;border:none;background:0 0;cursor:pointer;padding:3px;border-radius:var(--dsw-radius-sm,4px);color:var(--dsh-alias-state-danger,var(--dsw-alias-state-danger,#e54d42));display:inline-flex;align-items:center;justify-content:center}',
      '.dshmp-delbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshmp-delbtn svg{width:14px;height:14px;display:block}',
      '.dshmp-popconfirm{position:fixed;z-index:120;max-height:60vh;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:10px 12px;min-width:176px;background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:var(--dsw-radius-md,8px);box-shadow:0 6px 18px rgb(0 0 0/.18);font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap}',
      '.dshmp-popconfirm-btns{display:flex;gap:6px;justify-content:flex-end}',
      '.dshmp-mini.danger{color:#fff;background:var(--dsh-alias-state-danger,var(--dsw-alias-state-danger,#e54d42));font-weight:600}',
      '.dshmp-mini.danger:hover{background:var(--dsh-alias-state-danger,var(--dsw-alias-state-danger,#e54d42));filter:brightness(.9)}',
      '.dshmp-chk{flex:none;width:14px;height:14px;margin:0;cursor:pointer;accent-color:var(--dsh-alias-state-business-primary,var(--dsw-alias-state-business-primary,#4f46e5))}',
      '.dshmp-mini:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshmp-mini.primary{color:var(--dsw-alias-state-business-primary);font-weight:600}',
      '.dshmp-acct{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:var(--dsw-radius-sm,4px);cursor:pointer;font-size:12px}',
      '.dshmp-acct:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshmp-acct .ic{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex:none;background:var(--dsh-alias-state-business-primary,var(--dsw-alias-state-business-primary,#4f46e5));color:#fff}',
      '.dshmp-acct.off .ic{background:var(--dsw-alias-bg-layer-2,#8883);color:var(--dsw-alias-label-tertiary)}',
      '.dshmp-acct .ic img{width:20px;height:20px;border-radius:3px;object-fit:contain}',
      '.dshmp-acct .ic.has-logo{background:var(--dsw-alias-bg-layer-2,#8882)}',
      // App Store 风格下载圆环按钮
      '.dshmp-dl{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:2px;flex:none;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%}',
      '.dshmp-ply{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:2px;flex:none;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%}',
      '.dshmp-ply:hover{background:rgba(128,138,152,.16);color:var(--dsw-alias-label-primary)}',
      '.dshmp-ply svg{width:14px;height:14px;display:block}',
      '.dshmp-dl:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshmp-dl svg{width:26px;height:26px;transform:rotate(-90deg);display:block}',
      '.dshmp-dl .trk{stroke:rgba(128,138,152,.32)}',
      '.dshmp-dl .arc{stroke:#8ab4f8;transition:stroke-dashoffset .35s linear}',
      '.dshmp-dl .box{fill:#5b8def}',
      '.dshmp-dl .arr,.dshmp-dl .chk{stroke:#fff;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}',
      '.dshmp-dl.indet svg{animation:dshmp-spin 1s linear infinite}',
      '.dshmp-dl.indet .arc{stroke-dasharray:30 73}',
      '@keyframes dshmp-spin{from{transform:rotate(-90deg)}to{transform:rotate(270deg)}}',
      '.dshmp-dl.done .box{fill:#34a853}',
      // 设置页“打开下载目录”按钮
      '.dshmp-folderbtn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--dsw-alias-border-l2,#c8ced9);border-radius:6px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);flex:none}',
      '.dshmp-folderbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshmp-folderbtn svg{width:16px;height:16px;fill:currentColor}',
      '.dshmp-acct .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshmp-acct.off .nm{color:var(--dsw-alias-label-tertiary)}',
      '.dshmp-qr{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px}',
      '.dshmp-qr img{width:200px;height:200px;border-radius:8px;background:#fff;padding:6px}',
      '.dshmp-section{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-top:4px}',
      '.dshmp-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center;padding:14px 0}',
      '.dshmp-settings{max-width:640px;display:flex;flex-direction:column;gap:18px}',
      '.dshmp-settings h3{margin:0;font-size:16px}',
      '.dshmp-set-block{display:flex;flex-direction:column;gap:6px}',
      '.dshmp-settings .dshmp-section{font-size:14px;font-weight:700;color:var(--dsw-alias-label-primary);margin-top:0}',
      '.dshmp-set-block>.dshmp-section{margin-bottom:2px}',
      '.dshmp-set-field{display:grid;grid-template-columns:72px 1fr;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dshmp-editbox{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:8px;padding:10px}',
    ].join('')
    const tagId = 'dsh-music-player/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-music-player'
      tag.dataset.pluginCss = tagId
      tag.textContent = css
      document.head.appendChild(tag)
    }

    // ---------- pure helpers (also exercised by tests/self-check.mjs) ----------

    function parseLrc(text) {
      const out = []
      const tag = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g
      for (const line of String(text ?? '').split(/\r?\n/)) {
        if (!line.includes('[')) continue
        const times = []
        let m
        tag.lastIndex = 0
        while ((m = tag.exec(line))) times.push(Number(m[1]) * 60 + Number(m[2].replace(':', '.')))
        if (times.length === 0) continue
        const text2 = line.replace(tag, '').trim()
        for (const t of times) out.push({ t, text: text2 })
      }
      return out.sort((a, b) => a.t - b.t)
    }

    function fmtTime(sec) {
      const s = Math.max(0, Math.floor(Number(sec) || 0))
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    }

    /** JS 源码高亮：注释/字符串/关键字/数字着色，HTML 转义防注入（无正则字面量识别，避免误切字符串）。 */
    function highlightJs(code) {
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const re = /(\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(const|let|var|function|return|if|else|for|while|new|typeof|instanceof|class|extends|async|await|try|catch|finally|throw|switch|case|break|continue|default|delete|in|of|do|this|null|undefined|true|false|void|yield|static)\b|(\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?\b)/g
      let out = '', last = 0, m
      while ((m = re.exec(code))) {
        if (m.index > last) out += esc(code.slice(last, m.index))
        const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n'
        out += `<span class="dshmp-tok-${cls}">${esc(m[0])}</span>`
        last = m.index + m[0].length
      }
      return out + esc(code.slice(last))
    }

    /** Coerce pager input (may be a MouseEvent from onClick: doSearch) to a sane page number. */
    function safePage(v) {
      return Math.max(1, parseInt(v, 10) || 1)
    }

    /** Pure next-index policy: order wraps, shuffle never repeats the current track. */
    function pickNextIndex(mode, index, length, rand = Math.random) {
      if (length <= 0) return -1
      if (length === 1) return 0
      if (mode === 'shuffle') {
        let i = index
        for (let guard = 0; i === index && guard < 32; guard += 1) i = Math.floor(rand() * length)
        return i === index ? (index + 1) % length : i
      }
      return (index + 1) % length
    }

    // ---------- store ----------

    const store = {
      state: { playlists: [], settings: { mode: 'order' }, accounts: {} },
      current: null, // {list, index}
      playing: false,
      t: 0,
      dur: 0,
      lyric: [],
      error: '',
      pop: null, // 'list' | 'search' | 'account' | {login:platform} | {qr:...}
      listeners: new Set(),
    }
    function emit() {
      for (const fn of store.listeners) fn()
    }
    function useStore() {
      const [, force] = useState(0)
      useEffect(() => {
        const fn = () => force((x) => x + 1)
        store.listeners.add(fn)
        return () => { store.listeners.delete(fn) }
      }, [])
      return store
    }

    async function api(path, opts) {
      const res = await fetch(API + path, { ...opts, headers: { 'content-type': 'application/json', ...(opts?.headers ?? {}) } })
      const json = await res.json().catch(() => ({ error: '响应异常' }))
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      return json
    }

    // ---------- audio ----------

    // One player at a time across windows: whoever starts playing silences the others.
    const winId = Math.random().toString(36).slice(2)
    // unref so a live channel doesn't keep a bare node process (self-check) from exiting
    const playChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('dsh-music-player') : null
    playChannel?.unref?.()
    // The host may re-evaluate this chunk (hot reload, extra copy); the shared audio element
    // must report events to whichever copy is currently rendered, not the one that bound first.
    globalThis.__dshmpLive = { store, emit, winId, playChannel, nextTrack }
    const live = () => globalThis.__dshmpLive
    if (playChannel) {
      playChannel.onmessage = (e) => {
        if (e.data?.pauseFrom && e.data.pauseFrom !== live().winId) { audio?.pause(); live().store.playing = false; live().emit() }
      }
    }

    let audio = null
    function getAudio() {
      if (audio === null && typeof Audio !== 'undefined') {
        // One element for the whole renderer: a second copy of this bundle (extra window,
        // re-evaluated chunk) then reuses it instead of starting a competing stream.
        audio = globalThis.__dshmpAudio ?? (globalThis.__dshmpAudio = new Audio())
        audio.preload = 'metadata'
        if (audio.__dshmpBound) return audio
        audio.__dshmpBound = true
        audio.addEventListener('play', () => { const L = live(); L.store.playing = true; L.playChannel?.postMessage({ pauseFrom: L.winId }); L.emit() })
        // server-side lock: covers windows the BroadcastChannel can't reach (cross-partition)
        setInterval(() => {
          if (audio.paused) return
          fetch(`${API}/play-owner`).then(r => r.json()).then((o) => {
            if (o.winId && o.winId !== live().winId && !audio.paused) { audio.pause(); live().store.playing = false; live().emit() }
          }).catch(() => {})
        }, 2000)
        audio.addEventListener('pause', () => { const L = live(); L.store.playing = false; L.emit() })
        audio.addEventListener('loadedmetadata', () => { const L = live(); L.store.dur = audio.duration || 0; L.emit() })
        audio.addEventListener('timeupdate', () => { const L = live(); L.store.t = audio.currentTime; L.store.playing = !audio.paused; L.emit() })
        audio.addEventListener('ended', () => {
          const L = live()
          if ((L.store.state.settings.mode ?? 'order') === 'single' && audio) {
            audio.currentTime = 0
            void audio.play()
          } else {
            L.nextTrack(1, true)
          }
        })
        audio.addEventListener('error', () => { const L = live(); L.store.playing = false; L.store.error = '播放失败'; L.emit() })
      }
      return audio
    }

    async function resolveUrl(track) {
      try {
        if (track.source === 'local' || track.source === 'custom') return `${API}/stream?u=${encodeURIComponent(track.url)}`
        const r = await fetch(`${API}/song-url?source=${encodeURIComponent(track.source)}&id=${encodeURIComponent(track.id)}&title=${encodeURIComponent(track.title ?? '')}&artist=${encodeURIComponent(track.artist ?? '')}`)
        const j = await r.json()
        if (r.ok && j.url && j.preview) showToast('汽水 VIP 歌曲，仅播放试听片段')
        return r.ok && j.url ? j.url : ''
      } catch {
        return ''
      }
    }

    /** Local .lrc files are often GBK; decode the raw bytes rather than trusting an utf-8 read. */
    function decodeBytes(bytes) {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        return new TextDecoder('gb18030').decode(bytes)
      }
    }

    async function loadLyric(track) {
      store.lyric = []
      try {
        if (track.lrcPath) {
          const raw = await fetch(`${API}/file?p=${encodeURIComponent(track.lrcPath)}`)
          if (raw.ok) store.lyric = parseLrc(decodeBytes(new Uint8Array(await raw.arrayBuffer())))
        } else {
          const r = await fetch(`${API}/lyrics?source=${encodeURIComponent(track.source)}&id=${encodeURIComponent(track.id)}`)
          const j = await r.json()
          store.lyric = parseLrc(j.lrc)
        }
      } catch { /* no lyric is fine */ }
      emit()
    }

    async function playTrack(list, index) {
      const track = list[index]
      if (!track) return
      const same = store.current?.list === list && store.current?.index === index
      store.current = { list, index }
      store.error = ''
      if (!same) { // re-clicking the current track must not zero the playhead it is playing at
        store.t = 0
        store.dur = track.duration || 0
        store.lyric = []
      }
      emit()
      const url = await resolveUrl(track)
      if (!store.current || store.current.list[store.current.index] !== track) return
      if (!url) {
        getAudio()?.pause()
        store.error = '无法获取播放地址'
        store.playing = false
        emit()
        return
      }
      const a = getAudio()
      if (!a) return
      if ((globalThis.__dshmpLoadedUrl ?? '') !== url) {
        a.pause() // stop the previous stream before the new one starts
        globalThis.__dshmpLoadedUrl = url
        a.src = url
      }
      try {
        await a.play()
        fetch(`${API}/play-start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ winId }) }).catch(() => {})
        store.playing = !a.paused
        emit()
      } catch {
        store.playing = false
        emit()
      }
      loadLyric(track)
    }

    const MODE_ORDER = ['order', 'shuffle', 'single']
    const MODE_LABEL = { order: '顺序播放', shuffle: '随机播放', single: '单曲循环' }

    function nextMode(mode) {
      return MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length]
    }

    async function cycleMode() {
      const next = nextMode(store.state.settings.mode ?? 'order')
      try {
        store.state = await api('/settings', { method: 'POST', body: JSON.stringify({ mode: next }) })
      } catch (e) {
        store.error = String(e?.message ?? e)
      }
      emit()
    }

    // 快捷键组合的规范表示：[Alt+][Ctrl+][Meta+][Shift+]KEY
    const NAMED_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Tab', 'MediaTrackPrevious', 'MediaTrackNext', 'MediaPlayPause', 'MediaStop'])
    function comboOf(e) {
      const k = e && e.key
      if (!k || k === 'Alt' || k === 'Control' || k === 'Shift' || k === 'Meta') return null
      // 键面取物理 e.code：mac 的 ⌥+字母会把 e.key 变成特殊字符（⌥P=π），物理键位才能与默认快捷键对上
      let name = ''
      const c = e.code || ''
      if (c.startsWith('Key')) name = c.slice(3)
      else if (c.startsWith('Digit')) name = c.slice(5)
      else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(c)) name = c
      else if (NAMED_KEYS.has(c)) name = c
      if (!name) name = k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k
      const mods = [e.altKey && 'Alt', e.ctrlKey && 'Ctrl', e.metaKey && 'Meta', e.shiftKey && 'Shift'].filter(Boolean)
      return [...mods, name].join('+')
    }

    function togglePlay() {
      const a = getAudio()
      const tr = store.current && store.current.list[store.current.index]
      if (!a || !tr) return
      if (a.paused) void a.play()
      else { a.pause(); store.playing = false; emit() }
    }

    function accentOf() {
      return (store.state.settings && store.state.settings.accent) || '#8ab4f8'
    }

    let coverTipEl = null
    function showCoverTip(rect, text) {
      hideCoverTip()
      if (!text || typeof document === 'undefined') return
      const tip = document.createElement('div')
      tip.className = 'dshmp-covertip'
      tip.textContent = text
      document.body.appendChild(tip)
      const w = tip.offsetWidth
      const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - 8 - w)
      tip.style.left = `${Math.max(0, left)}px`
      tip.style.top = `${Math.max(4, rect.top - 30)}px`
      coverTipEl = tip
    }
    function hideCoverTip() {
      if (coverTipEl) { coverTipEl.remove(); coverTipEl = null }
    }
    // 项目 LOGO：与设置按钮同款空心齿轮（Feather settings）
    const GearIcon = ({ size = 15 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('circle', { cx: 12, cy: 12, r: 3 }),
        h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' }))
    const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || navigator.userAgent || '')
    // 项目 LOGO：黑白空心音符（与设置页侧边栏图标同一字形）
    const NoteGlyph = ({ size = 16 }) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M9 18V6l10-2v12' }),
      h('circle', { cx: 6.5, cy: 18, r: 2.5 }),
      h('circle', { cx: 16.5, cy: 16, r: 2.5 }))
    let toastTimer = 0
    function showToast(text) {
      if (!text || typeof document === 'undefined') return
      let el = document.querySelector('.dshmp-toast')
      if (!el) { el = document.createElement('div'); el.className = 'dshmp-toast'; document.body.appendChild(el) }
      el.textContent = text
      el.classList.add('on')
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { const t = document.querySelector('.dshmp-toast'); if (t) t.classList.remove('on') }, 1900)
    }

    function modeIcon(mode) {
      const box = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'currentColor', 'aria-hidden': 'true' }
      const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }
      if (mode === 'shuffle') {
        return h('svg', box,
          h('path', { ...line, d: 'M3 6h3l12 12h3' }), h('path', { ...line, d: 'M18.6 15.4 21 18l-2.4 2.6' }),
          h('path', { ...line, d: 'M3 18h3l12-12h3' }), h('path', { ...line, d: 'M18.6 3.4 21 6l-2.4 2.6' }))
      }
      if (mode === 'single') {
        return h('svg', box,
          h('circle', { ...line, cx: 12, cy: 12, r: 8.4 }),
          h('path', { ...line, d: 'M12.6 7.6v8.8' }), h('path', { ...line, d: 'M10 9.4 12.6 7.6' }))
      }
      // 顺序播放：列表三行 + 右下播放三角
      return h('svg', box,
        h('path', { d: 'M3 4.6h12.5v2.6H3z' }), h('path', { d: 'M3 9.2h12.5v2.6H3z' }), h('path', { d: 'M3 13.8h8.5v2.6H3z' }),
        h('path', { d: 'M14.4 12.6 21 17.2 14.4 21.8z' }))
    }

    function nextTrack(delta = 1, auto = false) {
      const cur = store.current
      if (!cur) return
      if (delta === 1 && auto && (store.state.settings.mode ?? 'order') === 'single') return
      const i = pickNextIndex(store.state.settings.mode ?? 'order', cur.index, cur.list.length)
      if (i >= 0) playTrack(cur.list, i)
    }
    function prevTrack() {
      const cur = store.current
      if (!cur) return
      if (store.t > 3 && getAudio()) {
        getAudio().currentTime = 0
        return
      }
      playTrack(cur.list, (cur.index - 1 + cur.list.length) % cur.list.length)
    }

    function lyricLineAt(t) {
      let idx = -1
      for (let i = 0; i < store.lyric.length; i += 1) {
        if (store.lyric[i].t <= t + 0.08) idx = i
        else break
      }
      return idx
    }

    // ---------- lyrics strip (plain DOM: the tabs row has no slot) ----------

    function mountLyrics() {
      if (typeof document === 'undefined') return () => {}
      const ensure = () => {
        const tabs = document.querySelector('[data-conversation-tabs]')
        const row = tabs && tabs.parentElement
        if (!row || row.querySelector('.dshmp-lyric')) return
        const el = document.createElement('div')
        el.className = 'dshmp-lyric'
        el.style.display = 'none'
        row.appendChild(el)
      }
      ensure()
      const observer = new MutationObserver(ensure)
      observer.observe(document.body, { childList: true, subtree: true })
      // 用音频真实进度逐帧刷新：4Hz 的 timeupdate 跟不上人声，渐变会落后半拍
      const audioTime = () => {
        const a = typeof globalThis !== 'undefined' ? globalThis.__dshmpAudio : null
        if (a && !a.paused && Number.isFinite(a.currentTime)) return a.currentTime
        return store.t
      }
      const update = () => {
        const el = document.querySelector('.dshmp-lyric')
        if (!el) return
        const track = store.current && store.current.list[store.current.index]
        if (!track || !store.playing) {
          el.style.display = 'none'
          el.textContent = ''
          return
        }
        el.style.display = ''
        const t = audioTime()
        const idx = lyricLineAt(t)
        const hasLyr = store.lyric.length > 0
        const line =
          (hasLyr && (store.lyric[idx]?.text ?? store.lyric[0].text)) ||
          `${track.title}${track.artist ? ' - ' + track.artist : ''} · 无歌词`
        // 当前行内的已播比例：换行时直接归零，不做插值回退
        let frac = 0
        if (hasLyr && idx >= 0) {
          const cur = store.lyric[idx]
          const end = store.lyric[idx + 1]?.t ?? (store.dur > cur.t ? store.dur : cur.t + 6)
          frac = end > cur.t ? Math.min(1, Math.max(0, (t - cur.t) / (end - cur.t))) : 1
        }

        if (el.textContent !== line) el.textContent = line
        el.style.setProperty('--dshmp-lyr-accent', accentOf())
        el.style.setProperty('--dshmp-lyr-pos', `${(frac * 100).toFixed(1)}%`)
        const align = typeof window !== 'undefined' && window.__dshmpAlign
        if (align && align.left != null && el.parentElement) {
          const left = align.left - el.parentElement.getBoundingClientRect().left
          el.style.left = `${Math.max(0, left)}px`
        }
      }
      let raf = 0
      const tick = () => {
        raf = 0
        update()
        const a = typeof globalThis !== 'undefined' ? globalThis.__dshmpAudio : null
        if (store.playing && a && !a.paused && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick)
      }
      const kick = () => {
        if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick)
        else if (raf) return
        else update()
      }
      store.listeners.add(kick)
      return () => {
        observer.disconnect()
        if (raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf)
        store.listeners.delete(kick)
        document.querySelector('.dshmp-lyric')?.remove()
      }
    }

    // ---------- mini player ----------

    function seek(e) {
      const a = getAudio()
      const total = store.dur || a?.duration || 0
      if (!a || !total) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      a.currentTime = ratio * total
      store.t = a.currentTime
      emit()
    }

    let clientCtx = null

    function MiniPlayer() {
      const s = useStore()
      const ref = useRef(null)
      // 播放/切模式等错误统一走 toast，不再占播放器右侧的空间
      useEffect(() => {
        if (s.error) { showToast(s.error); store.error = '' }
      }, [s.error])
      useEffect(() => {
        const done = mountLyrics()
        ;(async () => {
          try {
            store.state = await api('/state')
            emit()
          } catch { /* state fetch failed: player shows empty */ }
        })()
        // 全局快捷键：上一曲 / 下一曲 / 播放暂停 / 切换播放模式
        const onHotkey = (e) => {
          const hk = store.state.settings.hotkeys || {}
          const t = e.target
          if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
          const combo = comboOf(e)
          if (!combo) return
          if (combo === hk.prev) { e.preventDefault(); prevTrack() }
          else if (combo === hk.next) { e.preventDefault(); nextTrack(1) }
          else if (combo === hk.toggle) { e.preventDefault(); togglePlay() }
          else if (combo === hk.mode) { e.preventDefault(); void cycleMode() }
        }
        window.addEventListener('keydown', onHotkey)
        return () => {
          window.removeEventListener('keydown', onHotkey)
          done()
        }
      }, [])
      useEffect(() => {
        const report = () => {
          const el = ref.current
          if (!el) return
          const rect = el.getBoundingClientRect()
          if (typeof window !== 'undefined') window.__dshmpAlign = { left: rect.left, width: rect.width }
        }
        report()
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(report) : null
        if (ro && ref.current) ro.observe(ref.current)
        window.addEventListener('resize', report)
        const timer = setInterval(report, 2000)
        return () => {
          if (ro) ro.disconnect()
          window.removeEventListener('resize', report)
          clearInterval(timer)
        }
      }, [])
      const track = s.current && s.current.list[s.current.index]
      const dur = s.dur || track?.duration || 0
      const pct = dur > 0 ? Math.min(1, s.t / dur) : 0
      return h('div', { ref, className: 'dshmp' },
        h('div', { className: 'dshmp-row' },
          h('div', {
            className: 'dshmp-cover',
            style: track && track.cover ? { backgroundImage: `url("${API}/stream?u=${encodeURIComponent(track.cover)}")` } : undefined,
            onMouseEnter: (e) => showCoverTip(e.currentTarget.getBoundingClientRect(), track ? `${track.title}${track.artist ? ' - ' + track.artist : ''}` : ''),
            onMouseLeave: hideCoverTip,
          }, track && track.cover ? null : h(NoteGlyph, { size: 16 })),
          h('button', { className: 'dshmp-btn', title: '上一曲', onClick: prevTrack },
            h('svg', { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'currentColor', 'aria-hidden': 'true' },
              h('path', { d: 'M2.2 2.6h3.1v18.8H2.2z' }),
              h('path', { d: 'M22 2.6 7.7 12 22 21.4z' }))),
          h('button', {
            className: 'dshmp-btn', title: '播放/暂停',
            onClick: togglePlay,
          }, s.playing
            ? h('svg', { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'currentColor', 'aria-hidden': 'true' },
                h('path', { d: 'M5.6 2.6h4.6v18.8H5.6zM13.8 2.6h4.6v18.8h-4.6z' }))
            : h('svg', { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'currentColor', 'aria-hidden': 'true' },
                h('path', { d: 'M4.6 2.2 21.6 12 4.6 21.8z' }))),
          h('button', { className: 'dshmp-btn', title: '下一曲', onClick: () => nextTrack(1) },
            h('svg', { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'currentColor', 'aria-hidden': 'true' },
              h('path', { d: 'M18.7 2.6h3.1v18.8h-3.1z' }),
              h('path', { d: 'M2 2.6 16.3 12 2 21.4z' }))),
          h('button', {
            className: 'dshmp-btn', title: `播放模式：${MODE_LABEL[s.state.settings.mode ?? 'order']}`,
            onClick: cycleMode,
          }, modeIcon(s.state.settings.mode ?? 'order')),
          h('button', {
            className: 'dshmp-more', title: '更多',
            onClick: (e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              if (typeof window !== 'undefined') window.__dshmpMoreRect = { right: rect.right, bottom: rect.bottom }
              store.pop = store.pop ? null : 'list'
              emit()
            },
          }, h('span', { className: 'dshmp-more-ring' },
            h('svg', { viewBox: '0 0 16 16', width: '11', height: '11', fill: 'currentColor', 'aria-hidden': 'true' },
              h('circle', { cx: '3.2', cy: '8', r: '1.35' }),
              h('circle', { cx: '8', cy: '8', r: '1.35' }),
              h('circle', { cx: '12.8', cy: '8', r: '1.35' })))),
          h(Pop)),
        h('div', { className: 'dshmp-row2', style: track ? null : { visibility: 'hidden' } },
          h('div', { className: 'dshmp-bar', onClick: seek },
            h('div', { className: 'dshmp-track' },
              h('div', { className: 'dshmp-bar-fill', style: { width: `${(pct * 100).toFixed(1)}%`, background: s.state.settings.accent || undefined } }))),
          h('span', { className: 'dshmp-time' }, `-${fmtTime(dur - s.t)}`)))
    }

    // ---------- pop panel ----------

    const TABS = [['list', '播放列表'], ['search', '搜索'], ['account', '歌单/账号']]

    // 歌曲列表分页：默认每页 10 条，条数在设置页可配
    function Pager({ total, page, onChange }) {
      const ps = store.state.settings.pageSize || 10
      const pages = Math.max(1, Math.ceil(total / ps))
      if (pages <= 1) return null
      return h('div', { className: 'dshmp-pager' },
        h('button', { className: 'dshmp-mini', disabled: page <= 1, onClick: () => onChange(page - 1) }, '‹ 上一页'),
        h('span', { className: 'dshmp-pgnum' }, `${page} / ${pages}`),
        h('button', { className: 'dshmp-mini', disabled: page >= pages, onClick: () => onChange(page + 1) }, '下一页 ›'))
    }
    function pageSlice(arr, page) {
      const ps = store.state.settings.pageSize || 10
      return (arr ?? []).slice((page - 1) * ps, page * ps)
    }

    // 列头排序：key=title|artist|duration，dir=1 升序 / -1 降序
    // 来源列取值：下载记录用 origin（下载时的渠道），其余用 source
    function rowSource(t) { return sourceLabel(t?.origin || t?.source || 'local') }

    function sortRows(rows, sort) {
      if (!sort || !sort.key) return rows
      const dir = sort.dir < 0 ? -1 : 1
      const val = (r) => (sort.key === 'duration' ? Number(r?.duration) || 0 : sort.key === 'source' ? rowSource(r) : String(r?.[sort.key] ?? ''))
      return rows
        .map((r, i) => [r, i])
        .sort((a, b) => {
          const x = val(a[0]), y = val(b[0])
          const c = typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y), 'zh-Hans-CN')
          return c * dir || a[1] - b[1]
        })
        .map((pair) => pair[0])
    }
    function nextSort(sort, key) {
      if (sort.key !== key) return { key, dir: 1 }
      return sort.dir >= 0 ? { key, dir: -1 } : { key: '', dir: 1 }
    }
    function TrackHead({ sort, onSort, action }) {
      const mark = (k) => (sort.key === k ? (sort.dir < 0 ? ' ▼' : ' ▲') : '')
      return h('div', { className: 'dshmp-thead' },
        h('button', { className: 'dshmp-th t', onClick: () => onSort('title') }, '歌名' + mark('title')),
        h('button', { className: 'dshmp-th s', onClick: () => onSort('artist') }, '歌手' + mark('artist')),
        h('button', { className: 'dshmp-th r', onClick: () => onSort('source') }, '来源' + mark('source')),
        h('button', { className: 'dshmp-th d', onClick: () => onSort('duration') }, '时长' + mark('duration')),
        h('span', { className: 'dshmp-th act' }, action || ''))
    }
    // 多选时的勾选框放最右侧（与列头「选择」对齐），其余情况该列放操作按钮
    function SongRow({ t, playing, src, sub, chk, actions, onClick }) {
      return h('div', { className: 'dshmp-rowitem' + (playing ? ' playing' : ''), onClick },
        h('span', { className: 't' }, t.vip ? h('span', { className: 'dshmp-vip' }, 'VIP') : null, t.title),
        h('span', { className: 'sub' }, sub ?? (t.artist || '')),
        h('span', { className: 'dshmp-src' }, src ?? rowSource(t)),
        h('span', { className: 'dshmp-dur' }, t.duration ? fmtTime(t.duration) : ''),
        h('span', { className: 'dshmp-act' }, chk ?? null, actions ?? null))
    }
    // 列头里的全选勾选框：部分选中显示为半选
    function CheckAll({ all, some, onChange }) {
      return h('input', {
        className: 'dshmp-chk', type: 'checkbox', title: all ? '取消全选' : '全选',
        checked: all, onChange,
        ref: (el) => { if (el) el.indeterminate = !all && some },
      })
    }

    const TrashIcon = () => h('svg', { viewBox: '0 0 24 24', width: '14', height: '14', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
      h('path', { d: 'M3 6h18' }),
      h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
      h('path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
      h('line', { x1: 10, y1: 11, x2: 10, y2: 17 }),
      h('line', { x1: 14, y1: 11, x2: 14, y2: 17 }))

    function isCurrent(t) {
      const cur = store.current
      const tr = cur && cur.list && cur.list[cur.index]
      return !!(tr && t && ((t.id != null && tr.id === t.id) || (tr.title === t.title && tr.artist === t.artist)))
    }

    // 删除气泡确认：fixed 定位，脱离所有滚动容器的裁剪，保证一定可见
    function PopConfirm({ label, title, btnClass, hint, disabled, onConfirm }) {
      const [open, setOpen] = useState(false)
      const [pos, setPos] = useState(null)
      const btnRef = useRef(null)
      const toggle = (e) => {
        e.stopPropagation()
        if (open) { setOpen(false); return }
        const r = btnRef.current?.getBoundingClientRect()
        if (r) {
          const hgt = 104 // 气泡估算高度：放不下就翻到按钮上方，再夹进视口
          const below = r.bottom + 6
          const top = Math.min(Math.max(8, below + hgt > window.innerHeight ? r.top - 6 - hgt : below), Math.max(8, window.innerHeight - hgt - 8))
          setPos({ top, right: Math.max(8, window.innerWidth - r.right) })
        }
        setOpen(true)
      }
      useEffect(() => {
        if (!open) return
        const onDown = (e) => {
          const t = e.target
          if (t && typeof t.closest === 'function' && (t.closest('.dshmp-popconfirm') || t.closest('.dshmp-delwrap'))) return
          setOpen(false)
        }
        const onMove = () => setOpen(false) // fixed 气泡不跟随滚动，滚走即关
        const timer = setTimeout(() => {
          document.addEventListener('mousedown', onDown, true)
          window.addEventListener('scroll', onMove, true)
          window.addEventListener('resize', onMove)
        }, 0)
        return () => {
          clearTimeout(timer)
          document.removeEventListener('mousedown', onDown, true)
          window.removeEventListener('scroll', onMove, true)
          window.removeEventListener('resize', onMove)
        }
      }, [open])
      return h('span', { className: 'dshmp-delwrap' },
        h('button', { ref: btnRef, className: btnClass, title: title || '删除', disabled: !!disabled, onClick: toggle }, label),
        open && pos ? h('span', {
          className: 'dshmp-popconfirm',
          style: { top: `${pos.top}px`, right: `${pos.right}px` },
          onClick: (e) => e.stopPropagation(),
        },
          h('span', {}, hint || '删除后不可恢复'),
          h('span', { className: 'dshmp-popconfirm-btns' },
            h('button', {
              className: 'dshmp-mini danger',
              onClick: (e) => { e.stopPropagation(); setOpen(false); onConfirm() },
            }, '删除'),
            h('button', { className: 'dshmp-mini', onClick: (e) => { e.stopPropagation(); setOpen(false) } }, '取消'))) : null)
    }

    function Pop() {
      const s = useStore()
      useEffect(() => {
        if (!s.pop) return
        const onDown = (e) => {
          const t = e.target
          if (t && typeof t.closest === 'function' && (t.closest('.dshmp-pop') || t.closest('.dshmp-more'))) return
          store.pop = null
          emit()
        }
        // defer: the opening click is still bubbling when the pop mounts
        const timer = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
        return () => {
          clearTimeout(timer)
          document.removeEventListener('mousedown', onDown)
        }
      }, [s.pop])
      if (!s.pop || typeof s.pop === 'object') return h(LoginModal)
      // 设置不走悬浮面板：整体居中的模态
      if (s.pop === 'settings') {
        return h('div', { className: 'dshmp-modal', onClick: () => { store.pop = 'list'; emit() } },
          h('div', { className: 'dshmp-pop dshmp-setmodal', onClick: (e) => e.stopPropagation() },
            h('div', { className: 'dshmp-pop-head' },
              h('span', { className: 'grow' }, '音乐播放器设置'),
              h('button', { className: 'dshmp-btn dshmp-pop-x', title: '关闭', onClick: () => { store.pop = 'list'; emit() } }, '✕')),
            h(SettingsPage, { modal: true })))
      }
      const anchor = (typeof window !== 'undefined' && window.__dshmpMoreRect) || { right: 320, bottom: 60 }
      return h('div', {
        className: 'dshmp-pop',
        style: { right: `${Math.max(8, window.innerWidth - anchor.right)}px`, top: `${Math.min(anchor.bottom + 6, window.innerHeight - 80)}px` },
        onClick: (e) => e.stopPropagation(),
      },
        // 头部一行：tabs 靠左 + 设置 + 关闭，去掉正在播放信息省空间
        h('div', { className: 'dshmp-pop-head', style: { gap: 2 } },
          TABS.map(([id, label]) => h('button', {
            key: id, className: 'dshmp-tab' + (s.pop === id ? ' on' : ''),
            onClick: () => { store.pop = id; emit() },
          }, label)),
          h('button', {
            className: 'dshmp-btn dshmp-pop-set', title: '设置', onClick: () => { store.pop = 'settings'; emit() },
          }, h(GearIcon, { size: 15 })),
          h('button', { className: 'dshmp-btn dshmp-pop-x', title: '关闭', onClick: () => { store.pop = null; emit() } }, '✕')),
        h('div', { className: 'dshmp-body' },
          s.pop === 'list' ? h(ListTab) : s.pop === 'search' ? h(SearchTab) : h(AccountTab)))
    }

    function ListTab() {
      const s = useStore()
      const [openId, setOpenId] = useState(null)
      const [tracks, setTracks] = useState([])
      const [adding, setAdding] = useState(null)
      const [form, setForm] = useState({ name: '', root: '', text: '' })
      const [busy, setBusy] = useState(false)
      const [err, setErr] = useState('')
      const [sub, setSub] = useState('local') // 本地音乐 / 下载音乐
      const [tpage, setTPage] = useState(1)
      const [dlMulti, setDlMulti] = useState(false) // 下载音乐多选模式
      const [dlSel, setDlSel] = useState(() => new Set()) // 选中的下载曲目 id
      const [dlReload, setDlReload] = useState(0) // 批量删除后通知 DownloadsTab 重新拉取
      const dlToggle = (id) => setDlSel((prev) => {
        const n = new Set(prev)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      })
      const dlToggleAll = (ids) => setDlSel(new Set(ids))
      const dlDelete = async (ids) => {
        try {
          store.state = await api('/download-delete', { method: 'POST', body: JSON.stringify({ ids }) })
          emit(); setDlSel(new Set()); setDlReload((k) => k + 1)
        } catch (e) { showToast(String(e.message ?? e)) }
      }
      // 本地/自定义歌单铺平成歌曲列表（歌单名作为行首标签），平台歌单保持下方「加载」行
      const flat = useMemo(() => {
        const items = []
        for (const p of s.state.playlists) if (p.kind !== 'platform')
          for (const t of (p.tracks ?? [])) items.push(t)
        return items
      }, [s.state.playlists])
      const [lsort, setLSort] = useState({ key: '', dir: 1 })
      const [psort, setPSort] = useState({ key: '', dir: 1 })
      const flatView = useMemo(() => sortRows(flat, lsort), [flat, lsort])
      const platformPls = s.state.playlists.filter((p) => p.kind === 'platform')
      useEffect(() => { setTPage(1) }, [s.state.playlists])
      // 首次打开铺平列表时惰性回填时长：就地改 track.duration 保持引用稳定，避免打断正在播放的高亮
      useEffect(() => {
        (async () => {
          let touched = false
          for (const p of store.state.playlists) {
            if (p.kind === 'local' && (p.tracks ?? []).some((t) => !t.duration)) {
              try {
                const j = await api(`/playlist/tracks?id=${encodeURIComponent(p.id)}`)
                ;(j.tracks ?? []).forEach((nt, i) => { if (nt?.duration && p.tracks[i] && !p.tracks[i].duration) { p.tracks[i].duration = nt.duration; touched = true } })
              } catch {}
            }
          }
          if (touched) emit()
        })()
      }, [])
      const load = async (pl) => {
        if (openId === pl.id) { setOpenId(null); return }
        setOpenId(pl.id)
        setTPage(1)
        setTracks([])
        setErr('')
        try {
          const j = await api(`/playlist/tracks?id=${encodeURIComponent(pl.id)}`)
          setTracks(j.tracks ?? [])
        } catch (e) { setErr(String(e.message ?? e)) }
      }
      const pickFolder = async () => {
        setBusy(true)
        setErr('')
        let picked = null
        let opened = false
        // 宿主客户端服务优先：直接调起系统文件夹选择面板
        try {
          const ws = clientCtx && typeof clientCtx.get === 'function' ? clientCtx.get('uiWorkspace') : null
          if (ws && typeof ws.pickDirectory === 'function') {
            picked = await ws.pickDirectory()
            opened = true
          }
        } catch { /* 服务不可用则退回手输路径 */ }
        if (!opened) {
          setAdding('folder')
          setErr('无法打开系统文件夹选择器，请手动输入绝对路径')
          setBusy(false)
          return
        }
        if (!picked) {
          setBusy(false)
          return
        }
        try {
          store.state = await api('/playlist/add-folder', { method: 'POST', body: JSON.stringify({ root: picked }) })
          setAdding(null)
          emit()
        } catch (e) {
          setErr(String(e.message ?? e))
        }
        setBusy(false)
      }
      const row = (pl) => h('div', { key: pl.id },
        h('div', { className: 'dshmp-rowitem' + (s.current && pl.tracks === s.current.list ? ' playing' : '') },
          h('span', { className: 't', onClick: () => load(pl) }, `${pl.name}`),
          h('span', { className: 'sub', onClick: () => load(pl) }, pl.kind === 'platform' ? sourceLabel(pl.source) : `${pl.tracks.length} 首`),
          h('button', { className: 'dshmp-mini', onClick: () => load(pl) }, '加载'),
          h('button', {
            className: 'x', title: '删除歌单',
            onClick: async (e) => {
              e.stopPropagation()
              try { store.state = await api('/playlist/remove', { method: 'POST', body: JSON.stringify({ id: pl.id }) }); emit() } catch {}
            },
          }, '✕')),
        openId === pl.id && (() => {
          const ps = store.state.settings.pageSize || 10
          const pview = sortRows(tracks, psort)
          return h('div', null,
            err ? h('div', { className: 'dshmp-empty' }, err) : null,
            !err && tracks.length === 0 ? h('div', { className: 'dshmp-empty' }, '加载中…') : null,
            tracks.length ? h(TrackHead, { sort: psort, onSort: (k) => setPSort(nextSort(psort, k)) }) : null,
            pageSlice(pview, tpage).map((t, i) => {
              const gi = (tpage - 1) * ps + i
              return h(SongRow, {
                key: (t.id ?? '') + '/' + gi, t, playing: isCurrent(t),
                onClick: () => playTrack(pview, gi),
              })
            }),
            h(Pager, { total: pview.length, page: tpage, onChange: setTPage }))
        })(),
      )
      const subTabs = h('div', { className: 'dshmp-subtabs' },
        h('button', { className: 'dshmp-tab' + (sub === 'local' ? ' on' : ''), onClick: () => { setSub('local'); setAdding(null) } }, '本地音乐'),
        h('button', { className: 'dshmp-tab' + (sub === 'dl' ? ' on' : ''), onClick: () => { setSub('dl'); setAdding(null); setDlMulti(false); setDlSel(new Set()) } }, '下载音乐'),
        sub === 'dl' && dlMulti ? h(PopConfirm, {
          btnClass: 'dshmp-mini danger', label: `删除（${dlSel.size}）`, title: '批量删除', disabled: dlSel.size === 0,
          hint: `删除选中的 ${dlSel.size} 首下载歌曲？`, onConfirm: () => dlDelete([...dlSel]),
        }) : null,
        sub === 'dl' ? h('button', {
          className: 'dshmp-tab' + (dlMulti ? ' on' : ''),
          onClick: () => { setDlMulti(!dlMulti); setDlSel(new Set()) },
        }, dlMulti ? '取消多选' : '多选') : null,
        h('button', {
          className: 'dshmp-mini dshmp-addbtn', title: sub === 'local' ? '添加本地音乐' : '添加网络地址', disabled: busy,
          onClick: () => (sub === 'local' ? pickFolder() : setAdding(adding === 'custom' ? null : 'custom')),
        }, busy ? '…' : '＋'))
      const forms = h('div', null,
        adding === 'folder' && h('div', { style: { display: 'flex', gap: 4, marginBottom: 4 } },
          h('input', { className: 'dshmp-input', placeholder: '本地音乐文件夹绝对路径，如 /Users/me/Music', value: form.root, onChange: (e) => setForm({ ...form, root: e.target.value }) }),
          h('button', {
            className: 'dshmp-mini primary', disabled: busy,
            onClick: async () => {
              setBusy(true); setErr('')
              try { store.state = await api('/playlist/add-folder', { method: 'POST', body: JSON.stringify({ root: form.root, name: form.name }) }); setAdding(null); emit() }
              catch (e) { setErr(String(e.message ?? e)) }
              setBusy(false)
            },
          }, busy ? '扫描中…' : '添加')),
        adding === 'custom' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 } },
          h('input', { className: 'dshmp-input', placeholder: '歌单名称', value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }),
          h('textarea', {
            className: 'dshmp-input dshmp-inputarea',
            placeholder: '每行一首：歌名 - 歌手 播放地址\n也可直接粘贴 m3u 内容',
            value: form.text,
            onChange: (e) => setForm({ ...form, text: e.target.value }),
          }),
          h('button', {
            className: 'dshmp-mini primary', disabled: busy,
            onClick: async () => {
              setBusy(true); setErr('')
              try { store.state = await api('/playlist/add-custom', { method: 'POST', body: JSON.stringify({ name: form.name, text: form.text }) }); setAdding(null); emit() }
              catch (e) { setErr(String(e.message ?? e)) }
              setBusy(false)
            },
          }, '保存')))
      if (sub === 'dl') return h('div', null, subTabs, forms,
        h(DownloadsTab, { multi: dlMulti, sel: dlSel, toggle: dlToggle, toggleAll: dlToggleAll, onDelete: dlDelete, reloadKey: dlReload }))
      const ps = store.state.settings.pageSize || 10
      return h('div', null, subTabs, forms,
        err && !adding ? h('div', { className: 'dshmp-empty' }, err) : null,
        flat.length === 0 && platformPls.length === 0 && !adding ? h('div', { className: 'dshmp-empty' }, '还没有本地音乐，点右上 ＋ 添加文件夹') : null,
        flat.length ? h(TrackHead, { sort: lsort, onSort: (k) => setLSort(nextSort(lsort, k)) }) : null,
        pageSlice(flatView, tpage).map((t, i) => {
          const gi = (tpage - 1) * ps + i
          return h(SongRow, {
            key: 'l' + (t.id ?? '') + '/' + gi,
            t, playing: isCurrent(t),
            onClick: () => playTrack(flatView, gi),
          })
        }),
        h(Pager, { total: flatView.length, page: tpage, onChange: setTPage }),
        platformPls.map(row))
    }

    // 已下载曲库：服务端 /downloads/tracks 返回的即本地可播 track（source:'local'，url=绝对路径）
    function DownloadsTab({ multi, sel, toggle, toggleAll, onDelete, reloadKey }) {
      const s = useStore()
      const [tracks, setTracks] = useState(null)
      const [err, setErr] = useState('')
      const [dpage, setDPage] = useState(1)
      const [dsort, setDSort] = useState({ key: '', dir: 1 })
      useEffect(() => {
        api('/downloads/tracks').then((j) => setTracks(j.tracks ?? [])).catch((e) => setErr(String(e.message ?? e)))
      }, [reloadKey])
      if (err) return h('div', { className: 'dshmp-empty' }, err)
      if (!tracks) return h('div', { className: 'dshmp-empty' }, '加载中…')
      if (tracks.length === 0) return h('div', { className: 'dshmp-empty' }, '还没有下载歌曲，可在搜索结果点 ⬇ 下载')
      const ps = store.state.settings.pageSize || 10
      const view = sortRows(tracks, dsort)
      const ids = view.map((t) => t.id)
      const allSel = ids.length > 0 && ids.every((id) => sel.has(id))
      return h('div', { className: 'dshmp-tab-fill' },
        h(TrackHead, {
          sort: dsort, onSort: (k) => setDSort(nextSort(dsort, k)),
          action: multi ? h(CheckAll, { all: allSel, some: sel.size > 0, onChange: () => toggleAll(allSel ? [] : ids) }) : '',
        }),
        h('div', { className: 'dshmp-tab-scroll' },
          pageSlice(view, dpage).map((t, i) => {
            const gi = (dpage - 1) * ps + i
            return h(SongRow, {
              key: 'dl' + (t.id ?? '') + '/' + gi,
              t, playing: isCurrent(t),
              chk: multi ? h('input', { className: 'dshmp-chk', type: 'checkbox', checked: sel.has(t.id), readOnly: true }) : null,
              onClick: () => (multi ? toggle(t.id) : playTrack(view, gi)),
              actions: multi ? null : h(PopConfirm, {
                btnClass: 'dshmp-delbtn', label: h(TrashIcon), title: '删除',
                hint: `删除「${t.title}」的下载文件？`, onConfirm: () => onDelete([t.id]),
              }),
            })
          }),
          h(Pager, { total: view.length, page: dpage, onChange: setDPage })))
    }

    const PAGE_SIZE = { netease: 30, kuwo: 30, kugou: 30, qq: 30, qishui: 30, pan: 30, bilibili: 20, '5sing': 20, wusunk: 9999 }

    function SearchTab() {
      const [kind, setKind] = useState('song')
      const defSrc = () => store.state.settings.defaultSource || 'bilibili' // 默认音源可在设置页改
      const [source, setSource] = useState(defSrc)
      const [plSource, setPlSource] = useState(defSrc)
      const [q, setQ] = useState('')
      const [rows, setRows] = useState([])
      const [pls, setPls] = useState([])
      const [busy, setBusy] = useState(false)
      const [err, setErr] = useState('')
      const [more, setMore] = useState(null)
      const [page, setPage] = useState(1)
      const [ssort, setSSort] = useState({ key: '', dir: 1 })
      const doSearch = async (targetPage) => {
        targetPage = safePage(targetPage) // onClick: doSearch 会把 MouseEvent 传进来
        setBusy(true); setErr(''); setRows([]); setPls([]); setMore(null)
        try {
          if (kind === 'song') {
            if (source.startsWith('custom:') && !(store.state.musicSources ?? []).some((m) => m.id === source.slice(7) && m.enabled !== false)) {
              setBusy(false); setErr('该音源已停用或移除，请重新选择'); return
            }
            const j = await api(`/search?source=${source}&q=${encodeURIComponent(q)}&page=${targetPage}`)
            setRows(j.tracks ?? [])
            setMore(typeof j.hasMore === 'boolean' ? j.hasMore : null)
          } else {
            const j = await api(`/search-playlists?source=${kind === 'playlist' ? plSource : source}&q=${encodeURIComponent(q)}`)
            setPls(j.playlists ?? [])
          }
          setPage(targetPage)
          const sc = typeof document !== 'undefined' ? document.querySelector('.dshmp-pop .dshmp-tab-scroll') : null
          if (sc) sc.scrollTop = 0
        } catch (e) { setErr(String(e.message ?? e)) }
        setBusy(false)
      }
      const panClick = async (t) => {
        try {
          const j = await api(`/pan-link?id=${encodeURIComponent(t.id)}`)
          const link = (j.links ?? [])[0]?.url ?? ''
          if (!link) throw new Error('没有拿到网盘链接')
          try { await navigator.clipboard.writeText(link) } catch {}
          showToast(`网盘链接已复制：${link}`)
        } catch (e) { showToast(String(e.message ?? e)) }
      }
      const rowsView = useMemo(() => sortRows(rows, ssort), [rows, ssort])
      const hasMore = more ?? rows.length >= (PAGE_SIZE[source] ?? 30)
      return h('div', { className: 'dshmp-tab-fill' },
        h('div', { style: { display: 'flex', gap: 4, marginBottom: 4, flex: 'none' } },
          h('select', { className: 'dshmp-input', style: { flex: 'none', width: 84 }, value: kind, onChange: (e) => setKind(e.target.value) },
            h('option', { value: 'song' }, '歌曲'),
            h('option', { value: 'playlist' }, '歌单')),
          kind === 'song' ? h('select', { className: 'dshmp-input', style: { flex: 'none', width: 96 }, value: source, onChange: (e) => setSource(e.target.value) },
            h('option', { value: 'netease' }, '网易云'),
            h('option', { value: 'bilibili' }, 'B站'),
            h('option', { value: 'kuwo' }, '酷我'),
            h('option', { value: 'kugou' }, '酷狗'),
            h('option', { value: 'qq' }, 'QQ音乐'),
            h('option', { value: 'qishui' }, '汽水'),
            h('option', { value: 'pan' }, '免费源'),
            h('option', { value: '5sing' }, '5sing'),
            h('option', { value: 'wusunk' }, '无损控'),
            ...(store.state.musicSources ?? []).filter((m) => m.enabled !== false).map((m) => h('option', { key: m.id, value: `custom:${m.id}` }, `${m.name}·自定义`))) : h('select', { className: 'dshmp-input', style: { flex: 'none', width: 96 }, value: plSource, onChange: (e) => setPlSource(e.target.value) },
            h('option', { value: 'netease' }, '网易云'),
            h('option', { value: 'qq' }, 'QQ音乐'),
            h('option', { value: 'qishui' }, '汽水')),
          h('input', { className: 'dshmp-input', placeholder: kind === 'song' ? '搜索歌曲' : '搜索歌单', value: q, onChange: (e) => setQ(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') doSearch() } }),
          h('button', { className: 'dshmp-mini primary', disabled: busy, onClick: doSearch }, busy ? '…' : '搜索')),
        err ? h('div', { className: 'dshmp-empty' }, err) : null,
        !err && busy ? h('div', { className: 'dshmp-empty' }, '搜索中…') : null,
        kind === 'song' && rows.length ? h(TrackHead, { sort: ssort, onSort: (k) => setSSort(nextSort(ssort, k)), action: '下载' }) : null,
        h('div', { className: 'dshmp-tab-scroll' },
          rowsView.map((t, i) => h(SongRow, {
            key: 's' + t.id + '/' + i, t, playing: isCurrent(t),
            sub: t.artist || '',
            onClick: () => ((t.source === 'pan' || t.source === 'wusunk') ? panClick(t) : playTrack(rowsView, i)),
            actions: t.source !== 'pan' && t.source !== 'wusunk' ? h('span', { style: { display: 'inline-flex', gap: 2, alignItems: 'center' } },
              h('button', {
                className: 'dshmp-ply',
                title: '播放',
                onClick: (e) => { e.stopPropagation(); playTrack(rowsView, i) },
              }, h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }, h('path', { d: 'M8 5.5v13l11-6.5z' }))),
              h(DlBtn, { t })) : null,
          })),
        pls.map((p) => h('div', {
          key: p.id, className: 'dshmp-rowitem',
          onClick: async () => {
            setBusy(true); setErr('')
            try {
              store.state = await api('/playlist/add-platform', { method: 'POST', body: JSON.stringify({ name: p.title, source: plSource, refId: p.id }) })
              const j = await api(`/playlist/tracks?id=${encodeURIComponent(store.state.playlists[store.state.playlists.length - 1].id)}`)
              store.pop = 'list'; emit(); setBusy(false)
              if ((j.tracks ?? []).length > 0) playTrack(j.tracks, 0)
            } catch (e) { setErr(String(e.message ?? e)); setBusy(false) }
          },
        },
          h('span', { className: 't' }, p.title),
          h('span', { className: 'sub' }, `${p.count} 首`)))),
        kind === 'song' && (rows.length > 0 || page > 1) ? h('div', { className: 'dshmp-pager' },
          h('button', { className: 'dshmp-mini', disabled: busy || page <= 1, onClick: () => doSearch(page - 1) }, '‹ 上一页'),
          h('span', { className: 'dshmp-pgnum' }, `第 ${page} 页`),
          h('button', { className: 'dshmp-mini', disabled: busy || !hasMore, onClick: () => doSearch(page + 1) }, '下一页 ›')) : null)
    }

    function sourceLabel(source) {
      if (typeof source === 'string' && source.startsWith('custom:')) {
        const m = (store.state?.musicSources ?? []).find((x) => x.id === source.slice(7))
        if (m) return m.name
      }
      return { netease: '网易云', bilibili: 'B站', kuwo: '酷我', kugou: '酷狗', qq: 'QQ音乐', qishui: '汽水', soda: '汽水', pan: '免费源', '5sing': '5sing', wusunk: '无损控', local: '本地', custom: '网络' }[source] ?? source
    }

    // 平台官方 favicon（经服务端 stream 代理加载，失败回退字母徽标）
    const PLATFORM_LOGOS = {
      netease: 'https://music.163.com/favicon.ico',
      bilibili: 'https://www.bilibili.com/favicon.ico',
      kugou: 'https://www.kugou.com/favicon.ico',
      kuwo: 'https://www.kuwo.cn/favicon.ico?v=1',
      qq: 'https://y.qq.com/favicon.ico',
      soda: 'https://lf-luna.qishui.com/obj/music-luna-fe/luna/home/1.0.0.287/favicon.png',
    }

    function PlatformIcon({ p, letter }) {
      const [bad, setBad] = useState(false)
      const url = PLATFORM_LOGOS[p]
      if (!url || bad) return h('span', { className: 'ic' }, letter)
      return h('span', { className: 'ic has-logo' },
        h('img', { src: `${API}/stream?u=${encodeURIComponent(url)}`, alt: '', onError: () => setBad(true) }))
    }

    // App Store 风格下载按钮：空闲 ⬇ / 进行中圆环+进度 / 完成 ✓
    const RING_LEN = 2 * Math.PI * 16

    function dlRing(st) {
      const phase = st?.phase ?? ''
      const total = Number(st?.total) || 0
      const received = Number(st?.received) || 0
      const p = phase === 'saving' || phase === 'done' ? 1 : total > 0 ? Math.min(1, received / total) : 0
      return { dash: RING_LEN, offset: RING_LEN * (1 - p), indet: phase === 'downloading' && total <= 0 }
    }

    function DlBtn({ t }) {
      const s = useStore()
      const [busy, setBusy] = useState(false)
      const [st, setSt] = useState(null)
      const done = (s.state.downloads ?? []).some((d) => d.source === t.source && d.sourceId === String(t.id))
      const start = async () => {
        if (busy) return
        setBusy(true); setSt({ phase: 'linking' })
        showToast(`开始下载：${t.title}`)
        const key = `${t.source}:${t.id}`
        const timer = setInterval(async () => {
          try { const j = await api(`/download-progress?key=${encodeURIComponent(key)}`); if (j?.phase) setSt(j) } catch {}
        }, 400)
        try {
          await api('/download', {
            method: 'POST',
            body: JSON.stringify({ source: t.source, id: t.id, title: t.title, artist: t.artist, duration: t.duration, cover: t.cover }),
          })
          store.state = await api('/state'); emit()
          showToast(`已下载：${t.title}`)
        } catch (e) { showToast(`下载失败：${String(e.message ?? e)}`) }
        clearInterval(timer)
        setBusy(false); setSt(null)
      }
      const r = busy ? dlRing(st) : null
      return h('button', {
        className: 'dshmp-dl' + (busy ? (r.indet ? ' indet' : '') : done ? ' done' : ''),
        title: busy ? (st?.phase === 'saving' ? '写入文件…' : '下载中…') : done ? '已下载，点击重新下载' : '下载到下载目录',
        onClick: (e) => { e.stopPropagation(); start() },
      },
        busy ? h('svg', { viewBox: '0 0 36 36' },
          h('circle', { className: 'trk', cx: 18, cy: 18, r: 16, fill: 'none', strokeWidth: 3 }),
          h('circle', { className: 'arc', cx: 18, cy: 18, r: 16, fill: 'none', strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: r.dash, strokeDashoffset: r.offset }),
          h('rect', { className: 'box', x: 11.5, y: 11.5, width: 13, height: 13, rx: 3.5 }),
          h('path', { className: 'arr', d: 'M18 14.4v4.6M15.7 17l2.3 2.3L20.3 17M15 21h6' }))
        : done ? h('svg', { viewBox: '0 0 36 36' },
          h('rect', { className: 'box', x: 10.5, y: 10.5, width: 15, height: 15, rx: 4 }),
          h('path', { className: 'chk', d: 'M14.8 18.4l2.3 2.3 4.3-4.8' }))
        : '⬇')
    }

    function AccountTab() {
      const s = useStore()
      const [pls, setPls] = useState(null)
      const [err, setErr] = useState('')
      useEffect(() => { setPls(null); setErr('') }, [])
      const platforms = [
        ['netease', '网', '网易云'],
        ['bilibili', 'B', 'B站'],
        ['kugou', 'K', '酷狗'],
        ['kuwo', 'K', '酷我'],
        ['qq', 'Q', 'QQ音乐'],
        ['soda', '汽', '汽水'],
      ]
      const loadAccountLists = async (source) => {
        setErr('')
        try {
          const j = await api(`/account-playlists?source=${source}`)
          setPls({ source, lists: j.playlists ?? [] })
        } catch (e) { setErr(String(e.message ?? e)) }
      }
      return h('div', null,
        platforms.map(([id, badge, label]) => {
          const acc = s.state.accounts[id]
          const supported = id === 'netease' || id === 'bilibili' || id === 'kugou' || id === 'kuwo' || id === 'qq' || id === 'soda'
          return h('div', {
            key: id,
            className: 'dshmp-acct' + (acc?.loggedIn ? '' : ' off'),
            onClick: async () => {
              if (acc?.loggedIn) {
                if (window.confirm(`退出 ${label}（${acc.name || ''}）登录？`)) {
                  try { store.state = await api('/logout', { method: 'POST', body: JSON.stringify({ platform: id }) }); emit() } catch {}
                }
                return
              }
              if (!supported) { store.pop = { toast: `${label} 登录暂未接入` }; emit(); setTimeout(() => { if (store.pop && store.pop.toast) { store.pop = 'account'; emit() } }, 1600); return }
              store.pop = { login: id }
              emit()
            },
          },
            h(PlatformIcon, { key: 'ic', p: id, letter: badge }),
            h('span', { className: 'nm' }, acc?.loggedIn ? `${label} · ${acc.name || '已登录'}` : `${label} · 未登录`))
        }),
        err ? h('div', { className: 'dshmp-empty' }, err) : null,
        pls ? h('div', { className: 'dshmp-section' }, `账号歌单（${sourceLabel(pls.source)}）`) : null,
        pls && pls.lists.length === 0 ? h('div', { className: 'dshmp-empty' }, '没有歌单') : null,
        (pls?.lists ?? []).map((p) => h('div', {
          key: p.id, className: 'dshmp-rowitem',
          onClick: async () => {
            setErr('')
            try {
              store.state = await api('/playlist/add-platform', { method: 'POST', body: JSON.stringify({ name: p.title, source: pls.source, refId: p.id }) })
              const added = store.state.playlists[store.state.playlists.length - 1]
              const j = await api(`/playlist/tracks?id=${encodeURIComponent(added.id)}`)
              store.pop = 'list'; emit()
              if ((j.tracks ?? []).length > 0) playTrack(j.tracks, 0)
            } catch (e) { setErr(String(e.message ?? e)) }
          },
        },
          h('span', { className: 't' }, p.title),
          h('span', { className: 'sub' }, `${p.count} 首`))),
        h('div', { className: 'dshmp-section' }, '点击已登录平台可退出；网易云/酷狗/QQ/汽水扫码，酷我短信，B站粘贴 cookie'),
        h('div', null,
          h('button', { className: 'dshmp-mini', disabled: !s.state.accounts.netease?.loggedIn, onClick: () => loadAccountLists('netease') }, '网易云·我的歌单'),
          h('button', { className: 'dshmp-mini', disabled: !s.state.accounts.bilibili?.loggedIn, onClick: () => loadAccountLists('bilibili') }, 'B站·我的收藏'),
          h('button', { className: 'dshmp-mini', disabled: !s.state.accounts.kugou?.loggedIn, onClick: () => loadAccountLists('kugou') }, '酷狗·我的歌单'),
          h('button', { className: 'dshmp-mini', disabled: !s.state.accounts.kuwo?.loggedIn, onClick: () => loadAccountLists('kuwo') }, '酷我·我的歌单'),
          h('button', { className: 'dshmp-mini', disabled: !s.state.accounts.qq?.loggedIn, onClick: () => loadAccountLists('qq') }, 'QQ·我的歌单'),
          h('button', { className: 'dshmp-mini', disabled: !s.state.accounts.soda?.loggedIn, onClick: () => loadAccountLists('soda') }, '汽水·我的歌单')))
    }

    // Kuwo has no QR login on the web; it uses a mobile-SMS flow with an image captcha.
    function KuwoSmsForm({ onDone }) {
      const [mobile, setMobile] = useState('')
      const [cap, setCap] = useState(null) // { token, img }
      const [code, setCode] = useState('') // captcha answer
      const [sms, setSms] = useState('') // sms code
      const [tm, setTm] = useState('')
      const [cd, setCd] = useState(0) // resend countdown seconds
      const [msg, setMsg] = useState('')
      const [err, setErr] = useState('')
      const refreshCaptcha = () => {
        setErr(''); setCap(null)
        api('/kuwo-captcha').then(setCap).catch((e) => setErr(String(e.message ?? e)))
      }
      useEffect(refreshCaptcha, [])
      useEffect(() => { if (cd > 0) { const t = setTimeout(() => setCd(cd - 1), 1000); return () => clearTimeout(t) } }, [cd])
      const capSrc = cap ? (cap.img.startsWith('data:') ? cap.img : `${API}/stream?u=${encodeURIComponent(cap.img)}`) : ''
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: 10 } },
        h('input', { className: 'dshmp-input', placeholder: '手机号', inputMode: 'numeric', value: mobile, onChange: (e) => setMobile(e.target.value.trim()) }),
        h('div', { className: 'dshmp-caprow' },
          cap ? h('img', { className: 'dshmp-capimg', src: capSrc, title: '点击刷新', alt: '', onClick: refreshCaptcha })
            : h('div', { className: 'dshmp-capimg dshmp-empty', onClick: refreshCaptcha }, '加载中…'),
          h('input', { className: 'dshmp-input', placeholder: '图形码', value: code, onChange: (e) => setCode(e.target.value.trim()) })),
        h('button', {
          className: 'dshmp-mini', disabled: cd > 0 || !/^1\d{10}$/.test(mobile) || !code || !cap,
          onClick: async () => {
            setErr(''); setMsg('')
            try {
              const r = await api('/kuwo-sms', { method: 'POST', body: JSON.stringify({ mobile, verifyCode: code, token: cap.token }) })
              setTm(r.tm); setCd(60); setMsg('验证码已发送，请查收短信')
            } catch (e) { setErr(String(e.message ?? e)); refreshCaptcha() }
          },
        }, cd > 0 ? `重发（${cd}s）` : '发送短信验证码'),
        h('input', { className: 'dshmp-input', placeholder: '短信验证码', inputMode: 'numeric', value: sms, onChange: (e) => setSms(e.target.value.trim()) }),
        err ? h('div', { className: 'dshmp-empty' }, err) : null,
        msg ? h('div', { className: 'dshmp-empty' }, msg) : null,
        h('button', {
          className: 'dshmp-mini primary', disabled: !tm || !sms,
          onClick: async () => {
            setErr('')
            try {
              await api('/kuwo-login', { method: 'POST', body: JSON.stringify({ mobile, smsCode: sms, tm }) })
              store.state = await api('/state')
              emit(); onDone()
            } catch (e) { setErr(String(e.message ?? e)) }
          },
        }, '登录'))
    }

    function LoginModal() {
      const s = useStore()
      const pop = s.pop
      const [qr, setQr] = useState(null)
      const [cookie, setCookie] = useState('')
      const [msg, setMsg] = useState('')
      const [err, setErr] = useState('')
      useEffect(() => {
        if (pop && (pop.login === 'netease' || pop.login === 'kugou' || pop.login === 'soda')) {
          setMsg(''); setErr('')
          api('/qr-start', { method: 'POST', body: JSON.stringify({ platform: pop.login }) }).then((r) => setQr({ ...r, platform: pop.login })).catch((e) => setErr(String(e.message ?? e)))
        }
      }, [pop && pop.login])
      useEffect(() => {
        if (!qr?.key) return
        let stop = false
        const timer = setInterval(async () => {
          try {
            const j = await api(`/qr-poll?key=${encodeURIComponent(qr.key)}&platform=${encodeURIComponent(qr.platform ?? 'netease')}`)
            if (j.code === 801) setMsg('等待扫码…')
            else if (j.code === 802) setMsg(`已扫码，请在手机上确认（${j.nickname || ''}）`)
            else if (j.code === 803) {
              stop = true
              clearInterval(timer)
              store.state = await api('/state')
              store.pop = 'account'
              emit()
              return
            }
          } catch (e) { setErr(String(e.message ?? e)) }
          if (stop) clearInterval(timer)
        }, 2000)
        return () => clearInterval(timer)
      }, [qr && qr.key])
      if (!pop || typeof pop !== 'object' || (!pop.login && !pop.toast)) return null
      if (pop.toast) {
        return h('div', {
          className: 'dshmp-pop', style: { right: '24px', top: '48px', width: 'auto', padding: '10px 16px' },
        }, h('span', {}, pop.toast))
      }
      const label = { netease: '网易云', bilibili: 'B站', kugou: '酷狗', kuwo: '酷我', qq: 'QQ音乐', soda: '汽水' }[pop.login] ?? pop.login
      return h('div', {
        className: 'dshmp-pop',
        style: { right: '24px', top: '48px' },
        onClick: (e) => e.stopPropagation(),
      },
        h('div', { className: 'dshmp-pop-head' },
          h('span', { className: 'grow' }, `${label} 登录`),
          h('button', { className: 'dshmp-btn dshmp-pop-x', onClick: () => { store.pop = 'account'; emit() } }, '✕')),
        pop.login === 'kuwo' ? h(KuwoSmsForm, {
          onDone: () => { store.pop = 'account'; emit() },
        })
        : pop.login === 'netease' || pop.login === 'kugou' || pop.login === 'qq' || pop.login === 'soda'
          ? h('div', { className: 'dshmp-qr' },
              err ? h('div', { className: 'dshmp-empty' }, err)
                : qr ? h('img', { src: qr.qrimg, alt: '二维码' }) : h('div', { className: 'dshmp-empty' }, '生成二维码…'),
              h('div', { className: 'dshmp-section' }, msg || (pop.login === 'kugou' ? '请用酷狗音乐 App 扫码' : pop.login === 'qq' ? '请用手机 QQ 扫码' : pop.login === 'soda' ? '请用抖音 App 扫码' : '请用网易云音乐 App 扫码')))
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: 10 } },
              h('textarea', {
                className: 'dshmp-input dshmp-inputarea',
                placeholder: '粘贴浏览器中 bilibili.com 的 cookie（需包含 SESSDATA）',
                value: cookie,
                onChange: (e) => setCookie(e.target.value),
              }),
              err ? h('div', { className: 'dshmp-empty' }, err) : null,
              h('button', {
                className: 'dshmp-mini primary',
                onClick: async () => {
                  setErr('')
                  try {
                    await api('/login-cookie', { method: 'POST', body: JSON.stringify({ cookie }) })
                    store.state = await api('/state')
                    store.pop = 'account'
                    emit()
                  } catch (e) { setErr(String(e.message ?? e)) }
                },
              }, '登录')))
    }

    // ---------- dsh settings page: accounts / download dir / download library ----------

    function HotkeyRow({ field, label }) {
      const s = useStore()
      const [rec, setRec] = useState(false)
      const [err, setErr] = useState('')
      useEffect(() => {
        if (!rec) return
        const onKey = (e) => {
          e.preventDefault(); e.stopPropagation()
          if (e.key === 'Escape') { setRec(false); return }
          const combo = comboOf(e)
          if (!combo) return // 只按了修饰键，继续等
          api('/settings', { method: 'POST', body: JSON.stringify({ hotkeys: { [field]: combo } }) })
            .then((j) => { store.state = j; emit() })
            .catch((e2) => setErr(String(e2.message ?? e2)))
          setRec(false)
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [rec, field])
      const cur = s.state.settings.hotkeys?.[field] || ''
      return h('div', { className: 'dshmp-set-field' },
        h('span', {}, label),
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
          h('span', { className: 'dshmp-pgnum', style: { minWidth: 96, textAlign: 'left' } }, cur || '未设置'),
          h('button', { className: 'dshmp-mini' + (rec ? ' primary' : ''), disabled: rec, onClick: () => setRec(true) },
            rec ? '请按下组合键…（Esc 取消）' : '录制'),
          cur ? h('button', {
            className: 'dshmp-mini',
            onClick: () => {
              api('/settings', { method: 'POST', body: JSON.stringify({ hotkeys: { [field]: '' } }) })
                .then((j) => { store.state = j; emit() })
                .catch((e2) => setErr(String(e2.message ?? e2)))
            },
          }, '清除') : null,
          err ? h('span', { className: 'dshmp-pgnum' }, err) : null))
    }

    function SettingsPage(props) {
      const s = useStore()
      const [dir, setDir] = useState('')
      const [err, setErr] = useState('')
      const [editing, setEditing] = useState(null) // downloads entry or {trackId} local track being edited
      const [login, setLogin] = useState(null) // platform login flow inside settings
      const [localRows, setLocalRows] = useState(null) // 铺平后的本地歌曲
      const [localErr, setLocalErr] = useState('')
      const [lreload, setLReload] = useState(0)
      const [lsort, setLSort] = useState({ key: '', dir: 1 })
      const [dsort, setDSort] = useState({ key: '', dir: 1 })
      const [libTab, setLibTab] = useState('local') // 本地音乐 / 下载音乐
      const [lpage, setLPage] = useState(1)
      const [sdpage, setSdPage] = useState(1)
      const [psz, setPsz] = useState('10')
      const [accentTmp, setAccentTmp] = useState('')
      const [srcTmp, setSrcTmp] = useState('bilibili')
      const [srcEditId, setSrcEditId] = useState(null) // null=收起, 'new'=新增, 其他=编辑该 id
      const [srcText, setSrcText] = useState('')
      const [srcBusy, setSrcBusy] = useState(false)
      const srcHlRef = useRef(null) // 高亮层 <code>，与 textarea 同步内容与滚动
      const openSrc = async (id) => {
        setSrcEditId(id)
        setSrcText(id === 'new' ? '' : '加载中…')
        if (id === 'new') return
        try { const j = await api(`/music-source/script?id=${encodeURIComponent(id)}`); setSrcText(j.script ?? '') }
        catch (e) { setSrcText(''); showToast(String(e.message ?? e)) }
      }
      const closeSrc = () => { setSrcEditId(null); setSrcText('') }
      const saveSrc = async () => {
        setSrcBusy(true)
        try {
          const path = srcEditId === 'new' ? '/music-source/add' : '/music-source/update'
          const body = srcEditId === 'new' ? { script: srcText } : { id: srcEditId, script: srcText }
          store.state = await api(path, { method: 'POST', body: JSON.stringify(body) })
          closeSrc(); emit()
          showToast(srcEditId === 'new' ? '自定义源已添加' : '自定义源已更新')
        } catch (e) { showToast(String(e.message ?? e)) }
        setSrcBusy(false)
      }
      useEffect(() => {
        if (srcHlRef.current) srcHlRef.current.innerHTML = highlightJs(srcText) + '\n'
      }, [srcText])
      useEffect(() => {
        setPsz(String(store.state.settings.pageSize ?? 10))
        setAccentTmp(store.state.settings.accent ?? '')
        setSrcTmp(store.state.settings.defaultSource || 'bilibili')
      }, [s.state.settings.pageSize, s.state.settings.accent, s.state.settings.defaultSource])
      useEffect(() => {
        (async () => {
          try {
            store.state = await api('/state')
            setDir(store.state.settings.downloadDir ?? '')
            emit()
          } catch (e) { setErr(String(e.message ?? e)) }
        })()
      }, [])
      const platforms = [
        ['netease', '网', '网易云'],
        ['bilibili', 'B', 'B站'],
        ['kugou', 'K', '酷狗'],
        ['kuwo', 'K', '酷我'],
        ['qq', 'Q', 'QQ音乐'],
        ['soda', '汽', '汽水'],
      ]
      const playDownloads = async () => {
        setErr('')
        try {
          const j = await api('/downloads/tracks')
          if ((j.tracks ?? []).length === 0) { showToast('还没有下载的音乐'); return }
          store.pop = null
          playTrack(j.tracks, 0)
          showToast('开始播放下载列表')
        } catch (e) { setErr(String(e.message ?? e)) }
      }
      const playAllLocal = () => {
        const all = locals.flatMap((p) => p.tracks ?? [])
        if (all.length === 0) { showToast('本地歌单里还没有歌曲'); return }
        store.pop = null
        playTrack(all, 0)
        showToast(`开始播放本地音乐（${all.length} 首）`)
      }
      const startEdit = (d) => setEditing({
        id: d.id, title: d.title, artist: d.artist, album: d.album,
        lyricist: d.lyricist, composer: d.composer, cover: '',
      })
      const startTrackEdit = (t) => setEditing({ trackId: t.id, title: t.title, artist: t.artist || '' })
      // 本地音乐铺平成歌曲列表（与更多弹窗一致），直接展示歌曲而不是歌单行
      const locals = (s.state.playlists ?? []).filter((p) => p.kind === 'local')
      const localSig = locals.map((p) => `${p.id}:${(p.tracks ?? []).length}`).join('|')
      useEffect(() => {
        let dead = false
        ;(async () => {
          const out = []
          try {
            for (const p of store.state.playlists ?? []) {
              if (p.kind !== 'local') continue
              const j = await api(`/playlist/tracks?id=${encodeURIComponent(p.id)}`)
              for (const t of (j.tracks ?? [])) out.push(t)
            }
            if (!dead) { setLocalRows(out); setLocalErr('') }
          } catch (e) { if (!dead) setLocalErr(String(e.message ?? e)) }
        })()
        return () => { dead = true }
      }, [localSig, lreload])
      const localView = useMemo(() => sortRows(localRows ?? [], lsort), [localRows, lsort])
      const dlView = useMemo(() => sortRows(s.state.downloads ?? [], dsort), [s.state.downloads, dsort])
      const saveAll = async () => {
        try {
          const body = { pageSize: Number(psz) || 10, accent: accentTmp, defaultSource: srcTmp }
          if (dir.trim()) body.downloadDir = dir.trim() // 空值=沿用默认目录，不提交避免校验报错
          store.state = await api('/settings', { method: 'POST', body: JSON.stringify(body) })
          emit(); showToast('已保存')
        } catch (e) { showToast(String(e.message ?? e)) }
      }
      const saveEdit = async () => {
        setErr('')
        try {
          if (editing.trackId) {
            store.state = await api('/playlist/track-update', { method: 'POST', body: JSON.stringify({ id: editing.trackId, title: editing.title, artist: editing.artist }) })
            setEditing(null); emit(); setLReload((k) => k + 1); showToast('已保存')
            return
          }
          store.state = await api('/download-update', { method: 'POST', body: JSON.stringify(editing) })
          setEditing(null); emit(); showToast('已保存（mp3 会写入 ID3 标签）')
        } catch (e) { setErr(String(e.message ?? e)) }
      }
      const removeDownload = async (ids) => {
        setErr('')
        try { store.state = await api('/download-delete', { method: 'POST', body: JSON.stringify({ ids }) }); emit(); setDlSel(new Set()) }
        catch (e) { setErr(String(e.message ?? e)) }
      }
      const pickDownloadDir = async () => {
        try {
          const ws = clientCtx && typeof clientCtx.get === 'function' ? clientCtx.get('uiWorkspace') : null
          if (!ws || typeof ws.pickDirectory !== 'function') { showToast('当前环境不支持目录选择，请手动输入'); return }
          const picked = await ws.pickDirectory()
          if (!picked) return
          setDir(picked)
          store.state = await api('/settings', { method: 'POST', body: JSON.stringify({ downloadDir: picked }) })
          emit(); showToast('下载目录已更新')
        } catch (e) { showToast(String(e.message ?? e)) }
      }
      const [dlMulti, setDlMulti] = useState(false) // 下载音乐多选模式
      const [dlSel, setDlSel] = useState(() => new Set())
      const dlAllSel = dlView.length > 0 && dlView.every((d) => dlSel.has(d.id))
      const field = (label, key, placeholder) => h('label', { className: 'dshmp-set-field' },
        h('span', {}, label),
        h('input', {
          className: 'dshmp-input', value: editing?.[key] ?? '',
          placeholder, onChange: (e) => setEditing({ ...editing, [key]: e.target.value }),
        }))
      const saveBar = h('div', { className: 'dshmp-setfoot' },
        props.modal ? h('span', { className: 'grow dshmp-pgnum' }, '修改后点击保存生效') : null,
        h('button', { className: 'dshmp-mini primary', onClick: saveAll }, '保存'))
      const inner = h('div', { className: 'dshmp-settings' },
        props.modal ? null : h('h3', {}, '音乐播放器'),
        err ? h('div', { className: 'dshmp-empty' }, err) : null,
        editing ? h('div', { className: 'dshmp-modal', onClick: () => setEditing(null) },
          h('div', { className: 'dshmp-pop', style: { position: 'static' }, onClick: (e) => e.stopPropagation() },
            h('div', { className: 'dshmp-pop-head' },
              h('span', { className: 'grow' }, `编辑信息${editing.title ? '：' + editing.title : ''}`),
              h('button', { className: 'dshmp-btn dshmp-pop-x', title: '关闭', onClick: () => setEditing(null) }, '✕')),
            h('div', { className: 'dshmp-body' },
              field('歌名', 'title', ''), field('歌手', 'artist', ''),
              editing.trackId ? null : field('专辑', 'album', ''),
              editing.trackId ? null : field('词作人', 'lyricist', ''),
              editing.trackId ? null : field('曲作人', 'composer', ''),
              editing.trackId ? null : field('封面 URL', 'cover', '留空保持不变'),
              err ? h('div', { className: 'dshmp-empty' }, err) : null,
              h('div', { style: { display: 'flex', gap: 6 } },
                h('button', { className: 'dshmp-mini primary', onClick: saveEdit }, '保存'),
                h('button', { className: 'dshmp-mini', onClick: () => setEditing(null) }, '取消'))))) : null,
        srcEditId != null ? h('div', { className: 'dshmp-modal', onClick: closeSrc },
          h('div', { className: 'dshmp-pop dshmp-srcmodal', style: { position: 'static' }, onClick: (e) => e.stopPropagation() },
            h('div', { className: 'dshmp-pop-head' },
              h('span', { className: 'grow' }, srcEditId === 'new'
                ? '新增自定义源'
                : `编辑音源${(s.state.musicSources ?? []).find((m) => m.id === srcEditId)?.name ? '：' + s.state.musicSources.find((m) => m.id === srcEditId).name : ''}`),
              h('button', { className: 'dshmp-btn dshmp-pop-x', title: '关闭', onClick: closeSrc }, '✕')),
            h('div', { className: 'dshmp-body' },
              h('div', { className: 'dshmp-codebox' },
                h('pre', { className: 'dshmp-codehl', 'aria-hidden': 'true' }, h('code', { ref: srcHlRef })),
                h('textarea', {
                  className: 'dshmp-codeta', spellCheck: false,
                  placeholder: '粘贴 lx-music 自定义源脚本（/** @name … */ 头部注释开头）',
                  value: srcText,
                  onChange: (e) => setSrcText(e.target.value),
                  onScroll: (e) => {
                    const p = e.target.previousElementSibling // pre 与 textarea 同容器，滚动对齐
                    if (p) { p.scrollTop = e.target.scrollTop; p.scrollLeft = e.target.scrollLeft }
                  },
                })),
              h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flex: 'none' } },
                h('span', { className: 'dshmp-pgnum grow' }, '脚本头部需含 @name/@version/@author 注释'),
                h('button', { className: 'dshmp-mini primary', disabled: srcBusy || !srcText.trim(), onClick: saveSrc }, srcBusy ? '保存中…' : '保存'),
                h('button', { className: 'dshmp-mini', onClick: closeSrc }, '取消'))))) : null,
        h('div', { className: 'dshmp-set-block' },
          h('div', { className: 'dshmp-section' }, '第三方账号'),
          platforms.map(([id, badge, label]) => {
            const acc = s.state.accounts[id]
            const supported = id === 'netease' || id === 'bilibili' || id === 'kugou' || id === 'kuwo' || id === 'qq' || id === 'soda'
            return h('div', {
              key: id,
              className: 'dshmp-acct' + (acc?.loggedIn ? '' : ' off'),
              onClick: async () => {
                setErr('')
                if (acc?.loggedIn) {
                  if (window.confirm(`退出 ${label}（${acc.name || ''}）登录？`)) {
                    try { store.state = await api('/logout', { method: 'POST', body: JSON.stringify({ platform: id }) }); emit() } catch (e) { setErr(String(e.message ?? e)) }
                  }
                  return
                }
                if (!supported) { showToast(`${label} 登录暂未接入`); return }
                setLogin(id)
              },
            },
              h(PlatformIcon, { key: 'ic', p: id, letter: badge }),
              h('span', { className: 'nm' }, acc?.loggedIn ? `${label} · ${acc.name || '已登录'}` : `${label} · 未登录（点击登录）`))
          }),
          login ? h(SettingsLogin, { platform: login, onClose: () => setLogin(null) }) : null),
        h('div', { className: 'dshmp-set-block' },
          h('div', { className: 'dshmp-section' }, '下载目录'),
          h('div', { style: { display: 'flex', gap: 6 } },
            h('button', {
              className: 'dshmp-folderbtn', title: '打开下载目录',
              onClick: async () => {
                setErr('')
                try { await api('/open-download-dir', { method: 'POST' }); showToast('已在系统中打开下载目录') }
                catch (e) { setErr(String(e.message ?? e)) }
              },
            },
              h('svg', { viewBox: '0 0 24 24' },
                h('path', { d: 'M3 6.4c0-1 .8-1.9 1.9-1.9h4.2c.5 0 1 .2 1.4.6l1.3 1.3h6.3c1 0 1.9.8 1.9 1.9v9.3c0 1-.8 1.9-1.9 1.9H4.9c-1 0-1.9-.8-1.9-1.9z' })),
              h('span', { style: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' } }, '打开下载目录')),
            h('input', {
              className: 'dshmp-input', placeholder: '默认 ~/Music/dsh-music-player',
              value: dir, onChange: (e) => setDir(e.target.value),
            }),
            h('button', { className: 'dshmp-mini', title: '选择下载目录', onClick: pickDownloadDir }, '选择…'))),
        h('div', { className: 'dshmp-set-block' },
          h('div', { className: 'dshmp-section' }, '显示与颜色'),
          h('div', { className: 'dshmp-set-field' },
            h('span', {}, '每页显示'),
            h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
              h('input', {
                className: 'dshmp-input', type: 'number', min: 5, max: 100,
                value: psz, onChange: (e) => setPsz(e.target.value),
              }),
              h('span', { className: 'dshmp-pgnum' }, '条（5-100）')),
            h('span', {}, '主题颜色'),
            h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
              h('input', {
                type: 'color',
                value: accentTmp || '#8ab4f8',
                onChange: (e) => setAccentTmp(e.target.value),
              }),
              accentTmp ? h('button', { className: 'dshmp-mini', onClick: () => setAccentTmp('') }, '恢复默认') : null,
              h('span', { className: 'dshmp-pgnum' }, '进度条与已播歌词')))),
        h('div', { className: 'dshmp-set-block' },
          h('div', { className: 'dshmp-set-field' },
            h('span', {}, '默认音源'),
            h('select', {
              className: 'dshmp-input', style: { flex: 'none', width: 120 },
              value: srcTmp, onChange: (e) => setSrcTmp(e.target.value),
            },
              h('option', { value: 'netease' }, '网易云'),
              h('option', { value: 'bilibili' }, 'B站'),
              h('option', { value: 'kuwo' }, '酷我'),
              h('option', { value: 'kugou' }, '酷狗'),
              h('option', { value: 'qq' }, 'QQ音乐'),
              h('option', { value: 'qishui' }, '汽水'),
              h('option', { value: 'pan' }, '免费源'),
              h('option', { value: '5sing' }, '5sing'),
              h('option', { value: 'wusunk' }, '无损控'),
              ...(store.state.musicSources ?? []).filter((m) => m.enabled !== false).map((m) => h('option', { key: m.id, value: `custom:${m.id}` }, `${m.name}（自定义）`))),
            h('span', { className: 'dshmp-pgnum' }, '搜索页的初始渠道'))),
        h('div', { className: 'dshmp-set-block' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            h('span', { className: 'dshmp-section' }, '自定义源'),
            h('span', { style: { flex: 1 } }),
            h('button', { className: 'dshmp-mini dshmp-addbtn', title: '添加自定义源', onClick: () => openSrc('new') }, '＋')),
          (s.state.musicSources ?? []).length === 0 ? h('div', { className: 'dshmp-empty' }, '还没有自定义源，点击 ＋ 添加') : h('div', { className: 'dshmp-srclist' },
            h('div', { className: 'hd' },
              h('span', { className: 'n dshmp-pgnum' }, '名称'),
              h('span', { className: 'v dshmp-pgnum' }, '版本'),
              h('span', { className: 'a dshmp-pgnum' }, '作者'),
              h('span', { className: 'o dshmp-pgnum' }, '操作')),
            ...(s.state.musicSources ?? []).map((m) => h('div', { className: 'rw', key: m.id },
              h('span', { className: 'n', title: m.error || (m.platforms?.length ? `覆盖：${m.platforms.join('、')}` : undefined) },
                m.name,
                m.error ? h('span', { className: 'dshmp-pgnum' }, '（加载失败）') : null,
                m.platforms?.length ? h('span', { className: 'dshmp-pgnum' }, ` · ${m.platforms.map((p) => ({ kuwo: '酷我', kugou: '酷狗', qq: 'QQ', netease: '网易云' }[p] ?? p)).join('、')}`) : null),
              h('span', { className: 'v' }, m.version || '—'),
              h('span', { className: 'a' }, m.author || '—'),
              h('span', { className: 'o' },
                h('input', {
                  type: 'checkbox', checked: m.enabled !== false, title: m.enabled !== false ? '已启用（点击停用）' : '已停用（点击启用）',
                  onChange: async (e) => {
                    try { store.state = await api('/music-source/toggle', { method: 'POST', body: JSON.stringify({ id: m.id, enabled: e.target.checked }) }); emit() }
                    catch (e2) { showToast(String(e2.message ?? e2)) }
                  },
                }),
                h('button', { className: 'dshmp-mini', title: '编辑脚本', onClick: () => openSrc(m.id) }, '编辑'),
                h('button', {
                  className: 'dshmp-mini', title: '删除', onClick: async () => {
                    try { store.state = await api('/music-source/remove', { method: 'POST', body: JSON.stringify({ id: m.id }) }); emit() }
                    catch (e2) { showToast(String(e2.message ?? e2)) }
                  },
                }, '删除')))))),
        h('div', { className: 'dshmp-set-block' },
          h('div', { className: 'dshmp-section' }, '快捷键'),
          h('div', { className: 'dshmp-empty' }, `默认 ${isMac ? '⌥ Option' : 'Ctrl+Alt'} + ←/→ 上一曲/下一曲 · P 播放暂停 · M 播放模式，可清除或重新录制`),
          [['prev', '上一曲'], ['next', '下一曲'], ['toggle', '播放/暂停'], ['mode', '切换播放模式']].map(([f, label]) =>
            h(HotkeyRow, { key: f, field: f, label }))),
        h('div', { className: 'dshmp-set-block' },
          h('div', { className: 'dshmp-subtabs' },
            h('button', { className: 'dshmp-tab' + (libTab === 'local' ? ' on' : ''), onClick: () => { setLibTab('local'); setDlMulti(false); setDlSel(new Set()) } }, `本地音乐（${locals.length}）`),
            h('button', { className: 'dshmp-tab' + (libTab === 'dl' ? ' on' : ''), onClick: () => { setLibTab('dl'); setDlMulti(false); setDlSel(new Set()) } }, `下载音乐（${s.state.downloads?.length ?? 0}）`),
            libTab === 'dl' && dlMulti ? h(PopConfirm, {
              btnClass: 'dshmp-mini danger', label: `删除（${dlSel.size}）`, title: '批量删除', disabled: dlSel.size === 0,
              hint: `删除选中的 ${dlSel.size} 首下载歌曲？`, onConfirm: () => removeDownload([...dlSel]),
            }) : null,
            libTab === 'dl' ? h('button', {
              className: 'dshmp-tab' + (dlMulti ? ' on' : ''),
              onClick: () => { setDlMulti(!dlMulti); setDlSel(new Set()) },
            }, dlMulti ? '取消多选' : '多选') : null,
            h('button', { className: 'dshmp-mini dshmp-addbtn', title: '播放全部', onClick: () => (libTab === 'local' ? playAllLocal() : playDownloads()) }, '▶ 播放全部')),
          libTab === 'local' && h('div', null,
            localErr ? h('div', { className: 'dshmp-empty' }, localErr) : null,
            !localErr && !localRows ? h('div', { className: 'dshmp-empty' }, '加载中…') : null,
            !localErr && localRows && localRows.length === 0 ? h('div', { className: 'dshmp-empty' }, '暂无本地歌单（在更多弹窗的播放列表页添加）') : null,
            localView.length ? h(TrackHead, { sort: lsort, onSort: (k) => setLSort(nextSort(lsort, k)), action: '编辑' }) : null,
            pageSlice(localView, lpage).map((t, i) => h(SongRow, {
              key: 'sl' + (t.id ?? '') + '/' + i,
              t, playing: isCurrent(t),
              onClick: () => playTrack(localView, (lpage - 1) * (store.state.settings.pageSize || 10) + i),
              actions: h('button', { className: 'dshmp-mini', title: '编辑信息', onClick: (e) => { e.stopPropagation(); startTrackEdit(t) } }, '编辑'),
            })),
            h(Pager, { total: localView.length, page: lpage, onChange: setLPage }),
            locals.length ? h('div', { className: 'dshmp-libline' },
              h('span', {}, '本地歌单：'),
              locals.map((pl) => h('span', { key: pl.id, className: 'dshmp-tag' }, `${pl.name} `,
                h('button', {
                  className: 'dshmp-xbtn', title: '删除歌单',
                  onClick: async (e) => {
                    e.stopPropagation()
                    if (!window.confirm(`删除歌单「${pl.name}」？（不会删除本地文件）`)) return
                    setErr('')
                    try { store.state = await api('/playlist/remove', { method: 'POST', body: JSON.stringify({ id: pl.id }) }); emit() }
                    catch (e2) { setErr(String(e2.message ?? e2)) }
                  },
                }, '✕')))) : null),
          libTab === 'dl' && h('div', null,
            h(TrackHead, {
              sort: dsort, onSort: (k) => setDSort(nextSort(dsort, k)),
              action: dlMulti
                ? h(CheckAll, {
                    all: dlAllSel, some: dlSel.size > 0,
                    onChange: () => setDlSel(dlAllSel ? new Set() : new Set(dlView.map((d) => d.id))),
                  })
                : '操作',
            }),
            pageSlice(dlView, sdpage).map((d, i) => h(SongRow, {
              key: 'sd' + d.id + '/' + i,
              t: d, playing: isCurrent(d),
              sub: `${d.artist || ''}${d.album ? ' · ' + d.album : ''}`,
              chk: dlMulti ? h('input', { className: 'dshmp-chk', type: 'checkbox', checked: dlSel.has(d.id), readOnly: true }) : null,
              onClick: () => {
                if (!dlMulti) return
                setDlSel((prev) => {
                  const n = new Set(prev)
                  if (n.has(d.id)) n.delete(d.id)
                  else n.add(d.id)
                  return n
                })
              },
              actions: dlMulti ? null : h('span', { className: 'dshmp-act2' },
                h('button', { className: 'dshmp-mini', title: '编辑信息', onClick: (e) => { e.stopPropagation(); startEdit(d) } }, '编辑'),
                h(PopConfirm, {
                  btnClass: 'dshmp-delbtn', label: h(TrashIcon), title: '删除',
                  hint: `删除「${d.title}」的下载文件？`, onConfirm: () => removeDownload([d.id]),
                })),
            })),
            h(Pager, { total: dlView.length, page: sdpage, onChange: setSdPage }),
            dlView.length === 0 ? h('div', { className: 'dshmp-empty' }, '暂无下载') : null)))
      return h('div', { className: 'dshmp-setwrap' }, inner, saveBar)
    }

    function SettingsLogin({ platform, onClose }) {
      const [qr, setQr] = useState(null)
      const [cookie, setCookie] = useState('')
      const [msg, setMsg] = useState('')
      const [err, setErr] = useState('')
      useEffect(() => {
        if (platform === 'netease' || platform === 'kugou' || platform === 'qq' || platform === 'soda') {
          api('/qr-start', { method: 'POST', body: JSON.stringify({ platform }) }).then((r) => setQr(r)).catch((e) => setErr(String(e.message ?? e)))
        }
      }, [platform])
      useEffect(() => {
        if (!qr?.key) return
        const timer = setInterval(async () => {
          try {
            const j = await api(`/qr-poll?key=${encodeURIComponent(qr.key)}&platform=${encodeURIComponent(platform)}`)
            if (j.code === 801) setMsg('等待扫码…')
            else if (j.code === 802) setMsg(`已扫码，请在手机上确认（${j.nickname || ''}）`)
            else if (j.code === 803) {
              clearInterval(timer)
              store.state = await api('/state')
              emit(); onClose()
            }
          } catch (e) { setErr(String(e.message ?? e)) }
        }, 2000)
        return () => clearInterval(timer)
      }, [qr && qr.key])
      if (platform === 'kuwo') {
        return h('div', { className: 'dshmp-editbox' }, h(KuwoSmsForm, { onDone: onClose }))
      }
      if (platform === 'bilibili') {
        return h('div', { className: 'dshmp-editbox' },
          h('textarea', {
            className: 'dshmp-input dshmp-inputarea',
            placeholder: '粘贴浏览器中 bilibili.com 的 cookie（需包含 SESSDATA）',
            value: cookie, onChange: (e) => setCookie(e.target.value),
          }),
          err ? h('div', { className: 'dshmp-empty' }, err) : null,
          h('div', { style: { display: 'flex', gap: 6 } },
            h('button', {
              className: 'dshmp-mini primary',
              onClick: async () => {
                setErr('')
                try { await api('/login-cookie', { method: 'POST', body: JSON.stringify({ cookie }) }); store.state = await api('/state'); emit(); onClose() }
                catch (e) { setErr(String(e.message ?? e)) }
              },
            }, '登录'),
            h('button', { className: 'dshmp-mini', onClick: onClose }, '取消')))
      }
      const label = { netease: '网易云', kugou: '酷狗', qq: 'QQ音乐', soda: '汽水（抖音）' }[platform] ?? platform
      return h('div', { className: 'dshmp-editbox' },
        err ? h('div', { className: 'dshmp-empty' }, err)
          : qr ? h('img', { src: qr.qrimg, alt: '二维码', style: { width: 200 } }) : h('div', { className: 'dshmp-empty' }, '生成二维码…'),
        h('div', { className: 'dshmp-empty' }, msg || `请用${label} App 扫码`),
        h('button', { className: 'dshmp-mini', onClick: onClose }, '取消'))
    }

    // Settings nav glyph: overrides the shell's default gear for our section id
    // (slot `settings.section.icon`; label option is not displayed, size/active are owner props).
    function SettingsSectionIcon({ size = 16 }) {
      return h(NoteGlyph, { size })
    }

    // Exposed for tests/self-check.mjs; the host loader ignores extra props.
    const plugin = {
      inject: ['slots'],
      apply(ctx) {
        clientCtx = ctx
        ctx.slots.inject('conversation.session.header.utilities', () =>
          ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-music-player', order: -1000 }, MiniPlayer))
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register({ name: 'settings.section', id: 'dsh-music-player', order: 65, label: '音乐播放器' }, SettingsPage))
        ctx.slots.inject('settings.section.icon', () =>
          ctx.slots.register({ name: 'settings.section.icon', id: 'dsh-music-player' }, SettingsSectionIcon))
      },
      __pure: { parseLrc, fmtTime, pickNextIndex, nextMode, decodeBytes, dlRing, PAGE_SIZE, safePage, comboOf, sortRows, nextSort, highlightJs },
    }
    return plugin
  },
})
