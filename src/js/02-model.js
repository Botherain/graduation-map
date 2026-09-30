/* ============================================================
 * 02-model.js — 状态、存储、分组排序、信息/名单/分数线面板
 * ============================================================ */
CF.DEFAULT_MAP = { inset: true, insetSize: 26, zoom: 1, ox: 0, oy: 0,
                   tilt: 0, rot: 0, focus: false };
CF.DEFAULT_BG = { img: null, mode: 'cover', op: 1 };
CF.DEFAULT_CELL = { head: 'solid', headRadius: 6, headBg: '', headFg: '',
                    row: 'plain', rowSep: '', rowSepW: 1, zebra: '', rowRadius: 4 };
CF.state = {
  info: { title:'', year:'', cls:'', school:'', prov:'北京', city:'', teachers:'', notes:'' },
  students: [],          /* {id,name,uni,prov}  prov为省份短名 */
  scores: {},            /* "院校|省份|届次" -> {score, source, ts} */
  themeId: 'blue',
  custom: null,          /* 自定义覆盖 {base,accent,bg,emA,low,gamma,ink,line,blkBg} */
  font: '微软雅黑',
  art: 'gradient',
  canvas: { preset:'A4', w:1240, h:1754 },
  layout: { margin:28, blockW:210, rowGap:3, showScore:false, regionOrder:false, snap:true,
            grid:false, lineW:1.5, lineO:0.55 },
  bg: Object.assign({}, CF.DEFAULT_BG),           /* 背景图片 */
  cell: Object.assign({}, CF.DEFAULT_CELL),       /* 省份栏头 / 名单行样式 */
  map: Object.assign({}, CF.DEFAULT_MAP),
  elements: []
};
/* 旧存档缺少新增字段时补默认值 */
CF.migrate = function () {
  const s = CF.state;
  s.bg = Object.assign({}, CF.DEFAULT_BG, s.bg || {});
  s.cell = Object.assign({}, CF.DEFAULT_CELL, s.cell || {});
  s.map = Object.assign({}, CF.DEFAULT_MAP, s.map || {});
  if (!s.layout || typeof s.layout !== 'object') s.layout = {
    margin:28, blockW:210, rowGap:3, showScore:false, regionOrder:false, snap:true,
    grid:false, lineW:1.5, lineO:0.55 };
  /* 画布：缺字段补默认（A4），非法/过小值兜底到可用范围 */
  if (!s.canvas || typeof s.canvas !== 'object') s.canvas = { preset:'A4', w:1240, h:1754 };
  s.canvas.w = Math.max(400, +s.canvas.w || 1240);
  s.canvas.h = Math.max(400, +s.canvas.h || 1754);
  if (!s.canvas.preset) s.canvas.preset = 'custom';
};
CF.sel = null;

/* ---------------- 主题与颜色 ---------------- */
CF.theme = function () {
  const base = CF.THEMES.find(function (t) { return t.id === CF.state.themeId; }) || CF.THEMES[0];
  const t = Object.assign({}, base);
  if (CF.state.custom) Object.assign(t, CF.state.custom);
  return t;
};
CF.colorFor = function (count, max) {
  const t = CF.theme();
  if (!count) return CF.mix(t.bg, t.low, 0.85);
  const frac = Math.pow(count / (max || 1), t.gamma);
  return CF.mix(t.low, t.base, 0.25 + 0.75 * frac);
};

/* 单元格样式的主题自适应默认色（用户未手动指定颜色时使用） */
CF.cellAuto = function () {
  const t = CF.theme();
  return {
    headBg: t.accent,
    headFg: '#ffffff',
    sep: CF.mix(t.blkBg, t.ink, 0.30),
    zebra: CF.mix(t.blkBg, t.ink, 0.10)
  };
};

/* ---------------- 省份列表（来自地图数据） ---------------- */
CF.provFullList = (window.CHINA_GEO.features || [])
  .map(function (f) { return f.properties.name; })
  .filter(function (n) { return n && CF.PROV_ALIAS[n]; });
