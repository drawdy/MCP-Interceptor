import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';

test('codemirror-accessor stopMonitoring cleans up without throwing TypeError', () => {
  const code = readFileSync(fileURLToPath(new URL('../public/codemirror-accessor.js', import.meta.url)), 'utf8');

  const listeners = {};
  const fakeWindow = {
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
    removeEventListener() {},
    location: { href: 'https://chat.z.ai/' },
  };

  const makeElement = (tag = 'div', classes = []) => ({
    nodeType: 1,
    tagName: tag.toUpperCase(),
    classList: {
      contains: cls => classes.includes(cls),
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    appendChild: () => {},
    remove: () => {},
  });

  const fakeEditor = makeElement('div', ['cm-editor']);

  const fakeDocument = {
    readyState: 'complete',
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll(sel) {
      if (sel === '.cm-editor') return [fakeEditor];
      return [];
    },
    body: makeElement('body'),
    createElement: tag => makeElement(tag),
  };

  class FakeMutationObserver {
    observe() {}
    disconnect() {}
  }

  const sandbox = {
    window: fakeWindow,
    document: fakeDocument,
    MutationObserver: FakeMutationObserver,
    console: { ...console, debug: () => {} },
    Node: { ELEMENT_NODE: 1 },
    requestAnimationFrame: () => {},
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  assert.ok(sandbox.window.CodeMirrorAccessor, 'CodeMirrorAccessor should be exposed');
  assert.equal(typeof sandbox.window.CodeMirrorAccessor.stop, 'function');

  // Verify beforeunload listener cleans up without throwing
  assert.doesNotThrow(() => {
    listeners['beforeunload']();
  }, 'beforeunload handler must not throw TypeError when iterating monitored editors');

  // Verify direct stop() call also runs cleanly
  assert.doesNotThrow(() => {
    sandbox.window.CodeMirrorAccessor.stop();
  }, 'stop() must not throw');
});

test('manifest content_scripts matches include both chat.z.ai and zchat.z.ai', async () => {
  const manifestModule = await import(fileURLToPath(new URL('../manifest.ts', import.meta.url)));
  const manifest = manifestModule.default;
  const zEntry = manifest.content_scripts.find(entry => entry.matches.some(pattern => pattern.includes('chat.z.ai')));
  assert.ok(zEntry, 'Must have a content_script entry for Z.ai');
  assert.ok(zEntry.matches.includes('*://*.chat.z.ai/*'), 'Matches must contain *://*.chat.z.ai/*');
  assert.ok(zEntry.matches.includes('*://*.zchat.z.ai/*'), 'Matches must contain *://*.zchat.z.ai/*');
});

test('mcp-permissions.js hosts include zchat.z.ai', () => {
  const permissionsCode = readFileSync(fileURLToPath(new URL('../public/mcp-permissions.js', import.meta.url)), 'utf8');
  assert.match(permissionsCode, /'zchat\.z\.ai'/, 'mcp-permissions.js must include zchat.z.ai host');
});
