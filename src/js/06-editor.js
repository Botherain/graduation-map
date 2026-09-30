/* ============================================================
 * 06-editor.js — 自动布局、拖拽微调、吸附、属性面板、外观绑定
 * ============================================================ */
CF.zoom = 1;

/* ---------------- 元素工厂 ---------------- */
function mkEl(type, opts) {
  return Object.assign({
    id: CF.uid(), type: type, x: 0, y: 0, w: 100, h: 100, rot: 0,
    z: type === 'map' ? 3 : (type === 'legend' ? 8 : 10),
    locked: false, hidden: false, style: {}
  }, opts || {});
}
CF.findEl = function (id) { return CF.state.elements.find(function (e) { return e.id === id; }); };

/* ---------------- 自动布局 ---------------- */
CF.layoutAuto = function (silent) {
  const st = CF.state, W = st.canvas.w, H = st.canvas.h, m = st.layout.margin;
  const texts = st.elements.filter(function (e) { return e.type === 'text'; });  /* 保留用户文本框 */
  const els = [];
  const titleH = Math.max(70, Math.round(H * 0.082));
  const infoH = Math.max(96, Math.round(H * 0.115));
  const contentTop = m + titleH + 12;
  const contentBottom = H - m - infoH - 12;
  const totalW = W - 2 * m;
  const mapW = Math.round(totalW * 0.50);

  els.push(mkEl('title', { x: m, y: m, w: totalW, h: titleH, z: 10,
    style: { fontSize: Math.round(titleH * 0.40), lineHeight: 1.2 } }));
  els.push(mkEl('map', { x: m, y: contentTop, w: mapW - 8, h: contentBottom - contentTop, z: 3 }));
  els.push(mkEl('legend', { x: m + 12, y: contentBottom - 76, w: 176, h: 64, z: 8,
    style: { fontSize: 12, lineHeight: 1.4 } }));
  els.push(mkEl('info', { x: m, y: contentBottom + 12, w: totalW, h: infoH, z: 10,
    style: { fontSize: Math.max(13, Math.round(H * 0.0115)), lineHeight: 1.65 } }));
  texts.forEach(function (t) { els.push(t); });
  st.elements = els;
  CF.layoutBlocks();
  if (!silent) CF.toast('已重新自动布局');
  CF.render(); CF.autosave();
};

/* 计算文字块估算高度 */
CF.blockEstH = function (count, fs) {
  const st = CF.state;
  const headH = fs * 1.12 * 1.5 + 8;
  const rowH = fs * 1.5 + 3 + st.layout.rowGap;
  return Math.ceil(headH + count * rowH + 14);
};

/* 文字块流式排布：列宽撑满区域，字号自动放大以填充垂直空间 */
CF._flowBlocks = function (zoneX, zoneW, zoneTop, zoneH, fs) {
  const st = CF.state;
  const groups = CF.groups();
  const gap = 14;
  const cols = Math.max(1, Math.floor((zoneW + gap) / (st.layout.blockW + gap)));
  const colW = Math.floor((zoneW - (cols - 1) * gap) / cols);
  const colY = [];
  for (let i = 0; i < cols; i++) colY.push(zoneTop);
  const els = [];
  groups.forEach(function (g) {
    let ci = 0;
    for (let i = 1; i < cols; i++) if (colY[i] < colY[ci]) ci = i;
    const h = CF.blockEstH(g.count, fs);
    els.push(mkEl('block', {
      prov: g.short, x: zoneX + ci * (colW + gap), y: colY[ci], w: colW, h: h, z: 10,
      style: { fontSize: fs, lineHeight: 1.5 }
    }));
    colY[ci] += h + 12;
  });
  const maxEnd = Math.max.apply(null, colY);
  return { els: els, maxEnd: maxEnd, cols: cols };
};
CF.layoutBlocks = function () {
  const st = CF.state;
  const W = st.canvas.w, m = st.layout.margin;
  const mapEl = st.elements.find(function (e) { return e.type === 'map'; });
  const zoneX = mapEl ? mapEl.x + mapEl.w + 12 : m;
  const zoneW = W - m - zoneX;
  const zoneTop = mapEl ? mapEl.y : m + 100;
  const zoneH = mapEl ? mapEl.h : (st.canvas.h - zoneTop - m);
  let best = null;
  for (let fs = 24; fs >= 11; fs--) {
    const flow = CF._flowBlocks(zoneX, zoneW, zoneTop, zoneH, fs);
    if (flow.maxEnd <= zoneTop + zoneH) { best = flow; break; }
    best = flow;   /* 放不下则继续尝试更小字号 */
  }
  st.elements = st.elements.filter(function (e) { return e.type !== 'block'; });
  best.els.forEach(function (e) { st.elements.push(e); });
};

