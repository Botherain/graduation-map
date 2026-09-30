/* ============================================================
 * 04-map.js — ECharts 中国地图：省级色阶、南海小图、像素坐标换算
 * ============================================================ */
CF.provCentroid = {};
CF.provFull2Short = {};
CF.provBBox = {};        /* 每省完整几何轮廓包围盒 [minLng,minLat,maxLng,maxLat] */
if (window.echarts && window.CHINA_GEO) echarts.registerMap('china', window.CHINA_GEO);
(function () {
  const grow = function (c, acc) {   /* 递归遍历 GeoJSON 坐标树 */
    if (typeof c[0] === 'number') {
      if (c[0] < acc[0]) acc[0] = c[0];
      if (c[1] < acc[1]) acc[1] = c[1];
      if (c[0] > acc[2]) acc[2] = c[0];
      if (c[1] > acc[3]) acc[3] = c[1];
      return;
    }
    for (let i = 0; i < c.length; i++) grow(c[i], acc);
  };
  window.CHINA_GEO.features.forEach(function (f) {
    const full = f.properties.name;
    if (!full || !CF.PROV_ALIAS[full]) return;
    const short = CF.shortProv(full);
    CF.provFull2Short[full] = short;
    const c = f.properties.centroid || f.properties.center;
    if (c) CF.provCentroid[short] = c;
    if (f.geometry && f.geometry.coordinates) {
      const acc = [1e9, 1e9, -1e9, -1e9];
      grow(f.geometry.coordinates, acc);
      if (acc[0] < acc[2]) CF.provBBox[short] = acc;
    }
  });
})();

CF._chart = null;      /* 主地图 */
CF._inset = null;      /* 南海小图 */
CF._fit = null;        /* {center, zoom, w, h} */
CF._fitBox = [[73.4, 53.6], [135.2, 17.8]];   /* 主图拟合范围：大陆+台琼 */

CF.mapHostEl = function () { return document.querySelector('.mapHost'); };

CF.mapRegions = function () {
  const st = CF.state, t = CF.theme();
  const groups = CF.groups();
  let max = 0;
  groups.forEach(function (g) { if (g.count > max) max = g.count; });
  const colorOf = {};
  groups.forEach(function (g) { colorOf[g.short] = CF.colorFor(g.count, max); });
  return window.CHINA_GEO.features.map(function (f) {
    const full = f.properties.name;
    const short = CF.provFull2Short[full] || '';
    if (!full) {   /* 九段线（JD 要素，name 为空） */
      return { name: '', itemStyle: { areaColor: t.ink, borderColor: 'transparent', borderWidth: 0 },
               label: { show: false }, silent: true };
    }
    const c = colorOf[short] || CF.mix(t.bg, t.low, 0.85);
    return {
      name: full,
      itemStyle: { areaColor: c, borderColor: t.bg, borderWidth: 0.8 },
      label: { show: false },
      emphasis: { label: { show: false } },
      silent: true
    };
  });
};

