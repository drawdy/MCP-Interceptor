import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * @prop default_locale
 * if you want to support multiple languages, you can use the following reference
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
 *
 * @prop browser_specific_settings
 * Must be unique to your extension to upload to addons.mozilla.org
 * (you can delete if you only want a chrome extension)
 *
 * @prop permissions
 * Firefox doesn't support sidePanel (It will be deleted in manifest parser)
 *
 * @prop content_scripts
 * css: ['content.css'], // public folder
 */
const manifest = {
  manifest_version: 3,
  name: 'MCP-Interceptor',
  version: packageJson.version,
  description: 'Connect MCP tools to supported AI chat websites through a user-configured MCP server.',
  // The MCP endpoint is user-configured. Ask for access to only that host at runtime.
  optional_host_permissions: ['http://*/*', 'https://*/*'],

  permissions: ['storage', 'clipboardWrite'],
  // permissions: ['storage', 'scripting', 'clipboardWrite'],
  // options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_popup: 'mcp-permissions.html',
    default_title: 'MCP-Interceptor',
    default_icon: 'icon-34.png',
  },
  // chrome_url_overrides: {
  //   newtab: 'new-tab/index.html',
  // },
  icons: {
    128: 'icon-128.png',
    34: 'icon-34.png',
    16: 'icon-16.png',
  },
  content_scripts: [
    // {
    //   matches: ['http://*/*', 'https://*/*', '<all_urls>'],
    //   js: ['content/index.iife.js'],
    // },
    // Specific content script for perplexity.ai tool call parsing
    {
      matches: ['*://*.perplexity.ai/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for ChatGPT tool call parsing
    {
      matches: ['*://*.chat.openai.com/*', '*://*.chatgpt.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for grok.com tool call parsing
    {
      matches: ['*://*.grok.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for x.com and twitter.com tool call parsing (Grok integration)
    {
      matches: ['*://*.x.com/i/grok*', '*://*.twitter.com/i/grok*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for Gemini tool call parsing
    {
      matches: ['*://*.gemini.google.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for AiStudio tool call parsing
    {
      matches: ['*://*.aistudio.google.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for OpenRouter tool call parsing
    {
      matches: ['*://*.openrouter.ai/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for DeepSeek tool call parsing
    {
      matches: ['*://*.chat.deepseek.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for Kagi tool call parsing
    {
      matches: ['*://*.kagi.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for T3 Chat tool call parsing
    {
      matches: ['*://*.t3.chat/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for Mistral AI tool call parsing
    {
      matches: ['*://*.chat.mistral.ai/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for GitHub Copilot tool call parsing
    {
      matches: ['*://github.com/copilot/*', '*://copilot.github.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for Kimi
    {
      matches: ['*://*.kimi.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    // Specific content script for chat.z.ai and zchat.z.ai
    {
      matches: ['*://*.chat.z.ai/*', '*://*.zchat.z.ai/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    {
      matches: ['*://*.chat.qwen.ai/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
  ],
  // devtools_page: 'devtools/index.html',
  web_accessible_resources: [
    {
      resources: [
        '*.js',
        '*.css',
        'content/*.css',
        'content/runtime.iife.js',
        '*.svg',
        'icon-128.png',
        'icon-34.png',
        'icon-16.png',
      ],
      matches: [] as string[], // Filled from the content-script allowlist below.
    },
  ],
  // side_panel: {
  //   default_path: 'side-panel/index.html',
  // },
} satisfies chrome.runtime.ManifestV3;

// Chrome WAR matches are origin patterns: their path must be /* even when a
// content script is limited to /i/grok* or /copilot/* on the same origin.
manifest.web_accessible_resources[0].matches = [
  ...new Set(
    manifest.content_scripts.flatMap(script =>
      script.matches.map(pattern => pattern.replace(/(\*:\/\/[^/]+)\/.*$/, '$1/*')),
    ),
  ),
];

export default manifest;
