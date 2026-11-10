import { readPrivacyConsent } from '@extension/shared/lib/privacy-consent';
import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import {
  runWithBackwardsCompatibility,
  isMcpServerConnected,
  forceReconnectToMcpServer,
  checkMcpServerConnection,
  callToolWithBackwardsCompatibility,
  getPrimitivesWithBackwardsCompatibility,
  resetMcpConnectionState,
  resetMcpConnectionStateForRecovery,
  normalizeToolsFromPrimitives as normalizeTools,
  createMcpClient,
  isExpectedConnectionFailure,
  type TransportType,
  type ConnectionRequest,
} from '../mcpclient/index';

// Import message types for type safety
import type {
  BaseMessage,
  RequestMessage,
  ResponseMessage,
  McpMessageType,
  CallToolRequest,
  GetConnectionStatusRequest,
  GetToolsRequest,
  ForceReconnectRequest,
  GetServerConfigRequest,
  UpdateServerConfigRequest,
  HeartbeatRequest,
  ConnectionStatusChangedBroadcast,
  ToolUpdateBroadcast,
  ServerConfigUpdatedBroadcast,
  HeartbeatResponseBroadcast,
} from '../../../pages/content/src/types/messages';
import { createLogger } from '@extension/shared/lib/logger';

// Default MCP server URLs

const logger = createLogger('BACKGROUND');

const DEFAULT_SSE_URL = 'http://localhost:3006/sse';
const DEFAULT_WEBSOCKET_URL = 'ws://localhost:3006/message';
const DEFAULT_STREAMABLE_HTTP_URL = 'http://localhost:3006';

// Connection type management
type ConnectionType = TransportType;
const DEFAULT_CONNECTION_TYPE: ConnectionType = 'sse';

// Background script state management with connection type support
let serverUrl: string = DEFAULT_SSE_URL;
let hasConfiguredServer = false;
let connectionType: ConnectionType = DEFAULT_CONNECTION_TYPE;
let isConnected: boolean = false;
let connectionCount: number = 0;
let isInitialized: boolean = false;

/**
 * Initialize server URL from Chrome storage
 * Replaces mcpInterface initialization functionality
 */
async function initializeServerConfig(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['mcpServerUrl', 'mcpConnectionType']);

    // Load connection type first to determine default URL
    connectionType = (result.mcpConnectionType as ConnectionType) || DEFAULT_CONNECTION_TYPE;
    const defaultUrl =
      connectionType === 'websocket'
        ? DEFAULT_WEBSOCKET_URL
        : connectionType === 'streamable-http'
          ? DEFAULT_STREAMABLE_HTTP_URL
          : DEFAULT_SSE_URL;

    const storedUrl = typeof result.mcpServerUrl === 'string' ? result.mcpServerUrl.trim() : '';
    hasConfiguredServer = storedUrl.length > 0;
    serverUrl = storedUrl || defaultUrl;
    isInitialized = true;

    logger.debug('[Background] Server config loaded from storage:', {
      url: serverUrl,
      type: connectionType,
    });
  } catch (error) {
    logger.warn('[Background] Failed to load server config from storage, using defaults:', error);
    connectionType = DEFAULT_CONNECTION_TYPE;
    serverUrl = DEFAULT_SSE_URL;
    hasConfiguredServer = false;
    isInitialized = true;
  }
}

/**
 * Wait for initialization to complete
 * Replaces mcpInterface.waitForInitialization()
 */
async function waitForInitialization(): Promise<void> {
  while (!isInitialized) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Get the current server URL
 * Replaces mcpInterface.getServerUrl()
 */
function getServerUrl(): string {
  return serverUrl;
}

/**
 * Resolve the minimum host permission required for the configured MCP endpoint.
 * WebSocket URLs use the corresponding HTTP(S) host permission.
 */
function getMcpHostPermissionPattern(uri: string): string {
  const url = new URL(uri);
  let scheme: 'http' | 'https';

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
      throw new Error('MCP server URL must use HTTP, HTTPS, WS, or WSS.');
  }

  if (url.username || url.password) {
    throw new Error('Do not put credentials in the MCP server URL.');
  }

  return `${scheme}://${url.hostname}/*`;
}

