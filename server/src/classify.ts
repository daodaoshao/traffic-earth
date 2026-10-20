/**
 * Built-in traffic categories. Each connection is matched by domain suffix first,
 * then by the destination's ASN, then by port. User-defined rules come later (P2).
 */

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  color: string;
}

export const categories: Category[] = [
  { id: 'video', name: '视频', nameEn: 'Video', color: '#ff4d8d' },
  { id: 'social', name: '社交', nameEn: 'Social', color: '#ff9f43' },
  { id: 'comm', name: '通讯', nameEn: 'Messaging', color: '#feca57' },
  { id: 'ai', name: 'AI', nameEn: 'AI', color: '#b388ff' },
  { id: 'dev', name: '开发', nameEn: 'Dev', color: '#00e5a0' },
  { id: 'game', name: '游戏', nameEn: 'Games', color: '#ff6b6b' },
  { id: 'music', name: '音乐', nameEn: 'Music', color: '#f78fb3' },
  { id: 'shop', name: '购物', nameEn: 'Shopping', color: '#ffd166' },
  { id: 'news', name: '资讯', nameEn: 'News', color: '#a0c4ff' },
  { id: 'download', name: '下载更新', nameEn: 'Downloads', color: '#4dd0e1' },
  { id: 'cloud', name: '云与 CDN', nameEn: 'Cloud & CDN', color: '#3d9bff' },
  { id: 'iot', name: '智能家居', nameEn: 'Smart home', color: '#7bed9f' },
  { id: 'system', name: '系统服务', nameEn: 'System', color: '#8fa3bf' },
  { id: 'ads', name: '广告追踪', nameEn: 'Ads & tracking', color: '#c0392b' },
  { id: 'inbound', name: '外部访问', nameEn: 'Inbound', color: '#00f0ff' },
  { id: 'lan', name: '内网', nameEn: 'Local', color: '#5c6b80' },
  { id: 'other', name: '其他', nameEn: 'Other', color: '#6c7a89' },
];

