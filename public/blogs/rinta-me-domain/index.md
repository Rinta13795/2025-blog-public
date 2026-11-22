## 起因

博客一直挂在 Vercel 给的默认地址上，一长串 `xxx.vercel.app`，发给别人总觉得不像自己的东西。GitHub 学生包里正好有一项：**Namecheap 送一年免费的 `.me` 域名**。

于是给自己定了个目标：**领到 `rinta.me`，然后让它打开就是我的博客。**

结果从前一天晚上折腾到第二天中午。中间被风控拦过、被限流过、链接过期过，最后还发现「配好了但手机上打不开」。这篇按时间顺序把整个过程记下来，顺便把 DNS 那一套原理理清楚。

整个过程是我和 Claude（Claude Code）一起做的：它负责查资料、看后台、改配置；登录、填验证码、授权这类必须本人来的步骤由我来做。后面「我是怎么做的」会写清楚谁做了什么。

## 先理清三个角色

动手之前最让我糊涂的是：已经有 Namecheap 了，为什么还要 Cloudflare？博客明明能在 Cloudflare 上跑，为什么还要「经过」Vercel？后来想明白了，三者是分工关系：

| 角色 | 负责什么 | 打个比方 |
|---|---|---|
| **Namecheap**（注册商） | 域名登记在谁名下、什么时候到期 | 房产证 |
| **Cloudflare**（DNS） | 告诉全世界「`rinta.me` 在哪台服务器」 | 门牌和通讯录 |
| **Vercel**（托管） | 真正存放并运行博客的服务器 | 房子本身 |

访问者那边的完整路径：

```
浏览器输入 rinta.me
   ↓
问 DNS：rinta.me 在哪？ → Cloudflare 回答：在 Vercel 那台机器（216.198.79.1）
   ↓
连上 Vercel → Vercel 认出这是 2025-blog-public 项目的域名 → 返回博客页面
   ↓
地址栏一直显示 rinta.me，看不到 Vercel 的存在
```

所以「经过 Vercel」不是多绕了一圈，而是网站本来就得放在某台 24 小时开机的服务器上。Vercel 就是那台服务器，访问者感知不到它。

## 第一步：领取 rinta.me（GitHub 学生包 + Namecheap）

入口在 `education.github.com/pack`，Namecheap 卡片的 Offer #1：**1 year domain name registration on the .me TLD**，点「Get access by connecting your GitHub account on Namecheap」。

正常流程很短：

1. 跳到 GitHub，授权 Namecheap 读取你的 GitHub 信息（用来确认学生身份）
2. 回到 `nc.me`，搜 `rinta`、后缀选 `.me`，点 **ADD**，右边购物车显示 `$0.00`
3. **Complete order** → 填邮箱 → **Finish Up**
4. 去邮箱点验证链接 → 登录或注册 Namecheap 账号 → 完成

![搜索结果：rinta.me 显示 FREE](/blogs/rinta-me-domain/search-result.webp)

![加入购物车后，小计 $0.00](/blogs/rinta-me-domain/cart-free.webp)

我前后走了好几轮才成功。踩的坑按顺序列在下面，每个报错背后都有具体原因。

### 坑 1：「We have detected an unusual behavior with your order」

第一次是让 Claude 建了个定时任务，用浏览器自动化在晚上 21:30 把购物车填好、停在下单前，等我回来点最后一步。结果我点完就被风控拦了。

原因大概率就是**前面那段是自动化操作**，被识别成了异常订单。之后所有提交都改成我自己手动点。

![被风控拦下：We have detected an unusual behavior with your order](/blogs/rinta-me-domain/unusual-behavior.webp)

### 坑 2：「gmail.com isn't on our list of eligible universities」

邮箱那一步页面写得很清楚：GitHub 学生包用户要填 **GitHub 账号的主邮箱（Primary email）**，不要填学校邮箱。nc.me 只认美国、英国、加拿大、澳大利亚的部分学校邮箱，国内学校不在名单里，所以必须走 GitHub 学生包这条路。

页面同时会提示「gmail.com 不在合作学校名单，除非……否则不发链接」。这句话不代表失败。只要它能通过 GitHub 认出你是学生包用户，验证邮件照样会来。

我前一晚一直没收到邮件，第二天学生包显示认证通过后重新提交，邮件一分钟内就到了。所以收不到邮件时，先确认学生包是不是真的生效了（GitHub 说同步给合作方最长可能要 72 小时）。

### 坑 3：「429 Too Many Requests」

反复提交、反复刷新，被 nc.me 限流了。

![429 Too Many Requests](/blogs/rinta-me-domain/err-429.webp)

这时候**越刷越久**，正确做法是停手等半小时到一小时，或者直接找客服（Namecheap 主站的 Live Chat，主站不受 nc.me 限流影响）。

