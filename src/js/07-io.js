/* ============================================================
 * 07-io.js — 联网搜索分数线、AI 手动查询、导出、初始化
 * ============================================================ */

/* ---------------- 剪贴板 ---------------- */
CF.copyText = function (txt, cb) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { cb(true); }, function () { cb(CF._copyFallback(txt)); });
  } else cb(CF._copyFallback(txt));
};
CF._copyFallback = function (txt) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove();
  return ok;
};

/* ---------------- 公共 CORS 代理 ---------------- */
CF.PROXIES = [
  function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
  function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
  function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); },
  function (u) { return 'https://api.cors.lol/?url=' + encodeURIComponent(u); },
  function (u) { return 'https://cors.eu.org/' + u; },
  function (u) { return 'https://test.cors.workers.dev/?' + u; }
];
CF.fetchViaProxy = function (url, ms, validate) {
  ms = ms || 6000;
  let i = 0, rounds = 0;
  const next = function () {
    if (i >= CF.PROXIES.length) {
      if (rounds < 1) { rounds++; i = 0; }          /* 再重试一轮 */
      else return Promise.reject(new Error('全部代理失败'));
    }
    const prox = CF.PROXIES[i++];
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(prox(url), ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) {
        if (t) clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (txt) {
        /* 相关性校验：代理缓存可能返回别人的结果页，不相关则换下一个代理 */
        if (validate && !validate(txt)) throw new Error('内容不相关(缓存污染)');
        return txt;
      })
      .catch(function (e) { if (t) clearTimeout(t); return next(); });
  };
  return next();
};