CF.provShortList = CF.provFullList.map(CF.shortProv);

/* ---------------- 分数线访问 ---------------- */
CF.scoreKey = function (uni) {
  return uni + '|' + (CF.state.info.prov || '') + '|' + (CF.state.info.year || '');
};
CF.getScore = function (uni) {
  const e = CF.state.scores[CF.scoreKey(uni)];
  return e ? e.score : null;
};
CF.setScore = function (uni, score, source) {
  const k = CF.scoreKey(uni);
  if (score == null || score === '' || isNaN(score)) delete CF.state.scores[k];
  else CF.state.scores[k] = { score: Number(score), source: source || 'manual', ts: Date.now() };
};
CF.setScoreWithStudentCheck = function (uni, score, source) { CF.setScore(uni, score, source); CF.render(); };

/* ---------------- 分组与排序（核心规则） ---------------- */
CF.groups = function () {
  const map = {};
  CF.state.students.forEach(function (s) {
    if (!s.prov) return;
    (map[s.prov] = map[s.prov] || []).push(s);
  });
  const out = Object.keys(map).map(function (prov) {
    const list = map[prov].map(function (s) {
      return { id:s.id, name:s.name, uni:s.uni, prov:prov, score:CF.getScore(s.uni) };
    });
    list.sort(function (a, b) {
      const as = a.score, bs = b.score;
      if (as == null && bs != null) return 1;
      if (bs == null && as != null) return -1;
      if (as != null && bs != null && as !== bs) return bs - as;
      return CF.pinyinCmp(a.name, b.name);
    });
    return { prov:prov, short:prov, list:list, count:list.length, rank:CF.regionRank(prov) };
  });
  out.sort(function (a, b) {
    if (CF.state.layout.regionOrder) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.count - a.count;
    }
    if (b.count !== a.count) return b.count - a.count;
    return a.rank - b.rank;
  });
  return out;
};

/* ---------------- 学生增删改 ---------------- */
CF.addStudent = function (name, uni, prov) {
  const s = { id: CF.uid(), name: (name || '').trim(), uni: (uni || '').trim(), prov: prov || '' };
  if (!s.prov && s.uni) s.prov = CF.inferProvince(s.uni).prov;
  CF.state.students.push(s);
  return s;
};
CF.uniqueUnis = function () {
  const seen = {}, out = [];
  CF.state.students.forEach(function (s) {
    const u = s.uni.trim();
    if (u && !seen[u]) { seen[u] = 1; out.push(u); }
  });
  return out.sort(CF.pinyinCmp);
};
CF.unknownUnis = function () {
  return CF.uniqueUnis().filter(function (u) { return !CF.inferProvince(u).prov; });
};
CF.applyProvinces = function (map) {   /* {院校: 省份} */
  let n = 0;
  CF.state.students.forEach(function (s) {
    if (!s.prov && map[s.uni] && CF.provShortList.indexOf(map[s.uni]) >= 0) { s.prov = map[s.uni]; n++; }
  });
  return n;
};

/* ---------------- 本地存储 ---------------- */
CF.serialize = function () {
  const st = JSON.parse(JSON.stringify(CF.state));
  delete st.sel;
  return st;
};
CF.autosave = function () {
  clearTimeout(CF._saveT);
  CF._saveT = setTimeout(function () {
    try { localStorage.setItem('cf_auto', JSON.stringify(CF.serialize())); } catch (e) {}
  }, 800);
};
CF.saveProj = function () {
  try {
    localStorage.setItem('cf_proj', JSON.stringify(CF.serialize()));
    CF.toast('已保存到浏览器本地');
  } catch (e) { CF.toast('保存失败：' + e.message); }
};
CF.loadProj = function () {
  let raw = null;
  try { raw = localStorage.getItem('cf_proj'); } catch (e) { return CF.toast('读取失败：' + e.message); }
  if (!raw) return CF.toast('没有找到已保存的项目');
  try {
    const st = JSON.parse(raw);
    Object.assign(CF.state, st);
    CF.migrate();
    CF.syncPanelFromState();
    CF.layoutAuto(false);
    CF.toast('已读取项目');
    CF.render();
  } catch (e) { CF.toast('读取失败：' + e.message); }
};
CF.autoRestore = function () {
  /* 存储可能被浏览器禁用（隐私模式等），读取绝不能让启动中断 */
  let raw = null;
  try { raw = localStorage.getItem('cf_auto'); } catch (e) { return false; }
  if (!raw) return false;
  try {
    const st = JSON.parse(raw);
    Object.assign(CF.state, st);
    CF.migrate();
    return true;
  } catch (e) { return false; }
};

