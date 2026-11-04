<!-- MCP-INTERCEPTOR-README -->
<div align="center">
  <img src="docs/assets/logo-horizontal.svg" alt="MCP-Interceptor" width="560" />
  <p><strong>在 Gemini、DeepSeek、Grok、ChatGPT 等 AI 聊天网站中直接使用 MCP 工具。</strong></p>
  <p>
    <a href="README.md">English</a>
    ·
    <a href="https://github.com/drawdy/MCP-Interceptor/releases/latest">下载最新版</a>
    ·
    <a href="https://github.com/drawdy/MCP-Interceptor/issues">反馈问题</a>
  </p>
</div>

---

MCP-Interceptor 通过独立的 Go 代理服务 [MCP-Proxy](https://github.com/drawdy/MCP-Proxy)，将 AI 聊天网站连接到 MCP 工具。只需安装浏览器扩展、启动 MCP-Proxy 并配置 MCP Server，然后连接即可。

## 工作原理

```text
Gemini / DeepSeek / Grok / ChatGPT
              ⇅
       MCP-Interceptor
          Chrome 扩展
              ⇅
          MCP-Proxy (Go)
              ⇅
       已配置的 MCP Server
```

**请注意：** MCP Server 配置在 MCP-Proxy 的配置文件中。浏览器扩展只需要连接 MCP-Proxy，不需要在扩展中逐个添加后端 MCP Server。

MCP 工具返回受支持的位图图片（PNG、JPEG、GIF、WebP、AVIF、BMP）时，扩展会在结果面板中显示预览。点击 **Attach Images** 可将图片及其文本上下文一起添加到当前聊天；图片结果不会自动插入或提交。单次结果最多 8 张图片、每张 10 MiB、总计 20 MiB；出于安全考虑不接受 SVG。

附件功能取决于网站 Adapter 和当前页面的实际支持情况，不支持时会显示提示。附件失败后可重试，已确认的图片不会重复添加，文本上下文也不会重复插入。ChatGPT 的 MCP 按钮位于当前输入框的上传按钮旁，切换首页和对话时会跟随可见输入框移动。

## 一、安装 Chrome 扩展

1. 打开 [最新 Release](https://github.com/drawdy/MCP-Interceptor/releases/latest)。
2. 下载名为 `MCP-Interceptor-*.zip` 的安装包。
3. 将 ZIP 解压到一个固定目录，例如 `C:\MCP-Interceptor`。
4. 打开 Chrome，在地址栏输入 `chrome://extensions/` 并回车。
5. 打开右上角的 **开发者模式（Developer mode）**。
6. 点击 **加载已解压的扩展程序（Load unpacked）**。
7. 选择刚才解压的目录，即包含 `manifest.json` 文件的目录。

此时，MCP-Interceptor 图标应该已经出现在 Chrome 工具栏中。如果没有显示，请打开 Chrome 扩展程序菜单，将 MCP-Interceptor 固定到工具栏。

> 请不要移动或删除扩展解压目录，否则 Chrome 将无法加载扩展。

## 二、安装并启动 MCP-Proxy

MCP-Interceptor 使用独立的 Go 服务 [MCP-Proxy](https://github.com/drawdy/MCP-Proxy)，聚合本地和远程 MCP Server，通过传统 SSE 接口提供给扩展。它已替代此前的 Node.js Proxy Server。

### 长期运行方式如何选择

**对于需要操作本机文件、执行本机命令的工具，推荐以普通用户身份运行编译后的 MCP-Proxy，由操作系统管理进程。** 这是桌面使用场景的默认方案。

| 环境 | 推荐的进程管理方式 | 运行周期 |
|---|---|---|
| Linux | systemd 用户服务 | 登录后启动；可通过 lingering 实现开机启动、退出登录后继续运行 |
| macOS | launchd LaunchAgent | 在已登录用户的会话中运行 |
| Windows | 当前用户的计划任务 | 用户登录后启动 |
| WSL2 | 目标发行版内的 systemd 用户服务 | 仅在该发行版运行期间有效 |
| 需要隔离的工具或远程后端 | Docker Compose | 随容器生命周期运行 |

MCP-Proxy 将 stdio 后端作为子进程启动，传递自身环境并使用配置中的 `cwd`。在 Docker 中，文件工具看到的是容器路径，命令使用容器内程序，凭据和 HOME 属于容器，`localhost` 也指向容器。目录挂载只能开放选定文件，无法完整提供宿主机的 Shell、工具链、桌面会话和权限；仅改用 host 网络也不能解决这些问题。需要隔离时保留 Docker，不建议通过特权容器、挂载整个宿主机或 Docker socket 来绕过隔离。

原生运行的工具拥有运行账户的权限，应使用普通用户、限制后端访问范围，并默认监听 `127.0.0.1`。`go run`、`nohup`、终端复用工具适合开发或临时运行；长期运行使用编译产物和进程管理器，获得自动启动、故障重启和日志管理。

### 步骤 1：构建并配置原生程序

安装 MCP-Proxy 的 `go.mod` 要求的 Go 版本（当前为 **1.26.8 或更高版本**）。如果使用 `npx` 后端，还需在同一宿主环境安装 Node.js/npm；其他后端依其要求安装 Python、uv 等运行环境。

**macOS / Linux**

```bash
git clone https://github.com/drawdy/MCP-Proxy.git
cd MCP-Proxy
cp config.example.json config.json
mkdir -p bin workspace
go build -trimpath -o ./bin/mcp-proxy ./cmd/mcp-proxy
command -v node npx
```

**Windows / PowerShell**

```powershell
git clone https://github.com/drawdy/MCP-Proxy.git
cd MCP-Proxy
Copy-Item config.example.json config.json
New-Item -ItemType Directory -Force bin, workspace
go build -trimpath -o .\bin\mcp-proxy.exe ./cmd/mcp-proxy
Get-Command node, npx
```

将仓库保留在固定位置。启动前编辑 `config.json`：示例中的 `/workspace` 是**容器路径**，需要替换为真实存在的宿主机绝对路径。例如 Linux 配置如下（请替换 `alice` 和目录）：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "/usr/bin/npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/alice/projects"],
      "cwd": "/home/alice/projects"
    }
  }
}
```

程序路径以本机实际安装位置为准。Go 直接启动程序，不经过交互式 Shell，因此不会展开别名、`~`、Shell 初始化文件或 Shell 语法。Windows 的 `npx.cmd` 需要命令解释器，可以显式使用 `"command": "C:\\Windows\\System32\\cmd.exe"`，并配置 `"args": ["/d", "/s", "/c", "npx -y @modelcontextprotocol/server-filesystem C:\\projects"]`。确保代理的 PATH 包含 Node.js/npm；路径有空格时需正确处理引号。

**后台服务需要显式配置环境。** 为代理设置 PATH，包含 Node.js/npm、Python/uv 等程序的真实目录，尤其注意 nvm、fnm、mise、Homebrew 安装的位置。即使 `npx` 使用绝对路径，它仍可能依赖 PATH 查找 `node`。需要项目上下文的后端应设置 `cwd`。后端继承代理环境，也可通过 `env` 覆盖；`${API_TOKEN}` 在配置加载时从**代理进程**环境展开。原生 MCP-Proxy **不会自动读取 `.env`**，应通过进程管理器或受保护的启动脚本注入变量，密钥不要提交到 Git。仅在后端 `env.PATH` 中设置路径，不能控制 Go 对初始启动命令的查找。

长期使用建议固定经过验证的后端包版本，避免每次启动都依赖 `@latest` 或未指定版本的 `npx` 下载。使用服务运行账户安装或缓存依赖，验证后再启用自动启动。

### 步骤 2：前台验证

在 MCP-Proxy 目录执行：

```bash
./bin/mcp-proxy --config ./config.json --host 127.0.0.1 --port 3006
```

PowerShell 中将程序名改为 `.\bin\mcp-proxy.exe`，参数相同。在另一个终端检查 `http://127.0.0.1:3006/healthz` 和 `/readyz`，然后让扩展通过 **SSE** 连接 `http://localhost:3006/sse`。`/healthz` 检查代理进程；只有部分后端连接成功时 `/readyz` 也可能成功，仍需核对日志及预期工具列表。验证完成后按 **Ctrl+C** 停止，再启动托管服务。

