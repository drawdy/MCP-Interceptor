# MCP-Interceptor Privacy Policy

Effective date and consent version: **6 November 2026 / 2026-11-06**

MCP-Interceptor is an independent browser extension maintained at
https://github.com/drawdy/MCP-Interceptor by the GitHub account **drawdy** and
contributors. Privacy contact: [repository issues](https://github.com/drawdy/MCP-Interceptor/issues).
Do not include private conversations, credentials or private server URLs in a public issue.

## Consent before page processing

A new installation, an existing installation without consent, and an installation
with an outdated consent version do not start page-content processing. Open the
extension toolbar popup to read the disclosure and this policy, then actively
select **I agree — enable page-content processing**. No agreement is inferred
from installation, opening a website, configuring a server or granting host access.
The extension stores `privacyConsentGranted`, `privacyConsentVersion` and
`privacyConsentTimestamp` in Chrome local extension storage. The current policy
version must match after updates, browser restarts and service-worker restarts.
Material changes to these practices require a new consent version and agreement.

You can revoke privacy consent in the toolbar popup. Already initialized chat
pages reload to stop all observers, timers, initialization and injected controls;
**unsent chat input may be lost**. The next page load verifies consent before
loading the processing modules. Revocation does not recall calls or messages
already delivered to a server or AI provider. Per-site switches separately control
where the extension runs. Server host access is a separate Chrome permission.

## Content accessed and processed

On enabled websites listed in the extension manifest (including ChatGPT, Gemini,
DeepSeek and Grok), adapters inspect rendered conversation/response DOM, code
blocks, streaming response changes, tool results and chat input controls. The
extension recognizes supported structured/JSON tool calls, tool names, parameters,
identifiers, descriptions and surrounding text needed to parse them. It does not
capture all browsing history or intentionally archive full conversations.

Conversation content, generated instructions, arguments and tool results can
contain personal communications, user-generated content, personal information,
files or other sensitive information chosen by the user or returned by tools.
Read the arguments before running a tool. Optional automation can execute calls,
insert text and submit messages without a separate click for every call when you
enable those settings. Image results are previewed locally and attached when you
select the supported image-attachment action; image attachment is not automatic.
The clipboard write feature copies generated instructions or supported attachment
fallbacks. It does not read the system clipboard.

## Local storage and retention

Chrome **local extension storage** contains the server endpoint and transport,
consent record, enabled/disabled sites, language, sidebar and tool preferences,
extension installation/version metadata, and `mcp_executed_tools`: execution
records indexed by the conversation page URL. Records can include tool/server
names, call IDs, timestamps and optional text results. At most 100 records are
kept **per URL**; there is no global expiry or automatic limit on the number of
URLs. Result text can contain arguments or other private data echoed by a tool.
Arguments and in-progress execution state are also held in memory while running.

AI-site **localStorage** contains UI/application/configuration state, automation
preferences, custom instructions, and saved tool permissions. Legacy keys include
`mcp-super-assistant-app-store`, `mcp-super-assistant-ui-store`, `config-store`,
`mcp_tool_permissions` and `mcp_site_disabled`. These keys are compatibility data,
not external services. Site localStorage is part of that website's origin and
should not be treated as secret storage. The extension does not use Chrome Sync
to upload these settings to a maintainer account.

Stored records remain until removed or overwritten. **Clear extension data** in
the popup clears Chrome local extension storage, including consent, settings and
execution records, and triggers reload of initialized pages. It does not remove
Chrome's host grants or each AI site's localStorage. To remove those grants, use
Chrome's extension Details / Site access controls. To remove site-local preferences,
use Chrome's site-data controls for each relevant AI site (this may also sign you
out). Uninstalling removes extension storage; website storage can remain.

## Transfers to your MCP server and AI provider

Connections occur only after you configure an endpoint, grant its host permission
and agree to this policy. No default localhost server is contacted on a fresh
installation. MCP protocol requests exchange client/protocol metadata, tool lists
and JSON schemas. Executing a tool sends its name and arguments; the server
returns text, structured data or supported image data. We do not send the full
conversation transcript as a separate service request. Arguments can themselves
contain any content the model/user placed in them.

Your MCP server may run on your computer, LAN, enterprise network or a third-party
service. Its operator and any services it invokes determine their own processing,
retention and security. MCP-Proxy is one optional user-operated server; no
maintainer-hosted proxy is required. Use encrypted HTTPS/WSS for remote servers;
HTTP/WS exposes traffic to the network and should be limited to trusted local use.

Results are displayed in the page/sidebar. Insertion or attachment places results
and context into the AI website's composer; automation can submit supported text
results if enabled. Submitted content and attachments are processed by the AI
provider under its own terms and privacy policy. Browser/website behavior may
expose composer content to that provider before submission. The extension cannot
control retention or deletion by your AI provider, MCP operator or downstream tools.

## Third parties, telemetry and executable code

No developer-operated application backend receives usage data. There are no
analytics, telemetry, error-reporting or Firebase Remote Config clients or requests.
Errors may be logged locally in developer consoles; avoid publishing logs with
secrets. Adapter defaults and executable scripts are bundled with the extension.
Tool definitions, JSON schemas and results are MCP protocol data, not downloaded
JavaScript. The extension does not evaluate AI text or MCP results as JavaScript.
Links to documentation/privacy policy open GitHub only when selected by the user.

## Limited Use

MCP-Interceptor's use and transfer of user data complies with the **Chrome Web Store
User Data Policy, including the Limited Use requirements**. Data is used only to
provide the disclosed MCP integration and its necessary operation. We do not sell
data, use it for advertising, build unrelated profiles, determine creditworthiness
or lend data to data brokers. Transfers to your selected MCP server and AI provider
serve this user-facing purpose. Maintainers do not receive conversation data for
human review; sharing information in a support report is your voluntary action.

## Changes and contact

Policy updates appear here and in release documentation. Material processing
changes require renewed affirmative consent before page processing resumes.
Questions and deletion guidance: https://github.com/drawdy/MCP-Interceptor/issues.
