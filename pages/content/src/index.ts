/**
 * Content Script
 *
 * This is the entry point for the content script that runs on web pages.
 * Now uses the comprehensive Session 10 initialization system.
 */

import './tailwind-input.css';
import { logMessage } from '@src/utils/helpers';
import { mcpClient } from './core/mcp-client';
import { eventBus } from './events/event-bus';
import type { ConnectionStatus } from './types/stores';
import { useConnectionStore } from './stores/connection.store';
import { useConfigStore } from './stores/config.store';
import { useAdapterStore } from './stores/adapter.store';
import { initializeLogger } from '@extension/shared/lib/logger';

// Import the new initialization system
import { applicationInit, applicationCleanup, initializationUtils } from './core/main-initializer';

// Import the render script functions
import {
  initialize as initializeRenderer,
  startDirectMonitoring,
  stopDirectMonitoring,
  stopFunctionResultMonitoring,
  processFunctionCalls as renderFunctionCalls,
  checkForUnprocessedFunctionCalls,
  configureFunctionCallRenderer,
} from '@src/render_prescript/src/index';

// Legacy adapter registry has been removed - functionality moved to new architecture

// Import the automation service
import { initializeAllServices, cleanupAllServices } from './services';
import { createLogger } from '@extension/shared/lib/logger';
import {
  DISABLED_SITES_STORAGE_KEY,
  fetchDisabledSites,
  getCachedCurrentSiteDisabled,
  isSiteDisabled,
  normalizeDisabledSites,
  resolveSiteIdFromHostname,
  setCachedCurrentSiteDisabled,
} from './utils/siteControl';

// Add this as a global recovery mechanism for the sidebar

const logger = createLogger('content_script');

let recoveryIntervalId: ReturnType<typeof setInterval> | null = null;
let isExtensionActiveOnSite = false;
let hasInitializedOnce = false;

function stopSidebarRecovery(): void {
  if (recoveryIntervalId !== null) {
    clearInterval(recoveryIntervalId);
    recoveryIntervalId = null;
  }
}

function setupSidebarRecovery(): void {
  stopSidebarRecovery();
  // Watch for the case where push mode is enabled but sidebar isn't visible
  recoveryIntervalId = setInterval(() => {
    try {
      if (!isExtensionActiveOnSite) return;
      // Check if there's an active sidebar manager
      const sidebarManager = (window as any).activeSidebarManager;
      if (!sidebarManager) return;

      // Get HTML element to check for push-mode-enabled class
      const htmlElement = document.documentElement;

      // Check if push mode is enabled but host is invisible or missing
      if (htmlElement.classList.contains('push-mode-enabled')) {
        const shadowHost = sidebarManager.getShadowHost();

        // If shadow host exists but is not visible, force it
        if (shadowHost) {
          if (
            shadowHost.style.display !== 'block' ||
            window.getComputedStyle(shadowHost).display === 'none' ||
            shadowHost.style.opacity !== '1' ||
            parseFloat(window.getComputedStyle(shadowHost).opacity) < 0.9
          ) {
            logMessage('[SidebarRecovery] Detected invisible sidebar with push mode enabled, forcing visibility');
            shadowHost.style.display = 'block';
            shadowHost.style.opacity = '1';
            shadowHost.classList.add('initialized');

            // OPTIMIZATION: Don't force a re-render unless absolutely necessary
            // The sidebar content should automatically update through React state management
            logMessage(
              '[SidebarRecovery] Sidebar visibility restored - skipping re-render to avoid performance issues',
            );
            // sidebarManager.refreshContent();
          }
        } else {
          // If shadow host doesn't exist but push mode is enabled,
          // try to re-initialize the sidebar
          logMessage('[SidebarRecovery] Push mode enabled but shadow host missing, re-initializing sidebar');
          sidebarManager.initialize().then(() => {
            sidebarManager.show();
          });
        }
      }
    } catch (error) {
      logger.error('[SidebarRecovery] Error:', error);
    }
  }, 1000); // Check every second

  // Clean up when navigating away
  // pagehide is supported on restricted pages where unload is disallowed.
  window.addEventListener('pagehide', event => {
    // Keep the interval while the page is in the back-forward cache.
    if (!event.persisted) {
      stopSidebarRecovery();
    }
  });

  logMessage('[SidebarRecovery] Sidebar recovery mechanism set up');
}

/**
 * Content Script Entry Point - Session 10 Implementation
 */