/* ---------------- 模板 ---------------- */
CF.tplList = function () {
  try { return JSON.parse(localStorage.getItem('cf_tpls') || '{}'); } catch (e) { return {}; }
};
CF.tplSave = function (name) {
  const all = CF.tplList();
  all[name] = {
    layout: CF.state.layout, canvas: CF.state.canvas, themeId: CF.state.themeId, custom: CF.state.custom,
    font: CF.state.font, art: CF.state.art, map: CF.state.map,
    cell: CF.state.cell, bg: (CF.state.bg || {}).img ? null : CF.state.bg,   /* 背景图可能过大，不入模板 */
    elements: CF.state.elements.filter(function (e) { return e.type !== 'block'; })
  };
  try { localStorage.setItem('cf_tpls', JSON.stringify(all)); }
  catch (e) { CF.toast('模板保存失败：' + e.message); }
};
CF.tplApply = function (name) {
  const t = CF.tplList()[name];
  if (!t) return;
  CF.state.layout = t.layout; CF.state.canvas = t.canvas; CF.state.themeId = t.themeId;
  CF.state.custom = t.custom; CF.state.font = t.font; CF.state.art = t.art;
  CF.state.map = Object.assign({}, CF.DEFAULT_MAP, t.map || {});
  if (t.cell) CF.state.cell = Object.assign({}, CF.DEFAULT_CELL, t.cell);
  if (t.bg) CF.state.bg = Object.assign({}, CF.DEFAULT_BG, t.bg);
  const oldBlocks = CF.state.elements.filter(function (e) { return e.type === 'block'; });
  CF.state.elements = JSON.parse(JSON.stringify(t.elements || []));
  /* 恢复文字块（由自动布局重建位置） */
  oldBlocks.forEach(function (b) { CF.state.elements.push(b); });
  CF.syncPanelFromState();
  CF.layoutAuto(false);
  CF.render();
};
CF.tplRemove = function (name) {
  const all = CF.tplList(); delete all[name];
  try { localStorage.setItem('cf_tpls', JSON.stringify(all)); }
  catch (e) { CF.toast('模板删除失败：' + e.message); }
};

/* ============================================================
 *  面板绑定：班级信息 / 名单 / 分数线
 * ============================================================ */
CF.bindInfoPanel = function () {
  const S = CF.state.info;
  const map = { inTitle:'title', inYear:'year', inClass:'cls', inSchool:'school', inCity:'city',
                inTeachers:'teachers', inNotes:'notes' };
  Object.keys(map).forEach(function (id) {
    const el = document.getElementById(id);
    el.value = S[map[id]] || '';
    el.addEventListener('input', function () {
      S[map[id]] = el.value;
      if (id === 'inYear') { CF.renderScoreTable(); }
      CF.render(); CF.autosave();
    });
  });
  const sel = document.getElementById('inProv');
  sel.innerHTML = CF.provFullList.map(function (f) {
    return '<option value="' + CF.esc(CF.shortProv(f)) + '">' + CF.esc(f) + '</option>';
  }).join('');
  sel.value = S.prov;
  sel.addEventListener('change', function () {
    S.prov = sel.value;              /* 居住省份变化 → 分数线 key 变化 */
    CF.renderRoster(); CF.renderScoreTable(); CF.render(); CF.autosave();
  });
};

