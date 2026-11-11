import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import * as z from 'zod/v4';
import { util } from 'zod/v4/core';

const require = createRequire(import.meta.url);

for (const [format, schema, utilities] of [
  ['ESM', z, util],
  ['CommonJS', require('zod/v4'), require('zod/v4/core').util],
]) {
  test(`Zod ${format} validates objects without probing code generation`, () => {
    // A caught Function constructor exception would also return false. Count attempts
    // so this catches CSP violations even when the library swallows the exception.
    const original = globalThis.Function;
    let attempts = 0;
    globalThis.Function = new Proxy(original, {
      apply() {
        attempts++;
        throw new Error('CSP forbids Function');
      },
      construct() {
        attempts++;
        throw new Error('CSP forbids Function');
      },
    });
    try {
      assert.equal(utilities.allowsEval.value, false);
      const object = schema.object({ name: schema.string(), count: schema.number().int().min(1) });
      assert.deepEqual(object.parse({ name: 'echo', count: 2 }), { name: 'echo', count: 2 });
      assert.equal(object.safeParse({ name: 'echo', count: 0 }).success, false);
      assert.equal(object.safeParse({ name: 1, count: 2 }).success, false);
      assert.equal(attempts, 0);
    } finally {
      globalThis.Function = original;
    }
  });
}
