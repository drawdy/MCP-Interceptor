import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';

const validator = new CfWorkerJsonSchemaValidator({
  draft: '2020-12',
  shortcircuit: false,
});

const client = new Client(
  { name: 'mcp-interceptor-csp-test', version: '1.0.0' },
  { capabilities: {}, jsonSchemaValidator: validator },
);

assert.equal(client._jsonSchemaValidator, validator, 'MCP Client must use the explicit CSP-safe validator');

const validate = validator.getValidator({
  type: 'object',
  required: ['name', 'options'],
  properties: {
    name: { type: 'string', minLength: 1 },
    options: {
      type: 'object',
      required: ['count'],
      properties: {
        count: { type: 'integer', minimum: 1 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
});

assert.equal(validate({ name: 'search', options: { count: 2 } }).valid, true);

const invalidInputs = [
  { name: 'search' },
  { name: 'search', options: { count: 'two' } },
  { name: 'search', options: { count: 2, unknown: true } },
  { name: 'search', options: { count: 2 }, unauthorized: true },
];

for (const input of invalidInputs) {
  const result = validate(input);
  assert.equal(result.valid, false, JSON.stringify(input));
  assert.ok(result.errorMessage, 'invalid payload must expose a validation error');
}

console.log('MCP CSP-safe JSON Schema validator tests: passed');
