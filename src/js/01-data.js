/* ============================================================
 * 01-data.js — 全局命名空间、主题、字体、省份与城市数据、院校识别字典
 * ============================================================ */
window.CF = {};

/* ---------------- 预设主题 ---------------- */
CF.THEMES = [
  { id:'blue',  name:'清新蓝',   base:'#1d5fd1', accent:'#2f7ae6', bg:'#ffffff', emA:'#14479c', emB:'#41a1ff', low:'#e9f0fc', ink:'#1b2a41', line:'#2f6fd0', gamma:0.75, blkBg:'#f7faff' },
  { id:'red',   name:'荣耀红',   base:'#a92a25', accent:'#d33a3a', bg:'#fffaf7', emA:'#9e1f1f', emB:'#ff7a59', low:'#fdecea', ink:'#3a1d1d', line:'#c23a3a', gamma:0.75, blkBg:'#fff7f5' },
  { id:'green', name:'森系绿',   base:'#1f7a4d', accent:'#2f9e66', bg:'#f9fdfa', emA:'#12603a', emB:'#5cd39a', low:'#e7f6ee', ink:'#1d3328', line:'#2f9e66', gamma:0.75, blkBg:'#f5fdf8' },
  { id:'orange',name:'暖橙黄昏', base:'#bf5510', accent:'#e8801e', bg:'#fffdf7', emA:'#a84208', emB:'#ffb54d', low:'#fdf0e0', ink:'#3a2a18', line:'#e8801e', gamma:0.75, blkBg:'#fffaf1' },
  { id:'gold',  name:'雅致金黑', base:'#9a7a22', accent:'#c9a227', bg:'#15181d', emA:'#e8c65a', emB:'#8a6a1d', low:'#2b303a', ink:'#ece3c8', line:'#c9a227', gamma:0.75, blkBg:'#20242c' },
  { id:'gray',  name:'简约灰蓝', base:'#46617c', accent:'#66829c', bg:'#f6f7f9', emA:'#2f4459', emB:'#8aa2b8', low:'#eceff4', ink:'#2b3644', line:'#66829c', gamma:0.75, blkBg:'#fbfcfd' }
];

CF.ART_STYLES = [
  { id:'gradient', name:'渐变填充' },
  { id:'outline',  name:'描边空心' },
  { id:'3d',       name:'立体投影' },
  { id:'glow',     name:'柔光发光' },
  { id:'seal',     name:'印章风'   }
];

/* ---------------- 字体候选（运行时探测本机是否安装） ---------------- */
CF.FONT_CANDIDATES = [
  { label:'微软雅黑',        css:'"Microsoft YaHei"' },
  { label:'微软雅黑 Light',  css:'"Microsoft YaHei Light"' },
  { label:'宋体',            css:'"SimSun"' },
  { label:'黑体',            css:'"SimHei"' },
  { label:'楷体',            css:'"KaiTi"' },
  { label:'仿宋',            css:'"FangSong"' },
  { label:'隶书',            css:'"LiSu"' },
  { label:'幼圆',            css:'"YouYuan"' },
  { label:'华文行楷',        css:'"STXingkai"' },
  { label:'华文新魏',        css:'"STXinwei"' },
  { label:'华文楷体',        css:'"STKaiti"' },
  { label:'华文隶书',        css:'"STLiti"' },
  { label:'华文宋体',        css:'"STSong"' },
  { label:'华文黑体',        css:'"STHeiti"' },
  { label:'方正姚体',        css:'"FZYaoti"' },
  { label:'方正舒体',        css:'"FZShuTi"' },
  { label:'方正书宋',        css:'"FZShuSong"' },
  { label:'方正黑体简体',    css:'"FZHei-B01S"' },
  { label:'腾祥科布花卉',    css:'"TengXiangKeBuHuaHui"' },
  { label:'站酷庆科黄油体',  css:'"ZCOOLQingKeHuangYou"' },
  { label:'思源黑体',        css:'"Source Han Sans SC"' },
  { label:'思源宋体',        css:'"Source Han Serif SC"' },
  { label:'阿里巴巴普惠体',  css:'"Alibaba PuHuiTi"' },
  { label:'霞鹜文楷',        css:'"LXGW WenKai"' },
  { label:'汉仪颜宋',        css:'"HYQiHei"' },
  { label:'系统默认',        css:'sans-serif' }
];