// Initialize the centralized logger system
// Logs are automatically controlled by environment:
// - Development (import.meta.env.DEV): All logs enabled (DEBUG level)
// - Production (import.meta.env.PROD): Only errors enabled (ERROR level)
initializeLogger();
logMessage('Content script loaded - initializing with Session 10 architecture');

// Improved initialization strategy for the function call renderer
let rendererInitialized = false;

// More robust initialization with retries if immediate initialization failed
const initRendererWithRetry = (retries = 3, delay = 300) => {
  if (rendererInitialized || !isExtensionActiveOnSite) return; // Don't try again if already initialized or site disabled

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    try {
      initializeRenderer();
      rendererInitialized = true;
      logMessage('Function call renderer initialized successfully on retry.');

      // Process any function calls that might have been missed
      setTimeout(() => {
        if (rendererInitialized && isExtensionActiveOnSite) {
          renderFunctionCalls();
          checkForUnprocessedFunctionCalls();
        }
      }, 500);
    } catch (error) {
      logger.error('Error initializing function call renderer:', error);
      if (retries > 0) {
        logMessage(`Retrying renderer initialization in ${delay}ms... (${retries} retries left)`);
        setTimeout(() => initRendererWithRetry(retries - 1, delay), delay);
      } else {
        logMessage('Failed to initialize function call renderer after multiple retries.');
      }
    }
  } else {
    // DOM not fully ready, schedule another check
    logMessage('DOM not ready for renderer initialization, retrying...');
    setTimeout(() => initRendererWithRetry(retries, delay), 100); // Use shorter delay for readyState check
  }
};

async function teardownExtensionForCurrentSite(): Promise<void> {
  if (!isExtensionActiveOnSite && !rendererInitialized) {
    return;
  }

  logMessage(`[Content Script] Disabling MCP-Interceptor on ${window.location.hostname}...`);
  isExtensionActiveOnSite = false;
  rendererInitialized = false;
  stopSidebarRecovery();

  try {
    stopDirectMonitoring();
    stopFunctionResultMonitoring();
  } catch (error) {
    logger.warn('Error stopping renderer monitoring:', error);
  }

  try {
    const activeSidebar = (window as any).activeSidebarManager;
    if (activeSidebar && typeof activeSidebar.destroy === 'function') {
      activeSidebar.destroy();
    }
  } catch (error) {
    logger.warn('Error destroying activeSidebarManager:', error);
  }

  try {
    await cleanupAllServices();
    await applicationCleanup();
  } catch (error) {
    logger.warn('Error during application cleanup on site disable:', error);
  }

  // Ensure any injected UI containers or push-mode styles are removed cleanly
  try {
    document.documentElement.classList.remove('push-mode-enabled');
    document.documentElement.style.removeProperty('--sidebar-width-mcp');
    document.documentElement.style.removeProperty('margin-right');
    document.documentElement.style.removeProperty('width');
    document.querySelectorAll('.mcp-popover-container, #mcp-popover-portal, #mcp-button-wrapper, #mcp-sidebar-shadow-host').forEach(el => {
      el.remove();
    });
  } catch (error) {
    logger.warn('Error removing residual DOM elements:', error);
  }

  logMessage(`[Content Script] MCP-Interceptor disabled on ${window.location.hostname}`);
}

async function startExtensionForCurrentSite(): Promise<void> {
  if (isExtensionActiveOnSite) return;

  isExtensionActiveOnSite = true;
  hasInitializedOnce = true;

  setupSidebarRecovery();

  try {
    initializeRenderer();
    rendererInitialized = true;
    logMessage('Function call renderer initialized');
  } catch (error) {
    logger.error('Error in immediate renderer initialization:', error);
    initRendererWithRetry();
  }

  try {
    logMessage('Starting comprehensive application initialization...');

    try {
      if (!mcpClient.isReady()) {
        logMessage('MCP client not ready, initialization will be handled by the client itself');
      } else {
        logMessage('MCP client is ready for communication');
      }
      (window as any).mcpClient = mcpClient;
    } catch (mcpError) {
      logger.error('MCP client initialization warning:', mcpError);
    }

    await applicationInit();
    await initializeAllServices();

    logMessage('Application initialized successfully with Session 10 architecture');

    try {
      const { pluginRegistry } = await import('./plugins/plugin-registry');
      (window as any).pluginRegistry = pluginRegistry;
    } catch (pluginError) {
      logger.warn('Failed to expose plugin registry globally:', pluginError);
    }

    if (process.env.NODE_ENV === 'development') {
      (window as any).appInitUtils = initializationUtils;
    }
  } catch (error) {
    logger.error('Failed to initialize application with Session 10 architecture:', error);
    try {
      initializeRenderer();
      rendererInitialized = true;
    } catch (fallbackError) {
      logger.error('Fallback initialization also failed:', fallbackError);
    }
  }
}

