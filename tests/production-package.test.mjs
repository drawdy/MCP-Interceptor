import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { scanProduction } from '../scripts/check-mv3-csp.js';

test('actual production entry has no DOM, renderer or network side effects before consent', async () => {
  const entry = await readFile('dist/content/index.iife.js', 'utf8');
  for (const stored of [
    {},
    { privacyConsentGranted: false },
    { privacyConsentGranted: true, privacyConsentVersion: 'old', privacyConsentTimestamp: 1 },
  ]) {
    const ctx = {
      console,
      location: {
        hostname: 'chatgpt.com',
        reload() {
          throw new Error('unexpected reload');
        },
      },
      chrome: { storage: { local: { get: async () => stored }, onChanged: { addListener() {} } } },
    };
    for (const name of ['document', 'MutationObserver', 'fetch', 'XMLHttpRequest', 'WebSocket'])
      Object.defineProperty(ctx, name, {
        get() {
          throw new Error(`Premature page processing: ${name}`);
        },
      });
    runInNewContext(entry, ctx);
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }
  assert.ok(entry.includes('content/runtime.iife.js'));
  assert.ok(!entry.includes('Function call renderer'));
  assert.ok((await readFile('dist/content/runtime.iife.js', 'utf8')).length > entry.length);
});
test('actual production package passes recursive scanner and inventory validation', async () => {
  assert.deepEqual((await scanProduction('dist')).issues, []);
});
