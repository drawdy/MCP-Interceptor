import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Bundle the actual extension client so the test exercises its SDK configuration.
const directory = await mkdtemp(join(tmpdir(), 'mcp-csp-'));
after(() => rm(directory, { recursive: true, force: true }));
const outfile = join(directory, 'client.mjs');
await build({
  entryPoints: [new URL('../src/mcpclient/core/McpClient.ts', import.meta.url).pathname],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  define: { 'import.meta.env': '{"PROD":true,"DEV":false}' },
});
const { McpClient } = await import(pathToFileURL(outfile).href);

const background = await build({
  entryPoints: [new URL('../src/background/index.ts', import.meta.url).pathname],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  define: { 'import.meta.env': '{"PROD":true,"DEV":false}', 'process.env': '{}' },
});

for (const configured of [false, true]) {
  test(`reconnect reports ${configured ? 'missing host permission' : 'missing configuration'} without an exception`, async () => {
    let onMessage;
    let networkCalls = 0;
    const errors = [];
    const listener = { addListener() {} };
    const context = {
      URL,
      Event,
      EventTarget,
      TransformStream,
      ReadableStream,
      WritableStream,
      Headers,
      Request,
      Response,
      crypto,
      AbortController,
      TextDecoder,
      TextEncoder,
      console: { ...console, error: (...args) => errors.push(args) },
      setTimeout: () => 0,
      clearTimeout() {},
      setInterval: () => 0,
      clearInterval() {},
      addEventListener() {},
      fetch: () => {
        networkCalls++;
        throw new Error('Unexpected network request');
      },
      chrome: {
        runtime: {
          id: 'csp-test',
          onInstalled: listener,
          onStartup: listener,
          onMessage: {
            addListener(callback) {
              onMessage = callback;
            },
          },
        },
        storage: {
          onChanged: listener,
          local: {
            onChanged: listener,
            get: async () => (configured ? { mcpServerUrl: 'http://localhost:3006/sse' } : {}),
            set: async () => {},
          },
        },
        permissions: { contains: async () => false },
        tabs: { query: (_query, callback) => callback([]) },
      },
    };
    context.self = context;
    runInNewContext(background.outputFiles[0].text, context, {
      contextCodeGeneration: { strings: false, wasm: false },
    });
    const response = await new Promise(resolve => onMessage({ type: 'mcp:force-reconnect', payload: {} }, {}, resolve));
    assert.equal(response.success, true);
    assert.equal(response.payload.isConnected, false);
    assert.match(response.payload.error, configured ? /Grant access and connect/ : /Configure an MCP server/);
    assert.equal(networkCalls, 0);
    assert.deepEqual(errors, []);
  });
}

test('dynamic code generation is disabled for this regression test', () => {
  assert.throws(() => new Function('return true'), EvalError);
});

for (const type of ['sse', 'websocket', 'streamable-http']) {
  test(`${type}: tools with outputSchema work under MV3 code generation restrictions`, async t => {
    const server = new Server({ name: 'csp-test', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        {
          name: 'echo',
          inputSchema: { type: 'object' },
          outputSchema: {
            type: 'object',
            properties: { content: { type: 'string' } },
            required: ['content'],
            additionalProperties: false,
          },
        },
      ],
    }));
    server.setRequestHandler(CallToolRequestSchema, request => ({
      content: [{ type: 'text', text: 'echo' }],
      structuredContent: request.params.arguments,
    }));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new McpClient({ global: { healthCheckInterval: 0 } });
    t.after(async () => {
      await client.disconnect();
      await server.close();
    });
    // Substitute only the network transport, preserving the production Client creation.
    client.registry.getInitializedPlugin = async () => ({
      metadata: { transportType: type },
      isSupported: () => true,
      isConnected: () => true,
      isHealthy: async () => true,
      connect: async () => clientTransport,
      disconnect: async () => clientTransport.close(),
      getPrimitives: async sdk => (await sdk.listTools()).tools.map(value => ({ type: 'tool', value })),
      callTool: (sdk, name, args) => sdk.callTool({ name, arguments: args }),
    });
    await client.connect({ uri: 'http://localhost:3006', type });
    const primitives = await client.getPrimitives(true);
    assert.equal(primitives.tools[0].name, 'echo');
    const valid = await client.callTool('echo', { content: 'hello' });
    assert.deepEqual(valid.structuredContent, { content: 'hello' });
    await assert.rejects(client.callTool('echo', {}), /output schema/i);
    await assert.rejects(client.callTool('echo', { content: 123 }), /output schema/i);
    await assert.rejects(client.callTool('echo', { content: 'hello', extra: true }), /output schema/i);
  });
}
