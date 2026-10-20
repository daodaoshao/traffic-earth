# 流量地球 · Traffic Earth

在一个缓慢自转的 3D 地球上，实时看家庭或办公局域网的流量正流向世界的哪里。

- **流向**：每个目的地一条飞线，线宽表示实时速率，颜色表示流量类别，外网连进来的流量反向飞回家
- **分类**：视频、社交、通讯、AI、开发、游戏、下载更新、云与 CDN、智能家居、广告追踪……按域名、ASN、端口自动归类
- **统计**：实时吞吐、今日累计、目标排行（按域名或地区）、设备排行（点一下只看这台设备）
- **配置中心**：数据源、家的位置、设备名、显示画质、数据保留时长，全部在网页上设置，修改后立即生效
- **中文 / English**：界面完整双语，国家名随语言切换，中文城市名内置；语言设置只对当前浏览器生效

*Watch where your home or office network traffic goes, live, on a 3D globe. Reads the connection table from an OpenWrt router; optionally merges in a mihomo core for host names and proxy exits.*

## 数据从哪来

| 数据源 | 必需？ | 提供什么 |
|---|---|---|
| **OpenWrt 路由器**（23.05 及以上，含 ImmortalWrt） | 主数据源 | 每条连接的设备、目标 IP、上下行字节；设备名（DHCP / 主机名表）；WAN 口总流量 |
| **mihomo**（Nikki、OpenClash 或 mihomo 内核） | 可选增强 | 目标域名、命中的规则、代理出口节点 |

**接入 OpenWrt 只需要粘贴一行命令。** 这条命令在路由器上做三件事：

1. 放一个**只读**的 rpcd 插件（[`traffic-earth.uc`](server/assets/openwrt/traffic-earth.uc)，纯 ucode 脚本，不含二进制，不区分 CPU 架构）；
2. 建一个只能调用这个插件和 LuCI 主机列表接口的登录账号；
3. 重启 rpcd。

它不安装任何软件包，也不修改防火墙或网络配置。如果路由器没开 conntrack 字节计数，它会顺带打开。卸载命令在「设置 → 数据源」页面底部。

**路由器用的是 fake-ip 模式的代理（Nikki、OpenClash 等）？** 那就必须同时接入 mihomo。原因是被代理的连接在 conntrack 里的目标地址都是 `198.18.x.x` 这类假地址，无法定位。合并之后：

- 域名和出口节点取自 mihomo；
- 外网主动连进来的流量取自路由器；
- 同一条连接按「设备 IP + 源端口」匹配去重，不会重复计算。

## 部署

```bash
mkdir traffic-earth && cd traffic-earth
curl -LO https://raw.githubusercontent.com/traffic-earth/traffic-earth/main/docker-compose.yml
docker compose up -d
```

然后打开 `http://<这台机器>:8097`，按向导操作：连接路由器 → 选择家的位置 → 设置管理员密码。

- 镜像支持 amd64 和 arm64，树莓派 4 / 5、N100、群晖、飞牛等都能跑。后端常驻内存约 250–300MB，其中 GeoIP 城市库就占了约 130MB。
- 所有数据都在 `./data`（SQLite 数据库、IP 地理库、加密密钥），备份或迁移只需要复制这个目录。
- 写盘是批量的，默认 5 分钟一次，对 SD 卡和 eMMC 比较友好。
- 画面在**浏览器**里渲染，吃的是看的那台设备的显卡，服务器不渲染任何东西。老设备可以在「设置 → 显示」里调低画质。

### 演示模式（录屏、公开展示）

在网址后面加参数（放在 `#` 前面）：

| 参数 | 作用 |
|---|---|
| `?demo` | 设备名换成「手机 1」「电脑 2」这类通用名，隐藏设置按钮、数据源名、错误提示和鼠标指针 |
| `&tour` | 自动运镜：全景 → 推近家 → 依次飞到流量最大的几个目的地，手动拖动后暂停 15 秒 |
| `&city=上海` | 临时把「家」放到内置城市表里的某个城市（中英文名都可以），不改设置 |

例如：`http://<地址>:8097/?demo&tour&city=Shanghai`。注意域名排行仍会显示真实访问的网站。

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8097` | 监听端口 |
| `DATA_DIR` | `/data` | 数据目录 |
| `TZ` | 容器默认 | 决定「今日」从什么时候开始算 |
| `ADMIN_PASSWORD` | — | 预设管理员密码，设置后向导跳过密码这一步 |

## 隐私

这个程序能看到网络里每台设备连了哪些地方，所以做了以下限制：

- **必须登录才能访问**，登录尝试有频率限制；
- 路由器密码和 mihomo secret 用数据目录里的独立密钥加密存储，**不会回传给浏览器**；
- 除了每月从 [DB-IP](https://db-ip.com) 下载一次 IP 地理库以外，**不向任何外部服务发送数据**；
- 建议只在局域网或 VPN 内访问，不要直接暴露到公网。

## 已知限制

- 只有 OpenWrt 数据源时**看不到域名**，目标显示为「IP · 运营商 · 城市」，类别靠 ASN 和端口推断。
- 免费 GeoIP 库只到城市级。任播地址（1.1.1.1、各种 CDN）会落在一个看起来不太合理的位置，这是 IP 库本身的限制。
- 开了硬件流量卸载（hardware flow offloading）的路由器，被卸载的连接计数可能更新不及时。
- 连接表是整张拉取的。几万条连接的大型网络会自动放慢轮询频率。

## 开发

需要 Node.js ≥ 22.12。

```bash
npm install
npm run dev:server   # 后端 :18097（本地数据在 .data/）
npm run dev:web      # 前端 :5173，/api 代理到后端
```

目录结构：

```
server/src/adapters/   数据源适配器（openwrt、mihomo）→ 统一的连接格式
server/src/engine.ts   速率差分、合并去重、分类、分钟/小时汇总、实时帧
server/src/api.ts      配置中心 REST + 实时 WebSocket
server/assets/openwrt/ 路由器端 rpcd 插件
web/src/globe.ts       地球与 HUD
web/src/settings.ts    配置中心
```

## 致谢

- IP 地理位置数据：[DB-IP](https://db-ip.com)（CC BY 4.0）
- 地球渲染：[globe.gl](https://github.com/vasturiano/globe.gl) / three.js
- 国界数据：[Natural Earth](https://www.naturalearthdata.com)；夜景贴图：NASA

## 许可证

MIT