/* 新数据出现新省份 → 补充块（不打扰已手动摆放的块） */
CF.layoutEnsureBlocks = function () {
  const st = CF.state;
  if (!st.elements.length) return;
  const groups = CF.groups();
  const have = {};
  st.elements.forEach(function (e) { if (e.type === 'block') have[e.prov] = e; });
  let changed = false;
  /* 删除已无学生的块 */
  st.elements = st.elements.filter(function (e) {
    if (e.type !== 'block') return true;
    const ok = groups.some(function (g) { return g.short === e.prov; });
    if (!ok) changed = true;
    return ok;
  });
  /* 新增块：放进已用块中最空的列位置（简单：右侧区域底部找空位） */
  const missing = groups.filter(function (g) { return !have[g.short]; });
  if (missing.length) {
    if (!st.elements.some(function (e) { return e.type === 'block'; })) { CF.layoutBlocks(); changed = true; }
    else {
      const W = st.canvas.w, m = st.layout.margin;
      const mapEl = st.elements.find(function (e) { return e.type === 'map'; });
      const zoneX = mapEl ? mapEl.x + mapEl.w + 12 : m;
      const zoneW = W - m - zoneX;
      const gap = 14;
      const cols = Math.max(1, Math.floor((zoneW + gap) / (st.layout.blockW + gap)));
      const colW = Math.floor((zoneW - (cols - 1) * gap) / cols);
      const used = st.elements.filter(function (e) { return e.type === 'block'; });
      const zoneTop = mapEl ? mapEl.y : m + 100;
      const colY = [];
      for (let i = 0; i < cols; i++) {
        colY.push(used.filter(function (e) { return Math.abs(e.x - (zoneX + i * (colW + gap))) < 4; })
          .reduce(function (mx, e) { return Math.max(mx, e.y + e.h + 12); }, zoneTop));
      }
      missing.forEach(function (g) {
        let ci = 0;
        for (let i = 1; i < cols; i++) if (colY[i] < colY[ci]) ci = i;
        const fs = used.length ? (used[0].style.fontSize || 13) : 13;
        const h = CF.blockEstH(g.count, fs);
        const el = mkEl('block', { prov: g.short, x: zoneX + ci * (colW + gap), y: colY[ci],
          w: colW, h: h, z: 10, style: { fontSize: fs, lineHeight: 1.5 } });
        colY[ci] += h + 12;
        st.elements.push(el);
        changed = true;
      });
    }
  }
  return changed;
};

/* ---------------- 选择 ---------------- */
CF.selectEl = function (id) {
  CF.sel = id;
  CF.$$('#poster .el').forEach(function (d) {
    d.classList.toggle('selected', d.dataset.id === id);
  });
  const pp = document.getElementById('propPanel');
  pp.hidden = !id;
  if (id) CF.ppPopulate();
  CF.renderStatus();
};