async function hasMcpHostPermission(uri: string): Promise<boolean> {
  try {
    if (!(await readPrivacyConsent())) return false;
    const origin = getMcpHostPermissionPattern(uri);
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

function getMcpPermissionRequiredMessage(uri: string): string {
  let host = 'the configured MCP server';
  try {
    host = new URL(uri).host;
  } catch {
    // Keep the generic host label for an invalid URL.
  }
  return `Access to ${host} is not granted. Click the MCP-Interceptor toolbar icon and choose "Grant access and connect".`;
}

/**
 * Update the server configuration
 * Replaces mcpInterface.updateServerUrl()
 */
function updateServerConfig(url: string, type?: ConnectionType): void {
  serverUrl = url.trim();
  hasConfiguredServer = serverUrl.length > 0;
  if (type) {
    connectionType = type;
  }
  logger.debug('[Background] Server config updated to:', { url, type: connectionType });
}

/**
 * Get connection status
 * Replaces mcpInterface.getConnectionStatus()
 */
function getConnectionStatus(): boolean {
  return isConnected;
}

/**
 * Update connection status
 * Replaces mcpInterface.updateConnectionStatus()
 */
function updateConnectionStatus(status: boolean): void {
  isConnected = status;
  logger.debug('[Background] Connection status updated to:', status);
}

/**
 * Get connection count
 * Replaces mcpInterface.getConnectionCount()
 */
function getConnectionCount(): number {
  return connectionCount;
}

/**
 * Increment connection count
 */
function incrementConnectionCount(): void {
  connectionCount++;
}

/**
 * Decrement connection count
 */
function decrementConnectionCount(): void {
  connectionCount = Math.max(0, connectionCount - 1);
}

// Define server connection state
let isConnecting = false;
let connectionAttemptCount = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

/**
 * Enhanced error categorization for better tool vs connection error distinction
 *
 * This function analyzes error messages to determine whether an error indicates
 * a connection problem (server unavailable) or a tool-specific issue (tool not found, invalid args, etc.)
 * This helps prevent unnecessary disconnection states when only tool execution fails.
 *
 * @param error - The error to categorize
 * @returns Object containing categorization flags and category string
 */
function categorizeToolError(error: Error): { isConnectionError: boolean; isToolError: boolean; category: string } {
  const errorMessage = error.message.toLowerCase();

  // Tool-specific errors that definitely don't indicate connection issues
  const toolErrorPatterns = [
    /tool .* not found/i,
    /tool not found/i,
    /method not found/i,
    /invalid arguments/i,
    /invalid parameters/i,
    /mcp error -32602/i, // Invalid params
    /mcp error -32601/i, // Method not found
    /mcp error -32600/i, // Invalid request
    /tool '[^']+' is not available/i,
    /tool '[^']+' not found on server/i,
  ];

  // Connection-related errors that indicate server is unavailable
  const connectionErrorPatterns = [
    /connection refused/i,
    /econnrefused/i,
    /timeout/i,
    /etimedout/i,
    /enotfound/i,
    /network error/i,
    /server unavailable/i,
    /could not connect/i,
    /connection failed/i,
    /transport error/i,
    /fetch failed/i,
    /failed to fetch/i,
    /networkerror/i,
    /load failed/i,
    /connection reset/i,
    /econnreset/i,
    /ehostunreach/i,
    /network request failed/i,
    /timed out/i,
    /err_connection_[a-z_]+/i,
  ];

  // Check tool errors first (highest priority)
  if (toolErrorPatterns.some(pattern => pattern.test(errorMessage))) {
    return { isConnectionError: false, isToolError: true, category: 'tool_error' };
  }

  // Check connection errors
  if (connectionErrorPatterns.some(pattern => pattern.test(errorMessage))) {
    return { isConnectionError: true, isToolError: false, category: 'connection_error' };
  }

  // Default to tool error for ambiguous cases to prevent unnecessary disconnections
  return { isConnectionError: false, isToolError: true, category: 'unknown_tool_error' };
}

/**
 * Initialize the extension
 *
 * This function is called once when the extension starts and handles:
 * - Theme initialization
 * - Server URL loading from storage
 * - Initial connection status check and broadcast
 * - Asynchronous server connection attempt if needed
 * - Initial tools fetching and broadcast if connected
 *
 * The initialization is designed to be non-blocking and resilient to failures.
 */