/* ---------------- 省份短名 / 全名 / 大区 ---------------- */
CF.PROV_ALIAS = {
  '北京市':'北京','天津市':'天津','河北省':'河北','山西省':'山西','内蒙古自治区':'内蒙古',
  '辽宁省':'辽宁','吉林省':'吉林','黑龙江省':'黑龙江','上海市':'上海','江苏省':'江苏',
  '浙江省':'浙江','安徽省':'安徽','福建省':'福建','江西省':'江西','山东省':'山东',
  '河南省':'河南','湖北省':'湖北','湖南省':'湖南','广东省':'广东','广西壮族自治区':'广西',
  '海南省':'海南','重庆市':'重庆','四川省':'四川','贵州省':'贵州','云南省':'云南',
  '西藏自治区':'西藏','陕西省':'陕西','甘肃省':'甘肃','青海省':'青海','宁夏回族自治区':'宁夏',
  '新疆维吾尔自治区':'新疆','台湾省':'台湾','香港特别行政区':'香港','澳门特别行政区':'澳门'
};
CF.shortProv = function (full) {
  if (!full) return '';
  if (CF.PROV_ALIAS[full]) return CF.PROV_ALIAS[full];
  return String(full).replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|维吾尔族)$/g, '');
};
CF.fullProv = function (short) {
  for (const k in CF.PROV_ALIAS) if (CF.PROV_ALIAS[k] === short) return k;
  return short;
};

CF.REGION_ORDER = [
  ['华北', ['北京','天津','河北','山西','内蒙古']],
  ['东北', ['辽宁','吉林','黑龙江']],
  ['华东', ['上海','江苏','浙江','安徽','福建','江西','山东','台湾']],
  ['华中', ['河南','湖北','湖南']],
  ['华南', ['广东','广西','海南','香港','澳门']],
  ['西南', ['重庆','四川','贵州','云南','西藏']],
  ['西北', ['陕西','甘肃','青海','宁夏','新疆']]
];
CF.regionRank = function (prov) {
  for (let i = 0; i < CF.REGION_ORDER.length; i++)
    if (CF.REGION_ORDER[i][1].indexOf(prov) >= 0) return i;
  return 99;
};

