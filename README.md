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

MCP-Interceptor uses [MCP-Proxy](https://github.com/drawdy/MCP-Proxy), a standalone Go service that aggregates local and remote MCP Servers and exposes them to the browser extension through the traditional SSE transport.

**MCP-Proxy replaces the previous Node.js-based Proxy Server. Use the Go-based MCP-Proxy for all new installations.**

### Step 2.1 — Install Docker

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows or macOS, or Docker Engine with the Docker Compose plugin on Linux. Make sure Docker is running:

```bash
docker --version
docker compose version
```

You do not need to install Go or Node.js on the host when using Docker Compose. The MCP-Proxy image contains the Go proxy and a Node.js runtime for MCP backends launched with `npx`.

### Step 2.2 — Download MCP-Proxy

Clone the MCP-Proxy repository. Keep this directory on your computer; it contains the Compose file and your local configuration.

**Windows / PowerShell**

```powershell
git clone https://github.com/drawdy/MCP-Proxy.git
cd MCP-Proxy
Copy-Item config.example.json config.json
New-Item -ItemType Directory -Force workspace
notepad config.json
```

**macOS / Linux**

```bash
git clone https://github.com/drawdy/MCP-Proxy.git
cd MCP-Proxy
cp config.example.json config.json
mkdir -p workspace
vi config.json
```

### Step 2.3 — Configure your MCP Servers

Add each MCP Server under the `mcpServers` object in `config.json`. The example configuration already includes a filesystem server that can access the mounted `/workspace` directory. You can add another backend, for example Desktop Commander:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    },
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander@latest"]
    }
  }
}
```

The `npx` commands run inside the MCP-Proxy container. You do not need Node.js installed on your host. The container includes Node.js and keeps its npm cache in a Docker volume. Compose also provides dedicated writable volumes for Desktop Commander's configuration/history and log directories. They are required because the container root filesystem is read-only and persist across container recreation. Desktop Commander records tool arguments and recent result previews, so treat these volumes as sensitive data. It runs inside the container and cannot access the WSL host filesystem by default. To expose a host project, add a narrowly scoped bind mount in `compose.yml` and add its container path to Desktop Commander's `allowedDirectories`.

Put files you want to expose in the `workspace` directory inside the cloned MCP-Proxy repository. If a backend needs credentials, place the environment variables in a `.env` file beside `compose.yml`, then reference them in `config.json`, for example `"${API_TOKEN}"`. Do not commit `.env` or secrets to source control.

### Step 2.4 — Start MCP-Proxy

Run these commands from the cloned `MCP-Proxy` directory:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f mcp-proxy
```

The container runs in the background and restarts automatically unless stopped. The default endpoint is:

```text
http://localhost:3006/sse
```

To stop MCP-Proxy:

```bash
docker compose down
```

After editing `config.json`, restart the service so it reloads the configuration:

```bash
docker compose restart mcp-proxy
```

### Optional — Allow access from other devices on your LAN

By default, Compose publishes the service only on host loopback (`127.0.0.1:3006`). To allow other trusted devices on your LAN to connect, create or edit `.env` in the MCP-Proxy directory:

```dotenv
MCP_PROXY_BIND=0.0.0.0
MCP_PROXY_PORT=3006
```

Then apply the setting:

```bash
docker compose up -d
```

In MCP-Interceptor, use the MCP-Proxy machine's actual LAN IP, for example `http://192.168.1.100:3006/sse`. Replace the example address with the machine's real LAN IP and grant Chrome permission when prompted. **Do not use `0.0.0.0` as the extension endpoint**; it is a bind address, not a destination address.

Binding to `0.0.0.0` publishes the service on all host network interfaces. Restrict TCP port `3006` to trusted LAN devices with your firewall. Do not expose MCP-Proxy directly to the public internet or configure router port forwarding. CORS is not authentication or network access control.

### Alternative — Run MCP-Proxy without Docker

If you prefer a native process, install Go 1.26.8 or newer and Node.js if any configured backend uses `npx`. Clone the repository, create `config.json` as shown above, then run:

```bash
go run ./cmd/mcp-proxy --config ./config.json --host 127.0.0.1 --port 3006
```