/* ---------------- 网页搜索分数线 ---------------- */
CF.extractScores = function (html, hint) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const texts = [];
  /* 优先搜索引擎结果条目的标题与摘要 */
  doc.querySelectorAll('li.b_algo').forEach(function (li) {
    const h2 = li.querySelector('h2');
    const p = li.querySelector('p, .b_caption p, .b_lineclamp2');
    if (h2 && h2.textContent.trim()) texts.push(h2.textContent.trim());
    if (p && p.textContent.trim()) texts.push(p.textContent.trim());
  });
  doc.querySelectorAll('.b_snippet, .c-paragraph, .result__snippet, .result__a').forEach(function (n) {
    const t = (n.textContent || '').trim(); if (t) texts.push(t);
  });
  if (!texts.length) doc.querySelectorAll('p, h2, h3').forEach(function (n) {
    const t = (n.textContent || '').trim(); if (t) texts.push(t);
  });
  const out = [];
  const seen = {};
  const push = function (v, t, pri) {
    if (v < 250 || v > 720 || seen[v]) return;
    seen[v] = 1;
    out.push({ score: v, snip: t.slice(0, 150), pri: pri });
  };
  const texts24 = texts.slice(0, 40);
  for (let ti = 0; ti < texts24.length; ti++) {
    const t = texts24[ti];
    /* 一级：关键词后紧跟数字（最可靠）；若前面紧邻本省名则优先 */
    const re1 = /(?:最低(?:分|录取分|投档分)?|录取(?:分数)?线|投档线|调档线|分数线?)[^0-9]{0,14}(\d{3,4})/g;
    let m;
    while ((m = re1.exec(t))) {
      const ctx = t.slice(Math.max(0, m.index - 26), m.index);
      push(+m[1], t, (hint && ctx.indexOf(hint) >= 0) ? -1 : 0);
    }
    /* 二级：正文含录取类关键词时，“NNN分”也算候选 */
    if (/录取|投档|最低|分数线|高校|大学/.test(t)) {
      const re2 = /(\d{3,4})\s*分/g;
      while ((m = re2.exec(t))) push(+m[1], t, 1);
    }
    if (out.length > 6) break;
  }
  out.sort(function (a, b) { return a.pri - b.pri; });
  return out.slice(0, 4);
};
CF.searchOne = function (uni) {
  const st = CF.state;
  const q = uni + ' ' + CF.fullProv(st.info.prov) + ' ' + (st.info.year || '') + '年 高考 最低录取分数线';
  /* 校验返回页确实与该院校相关（防代理缓存返回无关内容） */
  const token = uni.replace(/[（(].*$/, '').slice(0, 2);
  const mkValidate = function (headSel) {
    return function (html) {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (doc.title && doc.title.indexOf(token) >= 0) return true;
        let head = '';
        doc.querySelectorAll(headSel).forEach(function (n, i) {
          if (i < 8) head += ' ' + (n.textContent || '');
        });
        return head.indexOf(token) >= 0;
      } catch (e) { return false; }
    };
  };
  const engines = [
    { url: 'https://www.bing.com/search?q=' + encodeURIComponent(q) + '&setlang=zh-hans&mkt=zh-CN',
      val: mkValidate('li.b_algo h2, h1, h2') },
    { url: 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
      val: mkValidate('.result__a, h1, h2') },
    { url: 'https://www.baidu.com/s?wd=' + encodeURIComponent(q),
      val: mkValidate('.c-title, h3') }
  ];
  const tryEng = function (idx) {
    if (idx >= engines.length) return Promise.resolve([]);
    const e = engines[idx];
    return CF.fetchViaProxy(e.url, 6000, e.val)
      .then(function (html) { return CF.extractScores(html, CF.shortProv(st.info.prov)); })
      .catch(function (err) { return tryEng(idx + 1); });
  };
  /* 单校搜索总时限：即使所有代理都超时也不让用户久等 */
  const deadline = new Promise(function (res) { setTimeout(function () { res([]); }, 45000); });
  return Promise.race([tryEng(0), deadline]);
};
CF.openSearchDialog = function () {
  const unis = CF.uniqueUnis();
  if (!unis.length) return CF.toast('先导入名单');
  document.getElementById('srchSum').textContent =
    '将查询 ' + unis.length + ' 所院校在【' + CF.fullProv(CF.state.info.prov) + '】' +
    CF.state.info.year + ' 年的最低录取分数线（经公共代理抓取搜索引擎结果）。';
  const tb = document.getElementById('srchRows');
  tb.innerHTML = unis.map(function (u, i) {
    const cur = CF.getScore(u);
    return '<tr><td>' + CF.esc(u) + '</td>' +
      '<td><input data-i="' + i + '" class="sSco" value="' + (cur == null ? '' : cur) + '" placeholder="—"></td>' +
      '<td class="stat sSnip" data-i="' + i + '" title="点击可手动填写">待搜索</td></tr>';
  }).join('');
  CF._srchUnis = unis;
  CF.openModal('dlgSearch');
};
CF.runSearch = function () {
  const unis = CF._srchUnis;
  const tb = document.getElementById('srchRows');
  const prog = document.getElementById('srchProg');
  document.getElementById('btnSrchGo').disabled = true;
  let done = 0, hit = 0;
  const limit = 3;
  let idx = 0;
  const worker = function () {
    if (idx >= unis.length) return Promise.resolve();
    const i = idx++;
    const u = unis[i];
    return CF.searchOne(u).then(function (cands) {
      done++;
      if (cands.length) {
        hit++;
        const row = tb.children[i];
        const inp = row.querySelector('.sSco');
        if (!inp.value) inp.value = cands[0].score;
        const sn = row.querySelector('.sSnip');
        sn.textContent = cands.map(function (c) { return c.score; }).join(' / ') + ' — ' + cands[0].snip;
        sn.title = cands[0].snip;
      } else {
        tb.children[i].querySelector('.sSnip').textContent = '未抓到，可手动填';
      }
      prog.textContent = '进度 ' + done + '/' + unis.length + '（命中 ' + hit + '）';
      return worker();
    });
  };
  const ws = [];
  for (let k = 0; k < limit; k++) ws.push(worker());
  Promise.all(ws).then(function () {
    document.getElementById('btnSrchGo').disabled = false;
    prog.textContent = '完成：' + done + ' 所，命中 ' + hit + ' 所';
    CF.toast('搜索完成，核对后点“应用到名单”');
  });
};
CF.applySearch = function () {
  const tb = document.getElementById('srchRows');
  let n = 0;
  CF._srchUnis.forEach(function (u, i) {
    const v = tb.children[i].querySelector('.sSco').value;
    if (v && !isNaN(+v)) { CF.setScore(u, v, 'web'); n++; }
  });
  CF.closeModal();
  CF.renderScoreTable(); CF.renderRoster(); CF.render();
  CF.toast('已应用 ' + n + ' 条分数线');
};