/* ---------------- 城市 → 省份（用于院校所在地推断） ---------------- */
CF.CITY_GROUPS = [
  ['北京','北京'], ['天津','天津'], ['上海','上海'], ['重庆','重庆'], ['香港','香港'], ['澳门','澳门'],
  ['河北','石家庄|唐山|秦皇岛|邯郸|邢台|保定|张家口|承德|沧州|廊坊|衡水'],
  ['山西','太原|大同|阳泉|长治|晋城|朔州|晋中|运城|忻州|临汾|吕梁'],
  ['内蒙古','呼和浩特|包头|乌海|赤峰|通辽|鄂尔多斯|呼伦贝尔|巴彦淖尔|乌兰察布|兴安盟|锡林郭勒|阿拉善盟'],
  ['辽宁','沈阳|大连|鞍山|抚顺|本溪|丹东|锦州|营口|阜新|辽阳|盘锦|铁岭|朝阳|葫芦岛'],
  ['吉林','长春|吉林|四平|辽源|通化|白山|松原|白城|延边'],
  ['黑龙江','哈尔滨|齐齐哈尔|鸡西|鹤岗|双鸭山|大庆|伊春|佳木斯|七台河|牡丹江|黑河|绥化|大兴安岭'],
  ['江苏','南京|无锡|徐州|常州|苏州|南通|连云港|淮安|盐城|扬州|镇江|泰州|宿迁'],
  ['浙江','杭州|宁波|温州|嘉兴|湖州|绍兴|金华|衢州|舟山|台州|丽水'],
  ['安徽','合肥|芜湖|蚌埠|淮南|马鞍山|淮北|铜陵|安庆|黄山|滁州|阜阳|宿州|六安|亳州|池州|宣城'],
  ['福建','福州|厦门|莆田|三明|泉州|漳州|南平|龙岩|宁德'],
  ['江西','南昌|景德镇|萍乡|九江|新余|鹰潭|赣州|吉安|宜春|抚州|上饶'],
  ['山东','济南|青岛|淄博|枣庄|东营|烟台|潍坊|济宁|泰安|威海|日照|临沂|德州|聊城|滨州|菏泽'],
  ['河南','郑州|开封|洛阳|平顶山|安阳|鹤壁|新乡|焦作|濮阳|许昌|漯河|三门峡|南阳|商丘|信阳|周口|驻马店|济源'],
  ['湖北','武汉|黄石|十堰|宜昌|襄阳|鄂州|荆门|孝感|荆州|黄冈|咸宁|随州|恩施|仙桃|潜江|天门|神农架'],
  ['湖南','长沙|株洲|湘潭|衡阳|邵阳|岳阳|常德|张家界|益阳|郴州|永州|怀化|娄底|湘西'],
  ['广东','广州|韶关|深圳|珠海|汕头|佛山|江门|湛江|茂名|肇庆|惠州|梅州|汕尾|河源|阳江|清远|东莞|中山|潮州|揭阳|云浮'],
  ['广西','南宁|柳州|桂林|梧州|北海|防城港|钦州|贵港|玉林|百色|贺州|河池|来宾|崇左'],
  ['海南','海口|三亚|三沙|儋州|五指山|琼海|文昌|万宁|东方|白沙|昌江|乐东|陵水|保亭|琼中'],
  ['四川','成都|自贡|攀枝花|泸州|德阳|绵阳|广元|遂宁|内江|乐山|南充|眉山|宜宾|广安|达州|雅安|巴中|资阳|阿坝|甘孜|凉山'],
  ['贵州','贵阳|六盘水|遵义|安顺|毕节|铜仁|黔西南|黔东南|黔南'],
  ['云南','昆明|曲靖|玉溪|保山|昭通|丽江|普洱|临沧|楚雄|红河|文山|西双版纳|大理|德宏|怒江|迪庆'],
  ['西藏','拉萨|日喀则|昌都|林芝|山南|那曲|阿里'],
  ['陕西','西安|铜川|宝鸡|咸阳|渭南|延安|汉中|榆林|安康|商洛'],
  ['甘肃','兰州|嘉峪关|金昌|白银|天水|武威|张掖|平凉|酒泉|庆阳|定西|陇南|临夏|甘南'],
  ['青海','西宁|海东|海北|黄南|玉树|果洛|格尔木|德令哈|都兰|共和'],
  ['宁夏','银川|石嘴山|吴忠|固原|中卫'],
  ['新疆','乌鲁木齐|克拉玛依|吐鲁番|哈密|昌吉|博尔塔拉|巴音郭楞|阿克苏|克孜勒苏|喀什|和田|伊犁|塔城|阿勒泰|石河子'],
  ['台湾','台北|高雄|台中|台南|新北|桃园|基隆|新竹|嘉义|屏东|花莲|台东']
];
CF.CITY2PROV = {};
CF.CITY_GROUPS.forEach(function (g) {
  g[1].split('|').forEach(function (c) { if (!CF.CITY2PROV[c]) CF.CITY2PROV[c] = g[0]; });
});

