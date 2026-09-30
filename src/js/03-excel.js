/* ============================================================
 * 03-excel.js — 弹窗基础、Excel/CSV 导入、列自动识别、省份补全
 * ============================================================ */

/* ---------------- 通用弹窗 ---------------- */
CF.openModal = function (id) {
  const back = document.getElementById('modalBack');
  back.hidden = false;
  CF.$$('.modal').forEach(function (m) { m.hidden = m.id !== id; });
  back.dataset.open = id;
};
CF.closeModal = function () {
  document.getElementById('modalBack').hidden = true;
  CF.$$('.modal').forEach(function (m) { m.hidden = true; });
};
CF.confirm = function (msg, cb, title) {
  document.getElementById('cfTitle').textContent = title || '确认';
  document.getElementById('cfMsg').textContent = msg;
  CF.openModal('dlgConfirm');
  const yes = document.getElementById('cfYes'), no = document.getElementById('cfNo');
  const h = function (ok) {
    yes.onclick = no.onclick = null;
    CF.closeModal();
    if (ok) cb();
  };
  yes.onclick = function () { h(true); };
  no.onclick = function () { h(false); };
};

/* ---------------- 读取表格文件 → 二维数组 ---------------- */
CF.decodeCsvBytes = function (buf) {
  const bytes = new Uint8Array(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    try { return new TextDecoder('gbk').decode(bytes); } catch (e2) { return new TextDecoder('utf-8').decode(bytes); }
  }
};
CF.readSpreadsheet = function (file, cb) {
  const fr = new FileReader();
  fr.onload = function () {
    try {
      const isCsv = /\.csv$/i.test(file.name);
      let wb;
      if (isCsv) {
        const txt = CF.decodeCsvBytes(fr.result);
        wb = XLSX.read(txt, { type: 'string' });
      } else {
        wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      cb(rows, null);
    } catch (e) { cb(null, e); }
  };
  fr.onerror = function () { cb(null, new Error('文件读取失败')); };
  fr.readAsArrayBuffer(file);
};

/* ---------------- 列识别 ---------------- */
CF.NAME_RE = /^[一-龥·]{1,6}$/;
CF.detectColumns = function (rows) {
  /* 找表头行：第一个有 ≥2 个非空单元格的行 */
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const nn = rows[i].filter(function (c) { return String(c).trim() !== ''; }).length;
    if (nn >= 2) { hi = i; break; }
  }
  if (hi < 0) return null;
  const header = rows[hi];
  const body = rows.slice(hi + 1, hi + 21);
  const ncol = Math.max.apply(null, rows.slice(0, hi + 15).map(function (r) { return r.length; }));
  const cols = [];
  for (let c = 0; c < ncol; c++) {
    const h = String(header[c] == null ? '' : header[c]).trim();
    const vals = body.map(function (r) { return String(r[c] == null ? '' : r[c]).trim(); }).filter(function (v) { return v; });
    const preview = rows.slice(hi, hi + 6).map(function (r) { return String(r[c] == null ? '' : r[c]).trim(); });
    let role = '';
    if (/姓名|名字|学生|^name$|student/i.test(h)) role = 'name';
    else if (/院校|录取|大学|学院|学校|university|school|college/i.test(h)) role = 'uni';
    else if (/分数|分数线|成绩|最低|score/i.test(h)) role = 'score';
    else if (/省份|所在省|地区|province/i.test(h)) role = 'prov';
    else if (vals.length) {
      const uniOK = vals.filter(function (v) { return /大学|学院|学校|University|College/i.test(v); }).length / vals.length;
      const numOK = vals.filter(function (v) { return /^\d{3,4}$/.test(v) && +v >= 200 && +v <= 750; }).length / vals.length;
      const nameOK = vals.filter(function (v) { return CF.NAME_RE.test(v); }).length / vals.length;
      if (uniOK >= 0.6) role = 'uni';
      else if (numOK >= 0.6) role = 'score';
      else if (nameOK >= 0.8) role = 'name';
    }
    cols.push({ idx: c, header: h, preview: preview, vals: vals, role: role });
  }
  /* 去重：同 role 只保留第一个（按列序 & 命中质量由上面的顺序保证） */
  const seen = {};
  cols.forEach(function (c) {
    if (!c.role) return;
    if (seen[c.role]) c.role = seen[c.role] === c.idx ? c.role : c.role;
    if (seen[c.role] != null) c.role = '';
    else seen[c.role] = c.idx;
  });
  if (!seen.hasOwnProperty('name') || !seen.hasOwnProperty('uni')) return { headerRow: hi, cols: cols, incomplete: true };
  return { headerRow: hi, cols: cols, data: rows.slice(hi + 1) };
};

