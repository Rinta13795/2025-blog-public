## 起因

我现在大部分活都在 Claude 桌面 App 的 Code 标签页里干。侧边栏里按分组整理了一百来个会话：实习平台的、个人折腾的、写博客的……每个会话里都是一段完整的上下文：问过什么、试过什么、为什么最后选了这个方案。

有一天我突然意识到：**这些东西全在本地。** 重装系统、硬盘出问题，或者手滑点了「Reset App Data」，就全没了。

所以想做一件事：**每天自动把 Claude 的本地数据加密备份到云盘，并且确认真的能恢复回来。**

整个过程还是和 Claude 一起做的，记录一下思路和踩的坑。

## 第一步：先搞清楚数据到底在哪

一开始我并不知道哪些文件有用。盘点下来，侧边栏上看到的东西分散在三个地方（Windows）：

| 侧边栏上看到的 | 存在哪 |
|---|---|
| 每个会话的完整对话 | `%USERPROFILE%\.claude\projects\<项目路径>\<会话ID>.jsonl` |
| 会话标题、模型、工作目录、是否归档 | `%LOCALAPPDATA%\Claude-Data\claude_xxx\claude-code-sessions\…\local_<id>.json` |
| 分组（比如「平台」「个人」「博客发布」）以及每个会话属于哪个组 | `%LOCALAPPDATA%\Claude-Data\claude_xxx\claude_desktop_config.json`（`preferences.epitaxyPrefs` 下的 `dframe-code-sections` 和 `dframe-group-scopes`） |

也就是说，只备份 `.claude` 的话，对话内容是保住了，但**标题和分组会丢**。恢复回来侧边栏会变成一堆没名字的会话。三处要一起备份。

### 哪些不该备份

| 不备份 | 原因 |
|---|---|
| `.claude\.credentials.json`、桌面 App `config.json` 里的 `oauth:tokenCache` | 登录凭据，重新登录即可 |
| `sessions\*.key`、`shell-snapshots`、`session-env` | 运行期密钥和环境变量快照 |
| Cache、Code Cache、GPUCache、IndexedDB、Local Storage… | Electron 的缓存和 cookie，几百 MB，没价值还敏感 |
| `claude-code\<版本>\…\claude.exe` | CLI 程序本体，每个版本 300 多 MB，App 会自己下载 |
| `node_modules` | `npm install` 就能回来 |

桌面 App 的数据目录我用的是**白名单**：只拿会话元数据、分组配置，再加上侧边笔记、scratch 工作区、会话预设等十来个文件和目录。这样以后 App 新增什么缓存或 token 文件，也不会被误带进备份。`.claude` 目录则用**黑名单**排除凭据和缓存。

最后需要备份的是约 4000 个文件、1.09 GB。会话 jsonl 都是文本，restic 压缩加密后实际上传 **290 MB**，首次全量用了不到 3 分钟。

### 一个意外：会话记录里有明文密钥

我顺手用正则扫了一遍会话 jsonl，结果出现了 Google OAuth client secret、Bearer token、restic 密码之类的东西。原因很简单：平时让 Claude 帮忙配环境时，命令和输出会原样记进会话里。

这改变了方案：**光排除凭据文件不够，整份备份都必须加密。**

## 第二步：存哪

| 选项 | 优点 | 缺点 |
|---|---|---|
| **Google Drive（restic 加密 + rclone）** | 异地；先在本地加密再上传，Google 只看到密文；去重 + 增量；能按日期回滚（30 天内按天，更早的按周、按月） | 要装两个工具，第一次要浏览器授权 |
| 本地另一块盘 | 最简单 | 我这台只有一块盘，硬盘坏了一起没 |
| 私有 GitHub 仓库 | 有版本历史 | 单个 jsonl 最大将近 60MB（GitHub 超过 50MB 会警告，100MB 直接拒收），总量还在涨，git 历史只增不减，而且得自己先加密 |

我选了 Drive，组合是：