const domainRules: Record<string, string[]> = {
  video: [
    'youtube.com', 'googlevideo.com', 'ytimg.com', 'youtu.be', 'youtube-nocookie.com', 'netflix.com', 'nflxvideo.net',
    'nflximg.net', 'nflxext.com', 'nflxso.net', 'disneyplus.com', 'disney-plus.net', 'dssott.com', 'bamgrid.com',
    'hulu.com', 'hbomax.com', 'max.com', 'primevideo.com', 'aiv-cdn.net', 'twitch.tv', 'ttvnw.net', 'jtvnw.net',
    'vimeo.com', 'bilibili.com', 'bilivideo.com', 'bilivideo.cn', 'hdslb.com', 'biliapi.net', 'iqiyi.com',
    'iqiyipic.com', 'qiyi.com', 'youku.com', 'ykimg.com', 'mgtv.com', 'hitv.com', 'douyin.com', 'douyinvod.com',
    'douyinpic.com', 'amemv.com', 'ixigua.com', 'kuaishou.com', 'gifshow.com', 'yximgs.com', 'v.qq.com',
    'video.qq.com', 'bytemastatic.com', 'douyinstatic.com', 'douyincdn.com', 'zjcdn.com', 'bytedance.com', 'tiktok.com', 'tiktokcdn.com', 'tiktokv.com', 'byteoversea.com', 'ibytedtos.com', 'huya.com',
    'douyu.com', 'zhihu-video.com', 'cctv.com', 'cntv.cn', 'abema.tv', 'nicovideo.jp', 'dmc.nico',
  ],
  social: [
    'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com', 'twitter.com', 'x.com', 'twimg.com', 't.co',
    'reddit.com', 'redd.it', 'redditmedia.com', 'redditstatic.com', 'pinterest.com', 'pinimg.com', 'linkedin.com',
    'licdn.com', 'threads.net', 'bsky.app', 'mastodon.social', 'tumblr.com', 'weibo.com', 'weibo.cn', 'sinaimg.cn',
    'xiaohongshu.com', 'xhscdn.com', 'zhihu.com', 'zhimg.com', 'douban.com', 'doubanio.com', 'tieba.baidu.com',
    'v2ex.com', 'quora.com', 'snapchat.com', 'sc-cdn.net',
  ],
  comm: [
    'telegram.org', 't.me', 'telegram.me', 'telesco.pe', 'tdesktop.com', 'whatsapp.com', 'whatsapp.net', 'signal.org',
    'discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'slack.com', 'slack-edge.com', 'line.me',
    'line-scdn.net', 'weixin.qq.com', 'wechat.com', 'qpic.cn', 'qlogo.cn', 'wx.qq.com', 'im.qq.com', 'zoom.us',
    'skype.com', 'teams.microsoft.com', 'feishu.cn', 'larksuite.com', 'dingtalk.com', 'messenger.com',
  ],
  ai: [
    'openai.com', 'chatgpt.com', 'oaistatic.com', 'oaiusercontent.com', 'anthropic.com', 'claude.ai', 'claude.com',
    'gemini.google.com', 'generativelanguage.googleapis.com', 'aistudio.google.com', 'bard.google.com',
    'perplexity.ai', 'mistral.ai', 'huggingface.co', 'hf.co', 'deepseek.com', 'moonshot.cn', 'kimi.com',
    'doubao.com', 'tongyi.aliyun.com', 'qianwen.aliyun.com', 'cursor.sh', 'cursor.com', 'groq.com', 'x.ai',
    'grok.com', 'midjourney.com', 'poe.com', 'openrouter.ai', 'copilot.microsoft.com', 'githubcopilot.com',
  ],
  dev: [
    'github.com', 'githubusercontent.com', 'githubassets.com', 'github.io', 'gitlab.com', 'bitbucket.org',
    'npmjs.org', 'npmjs.com', 'yarnpkg.com', 'pypi.org', 'pythonhosted.org', 'crates.io', 'rust-lang.org',
    'golang.org', 'go.dev', 'docker.com', 'docker.io', 'stackoverflow.com', 'stackexchange.com', 'sstatic.net',
    'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'gitee.com', 'vercel.com', 'vercel.app', 'netlify.app',
    'pages.dev', 'workers.dev', 'ghcr.io', 'quay.io', 'nodejs.org', 'mozilla.org', 'readthedocs.io', 'jetbrains.com',
    'visualstudio.com', 'vscode-cdn.net', 'vsassets.io', 'brew.sh', 'cnpmjs.org', 'npmmirror.com',
  ],
  game: [
    'steampowered.com', 'steamcommunity.com', 'steamstatic.com', 'steamcontent.com', 'steamserver.net',
    'epicgames.com', 'unrealengine.com', 'ea.com', 'origin.com', 'blizzard.com', 'battle.net', 'blzstatic.cn',
    'playstation.com', 'playstation.net', 'sonyentertainmentnetwork.com', 'xboxlive.com', 'xbox.com',
    'nintendo.com', 'nintendo.net', 'riotgames.com', 'leagueoflegends.com', 'mihoyo.com', 'hoyoverse.com',
    'miyoushe.com', 'roblox.com', 'rbxcdn.com', 'minecraft.net', 'ubisoft.com', 'rockstargames.com', 'gog.com',
    'game.qq.com', 'wegame.com', 'nie.netease.com',
  ],
  music: [
    'spotify.com', 'scdn.co', 'spotifycdn.com', 'music.apple.com', 'soundcloud.com', 'sndcdn.com', 'tidal.com',
    'deezer.com', 'pandora.com', 'music.163.com', 'music.126.net', 'y.qq.com', 'kugou.com', 'kuwo.cn', 'ximalaya.com',
  ],
  shop: [
    'amazon.com', 'amazon.co.jp', 'media-amazon.com', 'ssl-images-amazon.com', 'ebay.com', 'ebayimg.com',
    'taobao.com', 'tmall.com', 'alicdn.com', 'tbcdn.cn', 'jd.com', '360buyimg.com', 'pinduoduo.com', 'yangkeduo.com',
    'pddpic.com', 'meituan.com', 'meituan.net', 'dianping.com', 'ele.me', 'aliexpress.com', 'shopify.com',
    'etsy.com', 'rakuten.co.jp', 'mercari.com', 'xianyu.com', 'goofish.com', 'vip.com', 'suning.com', 'dewu.com',
  ],
  news: [
    'nytimes.com', 'bbc.com', 'bbc.co.uk', 'bbci.co.uk', 'cnn.com', 'reuters.com', 'bloomberg.com', 'theguardian.com',
    'wsj.com', 'ft.com', 'apnews.com', 'news.ycombinator.com', 'toutiao.com', 'toutiaoimg.com', 'snssdk.com',
    'pstatp.com', 'sina.com.cn', 'sohu.com', 'ifeng.com', 'thepaper.cn', 'caixin.com', 'wikipedia.org',
    'wikimedia.org', 'substack.com', 'medium.com', 'feedly.com', 'inoreader.com',
  ],
  download: [
    'windowsupdate.com', 'update.microsoft.com', 'delivery.mp.microsoft.com', 'dl.delivery.mp.microsoft.com',
    'swcdn.apple.com', 'swdist.apple.com', 'updates.cdn-apple.com', 'mesu.apple.com', 'appldnld.apple.com',
    'osxapps.itunes.apple.com', 'dl.google.com', 'gvt1.com', 'gvt2.com', 'download.mozilla.org', 'deb.debian.org',
    'security.debian.org', 'archive.ubuntu.com', 'ports.ubuntu.com', 'mirrors.tuna.tsinghua.edu.cn', 'mirrors.ustc.edu.cn',
    'mirrors.aliyun.com', 'downloads.openwrt.org', 'immortalwrt.org', 'sourceforge.net', 'releases.ubuntu.com',
    'thunder.com', 'xunlei.com', 'pan.baidu.com', 'baidupcs.com', 'aliyundrive.com', 'alipan.com', 'quark.cn',
    'dropbox.com', 'dropboxusercontent.com', 'mega.nz', 'mega.co.nz', 'icloud-content.com', 'onedrive.live.com',
    '1drv.com', 'sharepoint.com', 'backblazeb2.com',
  ],
  iot: [
    'mi.com', 'xiaomi.com', 'xiaomi.net', 'miot-spec.org', 'mijia.tech', 'io.mi.com', 'haier.net', 'haier.com',
    'uhome.haier.net', 'tuya.com', 'tuyacn.com', 'tuyaus.com', 'home-assistant.io', 'nabu.casa', 'ezvizlife.com',
    'ys7.com', 'hik-connect.com', 'tplinkcloud.com', 'tplinkcloud.com.cn', 'aqara.com', 'aqara.cn', 'yeelight.com',
    'ring.com', 'nest.com', 'smartthings.com', 'meross.com', 'broadlink.com.cn', 'midea.com', 'gree.com', 'philips-hue.com',
    'meethue.com', 'sonos.com', 'ecovacs.com', 'roborock.com', 'dreame.tech',
  ],
  ads: [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com', 'googletagmanager.com',
    'googletagservices.com', 'app-measurement.com', 'adservice.google.com', 'scorecardresearch.com', 'adnxs.com',
    'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com', 'moatads.com', 'adsrvr.org', 'rubiconproject.com',
    'pubmatic.com', 'appsflyer.com', 'adjust.com', 'branch.io', 'mixpanel.com', 'amplitude.com', 'segment.io',
    'hotjar.com', 'sentry.io', 'umeng.com', 'umengcloud.com', 'cnzz.com', 'tanx.com', 'mmstat.com', 'gdt.qq.com',
    'e.qq.com', 'pangolin-sdk-toutiao.com', 'pglstatp-toutiao.com', 'adkwai.com', 'bugly.qq.com', 'crashlytics.com',
    'unityads.unity3d.com', 'applovin.com', 'inmobi.com', 'vungle.com', 'chartboost.com', 'flurry.com',
  ],
  system: [
    'apple.com', 'icloud.com', 'mzstatic.com', 'apple-dns.net', 'aaplimg.com', 'cdn-apple.com', 'itunes.apple.com',
    'push.apple.com', 'microsoft.com', 'live.com', 'msftconnecttest.com', 'msedge.net', 'windows.com', 'office.com',
    'office.net', 'microsoftonline.com', 'bing.com', 'google.com', 'googleapis.com', 'gstatic.com', 'gmail.com',
    'googleusercontent.com', 'ggpht.com', 'android.com', 'googleapis.cn', 'gstatic.cn', 'ntp.org', 'pool.ntp.org',
    'time.apple.com', 'time.windows.com', 'ntp.aliyun.com', 'ntp.tencent.com', 'ntsc.ac.cn', 'cloudflare-dns.com',
    'dns.google', 'one.one.one.one', 'alidns.com', 'dnspod.cn', 'doh.pub', 'baidu.com', 'bdstatic.com', 'bdimg.com',
    'qq.com', 'aliyun.com', 'alipay.com', 'tailscale.com', 'tailscale.io', 'ts.net', 'connectivitycheck.gstatic.com',
    'captive.apple.com', 'samsung.com', 'samsungcloud.com', 'huawei.com', 'hicloud.com', 'vivo.com.cn', 'oppo.com',
    'heytap.com', 'mozilla.net', 'firefox.com', 'digicert.com', 'letsencrypt.org', 'lencr.org', 'sectigo.com',
    'globalsign.com', 'pki.goog', 'ocsp.apple.com',
  ],
  cloud: [
    'cloudflare.com', 'cloudflare.net', 'cloudfront.net', 'amazonaws.com', 'akamaized.net', 'akamaihd.net',
    'akamai.net', 'akamaiedge.net', 'edgekey.net', 'edgesuite.net', 'fastly.net', 'fastlylb.net', 'azureedge.net',
    'azure.com', 'windows.net', 'trafficmanager.net', 'googleusercontent.cn', 'alikunlun.com', 'kunlunar.com',
    'aliyuncs.com', 'myqcloud.com', 'tencent-cloud.net', 'qcloud.com', 'gtimg.com', 'gtimg.cn', 'cdn20.com', 'ksyuncdn.com', 'wscdns.com',
    'chinanetcenter.com', 'bdydns.com', 'jomodns.com', 'volcengine.com', 'volces.com', 'bytecdn.cn', 'byteimg.com',
    'oss-cn-hangzhou.aliyuncs.com', 'hwcdn.net', 'cdn77.org', 'b-cdn.net', 'bunnycdn.com', 'digitaloceanspaces.com',
    'linodeobjects.com', 'r2.dev', 'r2.cloudflarestorage.com', 'vultr.com', 'linode.com', 'digitalocean.com', 'oraclecloud.com',
  ],
};