async function initializeExtension() {
  logger.debug('Extension initializing...');

  // Initialize theme
  try {
    const theme = await exampleThemeStorage.get();
    logger.debug('Theme initialized:', theme);
  } catch (error) {
    logger.warn('Error initializing theme, continuing with defaults:', error);
  }

  // Initialize server configuration from storage
  await initializeServerConfig();

  // Wait for initialization to complete
  await waitForInitialization();

  // Get the loaded server URL
  const serverUrl = getServerUrl();
  logger.debug('Background script initialized with server URL:', serverUrl);

  // Set initial connection status
  updateConnectionStatus(false);

  logger.debug('Extension initialized successfully');

  // Do not probe localhost on a fresh install before the user configures an MCP endpoint.
  if (!hasConfiguredServer) {
    logger.debug('[Background] No MCP server configured; skipping initial connection attempt');
    broadcastConnectionStatusToContentScripts(false, 'Configure an MCP server to connect.');
    return;
  }

  // After initialization is complete, attempt connection and broadcast initial status immediately
  const checkInitialConnectionStatus = async () => {
    const serverUrl = getServerUrl();

    logger.debug(`Attempting initial connection to ${serverUrl} with transport: ${connectionType}`);

    // Try to connect to the server immediately
    let isConnected = false;
    try {
      await tryConnectToServer(serverUrl, connectionType);
      // After connection attempt, check if we're actually connected
      isConnected = await checkMcpServerConnection();
      logger.debug(`Initial connection attempt result: ${isConnected ? 'connected' : 'failed'}`);
    } catch (error) {
      logger.debug(`Initial connection attempt failed: ${error instanceof Error ? error.message : String(error)}`);
      isConnected = false;
    }

    // Update and broadcast the actual connection status
    updateConnectionStatus(isConnected);
    broadcastConnectionStatusToContentScripts(isConnected);

    logger.debug(`Initial connection status broadcast: ${isConnected ? 'connected' : 'disconnected'}`);

    // If connected, also broadcast tools
    if (isConnected) {
      try {
        logger.debug('[Background] Server connected, fetching and broadcasting initial tools...');
        const primitives = await getPrimitivesWithBackwardsCompatibility(serverUrl, false, connectionType);
        logger.debug(`Retrieved ${primitives.length} primitives for initial broadcast`);

        const tools = normalizeTools(primitives);
        logger.debug(`Broadcasting ${tools.length} normalized initial tools`);

        broadcastToolsUpdateToContentScripts(tools);
      } catch (error) {
        logger.warn('[Background] Error broadcasting initial tools:', error);
      }
    }
  };

  // Run the initial connection attempt immediately
  checkInitialConnectionStatus();
}

/**
 * Try to connect to the MCP server with retry logic
 *
 * This function is separated from extension initialization to prevent blocking
 * and includes comprehensive error handling and retry logic with exponential backoff.
 *
 * @param uri - The MCP server URI to connect to
 * @returns Promise that resolves when connection attempt is complete (success or failure)
 */