/* ---------------- AI 手动查询 ---------------- */
CF.openAiDialog = function () {
  const unis = CF.uniqueUnis();
  if (!unis.length) return CF.toast('先导入名单');
  const st = CF.state;
  const list = JSON.stringify(unis, null, 0);
  document.getElementById('aiPrompt').value =
    '请查询以下中国大学 ' + (st.info.year || '2026') + ' 年在【' + CF.fullProv(st.info.prov) +
    '】高考招生的最低录取分数线（本科批/普通类即可；若分科类，取理科或物理类）。' +
    '不确定的写 null。只返回一个 JSON 数组，不要任何解释文字，数组元素格式：' +
    '{"院校":"学校全名","分数":650}\n' + list;
  document.getElementById('aiResult').value = '';
  document.getElementById('aiRows').innerHTML = '';
  document.getElementById('aiStat').textContent = '';
  CF.openModal('dlgAi');
};
CF.parseAiResult = function (txt) {
  let s = String(txt || '').trim();
  if (!s) return null;
  s = s.replace(/```json|```/gi, '').trim();
  const unis = CF.uniqueUnis();
  const pickUni = function (raw) {
    const r = String(raw).trim();
    if (unis.indexOf(r) >= 0) return r;
    for (let i = 0; i < unis.length; i++)
      if (unis[i].indexOf(r) >= 0 || r.indexOf(unis[i]) >= 0) return unis[i];
    return null;
  };
  const arr = [];
  const push = function (rawUni, rawScore) {
    const u = pickUni(rawUni);
    const sc = String(rawScore).replace(/[^\d.]/g, '');
    if (u && sc && +sc > 100) arr.push({ uni: u, score: Math.round(+sc) });
  };
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) {
      j.forEach(function (o) {
        if (o && typeof o === 'object') {
          const uk = Object.keys(o).find(function (k) { return /院校|学校|大学|univ|school/i.test(k); });
          const sk = Object.keys(o).find(function (k) { return /分数|线|score|point/i.test(k); });
          if (uk && sk) push(o[uk], o[sk]);
        } else if (typeof o === 'string') {
          const m = o.match(/^(.+?)[\s:：,，]+(\d{3,4})$/);
          if (m) push(m[1], m[2]);
        }
      });
    } else if (typeof j === 'object') {
      Object.keys(j).forEach(function (k) { push(k, j[k]); });
    }
  } catch (e) {
    /* 尝试 Markdown 表格 */
    const lines = s.split('\n').filter(function (l) { return l.indexOf('|') > 0; });
    if (lines.length >= 2) {
      let hdr = lines[0].split('|').map(function (x) { return x.trim(); });
      let iu = hdr.findIndex(function (h) { return /院校|学校|大学/.test(h); });
      let is = hdr.findIndex(function (h) { return /分数|线/.test(h); });
      let start = 1;
      if (lines[1].replace(/|-\s*/g, '').replace(/[|\s-]/g, '') === '') start = 2;
      if (iu < 0) iu = 0;
      for (let li = start; li < lines.length; li++) {
        const cells = lines[li].split('|').map(function (x) { return x.trim(); });
        const sc = is >= 0 ? cells[is] : cells[cells.length - 1];
        if (cells[iu]) push(cells[iu], sc);
      }
    }
    if (!arr.length && /(\d{3})/.test(s)) {
      /* 兜底：按名单顺序逐个提取数字 */
      unis.forEach(function (u) {
        const idx = s.indexOf(u);
        if (idx < 0) return;
        const tail = s.slice(idx, idx + 80);
        const m = tail.match(/(\d{3,4})/);
        if (m && +m[1] > 300 && +m[1] < 750) push(u, m[1]);
      });
    }
  }
  return arr;
};
CF.showAiPreview = function (items) {
  const tb = document.getElementById('aiRows');
  if (!items || !items.length) {
    tb.innerHTML = '<tr><td colspan="3" class="stat">未解析到有效结果</td></tr>';
    document.getElementById('aiStat').textContent = '解析失败';
    return;
  }
  tb.innerHTML = items.map(function (it, i) {
    return '<tr><td>' + CF.esc(it.uni) + '</td><td>' + it.score + '</td>' +
      '<td style="text-align:center"><input type="checkbox" data-i="' + i + '" checked></td></tr>';
  }).join('');
  CF._aiItems = items;
  document.getElementById('aiStat').textContent = '解析到 ' + items.length + ' 条，请勾选后应用';
};
CF.applyAi = function () {
  const items = CF._aiItems || [];
  let n = 0;
  CF.$$('#aiRows input[type=checkbox]').forEach(function (ck) {
    if (!ck.checked) return;
    const it = items[+ck.dataset.i];
    if (it) { CF.setScore(it.uni, it.score, 'ai'); n++; }
  });
  CF.closeModal();
  CF.renderScoreTable(); CF.renderRoster(); CF.render();
  CF.toast('已应用 ' + n + ' 条分数线');
};