/* ---------------- 院校别名 / 特例（无法靠名称前缀推断的） ---------------- */
CF.UNI_ALIAS = {
  '北大':'北京', '清华':'北京', '清华大学':'北京', '人大':'北京', '中国人民大学':'北京', '中国人大':'北京',
  '中国科学院大学':'北京', '国科大':'北京', '中国社会科学院大学':'北京', '外交学院':'北京', '国际关系学院':'北京',
  '中央民族':'北京', '中央民族大学':'北京', '中国政法大学':'北京', '对外经济贸易大学':'北京', '对外经贸大学':'北京',
  '北京航空航天':'北京', '北航':'北京', '北京理工大学':'北京', '北理':'北京', '北京师范大学':'北京', '北师大':'北京',
  '首都师范':'北京', '中国传媒大学':'北京', '中央财经大学':'北京', '北京邮电大学':'北京', '华北电力大学':'北京',
  '复旦':'上海', '复旦大学':'上海', '上海交大':'上海', '上海交通大学':'上海', '同济':'上海', '同济大学':'上海',
  '华东师范':'上海', '华东师范大学':'上海', '华师大':'上海', '上海财经大学':'上海', '上财':'上海', '上海外国语大学':'上海',
  '东华大学':'上海', '华东政法大学':'上海', '上海大学':'上海',
  '南开':'天津', '南开大学':'天津', '天津大学':'天津', '天大':'天津',
  '东北大学':'辽宁', '东北大学秦皇岛分校':'河北', '大连理工':'辽宁', '大连理工大学':'辽宁',
  '哈工大':'黑龙江', '哈尔滨工业大学':'黑龙江', '哈工程':'黑龙江', '东北林业大学':'黑龙江', '东北农业大学':'黑龙江',
  '东南大学':'江苏', '河海大学':'江苏', '江南大学':'江苏', '南京师范':'江苏', '中国药科大学':'江苏',
  '中国矿业大学':'江苏', '南京理工':'江苏', '南京理工大学':'江苏', '南京航空航天':'江苏',
  '浙江':'浙江', '中国美术学院':'浙江', '宁波大学':'浙江',
  '中国科学技术大学':'安徽', '中科大':'安徽', '合肥工业':'安徽',
  '华侨大学':'福建', '集美大学':'福建',
  '中国海洋大学':'山东', '青岛大学':'山东', '山东师范':'山东',
  '华北水利水电大学':'河南', '河南大学':'河南',
  '华中科技':'湖北', '华中科技大学':'湖北', '华科':'湖北', '武大':'湖北', '武汉大学':'湖北',
  '中国地质大学':'湖北', '中南财经政法':'湖北', '华中师范':'湖北', '华中农业大学':'湖北',
  '中南大学':'湖南', '湖南师范':'湖南', '国防科技':'湖南', '国防科技大学':'湖南',
  '中山大学':'广东', '中大':'广东', '华南理工':'广东', '华南理工大学':'广东', '暨南大学':'广东',
  '华南师范':'广东', '广东工业':'广东', '南方科技':'广东', '南方科技大学':'广东', '深圳':'广东',
  '广西大学':'广西', '广西师范':'广西',
  '海南大学':'海南', '海南师范':'海南',
  '西南交通':'四川', '西南交通大学':'四川', '电子科大':'四川', '电子科技大学':'四川', '川大':'四川', '四川大学':'四川',
  '西南财经':'四川', '西南石油':'四川', '西南科技大学':'四川', '成都理工':'四川',
  '贵州大学':'贵州', '云南大学':'云南', '云南师范':'云南',
  '西藏大学':'西藏',
  '西北工业':'陕西', '西北工业大学':'陕西', '西工大':'陕西', '西北大学':'陕西', '西安交通':'陕西',
  '西安交通大学':'陕西', '交大':'陕西', '陕师大':'陕西', '西北农林':'陕西', '长安大学':'陕西',
  '兰州大学':'甘肃', '兰大':'甘肃', '西北师范':'甘肃',
  '青海大学':'青海', '宁夏大学':'宁夏', '新疆大学':'新疆', '石河子大学':'新疆', '新疆师范':'新疆',
  '台湾大学':'台湾', '国立台湾大学':'台湾',
  /* 名称带省名但实际在别处的特例 */
  '河北工业大学':'天津',
  /* 通用缩写 */
  '浙大':'浙江', '南大':'江苏', '山大':'山东', '厦大':'福建', '郑大':'河南', '南昌大学':'江西',
  '南京大学':'江苏', '苏州大学':'江苏'
};

