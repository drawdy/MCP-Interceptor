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

  let connectionType = 'sse';
  let currentLang = 'en';

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
      statusUnreachable:
        'Permission granted, but the MCP server is not reachable. Check the URL and server status.',
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
      grantButton.disabled = true;
      return;
    }

    try {
      const permission = getPermission(value, connectionType);
      serverHostElement.textContent = d.permissionScope(permission.host);
      grantButton.disabled = false;
      setStatus(d.statusRequestAccess);
    } catch (error) {
      serverHostElement.textContent = '';
      grantButton.disabled = true;
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  }

  async function loadConfiguration() {
    try {
      const stored = await chrome.storage.local.get(['mcpServerUrl', 'mcpConnectionType', 'mcpLanguage']);
      if (stored.mcpLanguage === 'zh' || stored.mcpLanguage === 'en') {
        currentLang = stored.mcpLanguage;
      } else if (navigator.language && navigator.language.toLowerCase().startsWith('zh')) {
        currentLang = 'zh';
      }
      applyStaticTranslations();

      connectionType = stored.mcpConnectionType || 'sse';
      connectionTypeSelect.value = connectionType;
      serverUrlInput.value =
        typeof stored.mcpServerUrl === 'string' && stored.mcpServerUrl.trim()
          ? stored.mcpServerUrl
          : getDefaultUrl(connectionType);
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
    if (!trimmed || trimmed === previousDefault || (connectionType === 'streamable-http' && trimmed === 'http://localhost:3006')) {
      serverUrlInput.value = getDefaultUrl(nextType);
    }
    connectionType = nextType;
    updatePermissionSummary();
  });

  grantButton.addEventListener('click', async () => {
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
      grantButton.disabled = false;
    }
  });

  loadConfiguration();
})();