- **restic**：负责加密（AES-256）、去重、压缩、快照。每次备份是一个快照，可以按日期恢复（保留策略见下文）。
- **rclone**：负责和 Google Drive 打交道。restic 原生支持把 rclone 当后端：`rclone:远端名:路径`。
- 授权范围用 **`drive.file`**：rclone 只能看到它自己创建的文件，Drive 里其他东西它碰不到。

## 第三步：实现

最后做成了一个命令 `claude-backup`（PowerShell 脚本 + 两个 node 小脚本）：

```
claude-backup run                     立即备份
claude-backup list                    列出所有备份
claude-backup ls 2026-11-21           这天最后一次备份里有哪些会话（按分组列标题）
claude-backup restore latest C:\ClaudeRestore   恢复到一个新目录
claude-backup status                  最近一次结果、下次运行时间
claude-backup log                     看日志
```

每次备份会做这几件事：

1. **生成会话索引**：把「分组 → 标题 → jsonl 文件」对应起来，输出 `sessions-index.md/.csv`，和数据一起备份。以后打开备份，一眼就知道哪个文件是哪个会话，不用对着一堆 UUID 发呆。
   顺手（可选）把每个会话增量导出成一份**本地 Markdown 副本**，按分组分文件夹。这个目录不在备份路径里，不上传。哪天不想开 App，也能直接翻聊天记录。
2. **restic backup**：加上排除规则，增量上传。
3. **按保留策略清理旧快照**：最近 14 次 + 30 天每天 + 12 周每周 + 24 个月每月。每 7 天额外 `prune` 一次（真正释放空间），并跑一次 `restic check` 校验仓库结构，校验失败会把这次备份标成失败。想抽查数据块本身，手动运行 `claude-backup check`，它会随机读 5% 的数据。

定时交给 Windows 任务计划程序：每天 09:00、21:00 各一次，登录后 3 分钟补跑一次；错过的会补上。距上次成功不到 1 小时就跳过，免得开机和整点挨着跑两次。

密码和 rclone 配置单独放在一个「恢复包」目录里，**不进任何 git 仓库**。这个目录要另存一份到密码管理器或 U 盘：密码丢了，备份就解不开了。

## 踩的坑

**1. LTSC 系统没有 winget。** 只能从 rclone 官网和 restic 的 GitHub Release 直接下载，对着官方 `SHA256SUMS` 校验一遍再用。

**2. `-o rclone.program=C:\...` 会被冒号拆坏。** 我一开始用这个参数告诉 restic rclone 在哪，结果报错 `exec: "C:": executable file not found`。路径里的盘符冒号被当成了分隔符。改成运行时把 rclone 所在目录加进 `PATH` 就好了。

**3. Go 写的程序不认 Windows 的系统代理。** 我上 Google 要走本地代理，浏览器没问题。但真正连 Google 的是 rclone（restic 通过子进程调用它，环境变量会传下去），而 Go 的 `net/http` 只认 `HTTPS_PROXY` 这类环境变量，不读 Windows 的系统代理设置。定时任务里没有这个变量，于是脚本在变量为空时去读注册表里的系统代理（`ProxyEnable` / `ProxyServer`），先用 1.5 秒测一下端口通不通：通了就设上 `HTTPS_PROXY`，不通就直连，免得代理软件没开时整次备份卡死。

**4. PowerShell 5.1 的两个老坑。**
- 脚本里有中文，必须存成**带 BOM 的 UTF-8**，否则 5.1 会按 ANSI 读，中文全乱。
- `@($a, $b, (Split-Path $x -Qualifier) + '\')`：逗号运算符优先级比 `+` 高。这一行实际是把 `'\'` 拼到了整个数组后面，而不是拼在最后一个元素上。要再套一层括号。

**5. OAuth client：别图省事用 rclone 自带的。** 一开始嫌去 Google Cloud 找 client 麻烦，直接用了 rclone 内置的 client，浏览器点一次「允许」就连上了。结果首次备份传到一半，日志里刷满 `RATE_LIMIT_EXCEEDED`：这个 client 是全世界 rclone 用户共用一个配额，早就被挤爆了，rclone 自己也提示它会在 2026 年内停用。

