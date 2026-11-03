// The Ajv provider is intentionally disabled in MV3.
// This prevents ajv-formats from loading Ajv internals that use code generation.
export default function disabledAjvFormats(): never {
  throw new Error('ajv-formats is disabled in MV3; configure CfWorkerJsonSchemaValidator instead.');
}
