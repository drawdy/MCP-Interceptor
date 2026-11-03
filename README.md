<!-- MCP-INTERCEPTOR-README -->
<div align="center">
  <p><a href="README_zh.md">简体中文</a> · <a href="README.md">English</a></p>
  <img src="docs/assets/logo-horizontal.svg" alt="MCP-Interceptor" width="560" />
  <p><strong>Use your MCP tools directly in Gemini, DeepSeek, Grok, ChatGPT and other supported AI chat websites.</strong></p>
  <p>
    <a href="https://github.com/drawdy/MCP-Interceptor/releases/latest">Download latest version</a>
    ·
    <a href="https://github.com/drawdy/MCP-Interceptor/issues">Report a problem</a>
  </p>
</div>

---

MCP-Interceptor connects AI chat websites to MCP tools through [MCP-Proxy](https://github.com/drawdy/MCP-Proxy), a standalone Go-based proxy. Install the browser extension, start MCP-Proxy with your configured MCP Servers, and connect.

## How it works

```text
Gemini / DeepSeek / Grok / ChatGPT
              ⇅
       MCP-Interceptor
        Chrome extension
              ⇅
       MCP-Proxy (Go)
              ⇅
   Your configured MCP Servers
```

**Important:** Configure MCP Servers in MCP-Proxy. The browser extension connects to MCP-Proxy; you do not add each backend MCP Server separately in the extension.

MCP tools that return supported raster images (PNG, JPEG, GIF, WebP, AVIF or BMP) are previewed in the result panel. Click **Attach Images** to add them to the current chat together with their text context. Image results are not automatically inserted or submitted. Per result, the extension accepts up to 8 images, 10 MiB per image and 20 MiB total; SVG is intentionally not accepted.

Attachment availability depends on the website adapter and the current page. Unsupported pages show a notice. If an attachment fails, retry keeps confirmed images and does not insert the text context twice. ChatGPT's MCP button appears beside the upload control in the active composer, including after switching between the home page and a conversation.

## 1. Install the browser extension

1. Open the [latest release](https://github.com/drawdy/MCP-Interceptor/releases/latest).
2. Download the file named `MCP-Interceptor-*.zip`.
3. Extract the ZIP file to a folder that you will keep, for example `C:\MCP-Interceptor`.
4. Open Chrome and enter `chrome://extensions/` in the address bar.
5. Turn on **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted folder — the folder that contains `manifest.json`.

The MCP-Interceptor icon should now appear in Chrome. If it is hidden, open Chrome's Extensions menu and pin it to the toolbar.

> Keep the extracted folder in the same location. If you move or delete it, Chrome cannot load the extension.

## 2. Install and start MCP-Proxy

MCP-Interceptor uses [MCP-Proxy](https://github.com/drawdy/MCP-Proxy), a standalone Go service that aggregates local and remote MCP Servers and exposes them to the extension through traditional SSE. It replaces the previous Node.js Proxy Server.

### Choose a long-running deployment

**For tools that work with your local files and commands, run a compiled MCP-Proxy binary as your normal user, managed by the operating system.** This is the recommended desktop setup.

| Environment | Recommended supervisor | Lifetime |
|---|---|---|
| Linux | systemd user service | Starts at login; optionally at boot with lingering |
| macOS | launchd LaunchAgent | Runs in the logged-in user's session |
| Windows | Task Scheduler, current user | Starts at login |
| WSL2 | systemd user service inside the intended distribution | Runs while that distribution is running |
| Isolated workloads or remote backends | Docker Compose | Container lifecycle |

MCP-Proxy launches stdio backends as child processes with its environment and the configured `cwd`. In Docker, filesystem tools see container paths, commands use container executables, credentials and HOME belong to the container, and `localhost` refers to the container. Bind mounts expose selected files but do not provide the host's shell, toolchains, desktop session or permissions. Host networking alone does not solve this. Keep Docker when that isolation is intentional; avoid privileged containers, mounting the entire host or exposing the Docker socket to bypass it.

A native process gives tools the permissions of the account running it. Use your normal account, restrict backend access, and keep the proxy on `127.0.0.1`. `go run`, `nohup` and terminal multiplexers are useful for development or temporary sessions; use a compiled binary and a supervisor for automatic startup, restart and logs.

### Step 2.1 — Build and configure a native installation

Install the Go version required by MCP-Proxy's `go.mod` (currently **1.26.8 or newer**). Install Node.js/npm on the same host if using `npx` backends, and any other runtimes required by your chosen servers.

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

Keep the repository in a fixed location. Edit `config.json` before starting: the supplied `/workspace` path is a **container path**, so replace it with an existing absolute host directory. For example, on Linux (replace `alice` and the paths):

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

Use the actual executable location on your machine. Go launches commands directly, without an interactive shell: aliases, `~`, shell startup files and shell syntax are not expanded. On Windows, npm's `npx.cmd` needs a command interpreter; one explicit configuration is `"command": "C:\\Windows\\System32\\cmd.exe"` with `"args": ["/d", "/s", "/c", "npx -y @modelcontextprotocol/server-filesystem C:\\projects"]`. Ensure Node.js/npm are in the proxy's PATH; use the appropriate quoting if your paths contain spaces.

**Service environments need explicit setup.** Set the proxy's PATH to include the real Node.js/npm, Python/uv and other required executable directories, especially for nvm, fnm, mise or Homebrew installations. Even an absolute `npx` path may need PATH to find `node`. Set each backend's `cwd` when it needs a particular project directory. Backends inherit the proxy environment and can override values through `env`; `${API_TOKEN}` is expanded from the **proxy's** environment when configuration is loaded. Native MCP-Proxy does **not** load `.env` automatically. Supply variables through the supervisor or a protected launcher, and keep secrets out of Git. Backend `env.PATH` alone does not control how Go locates its initial command.

For a stable installation, pin backend package versions you have tested instead of relying on `@latest` or unversioned `npx` downloads at every startup. Install/cache them under the service account and test them before enabling automatic startup.

### Step 2.2 — Verify in the foreground

From the MCP-Proxy directory:

```bash
./bin/mcp-proxy --config ./config.json --host 127.0.0.1 --port 3006
```

On PowerShell, use `.\bin\mcp-proxy.exe` with the same arguments. In another terminal, check `http://127.0.0.1:3006/healthz` and `/readyz`, then connect the extension to `http://localhost:3006/sse` with **SSE** selected. `/healthz` checks the process; `/readyz` can succeed when only some backends are connected, so also check the logs and expected tool list. Press **Ctrl+C** before starting a supervised instance.

### Step 2.3 — Enable automatic startup

#### Linux — systemd user service

Create `~/.config/systemd/user/mcp-proxy.service` (create the parent directory first). This example assumes the repository is at `~/code/github/MCP-Proxy`; adjust it and PATH to your installation:

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

The optional `~/.config/mcp-proxy/env` file contains `KEY=value` entries, without `export`; create its parent directory and restrict the file to your user (`chmod 600`). Use literal absolute paths in PATH. The supervisor captures proxy and backend output in the journal and stops the service's process group.

```bash
systemctl --user daemon-reload
systemctl --user enable --now mcp-proxy.service
systemctl --user status mcp-proxy.service
journalctl --user -u mcp-proxy.service -f
```

After changing configuration or environment, use `systemctl --user restart mcp-proxy.service`. After changing the unit, also run `daemon-reload`. Stop with `systemctl --user stop mcp-proxy.service`; remove automatic startup with `systemctl --user disable --now mcp-proxy.service`.

For startup at boot and operation after logout, optionally run `loginctl enable-linger "$USER"` (local policy may require administrator authorization). This does not provide a graphical session or an unlocked keyring. See the official [service configuration](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html), [environment configuration](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html) and [lingering documentation](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html).

#### macOS — launchd LaunchAgent

Create `~/Library/LaunchAgents/local.mcp-proxy.plist` and the log directory `~/Library/Logs/MCP-Proxy`. Replace **every** `/Users/alice` path below and adjust PATH for your Node.js installation. Plist strings do not expand `~` or `$HOME`.

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

Restart after a config change with `launchctl kickstart -k "gui/$(id -u)/local.mcp-proxy"`. To stop, use `launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/local.mcp-proxy.plist`; bootstrap again to load changed plist settings. To remove automatic startup, boot out and remove the plist. Plan log rotation for these files. macOS privacy permissions still apply to the background process; a successful terminal run does not guarantee access to protected folders. See Apple's [launchd guide](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html).

#### Windows — Task Scheduler

Create a task named **MCP-Proxy** in Task Scheduler:

1. Use your current user, **Run only when user is logged on**, without **Run with highest privileges**; trigger **At log on** for that user.
2. Set the action to the absolute path of `bin\mcp-proxy.exe`, arguments to `--config "C:\path\MCP-Proxy\config.json" --host 127.0.0.1 --port 3006`, and **Start in** to `C:\path\MCP-Proxy`.
3. Enable restart on failure (for example every minute, three attempts), select **Do not start a new instance**, disable the execution time limit, and disable battery conditions that would stop or prevent the task if you need it on battery power.
4. Run the task and check `/healthz`, `/readyz` and the extension's tools. Use Task Scheduler's **End** then **Run** after configuration changes; **Disable** removes automatic startup.

Set required user environment variables before launching the task; after changing PATH, sign out and back in so the scheduler uses the new environment. For file logs, use a PowerShell launcher that sets the environment and runs the executable synchronously with stdout/stderr redirected to protected, rotated log files; do not detach it with `Start-Process`, since the task must track the running process. Ending a task can be abrupt: check for leftover backend processes before restarting. An unattended Windows Service needs a service wrapper and an explicitly configured account/environment; the current Go executable is not itself a Windows Service. See Microsoft's [task principal options](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtaskprincipal) and [execution time limit](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-executiontimelimit).

#### WSL2 — choose the environment you need

If your tools need Linux projects and Linux commands, build and run MCP-Proxy inside that WSL distribution using the Linux instructions, with [systemd enabled](https://learn.microsoft.com/en-us/windows/wsl/systemd). Use Linux paths such as `/home/alice/projects` (or `/mnt/c/projects` for mounted Windows files). This gives access to that distribution, not an equivalent Windows desktop session. For Windows applications and Windows toolchains, prefer a Windows-native proxy. A lingering user service does not start the distribution at Windows boot or keep it alive indefinitely; handle Windows-side WSL startup separately if required, and verify connectivity from the browser before changing network bindings.

### Migrating from Docker Compose

1. Back up `config.json`, `.env` and any backend state you need. Container HOME, npm cache and Desktop Commander history/configuration live separately from your host account; migrate needed state deliberately and review paths, permissions and secrets.
2. In the old Compose directory, run `docker compose down` to release port `3006`. Do **not** add `-v` if you need the named volumes for migration or rollback.
3. Install host runtimes; replace `/workspace` and container executable paths with host paths, and transfer required environment variables into the supervisor configuration. Native processes do not read Compose's `.env`, `MCP_PROXY_BIND` or `MCP_PROXY_PORT`; use `--host` and `--port`.
4. Verify the native binary in the foreground, stop it, then enable one supervisor. Keep the extension endpoint `http://localhost:3006/sse` and check actual file/command tools. To roll back, stop the native service before running `docker compose up -d` again.

For upgrades, stop the native service, back up the binary and configuration, update to a reviewed revision, rebuild with the command above, and start and verify the service. Keep the previous binary/configuration for rollback.

### Optional — Docker Compose for isolated tools

If container isolation fits your workload, follow the [MCP-Proxy Docker instructions](https://github.com/drawdy/MCP-Proxy#docker-compose). The supplied Compose setup mounts `./workspace` as `/workspace`, provides Node.js and persistent npm/Desktop Commander volumes, and publishes `127.0.0.1:3006` by default. Host runtimes are unnecessary for container backends. Use container paths in that configuration; host commands and desktop access remain outside its scope.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f mcp-proxy
docker compose restart mcp-proxy
```

### Optional — LAN access

For native deployment, change the supervised command to `--host 0.0.0.0 --port 3006` and restart it. For Compose, set `MCP_PROXY_BIND=0.0.0.0` in its `.env` and run `docker compose up -d`. Use the machine's actual LAN address in the extension, for example `http://192.168.1.100:3006/sse`; `0.0.0.0` is a bind address, not a destination.

Restrict port `3006` to trusted devices with your firewall. The proxy provides no frontend authentication; CORS is not access control. Do not expose it directly to the public internet or configure router port forwarding.

## 3. Add more MCP Servers

You can connect several MCP Servers at the same time. Add each one as a separate entry inside the `mcpServers` object in `config.json`. Give each entry a unique name.

### Example A — Add filesystem access

For a native installation, use an existing host directory and the actual backend executable path. This Linux example also adds Desktop Commander; adjust the paths for your system:

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

For macOS, use a path such as `/Users/alice/projects`; for Windows, use escaped JSON paths such as `C:\\projects` and the command-interpreter setup above. Desktop Commander runs in the proxy account’s environment; configure its `allowedDirectories` separately. File access restrictions do not sandbox arbitrary shell commands. With Docker, use `/workspace` instead and mount each additional host directory explicitly in `compose.yml`.

**Only grant access to folders you trust the AI tools to read or modify.** Do not give a filesystem server access to your entire drive unless you really need it.

### Example B — Add a remote MCP Server

If you already have a remote MCP Server that provides an SSE endpoint, add it with its URL:

```json
{
  "mcpServers": {
    "my-remote-server": {
      "url": "https://your-mcp-server.example.com/sse"
    }
  }
}
```

Use the URL and authentication settings supplied by that server. If it requires credentials, follow that server's instructions and keep secrets out of public repositories.

### After changing config.json

Restart the proxy using its supervisor: `systemctl --user restart mcp-proxy.service` on Linux, `launchctl kickstart -k "gui/$(id -u)/local.mcp-proxy"` on macOS, or **End** then **Run** in Windows Task Scheduler. For a foreground process, press **Ctrl+C** and start it again; for Docker, run `docker compose restart mcp-proxy`. Reconnect the extension if needed. Configuration is loaded at startup, so changes require a restart.

The tools from all configured and successfully started MCP Servers will be available through the Proxy Server.

## 4. Connect the extension to the Proxy Server

Do this after the Proxy Server is running.

1. Click the **MCP-Interceptor** icon in Chrome's toolbar.
2. In **MCP Server Endpoint**, enter:

   `http://localhost:3006/sse`

3. Set **Transport** to **SSE**.
4. Click **Grant access and connect**.
5. When Chrome asks for permission to access the server host, click **Allow**.
6. Wait for the popup to show **Connected**.

You only need to grant permission for the configured host. The extension does not need access to every website or every address on your network.

### Transport compatibility

MCP-Proxy currently exposes the traditional **SSE** transport to MCP-Interceptor. Set **Transport** to **SSE** and use `http://localhost:3006/sse`.

MCP-Proxy can connect to backend MCP Servers over stdio, SSE, and Streamable HTTP. This describes backend connectivity; it does not mean the browser-facing proxy endpoint supports Streamable HTTP or WebSocket. Do not select those output transports in the extension when using MCP-Proxy.

## 5. Use MCP tools in Gemini, DeepSeek, Grok or ChatGPT

The steps are nearly identical on each supported website.

### Step 5.1 — Open an AI chat

Open one of these websites and start a conversation:

- [Google Gemini](https://gemini.google.com/)
- [DeepSeek](https://chat.deepseek.com/)
- [Grok](https://grok.com/)
- [ChatGPT](https://chatgpt.com/)

The MCP-Interceptor sidebar should appear on the page.

### Step 5.2 — Check the connection and available tools

1. Look at **Server** near the top of the sidebar. It should show **Connected**.
2. Open **Available Tools**.
3. Expand a server to see its tools.
4. Enable the tools you want the AI to use. You can use **Enable All** or **Disable All**.

If a server or its tools are missing, check the foreground output or your supervisor’s logs (journal, LaunchAgent log files, or Windows launcher logs), then use the refresh button beside the Server status.

### Step 5.3 — Insert MCP instructions into the chat

The AI needs instructions explaining how to call the tools.

1. In the chat input area, find the small **MCP** button added by the extension.
2. Hover over the MCP button to open its quick actions.
3. Click **Insert**. The instructions will be inserted into the current chat input.
4. Send the instructions as a message before asking the AI to use MCP tools.

You can also click **Attach** in the same menu if you prefer to attach the instructions as a file and the website supports it.

The **Instructions** tab in the sidebar lets you view the generated instructions. Use **Edit** there only if you want to customize them.

### Step 5.4 — Ask the AI to use a tool

Ask for a specific action. For example:

- "Use desktop-commander to show the current working directory."
- "Use the filesystem tools to list the files in my Documents folder."
- "Use the available MCP tools to check the server status, then summarize the result."

When the model produces a supported tool call, MCP-Interceptor detects it and displays the tool name and arguments. Review them, then click **Run** to execute the tool. The result is returned to the chat so the model can continue.

### Step 5.5 — Keep automatic actions off until you are comfortable

Hover over the MCP button and open **Configure** to see the automation switches:

| Setting | What it does |
|---|---|
| **MCP** | Enables or disables MCP controls for the current chat page. |
| **Auto Insert** | Automatically inserts tool-call content into the chat input. |
| **Auto Submit** | Automatically submits the chat input after insertion. |
| **Auto Execute** | Automatically executes detected MCP tool calls. |

For your first use, leave **Auto Insert**, **Auto Submit**, and **Auto Execute** off. Review each tool call and click **Run** yourself. Turn on automation only after you trust the configured servers and understand the actions their tools can perform.

### Optional — Push Content Mode

The **Push Content Mode** switch is at the top of the sidebar. It changes the page layout to make room for the sidebar instead of letting the sidebar cover part of the page. Turn it on if the sidebar overlaps the website's content; otherwise, leave it off.

## 6. Troubleshooting

| What you see | What to check |
|---|---|
| Popup says **Disconnected** | Check the native service status (Linux: `systemctl --user status mcp-proxy.service`) and `/healthz`. For Docker, use `docker compose ps`. Verify the endpoint and select SSE. |
| Chrome does not show the permission prompt | Click **Grant access and connect** after entering the endpoint. If you changed the host, Chrome may need permission for the new host. |
| Sidebar says **Disconnected** | Check the supervisor logs (Linux: `journalctl --user -u mcp-proxy.service -f`), endpoint and SSE setting, then refresh Server. For Docker, use `docker compose logs -f mcp-proxy`. |
| Connected, but no tools appear | Check `mcpServers` and supervisor logs. Verify executable paths, PATH, credentials and `cwd` under the service account; fix errors, restart the proxy using its supervisor, and refresh tools. |
| The AI does not call a tool | Insert the MCP instructions into the current conversation. Ask for a specific tool by name and describe the task clearly. |
| Tool execution fails | Check tool arguments and supervisor logs. Verify backend commands, runtimes, credentials, directory permissions and OS privacy controls. In Docker, verify bind mounts and container paths. |
| Works in a terminal but fails as a service | Set the proxy’s PATH and required environment explicitly; services do not load shell profiles or Compose’s `.env`. Check the account, HOME, `cwd`, absolute paths and runtime availability. |
| Address already in use | Stop the old Compose container or foreground process before starting the native service; run only one instance on port `3006`. |
| Docker Desktop Commander reports `ENOENT` or `EROFS` | Check writable state/log volumes and their ownership against the current [MCP-Proxy Docker setup](https://github.com/drawdy/MCP-Proxy#docker-compose). |
| The extension UI looks stale after an extension update | Refresh the AI chat page to create a fresh extension context. |

## 7. Security recommendations

MCP tools may read or modify files, execute commands, or access external services. Treat every MCP Server as software you are choosing to trust.

- Install MCP Servers only from sources you trust.
- Start with a small set of tools and enable only what you need.
- Restrict filesystem servers to specific folders.
- Keep passwords, API keys and tokens out of public repositories. Use environment variables or the MCP Server's supported secret mechanism.
- Review tool names and arguments before clicking **Run**.
- Keep **Auto Execute** off unless you intentionally want unattended tool execution.
- Keep MCP-Proxy bound to `127.0.0.1` by default. If you use `--host 0.0.0.0` (or Compose’s `MCP_PROXY_BIND=0.0.0.0`) for LAN access, restrict port `3006` to trusted devices with your firewall. Do not expose it to the public internet or configure router port forwarding.

### Chrome Manifest V3 Content Security Policy

The extension's background service worker uses the MCP SDK's `CfWorkerJsonSchemaValidator` for structured tool-output validation. The default Ajv provider is replaced by fail-closed build aliases because Ajv's runtime code generation is incompatible with the MV3 extension CSP. Do not add `unsafe-eval` or reintroduce Ajv code generation. Extension CI runs `pnpm --filter chrome-extension test` for background/client, storage, and shared-code changes, and `pnpm scan:mv3-csp` after production builds. Tests bundle workspace sources directly and need no prebuilt package outputs.

## Supported platforms

MCP-Interceptor currently includes adapters for Gemini, DeepSeek, Grok, ChatGPT and other supported chat websites. These websites may change their interfaces at any time. If an integration stops working, [open an issue](https://github.com/drawdy/MCP-Interceptor/issues) and include the website, browser version and steps to reproduce. Do not include API keys, private URLs or other secrets.

## License

MCP-Interceptor is released under the MIT License. See [LICENSE](LICENSE).