// Bootstrap based on per-site enable/disable state
(async function bootstrapWithSiteControl() {
  const hostname = window.location.hostname;
  const cachedDisabled = getCachedCurrentSiteDisabled();

  // Fast path: if not cached as disabled, start renderer early to avoid flicker, then verify storage
  if (!cachedDisabled) {
    try {
      initializeRenderer();
      rendererInitialized = true;
      logMessage('Function call renderer initialized immediately at script load');
    } catch (error) {
      logger.error('Error in immediate renderer initialization:', error);
    }
  }

  const disabledSites = await fetchDisabledSites();
  const currentlyDisabled = isSiteDisabled(hostname, disabledSites);
  setCachedCurrentSiteDisabled(currentlyDisabled);

  if (currentlyDisabled) {
    logMessage(`[Content Script] Site ${hostname} (${resolveSiteIdFromHostname(hostname)}) is disabled by user settings.`);
    if (rendererInitialized) {
      await teardownExtensionForCurrentSite();
    }
    return;
  }

  await startExtensionForCurrentSite();
})();

// React to live per-site enable/disable changes from Sidebar Settings, MCP Popover, or Toolbar Popup
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[DISABLED_SITES_STORAGE_KEY]) {
      const updatedList = normalizeDisabledSites(changes[DISABLED_SITES_STORAGE_KEY].newValue);
      const hostname = window.location.hostname;
      const shouldDisable = isSiteDisabled(hostname, updatedList);
      setCachedCurrentSiteDisabled(shouldDisable);

      if (shouldDisable && isExtensionActiveOnSite) {
        teardownExtensionForCurrentSite().catch(err => logger.error('Failed to teardown extension on site disable:', err));
      } else if (!shouldDisable && !isExtensionActiveOnSite) {
        if (hasInitializedOnce) {
          // Cleanest way to re-mount all adapters and shadow DOM after a teardown is to reload or start fresh
          window.location.reload();
        } else {
          startExtensionForCurrentSite().catch(err => logger.error('Failed to start extension on site enable:', err));
        }
      }
    }
  });
}

// Listen for connection status changes via the global event bus
eventBus.on('connection:status-changed', ({ status }: { status: ConnectionStatus }) => {
  if (!isExtensionActiveOnSite) return;
  const isConnected = status === 'connected';
  logMessage(`[Content Script] MCP connection status changed: ${isConnected ? 'Connected' : 'Disconnected'}`);

  // Update the current adapter via the new plugin system
  const adapterStore = useAdapterStore.getState();
  const currentAdapterReg = adapterStore.getActiveAdapter();
  if (currentAdapterReg && currentAdapterReg.instance) {
    // Emit adapter connection status update event
    eventBus.emit('adapter:connection-status-changed', {
      isConnected,
      adapterId: adapterStore.activeAdapterName,
    });
    (window as any).mcpAdapter = currentAdapterReg.instance;
  }
});

