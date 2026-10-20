import { zhCity, zhRegion } from './places-zh';

export type Lang = 'zh' | 'en';

const KEY = 'te-lang';

function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'zh' || v === 'en') return v;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export let lang: Lang = initial();

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage blocked */
  }
  applyDocument();
  window.dispatchEvent(new CustomEvent('langchange'));
}

export function applyDocument() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('app.title');
}

type Dict = Record<string, string>;

const zh: Dict = {
  'app.title': '流量地球',
  'app.name': '流量地球',
  'app.sub': '实时网络流向',
  'common.save': '保存',
  'common.cancel': '取消',
  'common.copy': '复制',
  'common.copied': '已复制',
  'common.test': '测试',
  'common.testConn': '测试连接',
  'common.testing': '测试中…',
  'common.saved': '已保存',
  'common.edit': '编辑',
  'common.delete': '删除',
  'common.enable': '启用',
  'common.disable': '停用',
  'common.next': '下一步',
  'common.back': '上一步',
  'common.finish': '完成',
  'common.none': '暂无',
  'lang.label': '语言',
  'lang.zh': '中文',
  'lang.en': 'English',

  'hud.throughput': '实时吞吐',
  'hud.in': '↓ 流入',
  'hud.out': '↑ 流出',
  'hud.conns': '活动连接',
  'hud.todayTotal': '今日总量',
  'hud.todayDown': '↓ 下载',
  'hud.todayUp': '↑ 上传',
  'hud.categories': '流量分类',
  'hud.now': '实时',
  'hud.todayTab': '今日',
  'hud.current': '当前',
  'hud.todayShort': '今日',
  'hud.filterNowOnly': '筛选设备时只显示实时',
  'hud.top': '流向排行',
  'hud.byTarget': '目标',
  'hud.byRegion': '地区',
  'hud.devices': '设备',
  'hud.settings': '设置',
  'hud.onlyDevice': '只看 {name}',
  'hud.clearFilter': '点击取消筛选',
  'hud.noTraffic': '暂无流量',
  'hud.todayBytes': '今日 {v}',
  'hud.connCount': '{n} 个连接',
  'hud.inbound': '外部访问',
  'hud.noSources': '还没有启用的数据源，去「设置 → 数据源」添加',
  'hud.reconnecting': '与服务器的连接断开，正在重连…',
  'hud.attribution': 'IP 地理位置数据来自 DB-IP（CC BY 4.0）',
  'hud.arcHint': '光点流动方向即数据流向 · 越亮越快速率越高 · 颜色表示类别',
  'hud.quality': '画质：{q}',
  'hud.qualityAuto': '（自动）',
  'hud.q.high': '高', 'hud.q.medium': '中', 'hud.q.low': '低',
  'demo.phone': '手机', 'demo.computer': '电脑', 'demo.tablet': '平板', 'demo.tv': '电视', 'demo.storage': '存储',
  'demo.smart': '智能设备', 'demo.router': '路由器', 'demo.device': '设备',
  'hud.home': '家',
  'hud.router': '路由器',
  'hud.unknownDevice': '未命名设备',
  'hud.unknownPlace': '未知位置',

  'cat.video': '视频', 'cat.social': '社交', 'cat.comm': '通讯', 'cat.ai': 'AI', 'cat.dev': '开发', 'cat.game': '游戏',
  'cat.music': '音乐', 'cat.shop': '购物', 'cat.news': '资讯', 'cat.download': '下载更新', 'cat.cloud': '云与 CDN',
  'cat.iot': '智能家居', 'cat.system': '系统服务', 'cat.ads': '广告追踪', 'cat.inbound': '外部访问', 'cat.lan': '内网',
  'cat.other': '其他',

  'login.password': '管理员密码',
  'login.go': '进入',

  'setup.subtitle': '首次设置',
  'setup.step1': '① 连接你的路由器',
  'setup.step1.desc': '流量地球以只读方式读取 OpenWrt 路由器的连接表，支持 OpenWrt、ImmortalWrt 23.05 及以上版本。',
  'setup.mihomo': '可选：mihomo 增强',
  'setup.mihomo.check': '这台路由器上运行着 mihomo（Nikki、OpenClash 或 mihomo 内核）',
  'setup.mihomo.desc': '接入后能看到具体域名和代理出口。如果路由器用的是 fake-ip 模式，强烈建议开启，否则被代理的连接无法定位。',
  'setup.step2': '② 家在哪里',
  'setup.step3': '③ 管理员密码',
  'setup.step3.desc': '在这里能看到全家的上网记录，所以必须设置密码。',
  'setup.pw': '密码（至少 8 位）',
  'setup.pw2': '再输入一次',
  'setup.needCommand': '请先生成配置命令，并在路由器上执行',
  'setup.needTest': '请先点「测试连接」，确认能连上路由器',
  'setup.badCoords': '请填写有效的经纬度',
  'setup.pwShort': '密码至少 8 位',
  'setup.pwMismatch': '两次输入的密码不一致',

  'ow.name': '名称',
  'ow.namePh': '例如：主路由',
  'ow.url': '路由器地址（LuCI 所在的地址）',
  'ow.gen': '生成配置命令',
  'ow.regen': '重新生成配置命令（会更换密码）',
  'ow.run': '用 SSH 登录路由器（或使用 LuCI 的「系统 → 终端」），执行下面这一行：',
  'ow.localhost': '你现在是通过 localhost 打开的页面，路由器访问不到这个地址，请改用下面的「完整脚本」。',
  'ow.fullScript': '路由器访问不到这台服务器？展开完整脚本，直接粘贴执行',
  'ow.explain': '这个脚本只做三件事：放一个只读的 rpcd 插件、建一个只能调用该插件的登录账号、重启 rpcd（LuCI 需要重新登录，不影响上网）。命令 1 小时内有效。',
  'ow.poll': '轮询间隔（秒）',
  'ow.pollHint': '路由器繁忙时会自动放慢',
  'ow.wan': 'WAN 接口',
  'ow.wanPh': '留空则自动识别，例如 pppoe-wan',
  'ow.wanHint': '用于统计总流量',

  'mi.name': '名称',
  'mi.namePh': '例如：路由器上的 mihomo',
  'mi.url': '控制器地址',
  'mi.urlHint': '即 mihomo 配置中的 external-controller，必须监听在局域网地址上，不能是 127.0.0.1',
  'mi.secret': 'Secret',
  'mi.secretKeep': '留空则不修改',
  'mi.secretPh': 'external-controller 的 secret',
  'mi.link': '与路由器合并',
  'mi.linkNone': '不合并（独立的 mihomo，比如电脑上的客户端）',
  'mi.linkOn': '运行在 {name} 上',
  'mi.linkHint': '合并后：域名和出口节点来自 mihomo，外部访问来自路由器，同一条连接不会重复计算',

  'test.mihomo': 'mihomo {version} · {conns} 个连接 · {latencyMs} ms',
  'test.openwrt': '{host} · {count}/{max} 个连接 · WAN：{wan}',
  'test.wanUnknown': '未识别',

  'loc.quick': '常用城市',
  'loc.quickPh': '— 选择城市快速填入 —',
  'loc.name': '显示名称',
  'loc.namePh': '家',
  'loc.lat': '纬度',
  'loc.lon': '经度',
  'loc.hint': '只用来在地球上标出「家」的位置，精确到城市就够了。',

  'nav.backGlobe': '← 返回地球',
  'nav.sources': '数据源',
  'nav.location': '位置',
  'nav.devices': '设备',
  'nav.display': '显示',
  'nav.data': '数据',
  'nav.access': '访问',

  'src.title': '数据源',
  'src.desc': '从 OpenWrt 路由器读取连接，用 mihomo 补充域名和代理出口。',
  'src.empty': '还没有数据源',
  'src.addOw': '+ OpenWrt 路由器',
  'src.addMi': '+ mihomo',
  'src.editTitle': '编辑：{name}',
  'src.addOwTitle': '添加 OpenWrt 路由器',
  'src.addMiTitle': '添加 mihomo',
  'src.deleteConfirm': '确定删除数据源「{name}」吗？历史数据会保留。',
  'src.mergedInto': '合并到 {name}',
  'src.pollEvery': '每 {n} 秒轮询一次',
  'src.uninstall': '从路由器上移除流量地球的插件和账号',
  'st.ok': '● 正常',
  'st.connecting': '◌ 连接中',
  'st.disabled': '○ 已停用',

  'loc.title': '位置',
  'loc.desc': '地球上所有飞线都从这里出发。',

  'dev.title': '设备',
  'dev.desc': '名称默认来自路由器的 DHCP 和主机名表，可以在这里改成你认得出的名字，留空则恢复默认。',
  'dev.icon': '图标',
  'dev.name': '名称',
  'dev.id': '标识 / 地址',
  'dev.lastSeen': '最近活动',
  'dev.empty': '还没有发现设备，等数据源连上后再来看',

  'disp.title': '显示',
  'disp.desc': '画面在浏览器里渲染，用的是正在观看的这台设备的显卡。',
  'disp.quality': '画质',
  'disp.q.auto': '自动（帧率低时自动降档）',
  'disp.q.high': '高',
  'disp.q.medium': '中',
  'disp.q.low': '低（适合老设备、挂墙小屏）',
  'disp.rotate': '自转速度',
  'disp.rotateHint': '0 表示不转',
  'disp.langHint': '只对当前这个浏览器生效',
  'disp.savedHint': '已保存，回到地球页面后生效',

  'data.title': '数据',
  'data.retention': '保留时长（天）',
  'data.flows': '连接明细',
  'data.minute': '分钟统计',
  'data.hour': '小时统计',
  'data.flush': '写盘间隔（秒）',
  'data.flushHint': '数据先在内存里累积，再定期批量写入，以减少对 SD 卡和 eMMC 的磨损',
  'data.geo': 'IP 地理库',
  'data.geoState': '状态：{state}',
  'data.geoVersion': '，版本 {v}',
  'data.geo.ready': '可用',
  'data.geo.downloading': '下载中',
  'data.geo.missing': '未下载',
  'data.geo.error': '出错',
  'data.geoAuto': '每月自动更新',
  'data.geoNow': '立即更新',
  'data.geoStarted': '已开始更新，几分钟后刷新页面查看',

  'acc.title': '访问',
  'acc.pw': '管理员密码',
  'acc.old': '原密码',
  'acc.new': '新密码（至少 8 位）',
  'acc.change': '修改密码',
  'acc.changed': '密码已修改，其他设备需要重新登录',
  'acc.logout': '退出登录',
  'acc.kiosk': '只读展示链接（给挂墙大屏用，免登录）将在下个版本提供。',

  // Errors and statuses sent as codes by the server.
  'err.unauthorized': '需要登录',
  'err.setupExpired': '配置命令已过期，请重新生成',
  'err.badSourceType': '未知的数据源类型',
  'err.badUrl': '地址格式不正确',
  'err.badCoords': '坐标不正确',
  'err.alreadySetup': '已经初始化过了',
  'err.passwordShort': '密码至少 8 位',
  'err.needSource': '至少需要一个数据源',
  'err.throttled': '尝试太频繁，请一分钟后再试',
  'err.badPassword': '密码不正确',
  'err.badOldPassword': '原密码不正确',
  'err.sourceNotFound': '数据源不存在',
  'err.noData': '{sec} 秒内没有收到数据',
  'err.wsClosed': '连接已断开（{code}）',
  'err.wsFailed': '无法建立 WebSocket 连接，请检查地址和 secret',
  'err.mihomoSecret': 'secret 不正确（401）',
  'err.httpStatus': '{path} 返回了 HTTP {status}',
  'err.timeout': '请求超时',
  'err.network': '网络错误：{detail}',
  'err.ubus': 'ubus 错误 {code}',
  'err.owLogin': '登录失败：账号或密码不正确。是否已经在路由器上运行配置命令？',
  'err.owPlugin': '登录成功，但读不到插件，请重新运行配置命令（运行后 rpcd 会重启）',
  'err.owAcct': '路由器没有开启 conntrack 字节计数（net.netfilter.nf_conntrack_acct=0）',
  'err.internal': '服务器内部错误：{detail}',
  'err.badRequest': '请求有误：{detail}',
  'err.unknown': '出错了：{code}',
};

