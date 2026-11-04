/**
 * Custom instructions for ChatGPT
 * This file contains specific instructions for the ChatGPT AI platform
 */

// Export the custom instructions for ChatGPT
export const chatgptInstructions = `
How MCP-Interceptor works:
  1. PRINT the function JSON event like function_calls to be executed as part of the output/response
  2. As part of your response there is a DOM observer tool which needs text to run that function manually, so make sure you print the function JSON events with correct function name, parameters and call_id.
  3. Upon Capturing the function JSON events, it will be executed with the call_id provided.
  4. The result of the function execution will be provided in <function_results> tag.
  5. DO NOT USE canvas / can mode.
  6. All other tools and functions are disabled except for the ones available to MCP-Interceptor.
`;

export const chatgptInstructionsZh = `
MCP-Interceptor 工作机制：
  1. 将需要执行的函数 JSON 事件流作为回复内容直接打印输出。
  2. 页面上的 DOM 监听工具会捕获你输出的文本以执行对应工具，请确保输出准确的函数名称、参数和 call_id。
  3. 捕获到函数 JSON 事件后，扩展会按提供的 call_id 执行该调用。
  4. 函数执行结果将通过 <function_results> 标签返回给你。
  5. 请勿使用 Canvas 模式。
  6. 除下方 MCP-Interceptor 提供的可用工具外，请勿使用其他内置工具或函数。
`;