/* ---------------- 打开导入映射对话框 ---------------- */
CF.openImportDialog = function (rows) {
  const det = CF.detectColumns(rows);
  if (!det) { CF.toast('未能识别表格内容（无有效行）'); return; }
  CF._impRows = rows; CF._impDet = det;
  document.getElementById('impSummary').textContent =
    '共读取 ' + rows.length + ' 行。请确认每列含义（已自动识别，可修改）：';
  const tb = document.getElementById('impCols');
  tb.innerHTML = det.cols.map(function (c, ci) {
    const opts = [['', '不使用'], ['name', '姓名'], ['uni', '录取院校'], ['prov', '省份'], ['score', '分数线']]
      .map(function (o) {
        return '<option value="' + o[0] + '"' + (c.role === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');
    const pv = c.preview.map(function (v) { return v || '·'; }).join(' ／ ');
    return '<tr><td><b>' + (c.header || '(无表头)') + '</b><br><span class="stat">' + CF.esc(pv) + '</span></td>' +
      '<td><select data-ci="' + ci + '">' + opts + '</select></td></tr>';
  }).join('');
  CF.openModal('dlgImport');
};

CF.doImport = function () {
  const det = CF._impDet, rows = CF._impRows;
  const roleCol = {};
  CF.$$('#impCols select').forEach(function (sel) {
    if (sel.value) roleCol[sel.value] = +sel.dataset.ci;
  });
  if (roleCol.name == null || roleCol.uni == null) { CF.toast('必须指定“姓名”和“录取院校”两列'); return; }
  const start = det.headerRow + 1;
  let n = 0, skipped = 0;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const nm = String(r[roleCol.name] == null ? '' : r[roleCol.name]).trim();
    const un = String(r[roleCol.uni] == null ? '' : r[roleCol.uni]).trim();
    if (!nm && !un) continue;
    if (!nm || !un) { skipped++; continue; }
    /* 去重：同姓名+院校已存在则跳过 */
    const dup = CF.state.students.some(function (s) {
      return s.name === nm && s.uni === un;
    });
    if (dup) { skipped++; continue; }
    let prov = '';
    if (roleCol.prov != null) {
      const p = String(r[roleCol.prov] == null ? '' : r[roleCol.prov]).trim();
      if (p) prov = CF.shortProv(p);
      if (CF.provShortList.indexOf(prov) < 0) prov = '';
    }
    const s = CF.addStudent(nm, un, prov);
    if (roleCol.score != null) {
      const sc = String(r[roleCol.score] == null ? '' : r[roleCol.score]).replace(/[^\d.]/g, '');
      if (sc && !isNaN(+sc)) CF.setScore(un, sc, 'csv');
    }
    n++;
  }
  CF.closeModal();
  CF.renderRoster(); CF.renderScoreTable();
  CF.render(); CF.autosave();
  CF.toast('已导入 ' + n + ' 人' + (skipped ? '，跳过 ' + skipped + ' 行（不完整或重复）' : ''));
  const unknown = CF.unknownUnis();
  if (unknown.length) setTimeout(function () { CF.openProvDialog(); }, 400);
};

/* ---------------- 省份补全对话框（含 AI 复制 / 粘贴） ---------------- */
CF.openProvDialog = function () {
  const unknown = CF.unknownUnis();
  if (!unknown.length) { CF.toast('所有院校省份均已识别'); return; }
  const tb = document.getElementById('provRows');
  tb.innerHTML = unknown.map(function (u, i) {
    return '<tr><td>' + CF.esc(u) + '</td><td><select data-i="' + i + '" class="pvSel"><option value="">选择…</option>' +
      CF.provShortList.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></td></tr>';
  }).join('');
  CF._unknown = unknown;
  CF.openModal('dlgProv');
};
CF.provAiPrompt = function () {
  return '请查询下列中国高校所在的省份（省级行政区，用简称如“北京”“江苏”“广东”），' +
    '只返回 JSON 对象，不要任何解释文字，格式：{"院校名":"省份简称",...}\n' +
    JSON.stringify(CF._unknown.reduce(function (o, u) { o[u] = ''; return o; }, {}), null, 0);
};
CF.provAiPaste = function (txt) {
  try {
    let s = String(txt).trim().replace(/```json|```/g, '').trim();
    const obj = JSON.parse(s);
    let ok = 0;
    CF.$$('#provRows select').forEach(function (sel) {
      const uni = CF._unknown[+sel.dataset.i];
      let p = obj[uni];
      if (p == null) {
        for (const k in obj) if (k.indexOf(uni) >= 0 || uni.indexOf(k) >= 0) { p = obj[k]; break; }
      }
      if (p) {
        p = CF.shortProv(String(p).trim());
        if (CF.provShortList.indexOf(p) >= 0) { sel.value = p; ok++; }
      }
    });
    CF.toast('已匹配 ' + ok + ' 项');
  } catch (e) { CF.toast('JSON 解析失败：' + e.message); }
};
CF.doProvOk = function () {
  const map = {};
  CF.$$('#provRows select').forEach(function (sel) {
    if (sel.value) map[CF._unknown[+sel.dataset.i]] = sel.value;
  });
  const n = CF.applyProvinces(map);
  CF.closeModal();
  CF.renderRoster(); CF.renderScoreTable(); CF.render(); CF.autosave();
  CF.toast('已补全 ' + n + ' 项省份');
  const left = CF.unknownUnis();
  if (left.length) CF.toast('仍有 ' + left.length + ' 校未识别：' + left.slice(0, 3).join('、'), 3200);
};

/* ---------------- 分数线 CSV/表格导入 ---------------- */
CF.importScoreFile = function (file) {
  CF.readSpreadsheet(file, function (rows, err) {
    if (err) return CF.toast('读取失败：' + err.message);
    /* 找表头 */
    let hi = -1, cUni = -1, cScore = -1, cProv = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      rows[i].forEach(function (v, c) {
        const s = String(v);
        if (/院校|学校|大学|university/i.test(s) && cUni < 0) { cUni = c; hi = i; }
        if (/分数|线|成绩|score/i.test(s) && cScore < 0 && !/院校|学校/.test(s)) { cScore = c; hi = i; }
        if (/省份|省$/.test(s) && cProv < 0 && cUni < 0) { cProv = c; hi = i; }
      });
      if (hi >= 0 && cUni >= 0 && cScore >= 0) break;
    }
    if (cUni < 0 || cScore < 0) { CF.toast('未找到“院校/分数线”列'); return; }
    if (hi < 0) hi = -1;
    let ok = 0;
    for (let i = hi + 1; i < rows.length; i++) {
      const u = String(rows[i][cUni] == null ? '' : rows[i][cUni]).trim();
      const sc = String(rows[i][cScore] == null ? '' : rows[i][cScore]).replace(/[^\d.]/g, '');
      if (!u || !sc || isNaN(+sc)) continue;
      CF.setScore(u, sc, 'csv'); ok++;
    }
    CF.renderScoreTable(); CF.renderRoster(); CF.render(); CF.autosave();
    CF.toast('已导入 ' + ok + ' 条分数线');
  });
};

/* ---------------- 初始化导入入口 ---------------- */
CF.bindImportUI = function () {
  const fx = document.getElementById('fileExcel');
  document.getElementById('btnImportExcel').onclick = function () { fx.value = ''; fx.click(); };
  fx.onchange = function () {
    if (!fx.files || !fx.files[0]) return;
    CF.readSpreadsheet(fx.files[0], function (rows, err) {
      if (err) return CF.toast('解析失败：' + err.message + '（请确认为 xls/xlsx/csv）');
      if (!rows || !rows.length) return CF.toast('表格为空');
      CF.openImportDialog(rows);
    });
  };
  document.getElementById('btnImpOk').onclick = CF.doImport;

  document.getElementById('btnProvOk').onclick = CF.doProvOk;
  document.getElementById('btnProvAi').onclick = function () {
    const p = CF.provAiPrompt();
    CF.copyText(p, function (ok) { CF.toast(ok ? '提示词已复制，请到任意 AI 网站粘贴' : '复制失败，请手动选择'); });
  };
  document.getElementById('btnProvPaste').onclick = function () {
    const txt = window.prompt('把 AI 返回的 JSON 粘贴到这里：');
    if (txt != null) CF.provAiPaste(txt);
  };

  const fs = document.getElementById('fileScoreCsv');
  document.getElementById('btnScoreCsv').onclick = function () { fs.value = ''; fs.click(); };
  document.getElementById('btnScoreCsv2').onclick = function () { fs.value = ''; fs.click(); };
  fs.onchange = function () { if (fs.files && fs.files[0]) CF.importScoreFile(fs.files[0]); };

  const addRow = function () {
    CF.addStudent('', '', '');
    CF.renderRoster(); CF.autosave();
    const rows = document.querySelectorAll('#rosterBody tr');
    const last = rows[rows.length - 1];
    if (last) { last.querySelector('input').focus(); last.scrollIntoView({ block: 'nearest' }); }
    document.querySelector('[data-tab="tabRoster"]').click();
  };
  document.getElementById('btnAddRow').onclick = addRow;
  document.getElementById('btnRosterAdd').onclick = addRow;
  document.getElementById('btnRosterClear').onclick = function () {
    if (!CF.state.students.length) return;
    CF.confirm('确定清空全部名单？该操作不可撤销（可先“保存”项目）。', function () {
      CF.state.students = [];
      CF.renderRoster(); CF.renderScoreTable(); CF.render(); CF.autosave();
    });
  };

  /* 模板弹窗内的复制/解析等事件在 07-io 中绑定 */
};