const en: Dict = {
  'app.title': 'Traffic Earth',
  'app.name': 'TRAFFIC EARTH',
  'app.sub': 'LIVE NETWORK FLOWS',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.test': 'Test',
  'common.testConn': 'Test connection',
  'common.testing': 'Testing…',
  'common.saved': 'Saved',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.enable': 'Enable',
  'common.disable': 'Disable',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.finish': 'Finish',
  'common.none': 'None',
  'lang.label': 'Language',
  'lang.zh': '中文',
  'lang.en': 'English',

  'hud.throughput': 'Throughput',
  'hud.in': '↓ In',
  'hud.out': '↑ Out',
  'hud.conns': 'Active connections',
  'hud.todayTotal': 'Today',
  'hud.todayDown': '↓ Downloaded',
  'hud.todayUp': '↑ Uploaded',
  'hud.categories': 'Categories',
  'hud.now': 'Live',
  'hud.todayTab': 'Today',
  'hud.current': 'now',
  'hud.todayShort': 'today',
  'hud.filterNowOnly': 'Device filter shows live data only',
  'hud.top': 'Top destinations',
  'hud.byTarget': 'Hosts',
  'hud.byRegion': 'Regions',
  'hud.devices': 'Devices',
  'hud.settings': 'Settings',
  'hud.onlyDevice': 'Only {name}',
  'hud.clearFilter': 'Click to clear the filter',
  'hud.noTraffic': 'No traffic',
  'hud.todayBytes': 'Today {v}',
  'hud.connCount': '{n} conns',
  'hud.inbound': 'Inbound',
  'hud.noSources': 'No data source is enabled yet. Add one in Settings → Data sources.',
  'hud.reconnecting': 'Lost connection to the server, reconnecting…',
  'hud.attribution': 'IP geolocation by DB-IP (CC BY 4.0)',
  'hud.arcHint': 'Dashes move the way the data flows · brighter and faster means more traffic · color is the category',
  'hud.quality': 'Quality: {q}',
  'hud.qualityAuto': ' (auto)',
  'hud.q.high': 'high', 'hud.q.medium': 'medium', 'hud.q.low': 'low',
  'demo.phone': 'Phone', 'demo.computer': 'Computer', 'demo.tablet': 'Tablet', 'demo.tv': 'TV', 'demo.storage': 'NAS',
  'demo.smart': 'Smart device', 'demo.router': 'Router', 'demo.device': 'Device',
  'hud.home': 'Home',
  'hud.router': 'Router',
  'hud.unknownDevice': 'Unnamed device',
  'hud.unknownPlace': 'Unknown location',

  'cat.video': 'Video', 'cat.social': 'Social', 'cat.comm': 'Messaging', 'cat.ai': 'AI', 'cat.dev': 'Dev',
  'cat.game': 'Games', 'cat.music': 'Music', 'cat.shop': 'Shopping', 'cat.news': 'News', 'cat.download': 'Downloads',
  'cat.cloud': 'Cloud & CDN', 'cat.iot': 'Smart home', 'cat.system': 'System', 'cat.ads': 'Ads & tracking',
  'cat.inbound': 'Inbound', 'cat.lan': 'Local', 'cat.other': 'Other',

  'login.password': 'Admin password',
  'login.go': 'Sign in',

  'setup.subtitle': 'First-time setup',
  'setup.step1': '1 · Connect your router',
  'setup.step1.desc': 'Traffic Earth reads the connection table of an OpenWrt router, read-only. OpenWrt / ImmortalWrt 23.05 or newer.',
  'setup.mihomo': 'Optional: mihomo enhancement',
  'setup.mihomo.check': 'This router runs mihomo (Nikki, OpenClash or the mihomo core)',
  'setup.mihomo.desc': 'Adds host names and proxy exits. Strongly recommended for fake-ip setups, where proxied connections cannot be located otherwise.',
  'setup.step2': '2 · Where is home',
  'setup.step3': '3 · Admin password',
  'setup.step3.desc': 'This page shows what every device at home connects to, so a password is required.',
  'setup.pw': 'Password (8+ characters)',
  'setup.pw2': 'Repeat password',
  'setup.needCommand': 'Generate the setup command and run it on the router first',
  'setup.needTest': 'Click "Test connection" first to make sure the router is reachable',
  'setup.badCoords': 'Enter a valid latitude and longitude',
  'setup.pwShort': 'The password needs at least 8 characters',
  'setup.pwMismatch': 'The passwords do not match',

  'ow.name': 'Name',
  'ow.namePh': 'e.g. Main router',
  'ow.url': 'Router address (where LuCI is)',
  'ow.gen': 'Generate setup command',
  'ow.regen': 'Generate a new setup command (changes the password)',
  'ow.run': 'Log in to the router over SSH (or LuCI → System → Terminal) and run this line:',
  'ow.localhost': 'You opened this page via localhost, which the router cannot reach. Use the full script below instead.',
  'ow.fullScript': "Router can't reach this server? Expand the full script and paste it",
  'ow.explain': 'It does three things: adds a read-only rpcd plugin, adds a login that can only call it, and restarts rpcd (you will need to log in to LuCI again; internet is not affected). Valid for 1 hour.',
  'ow.poll': 'Poll interval (seconds)',
  'ow.pollHint': 'Slows down automatically on busy routers',
  'ow.wan': 'WAN interfaces',
  'ow.wanPh': 'Leave empty to detect, e.g. pppoe-wan',
  'ow.wanHint': 'Used for total throughput',

  'mi.name': 'Name',
  'mi.namePh': 'e.g. mihomo on the router',
  'mi.url': 'Controller address',
  'mi.urlHint': "mihomo's external-controller. It must listen on a LAN address, not 127.0.0.1",
  'mi.secret': 'Secret',
  'mi.secretKeep': 'Leave empty to keep the current one',
  'mi.secretPh': 'Secret of the external-controller',
  'mi.link': 'Merge with router',
  'mi.linkNone': "Don't merge (a standalone mihomo, e.g. a desktop client)",
  'mi.linkOn': 'Runs on {name}',
  'mi.linkHint': 'When merged, host names and exits come from mihomo, inbound traffic comes from the router, and no connection is counted twice',

  'test.mihomo': 'mihomo {version} · {conns} conns · {latencyMs} ms',
  'test.openwrt': '{host} · {count}/{max} conns · WAN: {wan}',
  'test.wanUnknown': 'not detected',

  'loc.quick': 'Common cities',
  'loc.quickPh': '— Pick a city to fill in —',
  'loc.name': 'Display name',
  'loc.namePh': 'Home',
  'loc.lat': 'Latitude',
  'loc.lon': 'Longitude',
  'loc.hint': 'Only used to mark home on the globe; city-level accuracy is plenty.',

  'nav.backGlobe': '← Back to globe',
  'nav.sources': 'Data sources',
  'nav.location': 'Location',
  'nav.devices': 'Devices',
  'nav.display': 'Display',
  'nav.data': 'Data',
  'nav.access': 'Access',

  'src.title': 'Data sources',
  'src.desc': 'Connections come from OpenWrt routers; mihomo adds host names and proxy exits.',
  'src.empty': 'No data sources yet',
  'src.addOw': '+ OpenWrt router',
  'src.addMi': '+ mihomo',
  'src.editTitle': 'Edit: {name}',
  'src.addOwTitle': 'Add an OpenWrt router',
  'src.addMiTitle': 'Add mihomo',
  'src.deleteConfirm': 'Delete data source "{name}"? History is kept.',
  'src.mergedInto': 'Merged into {name}',
  'src.pollEvery': 'polled every {n}s',
  'src.uninstall': "Remove Traffic Earth's plugin and login from the router",
  'st.ok': '● OK',
  'st.connecting': '◌ Connecting',
  'st.disabled': '○ Disabled',

  'loc.title': 'Location',
  'loc.desc': 'Every arc on the globe starts here.',

  'dev.title': 'Devices',
  'dev.desc': "Names come from the router's DHCP and host tables. Rename them here; leave empty to restore.",
  'dev.icon': 'Icon',
  'dev.name': 'Name',
  'dev.id': 'ID / addresses',
  'dev.lastSeen': 'Last active',
  'dev.empty': 'No devices yet. Check back once a data source is connected.',

  'disp.title': 'Display',
  'disp.desc': 'The globe is rendered in the browser, on the graphics of the device you are watching on.',
  'disp.quality': 'Quality',
  'disp.q.auto': 'Auto (steps down when the frame rate drops)',
  'disp.q.high': 'High',
  'disp.q.medium': 'Medium',
  'disp.q.low': 'Low (old devices, small wall screens)',
  'disp.rotate': 'Rotation speed',
  'disp.rotateHint': '0 stops rotation',
  'disp.langHint': 'Applies to this browser only',
  'disp.savedHint': 'Saved. Takes effect when you return to the globe.',

  'data.title': 'Data',
  'data.retention': 'Retention (days)',
  'data.flows': 'Connection log',
  'data.minute': 'Per-minute stats',
  'data.hour': 'Per-hour stats',
  'data.flush': 'Write interval (seconds)',
  'data.flushHint': 'Data is collected in memory and written in batches, which is gentler on SD cards and eMMC',
  'data.geo': 'IP geolocation database',
  'data.geoState': 'Status: {state}',
  'data.geoVersion': ', built {v}',
  'data.geo.ready': 'ready',
  'data.geo.downloading': 'downloading',
  'data.geo.missing': 'not downloaded',
  'data.geo.error': 'error',
  'data.geoAuto': 'Update monthly',
  'data.geoNow': 'Update now',
  'data.geoStarted': 'Update started; refresh in a few minutes',

  'acc.title': 'Access',
  'acc.pw': 'Admin password',
  'acc.old': 'Current password',
  'acc.new': 'New password (8+ characters)',
  'acc.change': 'Change password',
  'acc.changed': 'Password changed; other devices need to sign in again',
  'acc.logout': 'Sign out',
  'acc.kiosk': 'Read-only display links (for wall screens, no login) are coming in the next version.',

  'err.unauthorized': 'Please sign in',
  'err.setupExpired': 'The setup command has expired; generate a new one',
  'err.badSourceType': 'Unknown data source type',
  'err.badUrl': 'Invalid address',
  'err.badCoords': 'Invalid coordinates',
  'err.alreadySetup': 'Already set up',
  'err.passwordShort': 'The password needs at least 8 characters',
  'err.needSource': 'At least one data source is required',
  'err.throttled': 'Too many attempts; try again in a minute',
  'err.badPassword': 'Wrong password',
  'err.badOldPassword': 'The current password is wrong',
  'err.sourceNotFound': 'Data source not found',
  'err.noData': 'No data for {sec} seconds',
  'err.wsClosed': 'Connection closed ({code})',
  'err.wsFailed': 'Could not open the WebSocket; check the address and secret',
  'err.mihomoSecret': 'Wrong secret (401)',
  'err.httpStatus': '{path} returned HTTP {status}',
  'err.timeout': 'Request timed out',
  'err.network': 'Network error: {detail}',
  'err.ubus': 'ubus error {code}',
  'err.owLogin': 'Login failed: wrong user or password. Did you run the setup command on the router?',
  'err.owPlugin': 'Logged in, but the plugin is missing. Run the setup command again (it restarts rpcd).',
  'err.owAcct': 'The router has conntrack accounting off (net.netfilter.nf_conntrack_acct=0)',
  'err.internal': 'Server error: {detail}',
  'err.badRequest': 'Bad request: {detail}',
  'err.unknown': 'Error: {code}',
};