CF.syncPanelFromState = function () {
  const S = CF.state.info;
  const map = { inTitle:'title', inYear:'year', inClass:'cls', inSchool:'school', inCity:'city',
                inTeachers:'teachers', inNotes:'notes' };
  Object.keys(map).forEach(function (id) { document.getElementById(id).value = S[map[id]] || ''; });
  document.getElementById('inProv').value = S.prov;
  /* 外观 */
  const st = CF.state;
  CF.syncLookPanel();
  /* 名单 / 分数线 */
  CF.renderRoster(); CF.renderScoreTable();
  /* 画布：下拉必须如实反映实际尺寸——预设与尺寸对不上时显示“自定义” */
  const sel = document.getElementById('selCanvas');
  sel.value = st.canvas.preset || 'custom';
  if (sel.value !== (st.canvas.preset || 'custom')) sel.value = 'custom';
  const cp = CF.CANVAS_PRESETS[sel.value];
  if (cp && (cp[0] !== st.canvas.w || cp[1] !== st.canvas.h)) sel.value = 'custom';
  if (sel.value !== st.canvas.preset) st.canvas.preset = sel.value;
  document.getElementById('inCw').value = st.canvas.w;
  document.getElementById('inCh').value = st.canvas.h;
  /* 地图 */
  const m = st.map;
  document.getElementById('ckInset').checked = m.inset;
  document.getElementById('rInset').value = m.insetSize;
  document.getElementById('insetVal').textContent = m.insetSize + '%';
  document.getElementById('rMapZoom').value = m.zoom;
  document.getElementById('mapZoomVal').textContent = Number(m.zoom).toFixed(2);
  document.getElementById('rMapOx').value = m.ox;
  document.getElementById('mapOxVal').textContent = m.ox;
  document.getElementById('rMapOy').value = m.oy;
  document.getElementById('mapOyVal').textContent = m.oy;
  document.getElementById('rTilt').value = m.tilt;
  document.getElementById('tiltVal').textContent = m.tilt + '°';
  document.getElementById('rRot').value = m.rot;
  document.getElementById('rotVal').textContent = m.rot + '°';
  document.getElementById('ckFocus').checked = !!m.focus;
  if (CF.syncFocusLock) CF.syncFocusLock();
  /* 背景图片 */
  const bg = st.bg;
  document.getElementById('selBgMode').value = bg.mode;
  document.getElementById('rBgOp').value = Math.round(bg.op * 100);
  document.getElementById('bgOpVal').textContent = Math.round(bg.op * 100) + '%';
  /* 单元格样式参数 */
  const cel = st.cell;
  const auto = CF.cellAuto();
  document.getElementById('rHeadRad').value = cel.headRadius;
  document.getElementById('headRadVal').textContent = cel.headRadius;
  document.getElementById('rRowSepW').value = cel.rowSepW;
  document.getElementById('rowSepWVal').textContent = cel.rowSepW;
  document.getElementById('rRowRad').value = cel.rowRadius;
  document.getElementById('rowRadVal').textContent = cel.rowRadius;
  document.getElementById('cHeadBg').value = cel.headBg || auto.headBg;
  document.getElementById('cHeadFg').value = cel.headFg || auto.headFg;
  document.getElementById('cRowSep').value = cel.rowSep || auto.sep;
  document.getElementById('cZebra').value = cel.zebra || auto.zebra;
  /* 排版参数 */
  const L = st.layout;
  document.getElementById('rMargin').value = L.margin;
  document.getElementById('marginVal').textContent = L.margin;
  document.getElementById('rBlockW').value = L.blockW;
  document.getElementById('blockWVal').textContent = L.blockW;
  document.getElementById('rRowGap').value = L.rowGap;
  document.getElementById('rowGapVal').textContent = L.rowGap;
  document.getElementById('ckScore').checked = L.showScore;
  document.getElementById('ckRegion').checked = L.regionOrder;
  document.getElementById('ckSnap').checked = L.snap;
  document.getElementById('rLineW').value = L.lineW;
  document.getElementById('lineWVal').textContent = L.lineW;
  document.getElementById('rLineO').value = L.lineO;
  document.getElementById('lineOVal').textContent = L.lineO;
  document.getElementById('btnGrid').style.outline = L.grid ? '2px solid var(--ui-accent)' : 'none';
  document.getElementById('gridOverlay').hidden = !L.grid;
};