async function tryConnectToServer(uri: string, type: ConnectionType = connectionType): Promise<void> {
  if (!hasConfiguredServer) {
    logger.debug('[Background] Skipping MCP connection attempt: no server is configured');
    return;
  }

  if (isConnecting) {
    logger.debug('Connection attempt already in progress, skipping');
    return;
  }

  if (!(await hasMcpHostPermission(uri))) {
    const message = getMcpPermissionRequiredMessage(uri);
    logger.info(message);
    updateConnectionStatus(false);
    broadcastConnectionStatusToContentScripts(false, message);
    return;
  }

  isConnecting = true;
  connectionAttemptCount++;

  logger.debug(
    `Attempting to connect to MCP server via ${type} (attempt ${connectionAttemptCount}/${MAX_CONNECTION_ATTEMPTS}): ${uri}`,
  );

  try {
    await runWithBackwardsCompatibility(uri, type);

    logger.debug('MCP client connected successfully');
    updateConnectionStatus(true);
    broadcastConnectionStatusToContentScripts(true);

    // Also broadcast available tools after successful connection
    try {
      logger.debug('[Background] Connection successful, fetching and broadcasting tools...');
      const primitives = await getPrimitivesWithBackwardsCompatibility(uri, true, type);
      logger.debug(`Retrieved ${primitives.length} primitives after connection`);

      const tools = normalizeTools(primitives);
      logger.debug(`Broadcasting ${tools.length} normalized tools after successful connection`);

      broadcastToolsUpdateToContentScripts(tools);
    } catch (toolsError) {
      logger.warn('[Background] Error broadcasting tools after connection:', toolsError);
    }

    connectionAttemptCount = 0; // Reset counter on success
  } catch (error: any) {
    const errorCategory = categorizeToolError(error instanceof Error ? error : new Error(String(error)));

    logger.warn(`MCP server connection failed (${errorCategory.category}): ${error.message || String(error)}`);
    logger.debug('Extension will continue to function with limited capabilities');

    // Only update connection status for actual connection errors
    if (errorCategory.isConnectionError) {
      updateConnectionStatus(false);
      broadcastConnectionStatusToContentScripts(false, error.message || String(error));
    } else {
      logger.debug('Error categorized as tool-related, not updating connection status');
    }

    // Schedule another attempt if we haven't reached the limit
    if (connectionAttemptCount < MAX_CONNECTION_ATTEMPTS) {
      const delayMs = Math.min(5000 * connectionAttemptCount, 15000); // Exponential backoff with cap
      logger.debug(`Scheduling next connection attempt in ${delayMs / 1000} seconds...`);

      setTimeout(() => {
        isConnecting = false; // Reset connecting flag
        tryConnectToServer(uri).catch(() => {}); // Try again
      }, delayMs);
    } else {
      logger.debug('Maximum connection attempts reached. Will try again during periodic check.');
      // ENHANCED: Don't give up permanently - periodic checks will retry with reset state
      isConnecting = false;
    }
  } finally {
    if (connectionAttemptCount >= MAX_CONNECTION_ATTEMPTS) {
      isConnecting = false;
    }
  }
}

// Set up a periodic connection check with enhanced recovery logic
const PERIODIC_CHECK_INTERVAL = 60000; // 1 minute
setInterval(async () => {
  if (!hasConfiguredServer || isConnecting || !(await hasMcpHostPermission(getServerUrl()))) {
    return; // Skip if already connecting
  }

  // Check current connection status with enhanced validation
  const wasConnected = getConnectionStatus();
  const isConnected = await checkMcpServerConnection();
  updateConnectionStatus(isConnected);

  // Broadcast status change if it changed
  if (wasConnected !== isConnected) {
    logger.debug(`Connection status changed: ${wasConnected} -> ${isConnected}`);
    broadcastConnectionStatusToContentScripts(isConnected);

    // If connected, also broadcast available tools
    if (isConnected) {
      try {
        logger.debug('[Background] Periodic check: Connection established, fetching and broadcasting tools...');
        const primitives = await getPrimitivesWithBackwardsCompatibility(getServerUrl(), true, connectionType);
        logger.debug(`Periodic check: Retrieved ${primitives.length} primitives`);

        const tools = normalizeTools(primitives);
        logger.debug(`Periodic check: Broadcasting ${tools.length} normalized tools`);

        broadcastToolsUpdateToContentScripts(tools);
      } catch (error) {
        logger.warn('[Background] Error broadcasting tools after status change:', error);
      }
    }
  } else {
    // Even if status didn't change, periodically broadcast to ensure content scripts are in sync
    broadcastConnectionStatusToContentScripts(isConnected);
  }

  // ENHANCED: If not connected and we're not in the middle of connecting, try to connect
  // Reset connection attempt count periodically to allow recovery from permanent failure state
  if (!isConnected && !isConnecting) {
    connectionAttemptCount = 0; // Reset counter for periodic checks
    logger.debug('Periodic check: MCP server not connected, attempting to connect');
    const serverUrl = getServerUrl();

    // Reset the client's failure state periodically to prevent permanent disconnection
    // This is critical to fix the issue where only browser restart would work
    try {
      logger.debug('[Background] Resetting MCP client connection state for periodic recovery attempt');
      resetMcpConnectionStateForRecovery(); // Use recovery reset instead of full reset
    } catch (error) {
      logger.warn('[Background] Error resetting MCP connection state:', error);
    }

    tryConnectToServer(serverUrl, connectionType).catch(() => {});
  }
}, PERIODIC_CHECK_INTERVAL);

// Log active connections periodically
setInterval(() => {
  const connectionCount = getConnectionCount();
  if (connectionCount > 0) {
    logger.debug(`Active MCP content script connections: ${connectionCount}`);
  }
}, 60000);

