(() => {
  const serverUrlInput = document.getElementById('server-url');
  const connectionTypeSelect = document.getElementById('connection-type');
  const serverHostElement = document.getElementById('server-host');
  const grantButton = document.getElementById('grant-connect');
  const statusElement = document.getElementById('status');
  const langToggleButton = document.getElementById('lang-toggle');
  const headerSubtitle = document.getElementById('header-subtitle');
  const labelServerUrl = document.getElementById('label-server-url');
  const labelTransport = document.getElementById('label-transport');
  const proxyDocHint = document.getElementById('proxy-doc-hint');
  const footerNote = document.getElementById('footer-note');
  const labelSitesTitle = document.getElementById('label-sites-title');
  const sitesSummary = document.getElementById('sites-summary');
  const sitesDesc = document.getElementById('sites-desc');
  const sitesListElement = document.getElementById('sites-list');

  const CONSENT_VERSION = '2026-11-06';
  const consentKeys = ['privacyConsentGranted', 'privacyConsentVersion', 'privacyConsentTimestamp'];
  const agreeButton = document.getElementById('privacy-agree');
  const revokeButton = document.getElementById('privacy-revoke');
  let consentGranted = false;

  function renderPrivacy() {
    const zh = currentLang === 'zh';
    document.getElementById('privacy-disclosure').textContent = zh
      ? '同意后，本扩展会读取已启用 AI 网站的对话内容以识别工具名称、参数及结果。工具调用发送至您配置的 MCP 服务器（本地、企业或第三方）；历史与结果保存在本机，结果可插入或自动提交给 AI 服务商。无遥测。主机权限需另外授权。撤销授权会刷新已启用的对话页，以停止全部监控；未发送的输入可能丢失。'
      : 'After you agree, this extension reads conversations on enabled AI sites to recognize tool names, arguments and results. Calls go to your configured MCP server (local, enterprise or third party). History and results are stored locally; results can be inserted or automatically submitted to the AI provider. No telemetry. Server host access requires a separate grant. Revoking consent reloads enabled chat pages to stop all monitoring; unsent input may be lost.';
    document.getElementById('privacy-status').textContent = consentGranted
      ? zh
        ? '已同意当前隐私政策。'
        : 'Current privacy policy accepted.'
      : zh
        ? '未授权：页面内容处理已关闭。'
        : 'Not authorized: page-content processing is off.';
    agreeButton.textContent = zh ? '我同意并启用页面内容处理' : 'I agree — enable page-content processing';
    revokeButton.textContent = zh ? '撤销隐私授权' : 'Revoke privacy consent';
    agreeButton.disabled = consentGranted;
    revokeButton.disabled = !consentGranted;
  }

  agreeButton.addEventListener('click', async () => {
    await chrome.storage.local.set({
      privacyConsentGranted: true,
      privacyConsentVersion: CONSENT_VERSION,
      privacyConsentTimestamp: Date.now(),
    });
  });
  revokeButton.addEventListener('click', async () => {
    await chrome.storage.local.set({
      privacyConsentGranted: false,
      privacyConsentVersion: '',
      privacyConsentTimestamp: 0,
    });
  });
  document.getElementById('privacy-clear').addEventListener('click', async () => {
    await chrome.storage.local.clear();
    location.reload();
  });
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !consentKeys.some(key => key in changes)) return;
    const stored = await chrome.storage.local.get(consentKeys);
    consentGranted =
      stored.privacyConsentGranted === true &&
      stored.privacyConsentVersion === CONSENT_VERSION &&
      Number.isFinite(stored.privacyConsentTimestamp) &&
      stored.privacyConsentTimestamp > 0;
    renderPrivacy();
    updatePermissionSummary();
  });

  let connectionType = 'sse';
  let currentLang = 'en';
  let disabledSites = [];
  let activeTabSiteId = '';

  const SUPPORTED_SITES = [
    {
      id: 'chatgpt.com',
      labelEn: 'ChatGPT (chatgpt.com)',
      labelZh: 'ChatGPT (chatgpt.com)',
      hosts: ['chatgpt.com', 'chat.openai.com'],
    },
    {
      id: 'gemini.google.com',
      labelEn: 'Google Gemini (gemini.google.com)',
      labelZh: 'Google Gemini (gemini.google.com)',
      hosts: ['gemini.google.com'],
    },
    {
      id: 'aistudio.google.com',
      labelEn: 'Google AI Studio (aistudio.google.com)',
      labelZh: 'Google AI Studio (aistudio.google.com)',
      hosts: ['aistudio.google.com'],
    },
    {
      id: 'chat.deepseek.com',
      labelEn: 'DeepSeek (chat.deepseek.com)',
      labelZh: 'DeepSeek (chat.deepseek.com)',
      hosts: ['chat.deepseek.com'],
    },
    {
      id: 'perplexity.ai',
      labelEn: 'Perplexity (perplexity.ai)',
      labelZh: 'Perplexity (perplexity.ai)',
      hosts: ['perplexity.ai'],
    },
    {
      id: 'grok.com',
      labelEn: 'Grok (grok.com / x.com)',
      labelZh: 'Grok (grok.com / x.com)',
      hosts: ['grok.com', 'x.com', 'twitter.com'],
    },
    { id: 'kimi.com', labelEn: 'Kimi (kimi.com)', labelZh: 'Kimi (kimi.com)', hosts: ['kimi.com'] },
    {
      id: 'chat.qwen.ai',
      labelEn: 'Qwen Chat (chat.qwen.ai)',
      labelZh: '通义千问 Qwen (chat.qwen.ai)',
      hosts: ['chat.qwen.ai'],
    },
    {
      id: 'chat.z.ai',
      labelEn: 'Z.ai / GLM (chat.z.ai / zchat.z.ai)',
      labelZh: '智谱 Z.ai (chat.z.ai / zchat.z.ai)',
      hosts: ['chat.z.ai', 'zchat.z.ai', 'z.ai'],
    },
    {
      id: 'openrouter.ai',
      labelEn: 'OpenRouter (openrouter.ai)',
      labelZh: 'OpenRouter (openrouter.ai)',
      hosts: ['openrouter.ai'],
    },
    {
      id: 'chat.mistral.ai',
      labelEn: 'Mistral Chat (chat.mistral.ai)',
      labelZh: 'Mistral Chat (chat.mistral.ai)',
      hosts: ['chat.mistral.ai'],
    },
    { id: 't3.chat', labelEn: 'T3 Chat (t3.chat)', labelZh: 'T3 Chat (t3.chat)', hosts: ['t3.chat'] },
    {
      id: 'github.com/copilot',
      labelEn: 'GitHub Copilot (github.com/copilot)',
      labelZh: 'GitHub Copilot (github.com/copilot)',
      hosts: ['copilot.github.com', 'github.com'],
    },
    { id: 'kagi.com', labelEn: 'Kagi (kagi.com)', labelZh: 'Kagi (kagi.com)', hosts: ['kagi.com'] },
  ];

  function resolveSiteId(hostname) {
    const raw = (hostname || '')
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
    if (!raw) return '';
    for (const site of SUPPORTED_SITES) {
      if (site.id === raw) return site.id;
      for (const h of site.hosts) {
        if (raw === h || raw.endsWith('.' + h)) {
          return site.id;
        }
      }
    }
    return raw;
  }

  const I18N = {
    en: {
      toggleLabel: '中文',
      toggleTitle: '切换到中文',
      subtitle: 'Configure and connect to your MCP server.',
      serverEndpoint: 'MCP SERVER ENDPOINT',
      transport: 'TRANSPORT',
      docPrefix: 'To run the Proxy Server, see the ',
      docLinkText: 'documentation',
      docSuffix: '.',
      docUrl: 'https://github.com/drawdy/MCP-Interceptor/blob/main/README.md',
      grantConnect: 'Grant access and connect',
      loadingConfig: 'Loading server configuration…',
      footer:
        'On supported AI chat pages, this extension reads visible responses to detect tool calls. Tool names and arguments are sent only to the MCP server configured here; results can be inserted into the chat. Chrome grants access only to the configured server host.',
      errInvalidUrl: 'Enter a valid MCP server URL.',
      errCredentials: 'Do not put credentials in the MCP server URL.',
      errProtocol: 'The MCP server URL must use HTTP, HTTPS, WS, or WSS.',
      errWsUrl: 'WebSocket transport requires a ws:// or wss:// URL.',
      errHttpUrl: 'SSE and Streamable HTTP transports require an http:// or https:// URL.',
      errHostname: 'The MCP server URL must include a hostname.',
      enterAddress: 'Enter the MCP server address to continue.',
      permissionScope: host => `Chrome permission scope: ${host} (all ports)`,
      statusRequestAccess: 'Chrome will request access only to this server host.',
      statusWaitingPermission: 'Waiting for Chrome permission…',
      statusPermissionDenied: 'Permission was not granted. The MCP server connection was not started.',
      statusConnecting: 'Permission granted. Connecting to MCP server…',
      errStartConnection: 'Could not start the MCP connection.',
      statusConnected: 'Connected. You can close this window and return to your AI chat.',
      statusUnreachable: 'Permission granted, but the MCP server is not reachable. Check the URL and server status.',
      sitesTitle: 'WEBSITE ACCESS',
      sitesDesc: "Disable on websites where you don't need MCP tools (e.g., chatgpt.com) to avoid interference.",
      sitesSummary: (enabled, total) => `${enabled}/${total} enabled`,
      currentBadge: 'Current',
      enabledBtn: 'Enabled',
      disabledBtn: 'Disabled',
    },
    zh: {
      toggleLabel: 'EN',
      toggleTitle: 'Switch to English',
      subtitle: '配置并连接您的 MCP 服务器。',
      serverEndpoint: 'MCP 服务器地址',
      transport: '传输协议 (TRANSPORT)',
      docPrefix: '运行 Proxy Server 查看 ',
      docLinkText: '说明',
      docSuffix: '。',
      docUrl: 'https://github.com/drawdy/MCP-Interceptor/blob/main/README_zh.md',
      grantConnect: '授权访问并连接',
      loadingConfig: '正在加载服务器配置…',
      footer:
        '在支持的 AI 对话页面上，本扩展会读取可见回复以检测工具调用。工具名称与参数仅发送至此处配置的 MCP 服务器；执行结果可插入到对话中。Chrome 仅授予所配置服务器主机的访问权限。',
      errInvalidUrl: '请输入有效的 MCP 服务器 URL。',
      errCredentials: '请勿在 MCP 服务器 URL 中包含用户名或密码。',
      errProtocol: 'MCP 服务器 URL 必须使用 HTTP、HTTPS、WS 或 WSS 协议。',
      errWsUrl: 'WebSocket 传输方式需要 ws:// 或 wss:// 地址。',
      errHttpUrl: 'SSE 与 Streamable HTTP 传输方式需要 http:// 或 https:// 地址。',
      errHostname: 'MCP 服务器 URL 必须包含主机名。',
      enterAddress: '请输入 MCP 服务器地址以继续。',
      permissionScope: host => `Chrome 权限范围：${host}（所有端口）`,
      statusRequestAccess: 'Chrome 将仅请求该服务器主机的访问权限。',
      statusWaitingPermission: '正在等待 Chrome 权限授权…',
      statusPermissionDenied: '未授予主机访问权限，未启动 MCP 服务器连接。',
      statusConnecting: '权限已授予，正在连接 MCP 服务器…',
      errStartConnection: '无法启动 MCP 连接。',
      statusConnected: '已成功连接！您可以关闭此窗口并返回 AI 对话页面。',
      statusUnreachable: '权限已授予，但无法连接到 MCP 服务器，请检查 URL 与服务运行状态。',
      sitesTitle: '网站启用管理',
      sitesDesc: '可在不需要 MCP 工具的网站（如 chatgpt.com）禁用插件，避免界面与功能干扰。',
      sitesSummary: (enabled, total) => `已启用 ${enabled}/${total}`,
      currentBadge: '当前页面',
      enabledBtn: '已启用',
      disabledBtn: '已禁用',
    },
  };

  function dict() {
    return I18N[currentLang] || I18N.en;
  }

  function applyStaticTranslations() {
    const d = dict();
    document.documentElement.lang = currentLang;
    if (langToggleButton) {
      langToggleButton.textContent = d.toggleLabel;
      langToggleButton.title = d.toggleTitle;
    }
    if (headerSubtitle) headerSubtitle.textContent = d.subtitle;
    if (labelServerUrl) labelServerUrl.textContent = d.serverEndpoint;
    if (labelTransport) labelTransport.textContent = d.transport;
    if (grantButton) grantButton.textContent = d.grantConnect;
    if (footerNote) footerNote.textContent = d.footer;
    if (labelSitesTitle) labelSitesTitle.textContent = d.sitesTitle;
    if (sitesDesc) sitesDesc.textContent = d.sitesDesc;
    if (proxyDocHint) {
      proxyDocHint.textContent = '';
      proxyDocHint.appendChild(document.createTextNode(d.docPrefix));
      const a = document.createElement('a');
      a.id = 'proxy-doc-link';
      a.href = d.docUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = d.docLinkText;
      proxyDocHint.appendChild(a);
      proxyDocHint.appendChild(document.createTextNode(d.docSuffix));
    }
    renderSitesList();
    renderPrivacy();
  }

  function renderSitesList() {
    if (!sitesListElement) return;
    const d = dict();
    sitesListElement.textContent = '';

    const disabledSet = new Set(disabledSites.map(resolveSiteId));
    const enabledCount = SUPPORTED_SITES.filter(s => !disabledSet.has(s.id)).length;
    if (sitesSummary) {
      sitesSummary.textContent = d.sitesSummary(enabledCount, SUPPORTED_SITES.length);
    }

    // Sort so activeTabSiteId appears at the top if matched
    const sortedSites = [...SUPPORTED_SITES].sort((a, b) => {
      if (a.id === activeTabSiteId && b.id !== activeTabSiteId) return -1;
      if (b.id === activeTabSiteId && a.id !== activeTabSiteId) return 1;
      return 0;
    });

    for (const site of sortedSites) {
      const isEnabled = !disabledSet.has(site.id);
      const isCurrent = site.id === activeTabSiteId;

      const row = document.createElement('div');
      row.className = 'site-row' + (isCurrent ? ' current' : '');

      const nameWrap = document.createElement('div');
      nameWrap.className = 'site-name';
      nameWrap.textContent = currentLang === 'zh' ? site.labelZh : site.labelEn;

      if (isCurrent) {
        const badge = document.createElement('span');
        badge.className = 'site-badge';
        badge.textContent = d.currentBadge;
        nameWrap.appendChild(badge);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'site-switch ' + (isEnabled ? 'enabled' : 'disabled');
      btn.textContent = isEnabled ? d.enabledBtn : d.disabledBtn;
      btn.addEventListener('click', async () => {
        const nextSet = new Set(disabledSites.map(resolveSiteId));
        if (isEnabled) {
          nextSet.add(site.id);
        } else {
          nextSet.delete(site.id);
        }
        disabledSites = Array.from(nextSet);
        renderSitesList();
        try {
          await chrome.storage.local.set({ mcpDisabledSites: disabledSites });
        } catch {
          // Ignore storage error
        }
      });

      row.appendChild(nameWrap);
      row.appendChild(btn);
      sitesListElement.appendChild(row);
    }
  }

  function setStatus(message, kind = 'info') {
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
  }

  function getDefaultUrl(type) {
    if (type === 'websocket') return 'ws://localhost:3006/message';
    if (type === 'streamable-http') return 'http://localhost:3006/mcp';
    return 'http://localhost:3006/sse';
  }

  function getPermission(value, type) {
    const d = dict();
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(d.errInvalidUrl);
    }

    if (url.username || url.password) {
      throw new Error(d.errCredentials);
    }

    let scheme;
    switch (url.protocol) {
      case 'http:':
      case 'ws:':
        scheme = 'http';
        break;
      case 'https:':
      case 'wss:':
        scheme = 'https';
        break;
      default:
        throw new Error(d.errProtocol);
    }

    const isWebSocket = url.protocol === 'ws:' || url.protocol === 'wss:';
    if ((type === 'websocket') !== isWebSocket) {
      throw new Error(type === 'websocket' ? d.errWsUrl : d.errHttpUrl);
    }

    if (!url.hostname) {
      throw new Error(d.errHostname);
    }

    return {
      pattern: scheme + '://' + url.hostname + '/*',
      host: url.hostname,
      url: url.toString(),
    };
  }

  function updatePermissionSummary() {
    const d = dict();
    const value = serverUrlInput.value.trim();
    if (!value) {
      serverHostElement.textContent = d.enterAddress;
      setStatus(
        consentGranted
          ? d.enterAddress
          : currentLang === 'zh'
            ? '请先阅读并同意隐私政策。'
            : 'Read and agree to the privacy policy first.',
      );
      grantButton.disabled = true;
      return;
    }

    try {
      const permission = getPermission(value, connectionType);
      serverHostElement.textContent = d.permissionScope(permission.host);
      grantButton.disabled = !consentGranted;
      setStatus(
        consentGranted
          ? d.statusRequestAccess
          : currentLang === 'zh'
            ? '请先阅读并同意隐私政策。'
            : 'Read and agree to the privacy policy first.',
      );
    } catch (error) {
      serverHostElement.textContent = '';
      grantButton.disabled = true;
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  }

  async function loadConfiguration() {
    try {
      if (chrome.tabs && typeof chrome.tabs.query === 'function') {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0] && tabs[0].url) {
            const tabUrl = new URL(tabs[0].url);
            activeTabSiteId = resolveSiteId(tabUrl.hostname);
          }
        } catch {
          // Ignore tab URL read error
        }
      }

      const stored = await chrome.storage.local.get([
        ...consentKeys,
        'mcpServerUrl',
        'mcpConnectionType',
        'mcpLanguage',
        'mcpDisabledSites',
      ]);
      if (stored.mcpLanguage === 'zh' || stored.mcpLanguage === 'en') {
        currentLang = stored.mcpLanguage;
      } else if (navigator.language && navigator.language.toLowerCase().startsWith('zh')) {
        currentLang = 'zh';
      }
      if (Array.isArray(stored.mcpDisabledSites)) {
        disabledSites = stored.mcpDisabledSites.filter(item => typeof item === 'string');
      }
      consentGranted =
        stored.privacyConsentGranted === true &&
        stored.privacyConsentVersion === CONSENT_VERSION &&
        Number.isFinite(stored.privacyConsentTimestamp) &&
        stored.privacyConsentTimestamp > 0;
      applyStaticTranslations();

      connectionType = stored.mcpConnectionType || 'sse';
      connectionTypeSelect.value = connectionType;
      serverUrlInput.value =
        typeof stored.mcpServerUrl === 'string' && stored.mcpServerUrl.trim() ? stored.mcpServerUrl : '';
      updatePermissionSummary();
    } catch (error) {
      grantButton.disabled = true;
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  }

  if (langToggleButton) {
    langToggleButton.addEventListener('click', async () => {
      currentLang = currentLang === 'zh' ? 'en' : 'zh';
      applyStaticTranslations();
      updatePermissionSummary();
      try {
        await chrome.storage.local.set({ mcpLanguage: currentLang });
      } catch {
        // Ignore storage write error
      }
    });
  }

  serverUrlInput.addEventListener('input', updatePermissionSummary);

  connectionTypeSelect.addEventListener('change', () => {
    const previousDefault = getDefaultUrl(connectionType);
    const nextType = connectionTypeSelect.value;
    const trimmed = serverUrlInput.value.trim();
    if (
      !trimmed ||
      trimmed === previousDefault ||
      (connectionType === 'streamable-http' && trimmed === 'http://localhost:3006')
    ) {
      serverUrlInput.value = getDefaultUrl(nextType);
    }
    connectionType = nextType;
    updatePermissionSummary();
  });

  grantButton.addEventListener('click', async () => {
    if (!consentGranted) return;
    const d = dict();
    const value = serverUrlInput.value.trim();
    let permission;
    try {
      permission = getPermission(value, connectionType);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
      return;
    }

    grantButton.disabled = true;
    setStatus(d.statusWaitingPermission);

    try {
      // Request permissions directly from this user gesture.
      const granted = await chrome.permissions.request({ origins: [permission.pattern] });
      if (!granted) {
        setStatus(d.statusPermissionDenied, 'error');
        return;
      }

      // Persist the endpoint only after the user explicitly grants access.
      await chrome.storage.local.set({
        mcpServerUrl: permission.url,
        mcpConnectionType: connectionType,
      });

      setStatus(d.statusConnecting);
      const response = await chrome.runtime.sendMessage({
        type: 'mcp:force-reconnect',
        payload: {},
        origin: 'popup',
        timestamp: Date.now(),
      });

      if (!response || response.success !== true) {
        throw new Error(response?.error || d.errStartConnection);
      }

      if (response.payload?.isConnected) {
        setStatus(d.statusConnected, 'success');
      } else {
        setStatus(response.payload?.error || d.statusUnreachable, 'error');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      grantButton.disabled = !consentGranted;
    }
  });

  loadConfiguration();
})();
