# English Chrome Web Store listing draft

**Name:** MCP-Interceptor

**Short description:** Connect your MCP tools to supported AI chat websites and use tool results in your conversations.

**Single purpose:** MCP-Interceptor connects user-configured MCP servers to supported AI chat websites, allowing users to invoke MCP tools and use their results directly in familiar AI conversations.

## Detailed description

Bring the tools from your chosen Model Context Protocol (MCP) server into supported
AI chat websites. MCP-Interceptor includes integrations for ChatGPT, Gemini,
DeepSeek and Grok, alongside other sites listed in the extension's website settings.
Website interface changes can affect adapter compatibility.

Configure your own MCP endpoint, grant access to that host, choose available tools
and insert MCP instructions into your conversation. When the AI produces a
supported tool call, inspect its name and arguments, run it, and use the returned
result in the same conversation. Supported raster image results can be previewed
and attached on compatible pages. Optional automation can execute tools, insert
text results and submit messages when enabled; review calls manually first.

On first use you must agree to page-content processing before the extension reads
AI conversations. You can disable individual websites or revoke privacy consent
in the toolbar popup. Revocation reloads initialized chat pages to stop processing,
which can discard unsent input. Server host access is a separate permission.

Your configured MCP server may be local, on your company network or operated by a
third party. MCP-Proxy is an optional user-operated choice; no maintainer-hosted
service is required. An MCP server is required for tools; AI websites may require
their own account. Install and trust servers according to their own instructions.

Privacy: the extension handles website content and personal communications to
recognize tool calls. Names and arguments go to your chosen MCP server. Results
can be inserted, attached or submitted to the AI provider. Local history includes
conversation URLs, tool names and optional text results; preferences also use AI-site
storage. No maintainer analytics, telemetry or remote configuration. MCP-Interceptor
complies with the Chrome Web Store User Data Policy, including Limited Use.

Privacy policy: https://github.com/drawdy/MCP-Interceptor/blob/main/PRIVACY.md
Support and source: https://github.com/drawdy/MCP-Interceptor

MCP-Interceptor is an independent product, unaffiliated with the AI website
providers. Their names identify compatible services. Tools run on your selected
server and may affect files or external systems; review calls and automation settings.

Publisher-only preparation: verify all claimed live-site functionality and capture
screenshots before submitting. Do not present this draft as an already published listing.