// --- Error Handling ---

self.addEventListener('unhandledrejection', event => {
  logger.error('Unhandled rejection in service worker:', event.reason);
});

self.addEventListener('error', event => {
  logger.error('Uncaught error in service worker:', event.error);
});

// --- Lifecycle Events ---

chrome.runtime.onInstalled.addListener(async details => {
  logger.debug('Extension installed or updated:', details.reason);

  const currentVersion = chrome.runtime.getManifest().version;

  if (details.reason === 'install') {
    logger.debug('First-time installation complete.');
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion || 'unknown';
    logger.debug(`Extension updated from ${previousVersion} to ${currentVersion}`);

    // Broadcast version update to content scripts.
    setTimeout(() => {
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: 'app:version-updated',
                data: {
                  oldVersion: previousVersion,
                  newVersion: currentVersion,
                  timestamp: Date.now(),
                },
              })
              .catch(() => {
                // Ignore errors for tabs that can't receive messages.
              });
          }
        });
      });
    }, 1000);
  }
});

chrome.runtime.onStartup.addListener(() => {
  logger.debug('Browser startup detected.');
  // Re-check connection on startup
  initializeExtension().catch(err => logger.error('Error initializing on startup:', err));
});

// Start extension initialization
initializeExtension()
  .then(() => {
    logger.debug('Extension startup complete');
  })
  .catch(error => {
    logger.error('Error during extension initialization:', error);
    logger.debug('Extension will continue running with limited functionality');
  });

logger.debug('Background script loaded');
logger.debug("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// --- Enhanced Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Enhanced logging for debugging
  logger.debug('[Background] Received message:', {
    type: message.type || message.command,
    origin: message.origin || 'unknown',
    id: message.id,
    hasPayload: !!message.payload,
    from: sender.tab ? `tab-${sender.tab.id}` : 'extension',
  });

  // Handle MCP client connection status changes
  if (message.type === 'mcp:connection-status-changed' && message.origin === 'mcpclient') {
    logger.debug('[Background] Received connection status change from MCP client:', message.payload);

    // Update internal connection status
    const { isConnected, error } = message.payload;
    updateConnectionStatus(isConnected);

    // Broadcast the status change to all content scripts
    broadcastConnectionStatusToContentScripts(isConnected, error);

    // No response needed
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* MCP ContextBridge integration                                       */
  /* ------------------------------------------------------------------ */
  if (typeof message.type === 'string' && message.type.startsWith('mcp:')) {
    // Handle MCP messages asynchronously
    handleMcpMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
  }

  // Fallback – message not handled here
  logger.debug('[Background] Message not handled, ignoring:', message.type || message.command);
  return false;
});

/**
 * Enhanced MCP message handler with proper error handling, type safety, and response formatting
 *
 * @param message - The message received from the content script
 * @param sender - Chrome runtime message sender information
 * @param sendResponse - Callback function to send response back to sender
 */
