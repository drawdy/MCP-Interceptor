import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectChecks } from './ci-changes.mjs';

const cases = [
  ['documentation', ['README.md', 'chrome-extension/src/README.md'], false, []],
  ['unrelated workflow', ['.github/workflows/prettier.yml'], false, []],
  ['CSP tests only', ['chrome-extension/tests/csp.test.mjs'], false, ['csp']],
  ['parser tests only', ['tests/json-function-parser-multiline.test.ts'], false, ['parser']],
  ['image tests only', ['tests/mcp-image-output.test.ts'], false, ['image']],
  ['image runner only', ['tests/run-mcp-image-output.js'], false, ['image']],
  ['image renderer', ['pages/content/src/render_prescript/src/renderer/components.ts'], true, ['parser', 'image']],
  ['automation', ['pages/content/src/services/automation.service.ts'], true, ['image']],
  ['background', ['chrome-extension/src/background/index.ts'], true, ['csp']],
  ['extension dependencies', ['chrome-extension/package.json'], true, ['csp']],
  ['parser dependencies', ['pages/content/package.json'], true, ['parser']],
  ['shared storage', ['packages/storage/lib/base/base.ts'], true, ['csp']],
  ['ChatGPT UI', ['pages/content/src/plugins/adapters/chatgpt.adapter.ts'], true, ['image']],
  ['parser source', ['pages/content/src/render_prescript/src/parser/jsonFunctionParser.ts'], true, ['parser']],
  ['CSP scanner', ['scripts/check-mv3-csp.js'], true, []],
  ['project license', ['LICENSE'], true, ['csp', 'parser', 'image']],
  ['third-party notice', ['THIRD_PARTY_NOTICES.md'], true, ['csp', 'parser', 'image']],
  ['dependency notices', ['third-party/licenses/library.txt'], true, ['csp', 'parser', 'image']],
  ['license tooling', ['scripts/collect-production-licenses.js'], true, []],
  ['lockfile', ['pnpm-lock.yaml'], true, ['csp', 'parser', 'image']],
  ['CI configuration', ['.github/workflows/build-zip.yml'], true, ['csp', 'parser', 'image']],
  ['routing', ['.github/scripts/ci-changes.mjs'], true, ['csp', 'parser', 'image']],
];
for (const [name, paths, build, tests] of cases) {
  test(name, () => assert.deepEqual(selectChecks(paths), { build, tests }));
}
test('manual runs and new branches run every check', () => {
  assert.deepEqual(selectChecks([], true), { build: true, tests: ['csp', 'parser', 'image'] });
});
test('combined changes select each suite once', () => {
  assert.deepEqual(
    selectChecks(['chrome-extension/tests/csp.test.mjs', 'tests/run-json-function-parser-multiline.js']),
    { build: false, tests: ['csp', 'parser'] },
  );
});