/* ---------------- 名单表格 ---------------- */
CF.renderRoster = function () {
  const tb = document.getElementById('rosterBody');
  const rows = CF.state.students.map(function (s, i) {
    let provCell;
    if (s.prov) {
      provCell = '<td class="provOk"><select data-i="' + i + '" class="pv">' +
        '<option value="">待补全</option>' +
        CF.provShortList.map(function (p) {
          return '<option' + (p === s.prov ? ' selected' : '') + '>' + p + '</option>';
        }).join('') + '</select></td>';
    } else {
      provCell = '<td class="provPending" data-i="' + i + '" title="点击手动选择省份">待补全 ▾</td>';
    }
    return '<tr>' +
      '<td><input data-i="' + i + '" class="nm" value="' + CF.esc(s.name) + '"></td>' +
      '<td><input data-i="' + i + '" class="un" value="' + CF.esc(s.uni) + '"></td>' +
      provCell +
      '<td><button class="rm" data-i="' + i + '" title="删除该行">×</button></td>' +
      '</tr>';
  }).join('');
  tb.innerHTML = rows;
  const unknown = CF.unknownUnis();
  document.getElementById('rosterStat').textContent =
    CF.state.students.length + ' 人 · ' + CF.uniqueUnis().length + ' 校' +
    (unknown.length ? ' · ' + unknown.length + ' 校省份待补全' : '');

  tb.oninput = function (e) {
    const i = e.target.dataset.i; if (i == null) return;
    const s = CF.state.students[+i]; if (!s) return;
    if (e.target.classList.contains('nm')) s.name = e.target.value;
    if (e.target.classList.contains('un')) {
      s.uni = e.target.value;
      if (s.prov === '' || !s.prov) s.prov = CF.inferProvince(s.uni).prov;
      CF.renderScoreTable();
    }
    if (e.target.classList.contains('pv')) { s.prov = e.target.value; CF.renderScoreTable(); }
    CF.render(); CF.autosave();
    if (e.target.classList.contains('un') || e.target.classList.contains('pv')) {
      /* 省份识别可能变化，局部刷新省份列 */
      CF.refreshRosterProvCell(+i);
    }
  };
  tb.onclick = function (e) {
    const t = e.target;
    if (t.classList.contains('rm')) {
      CF.state.students.splice(+t.dataset.i, 1);
      CF.renderRoster(); CF.renderScoreTable(); CF.render(); CF.autosave();
    } else if (t.classList.contains('provPending')) {
      CF.openProvPicker(+t.dataset.i, t);
    }
  };
};
CF.refreshRosterProvCell = function (i) {
  const s = CF.state.students[i]; if (!s) return;
  const tr = document.querySelectorAll('#rosterBody tr')[i]; if (!tr) return;
  const cell = tr.children[2];
  if (s.prov) {
    cell.outerHTML = '<td class="provOk"><select data-i="' + i + '" class="pv"><option value="">待补全</option>' +
      CF.provShortList.map(function (p) { return '<option' + (p === s.prov ? ' selected' : '') + '>' + p + '</option>'; }).join('') +
      '</select></td>';
  } else {
    cell.outerHTML = '<td class="provPending" data-i="' + i + '">待补全 ▾</td>';
  }
  const unknown = CF.unknownUnis();
  document.getElementById('rosterStat').textContent =
    CF.state.students.length + ' 人 · ' + CF.uniqueUnis().length + ' 校' +
    (unknown.length ? ' · ' + unknown.length + ' 校省份待补全' : '');
};

