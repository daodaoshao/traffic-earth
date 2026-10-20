/**
 * Chinese names for places, since DB-IP Lite only ships English ones.
 * Anything not listed falls back to country + province/state (never to English text).
 */
const regions: Record<string, string> = {
  // China
  Beijing: '北京', Tianjin: '天津', Hebei: '河北', Shanxi: '山西', 'Inner Mongolia': '内蒙古', Liaoning: '辽宁',
  Jilin: '吉林', Heilongjiang: '黑龙江', Shanghai: '上海', Jiangsu: '江苏', Zhejiang: '浙江', Anhui: '安徽',
  Fujian: '福建', Jiangxi: '江西', Shandong: '山东', Henan: '河南', Hubei: '湖北', Hunan: '湖南',
  Guangdong: '广东', Guangxi: '广西', 'Guangxi Zhuang Autonomous Region': '广西', Hainan: '海南', Chongqing: '重庆',
  Sichuan: '四川', Guizhou: '贵州', Yunnan: '云南', Tibet: '西藏', Xizang: '西藏', Shaanxi: '陕西', Gansu: '甘肃',
  Qinghai: '青海', Ningxia: '宁夏', 'Ningxia Hui Autonomous Region': '宁夏', Xinjiang: '新疆',
  'Xinjiang Uyghur Autonomous Region': '新疆', 'Inner Mongolia Autonomous Region': '内蒙古', 'Hong Kong': '香港',
  Macau: '澳门', Macao: '澳门', Taiwan: '台湾', 'Taipei City': '台北', 'New Taipei City': '新北',
  // United States
  California: '加利福尼亚', Washington: '华盛顿', Oregon: '俄勒冈', Nevada: '内华达', Arizona: '亚利桑那',
  Texas: '得克萨斯', Florida: '佛罗里达', Georgia: '佐治亚', Virginia: '弗吉尼亚', 'New York': '纽约',
  'New Jersey': '新泽西', Illinois: '伊利诺伊', Ohio: '俄亥俄', Iowa: '艾奥瓦', Utah: '犹他', Colorado: '科罗拉多',
  Massachusetts: '马萨诸塞', Pennsylvania: '宾夕法尼亚', 'North Carolina': '北卡罗来纳', 'South Carolina': '南卡罗来纳',
  Michigan: '密歇根', Minnesota: '明尼苏达', Missouri: '密苏里', Oklahoma: '俄克拉何马', Kansas: '堪萨斯',
  Tennessee: '田纳西', Indiana: '印第安纳', Wisconsin: '威斯康星', Maryland: '马里兰', Hawaii: '夏威夷', Alaska: '阿拉斯加',
  'District of Columbia': '华盛顿特区',
  // Canada, Japan, Korea, Europe, elsewhere
  Ontario: '安大略', Quebec: '魁北克', 'British Columbia': '不列颠哥伦比亚', Alberta: '艾伯塔', Tokyo: '东京都',
  Osaka: '大阪府', Kanagawa: '神奈川', Saitama: '埼玉', Chiba: '千叶', Aichi: '爱知', Fukuoka: '福冈', Hokkaido: '北海道',
  Kyoto: '京都府', Hyogo: '兵库', Seoul: '首尔', 'Gyeonggi-do': '京畿道', England: '英格兰', Scotland: '苏格兰',
  'Île-de-France': '法兰西岛', Hesse: '黑森', Bavaria: '巴伐利亚', Berlin: '柏林', 'North Holland': '北荷兰',
  'North Rhine-Westphalia': '北莱茵-威斯特法伦', Moscow: '莫斯科', 'Moscow Oblast': '莫斯科州', 'New South Wales': '新南威尔士',
  Victoria: '维多利亚', Queensland: '昆士兰', 'Central Singapore': '新加坡', Singapore: '新加坡', Dubai: '迪拜',
  Maharashtra: '马哈拉施特拉', Karnataka: '卡纳塔克', Delhi: '德里', 'São Paulo': '圣保罗', Uusimaa: '新地区',
  Stockholm: '斯德哥尔摩', 'Stockholm County': '斯德哥尔摩', Zurich: '苏黎世', Ireland: '爱尔兰', Leinster: '伦斯特',
};