/* 主地图初始化 / 更新 */
CF.mapUpdate = function () {
  const host = CF.mapHostEl();
  if (!host || !window.echarts) return;
  if (CF._chart && CF._chart.getDom() !== host) { try { CF._chart.dispose(); } catch (e) {} CF._chart = null; }
  if (!CF._chart) {
    CF._chart = echarts.init(host, null, { renderer: 'canvas' });
    CF._fit = null;
  }
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  /* 容器尺寸变化（拖拽改框、属性面板改宽高）后显式 resize：
     ECharts 不会自动跟随容器，否则地图只画在旧尺寸的一块区域里 */
  if (CF._chart.getWidth() !== w || CF._chart.getHeight() !== h) {
    try { CF._chart.resize(); } catch (e) {}
  }
  const st = CF.state;
  /* 尺寸或角度变化都要重算基础拟合：角度一改，“变换后”的取景随之失效 */
  if (!CF._fit || CF._fit.w !== w || CF._fit.h !== h ||
      CF._fit.tilt !== (st.map.tilt || 0) || CF._fit.rot !== (st.map.rot || 0)) {
    CF._fit = CF.computeFit(w, h);
  }
  const zoom = CF._fit.zoom * (st.map.zoom || 1);
  const baseOpt = function (center) {
    return {
      animation: false,
      geo: {
        map: 'china',
        roam: false,
        silent: true,
        center: center,
        zoom: zoom,
        scaleLimit: { min: 0.1, max: 32 },
        label: { show: false },
        emphasis: { label: { show: false } },
        regions: CF.mapRegions()
      }
    };
  };
  /* 1) 先应用拟合视图；2) 按当前比例换算像素偏移；3) 再应用偏移后的中心 */
  CF._chart.setOption(baseOpt(CF._fit.center), { notMerge: true });
  const lngPer = CF.lngPerPx(CF._fit), latPer = CF.latPerPx(CF._fit);
  const center = [
    CF._fit.center[0] - (st.map.ox || 0) * lngPer,
    CF._fit.center[1] + (st.map.oy || 0) * latPer
  ];
  if (st.map.ox || st.map.oy) CF._chart.setOption(baseOpt(center), { notMerge: true });

  CF.mapUpdateInset();
};
CF.lngPerPx = function (fit) {
  if (!CF._chart) return 0.01;
  const host = CF.mapHostEl();
  try {
    const a = CF._chart.convertToPixel({ geoIndex: 0 }, [fit.center[0], fit.center[1]]);
    const b = CF._chart.convertToPixel({ geoIndex: 0 }, [fit.center[0] + 1, fit.center[1]]);
    const dx = Math.abs(b[0] - a[0]);
    if (dx > 0.01) return 1 / dx;
  } catch (e) {}
  return host.clientWidth / 60;
};
CF.latPerPx = function (fit) {
  if (!CF._chart) return 0.01;
  try {
    const a = CF._chart.convertToPixel({ geoIndex: 0 }, [fit.center[0], fit.center[1]]);
    const b = CF._chart.convertToPixel({ geoIndex: 0 }, [fit.center[0], fit.center[1] - 1]);
    const dy = Math.abs(b[1] - a[1]);
    if (dy > 0.01) return 1 / dy;
  } catch (e) {}
  return 0.01;
};
/* 根据容器尺寸计算拟合 center/zoom。
   取景以“变换后”的实际显示位置为准：逐边收缩，保证内容（含侧倾/透视偏移）
   整体落进 [2%, 98%] 的容器范围；平面模式下与原先 96% 跨度等价。 */
CF.computeFit = function (w, h) {
  const sm = CF.state.map;
  const fit = { center: [104.3, 31.2], zoom: 1, w: w, h: h,
                tilt: (sm.tilt || 0), rot: (sm.rot || 0) };
  if (!CF._chart) return fit;
  const box = CF._fitBox;
  const mx = w * 0.02, my = h * 0.02;
  const setZ = function (z) {
    CF._chart.setOption({ geo: { map: 'china', center: fit.center, zoom: z, regions: [] } });
  };
  let z = 1;
  setZ(z);
  for (let i = 0; i < 6; i++) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, ok = true;
    const pts = [box[0], [box[0][0], box[1][1]], [box[1][0], box[0][1]], box[1]];
    for (let j = 0; j < 4; j++) {
      const p = CF.mapPixelT(pts[j][0], pts[j][1]);
      if (!p) { ok = false; break; }
      if (p[0] < minx) minx = p[0];
      if (p[0] > maxx) maxx = p[0];
      if (p[1] < miny) miny = p[1];
      if (p[1] > maxy) maxy = p[1];
    }
    if (!ok) break;
    const piv = CF.mapPixelT(fit.center[0], fit.center[1]);
    if (!piv) break;
    /* 内容绕 geo 中心（轴心）缩放：逐边限制，保证四边都落进边距内。
       q = 各边允许的缩放倍数的最小值（>1 表示还有放大空间）。
       初值取 4（每轮最多放大 4×，防发散）——绝不能初值 1 再取 min，那样永远只能缩不能涨 */
    let q = 4, any = false;
    const sides = [[piv[0] - minx, piv[0] - mx], [maxx - piv[0], w - mx - piv[0]],
                   [piv[1] - miny, piv[1] - my], [maxy - piv[1], h - my - piv[1]]];
    for (let j = 0; j < 4; j++) {
      const d = sides[j][0], a = sides[j][1];
      if (d > 0.01) { any = true; q = Math.min(q, a > 0 ? a / d : 0.01); }
    }
    if (!any) q = 1;
    if (!isFinite(q) || q <= 0) break;
    z = z * q;
    if (z < 0.05) { z = 0.05; break; }
    if (Math.abs(q - 1) < 0.01) break;
    setZ(z);
  }
  fit.zoom = z;
  return fit;
};
/* 主图上经纬度 → 像素（相对地图容器） */
CF.mapPixel = function (lng, lat) {
  if (!CF._chart) return null;
  try {
    const p = CF._chart.convertToPixel({ geoIndex: 0 }, [lng, lat]);
    if (!p || isNaN(p[0])) return null;
    return p;
  } catch (e) { return null; }
};
/* 经纬度 → 变换后的实际显示坐标（相对地图容器）。
   地图有倾斜/侧转时，CSS 透视变换会把图表坐标推离原位甚至推出容器，
   若按图表坐标取景，变换放大后的内容会被海报边缘裁掉（省界/海岸线被切）。
   这里用隐藏探针读取浏览器实际投影结果（与引线同一方法），保证与渲染完全一致。 */
