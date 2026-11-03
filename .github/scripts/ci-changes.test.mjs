import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectChecks } from './ci-changes.mjs';

const cases = [
  ['documentation', ['README.md', 'chrome-extension/src/README.md'], false, []],
  ['unrelated workflow', ['.github/workflows/prettier.yml'], false, []],
  ['CSP tests only', ['chrome-extension/tests/csp.test.mjs'], false, ['csp']],
  ['parser tests only', ['tests/json-function-parser-multiline.test.ts'], false, ['parser']],
  ['background', ['chrome-extension/src/background/index.ts'], true, ['csp']],
  ['extension dependencies', ['chrome-extension/package.json'], true, ['csp']],
  ['parser dependencies', ['pages/content/package.json'], true, ['parser']],
  ['shared storage', ['packages/storage/lib/base/base.ts'], true, ['csp']],
  ['ChatGPT UI', ['pages/content/src/plugins/adapters/chatgpt.adapter.ts'], true, []],
  ['parser source', ['pages/content/src/render_prescript/src/parser/jsonFunctionParser.ts'], true, ['parser']],
  ['CSP scanner', ['scripts/check-mv3-csp.js'], true, []],
  ['lockfile', ['pnpm-lock.yaml'], true, ['csp', 'parser']],
  ['CI configuration', ['.github/workflows/build-zip.yml'], true, ['csp', 'parser']],
  ['routing', ['.github/scripts/ci-changes.mjs'], true, ['csp', 'parser']],
];
for (const [name, paths, build, tests] of cases) {
  test(name, () => assert.deepEqual(selectChecks(paths), { build, tests }));
}
test('manual runs and new branches run every check', () => {
  assert.deepEqual(selectChecks([], true), { build: true, tests: ['csp', 'parser'] });
});
test('combined changes select each suite once', () => {
  assert.deepEqual(
    selectChecks(['chrome-extension/tests/csp.test.mjs', 'tests/run-json-function-parser-multiline.js']),
    { build: false, tests: ['csp', 'parser'] },
  );
});