/* ---------------- 院校 → 省份 推断 ---------------- */
CF.inferProvince = function (uni) {
  const u = String(uni || '').trim();
  if (!u) return { prov: '', method: 'empty' };
  /* 1) 别名表 */
  if (CF.UNI_ALIAS[u] && CF.UNI_ALIAS[u] !== '浙江') return { prov: CF.UNI_ALIAS[u], method: 'alias' };
  if (CF.UNI_ALIAS[u]) return { prov: CF.UNI_ALIAS[u], method: 'alias' };
  /* 2) 省名前缀（含全称） */
  for (const full in CF.PROV_ALIAS) {
    const short = CF.PROV_ALIAS[full];
    if (u.indexOf(short) === 0 || u.indexOf(full) === 0) return { prov: short, method: 'provPrefix' };
  }
  /* 3) 城市前缀 */
  let best = '';
  for (const c in CF.CITY2PROV) {
    if (u.indexOf(c) === 0 && c.length > best.length) best = c;
  }
  if (best) return { prov: CF.CITY2PROV[best], method: 'cityPrefix' };
  /* 4) 名称中包含城市（如“位于长沙的某校”这类不常见写法） */
  for (const c in CF.CITY2PROV) {
    if (c.length >= 2 && u.indexOf(c) >= 0 && c.length > best.length) best = c;
  }
  if (best) return { prov: CF.CITY2PROV[best], method: 'cityInside' };
  return { prov: '', method: 'unknown' };
};

/* ---------------- 拼音排序（同分/同校按姓名拼音） ---------------- */
CF.pinyinCmp = function (a, b) {
  if (String.prototype.localeCompare) {
    try { return String(a).localeCompare(String(b), 'zh-Hans-CN-u-co-pinyin'); } catch (e) {}
  }
  return String(a) < String(b) ? -1 : String(b) < String(a) ? 1 : 0;
};

/* ---------------- 小工具 ---------------- */
CF.$ = function (sel) { return document.querySelector(sel); };
CF.$$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
CF.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
};
CF.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
CF.uid = function () { return 'e' + Math.random().toString(36).slice(2, 9); };
CF.toast = function (msg, ms) {
  const t = CF.$('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(CF._toastT);
  CF._toastT = setTimeout(function () { t.classList.remove('show'); }, ms || 2400);
};
CF.hex2rgb = function (h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
CF.rgb2hex = function (r, g, b) {
  const f = function (v) { v = Math.round(v).toString(16); return v.length < 2 ? '0' + v : v; };
  return '#' + f(r) + f(g) + f(b);
};
CF.mix = function (c1, c2, t) {
  const a = CF.hex2rgb(c1), b = CF.hex2rgb(c2);
  return CF.rgb2hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
};
/* 颜色加深：向 base 靠近 */
CF.shade = function (low, high, t) { return CF.mix(low, high, CF.clamp(t, 0, 1)); };

/* ---------------- 外观预设 ---------------- */
CF.HEAD_STYLES = [
  { id: 'solid', name: '实心' },
  { id: 'grad', name: '渐变' },
  { id: 'outline', name: '描边' },
  { id: 'underline', name: '下划线' },
  { id: 'invert', name: '反白' },
  { id: 'pill', name: '胶囊' }
];
CF.ROW_STYLES = [
  { id: 'plain', name: '简洁' },
  { id: 'line', name: '分隔线' },
  { id: 'zebra', name: '斑马纹' },
  { id: 'card', name: '卡片行' }
];
CF.ANGLE_STYLES = [
  { id: 'flat', name: '平面', tilt: 0, rot: 0 },
  { id: 'soft', name: '微俯', tilt: 24, rot: 0 },
  { id: 'top', name: '俯视', tilt: 48, rot: 0 },
  { id: 'side', name: '侧倾', tilt: 38, rot: -14 }
];
/* 固定尺寸画布预设（"114"为比例项、"custom"为自由尺寸，均不在此表） */
CF.CANVAS_PRESETS = { A4: [1240, 1754], A3: [1754, 2480], '169': [1600, 900] };
