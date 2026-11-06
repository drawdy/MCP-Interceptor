# Chrome Web Store release preparation — MCP-Interceptor 0.4.0

Status: preparation only. Do not merge the PR, register an account, upload a store
item or submit review as part of this change. See [acceptance record](chrome-web-store/RELEASE_CHECKLIST.md).

## Account and public identity

The publisher must register a Chrome Web Store developer account, pay the one-time
registration fee, configure a monitored developer/contact email and complete the
Dashboard's verification and security requirements. Use the verified maintainer
account `drawdy` for project attribution; the account owner must supply any legal
publisher name, address, trader status or other required identity details. Do not
infer these from Git authors. [Registration requirements](https://developer.chrome.com/docs/webstore/register).

Support: https://github.com/drawdy/MCP-Interceptor/issues

Privacy URL: https://github.com/drawdy/MCP-Interceptor/blob/main/PRIVACY.md

Before submission, ensure this PR has merged through the normal approved Squash
Merge process and the URL shows the updated policy without authentication. Until
then the main-branch policy does not describe this candidate release. Test the
public URL in a signed-out browser. A raw file URL can also be used if the
Dashboard accepts it and it displays the current policy publicly.

## Reproducible production build

Use the Node version in `.nvmrc`, pnpm from `packageManager` and a clean checkout.
Run from a login zsh after `source ~/.zshrc`:

```sh
pnpm install --frozen-lockfile
pnpm type-check
pnpm test:json-parser
pnpm test:mcp-csp-validator
pnpm test:mcp-image-output
pnpm --filter chrome-extension test
pnpm test:privacy-consent
pnpm test:mv3-scan
pnpm build
pnpm scan:mv3-csp
pnpm zip
```

`pnpm zip` rebuilds in production mode and scans before packaging. ZIPs are written
to `dist-zip/MCP-Interceptor-VERSION-YYYYMMDD-HHmmss.zip` (filename time is UTC).
Unzip into an empty folder: `manifest.json` must be at the root. Load that folder
via `chrome://extensions` → Developer mode → Load unpacked. Do not upload a source
archive, an enclosing directory, `.env`, maps, tests, development HMR or node_modules.
The production manifest, popup HTML/CSS/JS, background, consent entry,
`content/runtime.iife.js`, CSS, CodeMirror helper and icons must be present.
LICENSE, THIRD_PARTY_NOTICES.md and generated THIRD_PARTY_LICENSES.txt must be in
the package. The latter is a conservative dependency-license inventory, including
build-time packages; review missing-license entries before publishing. It contains
notice text, not dependency code. Record the final ZIP SHA-256 and commit SHA.

## Single purpose and permission explanations

**Single Purpose Description:** MCP-Interceptor connects user-configured MCP
servers to supported AI chat websites, allowing users to invoke MCP tools and use
their results directly in familiar AI conversations.

| Manifest item | Dashboard justification |
| --- | --- |
| `storage` | Persist consent/version/timestamp, endpoint/transport, language, site choices, tool settings and local execution records/results. |
| `clipboardWrite` | User-facing instruction copy and supported attachment/paste fallbacks; no clipboard read permission or clipboard reading. |
| optional HTTP/HTTPS hosts | User servers may be loopback, LAN, enterprise or third party. Broad optional patterns allow arbitrary user configurations; the runtime gesture requests only the configured scheme/hostname, across all ports. WS/WSS map to HTTP/HTTPS host grants. |
| content script matches | A specific supported AI-site allowlist, including path-limited Grok/Copilot matches. No all-sites injection. Only the consent entry is initially executed. |
| web-accessible resources | Packaged runtime, styles and assets needed on those same AI sites; matches mirror the content-script allowlist. |

`tabs`, `scripting`, `activeTab` and clipboard-read privileges are not requested.
`default_locale` was removed: the popup has bundled English/Chinese strings and
does not require Chrome message catalogs. Host permission and privacy agreement
are separate requirements; neither substitutes for the other. Removing a server
host grant disconnects the worker; later calls recheck permission. Chrome host
permissions do not restrict the connection to a single port or URL path.

## Privacy Practices data inventory

Do **not** select “does not collect/use user data” merely because no maintainer
backend exists. The extension reads conversations and transfers selected tool
arguments/results as disclosed. Complete the current Dashboard categories against
this code and [PRIVACY.md](../PRIVACY.md).

| Category | Applicability and handling |
| --- | --- |
| Website content | Yes. Rendered AI responses, code blocks, tool calls/results and composer content are processed on enabled sites after consent. |
| Personal communications | Yes. AI conversations can contain private messages; selected content can be included in tool arguments or returned results. |
| User-generated content | Yes. Prompts, custom instructions, files/images and generated tool input/output. If not a separate current checkbox, disclose under Website content and the explanatory text. |
| Web history | Limited supported conversation URLs are stored as execution-record keys, not a global browsing history. Declare this limited URL handling when the Dashboard category includes visited URLs. |
| Personally identifiable / health / financial / authentication information | No dedicated extraction, profiling or collection fields. Arbitrary user arguments, conversations and tool results can contain these. Do not claim that sensitive data can never be processed; assess the publisher's intended supported use and select any applicable current categories. Credentials are rejected in endpoint URL userinfo; do not use real secrets in reviewer examples. |
| Location / user activity | No location API, keystroke analytics or behavior-tracking telemetry. Consent and execution timestamps support the product; explain if a current Dashboard definition includes these operational records. |

Recipients: user-selected MCP server and any services its tools contact; AI
provider when results/instructions are inserted or submitted (including optional
automation). MCP protocol handshake includes client identity/version, capabilities
and tool/schema data. No maintainer telemetry, analytics, error-reporting backend
or remote config. Local history includes URLs, tool/server names, call IDs,
timestamps and optional text results (up to 100 per URL; no time expiry). Runtime
arguments/results are also held in memory. AI-site localStorage stores UI/config
and tool-permission preferences. Clear extension data does not clear AI-site
storage or revoke host grants; explain the separate removal steps in the policy.

The privacy policy affirms compliance with the Chrome Web Store User Data Policy,
including Limited Use. Data use is limited to this disclosed integration; no sales,
ads, unrelated profiling or credit/lending decisions. Certify the Dashboard's use
and transfer statements only when actual publishing practices also comply.
[Privacy form](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy),
[Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use).

## Remote code and security boundary

All executable extension code ships inside the ZIP. The consent entry dynamically
imports a packaged `chrome-extension://…/content/runtime.iife.js`; adapters can
inject the packaged CodeMirror helper. These are local extension resources.
MCP tool names, parameter JSON schemas and text/image/structured results are
protocol data. Tools execute on the selected MCP server, not as downloaded
JavaScript in the extension. No eval, Function constructor, remote script imports,
remote feature modules or AI-text script execution are required. The SDK uses a
CSP-safe schema validator and fail-closed Ajv shims. Do not add unsafe-eval or
weaken CSP to make tools work. `scan:mv3-csp` recursively parses all built JS,
checks manifest CSP, HTML script references, HMR/maps and required package files.
Static scans supplement source review; computed/obfuscated code loading still
requires human review. [Remote hosted code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code).

## Reviewer test steps

1. Use a clean Chrome profile and the final unzipped package. Open ChatGPT and
   Gemini before opening the extension. Confirm no MCP sidebar, renderer controls,
   content observers or CodeMirror helper; no default localhost requests.
2. Open the toolbar. Read the English/Chinese disclosure and public privacy link.
   Website switches or host access do not grant privacy agreement. Click **I agree**;
   enabled open tabs start processing. With no endpoint saved, no MCP connection starts.
3. Run a reviewer-controlled MCP server with a harmless echo tool. Enter its endpoint,
   select its actual supported transport, click **Grant access and connect** and
   approve Chrome's specific host prompt. No maintainer service or paid account is
   needed for the MCP server. AI sites may require their own accounts.
4. Deny host permission first and verify no connection; grant and verify tool
   discovery. Revoke host access in Chrome Details and confirm disconnect/call refusal.
5. Insert generated tool instructions, ask for an echo call, review its arguments,
   click Run and check result display/insertion. Leave automatic execution/submission
   off during initial testing. Repeat on Gemini, DeepSeek, Grok and ChatGPT.
6. Test supported raster tool output preview and **Attach Images**; check ordinary
   text insertion, attachment retry and website navigation/composer replacement.
7. Disable and re-enable each site; reloaded pages obey the saved choice. Revoke
   privacy agreement and verify initialized pages reload, lose controls and stop
   processing; host grants alone cannot restart it. Re-agree to resume.
8. Restart Chrome and terminate/restart the service worker with consent both granted
   and revoked. Update an older installation: no consent record means processing
   remains off. Change the stored consent version to an older value in a test profile:
   processing must stop and re-agreement must record the current version.
9. Run **Clear extension data** and verify settings/history/consent disappear. Clear
   AI-site data separately to remove site-local preferences. Verify normal website
   operation, the Errors panel and the ZIP inventory/hash.

These steps require real authenticated AI pages and a live test MCP server. An
automated DOM/mock test is not evidence that every live adapter works.

## Listing and assets

Use [STORE_LISTING.md](chrome-web-store/STORE_LISTING.md) as the English draft.
Use the original icon SVG/PNG in `chrome-extension/public` and brand wordmark in
`docs/assets`; do not use upstream store screenshots or marks. Provide the 128×128
store icon and at least one real screenshot (up to five; 1280×800 or 640×400).
Capture consent disclosure, configured server/tool list and an echo result with
synthetic non-sensitive data; label any illustration accurately. Optional small
promotional tile: 440×280; marquee: 1400×560. Confirm the current Dashboard's format,
size and content requirements before upload. [Official image requirements](https://developer.chrome.com/docs/webstore/images).

## Unlisted test and public release

After all local/manual gates and CI pass and the maintainer approves the merge,
the publisher uploads the ZIP, fills listing, privacy, permissions, support and
reviewer test instructions, and chooses Unlisted for initial distribution.
Unlisted items still require policy review; share their link with selected testers.
Record issues and release a version-incremented fix through the same PR/CI flow.
Switch to Public only after acceptance and explicit publisher approval; review may
be required. Do not enable automatic publishing without the publisher's decision.
[Publishing flow](https://developer.chrome.com/docs/webstore/publish).

If rejected, save the exact policy section and reviewer message, reproduce using
the uploaded ZIP, inspect every built script and actual network request, compare
privacy disclosures/permissions to code, fix in a new feature PR, rerun CI and
manual acceptance, bump the manifest version and upload the corrected ZIP with a
specific reviewer explanation. Use the appeal/support path when evidence supports
it. Do not hide code, weaken scanning or misdeclare collection to bypass review.
