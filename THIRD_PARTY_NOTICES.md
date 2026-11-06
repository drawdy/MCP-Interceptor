# Third-party notices and provenance

MCP-Interceptor is maintained as an independent product at https://github.com/drawdy/MCP-Interceptor.
The project identity does not change the ownership of inherited work.

## MCP SuperAssistant — inherited and modified code

The initial import is commit `753495b` ("import upstream project snapshot").
Files present in that snapshot remain conservatively classified as inherited, or
inherited with modifications when changed later, including the content renderer,
plugin and adapter architecture, shared UI/storage/build infrastructure and MCP client.
No claim is made that these systems have been completely independently rewritten.
Original later additions and modifications belong to their respective contributors;
this does not transfer ownership of the underlying code.

Source: https://github.com/srbhptl39/MCP-SuperAssistant

The following upstream license is preserved in full and applies to all retained
upstream code and substantial portions, including modified copies:

```text
MIT License

Copyright (c) 2025 Saurabh Patel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Original MCP-Interceptor contributions

Root LICENSE identifies the verified GitHub maintainer account `drawdy` and project
contributors, not an inferred legal name or employer. Git history associates the
initial import and subsequent product changes with `drawdy2010@hotmail.com`;
commits also use other identities, so the project does not claim sole ownership.

Original work includes independent product documentation and release materials,
the brand SVG assets introduced by `bb5b6ec`, later independently authored fixes
and additions (only the added expression), and this release's consent entry,
privacy policy, production scanner and license inventory tooling. Derivative files
continue to retain upstream attribution through this notice. PNG icon exports
follow the project SVG source. Website names and third-party marks remain their
owners' property. `pages/content/public/logo.svg` now uses the same original product SVG source.

Persisted keys containing `mcp-super-assistant` and an adapter CSS compatibility
selector are intentionally retained to read existing preferences and exclude
legacy injected controls; they are not product names or service destinations.

## Dependency licenses

`THIRD_PARTY_LICENSES.txt` is generated from installed lockfile dependencies before
production builds and included in the ZIP. It includes a conservative superset of
build dependencies because some bundled libraries are declared as development
packages. No dependency source, tests or development runtime is included by this
inventory. Package notices and copyright holders remain unchanged. Review any
missing-license metadata entries before publishing; do not infer a license.

Supplemental upstream license texts missing from npm archives are retained under
`third-party/licenses/`, with their public source URL and retrieval date. The
inventory first uses each installed package's license/notice files, then a full
README license section, then the supplemental copy for that exact package version.
Supplemental copies obtained from a default branch are identified as such; they
do not establish ownership of MCP-Interceptor code or silently relicense a package.
