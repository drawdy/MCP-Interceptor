import assert from 'node:assert/strict';

Object.defineProperty(globalThis, 'window', {
  value: {
    location: { href: 'https://chatgpt.com/', hostname: 'chatgpt.com' },
    addEventListener: () => undefined,
  },
  configurable: true,
});

const { containsJSONFunctionCalls, extractJSONParameters } = await import(
  '../pages/content/src/render_prescript/src/parser/jsonFunctionParser.ts'
);
const { getRawFunctionContent } = await import(
  '../pages/content/src/render_prescript/src/renderer/functionBlock.ts'
);

const multilineArrayCall = [
  '```jsonl',
  '{"type":"function_call_start","name":"create_project_artifact_from_lines","call_id":1}',
  '{"type":"parameter","key":"project_name","value":"PathAI_V2"}',
  '{"type":"parameter","key":"content_lines","value":[',
  '  "# Architecture",',
  '  "",',
  '  "```python",',
  '  "payload = {\\"nested\\": true}",',
  '  "```"',
  ']}',
  '{"type":"function_call_end","call_id":1}',
  '```',
].join('\n');

assert.deepEqual(extractJSONParameters(multilineArrayCall), {
  project_name: 'PathAI_V2',
  content_lines: ['# Architecture', '', '```python', 'payload = {"nested": true}', '```'],
});

const nestedObjectCall = [
  '{"type":"function_call_start","name":"example","call_id":2}',
  '{',
  '  "type": "parameter",',
  '  "key": "settings",',
  '  "value": {',
  '    "policy": {"mode": "strict", "roles": ["owner", "teacher"]},',
  '    "enabled": true',
  '  }',
  '}',
  '{"type":"function_call_end","call_id":2}',
].join('\n');

assert.deepEqual(extractJSONParameters(nestedObjectCall), {
  settings: {
    policy: { mode: 'strict', roles: ['owner', 'teacher'] },
    enabled: true,
  },
});

const compactValuesCall = [
  '{"type":"function_call_start","name":"example","call_id":3}',
  '{"type":"parameter","key":"name","value":"unchanged"}',
  '{"type":"parameter","key":"count","value":4}',
  '{"type":"parameter","key":"enabled","value":true}',
  '{"type":"parameter","key":"nullable","value":null}',
  '{"type":"function_call_end","call_id":3}',
].join('\n');

assert.deepEqual(extractJSONParameters(compactValuesCall), {
  name: 'unchanged',
  count: 4,
  enabled: true,
  nullable: null,
});

const partialStringCall = [
  '{"type":"function_call_start","name":"example","call_id":4}',
  '{"type":"parameter","key":"content","value":"partial text still streaming',
].join('\n');

assert.deepEqual(extractJSONParameters(partialStringCall), {
  content: 'partial text still streaming',
});

const chatgptJsonl = [
  '{"type":"function_call_start","name":"search_docs","call_id":"call_42"}',
  '{"type":"parameter","key":"query","value":"chatgpt auto execute"}',
  '{"type":"function_call_end","call_id":"call_42"}',
].join('\n');

const codeElement = {
  tagName: 'CODE',
  textContent: chatgptJsonl,
  closest: () => null,
  hasAttribute: () => false,
  getAttribute: () => null,
  querySelector: () => null,
  cloneNode: () => ({ textContent: chatgptJsonl, querySelectorAll: () => [] }),
} as unknown as HTMLElement;

const preWrapperWithHeaderAndRenderedBlock = {
  tagName: 'PRE',
  textContent: `jsonl\nCopy\n${chatgptJsonl}\nsearch_docsRun`,
  closest: () => null,
  hasAttribute: () => false,
  getAttribute: () => null,
  querySelector: (selector: string) => {
    if (selector === 'code:not(.function-block code)') return codeElement;
    if (selector === '.function-block') return {} as Element;
    return null;
  },
} as unknown as HTMLElement;

const parsedNested = containsJSONFunctionCalls(preWrapperWithHeaderAndRenderedBlock);
assert.equal(parsedNested.hasFunctionCalls, true);
assert.equal(parsedNested.isComplete, true);
assert.equal(parsedNested.invokeName, 'search_docs');
assert.equal(getRawFunctionContent(preWrapperWithHeaderAndRenderedBlock, true), chatgptJsonl);

console.log('json-function-parser multiline regression tests: passed');
