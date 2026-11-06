import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const consentVersion = '2026-11-06';
const accepted = { privacyConsentGranted: true, privacyConsentVersion: consentVersion, privacyConsentTimestamp: 1 };
const entry = await build({
  entryPoints: ['pages/content/src/index.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  plugins: [
    {
      name: 'runtime-spy',
      setup(build) {
        build.onLoad({ filter: /pages\/content\/src\/index\.ts$/ }, async args => ({
          contents: (await readFile(args.path, 'utf8')).replace(
            "import(/* @vite-ignore */ chrome.runtime.getURL('content/runtime.iife.js'))",
            "import('./runtime')",
          ),
          loader: 'ts',
        }));
        build.onResolve({ filter: /^\.\/runtime$/ }, () => ({ path: 'runtime', namespace: 'spy' }));
        build.onLoad({ filter: /.*/, namespace: 'spy' }, () => ({ contents: 'globalThis.runtimeStarts++;' }));
      },
    },
  ],
});
const policy = await build({
  entryPoints: ['packages/shared/lib/privacy-consent.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'policy',
});

async function harness(initial = {}) {
  let stored = initial;
  let listener;
  let readsFail = false;
  const ctx = {
    console,
    runtimeStarts: 0,
    reloads: 0,
    location: {
      hostname: 'chatgpt.com',
      reload() {
        ctx.reloads++;
      },
    },
    chrome: {
      storage: {
        local: {
          get: async () => {
            if (readsFail) throw new Error('storage unavailable');
            return stored;
          },
        },
        onChanged: {
          addListener(callback) {
            listener = callback;
          },
        },
      },
    },
  };
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  runInNewContext(entry.outputFiles[0].text, ctx);
  await flush();
  return {
    ctx,
    failReads() {
      readsFail = true;
    },
    async change(next, keys = ['privacyConsentGranted']) {
      stored = next;
      listener(Object.fromEntries(keys.map(key => [key, { newValue: next[key] }])), 'local');
      await flush();
    },
  };
}

for (const [name, stored] of Object.entries({
  fresh: {},
  revoked: { ...accepted, privacyConsentGranted: false },
  outdated: { ...accepted, privacyConsentVersion: 'old' },
  corrupt: { ...accepted, privacyConsentTimestamp: '1' },
  disabled: { ...accepted, mcpDisabledSites: ['chatgpt.com'] },
})) {
  test(`${name}: no page runtime is imported`, async () => {
    const { ctx } = await harness(stored);
    assert.equal(ctx.runtimeStarts, 0);
  });
}
test('explicit consent starts runtime once; unrelated host settings do not grant consent', async () => {
  const h = await harness({ mcpServerUrl: 'http://localhost:3006/sse' });
  assert.equal(h.ctx.runtimeStarts, 0);
  await h.change(accepted);
  assert.equal(h.ctx.runtimeStarts, 1);
});
test('revocation terminates old document; restart fails closed', async () => {
  const h = await harness(accepted);
  assert.equal(h.ctx.runtimeStarts, 1);
  await h.change({ ...accepted, privacyConsentGranted: false });
  assert.equal(h.ctx.reloads, 1);
  assert.equal((await harness({ ...accepted, privacyConsentGranted: false })).ctx.runtimeStarts, 0);
});
test('site disabled then enabled still requires consent', async () => {
  const h = await harness({ mcpDisabledSites: ['chatgpt.com'] });
  await h.change({ mcpDisabledSites: [] }, ['mcpDisabledSites']);
  assert.equal(h.ctx.runtimeStarts, 0);
  await h.change(accepted);
  assert.equal(h.ctx.runtimeStarts, 1);
  await h.change({ ...accepted, mcpDisabledSites: ['chatgpt.com'] }, ['mcpDisabledSites']);
  assert.equal(h.ctx.reloads, 1);
});
test('storage error cannot enable runtime', async () => {
  const h = await harness();
  h.failReads();
  await h.change(accepted);
  assert.equal(h.ctx.runtimeStarts, 0);
});
test('popup and shared policy require the same version and timestamp', async () => {
  const ctx = {};
  runInNewContext(policy.outputFiles[0].text, ctx);
  assert.equal(ctx.policy.hasPrivacyConsent(accepted), true);
  assert.equal(ctx.policy.hasPrivacyConsent({ ...accepted, privacyConsentTimestamp: NaN }), false);
  assert.equal(ctx.policy.PRIVACY_CONSENT_VERSION, consentVersion);
  assert.ok(
    (await readFile('chrome-extension/public/mcp-permissions.js', 'utf8')).includes(
      `const CONSENT_VERSION = '${consentVersion}'`,
    ),
  );
});