/* ---------------- 拖拽 / 缩放 / 吸附 ---------------- */
/* 元素几何收回画布内（#poster 为 overflow:hidden，越界内容会被裁掉） */
CF.clampEl = function (el) {
  const W = CF.state.canvas.w, H = CF.state.canvas.h;
  el.w = Math.max(20, Math.min(Math.round(el.w), W));
  el.h = Math.max(16, Math.min(Math.round(el.h), H));
  el.x = Math.max(0, Math.min(Math.round(el.x), W - el.w));
  el.y = Math.max(0, Math.min(Math.round(el.y), H - el.h));
  return el;
};
CF.bindCanvas = function () {
  const poster = document.getElementById('poster');
  let drag = null;
  let guides = null;

  const ensureGuides = function () {
    if (!guides) {
      const gv = document.createElement('div'); gv.className = 'guide gv';
      const gh = document.createElement('div'); gh.className = 'guide gh';
      gv.style.cssText = 'width:1px;top:0;bottom:0;';
      gh.style.cssText = 'height:1px;left:0;right:0;';
      poster.appendChild(gv); poster.appendChild(gh);
      guides = { v: gv, h: gh };
    }
  };
  const hideGuides = function () {
    if (guides) { guides.v.style.display = 'none'; guides.h.style.display = 'none'; }
  };

  poster.addEventListener('pointerdown', function (e) {
    const hnd = e.target.closest('.h');
    const elDiv = e.target.closest('.el');
    if (!elDiv) { CF.selectEl(null); return; }
    const el = CF.findEl(elDiv.dataset.id);
    if (!el) return;
    if (CF.sel !== el.id) CF.selectEl(el.id);
    if (el.locked) return;
    drag = {
      mode: hnd ? 'r' : 'm', corner: hnd ? hnd.className.match(/h-(\w\w)/)[1] : null,
      sx: e.clientX, sy: e.clientY, x0: el.x, y0: el.y, w0: el.w, h0: el.h, el: el,
      moved: false
    };
    poster.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  poster.addEventListener('pointermove', function (e) {
    if (!drag) return;
    const st = CF.state;
    const dx = (e.clientX - drag.sx) / CF.zoom;
    const dy = (e.clientY - drag.sy) / CF.zoom;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    const el = drag.el;
    const snapOn = st.layout.snap && !e.altKey;

    if (drag.mode === 'm') {
      let nx = drag.x0 + dx, ny = drag.y0 + dy;
      if (snapOn) {
        ensureGuides();
        const thr = 6;
        const W = st.canvas.w, H = st.canvas.h;
        const xs = [0, W / 2, W], ys = [0, H / 2, H];
        const others = st.elements.filter(function (o) { return o.id !== el.id && !o.hidden; });
        others.forEach(function (o) {
          xs.push(o.x, o.x + o.w / 2, o.x + o.w);
          ys.push(o.y, o.y + o.h / 2, o.y + o.h);
        });
        let bestX = null, bestY = null;
        [[nx, 0], [nx + el.w / 2, el.w / 2], [nx + el.w, el.w]].forEach(function (p) {
          xs.forEach(function (t) { const d = Math.abs(p[0] - t);
            if (d < thr && (!bestX || d < bestX.d)) bestX = { d: d, v: t - p[1], g: t }; });
        });
        [[ny, 0], [ny + el.h / 2, el.h / 2], [ny + el.h, el.h]].forEach(function (p) {
          ys.forEach(function (t) { const d = Math.abs(p[0] - t);
            if (d < thr && (!bestY || d < bestY.d)) bestY = { d: d, v: t - p[1], g: t }; });
        });
        if (bestX) { nx = bestX.v; guides.v.style.display = 'block'; guides.v.style.left = bestX.g + 'px'; }
        else guides.v.style.display = 'none';
        if (bestY) { ny = bestY.v; guides.h.style.display = 'block'; guides.h.style.top = bestY.g + 'px'; }
        else guides.h.style.display = 'none';
      } else hideGuides();
      /* 限制在画布内：吸附目标也可能是越界的旧元素坐标 */
      el.x = Math.max(0, Math.min(Math.round(nx), st.canvas.w - el.w));
      el.y = Math.max(0, Math.min(Math.round(ny), st.canvas.h - el.h));
    } else {
      const c = drag.corner;
      const minW = 40, minH = 26;
      let x = drag.x0, y = drag.y0, w = drag.w0, h = drag.h0;
      if (c === 'se') { w = drag.w0 + dx; h = drag.h0 + dy; }
      else if (c === 'ne') { w = drag.w0 + dx; y = drag.y0 + dy; h = drag.h0 - dy; }
      else if (c === 'sw') { x = drag.x0 + dx; w = drag.w0 - dx; h = drag.h0 + dy; }
      else if (c === 'nw') { x = drag.x0 + dx; y = drag.y0 + dy; w = drag.w0 - dx; h = drag.h0 - dy; }
      if (w < minW) { if (c === 'nw' || c === 'sw') x = drag.x0 + (drag.w0 - minW); w = minW; }
      if (h < minH) { if (c === 'nw' || c === 'ne') y = drag.y0 + (drag.h0 - minH); h = minH; }
      /* 越界收紧：拖出画布的边压回边界，锚定边保持不动 */
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      if (x + w > st.canvas.w) w = st.canvas.w - x;
      if (y + h > st.canvas.h) h = st.canvas.h - y;
      if (w < 8) w = 8;
      if (h < 8) h = 8;
      el.x = Math.round(x); el.y = Math.round(y); el.w = Math.round(w); el.h = Math.round(h);
    }
    const d2 = poster.querySelector('.el[data-id="' + el.id + '"]');
    if (d2) {
      d2.style.left = el.x + 'px'; d2.style.top = el.y + 'px';
      d2.style.width = el.w + 'px'; d2.style.height = el.h + 'px';
    }
    if (CF.sel === el.id) CF.ppPopulate(true);
  });

  const up = function (e) {
    if (!drag) return;
    const el = drag.el;
    drag = null;
    hideGuides();
    if (el.type === 'map') CF.mapUpdate();
    CF.renderLines();
    CF.autosave();
  };
  poster.addEventListener('pointerup', up);
  poster.addEventListener('pointercancel', up);

  /* 双击：文本框 → 属性面板聚焦 */
  poster.addEventListener('dblclick', function (e) {
    const elDiv = e.target.closest('.el');
    if (!elDiv) return;
    const el = CF.findEl(elDiv.dataset.id);
    if (el && el.type === 'text') { CF.selectEl(el.id); document.getElementById('ppContent').focus(); }
  });

  /* 键盘 */
  document.addEventListener('keydown', function (e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (!CF.sel) return;
    const el = CF.findEl(CF.sel);
    if (!el) return;
    const step = e.shiftKey ? 10 : 1;
    let used = true;
    if (e.key === 'ArrowLeft') el.x -= step;
    else if (e.key === 'ArrowRight') el.x += step;
    else if (e.key === 'ArrowUp') el.y -= step;
    else if (e.key === 'ArrowDown') el.y += step;
    else if (e.key === 'Escape') { CF.selectEl(null); return; }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      el.hidden = true; CF.selectEl(null); CF.toast('已隐藏「' + CF.elName(el) + '」，可在属性面板恢复');
    } else used = false;
    if (used) {
      e.preventDefault();
      CF.syncElements(); CF.renderLines(); CF.ppPopulate(true); CF.autosave();
    }
  });
};

/* ---------------- 属性面板 ---------------- */
CF.ppPopulate = function (keepFocus) {
  const el = CF.sel ? CF.findEl(CF.sel) : null;
  if (!el) { document.getElementById('propPanel').hidden = true; return; }
  document.getElementById('propPanel').hidden = false;
  document.getElementById('ppTitle').textContent = CF.elName(el);
  const set = function (id, v) {
    const n = document.getElementById(id);
    if (keepFocus && document.activeElement === n) return;
    n.value = v;
  };
  set('ppX', el.x); set('ppY', el.y); set('ppW', el.w); set('ppH', el.h);
  const css = el.style || (el.style = {});
  set('ppFont', css.fontSize || '');
  set('ppLh', css.lineHeight || '');
  set('ppColor', css.color || '#000000');
  set('ppBg', css.bg || '#ffffff');
  document.getElementById('ppBgNone').checked = !css.bg;
  const opPct = Math.round((css.op != null ? css.op : 1) * 100);
  set('ppOp', opPct);
  document.getElementById('ppOpVal').textContent = opPct + '%';
  const isText = el.type === 'text';
  document.getElementById('ppContent').disabled = !isText;
  document.getElementById('ppContent').value = isText ? (el.content || '') : '';
  document.getElementById('ppLock').textContent = el.locked ? '解锁' : '锁定';
  document.getElementById('ppHide').textContent = el.hidden ? '显示' : '隐藏';
};
CF.ppBind = function () {
  const bind = function (id, fn) {
    document.getElementById(id).addEventListener('input', function (e) {
      const el = CF.sel && CF.findEl(CF.sel); if (!el) return;
      fn(el, e.target.value);
      CF.syncElements(); CF.renderLines(); CF.autosave();
    });
  };
  bind('ppX', function (el, v) { el.x = +v || 0; });
  bind('ppY', function (el, v) { el.y = +v || 0; });
  bind('ppW', function (el, v) { el.w = Math.max(20, +v || 20); });
  bind('ppH', function (el, v) { el.h = Math.max(16, +v || 16); });
  bind('ppFont', function (el, v) { el.style.fontSize = Math.max(6, +v || 13); });
  bind('ppLh', function (el, v) { el.style.lineHeight = Math.max(0.8, +v || 1.5); });
  bind('ppColor', function (el, v) { el.style.color = v; });
  bind('ppBg', function (el, v) { el.style.bg = v; });
  bind('ppOp', function (el, v) {
    el.style.op = Math.max(0.05, (+v || 100) / 100);
    document.getElementById('ppOpVal').textContent = Math.round(el.style.op * 100) + '%';
  });
  bind('ppContent', function (el, v) { el.content = v; });
  document.getElementById('ppBgNone').addEventListener('change', function (e) {
    const el = CF.sel && CF.findEl(CF.sel); if (!el) return;
    if (e.target.checked) delete el.style.bg; else el.style.bg = '#ffffff';
    CF.syncElements(); CF.autosave();
  });
  document.getElementById('ppClose').onclick = function () { CF.selectEl(null); };
  document.getElementById('ppFront').onclick = function () {
    const el = CF.findEl(CF.sel); if (!el) return;
    el.z = Math.max.apply(null, CF.state.elements.map(function (e) { return e.z || 10; })) + 1;
    CF.syncElements(); CF.autosave();
  };
  document.getElementById('ppBack').onclick = function () {
    const el = CF.findEl(CF.sel); if (!el) return;
    el.z = Math.min.apply(null, CF.state.elements.map(function (e) { return e.z || 10; })) - 1;
    CF.syncElements(); CF.autosave();
  };
  document.getElementById('ppLock').onclick = function () {
    const el = CF.findEl(CF.sel); if (!el) return;
    el.locked = !el.locked; CF.syncElements(); CF.ppPopulate(true);
  };
  document.getElementById('ppHide').onclick = function () {
    const el = CF.findEl(CF.sel); if (!el) return;
    el.hidden = !el.hidden;
    if (el.hidden) CF.selectEl(null); else { CF.syncElements(); CF.ppPopulate(true); }
    CF.renderLines(); CF.autosave();
  };
};

/* ---------------- 缩放 ---------------- */
CF.applyZoom = function () {
  const st = CF.state;
  const stage = document.getElementById('stage');
  stage.style.transform = 'scale(' + CF.zoom + ')';
  stage.style.width = (st.canvas.w * CF.zoom + 60) + 'px';
  stage.style.height = (st.canvas.h * CF.zoom + 60) + 'px';
  document.getElementById('zoomLabel').textContent = Math.round(CF.zoom * 100) + '%';
};
CF.zoomFit = function () {
  const wrap = document.getElementById('stageWrap');
  const st = CF.state;
  const z = Math.min((wrap.clientWidth - 50) / st.canvas.w, (wrap.clientHeight - 50) / st.canvas.h, 1.4);
  CF.zoom = Math.max(0.15, z);
  CF.applyZoom();
};

/* ---------------- 外观面板 ---------------- */
CF.syncLookPanel = function () {
  const st = CF.state, t = CF.theme();
  CF.$$('#themeCards .theme-card').forEach(function (c) {
    c.classList.toggle('active', c.dataset.id === st.themeId && !st.custom);
  });
  document.getElementById('cBase').value = t.base;
  document.getElementById('cAccent').value = t.accent;
  document.getElementById('cBg').value = t.bg;
  document.getElementById('cEmph').value = t.emA;
  document.getElementById('cLow').value = t.low;
  document.getElementById('rGamma').value = t.gamma;
  document.getElementById('gammaVal').textContent = t.gamma;
  const sel = document.getElementById('selFont');
  sel.value = st.font;
  const pv = document.getElementById('fontPreview');
  const f = CF.FONT_CANDIDATES.find(function (x) { return x.label === st.font; });
  pv.style.fontFamily = (f ? f.css : '') + ', sans-serif';
  CF.$$('#artCards .art-card').forEach(function (c) {
    c.classList.toggle('active', c.dataset.id === st.art);
    c.className = 'art-card art-' + c.dataset.id + (c.dataset.id === st.art ? ' active' : '');
  });
  CF.renderCellCards();
};
CF.customSet = function (key, val) {
  const st = CF.state;
  if (!st.custom) {
    const base = CF.THEMES.find(function (x) { return x.id === st.themeId; }) || CF.THEMES[0];
    st.custom = Object.assign({}, base);
  }
  st.custom[key] = val;
  /* 背景明暗联动文字/块底色 */
  if (key === 'bg') {
    const dark = (CF.hex2rgb(val)[0] * 0.299 + CF.hex2rgb(val)[1] * 0.587 + CF.hex2rgb(val)[2] * 0.114) < 118;
    const th = CF.THEMES.find(function (x) { return x.id === st.themeId; }) || CF.THEMES[0];
    st.custom.ink = dark ? '#f2ecdd' : th.ink;
    st.custom.blkBg = dark ? 'rgba(24,28,36,.92)' : th.blkBg;
  }
  if (key === 'emA') st.custom.emB = CF.mix(val, '#ffffff', 0.45);
};
/* ---------------- 外观预设卡片（栏头 / 名单行 / 地图角度） ---------------- */
CF.renderCellCards = function () {
  const st = CF.state;
  const mkPvwHead = function (it) {
    switch (it.id) {
      case 'grad': return 'background:linear-gradient(100deg,#3b82f6,#93c5fd);';
      case 'outline': return 'background:transparent;box-shadow:inset 0 0 0 1.5px #3b82f6;';
      case 'underline': return 'background:#e8edf5;border-bottom:3px solid #3b82f6;';
      case 'invert': return 'background:#26303f;';
      case 'pill': return 'border-radius:99px;background:#3b82f6;';
      default: return 'background:#3b82f6;';
    }
  };
  const mkPvwRow = function (it) {
    switch (it.id) {
      case 'line': return 'background:repeating-linear-gradient(#e8edf5 0 3px,#aab6c4 3px 4px);';
      case 'zebra': return 'background:repeating-linear-gradient(#e8edf5 0 4px,#c6d0dc 4px 8px);';
      case 'card': return 'background:#e8edf5;box-shadow:inset 0 0 0 1px #aab6c4;border-radius:3px;';
      default: return 'background:#e8edf5;';
    }
  };
  const mkPvwAngle = function (it) {
    switch (it.id) {
      case 'soft': return 'background:linear-gradient(#dbe4ee,#bcc9da);';
      case 'top': return 'background:linear-gradient(#dbe4ee,#a5b8cf);';
      case 'side': return 'background:linear-gradient(115deg,#dbe4ee,#9fb2ca);';
      default: return 'background:#d7e0ec;';
    }
  };
  const build = function (hostId, list, isActive, mkPvw) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = list.map(function (it) {
      return '<div class="cell-card' + (isActive(it) ? ' active' : '') + '" data-id="' + it.id + '">' +
        '<span class="pvw" style="' + mkPvw(it) + '"></span>' + it.name + '</div>';
    }).join('');
  };
  build('headCards', CF.HEAD_STYLES,
    function (it) { return (st.cell.head || 'solid') === it.id; }, mkPvwHead);
  build('rowCards', CF.ROW_STYLES,
    function (it) { return (st.cell.row || 'plain') === it.id; }, mkPvwRow);
  build('angleCards', CF.ANGLE_STYLES, function (it) {
    const m = st.map;
    return (m.tilt || 0) === it.tilt && (m.rot || 0) === it.rot;
  }, mkPvwAngle);
  const pick = function (hostId, fn) {
    CF.$$('#' + hostId + ' .cell-card').forEach(function (c) {
      c.onclick = function () { fn(c.dataset.id); CF.syncLookPanel(); CF.render(); CF.autosave(); };
    });
  };
  pick('headCards', function (id) { st.cell.head = id; });
  pick('rowCards', function (id) { st.cell.row = id; });
  pick('angleCards', function (id) {
    const a = CF.ANGLE_STYLES.find(function (x) { return x.id === id; });
    if (!a) return;
    st.map.tilt = a.tilt; st.map.rot = a.rot;
    document.getElementById('rTilt').value = a.tilt;
    document.getElementById('tiltVal').textContent = a.tilt + '°';
    document.getElementById('rRot').value = a.rot;
    document.getElementById('rotVal').textContent = a.rot + '°';
  });
};

