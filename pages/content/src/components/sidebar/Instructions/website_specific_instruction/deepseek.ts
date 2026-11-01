/**
 * DeepSeek-specific instructions for MCP-Interceptor.
 *
 * Keep the output format explicit because the extension parses a JSONL event
 * stream from the rendered assistant response; this is not native tool calling.
 */
export const deepseekInstructions = `
## DeepSeek tool-call format (strict)

When a tool is needed, output exactly one fenced jsonl code block. Each line
inside the block must be one complete, valid JSON object. Do not pretty-print
an object across multiple lines.

The only supported event sequence is:
1. function_call_start:
   {"type":"function_call_start","name":"EXACT_TOOL_NAME","call_id":1}
2. description:
   {"type":"description","text":"Short description"}
3. One parameter event for each argument:
   {"type":"parameter","key":"ARGUMENT_NAME","value":"ARGUMENT_VALUE"}
4. function_call_end:
   {"type":"function_call_end","call_id":1}

Rules:
- Do not use a JSON array, a single {"name":...,"parameters":...} object,
  OpenAI tool_calls syntax, XML, or any other function-call format.
- Use the exact tool name and parameter names from AVAILABLE TOOLS.
- Include every required parameter. Omit optional parameters unless needed.
- The parameter value must be valid JSON: quote strings, keep numbers and
  booleans unquoted, and use JSON objects or arrays for structured values.
- Use one tool call per response. Increment the numeric call_id for each
  subsequent tool call.
- Do not invent execution results. Wait for the extension to run the call and
  return its result before continuing.
- If no tool is needed, answer normally without emitting a function-call block.
`;
