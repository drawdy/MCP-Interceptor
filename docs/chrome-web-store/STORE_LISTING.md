# Chrome Web Store Listing Draft

## Proposed name

MCP-Interceptor

Use the MCP-Interceptor name and current fork icon consistently. Keep the upstream attribution visible and do not imply endorsement by the upstream maintainer.

## Short description

Connect MCP tools to supported AI chat websites through a user-configured MCP server.

## Detailed description

MCP-Interceptor connects Model Context Protocol (MCP) tools to supported AI chat websites. It detects structured tool-call instructions in AI responses, lets users review and execute those calls, and returns tool results to the conversation.

Features:
- Connect to a local, private-network, or remote MCP server configured by the user.
- Support SSE and other transports provided by the client.
- Detect and display structured MCP tool calls.
- Review and manually execute tool calls.
- Insert tool results into the AI chat input.
- DeepSeek-specific compatibility improvements for composer insertion and tool-call instructions.
- Configure the MCP endpoint and transport directly in the toolbar popup.
- Optional host access: Chrome asks the user to grant access only to the configured MCP server host.

Supported AI websites are those listed in the extension manifest and may change as their web interfaces evolve.

This is an independent community fork of the MIT-licensed upstream project. It is not the official upstream extension and is not affiliated with or endorsed by the upstream maintainer.

## Category

Productivity

## Language

English (add Chinese listing localization if the listing and support materials are ready).

## Privacy policy URL

https://github.com/drawdy/MCP-Interceptor/blob/main/PRIVACY.md

## Privacy and permission disclosures

- The extension reads rendered content on supported AI chat websites to detect MCP tool calls.
- Tool names and arguments are sent to the MCP endpoint explicitly configured by the user.
- Results from that endpoint are displayed and may be inserted into the AI chat input.
- Analytics and telemetry are disabled in this fork.
- Firebase Remote Config is disabled.
- The extension requests optional host access at runtime for the configured MCP server host.
- No remote code is downloaded or executed.

## Required store assets

- Store icon: 128 × 128 PNG.
- At least one screenshot: 1280 × 800 or 640 × 400; up to five.
- Recommended small promotional tile: 440 × 280 PNG or JPEG.
- Optional marquee image: 1400 × 560 PNG or JPEG.

Screenshots must show the current, working extension and must not imply that it is an official upstream product.