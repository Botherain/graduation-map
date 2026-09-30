/* ============================================================
 * 05-render.js — 渲染主流程：元素 DOM 同步、内容填充、引线
 * ============================================================ */
CF.applyPosterVars = function () {
  const t = CF.theme(), st = CF.state;
  const poster = document.getElementById('poster');
  poster.style.width = st.canvas.w + 'px';
  poster.style.height = st.canvas.h + 'px';
  poster.style.background = t.bg;
  const f = CF.FONT_CANDIDATES.find(function (x) { return x.label === st.font; });
  poster.style.fontFamily = (f ? f.css : '"Microsoft YaHei"') + ', "Microsoft YaHei", sans-serif';
  poster.style.setProperty('--accent', t.accent);
  poster.style.setProperty('--ink', t.ink);
  poster.style.setProperty('--tbg', t.bg);
  poster.style.setProperty('--blkBg', t.blkBg);
  poster.style.setProperty('--emA', t.emA);
  poster.style.setProperty('--emB', t.emB);
  /* 背景图片 */
  const bg = st.bg || { img: null, mode: 'cover', op: 1 };
  const bgEl = document.getElementById('bgImg');
  if (bg.img) {
    bgEl.hidden = false;
    bgEl.style.backgroundImage = 'url("' + bg.img + '")';
    if (bg.mode === 'repeat') {
      bgEl.style.backgroundSize = 'auto';
      bgEl.style.backgroundRepeat = 'repeat';
    } else {
      bgEl.style.backgroundSize = bg.mode;
      bgEl.style.backgroundRepeat = 'no-repeat';
    }
    bgEl.style.opacity = bg.op;
  } else {
    bgEl.hidden = true;
  }
};

/* ---------------- 元素 DOM 同步 ---------------- */
CF.syncElements = function () {
  const poster = document.getElementById('poster');
  const nodes = {};
  CF.$$('#poster .el').forEach(function (d) { nodes[d.dataset.id] = d; });
  const seen = {};
  CF.state.elements.forEach(function (el) {
    CF.clampEl(el);   /* 元素限制在画布内：#poster overflow:hidden，越界部分会被裁掉 */
    seen[el.id] = 1;
    let d = nodes[el.id];
    if (!d) {
      d = document.createElement('div');
      d.className = 'el';
      d.dataset.id = el.id;
      ['nw', 'ne', 'sw', 'se'].forEach(function (c) {
        const h = document.createElement('div'); h.className = 'h h-' + c; d.appendChild(h);
      });
      poster.appendChild(d);
      d._content = document.createElement('div');
      d._content.className = 'el-content';
      d.insertBefore(d._content, d.firstChild);
    }
    /* 通用几何与状态 */
    d.style.left = el.x + 'px'; d.style.top = el.y + 'px';
    d.style.width = el.w + 'px'; d.style.height = el.h + 'px';
    d.style.zIndex = el.z != null ? el.z : 10;
    d.style.transform = el.rot ? ('rotate(' + el.rot + 'deg)') : '';
    d.style.opacity = (el.style && el.style.op != null) ? el.style.op : '';
    d.className = 'el el-' + el.type +
      (CF.sel === el.id ? ' selected' : '') +
      (el.locked ? ' locked' : '') +
      (el.hidden ? ' hiddenEl' : '');
    CF.fillEl(d, el);
  });
  Object.keys(nodes).forEach(function (id) {
    if (!seen[id]) nodes[id].remove();
  });
};