### 步骤 3：配置自动启动

#### Linux：systemd 用户服务

创建 `~/.config/systemd/user/mcp-proxy.service`（先创建父目录）。以下假设仓库在 `~/code/github/MCP-Proxy`，请按实际位置修改路径和 PATH：

```ini
[Unit]
Description=MCP-Proxy

[Service]
Type=simple
WorkingDirectory=%h/code/github/MCP-Proxy
ExecStart="%h/code/github/MCP-Proxy/bin/mcp-proxy" --config "%h/code/github/MCP-Proxy/config.json" --host 127.0.0.1 --port 3006
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=-%h/.config/mcp-proxy/env
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillMode=control-group
UMask=0077

[Install]
WantedBy=default.target
```

可选的 `~/.config/mcp-proxy/env` 使用 `KEY=value` 格式，不加 `export`；先创建父目录，并将文件权限设为仅本人可读写（`chmod 600`）。PATH 使用完整的绝对路径。代理与后端输出统一进入 journal，停止服务时清理服务进程组。

```bash
systemd-analyze --user verify ~/.config/systemd/user/mcp-proxy.service
systemctl --user daemon-reload
systemctl --user enable --now mcp-proxy.service
systemctl --user status mcp-proxy.service
journalctl --user -u mcp-proxy.service -f
```