/* ---------------- 导出 ---------------- */
CF.exportShot = function (scale) {
  const st = CF.state;
  /* 同步可能排队的渲染并强制刷新海报尺寸，保证截图尺寸与元素位置跟状态一致 */
  if (CF._renderQueued) { CF._renderQueued = false; try { CF.doRender(); } catch (e) {} }
  CF.applyPosterSize();
  CF.selectEl(null);
  document.getElementById('gridOverlay').hidden = true;
  document.body.classList.add('exporting', 'expFlat');
  const poster = document.getElementById('poster');
  return new Promise(function (resolve) { setTimeout(resolve, 90); })
    .then(function () {
      return html2canvas(poster, {
        scale: scale, backgroundColor: CF.theme().bg, logging: false, useCORS: true,
        width: st.canvas.w, height: st.canvas.h,
        windowWidth: st.canvas.w + 20, windowHeight: st.canvas.h + 20
      });
    })
    .then(function (cv) {
      document.body.classList.remove('exporting', 'expFlat');
      document.getElementById('gridOverlay').hidden = !st.layout.grid;
      return cv;
    }, function (e) {
      document.body.classList.remove('exporting', 'expFlat');
      document.getElementById('gridOverlay').hidden = !st.layout.grid;
      throw e;
    });
};
/* 导出前检查：正常时静默通过，仅当导出结果会“缺内容”时弹窗提醒 */
CF.preExportGuard = function (cb) {
  const st = CF.state;
  if (!st.students.length) {
    CF.confirm('名单还是空的，导出的图上将没有任何学生信息。仍然导出？', cb, '提醒：缺少内容');
    return;
  }
  const noProv = st.students.filter(function (s) { return !s.prov; }).length;
  if (noProv) {
    CF.confirm('有 ' + noProv + ' 名学生的院校省份未补全（名单中显示“待补全”），这些学生不会出现在地图上。仍然导出？', cb, '提醒：缺少内容');
    return;
  }
  cb();
};
CF.exportPNG = function (scale) {
  CF.preExportGuard(function () { CF._exportPNG(scale); });
};
CF._exportPNG = function (scale) {
  CF.toast('正在生成 PNG（' + scale + 'x），请稍候…', 6000);
  CF.exportShot(scale).then(function (cv) {
    const a = document.createElement('a');
    a.download = CF.fileName() + '_' + scale + 'x.png';
    a.href = cv.toDataURL('image/png');
    a.click();
    CF.toast('PNG 已导出');
  }).catch(function (e) { CF.toast('导出失败：' + e.message); });
};
CF.fileName = function () {
  const t = CF.state.info.title || '蹭饭图';
  return t.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
};
CF.exportPDF = function () {
  CF.preExportGuard(CF._exportPDF);
};
CF._exportPDF = function () {
  const st = CF.state;
  CF.toast('正在生成 PDF，请稍候…', 6000);
  CF.exportShot(2).then(function (cv) {
    const DPI = 150;
    const wmm = st.canvas.w / DPI * 25.4, hmm = st.canvas.h / DPI * 25.4;
    const jspdf = window.jspdf || {};
    const doc = new jspdf.jsPDF({
      orientation: st.canvas.w > st.canvas.h ? 'landscape' : 'portrait',
      unit: 'mm', format: [wmm, hmm], compress: true
    });
    doc.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, wmm, hmm);
    doc.save(CF.fileName() + '.pdf');
    CF.toast('PDF 已导出');
  }).catch(function (e) { CF.toast('PDF 导出失败：' + e.message); });
};
CF.doPrint = function () {
  CF.preExportGuard(CF._doPrint);
};
CF._doPrint = function () {
  const st = CF.state;
  CF.selectEl(null);
  let s = document.getElementById('printStyle');
  if (!s) { s = document.createElement('style'); s.id = 'printStyle'; document.head.appendChild(s); }
  s.textContent = '@page { size: ' + st.canvas.w + 'px ' + st.canvas.h + 'px; margin: 0; }';
  window.print();
};

