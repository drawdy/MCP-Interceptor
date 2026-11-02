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

MCP-Interceptor connects AI chat websites to MCP tools through a small local Proxy Server. Install the browser extension, start the Proxy Server, add the MCP Servers you want to use, and connect.

## How it works

```text
Gemini / DeepSeek / Grok / ChatGPT
              ⇅
       MCP-Interceptor
        Chrome extension
              ⇅
      Local Proxy Server
              ⇅
   Your configured MCP Servers
```

**Important:** You add MCP Servers to the Proxy Server configuration. The browser extension connects to the Proxy Server; you do not add each MCP Server separately in the extension.

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

## 2. Install and start the local Proxy Server

The Proxy Server is a separate command-line program. It connects the browser extension to local or remote MCP Servers.

### Step 2.1 — Install Node.js

1. Download and install the current **Node.js LTS** version from [nodejs.org](https://nodejs.org/).
2. Close and reopen your terminal (or PowerShell).
3. Check that Node.js and npx are available:

```bash
node -v
npm -v
npx -v
```

If each command prints a version number, continue.

### Step 2.2 — Create a configuration folder

Create a folder to keep your MCP configuration. For example:

- Windows: `C:\MCP-Interceptor`
- macOS / Linux: `~/mcp-interceptor`

Inside this folder, create a file named **config.json**.

**Windows tip:** Open the folder in File Explorer, right-click an empty area, choose **New → Text Document**, rename it to `config.json`, then open it with Notepad. Make sure Windows has not named it `config.json.txt`.

### Step 2.3 — Add your first MCP Server

Copy this example into `config.json`. It starts the Desktop Commander MCP Server:

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

Save the file.

### Step 2.4 — Start the Proxy Server

Open a terminal in the configuration folder.

**Windows / PowerShell**

1. Open the `C:\MCP-Interceptor` folder in File Explorer.
2. Click the address bar, type `powershell`, and press Enter.
3. Run:

```powershell
npx -y @srbhptl39/mcp-superassistant-proxy@latest --config .\config.json --outputTransport sse
```

**macOS / Linux**

Open a terminal and run:

```bash
cd ~/mcp-interceptor
npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport sse
```

The first run may take a few minutes because npm downloads the Proxy Server and the MCP Server package.

This command runs the Proxy Server in the foreground. Keep this terminal window open while using MCP-Interceptor. To run it without keeping a terminal window open, use the optional background commands below.

The default SSE address is:

```text
http://localhost:3006/sse
```

The Proxy Server package currently retains its upstream npm name, `@srbhptl39/mcp-superassistant-proxy`. This is expected; it is separate from the MCP-Interceptor browser extension.

### Optional — Run the Proxy Server in the background

Run the command from the directory containing `config.json`. The process writes its output to `proxy.log`.

**macOS / Linux**

```bash
nohup npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport sse > ./proxy.log 2>&1 < /dev/null & echo $! > ./proxy.pid
```

View the log with `tail -f ./proxy.log`. Stop the process with `kill "$(cat ./proxy.pid)"`, then remove the PID file with `rm -f ./proxy.pid`.

**Windows / PowerShell**

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList '/c npx -y @srbhptl39/mcp-superassistant-proxy@latest --config .\config.json --outputTransport sse > .\proxy.log 2>&1' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id
```

The command prints the background process ID. View the log with `Get-Content .\proxy.log -Wait`; stop the process tree with `taskkill /PID <PID> /T /F`.

### Optional — Allow access from other devices on your LAN

The Proxy Server binds to `localhost` by default, so only applications on the same computer can connect. The proxy package supports the `--host` option. Set it to `0.0.0.0` to listen on all IPv4 network interfaces:

```bash
npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport sse --host 0.0.0.0 --port 3006 --healthEndpoint /healthz
```

Then configure the extension with the Proxy Server machine's actual LAN IP, for example:

```text
http://192.168.1.100:3006/sse
```

Replace `192.168.1.100` with the machine's LAN address. **Do not use `0.0.0.0` in the extension endpoint** — it is a bind address, not a destination address. When Chrome prompts for access to the new host, grant permission.

The optional `--healthEndpoint /healthz` flag adds a simple health check. From another LAN device, verify reachability with:

```bash
curl http://192.168.1.100:3006/healthz
```

A successful response is `ok`. The health endpoint is available only when you start the proxy with the flag.

**Security:** Binding to `0.0.0.0` exposes the listener on every IPv4 interface, not just your private LAN. Allow TCP port `3006` only from trusted LAN devices in your host firewall. Do not expose this service directly to the public internet or configure router port forwarding. The proxy's default CORS policy allows all origins; CORS is not authentication or network access control.

### Optional — Run as a Linux systemd service

For an always-on Linux host, systemd is more reliable than keeping a terminal open or using `nohup`: it starts the proxy at boot, restarts it after failures, and collects logs in the journal.

Install the package in a stable directory owned by a dedicated service account. For example:

```bash
sudo useradd --system --user-group --create-home --home-dir /opt/mcp-superassistant --shell /usr/sbin/nologin mcp-proxy
sudo -u mcp-proxy npm install --prefix /opt/mcp-superassistant @srbhptl39/mcp-superassistant-proxy
```

Place your `config.json` at `/opt/mcp-superassistant/config.json`, then set its ownership:

```bash
sudo chown mcp-proxy:mcp-proxy /opt/mcp-superassistant/config.json
sudo chmod 600 /opt/mcp-superassistant/config.json
```

Create `/etc/systemd/system/mcp-superassistant-proxy.service`:

```ini
[Unit]
Description=MCP SuperAssistant Proxy
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=mcp-proxy
Group=mcp-proxy
WorkingDirectory=/opt/mcp-superassistant
Environment=HOME=/opt/mcp-superassistant
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production
UMask=0077
ExecStart=/opt/mcp-superassistant/node_modules/.bin/mcp-superassistant-proxy --config /opt/mcp-superassistant/config.json --outputTransport sse --host 0.0.0.0 --port 3006 --healthEndpoint /healthz
Restart=always
RestartSec=5
KillMode=control-group
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mcp-superassistant-proxy
sudo systemctl status mcp-superassistant-proxy
```

Follow its logs with `journalctl -u mcp-superassistant-proxy -f`; restart it after changing `config.json` with `sudo systemctl restart mcp-superassistant-proxy`. If Node.js is installed outside the system PATH, add its absolute directory to the unit's `PATH`.


## 3. Add more MCP Servers

You can connect several MCP Servers at the same time. Add each one as a separate entry inside the `mcpServers` object in `config.json`. Give each entry a unique name.

### Example A — Add filesystem access

The following example adds a filesystem MCP Server that can access one folder:

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

Replace `C:/Users/YourName/Documents` with the folder you want to make available. On Windows, use forward slashes in the JSON path.

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

1. Return to the terminal running the Proxy Server.
2. Press **Ctrl+C** to stop it.
3. Run the Proxy Server start command again.
4. Reconnect from the MCP-Interceptor extension if it does not reconnect automatically.

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

### Other transport options

SSE is recommended for the first setup. If you intentionally start the Proxy Server with a different output transport, use the matching setting:

| Proxy Server start option | Extension transport | Endpoint |
|---|---|---|
| `--outputTransport sse` | SSE | `http://localhost:3006/sse` |
| `--outputTransport streamableHttp` | Streamable HTTP | `http://localhost:3006` |
| `--outputTransport ws` | WebSocket | `ws://localhost:3006/message` |

For example, to start the Proxy Server with Streamable HTTP, use:

```bash
npx -y @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json --outputTransport streamableHttp
```

The extension transport and Proxy Server output transport must match.

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

If a server or its tools are missing, check the foreground terminal or `proxy.log` if the Proxy Server is running in the background, then use the refresh button beside the Server status.

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
| Popup says **Disconnected** | Make sure the Proxy Server terminal is still running. Check the endpoint and transport in the popup. |
| Chrome does not show the permission prompt | Click **Grant access and connect** after entering the endpoint. If you changed the host, Chrome may need permission for the new host. |
| Sidebar says **Disconnected** | Check the foreground terminal, `proxy.log`, or `journalctl -u mcp-superassistant-proxy -f` for a systemd service. Confirm the extension endpoint is correct, then click the refresh icon beside Server. |
| Connected, but no tools appear | Check that `config.json` contains the server under `mcpServers`. Look for startup errors in the Proxy Server terminal, then restart the Proxy Server and refresh the tools. |
| The AI does not call a tool | Insert the MCP instructions into the current conversation. Ask for a specific tool by name and describe the task clearly. |
| Tool execution fails | Check the tool arguments and the Proxy Server terminal output. Verify the MCP Server command, arguments, credentials and filesystem permissions. |
| The extension UI looks stale after an extension update | Refresh the AI chat page to create a fresh extension context. |

## 7. Security recommendations

MCP tools may read or modify files, execute commands, or access external services. Treat every MCP Server as software you are choosing to trust.

- Install MCP Servers only from sources you trust.
- Start with a small set of tools and enable only what you need.
- Restrict filesystem servers to specific folders.
- Keep passwords, API keys and tokens out of public repositories. Use environment variables or the MCP Server's supported secret mechanism.
- Review tool names and arguments before clicking **Run**.
- Keep **Auto Execute** off unless you intentionally want unattended tool execution.
- Keep the Proxy Server on the local machine by default. If you expose it to the LAN with `0.0.0.0` or a reverse proxy, restrict access to trusted devices with your firewall. Do not expose it to the public internet or configure router port forwarding.

## Supported platforms

MCP-Interceptor currently includes adapters for Gemini, DeepSeek, Grok, ChatGPT and other supported chat websites. These websites may change their interfaces at any time. If an integration stops working, [open an issue](https://github.com/drawdy/MCP-Interceptor/issues) and include the website, browser version and steps to reproduce. Do not include API keys, private URLs or other secrets.

## License

MCP-Interceptor is released under the MIT License. See [LICENSE](LICENSE).