修改配置或环境后，执行 `systemctl --user restart mcp-proxy.service`；修改 unit 后还需先执行 `daemon-reload`。停止使用 `systemctl --user stop mcp-proxy.service`，取消自动启动使用 `systemctl --user disable --now mcp-proxy.service`。

以上 `systemctl --user` 命令均由实际运行代理的普通用户执行，不要加 `sudo`；`sudo systemctl --user` 会指向另一个用户的服务管理器。通过 SSH 操作时，使用该用户的正常登录会话；出现 `Failed to connect to bus` 时，先确认该账户的用户管理器与 `/run/user/$(id -u)/bus` 是否可用。

如需开机启动且退出登录后继续运行，可执行 `loginctl enable-linger "$USER"`（本机策略可能要求管理员授权），并用 `loginctl show-user "$USER" -p Linger` 确认返回 `Linger=yes`。这不会提供图形会话或自动解锁密钥环。参见官方 [服务配置](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)、[环境配置](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html) 和 [lingering 说明](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html)。

#### macOS：launchd LaunchAgent

创建 `~/Library/LaunchAgents/local.mcp-proxy.plist` 和日志目录 `~/Library/Logs/MCP-Proxy`。替换下面**所有** `/Users/alice` 路径，并按 Node.js 安装位置调整 PATH。Plist 字符串不会展开 `~` 或 `$HOME`。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>local.mcp-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/alice/code/github/MCP-Proxy/bin/mcp-proxy</string>
    <string>--config</string><string>/Users/alice/code/github/MCP-Proxy/config.json</string>
    <string>--host</string><string>127.0.0.1</string>
    <string>--port</string><string>3006</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/alice/code/github/MCP-Proxy</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>ExitTimeOut</key><integer>30</integer>
  <key>StandardOutPath</key><string>/Users/alice/Library/Logs/MCP-Proxy/stdout.log</string>
  <key>StandardErrorPath</key><string>/Users/alice/Library/Logs/MCP-Proxy/stderr.log</string>