最后还是换回自己项目里的 OAuth client（应用类型选「桌面应用」）。这里又连着踩了三个小坑：

- 我用 `console.cloud.google.com/...?project=项目名` 打开，页面一直提示「需要额外访问权限」。其实 URL 里要的是**项目 ID**（形如 `xxx-123456-e1`），不是项目名。改从「选择项目」列表点进去就好了。
- 新版控制台**只在创建时显示一次完整的 client secret**，之后只剩 `****末四位`。找不到旧密钥就点「Add secret」新建一个，旧的照常有效，不影响别的程序。但新密钥也只能复制一次，页面一关就再也拿不到了。
- 在 PowerShell 的 `Read-Host -AsSecureString` 里右键粘贴，**只粘进去了一个字符**（屏幕上只出现一个 `*`），于是一直报 `invalid_client`。最后改成让脚本直接从剪贴板读取密钥，显示长度和末四位，和页面上的 `****末四位` 对一下，一次就过了。另外，新建的密钥要过一会儿才生效，这期间也会报 `invalid_client`，所以脚本里加了「等几分钟按回车重试」。

还有一点：`drive.file` 的「应用创建的文件」是按 OAuth 应用（Google Cloud 项目）算的。从 rclone 自带的 client 换成自己项目的 client 以后，之前传上去的文件新 client 看不见，只能删掉重来。所以 **client 要一开始就定好**。

**6. 定时任务的黑窗口。** 直接让任务计划程序跑 `powershell.exe`，每次都会闪一个黑框。套一层 VBS（`WScript.Shell.Run ..., 0, True`）就能隐藏窗口，同时把退出码交回给任务计划程序，「上次运行结果」一栏还能看出成败。

## 验证：备份要能恢复才算数

做完我实际跑了一遍，结果如下：

| 检查项 | 结果 |
|---|---|
| 首次全量备份 | 4091 个文件、1.09 GB → 实际上传 290 MB，166 秒，`restic check` 通过 |
| 从 Drive 整份恢复到临时目录 | 4836 个文件/目录、1.09 GB，约 3 分钟 |
| 逐个比对 SHA-256 | 4086 个和本机一模一样；5 个是备份之后还在写的会话（包括正在写这篇文章的这个），**0 个对不上** |
| 恢复出来的东西里有没有凭据 | 没有 `.credentials.json`、没有 `*.key`、没有 shell 快照 |
| 侧边栏能不能回来 | 102 个会话的元数据、9 个分组的配置都在 |
| 第二次（增量）备份 | 新增 11 个、改动 13 个文件，只上传 **828 KB**，26 秒 |
| 定时任务 | 手动触发一次：窗口隐藏运行，因为距上次成功不到 1 小时而跳过，任务计划程序记录结果代码 0 |

恢复步骤单独写成了一份 `RESTORE.md`，放在恢复包里。放回原位分两种情况：

- **只找回丢失的会话**：用 `robocopy /E /XO /XC /XN`，目标里已有的文件一律不碰。一开始我写的是 `robocopy /E`，以为它只做合并，结果它会拿备份里的旧文件覆盖本机更新的文件，这个坑是代码审查时才发现的。
- **整体回滚**：先把现有目录改名留底，再拷回去。

还有一点：恢复出来的路径保留了原始的绝对路径（`<目标>\C\Users\<用户名>\...`），换电脑、换用户名时要按通配符去找，不能写死用户名。

## 小结

- 先盘点再动手：对话内容、标题、分组分在三处，漏一处恢复出来就不完整。
- 会话记录本身就是敏感数据。别只盯着 `credentials.json`，整份加密最省心。
- restic + rclone + Drive 这套组合，首次全量之后只传新增的数据块，还能按日期回滚。
- 一定要做一次真正的恢复测试，并把恢复步骤写下来。真到需要恢复的时候，人通常是慌的。