/* 单个省份下拉选择（点击“待补全”） */
CF.openProvPicker = function (i, anchor) {
  const s = CF.state.students[i];
  let sel = anchor.querySelector('select');
  if (!sel) {
    sel = document.createElement('select');
    sel.innerHTML = '<option value="">选择省份…</option>' + CF.provShortList.map(function (p) {
      return '<option>' + p + '</option>'; }).join('');
    anchor.textContent = '';
    anchor.appendChild(sel);
    sel.focus();
    sel.onchange = function () {
      s.prov = sel.value;
      CF.renderRoster(); CF.renderScoreTable(); CF.render(); CF.autosave();
    };
    sel.onblur = function () { setTimeout(function () { CF.renderRoster(); }, 150); };
  }
};

/* ---------------- 分数线表格 ---------------- */
CF.renderScoreTable = function () {
  const tb = document.getElementById('scoreBody');
  const unis = CF.uniqueUnis();
  const year = CF.state.info.year, prov = CF.state.info.prov;
  if (!unis.length) { tb.innerHTML = '<tr><td colspan="4" class="stat" style="padding:10px">先在“名单”中添加学生</td></tr>'; return; }
  tb.innerHTML = unis.map(function (u, i) {
    const e = CF.state.scores[CF.scoreKey(u)];
    const srcMap = { web:'搜索', ai:'AI', manual:'手填', csv:'CSV' };
    return '<tr><td>' + CF.esc(u) + '</td>' +
      '<td><input data-i="' + i + '" class="sco" value="' + (e ? e.score : '') + '" placeholder="—"></td>' +
      '<td class="src">' + (e ? (srcMap[e.source] || e.source) : '—') + '</td>' +
      '<td><button class="rm sm delSco" data-i="' + i + '">×</button></td></tr>';
  }).join('');
  tb.oninput = function (e) {
    if (!e.target.classList.contains('sco')) return;
    CF.setScore(unis[+e.target.dataset.i], e.target.value, 'manual');
    CF.render(); CF.autosave();
  };
  tb.onclick = function (e) {
    if (e.target.classList.contains('delSco')) {
      CF.setScore(unis[+e.target.dataset.i], null);
      CF.renderScoreTable(); CF.render(); CF.autosave();
    }
  };
  document.getElementById('srchSum').textContent =
    '将查询 ' + unis.length + ' 所院校在【' + CF.fullProv(prov) + '】' + year + ' 年的最低录取分数线。';
};

/* ---------------- 状态栏 ---------------- */
CF.renderStatus = function () {
  const st = CF.state;
  const g = CF.groups();
  const unknown = CF.unknownUnis().length;
  const noScore = CF.uniqueUnis().filter(function (u) { return CF.getScore(u) == null; }).length;
  document.getElementById('stInfo').textContent =
    st.students.length + ' 人 · ' + g.length + ' 个省份' +
    (unknown ? ' · ' + unknown + ' 校省份未识别' : '') +
    (noScore ? ' · ' + noScore + ' 校无分数线' : '');
  const el = CF.sel ? CF.state.elements.find(function (x) { return x.id === CF.sel; }) : null;
  document.getElementById('stSel').textContent = el ? ('选中：' + CF.elName(el)) : '';
};
CF.elName = function (el) {
  const m = { title:'标题', info:'班级信息框', map:'中国地图', legend:'图例', text:'文本框' };
  if (el.type === 'block') return el.prov + ' 文字块';
  return m[el.type] || el.type;
};

/* ---------------- 字体探测 ---------------- */
CF.detectFonts = function () {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const sample = '蹭饭图排版字体探测2026Abc';
  ctx.font = '40px sans-serif';
  const baseW = ctx.measureText(sample).width;
  const out = [];
  CF.FONT_CANDIDATES.forEach(function (f) {
    if (f.css === 'sans-serif') { out.push(f); return; }
    ctx.font = '40px ' + f.css + ', sans-serif';
    const w = ctx.measureText(sample).width;
    if (Math.abs(w - baseW) > 0.5) out.push(f);
  });
  return out;
};