const cities: Record<string, string> = {
  // China
  Beijing: '北京', Shanghai: '上海', Guangzhou: '广州', Shenzhen: '深圳', Tianjin: '天津', Chongqing: '重庆',
  Chengdu: '成都', Hangzhou: '杭州', Nanjing: '南京', Wuhan: '武汉', "Xi'an": '西安', Xian: '西安', Zhengzhou: '郑州',
  Changsha: '长沙', Suzhou: '苏州', Qingdao: '青岛', Jinan: '济南', Shenyang: '沈阳', Dalian: '大连', Harbin: '哈尔滨',
  Changchun: '长春', Shijiazhuang: '石家庄', Taiyuan: '太原', Datong: '大同', Hohhot: '呼和浩特', Baotou: '包头',
  Hefei: '合肥', Fuzhou: '福州', Xiamen: '厦门', Quanzhou: '泉州', Nanchang: '南昌', Kunming: '昆明', Guiyang: '贵阳',
  Nanning: '南宁', Haikou: '海口', Sanya: '三亚', Lanzhou: '兰州', Xining: '西宁', Yinchuan: '银川', Urumqi: '乌鲁木齐',
  Lhasa: '拉萨', Dongguan: '东莞', Foshan: '佛山', Zhuhai: '珠海', Zhongshan: '中山', Huizhou: '惠州', Shantou: '汕头',
  Ningbo: '宁波', Wenzhou: '温州', Jinhua: '金华', Shaoxing: '绍兴', Jiaxing: '嘉兴', Taizhou: '台州', Huzhou: '湖州',
  Wuxi: '无锡', Changzhou: '常州', Nantong: '南通', Xuzhou: '徐州', Yangzhou: '扬州', Yancheng: '盐城', Zhenjiang: '镇江',
  Yantai: '烟台', Weifang: '潍坊', Zibo: '淄博', Linyi: '临沂', Jining: '济宁', Weihai: '威海', Luoyang: '洛阳',
  Kaifeng: '开封', Xinxiang: '新乡', Nanyang: '南阳', Yichang: '宜昌', Xiangyang: '襄阳', Zhuzhou: '株洲', Hengyang: '衡阳',
  Mianyang: '绵阳', Baoding: '保定', Tangshan: '唐山', Langfang: '廊坊', Handan: '邯郸', Qinhuangdao: '秦皇岛',
  Zhangjiakou: '张家口', Changzhi: '长治', Jinzhong: '晋中', Yuncheng: '运城', Linfen: '临汾', Shuozhou: '朔州',
  Yangquan: '阳泉', Xinzhou: '忻州', Lüliang: '吕梁', Jincheng: '晋城', Anshan: '鞍山', Fushun: '抚顺', Jilin: '吉林',
  Daqing: '大庆', Wuhu: '芜湖', Bengbu: '蚌埠', Ganzhou: '赣州', Jiujiang: '九江', Guilin: '桂林', Liuzhou: '柳州',
  Zunyi: '遵义', Dali: '大理', Lijiang: '丽江', Xianyang: '咸阳', Baoji: '宝鸡', Yulin: '榆林', "Yan'an": '延安',
  Tianshui: '天水', Karamay: '克拉玛依', Kashgar: '喀什', Ordos: '鄂尔多斯', Chifeng: '赤峰',
  'Hong Kong': '香港', Kowloon: '九龙', 'Tsuen Wan': '荃湾', 'Sha Tin': '沙田', Macau: '澳门', Taipei: '台北',
  Taichung: '台中', Kaohsiung: '高雄', Tainan: '台南', Taoyuan: '桃园', Hsinchu: '新竹',
  // Asia-Pacific
  Tokyo: '东京', Shibuya: '涩谷', Chiyoda: '千代田', Minato: '港区', Shinjuku: '新宿', Chuo: '中央区', Osaka: '大阪',
  Kyoto: '京都', Yokohama: '横滨', Nagoya: '名古屋', Fukuoka: '福冈', Sapporo: '札幌', Kobe: '神户', Saitama: '埼玉',
  Seoul: '首尔', Busan: '釜山', Incheon: '仁川', Singapore: '新加坡', Bangkok: '曼谷', 'Kuala Lumpur': '吉隆坡',
  Jakarta: '雅加达', Manila: '马尼拉', Hanoi: '河内', 'Ho Chi Minh City': '胡志明市', Mumbai: '孟买', Delhi: '德里',
  'New Delhi': '新德里', Bengaluru: '班加罗尔', Bangalore: '班加罗尔', Chennai: '金奈', Hyderabad: '海得拉巴',
  Sydney: '悉尼', Melbourne: '墨尔本', Brisbane: '布里斯班', Perth: '珀斯', Auckland: '奥克兰', Dubai: '迪拜',
  'Abu Dhabi': '阿布扎比', Doha: '多哈', Riyadh: '利雅得', 'Tel Aviv': '特拉维夫', Istanbul: '伊斯坦布尔',
  // Europe
  London: '伦敦', Manchester: '曼彻斯特', Paris: '巴黎', Marseille: '马赛', Frankfurt: '法兰克福',
  'Frankfurt am Main': '法兰克福', Berlin: '柏林', Munich: '慕尼黑', Hamburg: '汉堡', Düsseldorf: '杜塞尔多夫',
  Nuremberg: '纽伦堡', Falkenstein: '法尔肯施泰因', Amsterdam: '阿姆斯特丹', Rotterdam: '鹿特丹', Brussels: '布鲁塞尔',
  Luxembourg: '卢森堡', Zurich: '苏黎世', Geneva: '日内瓦', Vienna: '维也纳', Prague: '布拉格', Warsaw: '华沙',
  Stockholm: '斯德哥尔摩', Oslo: '奥斯陆', Copenhagen: '哥本哈根', Helsinki: '赫尔辛基', Dublin: '都柏林',
  Madrid: '马德里', Barcelona: '巴塞罗那', Lisbon: '里斯本', Milan: '米兰', Rome: '罗马', Athens: '雅典',
  Moscow: '莫斯科', 'Saint Petersburg': '圣彼得堡', Kyiv: '基辅', Bucharest: '布加勒斯特', Budapest: '布达佩斯',
  Sofia: '索非亚', Riga: '里加', Tallinn: '塔林', Vilnius: '维尔纽斯', Reykjavik: '雷克雅未克',
  // Americas
  'New York': '纽约', 'Los Angeles': '洛杉矶', 'San Francisco': '旧金山', 'San Jose': '圣何塞', Seattle: '西雅图',
  Portland: '波特兰', 'Las Vegas': '拉斯维加斯', Phoenix: '凤凰城', Denver: '丹佛', Dallas: '达拉斯', Houston: '休斯敦',
  Austin: '奥斯汀', Chicago: '芝加哥', Atlanta: '亚特兰大', Miami: '迈阿密', Boston: '波士顿', Washington: '华盛顿',
  Ashburn: '阿什本', Reston: '雷斯顿', Newark: '纽瓦克', Philadelphia: '费城', 'Mountain View': '山景城',
  'Santa Clara': '圣克拉拉', 'Palo Alto': '帕洛阿尔托', Cupertino: '库比蒂诺', 'Menlo Park': '门洛帕克',
  Sunnyvale: '桑尼维尔', 'Redmond': '雷德蒙德', 'Council Bluffs': '康瑟尔布拉夫斯', 'Des Moines': '得梅因',
  'Kansas City': '堪萨斯城', 'Salt Lake City': '盐湖城', Toronto: '多伦多', Montreal: '蒙特利尔', Vancouver: '温哥华',
  'Mexico City': '墨西哥城', 'São Paulo': '圣保罗', 'Rio de Janeiro': '里约热内卢', 'Buenos Aires': '布宜诺斯艾利斯',
  Santiago: '圣地亚哥', Lima: '利马', Bogotá: '波哥大',
  // Africa
  Johannesburg: '约翰内斯堡', 'Cape Town': '开普敦', Cairo: '开罗', Lagos: '拉各斯', Nairobi: '内罗毕',
};

/** "Shibuya City", "Hangzhou (Xihu Qu)" -> "Shibuya", "Hangzhou" */
const clean = (s: string) => s.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+(City|Shi|Qu|District)$/i, '').trim();

export const zhCity = (en: string) => cities[en] ?? cities[clean(en)];
export const zhRegion = (en: string) => regions[en] ?? regions[clean(en)];