### 坑 4：「419 Page Expired」

下单页从晚上开到第二天早上，再点提交就是 419。

![419 Page Expired](/blogs/rinta-me-domain/err-419.webp)

「419 Page Expired」是 Laravel 框架的典型报错：表单里带着一个 CSRF 令牌，页面放久了令牌过期，提交时就会报这个错。**关掉标签页，从入口重新走一遍**就好，流程要一口气做完。

### 坑 5：「Your confirmation code is not valid or expired」

验证邮件里的「Continue your order」链接**只能用一次**。点完页面跳转了，再刷新或者再点一下，就会提示失效。

![Your confirmation code is not valid or expired](/blogs/rinta-me-domain/code-expired.webp)

我回到搜索页，确认购物车里的 rinta.me 还在，再按流程走一遍，这次一次就过：页面显示 **YOUR EMAIL HAS BEEN VERIFIED**，接着让我登录或注册 Namecheap 账号。

![邮箱验证通过，接下来登录或注册 Namecheap 账号](/blogs/rinta-me-domain/email-verified.webp)

### 坑 6：注册账号报「We couldn't create your Namecheap account」

nc.me 上直接注册一直失败，最可能是用户名太短、早被占用了（Namecheap 的用户名全站唯一）。

最后我换了个办法：**去 namecheap.com 主站注册账号，再回 nc.me 用这个账号登录**。登录后页面直接显示：

> Congratulations! Your GitHub account was successfully setup.

![领取成功](/blogs/rinta-me-domain/congratulations.webp)

### 注册信息怎么填

注册人信息（WHOIS）按 ICANN 要求要填**真实信息**，填假的以后可能导致域名被暂停。中文地址用英文或拼音、从小到大倒着写，电话填自己的手机号。

不用担心隐私：Namecheap 默认免费开 WHOIS 隐私保护（Withheld for Privacy），公开查询只能看到代理信息。

### 确认真的领到了

不能只看页面上的 Congratulations。去注册局查一下最可靠，用的是 RDAP（新一代 WHOIS 查询协议，返回 JSON）：

```bash
curl -s https://rdap.identitydigital.services/rdap/domain/rinta.me
```

返回里能看到：注册时间 2026-11-22 11:27（北京时间）、到期 2027-11-22、注册商 NameCheap, Inc.。这才算真的拿到了。

## 第二步：在 Vercel 绑定域名

博客仓库是 fork 的开源模板，部署在 Vercel。绑定域名**不用改代码**，只要在后台做三件事。

**1. 添加域名**

项目 → Settings → Domains → Add Existing：

- `rinta.me`：连到 Production，作为主域名
- `www.rinta.me`：选「Redirect to Another Domain」→ `rinta.me`，状态码 **308**（永久跳转）

Vercel 默认勾的是「把根域名跳转到 www」，我取消了，因为想让短的 `rinta.me` 当主域名。

加完后 Vercel 会给出需要配置的 DNS 记录（下面这张是全部配好以后的状态）：

![Vercel 域名列表：www 308 跳转到 rinta.me，三个域名都是 Valid Configuration](/blogs/rinta-me-domain/vercel-domains.webp)

| 类型 | 名称 | 值 |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `<一串随机字符>.vercel-dns-017.com` |

**2. 设置站点地址的环境变量**

看了一下模板代码，sitemap 和 RSS 都靠环境变量决定站点地址：

```ts
// src/app/sitemap.ts
const baseUrl = process.env.SITE_URL ? process.env.SITE_URL : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

// src/app/rss.xml/route.ts
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yysuni.com'
```

注意 RSS 的兜底值是**模板原作者的域名**。不设的话，我 RSS 里的文章链接会指向别人的网站。所以在 Environment Variables 里加了两个（类型选 Config，环境选 Production）：

```
SITE_URL=https://rinta.me
NEXT_PUBLIC_SITE_URL=https://rinta.me
```

**3. 重新部署**

环境变量只在构建时生效，要去 Deployments 里对最新的生产部署点 **Redeploy**。Vercel 会要求邮箱验证码确认身份。

## 第三步：让 Cloudflare 接管 DNS

只改 DNS 的话，直接在 Namecheap 里加两条记录也行，而且更快。我选了 Cloudflare，原因有三个：

- DNS 改动生效快，面板好用
- 免费的邮件转发（以后可以做 `hi@rinta.me` → Gmail）
- 以后想把博客从 Vercel 迁到 Cloudflare Workers（模板里已经有 `wrangler.toml` 和 `open-next.config.ts`），只要改一条记录

步骤：

1. Cloudflare → Add a site → Connect a domain → 输入 `rinta.me` → 选 **Free** 套餐
2. 它会自动扫描并导入现有记录，扫出了 11 条：
   - 4 条 A 记录指向 `185.199.108–111.153`，这是 **GitHub Pages** 的 IP（原因见后文）
   - 5 条 MX 和 1 条 SPF 的 TXT，这是 Namecheap 默认的邮件转发
   - 1 条 `www` CNAME