async function handleMcpMessage(
  message: RequestMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ResponseMessage) => void,
) {
  const startTime = Date.now();
  const messageType = message.type as McpMessageType;

  try {
    if (!(await readPrivacyConsent())) throw new Error('Open MCP-Interceptor and agree to the privacy policy first.');
    let result: any = null;
    const payload = message.payload || {};

    logger.debug(`Processing MCP message: ${messageType}`);

    switch (messageType) {
      case 'mcp:call-tool': {
        const { toolName, args, adapterName } = payload as CallToolRequest & { adapterName?: string };
        if (!toolName) {
          throw new Error('Tool name is required');
        }
        if (!hasConfiguredServer) {
          throw new Error('Configure an MCP server before executing tools.');
        }
        if (!(await hasMcpHostPermission(getServerUrl()))) {
          throw new Error(getMcpPermissionRequiredMessage(getServerUrl()));
        }

        logger.debug(`Calling tool: ${toolName} from adapter: ${adapterName || 'unknown'}`);
        result = await callToolWithBackwardsCompatibility(getServerUrl(), toolName, args || {}, adapterName);
        logger.debug(`Tool call completed: ${toolName}`);
        break;
      }

      case 'mcp:get-connection-status': {
        logger.debug('[Background] Getting current connection status');

        // Double-check the connection status to ensure accuracy
        const storedStatus = getConnectionStatus();
        const actualStatus = hasConfiguredServer ? await checkMcpServerConnection() : false;

        logger.debug(`Stored status: ${storedStatus}, Actual status: ${actualStatus}`);

        // Update stored status if they don't match
        if (storedStatus !== actualStatus) {
          logger.debug('[Background] Status mismatch detected, updating and broadcasting...');
          updateConnectionStatus(actualStatus);
          broadcastConnectionStatusToContentScripts(actualStatus);
        }

        result = {
          status: actualStatus ? 'connected' : 'disconnected',
          isConnected: actualStatus,
          timestamp: Date.now(),
        };
        break;
      }

      case 'mcp:get-tools': {
        const { forceRefresh = false } = payload as GetToolsRequest;
        logger.debug(`Getting tools (forceRefresh: ${forceRefresh})`);

        // No configured endpoint or permission means there is nothing to query.
        if (!hasConfiguredServer || !(await hasMcpHostPermission(getServerUrl()))) {
          result = [];
          break;
        }

        try {
          const primitives = await getPrimitivesWithBackwardsCompatibility(
            getServerUrl(),
            forceRefresh,
            connectionType,
          );
          logger.debug(`Retrieved ${primitives.length} primitives from server`);

          // Use the helper function to normalize tools with proper schema handling
          const tools = normalizeTools(primitives);
          logger.debug(`Returning ${tools.length} normalized tools to content script`);

          result = tools;
        } catch (error) {
          logger.error('[Background] Error getting tools:', error);
          // Return empty array instead of throwing to prevent UI crashes
          result = [];
        }
        break;
      }

      case 'mcp:force-reconnect': {
        logger.debug('[Background] Force reconnect requested via context bridge');

        try {
          // The toolbar popup may have just saved the endpoint after the user
          // granted host access. Refresh storage before validating connection state.
          const storedConfig = await chrome.storage.local.get(['mcpServerUrl', 'mcpConnectionType']);
          const storedUrl = typeof storedConfig.mcpServerUrl === 'string' ? storedConfig.mcpServerUrl.trim() : '';
          if (storedUrl) {
            updateServerConfig(storedUrl, (storedConfig.mcpConnectionType as ConnectionType) || connectionType);
          }

          if (!hasConfiguredServer) {
            const message = 'Configure an MCP server before reconnecting.';
            updateConnectionStatus(false);
            broadcastConnectionStatusToContentScripts(false, message);
            result = { isConnected: false, error: message };
            break;
          }
          if (!(await hasMcpHostPermission(getServerUrl()))) {
            const message = getMcpPermissionRequiredMessage(getServerUrl());
            updateConnectionStatus(false);
            broadcastConnectionStatusToContentScripts(false, message);
            result = { isConnected: false, error: message };
            break;
          }

          // Broadcast reconnection started status
          broadcastConnectionStatusToContentScripts(false, 'Reconnecting...');

          logger.debug('[Background] Starting force reconnection process...');

          // ENHANCED: Reset connection state before attempting reconnection
          // This ensures we don't get blocked by consecutive failure limits
          resetMcpConnectionState();

          // Set a reasonable timeout for the reconnection process
          const reconnectionPromise = forceReconnectToMcpServer(getServerUrl(), connectionType);
          const timeoutPromise = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Reconnection timeout after 20 seconds')), 20000),
          );

          await Promise.race([reconnectionPromise, timeoutPromise]);
          logger.debug('[Background] Force reconnect completed successfully');

          // Update connection status
          const isConnected = await checkMcpServerConnection();
          updateConnectionStatus(isConnected);

          // Broadcast the new status to all content scripts
          broadcastConnectionStatusToContentScripts(isConnected);

          // If connected, also refresh and broadcast tools
          if (isConnected) {
            try {
              logger.debug('[Background] Fetching tools after successful reconnection...');
              const primitives = await getPrimitivesWithBackwardsCompatibility(getServerUrl(), true, connectionType);
              logger.debug(`Retrieved ${primitives.length} primitives after reconnection`);

              const tools = normalizeTools(primitives);
              logger.debug(`Broadcasting ${tools.length} normalized tools after reconnection`);

              broadcastToolsUpdateToContentScripts(tools);
            } catch (toolsError) {
              const toolFetchError = toolsError instanceof Error ? toolsError : new Error(String(toolsError));
              if (isExpectedConnectionFailure(toolFetchError)) {
                logger.warn(
                  '[Background] MCP connection was interrupted while refreshing tools:',
                  toolFetchError.message,
                );
              } else {
                logger.error('[Background] Error fetching tools after reconnect:', toolFetchError);
              }
            }
          }

          result = { isConnected, message: 'Reconnection completed' };
        } catch (error) {
          const reconnectError = error instanceof Error ? error : new Error(String(error));
          if (isExpectedConnectionFailure(reconnectError)) {
            logger.warn('[Background] MCP server is temporarily unavailable during reconnect:', reconnectError.message);
          } else {
            logger.error('[Background] Force reconnect failed:', reconnectError);
          }

          // Update connection status
          const isConnected = await checkMcpServerConnection();
          updateConnectionStatus(isConnected);

          // Broadcast the failure status
          const errorMessage = error instanceof Error ? error.message : String(error);
          broadcastConnectionStatusToContentScripts(isConnected, errorMessage);

          result = { isConnected, error: errorMessage };
        }
        break;
      }

      case 'mcp:get-server-config': {
        const stored = await chrome.storage.local.get(['mcpServerUrl', 'mcpConnectionType']);
        result = {
          uri: typeof stored.mcpServerUrl === 'string' ? stored.mcpServerUrl : '',
          connectionType: stored.mcpConnectionType || connectionType,
        };
        break;
      }

      case 'mcp:update-server-config': {
        const { config } = payload;
        if (!config || typeof config.uri !== 'string' || !config.uri.trim()) {
          throw new Error('Invalid server config: a non-empty uri is required');
        }
        const normalizedUri = config.uri.trim();

        // Auto-detect transport type from URI if not specified
        let newType = config.connectionType as ConnectionType;
        logger.debug(`Received connection type: ${config.connectionType}, parsed as: ${newType}`);
        if (!newType) {
          try {
            const url = new URL(normalizedUri);
            newType = url.protocol === 'ws:' || url.protocol === 'wss:' ? 'websocket' : 'sse';
          } catch {
            newType = connectionType;
          }
        }
        logger.debug(`Updating server config to: ${normalizedUri} (${newType})`);

        // Persist the normalized endpoint and mark it as explicitly configured.
        await chrome.storage.local.set({
          mcpServerUrl: normalizedUri,
          mcpConnectionType: newType,
        });
        updateServerConfig(normalizedUri, newType);

        // Broadcast config update immediately.
        broadcastConfigUpdateToContentScripts({ uri: normalizedUri, connectionType: newType });

        // Start async reconnection but don't block the response
        const reconnectPromise = (async () => {
          try {
            logger.debug('[Background] Starting async reconnection after config update...');
            if (!(await hasMcpHostPermission(normalizedUri))) {
              const message = getMcpPermissionRequiredMessage(normalizedUri);
              broadcastConnectionStatusToContentScripts(false, message);
              logger.info(message);
              return;
            }
            await forceReconnectToMcpServer(normalizedUri, newType);
            const isConnected = await checkMcpServerConnection();
            updateConnectionStatus(isConnected);
            broadcastConnectionStatusToContentScripts(isConnected);
            logger.debug(`Async reconnection completed, connected: ${isConnected}`);

            // If connected, fetch and broadcast tools
            if (isConnected) {
              try {
                const primitives = await getPrimitivesWithBackwardsCompatibility(normalizedUri, true, newType);
                const tools = normalizeTools(primitives);
                broadcastToolsUpdateToContentScripts(tools);
                logger.debug(`Broadcasted ${tools.length} normalized tools after config update`);
              } catch (toolError) {
                logger.warn('[Background] Failed to fetch tools after config update:', toolError);
              }
            }
          } catch (error) {
            logger.warn('[Background] Async reconnect after config update failed:', error);
            const isConnected = await checkMcpServerConnection();
            updateConnectionStatus(isConnected);
            const errorMessage = error instanceof Error ? error.message : String(error);
            broadcastConnectionStatusToContentScripts(isConnected, errorMessage);
          }
        })();

        // Don't await the reconnection, just start it
        reconnectPromise.catch(error => {
          logger.error('[Background] Unhandled error in async reconnection:', error);
        });

        result = { success: true };
        break;
      }

      case 'mcp:heartbeat': {
        // Handle heartbeat from content script
        const { timestamp } = payload;
        const isConnected = isMcpServerConnected();

        result = {
          timestamp: Date.now(),
          isConnected,
          receivedTimestamp: timestamp,
        };

        // Also broadcast heartbeat response via context bridge
        if (message.id) {
          // Send heartbeat response event to all tabs
          setTimeout(() => {
            chrome.tabs.query({}, tabs => {
              tabs.forEach(tab => {
                if (tab.id) {
                  chrome.tabs
                    .sendMessage(tab.id, {
                      type: 'mcp:heartbeat-response',
                      payload: { timestamp: Date.now(), isConnected },
                      origin: 'background',
                      timestamp: Date.now(),
                    })
                    .catch(() => {
                      // Ignore errors for tabs that can't receive messages
                    });
                }
              });
            });
          }, 0);
        }
        break;
      }

      default:
        throw new Error(`Unhandled MCP message type: ${messageType}`);
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;
    logger.debug(`MCP message ${messageType} processed in ${processingTime}ms`);

    // Send successful response with proper structure
    sendResponse({
      type: `${messageType}:response`,
      payload: result,
      success: true,
      timestamp: Date.now(),
      processingTime,
      origin: 'background',
      id: message.id,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`MCP message handling error (${processingTime}ms):`, error);

    // Send error response with proper structure
    sendResponse({
      type: `${messageType}:response`,
      error: errorMessage,
      success: false,
      timestamp: Date.now(),
      processingTime,
      origin: 'background',
      id: message.id,
    });
  }
}

/**
 * Broadcast connection status to all content scripts via context bridge
 *
 * @param isConnected - Whether the MCP server is connected
 * @param error - Optional error message if connection failed
 */
function broadcastConnectionStatusToContentScripts(isConnected: boolean, error?: string) {
  const status = error ? 'error' : isConnected ? 'connected' : 'disconnected';

  logger.debug(`Broadcasting connection status: ${status} (connected: ${isConnected})`);

  const broadcastMessage: BaseMessage & { payload: ConnectionStatusChangedBroadcast } = {
    type: 'connection:status-changed',
    payload: {
      status: status as any, // Type assertion needed due to status calculation
      error: error || undefined,
      isConnected,
      timestamp: Date.now(),
    },
    origin: 'background',
    timestamp: Date.now(),
  };

  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, broadcastMessage).catch(() => {
          // Ignore errors for tabs that can't receive messages
        });
      }
    });
  });
}

