// Ajv's runtime code generation is not allowed in MV3 service workers.
// MCP-Interceptor supplies CfWorkerJsonSchemaValidator explicitly.
export default class DisabledAjv {
  constructor() {
    throw new Error('Ajv is disabled in MV3; configure CfWorkerJsonSchemaValidator instead.');
  }
}
