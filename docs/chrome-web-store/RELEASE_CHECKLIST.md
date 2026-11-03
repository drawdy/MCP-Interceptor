# Chrome Web Store Release Checklist

## Before the first submission

- [ ] Confirm that the store listing name is MCP-Interceptor and does not imply upstream endorsement.
- [ ] Confirm the final extension icon and store branding.
- [ ] Complete manual end-to-end tests on DeepSeek, Gemini, and at least one other supported AI website.
- [ ] Test MCP connections to localhost, a private-network host, and a remote HTTPS endpoint.
- [ ] Test the toolbar popup endpoint editor, transport selector, URL validation, and host-permission summary.
- [ ] Verify the endpoint is saved only after Chrome grants the requested host permission.
- [ ] Test the optional host permission flow from the toolbar popup.
- [ ] Verify that denying permission prevents connection and produces a useful message.
- [ ] Verify that revoking host permission in Chrome causes the next connection attempt to fail safely.
- [ ] Confirm analytics and Firebase Remote Config remain disabled.
- [ ] Review the manifest for minimum necessary permissions.
- [ ] Confirm the privacy policy matches the actual packaged build.
- [ ] Confirm the ZIP contains manifest.json at its root and no source maps, secrets, .env files, or development-only files.
- [ ] Run type checks, production build, ZIP integrity checks, and a clean Chrome install test.

## CI and repository checks

- [ ] Confirm GitHub Actions workflows are enabled for this fork; GitHub may leave workflows disabled after a repository is forked.
- [ ] Confirm the build and formatting workflows pass on the release commit.
- [ ] Confirm affected regression tests and the production CSP scan pass in Extension CI; browser installation and site flows still require the manual checks above.

## Register and create the store item

1. Register a Chrome Web Store developer account at https://chrome.google.com/webstore/devconsole and pay Google's one-time registration fee.
2. Click **Add new item** and upload the production ZIP from the `dist-zip/` directory.
3. Complete the Store listing fields and upload the required icon and at least one screenshot.
4. Add the public privacy policy URL.
5. Complete the Privacy practices declarations and justify each requested permission.
6. Declare that the extension does not execute remotely hosted code.
7. Select **Unlisted** for an initial controlled release, or **Public** for searchable distribution.
8. Submit for review. Consider deferred publishing so the item can be published manually after approval.

## After approval

- [ ] Install from the Chrome Web Store listing URL on a clean Chrome profile.
- [ ] Confirm the toolbar popup requests only the configured MCP server host.
- [ ] Re-enter the MCP server URL if the old unpacked extension used a different extension ID.
- [ ] Verify DeepSeek tool detection, manual execution, result insertion, and follow-up submission.
- [ ] Verify Gemini and Grok regression behavior.
- [ ] Publish the listing or share the unlisted URL with testers.

## Subsequent updates

1. Increment the root `package.json` and `chrome-extension/package.json` versions consistently.
2. Run `pnpm install --frozen-lockfile`, type checks, and `pnpm zip`.
3. Upload the new ZIP to the existing item in the Chrome Web Store Developer Dashboard.
4. Update release notes and privacy declarations if behavior or data practices changed.
5. Submit the update for review.