3. 这些都用不上了，全选删掉，然后加两条新的：

| 类型 | 名称 | 内容 | 代理状态 |
|---|---|---|---|
| A | `@` | `216.198.79.1` | **DNS only（灰云）** |
| CNAME | `www` | `<随机字符>.vercel-dns-017.com` | **DNS only（灰云）** |

![Cloudflare 里的两条记录，都是 DNS only](/blogs/rinta-me-domain/cloudflare-dns.webp)

**为什么必须是灰云？** 橙云（Proxied）表示流量先经过 Cloudflare 再转给 Vercel。这样 Vercel 看到的就不是用户直接来访，签发 HTTPS 证书和自身的 CDN 都会受影响，Vercel 官方也建议指向它的记录不要开代理。灰云表示 Cloudflare 只负责 DNS 解析，流量直连 Vercel。

最后，Cloudflare 给这个站点分配了两个 Nameserver，形如 `xxx.ns.cloudflare.com`（每个账号分到的名字不一样）。

## 第四步：Namecheap 改 Nameserver

Namecheap → Domain List → rinta.me → **NAMESERVERS**，从「Namecheap BasicDNS」改成 **Custom DNS**，填上 Cloudflare 给的两个 Nameserver，点勾保存。

这一步的意思是：「以后谁来问 `rinta.me` 的记录，都去问 Cloudflare，别问 Namecheap 了。」

同一个页面顺便确认了 **AUTO-RENEW 是关着的**（域名和隐私保护各有一个开关）。第二年续费大约 20 美元，到时候想续再手动续。

改完回 Cloudflare 点「Check nameservers now」。再用 RDAP 查一次注册局，`nameservers` 已经变成 Cloudflare 的那两个，说明在注册局层面生效了。

## 第五步：配好了，但打开还是旧页面

到这一步，Vercel 后台很快变成 **Valid Configuration**。可我用 Chrome 打开 rinta.me，看到的是：

> 您的连接不是私密连接　NET::ERR_CERT_COMMON_NAME_INVALID

![NET::ERR_CERT_COMMON_NAME_INVALID](/blogs/rinta-me-domain/cert-invalid.webp)

手机上打开则是一个只有 README 的 GitHub Pages 页面。

**原因是 DNS 缓存。** 全世界的 DNS 服务器查过一次答案后，会在 TTL 时间内一直用缓存的结果。当时的情况：

```bash
# Cloudflare 的公共 DNS：已经是新答案
curl -s -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=rinta.me&type=A"
# → 216.198.79.1

# Google 的公共 DNS：还缓存着旧路线，继续去问 Namecheap，拿到的还是 GitHub Pages
curl -s "https://dns.google/resolve?name=rinta.me&type=A"
# → 185.199.108.153 ……（TTL 1800）
```

证书报错也就说得通了：浏览器按旧地址连到了 GitHub 的服务器，GitHub 只有 `*.github.io` 的证书，没有 `rinta.me` 的，所以报「证书名称不匹配」。

我这里还多一层：Mac 上开着 Clash Verge。Chrome 走它的代理端口，**代理节点在远端替我查 DNS**，节点用的 DNS 还缓存着旧答案。本机的 Clash 缓存可以通过它的本地控制接口清掉：

```bash
# Clash Verge Rev 的 mihomo 内核监听一个本地 unix socket
curl --unix-socket /var/run/clash-verge-service/users/<uid>/verge-mihomo.sock -X POST http://localhost/cache/dns/flush
curl --unix-socket /var/run/clash-verge-service/users/<uid>/verge-mihomo.sock -X POST http://localhost/cache/fakeip/flush
```

清完以后，Clash 自己查到的已经是 `216.198.79.1`。但节点那边的缓存清不了，只能等它过期。

**结论：服务器这一侧配好就不用再动了，剩下的就是等。** 一般几十分钟，慢的网络最多一天。想马上看到效果，可以临时切直连、换个网络，或者开关一次飞行模式。

最后的验证：

```bash
curl -sv https://rinta.me -o /dev/null 2>&1 | grep -E "subject:|issuer:|server:"
#  subject: CN=rinta.me
#  issuer: C=US; O=Let's Encrypt; CN=YR2
# < server: Vercel

curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://www.rinta.me
# 308 -> https://rinta.me/
```

证书是 Vercel 自动向 Let's Encrypt 申请的，`www` 也正确跳到了主域名。**rinta.me 正式上线。**

## 那个 GitHub Pages 是哪来的

下单时有个「Choose a free option: GitHub Pages」，我勾上了。它实际做了这几件事：

