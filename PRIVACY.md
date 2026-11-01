# Privacy Policy

**Product:** MCP-Interceptor

**Effective date:** 1 November 2026

## Summary

MCP-Interceptor is an independently maintained community fork of the MIT-licensed MCP SuperAssistant project. The extension runs in the user's browser and connects to an MCP server URL that the user configures.

This fork does not send analytics, telemetry, browser demographics, AI conversation content, tool arguments, or tool results to the fork maintainer. Analytics calls are disabled in the distributed source, and the inherited Firebase Remote Config feature is disabled.

## Information the extension handles

### AI chat page content

On supported AI chat websites, the extension reads rendered page content in the active page to identify MCP tool-call instructions and display tool-call controls. Depending on the user's settings and actions, it may read a tool name, arguments, a short description, and the surrounding response text needed to recognize a tool call.

The extension does not intentionally archive full conversations or send conversation transcripts to the fork maintainer.

### MCP server requests

When the user executes a detected tool call, the extension sends the tool name and its arguments to the MCP server URL configured by the user. The MCP server returns a result, which the extension displays and can insert into the AI chat input.

The configured MCP server may be running on the user's own computer, local network, company network, or a third-party service. The operator of that MCP server can receive and process the tool names, arguments, and any data included in them. The user is responsible for selecting and trusting that server and reviewing its privacy and security practices.

If the user submits inserted results through the AI website, that content is then handled by the AI provider under that provider's own terms and privacy policy. The extension does not control the AI provider's processing.

### Data stored locally

The extension uses Chrome's local extension storage for settings such as:
- The MCP server URL and transport type.
- User interface and tool-execution preferences.
- Basic extension version and installation metadata.

This information remains in the browser profile. It is not synchronized to a server operated by the fork maintainer. The user can remove it by clearing the extension's stored data or uninstalling the extension.

### Host access permission

The extension requests optional access to the host in the MCP server URL configured by the user. The request is initiated by clicking the extension's toolbar popup. The permission is limited to that configured host; the extension does not embed a maintainer's private or local network address in the package.

The extension also declares content-script access to the AI websites listed in its manifest so it can provide the advertised integration on those sites.

## Analytics and remote configuration

Analytics and telemetry are disabled in this fork. The extension does not send usage events, page URLs, tool names, tool arguments, error reports, browser characteristics, or screen information to Google Analytics or another analytics service.

The inherited Firebase Remote Config integration is disabled. The extension does not fetch remote feature flags or remote adapter code from the original project.

## Data sharing

The fork maintainer does not receive user data through a developer-operated analytics or application backend. Data is sent only to:
1. The MCP server endpoint explicitly configured by the user, when the user connects or executes a tool.
2. The AI website provider, if the user submits content through that website's normal chat interface.

The extension does not sell user data or use it for advertising.

## Security

For remote MCP servers, use HTTPS or WSS. Plain HTTP or WS traffic is not encrypted and should only be used on a trusted local network or loopback interface. The extension cannot guarantee the security, availability, or data-handling practices of a user-selected MCP server or AI provider.

Do not pass passwords, API keys, private keys, or other secrets to tools unless the user has independently verified the destination and the tool's behavior.

## User choices

Users can:
- Choose or change the MCP server URL.
- Grant or revoke host access through Chrome's extension permission controls.
- Disable the extension or remove it at any time.
- Choose whether to execute tools manually or enable supported automation preferences.

## Changes and contact

This policy may be updated if the extension's data practices change. Material changes will be reflected in the extension's release notes and this document.

For privacy questions or reports, open an issue in the public repository:

https://github.com/drawdy/MCP-Interceptor/issues

This extension is an independent community fork and is not affiliated with or endorsed by the upstream MCP SuperAssistant maintainer.