CF.mapPixelT = function (lng, lat) {
  const p = CF.mapPixel(lng, lat);
  if (!p) return null;
  const st = CF.state;
  if (!st.map.tilt && !st.map.rot) return p;
  const host = CF.mapHostEl();
  const poster = document.getElementById('poster');
  if (!host || !poster) return p;
  let probe = host.querySelector('.mapProbe');
  if (!probe) {
    probe = document.createElement('div');
    probe.className = 'mapProbe';
    host.appendChild(probe);
  }
  probe.style.left = p[0] + 'px';
  probe.style.top = p[1] + 'px';
  const br = probe.getBoundingClientRect();
  const pr = poster.getBoundingClientRect();
  const scale = poster.offsetWidth ? (pr.width / poster.offsetWidth) : 1;
  if (!scale) return p;
  /* 探针给出海报坐标，减去地图框原点得到容器坐标 */
  let mx = 0, my = 0;
  const mapEl = st.elements.find(function (e) { return e.type === 'map'; });
  if (mapEl) { mx = mapEl.x; my = mapEl.y; }
  return [(br.left - pr.left) / scale - mx, (br.top - pr.top) / scale - my];
};

/* ---------------- 缩放聚焦到有学生的省份 ---------------- */
/* 用省份完整几何轮廓（而非中心点）取景，外加 12% 余量，保证省界不被裁切 */
CF.mapFocusApply = function () {
  const st = CF.state;
  if (!CF._chart || !CF._fit) return false;
  const host = CF.mapHostEl();
  if (!host) return false;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return false;
  let lng1 = 1e9, lat1 = 1e9, lng2 = -1e9, lat2 = -1e9;
  CF.groups().forEach(function (g) {
    const b = CF.provBBox[g.short];
    if (!b) return;
    if (b[0] < lng1) lng1 = b[0];
    if (b[1] < lat1) lat1 = b[1];
    if (b[2] > lng2) lng2 = b[2];
    if (b[3] > lat2) lat2 = b[3];
  });
  if (lng1 > lng2) {   /* 无可聚焦省份 → 恢复全图 */
    st.map.zoom = 1; st.map.ox = 0; st.map.oy = 0;
    CF.mapUpdate();
    return false;
  }
  /* 限制在主图可见范围内（排除南海远海岛礁，避免单省聚焦被拉得过远） */
  const fb = CF._fitBox;
  lng1 = Math.max(lng1, fb[0][0]); lng2 = Math.min(lng2, fb[1][0]);
  lat1 = Math.max(lat1, fb[1][1]); lat2 = Math.min(lat2, fb[0][1]);
  /* 外加 12% 余量（至少 1.5°/1.2°），给省界留呼吸空间 */
  const padLng = Math.max((lng2 - lng1) * 0.12, 1.5);
  const padLat = Math.max((lat2 - lat1) * 0.12, 1.2);
  lng1 -= padLng; lng2 += padLng; lat1 -= padLat; lat2 += padLat;
  /* 闭环取景：经纬度跨度→像素的换算受投影非线性影响，直接对投影结果
     做“量范围→修正缩放→量残差→平移”的迭代（2~4 轮收敛），避免裁切 */
  st.map.zoom = 1; st.map.ox = 0; st.map.oy = 0;
  CF.mapUpdate();
  const proj = function () {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    const pts = [[lng1, lat1], [lng1, lat2], [lng2, lat1], [lng2, lat2]];
    for (let i = 0; i < 4; i++) {
      const p = CF.mapPixelT(pts[i][0], pts[i][1]);
      if (!p) return null;
      if (p[0] < minx) minx = p[0];
      if (p[1] < miny) miny = p[1];
      if (p[0] > maxx) maxx = p[0];
      if (p[1] > maxy) maxy = p[1];
    }
    return { minx: minx, miny: miny, maxx: maxx, maxy: maxy };
  };
  const b0 = proj();
  if (!b0) return false;
  /* 初始缩放：包围盒（含余量）占容器 74%，两轴取更紧的一边。
     比例以“变换后”的显示尺寸计算，侧倾/透视的放大量被自然吸收 */
  let k = Math.min((w * 0.74) / Math.max(b0.maxx - b0.minx, 1),
                   (h * 0.74) / Math.max(b0.maxy - b0.miny, 1));
  k = CF.clamp(k, 0.4, 6);
  st.map.zoom = k;
  CF.mapUpdate();
  /* 迭代修正缩放与平移残差（侧倾时投影非线性更强，多迭代几轮） */
  for (let i = 0; i < 6; i++) {
    const b = proj();
    if (!b) break;
    const fk = Math.min((w * 0.74) / Math.max(b.maxx - b.minx, 1),
                        (h * 0.74) / Math.max(b.maxy - b.miny, 1));
    if (Math.abs(fk - 1) > 0.03 && k * fk >= 0.4 && k * fk <= 6) {
      k = k * fk;
      st.map.zoom = k;
      CF.mapUpdate();
      continue;
    }
    const dx = w / 2 - (b.minx + b.maxx) / 2;
    const dy = h / 2 - (b.miny + b.maxy) / 2;
    if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) break;
    st.map.ox = Math.round(CF.clamp(st.map.ox + dx, -600, 600));
    st.map.oy = Math.round(CF.clamp(st.map.oy + dy, -600, 600));
    CF.mapUpdate();
  }
  return true;
};