/**
 * Broadcast tools update to all content scripts via context bridge
 *
 * @param tools - Array of available MCP tools
 */
function broadcastToolsUpdateToContentScripts(tools: any[]) {
  logger.debug(`Broadcasting tools update to content scripts: ${tools.length} tools`);

  const broadcastMessage: BaseMessage & { payload: ToolUpdateBroadcast } = {
    type: 'mcp:tool-update',
    payload: {
      tools,
    },
    origin: 'background',
    timestamp: Date.now(),
  };

  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, broadcastMessage).catch(() => {
          // Ignore errors for tabs that can't receive messages
        });
      }
    });
  });
}

/**
 * Broadcast server config update to all content scripts via context bridge
 *
 * @param config - The updated server configuration
 */
function broadcastConfigUpdateToContentScripts(config: { uri: string; connectionType?: string }) {
  logger.debug(`Broadcasting config update to content scripts: ${config.uri}`);

  const broadcastMessage: BaseMessage & { payload: ServerConfigUpdatedBroadcast } = {
    type: 'mcp:server-config-updated',
    payload: {
      config: config as any, // Type assertion due to partial config structure
    },
    origin: 'background',
    timestamp: Date.now(),
  };

  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, broadcastMessage).catch(() => {
          // Ignore errors for tabs that can't receive messages
        });
      }
    });
  });
}

// Revocation applies to an already running worker as well as the next worker startup.
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'local' &&
    ['privacyConsentGranted', 'privacyConsentVersion', 'privacyConsentTimestamp'].some(key => key in changes)
  ) {
    resetMcpConnectionState();
    updateConnectionStatus(false);
    broadcastConnectionStatusToContentScripts(false);
  }
});
chrome.permissions.onRemoved.addListener(() => {
  resetMcpConnectionState();
  updateConnectionStatus(false);
  broadcastConnectionStatusToContentScripts(false);
});
