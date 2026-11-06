# MCP-Interceptor 0.4.0 — Chrome Web Store remediation checklist

Prepared 6 November 2026. This records evidence and remaining release gates; it
is not authorization to merge or submit. Main guide: [CHROME_WEB_STORE_RELEASE.md](../CHROME_WEB_STORE_RELEASE.md).

## Completed implementation

- [x] Independent product identity in English/Chinese README, privacy policy,
  popup, internal source descriptions and store copy. MCP-Proxy is optional and
  user-operated, not a maintainer-hosted requirement. MCP-Proxy repository untouched.
- [x] Original contributions attributed to the verified GitHub maintainer account
  `drawdy` and contributors; no invented legal name or employer ownership.
- [x] Upstream MIT copyright and full permission text retained separately in
  THIRD_PARTY_NOTICES.md; imported/modified/original work distinguished against
  initial snapshot `753495b`. No assertion of a complete independent rewrite.
- [x] Original product SVG reused for the content logo; third-party marks and
  legacy persisted preference identifiers are explicitly distinguished.
- [x] Default-off, versioned Chrome local privacy consent with explicit bilingual
  disclosure, public policy link, grant/revoke and clear-extension-data controls.
- [x] Separate packaged consent entry loads runtime only after affirmative current
  consent and site-enabled checks. No eager renderer path remains.
- [x] Revocation or site-control changes reload initialized documents, terminating
  all adapters, pending initialization, observers, timers and controls. Popup and
  policy disclose possible unsent-input loss. New loads verify storage again.
- [x] Background startup, periodic work, messages and tool/host checks require
  consent; removing consent or host grants disconnects the worker. No implicit
  consent migration during update or startup, and no unconfigured localhost probe.
- [x] Privacy policy describes actual conversation DOM access, tool parameters,
  protocol metadata, history/results/URL retention, site-local preferences, user
  servers, AI-provider responsibility, automation, deletion and Limited Use.
- [x] No analytics, Firebase Remote Config, developer telemetry or error backend.
  Removed clipboard-reading probes; clipboardWrite retained for actual copy/paste
  and attachment fallbacks.
- [x] Optional custom-server hosts remain available; runtime grant stays scoped to
  the configured host. Content-script allowlist retained; web resources use the
  same allowlist. No tabs/scripting/activeTab permissions added. Unused default_locale
  and boilerplate locale copying removed.
- [x] Recursive production JS syntax/CSP/remote-loading checks and package inventory
  checks added, with adversarial scanner regression fixtures. MCP JSON schemas and
  result strings are treated as data. All executable files, including CodeMirror
  and other page helpers, are scanned. No unsafe-eval exception.
- [x] Production ZIP includes LICENSE, THIRD_PARTY_NOTICES.md and generated dependency
  notices. No node_modules, tests, maps or HMR; manifest and referenced scripts/icons
  verified. Version raised to 0.4.0 and ZIP name includes version.
- [x] CI runs authorization/scanner tests and verifies the built consent entry.
  License and notice changes also trigger checks. Existing PR/CI flow retained.

## Verification evidence

Commands executed locally, with logs in `/tmp/interceptor-*.log` during this work:

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm type-check` (all workspace checks; fixed Chrome Storage unknown-value
  and tab-update type errors exposed by current installed declarations).
- [x] `pnpm test:json-parser`
- [x] `pnpm test:mcp-csp-validator`
- [x] `pnpm test:mcp-image-output`
- [x] `pnpm --filter chrome-extension test` (includes no-config, missing-host and
  missing-consent cases with zero network requests).
- [x] `pnpm test:privacy-consent` (fresh/outdated/corrupt/revoked/site-disabled
  states, storage failures, grant, revoke and re-enable behavior).
- [x] `pnpm test:mv3-scan`
- [x] `pnpm build` and `pnpm scan:mv3-csp`
- [x] `pnpm zip` and `pnpm test:production-package` (actual built entry runs in a
  context that throws on DOM/observer/network access before consent).
- [x] CI-routing regression and changed-source formatting checks.
- [x] BrowserOps isolated popup UI interaction with mocked Chrome APIs: initial
  empty endpoint/no consent/disabled Connect/zero requests; agreement records current
  version; host denial does not save an endpoint; revocation disables Connect;
  Chinese translation works. This is not an installed-extension test.

## Human release gates still open

- [ ] Real Chrome Load unpacked of the final extracted ZIP. Local Chrome startup
  was attempted with a clean test profile but failed: missing `libglib-2.0.so.0`.
  No claim is made that actual installation or a browser restart was tested here.
- [ ] Real signed-in ChatGPT, Gemini, DeepSeek and Grok: no pre-consent monitoring,
  normal post-consent controls, per-site toggles and navigation, tool call/result,
  image preview/attachment/retry, host denial/revocation and consent revocation.
- [ ] Real browser restart, service-worker stop/start and older-version update,
  with consent granted, absent, revoked and outdated. Unit/VM tests cover state
  policy; actual browser lifecycle verification remains necessary.
- [ ] Verify publisher/legal identity, developer/contact email and Dashboard
  verification; `drawdy` is a project attribution, not a fabricated legal identity.
- [ ] Review supplemental dependency notices and any metadata-only entries in the
  generated inventory before store submission; the inventory conservatively includes
  build dependencies as well as runtime code. Upstream provenance is recorded in
  `third-party/licenses/`; no missing legal holder was guessed.
- [ ] Capture truthful store screenshots and prepare icons/promotional materials.
  Isolated mock UI captures must not be presented as live tool functionality.
- [ ] After approved merge, verify the main-branch public privacy URL reflects
  this policy and the Dashboard declarations match actual publishing practices.
- [ ] Publisher completes developer registration, reviewer test-server instructions,
  Unlisted test review and later Public publication as separate approved actions.

## Final local artifact

- ZIP: `dist-zip/MCP-Interceptor-0.4.0-20261106-090122.zip`
- SHA-256: `c6e63455a3b2330ebbc8ec0f5dfd028b68c4818c24d1d2639638b4543d33145d`
- 22 files; manifest version 0.4.0; seven JavaScript files scanned again after
  extraction to a fresh directory. Required notices and runtime/entry present;
  no maps, node_modules, HMR or unused locale catalogs.
- Dependency inventory contains explicit metadata-only entries for `dlv@1.1.3`,
  `language-subtag-registry@0.3.23` and `@napi-rs/lzma-linux-x64-gnu@1.5.1` from build
  tooling. Their npm distributions omit standalone license files; they are not
  claimed as original work or assigned a guessed copyright holder. Other missing
  standalone notices are supplemented by packaged README license sections or
  sourced originals. Review this conservative inventory at the human release gate.

## PR and CI handoff

Use feature branch `feature/cws-product-compliance`. Wait for required checks to
pass and review the remaining human gates. Do not merge this PR or submit the
store item automatically. The normal approved Squash Merge process applies.