/* ---------------- 南海诸岛小图 ---------------- */
CF.mapUpdateInset = function () {
  const host = CF.mapHostEl();
  if (!host) return;
  const st = CF.state;
  /* 小图挂在未变换的内容层（.el-content）上：若放进被侧倾变换的 .mapHost，
     角标会随透视飞出容器被海报裁掉。wrap 查询同时兼容旧位置并自动迁移 */
  const wrap = host.parentElement || host;
  let box = wrap.querySelector('.seaInset');
  if (!st.map.inset) {
    if (CF._inset) { try { CF._inset.dispose(); } catch (e) {} CF._inset = null; }
    if (box) box.remove();
    return;
  }
  const H = host.clientHeight, W = host.clientWidth;
  const size = Math.round(Math.min(H, W * 1.4) * st.map.insetSize / 100);
  const ih = size, iw = Math.round(size * 0.82);
  if (box && box.parentElement !== wrap) wrap.appendChild(box);
  if (!box) {
    box = document.createElement('div');
    box.className = 'seaInset';
    box.style.cssText = 'position:absolute;right:8px;bottom:8px;z-index:3;pointer-events:none;' +
      'border-radius:3px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.25);';
    wrap.appendChild(box);
  }
  const t = CF.theme();
  const bgRgb = CF.hex2rgb(t.bg), inRgb = CF.hex2rgb(t.ink);
  box.style.width = iw + 'px';
  box.style.height = ih + 'px';
  box.style.border = '1.6px solid rgba(' + inRgb.join(',') + ',.78)';
  box.style.background = 'rgba(' + bgRgb.join(',') + ',.90)';
  if (!CF._inset || CF._inset.getDom() !== box) {
    CF._inset = echarts.init(box, null, { renderer: 'canvas' });
  }
  const regions = CF.mapRegions();
  CF._inset.setOption({
    animation: false,
    geo: {
      map: 'china', roam: false, silent: true, label: { show: false },
      boundingCoords: [[105.5, 1.5], [123, 26]],
      emphasis: { label: { show: false } },
      itemStyle: { borderColor: 'rgba(' + inRgb.join(',') + ',.45)', borderWidth: 0.5 },
      regions: regions
    }
  }, { notMerge: true });
  const cap = box.querySelector('.cap');
  if (!cap) {
    const c = document.createElement('div');
    c.className = 'cap';
    c.style.cssText = 'position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:10px;' +
      'padding:1px 0;line-height:1.3;';
    c.textContent = '南海诸岛';
    box.appendChild(c);
  }
  const capEl = box.querySelector('.cap');
  capEl.style.color = t.ink;
  capEl.style.background = 'rgba(' + bgRgb.join(',') + ',.78)';
  if (CF._inset) setTimeout(function () { try { CF._inset.resize(); } catch (e) {} }, 0);
};

/* 尺寸变化监听 */
CF.mapObserve = function () {
  const host = CF.mapHostEl();
  if (!host || CF._observed === host) return;
  CF._observed = host;
  if (window.ResizeObserver) {
    let t = null;
    CF._ro = new ResizeObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () {
        /* 画布尺寸变化时，聚焦模式按新尺寸重新取景，避免偏移错位造成裁切 */
        if (CF.state.map.focus) {
          try { CF.mapFocusApply(); } catch (e) {}
          if (CF.syncMapSliders) CF.syncMapSliders();
        } else {
          CF.mapUpdate();
        }
        CF.renderLines();
      }, 120);
    });
    CF._ro.observe(host);
  }
};
