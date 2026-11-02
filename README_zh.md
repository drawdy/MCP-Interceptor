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

MCP-Interceptor 通过一个运行在本机的 Proxy Server，将 AI 聊天网站连接到 MCP 工具。只需安装浏览器扩展、启动 Proxy Server、添加需要使用的 MCP Server，然后连接即可。

## 工作原理

```text
Gemini / DeepSeek / Grok / ChatGPT
              ⇅
       MCP-Interceptor
          Chrome 扩展
              ⇅
        本地 Proxy Server
              ⇅
       已配置的 MCP Server
```

**请注意：** MCP Server 是添加到 Proxy Server 的配置文件中的。浏览器扩展只需要连接 Proxy Server，不需要在扩展中逐个添加 MCP Server。

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

## 二、安装并启动本地 Proxy Server

Proxy Server 是一个独立的命令行程序，负责连接浏览器扩展和本地或远程 MCP Server。

### 步骤 1：安装 Node.js

1. 从 [Node.js 官网](https://nodejs.org/) 下载并安装当前的 **LTS 版本**。
2. 关闭并重新打开终端或 PowerShell。
3. 检查 Node.js、npm 和 npx 是否可用：

```bash
node -v
npm -v
npx -v
```

如果每条命令都能输出版本号，就可以继续。

### 步骤 2：创建配置目录

创建一个目录，用于存放 MCP 配置文件。例如：

- Windows：`C:\MCP-Interceptor`
- macOS / Linux：`~/mcp-interceptor`

在该目录下创建一个名为 **config.json** 的文件。

**Windows 提示：** 在资源管理器中打开目录，右键空白处，选择“新建 → 文本文档”，将文件重命名为 `config.json`，然后用记事本打开。注意确认文件名不是 `config.json.txt`。

### 步骤 3：添加第一个 MCP Server

将下面的配置复制到 `config.json`。这个示例会启动 Desktop Commander MCP Server：

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander"]
    }
  }
}
```

保存文件。

### 步骤 4：启动 Proxy Server

在配置目录中打开终端。

**Windows / PowerShell**

1. 在资源管理器中打开 `C:\MCP-Interceptor`。
2. 点击地址栏，输入 `powershell`，按回车。
3. 执行：

```powershell
npx -y @srbhptl39/mcp-superassistant-proxy@latest --config .\config.json --outputTransport sse
```

**macOS / Linux**

打开终端并执行：

```bash
cd ~/mcp-interceptor
npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport sse
```

首次启动可能需要等待几分钟，因为 npm 需要下载 Proxy Server 和 MCP Server 程序。

此命令会让 Proxy Server 在前台运行。使用 MCP-Interceptor 期间，请保持该终端窗口打开。如果不想一直占用终端窗口，可以使用下面的后台运行命令。

默认 SSE 地址为：

```text
http://localhost:3006/sse
```

目前 Proxy Server 的 npm 包仍使用上游项目名称 `@srbhptl39/mcp-superassistant-proxy`。这是正常的，它与 MCP-Interceptor 浏览器扩展是两个独立组件。

### 可选：后台运行 Proxy Server

请在包含 `config.json` 的目录中执行以下命令。后台进程的输出会写入 `proxy.log`。

**macOS / Linux**

```bash
nohup npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport sse > ./proxy.log 2>&1 < /dev/null & echo $! > ./proxy.pid
```

使用 `tail -f ./proxy.log` 查看日志。使用 `kill "$(cat ./proxy.pid)"` 停止进程，然后用 `rm -f ./proxy.pid` 删除 PID 文件。

**Windows / PowerShell**

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList '/c npx -y @srbhptl39/mcp-superassistant-proxy@latest --config .\\config.json --outputTransport sse > .\\proxy.log 2>&1' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id
```

命令会输出后台进程 ID。使用 `Get-Content .\\proxy.log -Wait` 查看日志；使用 `taskkill /PID <PID> /T /F` 停止进程及其子进程。

### 可选：允许局域网内其他设备访问

默认的 `localhost` 地址适用于在同一台电脑上运行的浏览器。如果需要从其他设备连接，Proxy Server 必须能够通过局域网网卡访问。

1. 先检查当前安装版本支持的命令行参数：

   ```bash
   npx -y @srbhptl39/mcp-superassistant-proxy@latest --help
   ```

2. **只有当帮助信息中明确列出 `--host` 参数时**，才在启动命令中增加 `--host 0.0.0.0`：

   ```bash
   npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport sse --host 0.0.0.0
   ```

3. 扩展中应填写 Proxy Server 所在机器的实际局域网 IP，例如 `http://192.168.1.100:3006/sse`。不要把 `0.0.0.0` 填入 Endpoint；它是监听地址，不是客户端连接地址。

**注意：** 当前上游发布的 CLI 文档列出了 `--port`、`--baseUrl` 等参数，但没有列出 `--host`。如果你安装版本的 `--help` 中没有 `--host`，就不要使用该参数。`--baseUrl` 用于设置 SSE 客户端使用的 URL，不能直接视为监听地址配置。

