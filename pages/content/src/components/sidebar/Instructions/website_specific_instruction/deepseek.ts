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

export const deepseekInstructionsZh = `
## DeepSeek 工具调用格式（严格遵循）

当需要调用工具时，必须且只能输出一个以 \`\`\`jsonl 包裹的代码块。代码块内的每一行必须是一个完整、合法的单行 JSON 对象，严禁将单个 JSON 对象跨多行缩进输出。

唯一支持的事件行序列如下：
1. function_call_start：
   {"type":"function_call_start","name":"EXACT_TOOL_NAME","call_id":1}
2. description：
   {"type":"description","text":"简短说明该函数的作用"}
3. 每个参数各占一行 parameter 事件：
   {"type":"parameter","key":"ARGUMENT_NAME","value":"ARGUMENT_VALUE"}
4. function_call_end：
   {"type":"function_call_end","call_id":1}

规则：
- 严禁使用 JSON 数组、单个 {"name":...,"parameters":...} 对象、OpenAI tool_calls 语法、XML 或任何其他函数调用格式。
- 工具名称和参数名称必须与下方可用工具列表中的名称完全一致。
- 必须包含所有必填参数；可选参数仅在需要时提供。
- 参数的 value 必须是合法的 JSON 值：字符串加双引号，数字和布尔值不加引号，结构化数据使用 JSON 对象或数组。
- 每次回复只允许发起一次工具调用。后续每次工具调用的 call_id 数字递增 1。
- 严禁编造或模拟工具执行结果。输出工具调用后立即停止，等待扩展执行并返回结果后再继续回答。
- 如果不需要调用工具，请直接正常回答，不要输出工具调用代码块。
`;
