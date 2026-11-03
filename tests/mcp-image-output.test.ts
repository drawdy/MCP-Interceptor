import assert from 'node:assert/strict';

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