// App version update handler
function handleVersionUpdate(message: any, sendResponse: (response: any) => void): void {
  try {
    const { oldVersion, newVersion, timestamp } = message.data;
    logger.debug(`Extension updated from ${oldVersion} to ${newVersion}`);

    // Update config store with new version
    const configStore = useConfigStore.getState();
    configStore.setUserProperties({
      extensionVersion: newVersion,
      lastActiveDate: new Date().toISOString(),
    });

    // Emit version update event
    eventBus.emit('app:version-updated', { oldVersion, newVersion, timestamp });

    sendResponse({ success: true, timestamp: Date.now() });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error handling version update:`, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logMessage(`Message received in content script: ${JSON.stringify(message)}`); // Log all incoming messages

  // Use the new plugin system to get current adapter
  const adapterStore = useAdapterStore.getState();
  const currentAdapterReg = adapterStore.getActiveAdapter();
  const adapter = currentAdapterReg?.instance;

  if (message.command === 'getStats') {
    sendResponse({
      success: true,
      stats: {
        mcpConnected: useConnectionStore.getState().status === 'connected',
        activeSite: adapter?.name || 'Unknown',
      },
    });
  } else if (message.command === 'toggleSidebar') {
    // Use the sidebar plugin events since adapters may not have direct sidebar methods
    eventBus.emit('sidebar:toggle-requested', {});
    sendResponse({ success: true });
  } else if (message.command === 'showSidebarWithToolOutputs') {
    // Use the sidebar plugin events since adapters may not have direct sidebar methods
    eventBus.emit('sidebar:show-with-outputs', {});
    sendResponse({ success: true });
  } else if (message.command === 'callMcpTool') {
    // Handle MCP tool call requests from popup
    const { toolName, args } = message;
    if (toolName && args) {
      mcpClient
        .callTool(toolName, args)
        .then(result => {
          sendResponse({ success: true, result });
        })
        .catch(err => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          sendResponse({ success: false, error: errorMsg });
        });
      return true; // Indicate we'll respond asynchronously
    } else {
      sendResponse({ success: false, error: 'Invalid tool call request' });
    }
  } else if (message.command === 'refreshSidebarContent') {
    // Use the sidebar plugin events since adapters may not have direct sidebar methods
    eventBus.emit('sidebar:refresh-content', {});
    sendResponse({ success: true });
  } else if (message.command === 'setFunctionCallRendering') {
    // Handle toggling function call rendering
    const { enabled } = message;
    if (rendererInitialized) {
      if (enabled) {
        logMessage('Starting function call monitoring.');
        startDirectMonitoring();
        // Run a check immediately after enabling
        renderFunctionCalls();
        checkForUnprocessedFunctionCalls();
      } else {
        logMessage('Stopping function call monitoring.');
        stopDirectMonitoring();
      }
      sendResponse({ success: true });
    } else {
      logMessage('Cannot toggle function call rendering: Renderer not initialized.');
      sendResponse({ success: false, error: 'Renderer not initialized' });
    }
  } else if (message.command === 'forceRenderFunctionCalls') {
    // Force a re-render/check for function calls
    if (rendererInitialized) {
      logMessage('Forcing function call render check.');
      renderFunctionCalls();
      checkForUnprocessedFunctionCalls();
      sendResponse({ success: true });
    } else {
      logMessage('Cannot force render: Renderer not initialized.');
      sendResponse({ success: false, error: 'Renderer not initialized' });
    }
  } else if (message.command === 'configureRenderer') {
    // Configure the renderer
    if (rendererInitialized) {
      logMessage(`Configuring function call renderer with options: ${JSON.stringify(message.options)}`);
      configureFunctionCallRenderer(message.options);
      sendResponse({ success: true });
    } else {
      logMessage('Cannot configure renderer: Not initialized.');
      sendResponse({ success: false, error: 'Renderer not initialized' });
    }
  }
  // App version update handling
  else if (message.type === 'app:version-updated') {
    handleVersionUpdate(message, sendResponse);
    return true; // Async response
  }

  // Always return true if you want to use sendResponse asynchronously
  return true;
});

// Handle page unload to clean up resources (Session 10)
window.addEventListener('beforeunload', async () => {
  logMessage('Page unloading - starting comprehensive cleanup...');

  try {
    // Cleanup all services first
    await cleanupAllServices();

    // Use the comprehensive cleanup from Session 10
    await applicationCleanup();

    // Legacy adapter cleanup is now handled by the plugin system cleanup
    // The applicationCleanup() already handles all plugin cleanup

    logMessage('Comprehensive cleanup completed');
  } catch (error) {
    logger.error('Error during comprehensive cleanup:', error);
  }
});

// Expose mcpClient to the global window object for renderer or debugging access
(window as any).mcpClient = mcpClient;
logger.debug('[Content Script] mcpClient exposed to window object for renderer use.');

// Set the current adapter to global window object using the new plugin system
const adapterStore = useAdapterStore.getState();
const currentAdapterReg = adapterStore.getActiveAdapter();
if (currentAdapterReg && currentAdapterReg.instance) {
  (window as any).mcpAdapter = currentAdapterReg.instance;
  logger.debug(`Current adapter (${currentAdapterReg.plugin.name}) exposed to window object as mcpAdapter.`);
} else {
  logger.debug('[Content Script] No active adapter found to expose to window object.');
}
