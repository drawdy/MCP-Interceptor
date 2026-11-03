import assert from 'node:assert/strict';
import {
  findChatGPTComposer,
  findChatGPTButtonInsertionPoint,
  findChatGPTFileInput,
  findChatGPTFilePreviews,
} from '../pages/content/src/plugins/adapters/chatgpt-composer.ts';
import {
  attachPendingResultImages,
  createResultActionLock,
  insertResultText,
} from '../pages/content/src/render_prescript/src/renderer/resultActions.ts';

import {
  MAX_MCP_IMAGE_BYTES,
  MAX_MCP_IMAGE_COUNT,
  normalizeToolResultContent,
  buildToolResultInsertionText,
} from '../pages/content/src/render_prescript/src/renderer/toolResultContent.ts';

const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=';

const mixed = normalizeToolResultContent(
  {
    content: [
      { type: 'text', text: 'Before the image' },
      { type: 'image', mimeType: 'image/png', data: onePixelPng },
      { type: 'text', text: 'After the image' },
      { type: 'image', mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,/9j/2Q==' },
    ],
  },
  'vision.describe',
  'call/1',
);

assert.equal(mixed.images.length, 2);
assert.deepEqual(
  mixed.segments.map(segment => segment.kind),
  ['text', 'image', 'text', 'image'],
);
assert.equal(mixed.images[0].type, 'image/png');
assert.match(mixed.images[0].name, /^mcp-vision_describe-call_1-image-01\.png$/);
assert.equal(mixed.images[0].size > 0, true);
assert.match(mixed.textForInsertion, /Before the image/);
assert.match(mixed.textForInsertion, /Image not attached/);
assert.match(mixed.textForInsertion, /After the image/);
assert.equal(mixed.textForInsertion.includes(onePixelPng), false);

const attached = new Set([mixed.images[0]]);
const insertionText = buildToolResultInsertionText(mixed.segments, attached);
assert.match(insertionText, /Image attached: .*image-01\.png/);
assert.match(insertionText, /Image not attached: .*image-02\.jpg/);

const dataUri = normalizeToolResultContent(
  { content: [{ type: 'image', data: `data:image/png;base64,${onePixelPng}` }] },
  'preview',
  '1',
);
assert.equal(dataUri.images.length, 1);
assert.equal(dataUri.images[0].type, 'image/png');

const mismatch = normalizeToolResultContent(
  { content: [{ type: 'image', mimeType: 'image/jpeg', data: `data:image/png;base64,${onePixelPng}` }] },
  'preview',
  '2',
);
assert.equal(mismatch.images.length, 0);
assert.match(mismatch.textForInsertion, /does not match/);

const unsupported = normalizeToolResultContent(
  { content: [{ type: 'image', mimeType: 'image/svg+xml', data: onePixelPng }] },
  'preview',
  '3',
);
assert.equal(unsupported.images.length, 0);
assert.match(unsupported.textForInsertion, /unsupported image MIME type/);
assert.equal(unsupported.requiresExplicitAction, true);
assert.equal(mixed.requiresExplicitAction, true);
assert.equal(
  normalizeToolResultContent({ content: [{ type: 'text', text: 'plain' }] }, 'text', '1').requiresExplicitAction,
  false,
);

const malformed = normalizeToolResultContent(
  { content: [{ type: 'image', mimeType: 'image/png', data: 'not-base64!' }] },
  'preview',
  '4',
);
assert.equal(malformed.images.length, 0);
assert.match(malformed.textForInsertion, /not valid Base64/);

const tooLargeData = Buffer.alloc(MAX_MCP_IMAGE_BYTES + 1).toString('base64');
const tooLarge = normalizeToolResultContent(
  { content: [{ type: 'image', mimeType: 'image/png', data: tooLargeData }] },
  'preview',
  '5',
);
assert.equal(tooLarge.images.length, 0);
assert.match(tooLarge.textForInsertion, /per-image limit/);

const manyImages = normalizeToolResultContent(
  {
    content: Array.from({ length: MAX_MCP_IMAGE_COUNT + 1 }, () => ({
      type: 'image',
      mimeType: 'image/png',
      data: onePixelPng,
    })),
  },
  'gallery',
  '6',
);
assert.equal(manyImages.images.length, MAX_MCP_IMAGE_COUNT);
assert.match(manyImages.textForInsertion, /image limit/);

const structured = normalizeToolResultContent({ structuredContent: { ok: true, count: 3 } }, 'structured', '7');
assert.equal(structured.textForInsertion, '{\n  "ok": true,\n  "count": 3\n}');

console.log('MCP image output normalization tests: passed');

// Boundary: the missing Base64 padding must not count as decoded bytes.
const exactLimit = normalizeToolResultContent(
  {
    content: [
      {
        type: 'image',
        mimeType: 'image/png',
        data: Buffer.alloc(MAX_MCP_IMAGE_BYTES).toString('base64').replace(/=+$/, ''),
      },
    ],
  },
  'boundary',
  '8',
);
assert.equal(exactLimit.images[0]?.size, MAX_MCP_IMAGE_BYTES);
const totalLimit = normalizeToolResultContent(
  {
    content: Array.from({ length: 3 }, () => ({
      type: 'image',
      mimeType: 'image/png',
      data: Buffer.alloc(MAX_MCP_IMAGE_BYTES).toString('base64'),
    })),
  },
  'total',
  '9',
);
assert.equal(totalLimit.images.length, 2);
assert.match(totalLimit.textForInsertion, /total image limit/);

const confirmed = new Set<File>();
const attempts: File[] = [];
let rejectSecond = true;
const attach = async (file: File) => {
  attempts.push(file);
  if (file === mixed.images[1] && rejectSecond) throw new Error('Injected upload failure');
  return true;
};
assert.equal(await attachPendingResultImages(mixed.images, confirmed, attach), 1);
assert.deepEqual([...confirmed], [mixed.images[0]]);
rejectSecond = false;
assert.equal(await attachPendingResultImages(mixed.images, confirmed, attach), 0);
assert.deepEqual(attempts, [mixed.images[0], mixed.images[1], mixed.images[1]]);
await attachPendingResultImages(mixed.images, confirmed, attach);
assert.equal(attempts.length, 3);
assert.equal(await attachPendingResultImages([mixed.images[0]], new Set(), async () => false), 1);

const lock = createResultActionLock();
let unlock!: () => void;
let runs = 0;
const pending = lock(async () => {
  runs += 1;
  await new Promise<void>(resolve => {
    unlock = resolve;
  });
});
await lock(async () => {
  runs += 1;
});
assert.equal(runs, 1);
unlock();
await pending;
await assert.rejects(
  lock(async () => {
    throw new Error('Injected action failure');
  }),
);
await lock(async () => {
  runs += 1;
});
assert.equal(runs, 2);

const inserted: string[] = [];
assert.equal(
  await insertResultText(
    {
      insertText: async () => false,
      insertTextIntoInput: async text => {
        inserted.push(text);
      },
    },
    'legacy',
  ),
  true,
);
assert.deepEqual(inserted, ['legacy']);
assert.equal(
  await insertResultText(
    {
      insertText: async () => {
        throw new Error('modern unavailable');
      },
      insertTextIntoInput: async () => false,
    },
    'fail',
  ),
  false,
);
assert.equal(await insertResultText({}, 'unsupported'), false);
await assert.rejects(
  insertResultText(
    {
      insertTextIntoInput: async () => {
        throw new Error('legacy unavailable');
      },
    },
    'fail',
  ),
);
console.log('MCP image manual-action regression tests (controlled adapters): passed');

// ChatGPT retains both home and thread forms. Hidden home fields and unrelated
// previews must never satisfy an insertion or a second-file upload check.
const previousComputedStyle = globalThis.getComputedStyle;
globalThis.getComputedStyle = (() => ({ display: 'block', visibility: 'visible' })) as typeof getComputedStyle;
try {
  const input = {} as HTMLInputElement;
  const previews: HTMLElement[] = [];
  let plus: HTMLElement | null = null;
  const form = {
    querySelector: (selector: string) => (selector.startsWith('input') ? input : plus),
    querySelectorAll: () => previews,
  };
  const element = (visible: boolean, filename = '') =>
    ({
      isConnected: true,
      getBoundingClientRect: () => ({ width: visible ? 400 : 0, height: visible ? 30 : 0 }),
      closest: (selector: string) => (selector === 'form' ? form : null),
      getAttribute: (name: string) => (name === 'alt' ? filename : null),
      textContent: '',
    }) as unknown as HTMLElement;
  const hiddenHome = element(false);
  const activeThread = element(true);
  const root = { querySelectorAll: () => [hiddenHome, activeThread] } as unknown as ParentNode;
  assert.equal(findChatGPTComposer(root), activeThread);
  assert.equal(findChatGPTComposer({ querySelectorAll: () => [hiddenHome] } as unknown as ParentNode), null);
  assert.equal(findChatGPTFileInput(activeThread), input);
  const toolbar = {} as Element;
  plus = Object.assign(element(true), { parentElement: toolbar });
  assert.deepEqual(findChatGPTButtonInsertionPoint(activeThread), { container: toolbar, insertAfter: plus });
  plus = element(false);
  assert.equal(findChatGPTButtonInsertionPoint(activeThread), null);
  previews.push(element(true, 'first.png'), element(false, 'second.jpg'));
  assert.equal(findChatGPTFilePreviews(activeThread, 'second.jpg').length, 0);
  const second = element(true, 'second.jpg');
  previews.push(second);
  assert.deepEqual(findChatGPTFilePreviews(activeThread, 'second.jpg'), [second]);
} finally {
  globalThis.getComputedStyle = previousComputedStyle;
}
console.log('ChatGPT active-composer regression tests: passed');