/* ---------------- 单个元素内容 ---------------- */
CF.fillEl = function (d, el) {
  const st = CF.state, t = CF.theme();
  const c = d._content;
  const css = el.style || (el.style = {});
  const fontCss = css.fontSize ? ('font-size:' + css.fontSize + 'px;') : '';
  const lhCss = css.lineHeight ? ('line-height:' + css.lineHeight + ';') : '';
  const colorCss = css.color ? ('color:' + css.color + ';') : '';

  if (el.type === 'map') {
    if (!c.querySelector('.mapHost')) { c.innerHTML = '<div class="mapHost"></div>'; }
    /* overflow:hidden：侧倾变换会把图表内容推出框外，不裁剪会以碎片形式
       涂到框外的海报区域（文字块间隙）；裁剪后所有内容整齐切在地图框边界 */
    c.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
    const host = c.querySelector('.mapHost');
    host.style.cssText = 'position:absolute;inset:0;';
    /* 地图角度（透视倾斜 / 侧转） */
    const m = st.map;
    const tilt = m.tilt || 0, rot = m.rot || 0;
    if (tilt || rot) {
      const k = tilt ? Math.min(1.6, 0.94 / Math.cos(tilt * Math.PI / 180)) : 1;
      host.style.transform = 'perspective(1100px) rotateX(' + tilt + 'deg) rotateZ(' + rot +
        'deg) scale(' + k.toFixed(3) + ')';
    } else {
      host.style.transform = '';
    }
    return;
  }
  if (el.type === 'title') {
    c.className = 'el-content el-title art-' + st.art;
    const txt = st.info.title || '';
    c.innerHTML = '<span>' + CF.esc(txt || '标题（在“班级信息”中输入）') + '</span>';
    c.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      fontCss + lhCss + colorCss + (txt ? '' : 'opacity:.35;');
    return;
  }
  if (el.type === 'info') {
    c.className = 'el-content el-info';
    c.style.cssText = fontCss + lhCss + colorCss + 'padding:2px 4px;';
    const info = st.info;
    const head = [info.year ? info.year + '届' : '', info.cls || ''].filter(Boolean).join(' ') || info.school || '班级信息';
    const lines = [];
    if (info.school && head !== info.school) lines.push('学校：' + info.school);
    const pShort = info.prov ? CF.shortProv(info.prov) : '';
    const city = CF.shortProv((info.city || '').trim());
    const parts = [];
    if (pShort) parts.push(pShort);
    if (city && parts.indexOf(city) < 0 && !(parts[0] && parts[0].indexOf(city) === 0)) parts.push(city);
    const loc = parts.join(' · ');
    if (loc) lines.push('所在地：' + loc);
    if (info.teachers) lines.push('任课老师：' + info.teachers.replace(/\n/g, '、'));
    if (info.notes) info.notes.split('\n').forEach(function (l) { if (l.trim()) lines.push(l); });
    const empty = !info.title && !info.school && !info.teachers && !info.notes && !info.year && !info.cls;
    c.innerHTML = '<div class="info-t">' + CF.esc(head) + '</div>' +
      lines.map(function (l) { return '<div class="info-l">' + CF.esc(l) + '</div>'; }).join('') +
      (empty ? '<div class="info-l" style="opacity:.4">（在左侧“班级信息”中填写）</div>' : '');
    return;
  }
  if (el.type === 'block') {
    const cel = st.cell || {};
    const cellAuto = CF.cellAuto();
    c.className = 'el-content el-block hd-' + (cel.head || 'solid') + ' st-' + (cel.row || 'plain');
    c.style.setProperty('--hr', (cel.headRadius != null ? cel.headRadius : 6) + 'px');
    c.style.setProperty('--sep', cel.rowSep || cellAuto.sep);
    c.style.setProperty('--sepW', (cel.rowSepW != null ? cel.rowSepW : 1) + 'px');
    c.style.setProperty('--zebra', cel.zebra || cellAuto.zebra);
    c.style.setProperty('--rr', (cel.rowRadius != null ? cel.rowRadius : 4) + 'px');
    const g = CF.groups().find(function (x) { return x.short === el.prov; });
    if (!g) { d.style.display = 'none'; return; }
    d.style.display = '';
    const fs = css.fontSize || 13;
    const rows = g.list.map(function (s) {
      return '<div class="blk-row"' + (st.layout.rowGap ? ' style="margin-top:' + st.layout.rowGap + 'px"' : '') + '>' +
        '<span class="nm">' + CF.esc(s.name) + '</span>' +
        (st.layout.showScore && s.score != null ? '<span class="sc">' + s.score + '</span>' : '') +
        '<span class="un">' + CF.esc(s.uni) + '</span></div>';
    }).join('');
    const headStyle = 'font-size:' + Math.round(fs * 1.12) + 'px;' +
      (cel.headBg ? 'background:' + cel.headBg + ';' : '') +
      (cel.headFg ? 'color:' + cel.headFg + ';' : '');
    c.innerHTML = '<div class="blk-head" style="' + headStyle + '">' +
      '<span>' + CF.esc(g.short) + '</span><span class="cnt">' + g.count + ' 人</span></div>' +
      '<div class="blk-body" style="font-size:' + fs + 'px;' + lhCss + colorCss +
      (css.bg ? 'background:' + css.bg + ';' : '') + '">' + rows + '</div>';
    return;
  }
  if (el.type === 'legend') {
    c.className = 'el-content el-legend';
    const groups = CF.groups();
    let max = 0; groups.forEach(function (g) { if (g.count > max) max = g.count; });
    if (!max) max = 1;
    const stops = [];
    for (let i = 0; i <= 8; i++) stops.push(CF.colorFor(i / 8 * max, max) + ' ' + (i / 8 * 100) + '%');
    c.innerHTML = '<div class="lg-title">各省录取人数</div>' +
      '<div class="lg-bar" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></div>' +
      '<div class="lg-lab"><span>0</span><span>' + max + ' 人</span></div>';
    c.style.cssText = fontCss + lhCss + colorCss;
    return;
  }
  if (el.type === 'text') {
    c.className = 'el-content el-text';
    c.innerHTML = CF.esc(el.content || '双击右侧“属性面板”输入文本');
    c.style.cssText = fontCss + lhCss + colorCss + 'opacity:' + (el.content ? 1 : .45) + ';' +
      (css.bg ? 'background:' + css.bg + ';padding:6px 8px;border-radius:6px;height:100%;box-sizing:border-box;' : '');
  }
};