CF.bindLookPanel = function () {
  const st = CF.state;
  /* 主题卡 */
  document.getElementById('themeCards').innerHTML = CF.THEMES.map(function (t) {
    return '<div class="theme-card" data-id="' + t.id + '"><div class="sw">' +
      '<i style="background:' + t.bg + '"></i><i style="background:' + t.low + '"></i>' +
      '<i style="background:' + t.base + '"></i><i style="background:' + t.accent + '"></i></div>' +
      '<div class="nm">' + t.name + '</div></div>';
  }).join('');
  CF.$$('#themeCards .theme-card').forEach(function (c) {
    c.onclick = function () {
      st.themeId = c.dataset.id; st.custom = null;
      CF.syncLookPanel(); CF.render(); CF.autosave();
    };
  });
  /* 自定义颜色 */
  const bindC = function (id, key) {
    document.getElementById(id).addEventListener('input', function (e) {
      CF.customSet(key, e.target.value);
      CF.render(); CF.autosave();
      CF.$$('#themeCards .theme-card').forEach(function (c) { c.classList.remove('active'); });
    });
  };
  bindC('cBase', 'base'); bindC('cAccent', 'accent'); bindC('cBg', 'bg');
  bindC('cEmph', 'emA'); bindC('cLow', 'low');
  document.getElementById('rGamma').addEventListener('input', function (e) {
    document.getElementById('gammaVal').textContent = e.target.value;
    CF.customSet('gamma', +e.target.value);
    CF.render(); CF.autosave();
  });
  /* 字体 */
  const fonts = CF.detectFonts();
  const sel = document.getElementById('selFont');
  sel.innerHTML = fonts.map(function (f) { return '<option>' + f.label + '</option>'; }).join('');
  if (!fonts.some(function (f) { return f.label === st.font; })) st.font = fonts[fonts.length - 1].label;
  sel.value = st.font;
  sel.onchange = function () { st.font = sel.value; CF.syncLookPanel(); CF.render(); CF.autosave(); };
  /* 艺术字 */
  document.getElementById('artCards').innerHTML = CF.ART_STYLES.map(function (a) {
    return '<div class="art-card art-' + a.id + '" data-id="' + a.id + '">蹭饭图<span class="nm">' + a.name + '</span></div>';
  }).join('');
  CF.$$('#artCards .art-card').forEach(function (c) {
    c.onclick = function () { st.art = c.dataset.id; CF.syncLookPanel(); CF.render(); CF.autosave(); };
  });
  /* 画布 */
  const presets = CF.CANVAS_PRESETS;
  const applyCanvas = function () {
    CF.applyPosterSize();
    CF.layoutAuto(false);
    CF.zoomFit();
  };
  document.getElementById('selCanvas').onchange = function (e) {
    const v = e.target.value;
    st.canvas.preset = v;
    const prevW = st.canvas.w, prevH = st.canvas.h;
    if (v === '114') {
      /* 比例项：保持宽度不变，按 1:1.414 重算高度（已接近则不动） */
      const nh = Math.round(st.canvas.w * 1.414);
      if (Math.abs(nh - st.canvas.h) > 2) st.canvas.h = nh;
    } else {
      const p = presets[v];
      if (p) { st.canvas.w = p[0]; st.canvas.h = p[1]; }
    }
    document.getElementById('inCw').value = st.canvas.w;
    document.getElementById('inCh').value = st.canvas.h;
    /* 尺寸没变就不重排版，避免误触把手动排版重置掉 */
    if (st.canvas.w !== prevW || st.canvas.h !== prevH) applyCanvas();
    else CF.autosave();
  };
  const chg = function () {
    const w = Math.max(400, +document.getElementById('inCw').value || 1240);
    const h = Math.max(400, +document.getElementById('inCh').value || 1754);
    const changed = (w !== st.canvas.w || h !== st.canvas.h);
    st.canvas.w = w; st.canvas.h = h;
    st.canvas.preset = 'custom';
    document.getElementById('selCanvas').value = 'custom';
    if (changed) applyCanvas();
    else CF.autosave();
  };
  document.getElementById('inCw').onchange = chg;
  document.getElementById('inCh').onchange = chg;
  /* 输入框里按回车立即提交（确保 change 一定触发） */
  ['inCw', 'inCh'].forEach(function (id) {
    document.getElementById(id).onkeydown = function (e) {
      if (e.key === 'Enter') e.target.blur();
    };
  });

  /* 排版参数 */
  const rM = document.getElementById('rMargin');
  rM.oninput = function () { st.layout.margin = +rM.value; document.getElementById('marginVal').textContent = rM.value; CF.autosave(); };
  const rB = document.getElementById('rBlockW');
  rB.oninput = function () {
    st.layout.blockW = +rB.value; document.getElementById('blockWVal').textContent = rB.value;
    st.elements.forEach(function (e) { if (e.type === 'block') e.w = +rB.value; });
    CF.render(); CF.autosave();
  };
  const rR = document.getElementById('rRowGap');
  rR.oninput = function () { st.layout.rowGap = +rR.value; document.getElementById('rowGapVal').textContent = rR.value; CF.render(); CF.autosave(); };
  document.getElementById('ckScore').onchange = function (e) { st.layout.showScore = e.target.checked; CF.render(); CF.autosave(); };
  document.getElementById('ckRegion').onchange = function (e) { st.layout.regionOrder = e.target.checked; CF.render(); CF.autosave(); };
  document.getElementById('ckSnap').onchange = function (e) { st.layout.snap = e.target.checked; };

  /* 背景图片 */
  document.getElementById('btnBgPick').onclick = function () { document.getElementById('fileBg').click(); };
  document.getElementById('fileBg').onchange = function (e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { CF.toast('请选择图片文件（png/jpg/webp/gif/bmp/svg）'); e.target.value = ''; return; }
    const fr = new FileReader();
    fr.onload = function () {
      st.bg.img = String(fr.result);
      CF.render(); CF.autosave();
      CF.toast('背景已应用' + (fr.result.length > 3000000 ? '（图片较大，超出浏览器存储容量时将无法自动保存）' : ''));
      e.target.value = '';
    };
    fr.onerror = function () { CF.toast('图片读取失败'); e.target.value = ''; };
    fr.readAsDataURL(f);
  };
  document.getElementById('btnBgClear').onclick = function () {
    st.bg.img = null; CF.render(); CF.autosave(); CF.toast('背景已移除');
  };
  document.getElementById('selBgMode').onchange = function (e) { st.bg.mode = e.target.value; CF.render(); CF.autosave(); };
  document.getElementById('rBgOp').oninput = function (e) {
    st.bg.op = +e.target.value / 100;
    document.getElementById('bgOpVal').textContent = e.target.value + '%';
    CF.render(); CF.autosave();
  };

  /* 元素不透明度（一键全部调整） */
  document.getElementById('rElOp').oninput = function (e) {
    const v = +e.target.value / 100;
    document.getElementById('elOpVal').textContent = e.target.value + '%';
    CF.state.elements.forEach(function (el) { el.style = el.style || {}; el.style.op = v; });
    CF.syncElements(); CF.autosave();
  };

  /* 单元格样式参数 */
  document.getElementById('rHeadRad').oninput = function (e) {
    st.cell.headRadius = +e.target.value;
    document.getElementById('headRadVal').textContent = e.target.value;
    CF.render(); CF.autosave();
  };
  document.getElementById('cHeadBg').oninput = function (e) { st.cell.headBg = e.target.value; CF.render(); CF.autosave(); };
  document.getElementById('cHeadFg').oninput = function (e) { st.cell.headFg = e.target.value; CF.render(); CF.autosave(); };
  document.getElementById('cRowSep').oninput = function (e) { st.cell.rowSep = e.target.value; CF.render(); CF.autosave(); };
  document.getElementById('rRowSepW').oninput = function (e) {
    st.cell.rowSepW = +e.target.value;
    document.getElementById('rowSepWVal').textContent = e.target.value;
    CF.render(); CF.autosave();
  };
  document.getElementById('cZebra').oninput = function (e) { st.cell.zebra = e.target.value; CF.render(); CF.autosave(); };
  document.getElementById('rRowRad').oninput = function (e) {
    st.cell.rowRadius = +e.target.value;
    document.getElementById('rowRadVal').textContent = e.target.value;
    CF.render(); CF.autosave();
  };
  CF.renderCellCards();

  /* 地图参数 */
  const ck = document.getElementById('ckInset');
  ck.onchange = function () { st.map.inset = ck.checked; CF.render(); CF.autosave(); };
  const rI = document.getElementById('rInset');
  rI.oninput = function () { st.map.insetSize = +rI.value; document.getElementById('insetVal').textContent = rI.value + '%'; CF.render(); CF.autosave(); };
  const rZ = document.getElementById('rMapZoom');
  rZ.oninput = function () { st.map.zoom = +rZ.value; document.getElementById('mapZoomVal').textContent = (+rZ.value).toFixed(2); CF.render(); CF.autosave(); };
  const rOx = document.getElementById('rMapOx');
  rOx.oninput = function () { st.map.ox = +rOx.value; document.getElementById('mapOxVal').textContent = rOx.value; CF.render(); CF.autosave(); };
  const rOy = document.getElementById('rMapOy');
  rOy.oninput = function () { st.map.oy = +rOy.value; document.getElementById('mapOyVal').textContent = rOy.value; CF.render(); CF.autosave(); };
  document.getElementById('btnMapReset').onclick = function () {
    st.map.zoom = 1; st.map.ox = 0; st.map.oy = 0;
    st.map.focus = false;
    CF._focusKey = null;
    document.getElementById('ckFocus').checked = false;
    CF.syncPanelFromState(); CF.render(); CF.toast('地图视角已恢复');
  };
  const rLW = document.getElementById('rLineW');
  rLW.oninput = function () { st.layout.lineW = +rLW.value; document.getElementById('lineWVal').textContent = rLW.value; CF.render(); CF.autosave(); };
  const rLO = document.getElementById('rLineO');
  rLO.oninput = function () { st.layout.lineO = +rLO.value; document.getElementById('lineOVal').textContent = rLO.value; CF.render(); CF.autosave(); };

  /* 地图角度 */
  document.getElementById('rTilt').oninput = function (e) {
    st.map.tilt = +e.target.value;
    document.getElementById('tiltVal').textContent = e.target.value + '°';
    CF.renderCellCards(); CF.render(); CF.autosave();
  };
  document.getElementById('rRot').oninput = function (e) {
    st.map.rot = +e.target.value;
    document.getElementById('rotVal').textContent = e.target.value + '°';
    CF.renderCellCards(); CF.render(); CF.autosave();
  };

  /* 聚焦到有学生的省份 */
  CF.syncMapSliders = function () {
    const m = CF.state.map;
    document.getElementById('rMapZoom').value = m.zoom;
    document.getElementById('mapZoomVal').textContent = Number(m.zoom).toFixed(2);
    document.getElementById('rMapOx').value = m.ox;
    document.getElementById('mapOxVal').textContent = m.ox;
    document.getElementById('rMapOy').value = m.oy;
    document.getElementById('mapOyVal').textContent = m.oy;
  };
  /* 聚焦开启时锁定缩放/平移滑杆：手动调会静默覆盖聚焦取景，
     导致省份被切出画面（聚焦勾选框还显示“聚焦中”，状态自相矛盾） */
  CF.syncFocusLock = function () {
    const on = !!CF.state.map.focus;
    ['rMapZoom', 'rMapOx', 'rMapOy'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = on;
      el.title = on ? '聚焦模式下视角自动取景，手动微调请先取消「缩放聚焦到有学生的省份」' : '';
    });
    const tip = document.getElementById('focusLockTip');
    if (tip) tip.hidden = !on;
  };
  const focusKey = function () {
    return CF.groups().map(function (g) { return g.short + ':' + g.count; }).join(',');
  };
  document.getElementById('ckFocus').onchange = function (e) {
    st.map.focus = e.target.checked;
    if (st.map.focus) {
      CF._focusing = true;
      const ok = CF.mapFocusApply();
      CF._focusing = false;
      CF._focusKey = focusKey();
      CF.syncMapSliders();
      CF.toast(ok ? '已聚焦到有学生的省份' : '没有可聚焦的省份');
    } else {
      st.map.zoom = 1; st.map.ox = 0; st.map.oy = 0;
      CF._focusKey = null;
      CF.syncMapSliders();
      CF.toast('已恢复完整中国视角');
    }
    CF.syncFocusLock();
    CF.render(); CF.autosave();
  };
  document.getElementById('btnFocusNow').onclick = function () {
    st.map.focus = true;
    document.getElementById('ckFocus').checked = true;
    CF._focusing = true;
    CF.mapFocusApply();
    CF._focusing = false;
    CF._focusKey = focusKey();
    CF.syncFocusLock();
    CF.syncMapSliders();
    CF.render(); CF.autosave();
  };

  /* 工具栏布局按钮 */
  document.getElementById('btnAutoLayout').onclick = function () { CF.layoutAuto(false); };
  document.getElementById('btnResetLayout').onclick = function () {
    CF.confirm('恢复默认自动布局？所有手动排版调整将丢失（名单与外观不受影响）。', function () {
      CF.layoutAuto(false);
    }, '恢复默认');
  };
  document.getElementById('btnAddText').onclick = function () {
    const st2 = CF.state;
    const el = mkEl('text', { x: Math.round(st2.canvas.w / 2 - 90), y: 40, w: 190, h: 46, z: 12,
      style: { fontSize: 18, lineHeight: 1.4 }, content: '' });
    st2.elements.push(el);
    CF.syncElements(); CF.selectEl(el.id); CF.autosave();
  };
  document.getElementById('btnGrid').onclick = function () {
    st.layout.grid = !st.layout.grid;
    document.getElementById('gridOverlay').hidden = !st.layout.grid;
    document.getElementById('btnGrid').style.outline = st.layout.grid ? '2px solid var(--ui-accent)' : 'none';
    CF.autosave();
  };
  /* 缩放 */
  document.getElementById('btnZoomIn').onclick = function () { CF.zoom = Math.min(2.5, CF.zoom + 0.1); CF.applyZoom(); };
  document.getElementById('btnZoomOut').onclick = function () { CF.zoom = Math.max(0.15, CF.zoom - 0.1); CF.applyZoom(); };
  document.getElementById('btnZoomFit').onclick = CF.zoomFit;
};

/* 画布尺寸应用到 DOM */
CF.applyPosterSize = function () {
  const st = CF.state;
  const poster = document.getElementById('poster');
  poster.style.width = st.canvas.w + 'px';
  poster.style.height = st.canvas.h + 'px';
};
