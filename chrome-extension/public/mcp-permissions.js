(() => {
  const serverUrlInput = document.getElementById('server-url');
  const connectionTypeSelect = document.getElementById('connection-type');
  const serverHostElement = document.getElementById('server-host');
  const grantButton = document.getElementById('grant-connect');
  const statusElement = document.getElementById('status');

  let connectionType = 'sse';

  function setStatus(message, kind = 'info') {
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
  }

  function getDefaultUrl(type) {
    if (type === 'websocket') return 'ws://localhost:3006/message';
    if (type === 'streamable-http') return 'http://localhost:3006';
    return 'http://localhost:3006/sse';
  }

  function getPermission(value, type) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error('Enter a valid MCP server URL.');
    }

    if (url.username || url.password) {
      throw new Error('Do not put credentials in the MCP server URL.');
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
        throw new Error('The MCP server URL must use HTTP, HTTPS, WS, or WSS.');
    }

    const isWebSocket = url.protocol === 'ws:' || url.protocol === 'wss:';
    if ((type === 'websocket') !== isWebSocket) {
      throw new Error(
        type === 'websocket'
          ? 'WebSocket transport requires a ws:// or wss:// URL.'
          : 'SSE and Streamable HTTP transports require an http:// or https:// URL.',
      );
    }

    if (!url.hostname) {
      throw new Error('The MCP server URL must include a hostname.');
    }

    return {
      pattern: scheme + '://' + url.hostname + '/*',
      host: url.hostname,
      url: url.toString(),
    };
  }

  function updatePermissionSummary() {
    const value = serverUrlInput.value.trim();
    if (!value) {
      serverHostElement.textContent = 'Enter the MCP server address to continue.';
      grantButton.disabled = true;
      return;
    }

    try {
      const permission = getPermission(value, connectionType);
      serverHostElement.textContent = 'Chrome permission scope: ' + permission.host + ' (all ports)';
      grantButton.disabled = false;
      setStatus('Chrome will request access only to this server host.');
    } catch (error) {
      serverHostElement.textContent = '';
      grantButton.disabled = true;
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  }

  async function loadConfiguration() {
    try {
      const stored = await chrome.storage.local.get(['mcpServerUrl', 'mcpConnectionType']);
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

  serverUrlInput.addEventListener('input', updatePermissionSummary);

  connectionTypeSelect.addEventListener('change', () => {
    const previousDefault = getDefaultUrl(connectionType);
    const nextType = connectionTypeSelect.value;
    if (serverUrlInput.value.trim() === previousDefault) {
      serverUrlInput.value = getDefaultUrl(nextType);
    }
    connectionType = nextType;
    updatePermissionSummary();
  });

  grantButton.addEventListener('click', async () => {
    const value = serverUrlInput.value.trim();
    let permission;
    try {
      permission = getPermission(value, connectionType);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
      return;
    }

    grantButton.disabled = true;
    setStatus('Waiting for Chrome permission…');

    try {
      // Request permissions directly from this user gesture.
      const granted = await chrome.permissions.request({ origins: [permission.pattern] });
      if (!granted) {
        setStatus('Permission was not granted. The MCP server connection was not started.', 'error');
        return;
      }

      // Persist the endpoint only after the user explicitly grants access.
      await chrome.storage.local.set({
        mcpServerUrl: permission.url,
        mcpConnectionType: connectionType,
      });

      setStatus('Permission granted. Connecting to MCP server…');
      const response = await chrome.runtime.sendMessage({
        type: 'mcp:force-reconnect',
        payload: {},
        origin: 'popup',
        timestamp: Date.now(),
      });

      if (!response || response.success !== true) {
        throw new Error(response?.error || 'Could not start the MCP connection.');
      }

      if (response.payload?.isConnected) {
        setStatus('Connected. You can close this window and return to your AI chat.', 'success');
      } else {
        setStatus(
          response.payload?.error ||
            'Permission granted, but the MCP server is not reachable. Check the URL and server status.',
          'error',
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      grantButton.disabled = false;
    }
  });

  loadConfiguration();
})();