/* ---------------- 引线（外置文字块 → 省份） ---------------- */
CF.renderLines = function () {
  const svg = document.getElementById('lines');
  const st = CF.state, t = CF.theme();
  let mapEl = null;
  CF.state.elements.forEach(function (e) { if (e.type === 'map') mapEl = e; });
  let parts = '';
  if (mapEl && !mapEl.hidden) {
    /* 地图有倾斜/侧转时，用探针元素把省份像素坐标投影到实际显示位置 */
    const m = st.map;
    const tilted = !!(m.tilt || m.rot);
    const host = CF.mapHostEl();
    const poster = document.getElementById('poster');
    let probe = null, pr = null, scale = 1;
    if (tilted && host) {
      probe = host.querySelector('.mapProbe');
      if (!probe) {
        probe = document.createElement('div');
        probe.className = 'mapProbe';
        host.appendChild(probe);
      }
      pr = poster.getBoundingClientRect();
      scale = poster.offsetWidth ? (pr.width / poster.offsetWidth) : 1;
    }
    CF.state.elements.forEach(function (el) {
      if (el.type !== 'block' || el.hidden) return;
      const cen = CF.provCentroid[el.prov];
      if (!cen) return;
      const px = CF.mapPixel(cen[0], cen[1]);
      if (!px) return;
      let tx, ty;
      if (probe) {
        probe.style.left = px[0] + 'px';
        probe.style.top = px[1] + 'px';
        const br = probe.getBoundingClientRect();
        if (!scale) return;
        tx = (br.left - pr.left) / scale;
        ty = (br.top - pr.top) / scale;
      } else {
        tx = mapEl.x + px[0];
        ty = mapEl.y + px[1];
      }
      const axc = el.x + el.w / 2, ayc = el.y + el.h / 2;
      /* 文字块靠近目标的边作为锚点 */
      let ax;
      if (tx < el.x) ax = el.x - 2;
      else if (tx > el.x + el.w) ax = el.x + el.w + 2;
      else ax = axc;
      const ay = CF.clamp(ty, el.y + 6, el.y + el.h - 6);
      const mx = (ax + tx) / 2, my = (ay + ty) / 2;
      const bow = Math.min(60, Math.abs(tx - ax) * 0.18);
      const d = 'M' + ax + ',' + ay + ' Q' + (mx) + ',' + (my - bow) + ' ' + tx + ',' + ty;
      parts += '<path d="' + d + '" stroke="' + t.line + '" stroke-width="' + st.layout.lineW +
        '" opacity="' + st.layout.lineO + '" stroke-linecap="round"/>' +
        '<circle cx="' + tx + '" cy="' + ty + '" r="3.2" fill="' + t.line + '" opacity="' +
        Math.min(1, st.layout.lineO + 0.3) + '"/>';
    });
  }
  svg.innerHTML = parts;
};

/* ---------------- 主渲染 ---------------- */
CF._renderQueued = false;
CF.render = function () {
  if (CF._renderQueued) return;
  CF._renderQueued = true;
  const run = function () {
    if (!CF._renderQueued) return;
    CF._renderQueued = false;
    try { CF.doRender(); } catch (e) { console.error('render failed:', e); }
  };
  requestAnimationFrame(run);
  setTimeout(run, 60);   /* 后台标签页 rAF 被节流时的兜底 */
};
CF.doRender = function () {
  const st = CF.state;
  if (!st.elements.length && (st.students.length || st.info.title)) { CF.layoutAuto(true); return; }
  CF.applyPosterVars();
  CF.layoutEnsureBlocks();
  CF.syncElements();
  CF.mapUpdate();
  CF.mapObserve();
  /* 聚焦模式：有学生的省份集合变化时自动重算视角 */
  if (st.map.focus && !CF._focusing) {
    const key = CF.groups().map(function (g) { return g.short + ':' + g.count; }).join(',');
    if (key !== CF._focusKey) {
      CF._focusing = true;
      CF._focusKey = key;
      try { CF.mapFocusApply(); } catch (e) {}
      CF._focusing = false;
      if (CF.syncMapSliders) CF.syncMapSliders();
    }
  }
  CF.renderLines();
  CF.renderStatus();
};