如果当前 Proxy Server 不支持设置监听地址，可以在局域网网卡上部署反向代理，将请求转发到只监听本机的 Proxy Server。例如，下面的 Caddy 配置会在所有 IPv4 网卡的 3007 端口监听，并转发到本机 3006 端口：

```caddyfile
:3007 {
    bind 0.0.0.0
    reverse_proxy 127.0.0.1:3006
}
```

然后在扩展中填写 `http://<服务器局域网IP>:3007/sse`。

请通过防火墙将开放端口限制为可信的局域网设备。不要将 Proxy Server 直接暴露到公网，也不要在路由器上配置公网端口转发。

## 三、添加更多 MCP Server

可以同时连接多个 MCP Server。在 `config.json` 的 `mcpServers` 对象中，为每个 MCP Server 增加一个独立配置项，并确保名称唯一。

### 示例 A：添加文件系统访问能力

下面的示例增加一个文件系统 MCP Server，并将它的访问范围限制在指定目录：

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:/Users/YourName/Documents"
      ]
    }
  }
}
```

将 `C:/Users/YourName/Documents` 替换为你希望开放给工具访问的目录。Windows 的 JSON 路径建议使用正斜杠。

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

1. 切换到运行 Proxy Server 的终端窗口。
2. 按 **Ctrl+C** 停止 Proxy Server。
3. 再次执行启动命令。
4. 如果 MCP-Interceptor 没有自动恢复连接，在扩展中重新连接。

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

### 其他传输协议

首次使用建议选择 SSE。如果你明确使用其他输出协议启动 Proxy Server，则扩展中的传输协议也必须选择对应类型：

| Proxy Server 启动参数 | 扩展 Transport | Endpoint |
|---|---|---|
| `--outputTransport sse` | SSE | `http://localhost:3006/sse` |
| `--outputTransport streamableHttp` | Streamable HTTP | `http://localhost:3006` |
| `--outputTransport ws` | WebSocket | `ws://localhost:3006/message` |

例如，使用 Streamable HTTP 启动 Proxy Server：

```bash
npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport streamableHttp
```

请确保扩展选择的 Transport 与 Proxy Server 的输出协议一致。

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

如果没有看到 Server 或工具，请先检查 Proxy Server 前台终端或后台运行时的 `proxy.log` 日志是否有报错，再点击 Server 状态旁边的刷新按钮。

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
| 扩展弹窗显示 **Disconnected** | 确认 Proxy Server 终端仍在运行，并检查 Endpoint 和 Transport 是否正确。 |
| Chrome 没有弹出权限提示 | 输入 Endpoint 后点击 **Grant access and connect**。如果更换了主机地址，需要为新主机重新授权。 |
| 侧边栏显示 **Disconnected** | 检查 Proxy Server 前台终端或后台运行时的 `proxy.log` 日志，确认扩展 Endpoint 正确，然后点击 Server 状态旁的刷新按钮。 |
| 已连接，但没有显示工具 | 检查 `config.json` 中是否正确配置了 `mcpServers`，查看 Proxy Server 启动日志，修复错误后重启并刷新工具列表。 |
| AI 不调用工具 | 将 MCP Instructions 插入当前对话，明确指定工具名称和任务。 |
| 工具执行失败 | 检查工具参数、Proxy Server 日志、MCP Server 命令和参数、认证信息及文件系统权限。 |
| 扩展更新后网页中的 UI 异常 | 刷新 AI 聊天页面，让扩展重新初始化。 |

## 七、安全建议

MCP 工具可能读取或修改文件、执行命令或访问外部服务。请将每个 MCP Server 都视为需要单独信任的软件。

- 只安装来源可信的 MCP Server。
- 从少量工具开始，只启用当前任务需要的工具。
- 将文件系统 Server 的访问范围限制在特定目录。
- 不要将密码、API Key、Token 等敏感信息提交到公开仓库。请使用环境变量或 MCP Server 支持的密钥配置方式。
- 点击 **Run** 前检查工具名称和参数。
- 除非确实需要无人值守执行，否则保持 **Auto Execute** 关闭。
- 默认只在本机运行 Proxy Server。如果通过 `0.0.0.0` 或反向代理开放局域网访问，请通过防火墙限制为可信设备。不要将它暴露到公网，也不要配置路由器公网端口转发。

## 支持的平台

MCP-Interceptor 当前包含 Gemini、DeepSeek、Grok、ChatGPT 等聊天网站的适配器。由于这些网站可能随时调整页面结构，集成能力可能受到影响。

如果某个平台的集成出现问题，请在 [GitHub Issues](https://github.com/drawdy/MCP-Interceptor/issues) 提交反馈，并注明网站、浏览器版本和复现步骤。请勿在 Issue 中提交 API Key、私有地址或其他敏感信息。

## 许可证

MCP-Interceptor 使用 MIT License，详见 [LICENSE](LICENSE)。
