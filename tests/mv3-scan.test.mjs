import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectJavaScript, scanProduction } from '../scripts/check-mv3-csp.js';

test('executable syntax distinguishes MCP data from remote code', () => {
  for (const source of [
    'eval("1")',
    'new Function("return 1")',
    'Function("return 1")',
    'globalThis.eval("1")',
    'import("https://example.com/a.js")',
    'importScripts("https://example.com/a.js")',
    'setTimeout("alert(1)", 1)',
  ])
    assert.ok(inspectJavaScript(source).length, source);
  assert.deepEqual(
    inspectJavaScript('const tool = {name: "eval()", result: "new Function()", schema: {type: "object"}};'),
    [],
  );
  assert.deepEqual(inspectJavaScript('import("./bundled.js"); fetch(serverUrl, {body: JSON.stringify(args)});'), []);
});
test('recursively scans content, popup and other scripts and checks package inventory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'interceptor-scan-'));
  try {
    await mkdir(join(dir, 'content'));
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({ manifest_version: 3, background: { service_worker: 'background.js' } }),
    );
    for (const name of ['background.js', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES.txt'])
      await writeFile(join(dir, name), '');
    await writeFile(join(dir, 'content/index.iife.js'), 'eval("remote")');
    await writeFile(join(dir, 'popup.js'), 'new Function("remote")');
    const result = await scanProduction(dir);
    assert.equal(result.scripts, 3);
    assert.ok(result.issues.some(issue => issue.includes('content/index.iife.js')));
    assert.ok(result.issues.some(issue => issue.includes('popup.js')));
    await writeFile(join(dir, 'content/index.iife.js'), '');
    await writeFile(join(dir, 'popup.js'), '');
    assert.deepEqual((await scanProduction(dir)).issues, []);
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        manifest_version: 3,
        content_security_policy: { extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self'" },
      }),
    );
    assert.ok((await scanProduction(dir)).issues.includes('unsafe extension CSP'));
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        manifest_version: 3,
        web_accessible_resources: [{ matches: ['*://x.com/i/grok*'], resources: ['script.js'] }],
      }),
    );
    assert.ok((await scanProduction(dir)).issues.includes('invalid web-accessible resource origin pattern'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
