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

MCP-Interceptor is an independent browser extension that connects user-configured MCP servers to supported AI chat websites, allowing users to invoke MCP tools and use their results directly in familiar AI conversations. The guide below uses [MCP-Proxy](https://github.com/drawdy/MCP-Proxy), an optional user-operated Go proxy; any compatible MCP endpoint can be configured. No maintainer-hosted service is required.

## Privacy and first use

Open the toolbar popup, read the disclosure and [privacy policy](PRIVACY.md), then
click **I agree — enable page-content processing**. Until then, including after
upgrading from a version without consent, page monitoring and tool recognition
remain off. Agreement is stored locally and required again after material policy
changes. Server host permission is a separate grant. No MCP server is contacted
until you configure it and grant access. Per-site switches control enabled websites.

Revoke consent or clear extension data in the popup. Revocation reloads initialized
chat pages and may discard unsent input. Local execution records contain conversation
URLs, tool/server names and optional text results (up to 100 per URL). Chrome extension
storage and AI-site localStorage have separate clearing procedures; see the policy.
No telemetry, analytics or remote configuration is included.

[Chrome Web Store release guide](docs/CHROME_WEB_STORE_RELEASE.md) ·
[Release acceptance checklist](docs/chrome-web-store/RELEASE_CHECKLIST.md)

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

**For this guide:** configure backend MCP Servers in MCP-Proxy and enter its endpoint in the extension. You may instead connect another compatible server directly.

<details>
<summary>Optional: image previews and attachments</summary>

MCP tools that return supported raster images (PNG, JPEG, GIF, WebP, AVIF or BMP) are previewed in the result panel. Click **Attach Images** to add them to the current chat together with their text context. Image results are not automatically inserted or submitted. Per result, the extension accepts up to 8 images, 10 MiB per image and 20 MiB total; SVG is intentionally not accepted.

Attachment availability depends on the website adapter and the current page. Unsupported pages show a notice. If an attachment fails, retry keeps confirmed images and does not insert the text context twice. ChatGPT's MCP button appears beside the upload control in the active composer, including after switching between the home page and a conversation.

</details>

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
>
> **Loading the extension does not grant access to your proxy. Before the first connection, complete the host authorization in section 4. Without it, even a healthy proxy cannot be connected by this extension.**

## 2. Install and start MCP-Proxy

Download a ready-to-run binary from [MCP-Proxy Releases](https://github.com/drawdy/MCP-Proxy/releases/latest). **No Go installation, source checkout, or build is required for the Linux and Windows packages.** Run it as your ordinary user so local tools use that user's files, commands, and permissions.

The examples below use the published **v0.1.0** assets. When upgrading, choose a release and use its matching binary and `SHA256SUMS` together. These files are standalone executables, not ZIP/tar archives.

| Platform | Release asset |
|---|---|
| Linux x86-64 (`uname -m`: `x86_64`) | [`mcp-proxy-v0.1.0-linux-amd64`](https://github.com/drawdy/MCP-Proxy/releases/download/v0.1.0/mcp-proxy-v0.1.0-linux-amd64) |
| Linux ARM64 (`uname -m`: `aarch64` / `arm64`) | [`mcp-proxy-v0.1.0-linux-arm64`](https://github.com/drawdy/MCP-Proxy/releases/download/v0.1.0/mcp-proxy-v0.1.0-linux-arm64) |
| Windows x64 | [`mcp-proxy-v0.1.0-windows-amd64.exe`](https://github.com/drawdy/MCP-Proxy/releases/download/v0.1.0/mcp-proxy-v0.1.0-windows-amd64.exe) |

The proxy binary does not include backend runtimes. For the `npx` examples below, install Node.js **24 or newer** with npm on the same host. Other backends may require Python, uv, or their own runtime. First use of an npm package requires network access; keep tested versions pinned and warm the cache as the service user before relying on automatic startup.

### Linux: install and configure

1. Download and verify the binary. Choose the architecture from the table; the commands default to amd64. Continue only if checksum verification succeeds.

```bash
mkdir -p "$HOME/.local/share/mcp-proxy/bin" "$HOME/.local/share/mcp-proxy/workspace"
cd "$HOME/.local/share/mcp-proxy"
(
  set -eu
  version=v0.1.0
  arch=amd64 # Use arm64 for Linux ARM64.
  asset="mcp-proxy-${version}-linux-${arch}"
  base="https://github.com/drawdy/MCP-Proxy/releases/download/${version}"
  curl -fL "$base/$asset" -o "$asset"
  curl -fL "$base/SHA256SUMS" -o SHA256SUMS
  awk -v name="$asset" '$2 == name { print }' SHA256SUMS | sha256sum -c -
  install -m 755 "$asset" ./bin/mcp-proxy
)
```

2. Save `config.json` in `~/.local/share/mcp-proxy/`. The following example enables Desktop Commander and filesystem. Replace `/home/alice` with your real home directory and create the project directory first. If you already have a configuration, preserve its server entries, arguments, and credentials rather than overwriting it.

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander@0.3.1"],
      "cwd": "/home/alice/.local/share/mcp-proxy/workspace"
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem@2.1.0", "/home/alice/projects"],
      "cwd": "/home/alice/projects"
    }
  }
}
```

`cwd` is the backend's initial working directory. Use an existing absolute path accessible to your user; it does not restrict file access. The filesystem directory in `args` controls that server's allowed roots. `command: "npx"` is resolved through the proxy's PATH, without binding to an npm package's installation directory.

3. Verify in the foreground:

```bash
cd "$HOME/.local/share/mcp-proxy"
command -v node npx
./bin/mcp-proxy --config ./config.json --host 127.0.0.1 --port 3006
```

In another terminal, run `curl -f http://127.0.0.1:3006/healthz` and `curl -f http://127.0.0.1:3006/readyz`. Check that **every expected backend** is connected in the logs; `/readyz` can succeed with only one backend connected. Follow section 4 to authorize Chrome and check the tool list and an actual tool call. Press **Ctrl+C** before enabling the service.

### Linux: run as a systemd user service

Create the parent directory with `mkdir -p ~/.config/systemd/user`, then save this as `~/.config/systemd/user/mcp-proxy.service`:

```ini
[Unit]
Description=mcp-proxy

[Service]
Type=simple
WorkingDirectory=%h/.local/share/mcp-proxy
ExecStart="%h/.local/share/mcp-proxy/bin/mcp-proxy" --config "%h/.local/share/mcp-proxy/config.json" --host 127.0.0.1 --port 3006
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

**Adjust PATH before starting.** Use `command -v node npx` to find the actual executable directories. For nvm, include a literal path such as `/home/alice/.nvm/versions/node/v24.21.0/bin`; services do not load your shell profile. Also include any Python/uv or other executable directories your backends need. An absolute `npx` path still needs PATH to find `node`.

```bash
systemd-analyze --user verify ~/.config/systemd/user/mcp-proxy.service
systemctl --user daemon-reload
systemctl --user enable --now mcp-proxy.service
systemctl --user status mcp-proxy.service
journalctl --user -u mcp-proxy.service -f
```

The unit name is **`mcp-proxy.service`**, and this is a **user service**: run `systemctl --user` as the same ordinary user, without `sudo`. `sudo systemctl --user` targets another user's manager. Over SSH, use that user's normal login session; for `Failed to connect to bus`, check the user manager and `/run/user/$(id -u)/bus`.

After editing `config.json` or the environment file, run `systemctl --user restart mcp-proxy.service`. After editing the unit, run `systemctl --user daemon-reload` first. Stop with `systemctl --user stop mcp-proxy.service`; disable automatic startup with `systemctl --user disable --now mcp-proxy.service`. Proxy and backend logs go to the user journal.

### Windows x64: install and configure

1. In PowerShell, download and verify the binary:

```powershell
$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'mcp-proxy'
New-Item -ItemType Directory -Force "$installDir\bin", "$installDir\workspace" | Out-Null
Set-Location $installDir
$version = 'v0.1.0'
$asset = "mcp-proxy-$version-windows-amd64.exe"
$base = "https://github.com/drawdy/MCP-Proxy/releases/download/$version"
Invoke-WebRequest "$base/$asset" -OutFile $asset
Invoke-WebRequest "$base/SHA256SUMS" -OutFile SHA256SUMS
$line = Get-Content SHA256SUMS | Where-Object { $_ -match ('\s+\*?' + [regex]::Escape($asset) + '$') }
if (-not $line) { throw 'Missing checksum for this asset.' }
$expected = ($line -split '\s+')[0]
if ((Get-FileHash $asset -Algorithm SHA256).Hash -ne $expected) { throw 'SHA-256 mismatch.' }
Move-Item $asset .\bin\mcp-proxy.exe -Force
Get-Command node, npx.cmd
```

2. Save `config.json` in `%LOCALAPPDATA%\mcp-proxy`. Create `C:\projects` first, or replace it with an existing directory you want the tools to use. This example avoids spaces in the project path; paths with spaces in the command string need additional Windows command-line quoting.

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "C:\\Windows\\System32\\cmd.exe",
      "args": ["/d", "/s", "/c", "npx -y @wonderwhy-er/desktop-commander@0.3.1"],
      "cwd": "C:\\projects"
    },
    "filesystem": {
      "command": "C:\\Windows\\System32\\cmd.exe",
      "args": ["/d", "/s", "/c", "npx -y @modelcontextprotocol/server-filesystem@2.1.0 C:\\projects"],
      "cwd": "C:\\projects"
    }
  }
}
```

Windows npm installs `npx.cmd`, so the backend is launched through `cmd.exe /d /s /c`. JSON paths use doubled backslashes. Ensure the proxy's PATH contains Node.js/npm; adjust the `cmd.exe` location if Windows is installed elsewhere. Keep your existing backend entries and credentials when migrating.

3. Verify in PowerShell:

```powershell
Set-Location (Join-Path $env:LOCALAPPDATA 'mcp-proxy')
.\bin\mcp-proxy.exe --config .\config.json --host 127.0.0.1 --port 3006
```

In another PowerShell window, run `Invoke-RestMethod http://127.0.0.1:3006/healthz` and `Invoke-RestMethod http://127.0.0.1:3006/readyz`. Check every backend in the foreground output, then authorize Chrome as described in section 4 and verify tools. Press **Ctrl+C** before starting the scheduled task.

### Windows: start automatically with Task Scheduler

Create a task named **mcp-proxy**:

1. Use your current user, **Run only when user is logged on**, without **Run with highest privileges**; trigger **At log on** for that user.
2. Resolve the installation directory with `Join-Path $env:LOCALAPPDATA 'mcp-proxy'`. In the task action, use the resulting **absolute paths**, for example:
   - **Program/script:** `C:\Users\Alice\AppData\Local\mcp-proxy\bin\mcp-proxy.exe`
   - **Arguments:** `--config "C:\Users\Alice\AppData\Local\mcp-proxy\config.json" --host 127.0.0.1 --port 3006`
   - **Start in:** `C:\Users\Alice\AppData\Local\mcp-proxy`
3. Enable restart on failure, select **Do not start a new instance**, disable the execution time limit, and adjust battery conditions if needed.
4. Run the task and check health and the extension's tools. After changing `config.json`, use **End**, then **Run**; **Disable** removes automatic startup.

Set required user environment variables before launching the task. After changing PATH, sign out and back in so the scheduler uses the new environment. For file logs, use a launcher that runs the proxy synchronously with stdout/stderr redirected to protected, rotated files; do not detach it with `Start-Process`. Ending a task can be abrupt, so check for leftover backend processes before restarting. The binary is not a Windows Service executable; do not register it directly with `sc.exe`.

<details>
<summary>Optional: environment variables and operation after logout</summary>

Backend processes inherit the proxy environment and can override it through `env`. `${API_TOKEN}` is expanded from the proxy environment when configuration loads. The native proxy does not load Compose's `.env`, `MCP_PROXY_BIND`, or `MCP_PROXY_PORT`; set environment variables through the supervisor and use `--host` / `--port` for listening. Go starts commands directly: aliases, `~`, and shell syntax are not expanded. Backend `env.PATH` does not control Go's lookup of the initial command.

The optional `~/.config/mcp-proxy/env` uses `KEY=value` entries without `export`; create the parent directory and restrict the file with `chmod 600`. Keep secrets out of Git.

For startup at boot and operation after logout, run `loginctl enable-linger "$USER"` (administrator authorization may be required) and confirm `Linger=yes` with `loginctl show-user "$USER" -p Linger`. This does not unlock a keyring or create a graphical session. See [systemd environment configuration](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html) and [lingering](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html).

</details>

<details>
<summary>macOS: availability and launchd LaunchAgent</summary>

There is currently no macOS binary in the v0.1.0 release. Build from source using the optional instructions below, or wait for a matching published binary. Then configure a LaunchAgent:

Create `~/Library/LaunchAgents/local.mcp-proxy.plist` and the log directory `~/Library/Logs/MCP-Proxy`. Replace **every** `/Users/alice` path below and adjust PATH for your Node.js installation. Plist strings do not expand `~` or `$HOME`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>local.mcp-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/alice/.local/share/mcp-proxy/bin/mcp-proxy</string>
    <string>--config</string><string>/Users/alice/.local/share/mcp-proxy/config.json</string>
    <string>--host</string><string>127.0.0.1</string>
    <string>--port</string><string>3006</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/alice/.local/share/mcp-proxy</string>
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

</details>

<details>
<summary>WSL2: use the intended Linux distribution</summary>

If your tools need Linux projects and Linux commands, install the matching Linux release binary and run MCP-Proxy inside that WSL distribution using the Linux instructions, with [systemd enabled](https://learn.microsoft.com/en-us/windows/wsl/systemd). Use Linux paths such as `/home/alice/projects` (or `/mnt/c/projects` for mounted Windows files). This gives access to that distribution, not an equivalent Windows desktop session. For Windows applications and Windows toolchains, prefer a Windows-native proxy. A lingering user service does not start the distribution at Windows boot or keep it alive indefinitely; handle Windows-side WSL startup separately if required, and verify connectivity from the browser before changing network bindings.

</details>

<details>
<summary>Optional: migrate from Docker Compose or upgrade</summary>

1. Record the original Compose project name, every `-f` configuration file, the bind address and port, backend names, and the complete tool list. Inspect `docker compose ... config` using the actual deployment command and inspect the container with `docker inspect` to identify overrides, host networking, bind mounts, volumes, and environment variables. These outputs may contain secrets; do not paste them into public logs. Do not infer the deployed configuration from the repository's default `compose.yml` alone.
2. Back up `config.json`, `.env`, Compose files, the old image ID, and any backend state you need. Keep the original configuration for rollback and edit host paths in a separate candidate configuration. Container HOME, npm cache, and Desktop Commander history/configuration live separately from your host account; migrate needed state deliberately and review paths, permissions, and secrets. For state already persisted through bind mounts, the native service can use the corresponding host directory. For example, replace a container's `XDG_DATA_HOME=/var/lib/mcp-proxy` with the real host path of that mount to continue backend audit logs.
3. Before stopping the old service, install host runtimes, download and verify the release binary, and validate the unit. Replace container paths such as `/workspace` and `/opt/...` with real host paths, preserving the existing `mcpServers` entries, authentication settings, and backend arguments. If copying a Node.js backend directory, include its runtime dependencies and verify native modules against the host's Node.js version and CPU architecture; copying only the entry-point JS file is insufficient. Transfer required environment variables into the supervisor configuration. Native processes do not read Compose's `.env`, `MCP_PROXY_BIND`, or `MCP_PROXY_PORT`; use `--host` and `--port`.
4. Test the native binary with the candidate configuration on a temporary loopback port, for example `127.0.0.1:3007`. Check every backend and the complete tool list, and make actual calls to tools without side effects; a successful `/readyz` does not mean every backend has recovered. During parallel validation, use separate directories for writable state such as logs and audit records. If a backend does not support multiple instances, validate sequentially during a maintenance window. Stop the temporary instance when done.
5. Using the original project name and every `-f` argument, run `docker compose ... stop mcp-proxy`. Confirm the production port is free, then switch to the candidate configuration and start the supervised service. Keep the stopped container and volumes for rollback; if using `down`, **do not add `-v`**. Run only one instance on the port. Keep the original endpoint (locally, `http://localhost:3006/sse`; for a remote browser, use the server's actual address), reconnect the extension, check the tool list and actual calls, and verify service restart and automatic startup.
6. To roll back, stop and disable the native service, restore the configuration and environment used by the original Compose deployment, then run `docker compose ... up -d --no-build` with the original project name and every `-f` argument. Do not pass the candidate's host paths directly to the old container. Check the tool list and actual calls after rollback too. Clean up old containers and backups only after the migration is stable.

For upgrades, stop the native service, back up the binary and configuration, download and verify the chosen release binary, replace the executable, and start and verify the service. Keep the previous binary/configuration for rollback.

</details>

<details>
<summary>Optional: Docker Compose for isolated tools</summary>

If container isolation fits your workload, follow the [MCP-Proxy Docker instructions](https://github.com/drawdy/MCP-Proxy#docker-compose). The supplied Compose setup mounts `./workspace` as `/workspace`, provides Node.js and persistent npm/Desktop Commander volumes, and publishes `127.0.0.1:3006` by default. Host runtimes are unnecessary for container backends. Use container paths in that configuration; host commands and desktop access remain outside its scope.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f mcp-proxy
docker compose restart mcp-proxy
```

Container tools use container paths, runtimes, HOME, and credentials; `localhost` refers to the container. Bind mounts and host networking do not give tools the host shell or desktop session. Use Docker when that isolation is intended; do not bypass it with privileged mode or the Docker socket.

</details>

<details>
<summary>Optional: LAN access</summary>

For native deployment, change the supervised command to `--host 0.0.0.0 --port 3006` and restart it. For Compose, set `MCP_PROXY_BIND=0.0.0.0` in its `.env` and run `docker compose up -d`. Use the machine's actual LAN address in the extension, for example `http://192.168.1.100:3006/sse`; `0.0.0.0` is a bind address, not a destination.

Restrict port `3006` to trusted devices with your firewall. The proxy provides no frontend authentication; CORS is not access control. Do not expose it directly to the public internet or configure router port forwarding.

</details>

<details>
<summary>Optional: build from source for other platforms or development</summary>

Use this only when no release asset matches your platform or you are developing MCP-Proxy. Install the Go version required by its `go.mod` (v0.1.0 requires Go 1.26.8 or newer).

```bash
git clone --branch v0.1.0 https://github.com/drawdy/MCP-Proxy.git
cd MCP-Proxy
mkdir -p "$HOME/.local/share/mcp-proxy/bin"
go build -trimpath -o "$HOME/.local/share/mcp-proxy/bin/mcp-proxy" ./cmd/mcp-proxy
```

For macOS, also create `~/.local/share/mcp-proxy/workspace` and configure `~/.local/share/mcp-proxy/config.json` with macOS paths before using the LaunchAgent above.

</details>

## 3. Add more MCP Servers

You can connect several MCP Servers at the same time. Add each one as a separate entry inside the `mcpServers` object in `config.json`. Give each entry a unique name.

<details>
<summary>Optional: examples for additional local and remote MCP Servers</summary>

### Example A — Add filesystem access

For a native installation, use an existing host directory and the actual backend executable path. This Linux example also adds Desktop Commander; adjust the paths for your system:

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander@0.3.1"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem@2.1.0",
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

</details>

### After changing config.json

Restart the proxy using its supervisor: `systemctl --user restart mcp-proxy.service` on Linux, `launchctl kickstart -k "gui/$(id -u)/local.mcp-proxy"` on macOS, or **End** then **Run** in Windows Task Scheduler. For a foreground process, press **Ctrl+C** and start it again; for Docker, run `docker compose restart mcp-proxy`. Reconnect the extension if needed. Configuration is loaded at startup, so changes require a restart.

The tools from all configured and successfully started MCP Servers will be available through the Proxy Server.

## 4. Connect the extension to the Proxy Server

**Chrome host authorization is required for the first connection.** Installing/loading the extension or opening the chat sidebar does not grant access to the Proxy Server.

1. Confirm `http://127.0.0.1:3006/healthz` responds on the proxy machine.
2. Click the **MCP-Interceptor toolbar icon** (pin it from Chrome's Extensions menu if hidden). This opens the configuration and authorization page shown by the extension.
3. Enter `http://localhost:3006/sse` in **MCP Server Endpoint** and select **SSE** for **Transport**.
4. Check **Chrome permission scope**, then click **Grant access and connect**. This click is required to request access; merely entering the URL or refreshing the sidebar is insufficient.
5. If Chrome displays a host-access confirmation, choose **Allow**. If access was already granted, Chrome may skip the prompt.
6. Wait for **Connected**, then return to the AI chat and refresh the sidebar's server/tool list if needed.

**If access was denied or is missing:** reopen the toolbar page and click **Grant access and connect** again. If Chrome's extension settings restrict site access, open `chrome://extensions/` → MCP-Interceptor → **Details**, review the site-access settings for the configured proxy host, and retry. A reachable `/healthz` only proves the proxy is running; it does not grant the extension permission.

Access is scoped to the configured scheme and host, across all ports (as shown by `localhost (all ports)`), rather than to `/sse` or port 3006 alone. `localhost`, `127.0.0.1`, and a LAN address are different hosts; changing host or HTTP/HTTPS may require another authorization. Chrome can reuse an existing grant while it remains valid; reauthorize if you revoke access or the extension is reinstalled.

<details>
<summary>Why is the authorization button needed?</summary>

This version requests optional host access only for the server you configure. [Chrome requires runtime permission requests to follow a user gesture](https://developer.chrome.com/docs/extensions/reference/api/permissions#step_3_request_optional_permissions), so the extension cannot silently grant itself access to an arbitrary new server. Removing the button alone would leave new hosts inaccessible. A different design could declare fixed hosts or broader required permissions up front, changing what access is requested during installation; the current version retains per-host authorization.

</details>

<details>
<summary>Transport compatibility</summary>

MCP-Proxy currently exposes the traditional **SSE** transport to MCP-Interceptor. Set **Transport** to **SSE** and use `http://localhost:3006/sse`.

MCP-Proxy can connect to backend MCP Servers over stdio, SSE, and Streamable HTTP. This describes backend connectivity; it does not mean the browser-facing proxy endpoint supports Streamable HTTP or WebSocket. Do not select those output transports in the extension when using MCP-Proxy.

</details>

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

<details>
<summary>Optional: Push Content Mode</summary>

The **Push Content Mode** switch is at the top of the sidebar. It changes the page layout to make room for the sidebar instead of letting the sidebar cover part of the page. Turn it on if the sidebar overlaps the website's content; otherwise, leave it off.

</details>

## 6. Troubleshooting

| What you see | What to check |
|---|---|
| Popup says **Disconnected** | Check the native service status (Linux: `systemctl --user status mcp-proxy.service`) and `/healthz`. For Docker, use `docker compose ps`. Verify the endpoint and select SSE. |
| Host access is missing / permission was denied | Open the toolbar icon → enter the endpoint → **Grant access and connect** → **Allow** if prompted. Check Chrome extension site-access settings if restricted. A healthy proxy alone is insufficient. |
| Chrome does not show the permission prompt | If access is already granted, no new prompt is needed. Check the connection status; a new host or scheme may require authorization again. |
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

<details>
<summary>For developers: Chrome Manifest V3 Content Security Policy</summary>

The extension's background service worker uses the MCP SDK's `CfWorkerJsonSchemaValidator` for structured tool-output validation. The default Ajv provider is replaced by fail-closed build aliases because Ajv's runtime code generation is incompatible with the MV3 extension CSP. Do not add `unsafe-eval` or reintroduce Ajv code generation. Extension CI runs `pnpm --filter chrome-extension test` for background/client, storage, and shared-code changes, and `pnpm scan:mv3-csp` after production builds. Tests bundle workspace sources directly and need no prebuilt package outputs.

</details>

## Supported platforms

MCP-Interceptor currently includes adapters for Gemini, DeepSeek, Grok, ChatGPT and other supported chat websites. These websites may change their interfaces at any time. If an integration stops working, [open an issue](https://github.com/drawdy/MCP-Interceptor/issues) and include the website, browser version and steps to reproduce. Do not include API keys, private URLs or other secrets.

## License

Original MCP-Interceptor contributions are copyright © 2026 drawdy and contributors, under the [MIT License](LICENSE). Inherited and modified third-party portions retain their original ownership and MIT terms in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Product independence does not remove third-party attribution. Production packages include both notices and a generated dependency license inventory.
