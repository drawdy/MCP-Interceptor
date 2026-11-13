import assert from 'node:assert/strict';
import {
  findChatGPTComposer,
  findChatGPTButtonInsertionPoint,
  findChatGPTFileInput,
  findChatGPTFilePreviews,
  findChatGPTSubmitButton,
  isChatGPTStopButtonVisible,
} from '../pages/content/src/plugins/adapters/chatgpt-composer.ts';
import {
  attachPendingResultImages,
  createResultActionLock,
  insertResultText,
} from '../pages/content/src/render_prescript/src/renderer/resultActions.ts';

import {
  PUSH_MODE_STYLE_ID,
  applyPushModeDomStyles,
  clearPushModeDomStyles,
  ensurePushModeStylesheet,
  getPushModeStylesheetText,
  isPushModeDomIntact,
  updatePushModeDomWidth,
} from '../pages/content/src/components/sidebar/base/pushMode.ts';
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

  const makeButton = (visible: boolean, disabled = false, attrs: Record<string, string> = {}) =>
    Object.assign(element(visible), {
      disabled,
      hasAttribute: (name: string) => (name === 'disabled' ? disabled : name in attrs),
      getAttribute: (name: string) => attrs[name] ?? null,
    }) as unknown as HTMLButtonElement;

  const hiddenHomeSend = makeButton(false, false, { 'data-testid': 'send-button' });
  const disabledThreadSend = makeButton(true, true, { 'data-testid': 'send-button' });
  const enabledThreadSend = makeButton(true, false, { 'data-testid': 'send-button' });
  const hiddenStop = makeButton(false, false, { 'data-testid': 'stop-button' });
  const visibleStop = makeButton(true, false, { 'data-testid': 'stop-button' });

  let formButtons: HTMLButtonElement[] = [disabledThreadSend];
  const scopedForm = {
    querySelectorAll: () => formButtons,
  };
  const scopedComposer = {
    isConnected: true,
    closest: (selector: string) => (selector === 'form' ? scopedForm : null),
  } as unknown as HTMLElement;
  const scopedRoot = {
    querySelectorAll: () => [hiddenHomeSend, enabledThreadSend],
  } as unknown as ParentNode;

  assert.equal(findChatGPTSubmitButton(scopedComposer, scopedRoot), enabledThreadSend);
  formButtons = [disabledThreadSend, enabledThreadSend];
  assert.equal(findChatGPTSubmitButton(scopedComposer, { querySelectorAll: () => [hiddenHomeSend] } as unknown as ParentNode), enabledThreadSend);
  formButtons = [disabledThreadSend];
  assert.equal(findChatGPTSubmitButton(scopedComposer, { querySelectorAll: () => [hiddenHomeSend] } as unknown as ParentNode), null);

  formButtons = [hiddenStop];
  assert.equal(isChatGPTStopButtonVisible(scopedComposer, scopedRoot), false);
  formButtons = [visibleStop];
  assert.equal(isChatGPTStopButtonVisible(scopedComposer, scopedRoot), true);
} finally {
  globalThis.getComputedStyle = previousComputedStyle;
}
console.log('ChatGPT active-composer regression tests: passed');

// Push content mode regression tests for full-viewport layouts like ChatGPT (.w-screen)
const createMockStyle = () => {
  const props = new Map<string, string>();
  return {
    setProperty: (name: string, value: string) => {
      props.set(name, value);
    },
    removeProperty: (name: string) => {
      props.delete(name);
    },
    getPropertyValue: (name: string) => props.get(name) ?? '',
  };
};

const createMockClassList = (initial: string[] = []) => {
  const classes = new Set<string>(initial);
  return {
    add: (...tokens: string[]) => tokens.forEach(token => classes.add(token)),
    remove: (...tokens: string[]) => tokens.forEach(token => classes.delete(token)),
    contains: (token: string) => classes.has(token),
  };
};

const headChildren: Array<{ id?: string; textContent: string | null }> = [];
const mockHtml = {
  style: createMockStyle(),
  classList: createMockClassList(['push-mode-transform']),
};
mockHtml.style.setProperty('transform', 'translateX(-320px)');
const mockBody = {
  style: createMockStyle(),
};
const mockDoc = {
  documentElement: mockHtml,
  body: mockBody,
  head: {
    appendChild: (el: { id?: string; textContent: string | null }) => {
      headChildren.push(el);
      return el;
    },
  },
  getElementById: (id: string) => headChildren.find(el => el.id === id) ?? null,
  createElement: () => ({ id: '', textContent: '' }),
} as unknown as Document;

const pushCss = getPushModeStylesheetText();
assert.equal(pushCss.includes('!important,'), false);
assert.match(pushCss, /html\.push-mode-enabled[\s\S]*width:\s*calc\(100%\s*-\s*var\(--sidebar-width-mcp,\s*320px\)\)\s*!important/);
assert.match(pushCss, /html\.push-mode-enabled\s+\.w-screen/);
assert.match(pushCss, /html\.push-mode-enabled\s+body\s*>\s*div:not\(#mcp-sidebar-shadow-host\)/);
assert.match(pushCss, /max-width:\s*100%\s*!important/);

const styleEl = ensurePushModeStylesheet(mockDoc);
assert.equal(styleEl?.id, PUSH_MODE_STYLE_ID);
assert.equal(headChildren.length, 1);
ensurePushModeStylesheet(mockDoc);
assert.equal(headChildren.length, 1);

applyPushModeDomStyles(360, false, mockDoc);
assert.equal(mockHtml.classList.contains('push-mode-transform'), false);
assert.equal(mockHtml.style.getPropertyValue('transform'), '');
assert.equal(mockHtml.style.getPropertyValue('--sidebar-width-mcp'), '360px');
assert.equal(mockHtml.style.getPropertyValue('margin-right'), '360px');
assert.equal(mockHtml.style.getPropertyValue('width'), 'calc(100% - 360px)');
assert.equal(mockHtml.style.getPropertyValue('max-width'), 'calc(100% - 360px)');
assert.equal(mockBody.style.getPropertyValue('width'), '100%');
assert.equal(mockBody.style.getPropertyValue('max-width'), '100%');
assert.equal(isPushModeDomIntact(360, false, mockDoc), true);

// Host page clears class or body max-width -> detected as not intact and restored cleanly
mockHtml.classList.remove('push-mode-enabled');
assert.equal(isPushModeDomIntact(360, false, mockDoc), false);
applyPushModeDomStyles(360, false, mockDoc);
assert.equal(isPushModeDomIntact(360, false, mockDoc), true);

updatePushModeDomWidth(420, mockDoc);
assert.equal(isPushModeDomIntact(420, false, mockDoc), true);
assert.equal(mockHtml.style.getPropertyValue('max-width'), 'calc(100% - 420px)');

clearPushModeDomStyles(mockDoc);
assert.equal(isPushModeDomIntact(420, false, mockDoc), false);
assert.equal(mockHtml.style.getPropertyValue('--sidebar-width-mcp'), '');
assert.equal(mockHtml.style.getPropertyValue('margin-right'), '');
assert.equal(mockBody.style.getPropertyValue('max-width'), '');
console.log('Push content mode regression tests: passed');