</dict>
</plist>
```

```bash
plutil -lint ~/Library/LaunchAgents/local.mcp-proxy.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/local.mcp-proxy.plist
launchctl print "gui/$(id -u)/local.mcp-proxy"
tail -f ~/Library/Logs/MCP-Proxy/*.log
```

配置变更后使用 `launchctl kickstart -k "gui/$(id -u)/local.mcp-proxy"` 重启。停止使用 `launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/local.mcp-proxy.plist`；修改 plist 后先 bootout 再 bootstrap。取消自动启动需先 bootout，再移除 plist。应为日志文件安排轮转。macOS 隐私权限仍适用于后台进程，终端中运行成功不代表后台服务自动获得受保护目录的权限。参见 Apple [launchd 指南](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)。

#### Windows：任务计划程序

在任务计划程序中创建名为 **MCP-Proxy** 的任务：

1. 使用当前用户，选择**只在用户登录时运行**，不勾选**使用最高权限运行**；触发器设为该用户**登录时**。
2. 操作中的程序选择 `bin\mcp-proxy.exe` 的绝对路径，参数设为 `--config "C:\path\MCP-Proxy\config.json" --host 127.0.0.1 --port 3006`，**起始于**设为 `C:\path\MCP-Proxy`。
3. 启用失败后重启（例如每分钟一次、尝试三次），选择**不启动新实例**，关闭运行时长限制；如需电池供电时运行，也应关闭相应的电源限制。
4. 运行任务，检查 `/healthz`、`/readyz` 和扩展中的工具。修改配置后先**结束**再**运行**；**禁用**任务可取消自动启动。

启动任务前配置需要的用户环境变量；修改 PATH 后注销并重新登录，确保任务调度器使用新环境。如需文件日志，可使用 PowerShell 启动脚本设置环境，并同步运行程序，将 stdout/stderr 重定向到受保护且定期轮转的日志文件；不要用 `Start-Process` 分离进程，任务需要跟踪实际运行进程。结束任务可能强制终止进程，重启前检查是否遗留后端子进程。无人登录也要运行的 Windows Service 需要服务包装器，并显式配置账户和环境；当前 Go 程序本身不是 Windows Service。参见 Microsoft [任务账户选项](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtaskprincipal) 和 [运行时长限制](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-executiontimelimit)。

#### WSL2：先确定需要哪一侧的环境

需要 Linux 项目与 Linux 命令时，在目标 WSL 发行版内构建并运行 MCP-Proxy，按 Linux 步骤配置并[启用 systemd](https://learn.microsoft.com/en-us/windows/wsl/systemd)。路径使用 `/home/alice/projects` 等 Linux 路径，访问挂载的 Windows 文件可用 `/mnt/c/projects`。这提供的是该发行版环境，不等同于 Windows 桌面会话；需要 Windows 应用和工具链时，优先运行 Windows 原生代理。lingering 不会在 Windows 开机时自动启动发行版，也不能保证发行版一直运行；如有需要，另行配置 Windows 侧的 WSL 启动，并在修改监听地址前验证浏览器能否连接。

### 从 Docker Compose 迁移

1. 先记录原 Compose 的项目名、全部 `-f` 配置文件、监听地址/端口、后端名称及完整工具列表。使用实际部署命令检查 `docker compose ... config` 和 `docker inspect`，确认 override、host 网络、bind mount、volume 及环境变量；输出可能含密钥，不要贴到公开日志。不要只根据仓库默认的 `compose.yml` 判断线上配置。
2. 备份 `config.json`、`.env`、Compose 文件、旧镜像标识和需要保留的后端状态。保留原配置作为回滚副本，在独立的候选配置中修改宿主路径。容器 HOME、npm 缓存及 Desktop Commander 的历史/配置与宿主账户分离，按需迁移，并检查路径、权限和密钥。对已通过 bind mount 持久化的状态，可让原生服务继续使用对应宿主目录；例如将容器 `XDG_DATA_HOME=/var/lib/mcp-proxy` 改为该挂载的真实宿主路径，以延续后端审计日志。
3. 在停止旧服务前，安装宿主运行环境、构建程序并校验 unit。将 `/workspace`、`/opt/...` 等容器路径替换为真实宿主路径，保留原有 `mcpServers` 条目、认证配置及后端参数。复制 Node.js 后端目录时，确认包含运行依赖，并在宿主 Node.js 版本和 CPU 架构下验证原生模块；仅复制入口 JS 文件不够。将所需环境变量迁入进程管理器配置；原生进程不读取 Compose 的 `.env`、`MCP_PROXY_BIND` 或 `MCP_PROXY_PORT`，监听地址和端口使用 `--host`、`--port`。
4. 用候选配置在临时的回环地址端口（例如 `127.0.0.1:3007`）验证原生程序。核对全部后端及工具列表，并实际调用无副作用的工具；`/readyz` 成功并不代表所有后端都已恢复。并行验证时，为日志/审计等可写状态使用独立目录；若后端不支持多个实例，应在维护窗口顺序验证。完成后停止临时实例。
5. 使用原来的项目名及全部 `-f` 参数执行 `docker compose ... stop mcp-proxy`，确认正式端口已释放，再切换候选配置并启动托管服务。保留已停止的容器和 volume 以便回滚；如使用 `down`，**不要加 `-v`**。同一端口只保留一个运行实例。沿用原访问地址（本机默认 `http://localhost:3006/sse`；远程浏览器使用服务器实际地址），重新连接扩展，核对工具列表并验证实际调用、服务重启和自动启动。
6. 需要回滚时，先停止并禁用原生服务，恢复原 Compose 使用的配置及环境，再使用原项目名和全部 `-f` 参数执行 `docker compose ... up -d --no-build`。候选配置中的宿主路径不能直接交给旧容器；回滚后也需检查工具列表和实际调用。确认迁移稳定后，再按需清理旧容器和备份。

升级时先停止原生服务，备份程序和配置，更新到经过审查的版本，按前述命令重新构建，然后启动并验证。保留旧程序和配置以便回滚。

### 可选：使用 Docker Compose 运行隔离工具

如果容器隔离符合需求，可按 [MCP-Proxy Docker 文档](https://github.com/drawdy/MCP-Proxy#docker-compose) 部署。默认 Compose 将 `./workspace` 挂载为 `/workspace`，提供 Node.js、npm/Desktop Commander 持久化 volume，并发布到 `127.0.0.1:3006`。容器后端不需要宿主安装对应运行环境，配置使用容器路径；宿主命令和桌面访问仍受隔离限制。

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f mcp-proxy
docker compose restart mcp-proxy
```

### 可选：开放局域网访问

原生运行时，将托管命令改为 `--host 0.0.0.0 --port 3006` 并重启。Compose 则在其 `.env` 中设置 `MCP_PROXY_BIND=0.0.0.0`，再执行 `docker compose up -d`。扩展填写机器的真实局域网地址，例如 `http://192.168.1.100:3006/sse`；`0.0.0.0` 是监听地址，不是连接目标。

使用防火墙将 `3006` 端口限制为可信设备。代理没有前端身份认证，CORS 不能替代访问控制。不要直接暴露到公网或配置路由器公网端口转发。

## 三、添加更多 MCP Server

可以同时连接多个 MCP Server。在 `config.json` 的 `mcpServers` 对象中，为每个 MCP Server 增加一个独立配置项，并确保名称唯一。

### 示例 A：添加文件系统访问能力

原生运行时，使用真实存在的宿主目录及后端程序路径。以下 Linux 示例同时添加了 Desktop Commander，请按本机环境修改路径：

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "/usr/bin/npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander@latest"]
    },
    "filesystem": {
      "command": "/usr/bin/npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/alice/projects"
      ]
    }
  }
}
```

macOS 可使用 `/Users/alice/projects`；Windows 的 JSON 路径应转义，例如 `C:\\projects`，并使用前述命令解释器配置。Desktop Commander 使用代理账户的环境，其 `allowedDirectories` 需单独配置。文件访问限制并不能隔离任意 Shell 命令。使用 Docker 时则改用 `/workspace`，额外宿主目录需要在 `compose.yml` 中显式挂载。

**请只开放你信任 AI 工具读取或修改的目录。** 除非确实有需要，不要将整个磁盘开放给文件系统 Server。

### 示例 B：添加远程 MCP Server

如果你已经有一个提供 SSE 接口的远程 MCP Server，可以通过 URL 添加：

```json
{
  "mcpServers": {
    "my-remote-server": {
      "url": "https://your-mcp-server.example.com/sse"
    }
  }
}
```

请使用远程 Server 提供的实际 URL 和认证配置。如果需要凭据，请按照该 Server 的说明配置，并避免将密码、Token 等敏感信息提交到公开仓库。

### 修改 config.json 后

使用对应进程管理器重启：Linux 执行 `systemctl --user restart mcp-proxy.service`，macOS 执行 `launchctl kickstart -k "gui/$(id -u)/local.mcp-proxy"`，Windows 在任务计划程序中先**结束**再**运行**。前台进程按 **Ctrl+C** 后重新启动；Docker 执行 `docker compose restart mcp-proxy`。扩展未自动恢复时重新连接。配置只在启动时加载，修改后必须重启。

配置正确并成功启动的 MCP Server，其工具都会通过 Proxy Server 提供给浏览器扩展。

## 四、让扩展连接 Proxy Server

请先确认 Proxy Server 已经启动，然后进行以下操作：

1. 点击 Chrome 工具栏中的 **MCP-Interceptor** 图标。
2. 在 **MCP Server Endpoint** 中输入：

   `http://localhost:3006/sse`

3. 将 **Transport** 设置为 **SSE**。
4. 点击 **Grant access and connect**。
5. Chrome 弹出主机访问权限提示时，点击 **允许（Allow）**。
6. 等待扩展显示 **Connected**。

只需要授予扩展访问当前配置的 Server 主机的权限，不需要允许它访问所有网站或局域网地址。

### 传输协议兼容性

MCP-Proxy 当前向 MCP-Interceptor 提供传统 **SSE** 接口。扩展中的 **Transport** 请选择 **SSE**，Endpoint 使用 `http://localhost:3006/sse`。

MCP-Proxy 的后端连接支持 stdio、SSE 和 Streamable HTTP。这里指的是它连接后端 MCP Server 的能力，并不代表面向浏览器扩展的代理接口也支持 Streamable HTTP 或 WebSocket。使用 MCP-Proxy 时，不要在扩展中选择这两种输出协议。

## 五、在 Gemini、DeepSeek、Grok、ChatGPT 中使用 MCP 工具

各个平台的操作基本一致。

### 步骤 1：打开 AI 聊天网站

打开以下任意网站并进入一个对话：

- [Google Gemini](https://gemini.google.com/)
- [DeepSeek](https://chat.deepseek.com/)
- [Grok](https://grok.com/)
- [ChatGPT](https://chatgpt.com/)

页面中应该会出现 MCP-Interceptor 侧边栏。

### 步骤 2：检查连接和可用工具

1. 查看侧边栏上方的 **Server** 状态，应显示 **Connected**。
2. 打开 **Available Tools** 标签页。
3. 展开某个 Server，查看它提供的工具。
4. 启用你希望 AI 使用的工具。可以点击 **Enable All** 或 **Disable All** 批量启用或禁用。

如果没有看到 Server 或工具，请先检查前台输出或进程管理器日志（journal、LaunchAgent 日志文件或 Windows 启动脚本日志）是否有报错，再点击 Server 状态旁边的刷新按钮。

### 步骤 3：向对话插入 MCP Instructions

AI 需要先获得调用工具的说明，才能按照 MCP-Interceptor 支持的格式发起工具调用。

1. 在聊天输入框附近找到扩展添加的 **MCP** 小按钮。
2. 将鼠标悬停在 MCP 按钮上，打开快捷操作菜单。
3. 点击 **Insert**，扩展会将 MCP Instructions 插入当前聊天输入框。
4. 将这段 Instructions 作为一条消息发送，然后再提出需要 AI 使用 MCP 工具完成的任务。

如果网站支持文件附件，也可以在同一个菜单中点击 **Attach**，将 Instructions 作为附件提供给 AI。

侧边栏中的 **Instructions** 标签页可以查看自动生成的说明。只有需要自定义内容时，才需要使用其中的 **Edit** 功能。

### 步骤 4：让 AI 调用工具

明确告诉 AI 希望它执行什么操作。例如：

- “使用 desktop-commander 查看当前工作目录。”
- “使用 filesystem 工具列出 Documents 目录中的文件。”
- “使用可用的 MCP 工具检查服务器状态，然后总结检查结果。”

当模型生成 MCP-Interceptor 能识别的工具调用时，扩展会显示工具名称和参数。检查工具及参数无误后，点击 **Run** 执行。工具执行结果会返回到对话中，AI 可以继续处理后续任务。

### 步骤 5：熟悉后再启用自动化

将鼠标悬停在 MCP 按钮上，点击 **Configure**，可以看到自动化开关：

| 设置项 | 作用 |
|---|---|
| **MCP** | 为当前聊天页面启用或禁用 MCP 控件。 |
| **Auto Insert** | 自动将工具调用内容插入聊天输入框。 |
| **Auto Submit** | 插入内容后自动提交聊天消息。 |
| **Auto Execute** | 自动执行检测到的 MCP 工具调用。 |

首次使用时，建议关闭 **Auto Insert**、**Auto Submit** 和 **Auto Execute**。先人工检查每次工具调用，并点击 **Run** 执行。只有在确认 MCP Server 可信、理解工具的实际操作范围后，再考虑启用自动化。

### 可选：Push Content Mode

侧边栏顶部有一个 **Push Content Mode** 开关。启用后，扩展会调整网页内容区域，为侧边栏腾出空间，而不是让侧边栏覆盖网页内容。

如果侧边栏遮挡了网页内容，可以打开这个开关；如果没有遮挡，则保持关闭即可。

## 六、常见问题

| 现象 | 检查方法 |
|---|---|
| 扩展弹窗显示 **Disconnected** | 检查原生服务状态（Linux：`systemctl --user status mcp-proxy.service`）及 `/healthz`；Docker 使用 `docker compose ps`。核对 Endpoint，Transport 选择 SSE。 |
| Chrome 没有弹出权限提示 | 输入 Endpoint 后点击 **Grant access and connect**。如果更换了主机地址，需要为新主机重新授权。 |
| 侧边栏显示 **Disconnected** | 查看进程管理器日志（Linux：`journalctl --user -u mcp-proxy.service -f`），核对 Endpoint 和 SSE 设置，再刷新 Server。Docker 使用 `docker compose logs -f mcp-proxy`。 |
| 已连接，但没有显示工具 | 检查 `mcpServers` 和进程管理器日志，核对服务账户的程序路径、PATH、凭据及 `cwd`；修复后使用对应进程管理器重启，再刷新工具列表。 |
| AI 不调用工具 | 将 MCP Instructions 插入当前对话，明确指定工具名称和任务。 |
| 工具执行失败 | 检查工具参数和进程管理器日志，核对后端命令、运行环境、凭据、目录权限及系统隐私授权。Docker 还需检查挂载及容器路径。 |
| 终端运行正常，后台服务失败 | 显式配置代理 PATH 和环境变量；服务不读取 Shell 初始化文件或 Compose 的 `.env`。检查账户、HOME、`cwd`、绝对路径及运行环境。 |
| 端口已被占用 | 启动原生服务前停止旧 Compose 容器或前台进程，确保 `3006` 端口只运行一个实例。 |
| Docker 中 Desktop Commander 报 `ENOENT` 或 `EROFS` | 对照当前 [MCP-Proxy Docker 配置](https://github.com/drawdy/MCP-Proxy#docker-compose)，检查状态/日志 volume 是否可写及其所有权。 |
| 扩展更新后网页中的 UI 异常 | 刷新 AI 聊天页面，让扩展重新初始化。 |

## 七、安全建议

MCP 工具可能读取或修改文件、执行命令或访问外部服务。请将每个 MCP Server 都视为需要单独信任的软件。

- 只安装来源可信的 MCP Server。
- 从少量工具开始，只启用当前任务需要的工具。
- 将文件系统 Server 的访问范围限制在特定目录。
- 不要将密码、API Key、Token 等敏感信息提交到公开仓库。请使用环境变量或 MCP Server 支持的密钥配置方式。
- 点击 **Run** 前检查工具名称和参数。
- 除非确实需要无人值守执行，否则保持 **Auto Execute** 关闭。
- MCP-Proxy 默认只绑定 `127.0.0.1`。如使用 `--host 0.0.0.0`（Compose 使用 `MCP_PROXY_BIND=0.0.0.0`）开放局域网访问，请通过防火墙将 `3006` 端口限制为可信设备。不要将它暴露到公网，也不要配置路由器公网端口转发。

### Chrome Manifest V3 内容安全策略

扩展的 Background Service Worker 使用 MCP SDK 自带的 `CfWorkerJsonSchemaValidator` 校验工具结构化输出。由于 Ajv 的运行时代码生成与 MV3 扩展 CSP 不兼容，构建时通过 fail-closed alias 禁用默认 Ajv Provider。不要在 CSP 中加入 `unsafe-eval`，也不要重新引入 Ajv 动态代码生成。Extension CI 在后台、MCP 客户端、storage 或 shared 代码变更时运行 `pnpm --filter chrome-extension test`，生产构建后运行 `pnpm scan:mv3-csp`。测试直接编译 workspace 源码，不依赖预先生成的包构建产物。

## 支持的平台

MCP-Interceptor 当前包含 Gemini、DeepSeek、Grok、ChatGPT 等聊天网站的适配器。由于这些网站可能随时调整页面结构，集成能力可能受到影响。

如果某个平台的集成出现问题，请在 [GitHub Issues](https://github.com/drawdy/MCP-Interceptor/issues) 提交反馈，并注明网站、浏览器版本和复现步骤。请勿在 Issue 中提交 API Key、私有地址或其他敏感信息。

## 许可证

MCP-Interceptor 使用 MIT License，详见 [LICENSE](LICENSE)。