The extension endpoint remains `http://localhost:3006/sse`. See the [MCP-Proxy README](https://github.com/drawdy/MCP-Proxy) for build, configuration and development details.

## 3. Add more MCP Servers

You can connect several MCP Servers at the same time. Add each one as a separate entry inside the `mcpServers` object in `config.json`. Give each entry a unique name.

### Example A — Add filesystem access

The Compose setup mounts the local `workspace` directory into the container at `/workspace`. Configure the filesystem MCP Server to use that container path:

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander@latest"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/workspace"
      ]
    }
  }
}
```

Put the files you want to make available in the `workspace` directory inside the cloned MCP-Proxy repository. The path in `config.json` is the container path, not a Windows host path. To expose another host directory, add an additional volume mapping in `compose.yml`.

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
| Popup says **Disconnected** | Check that the MCP-Proxy container is running with `docker compose ps`. Verify the endpoint and make sure Transport is set to SSE. |
| Chrome does not show the permission prompt | Click **Grant access and connect** after entering the endpoint. If you changed the host, Chrome may need permission for the new host. |
| Sidebar says **Disconnected** | From the MCP-Proxy directory, run `docker compose logs -f mcp-proxy`. Confirm the extension endpoint is correct and Transport is SSE, then click the refresh icon beside Server. |
| Connected, but no tools appear | Check that `config.json` contains the server under `mcpServers`. Review `docker compose logs mcp-proxy`, fix any backend errors, then run `docker compose restart mcp-proxy` and refresh the tools. |
| The AI does not call a tool | Insert the MCP instructions into the current conversation. Ask for a specific tool by name and describe the task clearly. |
| Tool execution fails | Check the tool arguments and `docker compose logs mcp-proxy`. Verify the backend MCP Server command, arguments, credentials and filesystem permissions. |
| Desktop Commander exits with `ENOENT` or `EROFS` under `/home/mcp/.claude-server-commander` | From the MCP-Proxy directory, run `git pull`, then `docker compose up -d --build` to rebuild the image. If it still fails, run `docker compose exec mcp-proxy sh -c 'id; printf "HOME=%s\\n" "$HOME"; ls -ld "$HOME" "$HOME/.claude-server-commander" "$HOME/.claude-server-commander-logs"'` to inspect HOME, directory existence and permissions. |
| The extension UI looks stale after an extension update | Refresh the AI chat page to create a fresh extension context. |

## 7. Security recommendations

MCP tools may read or modify files, execute commands, or access external services. Treat every MCP Server as software you are choosing to trust.

- Install MCP Servers only from sources you trust.
- Start with a small set of tools and enable only what you need.
- Restrict filesystem servers to specific folders.
- Keep passwords, API keys and tokens out of public repositories. Use environment variables or the MCP Server's supported secret mechanism.
- Review tool names and arguments before clicking **Run**.
- Keep **Auto Execute** off unless you intentionally want unattended tool execution.
- Keep MCP-Proxy bound to `127.0.0.1` by default. If you set `MCP_PROXY_BIND=0.0.0.0` to allow LAN access, restrict port `3006` to trusted devices with your firewall. Do not expose it to the public internet or configure router port forwarding.

### Chrome Manifest V3 Content Security Policy

The extension's background service worker uses the MCP SDK's `CfWorkerJsonSchemaValidator` for structured tool-output validation. The default Ajv provider is replaced by fail-closed build aliases because Ajv's runtime code generation is incompatible with the MV3 extension CSP. Do not add `unsafe-eval` or reintroduce Ajv code generation. The build workflow runs `pnpm test:mcp-csp-validator` and `pnpm scan:mv3-csp` to guard this boundary.

## Supported platforms

MCP-Interceptor currently includes adapters for Gemini, DeepSeek, Grok, ChatGPT and other supported chat websites. These websites may change their interfaces at any time. If an integration stops working, [open an issue](https://github.com/drawdy/MCP-Interceptor/issues) and include the website, browser version and steps to reproduce. Do not include API keys, private URLs or other secrets.

## License

MCP-Interceptor is released under the MIT License. See [LICENSE](LICENSE).