const dicts: Record<Lang, Dict> = { zh, en };

export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[lang][key] ?? dicts.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export interface Msg {
  code: string;
  params?: Record<string, string | number>;
}

/** Render a server message code in the current language. */
export function msgText(m: Msg | string | undefined): string {
  if (!m) return '';
  const code = typeof m === 'string' ? m : m.code;
  const params = typeof m === 'string' ? undefined : m.params;
  const key = `err.${code}`;
  return key in dicts[lang] ? t(key, params) : t('err.unknown', { code });
}

const regionNames = new Map<Lang, Intl.DisplayNames | null>();
export function countryName(cc: string): string {
  if (!/^[a-z]{2}$/i.test(cc)) return '';
  if (!regionNames.has(lang)) {
    try {
      regionNames.set(lang, new Intl.DisplayNames([lang === 'zh' ? 'zh-CN' : 'en'], { type: 'region' }));
    } catch {
      regionNames.set(lang, null);
    }
  }
  return regionNames.get(lang)?.of(cc.toUpperCase()) ?? cc.toUpperCase();
}

/**
 * "Country · City" in the current language. In Chinese, a city without a known Chinese name
 * falls back to the province/state, then to the country alone — never to English text.
 */
export function placeName(p: { cc: string; cityEn: string; cityZh: string; regionEn?: string } | undefined, short = false): string {
  if (!p) return t('hud.unknownPlace');
  const country = countryName(p.cc);
  let local = '';
  if (lang === 'zh') {
    local = p.cityZh || zhCity(p.cityEn) || (p.regionEn ? zhRegion(p.regionEn) : '') || '';
    // "中国 · 北京" reads oddly when city and region names coincide with the country.
    if (local === country) local = '';
  } else {
    // "Frankfurt am Main (Innenstadt I)" -> "Frankfurt am Main"
    local = (p.cityEn && p.cityEn.replace(/\s*\(.*?\)\s*/g, '').trim()) || p.regionEn || '';
  }
  if (short) return local || country || t('hud.unknownPlace');
  return [country, local].filter(Boolean).join(' · ') || t('hud.unknownPlace');
}

export const catName = (id: string) => t(`cat.${id}`);