/* ---------------- 标签页 / 弹窗通用绑定 ---------------- */
CF.bindTabsModals = function () {
  CF.$$('#tabs button').forEach(function (b) {
    b.onclick = function () {
      CF.$$('#tabs button').forEach(function (x) { x.classList.remove('active'); });
      CF.$$('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
      b.classList.add('active');
      document.getElementById(b.dataset.tab).classList.add('active');
    };
  });
  CF.$$('.m-close').forEach(function (b) { b.onclick = CF.closeModal; });
  document.getElementById('modalBack').addEventListener('click', function (e) {
    if (e.target.id === 'modalBack') CF.closeModal();
  });
};

/* ---------------- 模板弹窗 ---------------- */
CF.openTplDialog = function () {
  CF.renderTplList();
  document.getElementById('tplName').value = '';
  CF.openModal('dlgTpl');
};
CF.renderTplList = function () {
  const all = CF.tplList();
  const names = Object.keys(all);
  const box = document.getElementById('tplList');
  box.innerHTML = names.length ? names.map(function (n) {
    return '<div class="tpl-item"><span>' + CF.esc(n) + '</span>' +
      '<button class="sm tplUse" data-n="' + CF.esc(n) + '">套用</button>' +
      '<button class="sm danger tplDel" data-n="' + CF.esc(n) + '">删除</button></div>';
  }).join('') : '<p class="tip">还没有保存的模板</p>';
  box.onclick = function (e) {
    const t = e.target;
    if (t.classList.contains('tplUse')) { CF.tplApply(t.dataset.n); CF.closeModal(); CF.toast('已套用模板：' + t.dataset.n); }
    if (t.classList.contains('tplDel')) { CF.tplRemove(t.dataset.n); CF.renderTplList(); }
  };
};

/* ---------------- 示例数据 ---------------- */
CF.seedDemo = function () {
  const info = CF.state.info;
  info.title = '青春不散场 · 蹭饭图';
  info.year = '2026'; info.cls = '高三(1)班';
  info.school = '示范中学'; info.prov = '北京'; info.city = '北京';
  info.teachers = '张建国、李秀兰、王海涛';
  info.notes = '愿你历尽千帆，归来仍是少年。';
  const demo = [
    ['张伟', '清华大学'], ['李静', '北京大学'], ['王磊', '上海交通大学'], ['刘洋', '复旦大学'],
    ['陈晨', '浙江大学'], ['杨帆', '南京大学'], ['黄鑫', '武汉大学'], ['周洁', '华中科技大学'],
    ['徐凯', '中山大学'], ['孙悦', '四川大学'], ['马超', '西安交通大学'], ['朱琳', '哈尔滨工业大学'],
    ['胡斌', '山东大学'], ['郭雪', '厦门大学'], ['何强', '中南大学'], ['高源', '天津大学'],
    ['林芳', '南开大学'], ['罗宇', '吉林大学'], ['郑楠', '大连理工大学'], ['梁颖', '苏州大学']
  ];
  const scores = {
    '清华大学': 690, '北京大学': 688, '上海交通大学': 682, '复旦大学': 680, '浙江大学': 672,
    '南京大学': 665, '华中科技大学': 658, '武汉大学': 655, '西安交通大学': 650,
    '哈尔滨工业大学': 648, '四川大学': 645, '天津大学': 642, '中山大学': 640,
    '厦门大学': 638, '中南大学': 635, '山东大学': 630, '南开大学': 646, '吉林大学': 618,
    '大连理工大学': 625, '苏州大学': 612
  };
  demo.forEach(function (d) { CF.addStudent(d[0], d[1]); });
  Object.keys(scores).forEach(function (u) { CF.setScore(u, scores[u], 'manual'); });
};

/* ---------------- 初始化 ---------------- */
CF.init = function () {
  const restored = CF.autoRestore();
  CF.bindInfoPanel();
  CF.bindImportUI();
  CF.bindLookPanel();
  CF.bindCanvas();
  CF.ppBind();
  CF.bindTabsModals();

  if (!restored && !CF.state.students.length) {
    CF.seedDemo();
    setTimeout(function () { CF.toast('已载入示例数据 —— 可在「名单」页清空后导入你的班级名单', 5000); }, 900);
  }
  CF.syncPanelFromState();
  if (!CF.state.elements.length) CF.layoutAuto(true);
  else CF.applyPosterVars();

  /* 工具栏事件 */
  document.getElementById('btnWebSearch').onclick = CF.openSearchDialog;
  document.getElementById('btnScoreWeb2').onclick = CF.openSearchDialog;
  document.getElementById('btnSrchGo').onclick = CF.runSearch;
  document.getElementById('btnSrchOk').onclick = CF.applySearch;
  document.getElementById('btnAiQuery').onclick = CF.openAiDialog;
  document.getElementById('btnScoreAi2').onclick = CF.openAiDialog;
  document.getElementById('btnAiCopy').onclick = function () {
    CF.copyText(document.getElementById('aiPrompt').value, function (ok) {
      CF.toast(ok ? '提示词已复制 → 粘贴到 AI 网站 → 把结果贴回下方' : '复制失败，请手动全选复制');
    });
  };
  document.getElementById('btnAiParse').onclick = function () {
    CF.showAiPreview(CF.parseAiResult(document.getElementById('aiResult').value));
  };
  document.getElementById('btnAiOk').onclick = CF.applyAi;
  document.getElementById('btnPng1').onclick = function () { CF.exportPNG(1); };
  document.getElementById('btnPng2').onclick = function () { CF.exportPNG(2); };
  document.getElementById('btnPng4').onclick = function () { CF.exportPNG(4); };
  document.getElementById('btnPdf').onclick = CF.exportPDF;
  document.getElementById('btnPrint').onclick = CF.doPrint;
  document.getElementById('btnSaveProj').onclick = CF.saveProj;
  document.getElementById('btnLoadProj').onclick = function () {
    CF.confirm('读取将覆盖当前内容，继续？', CF.loadProj, '读取项目');
  };
  document.getElementById('btnTpl').onclick = CF.openTplDialog;
  document.getElementById('btnTplSave').onclick = function () {
    const n = document.getElementById('tplName').value.trim();
    if (!n) return CF.toast('请输入模板名称');
    CF.tplSave(n); CF.renderTplList(); CF.toast('模板已保存：' + n);
  };

  CF.zoomFit();
  CF.render();
  window.addEventListener('resize', function () { clearTimeout(CF._rsT); CF._rsT = setTimeout(CF.zoomFit, 200); });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', CF.init);
else CF.init();