- 在我的 GitHub 上**新建了一个 `<用户名>.github.io` 仓库**，里面只有一个 README（标题是 GitHub 资料里的名字），外加一个写着 `rinta.me` 的 CNAME 文件
- 把 `rinta.me` 的 DNS 指向 GitHub Pages 的四个 IP

这就是为什么第一次打开 rinta.me，看到的是一个只有名字的白页面，而且因为 GitHub 还没签好证书，Chrome 先弹了个「不支持安全连接」。

![GitHub Pages 还没证书时，Chrome 提示此网站不支持安全连接](/blogs/rinta-me-domain/github-pages-insecure.webp)

如果你本来就打算用 GitHub Pages 建站，这个选项很方便。如果像我一样用 Vercel，**不用勾**，勾了之后还要记得处理那个自动建的仓库。

## 没领到的：Name.com 的免费 .dev

学生包里 Name.com 也送一个免费域名，后缀可以选 `.dev`、`.app`、`.studio`、`.tech` 等。

- `rinta.dev` 2023 年就被别人注册了，`rinta.app` 也没了。用 RDAP 查 Google 注册局（`pubapi.registry.google/rdap/domain/xxx`），返回 200 表示已注册，404 表示没人注册
- 换成了 `orinta.dev`，加购物车、选免费的 Domain Safe（默认会勾上 7.99 美元一年的 Pro 版，要手动取消）、填联系信息，总价是 $0.00
- 最后一步卡住了：**付款页要求必须绑信用卡**，不填卡「Complete Order」按钮是灰的。卡只支持 Visa、Mastercard、JCB、Discover，没有银联，也没有支付宝。绑卡还会默认开启自动续费（第二年 22.99 美元）

![总价 $0.00，但不填卡 Complete Order 按钮是灰的](/blogs/rinta-me-domain/namecom-card.webp)

我暂时没有合适的卡，就先不领了，反正 `rinta.me` 已经够用。

## 我是怎么做的

这次基本是「Claude 动手，我在关键点上拍板」的模式：

- **Claude 做的**：查 RDAP 确认域名状态和注册结果；读模板源码，找到 sitemap 和 RSS 用的环境变量；在 Vercel 里加域名、设 308 跳转、加环境变量、触发重新部署；在 Cloudflare 里建站、清旧记录、加新记录；在 Namecheap 里改 Nameserver、确认自动续费已关；用 `curl` 查各家公共 DNS 和证书；清 Clash 的缓存；建定时任务，过一段时间检查 nc.me 有没有解除限流、Gmail 里有没有新邮件
- **我做的**：所有登录和密码、邮箱验证码、GitHub 授权、Namecheap 账号注册、填写自己的 WHOIS 信息、最后的下单按钮，以及「要不要 Cloudflare」「主域名要不要带 www」「付费 .dev 领不领」这些决定

有一点感受挺深：**凡是要本人确认的步骤，交给自动化反而更慢。** 第一次用定时任务自动填购物车，直接被风控拦了；后面所有「提交」都改成手动点，一次就过。

## 原理笔记

| 概念 | 一句话 |
|---|---|
| 注册商（Registrar） | 帮你在注册局登记域名的公司，比如 Namecheap、Name.com |
| 注册局（Registry） | 管理某个后缀的机构，`.me` 是 Identity Digital，`.dev`/`.app` 是 Google |
| RDAP | 新一代 WHOIS，返回 JSON，查注册时间、到期时间、Nameserver 最准 |
| Nameserver（NS） | 「这个域名的记录去哪查」，改 NS 就是换 DNS 服务商 |
| A 记录 / CNAME | A 指向 IP；CNAME 指向另一个域名 |
| TTL | 记录可以被缓存多久，改完 DNS 要「等生效」就是在等它过期 |
| 灰云 / 橙云 | Cloudflare 只做解析 / 流量也经过 Cloudflare 代理 |
| 308 | 永久重定向，且保留请求方法，`www` 跳主域名用它 |
| CSRF 令牌 | 表单里防伪造请求的一次性令牌，放久了过期，就会报 419 |
| HTTP 429 | 请求太频繁被限流，越刷越久 |

## 小结

- 先分清楚**注册商、DNS、托管**三个角色，后面每一步在干什么就清楚了。
- 领学生包域名时，报错都有对应原因：风控（自动化）、限流（刷太多）、令牌过期（页面放太久）、链接一次性（别点两次）。
- 换托管或换 DNS 时，记得把注册商赠送的默认记录（GitHub Pages、邮件转发）清干净。
- 用环境变量配置站点地址的模板，要检查 sitemap 和 RSS 的兜底值，别让链接指向原作者的网站。
- 「配好了但打不开」先怀疑缓存：拿 `curl` 去问不同的公共 DNS，看看谁还拿着旧答案。