// Longest match wins, so "music.163.com" beats "163.com" and "gemini.google.com" beats "google.com".
const suffixMap = new Map<string, string>();
for (const [cat, list] of Object.entries(domainRules)) for (const d of list) suffixMap.set(d, cat);

const asnRules: Record<number, string> = {
  2906: 'video', 40027: 'video', 55095: 'video', // Netflix
  32934: 'social', 63293: 'social', 13414: 'social', 54888: 'social', 14413: 'social', // Meta, Twitter, LinkedIn
  62041: 'comm', 211157: 'comm', 59930: 'comm', 44907: 'comm', 49898: 'comm', // Telegram, Discord
  36459: 'dev', // GitHub
  32590: 'game', 8075: 'system', 714: 'system', 6185: 'system', // Valve, Microsoft, Apple
  15169: 'system', 396982: 'cloud', 19527: 'system', // Google
  13335: 'cloud', 209242: 'cloud', 16509: 'cloud', 14618: 'cloud', 20940: 'cloud', 16625: 'cloud', 54113: 'cloud',
  8068: 'cloud', 8069: 'cloud', 20473: 'cloud', 14061: 'cloud', 63949: 'cloud', 31898: 'cloud',
  45102: 'cloud', 37963: 'cloud', 45090: 'cloud', 132203: 'cloud', 55967: 'cloud', 38365: 'cloud', 396986: 'cloud',
  137718: 'cloud', 24429: 'cloud', 4808: 'other',
  41264: 'cloud', // Google Cloud
};

const portRules: Record<number, string> = {
  53: 'system', 853: 'system', 123: 'system', 5353: 'system',
  3478: 'comm', 3479: 'comm', 5349: 'comm', 19302: 'comm', 19305: 'comm',
  22: 'dev', 9418: 'dev',
  41641: 'system', // tailscale
  6881: 'download', 6889: 'download', 51413: 'download',
  3074: 'game', 27015: 'game', 27036: 'game',
  1883: 'iot', 8883: 'iot',
};

export function classify(input: { host: string; port: number; asn: number; private: boolean }): string {
  if (input.private) return 'lan';
  const host = input.host.toLowerCase().replace(/\.$/, '');
  if (host) {
    let h = host;
    while (true) {
      const cat = suffixMap.get(h);
      if (cat) return cat;
      const dot = h.indexOf('.');
      if (dot < 0) break;
      h = h.slice(dot + 1);
    }
  }
  if (input.asn && asnRules[input.asn]) return asnRules[input.asn];
  if (portRules[input.port]) return portRules[input.port];
  return 'other';
}
