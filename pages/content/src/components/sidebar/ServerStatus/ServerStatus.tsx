import type { ConnectionType } from '../../../types/stores';
import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useMcpCommunication } from '@src/hooks/useMcpCommunication';
import { useConnectionStatus, useServerConfig } from '../../../hooks';
import { logMessage } from '@src/utils/helpers';
import { eventBus } from '@src/events/event-bus';
import { Typography, Icon, Button } from '../ui';
import { cn } from '@src/lib/utils';
import { Card, CardContent } from '@src/components/ui/card';
import { createLogger } from '@extension/shared/lib/logger';
import { useLanguage, getReadmeUrl, translateServerMessage } from '@src/utils/i18n';

const logger = createLogger('ServerStatus');

interface ServerStatusProps {
  status: string;
}

const ServerStatus: React.FC<ServerStatusProps> = ({ status: initialStatus }) => {
  const { language, isZh, t } = useLanguage();
  // Use Zustand hooks for connection status and server config
  const {
    status: connectionStatus,
    isConnected,
    isReconnecting: storeIsReconnecting,
    error: connectionError,
  } = useConnectionStatus();

  const { config: serverConfig, setConfig: setServerConfig } = useServerConfig();

  // Local UI state
  const [showDetails, setShowDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastReconnectTime, setLastReconnectTime] = useState<string>('');
  const [serverUri, setServerUri] = useState<string>(serverConfig.uri || '');
  const [connectionType, setConnectionType] = useState<ConnectionType>(serverConfig.connectionType || 'sse');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [hasBackgroundError, setHasBackgroundError] = useState<boolean>(false);
  const [isEditingUri, setIsEditingUri] = useState<boolean>(false);
  const [isEditingConnectionType, setIsEditingConnectionType] = useState<boolean>(false);
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  const [configFetched, setConfigFetched] = useState<boolean>(false);

  // Animation states
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [settingsAnimating, setSettingsAnimating] = useState(false);
  const [detailsAnimating, setDetailsAnimating] = useState(false);

  // Get communication methods with error handling (still needed for some operations)
  const communicationMethods = useMcpCommunication();

  // Use connection status from store, fallback to prop
  const status = connectionStatus || initialStatus || 'unknown';

  // Debug logging to track status changes
  useEffect(() => {
    logger.debug(
      `Status update - connectionStatus: ${connectionStatus}, initialStatus: ${initialStatus}, final: ${status}, isConnected: ${isConnected}`,
    );
  }, [connectionStatus, initialStatus, status, isConnected]);

  // Destructure with fallbacks in case useBackgroundCommunication fails
  const forceReconnect = useCallback(async () => {
    try {
      if (!communicationMethods.forceReconnect) {
        throw new Error('Communication method unavailable');
      }
      return await communicationMethods.forceReconnect();
    } catch (error) {
      logMessage(`[ServerStatus] Force reconnect error: ${error instanceof Error ? error.message : String(error)}`);
      setHasBackgroundError(true);
      return false;
    }
  }, [communicationMethods]);

  // Get the last connection error from the background communication hook
  const backgroundConnectionError = communicationMethods.lastConnectionError || '';

  const refreshTools = useCallback(
    async (forceRefresh = false) => {
      try {
        if (!communicationMethods.refreshTools) {
          throw new Error('Communication method unavailable');
        }
        return await communicationMethods.refreshTools(forceRefresh);
      } catch (error) {
        logMessage(`[ServerStatus] Refresh tools error: ${error instanceof Error ? error.message : String(error)}`);
        setHasBackgroundError(true);
        return [];
      }
    },
    [communicationMethods],
  );

  const getServerConfig = useCallback(async () => {
    try {
      if (!communicationMethods.getServerConfig) {
        throw new Error('Communication method unavailable');
      }
      return await communicationMethods.getServerConfig();
    } catch (error) {
      logMessage(`[ServerStatus] Get server config error: ${error instanceof Error ? error.message : String(error)}`);
      setHasBackgroundError(true);
      throw error; // Don't fallback to default, let caller handle the error
    }
  }, [communicationMethods]);

  const updateServerConfig = useCallback(
    async (config: { uri: string; connectionType: ConnectionType }) => {
      try {
        if (!communicationMethods.updateServerConfig) {
          throw new Error('Communication method unavailable');
        }
        return await communicationMethods.updateServerConfig(config);
      } catch (error) {
        logMessage(
          `[ServerStatus] Update server config error: ${error instanceof Error ? error.message : String(error)}`,
        );
        setHasBackgroundError(true);
        return false;
      }
    },
    [communicationMethods],
  );

  // Update server URI and connection type when config changes
  useEffect(() => {
    if (serverConfig.uri && !isEditingUri) {
      setServerUri(serverConfig.uri);
      logMessage(`[ServerStatus] Updated server URI from config: ${serverConfig.uri}`);
    }
    // Only update connection type from store if user is not actively editing it
    if (serverConfig.connectionType && !isEditingConnectionType) {
      setConnectionType(serverConfig.connectionType);
      logMessage(`[ServerStatus] Updated connection type from config: ${serverConfig.connectionType}`);
    }
  }, [serverConfig.uri, serverConfig.connectionType, isEditingUri, isEditingConnectionType]);

  // Force immediate connection status check on mount
  useEffect(() => {
    const checkImmediateStatus = async () => {
      if (communicationMethods.forceConnectionStatusCheck) {
        try {
          logMessage('[ServerStatus] Forcing immediate connection status check on mount');
          await communicationMethods.forceConnectionStatusCheck();
        } catch (error) {
          logMessage(
            `[ServerStatus] Immediate status check failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    };

    // Small delay to ensure everything is initialized
    const timeoutId = setTimeout(checkImmediateStatus, 100);
    return () => clearTimeout(timeoutId);
  }, []); // Run only once on mount

  // Update status message based on connection state from store
  useEffect(() => {
    // During reconnection, don't override the status message
    if (isReconnecting || storeIsReconnecting) {
      return;
    }

    if (hasBackgroundError) {
      setStatusMessage(
        t('Extension background services unavailable. Try reloading the page.', '扩展后台服务不可用，请尝试刷新页面。'),
      );
    } else {
      switch (status) {
        case 'connected':
          setStatusMessage(t('MCP Server is connected and ready', 'MCP 服务器已连接并就绪'));
          // Brief success indication for new connections
          if (!isConnected) {
            setShowSuccessAnimation(true);
            setTimeout(() => setShowSuccessAnimation(false), 1000);
          }
          break;
        case 'disconnected':
          setStatusMessage(
            t('MCP Server is unavailable. Some features will be limited.', 'MCP 服务器不可用，部分功能将受限。'),
          );
          break;
        case 'error':
          setStatusMessage(
            connectionError
              ? translateServerMessage(connectionError, language)
              : t(
                  'Server connection error. Check your configuration and try again.',
                  '服务器连接错误，请检查配置后重试。',
                ),
          );
          break;
        default:
          setStatusMessage(t('Checking MCP Server status...', '正在检查 MCP 服务器状态...'));
      }
    }
  }, [status, connectionError, hasBackgroundError, isReconnecting, storeIsReconnecting, isConnected, language, t]);

  // Enhanced event bus integration for real-time status updates
  useEffect(() => {
    const unsubscribeCallbacks: (() => void)[] = [];

    // Listen for connection status changes from the event bus
    const unsubscribeConnection = eventBus.on('connection:status-changed', data => {
      logMessage(`[ServerStatus] Connection status event: ${data.status}${data.error ? ` (${data.error})` : ''}`);

      // Update local error state if there's an error
      if (data.error) {
        setLastErrorMessage(data.error);
      } else {
        setLastErrorMessage('');
      }

      // Update last reconnect time for successful connections
      if (data.status === 'connected') {
        setLastReconnectTime(new Date().toLocaleTimeString());
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 1000);
      }
    });
    unsubscribeCallbacks.push(unsubscribeConnection);

    // Listen for context bridge events
    const unsubscribeBridgeInvalidated = eventBus.on('context:bridge-invalidated', data => {
      logMessage(`[ServerStatus] Context bridge invalidated: ${data.error}`);
      setHasBackgroundError(true);
      setStatusMessage(`Extension context invalidated: ${data.error}`);
    });
    unsubscribeCallbacks.push(unsubscribeBridgeInvalidated);

    // Listen for heartbeat events to monitor connection health
    const unsubscribeHeartbeat = eventBus.on('connection:heartbeat', data => {
      // Update connection health indicator if needed
      logMessage(`[ServerStatus] Heartbeat received: ${data.timestamp}`);
    });
    unsubscribeCallbacks.push(unsubscribeHeartbeat);

    // Cleanup all event listeners
    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Check for background communication issues
  useEffect(() => {
    const checkBackgroundAvailability = () => {
      const methodsAvailable = !!(
        typeof communicationMethods.forceReconnect === 'function' &&
        typeof communicationMethods.refreshTools === 'function' &&
        typeof communicationMethods.getServerConfig === 'function' &&
        typeof communicationMethods.updateServerConfig === 'function'
      );

      if (!methodsAvailable && !hasBackgroundError) {
        setHasBackgroundError(true);
        setStatusMessage('Extension background services unavailable. Try reloading the page.');
      } else if (methodsAvailable && hasBackgroundError) {
        // Background methods have become available again
        setHasBackgroundError(false);
      }
    };

    checkBackgroundAvailability();

    // Check less frequently to reduce excessive calls - reduced from 10s to 30s
    const intervalId = setInterval(checkBackgroundAvailability, 30000);
    return () => clearInterval(intervalId);
  }, [communicationMethods, hasBackgroundError]);

  useEffect(() => {
    // Only fetch server configuration on initial mount - don't refetch while user is editing
    const fetchInitialServerConfig = async () => {
      try {
        logMessage('[ServerStatus] Fetching initial server configuration from background storage');
        const config = await getServerConfig();
        if (config) {
          if (config.uri) {
            setServerUri(config.uri);
            logMessage(`[ServerStatus] Initial server URI loaded: ${config.uri}`);
          }
          if (config.connectionType) {
            setConnectionType(config.connectionType);
            logMessage(`[ServerStatus] Initial connection type loaded: ${config.connectionType}`);
          }
          setConfigFetched(true);
        } else {
          logMessage('[ServerStatus] No valid server configuration received from background storage');
          setServerUri(''); // Set empty string to indicate no config loaded
          setConfigFetched(true);
        }
      } catch (error) {
        logMessage(
          `[ServerStatus] Error fetching server config: ${error instanceof Error ? error.message : String(error)}`,
        );
        setServerUri(''); // Set empty string to indicate fetch failed
        setConfigFetched(true);
      }
    };

    // Fetch initial server configuration on mount only once
    if (
      communicationMethods &&
      typeof communicationMethods.getServerConfig === 'function' &&
      !configFetched &&
      !isEditingUri &&
      !isEditingConnectionType
    ) {
      fetchInitialServerConfig().catch(() => {
        logMessage('[ServerStatus] Failed to fetch server configuration');
        setServerUri(''); // Set empty string as last resort
      });
    }
  }, [communicationMethods, isEditingUri, isEditingConnectionType, configFetched, getServerConfig]); // Add configFetched dependency

  const handleReconnect = async () => {
    const startTime = Date.now();
    const minDisplayDuration = 1200; // Minimum display time for smooth UX

    try {
      logMessage('[ServerStatus] Reconnect button clicked');
      setIsReconnecting(true);
      setStatusMessage(t('Attempting to reconnect to MCP server...', '正在尝试重新连接 MCP 服务器...'));

      // Check if we can connect to the background script first
      if (hasBackgroundError) {
        logMessage('[ServerStatus] Attempting to recover background connection');
        // Wait a bit to see if background services become available
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check again if background services are available
        if (!communicationMethods.forceReconnect) {
          throw new Error('Background services still unavailable');
        }

        // If we got here, background services have been restored
        setHasBackgroundError(false);
      }

      logMessage('[ServerStatus] Calling forceReconnect method');
      const success = await forceReconnect();
      logMessage(`[ServerStatus] Reconnection ${success ? 'succeeded' : 'failed'}`);

      // Update last reconnect time
      const now = new Date();
      setLastReconnectTime(now.toLocaleTimeString());

      // Ensure minimum display duration before updating final state
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        logMessage(`[ServerStatus] Waiting ${remainingTime}ms for smooth transition`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // Set appropriate status message based on reconnection result
      if (success) {
        setStatusMessage(t('Successfully reconnected to MCP server', '已成功重新连接 MCP 服务器'));
        logMessage('[ServerStatus] Reconnection successful, fetching fresh tool list');
        try {
          const tools = await refreshTools(true);
          logMessage(`[ServerStatus] Successfully fetched ${tools.length} tools after reconnection`);
        } catch (refreshError) {
          logMessage(
            `[ServerStatus] Error fetching tools after reconnection: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
          );
        }
      } else {
        setStatusMessage(
          t('Failed to reconnect to MCP server. Some features will be limited.', '重新连接 MCP 服务器失败，部分功能将受限。'),
        );
      }
    } catch (error) {
      // Ensure minimum display time even for errors
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      logMessage(`[ServerStatus] Reconnection error: ${error instanceof Error ? error.message : String(error)}`);

      // Use the enhanced error message from the error object and store it
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastErrorMessage(errorMessage); // Store the detailed error message

      // Display the enhanced error message in the status
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setStatusMessage(
          t(
            'Server URL not found (404). Please verify your MCP server URL and ensure the server is running.',
            '未找到服务器地址 (404)，请确认 MCP 服务器 URL 正确且服务正在运行。',
          ),
        );
      } else if (errorMessage.includes('403')) {
        setStatusMessage(
          t(
            'Access forbidden (403). Please check server permissions and authentication settings.',
            '访问被拒绝 (403)，请检查服务器权限和认证设置。',
          ),
        );
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        setStatusMessage(
          t(
            'Server error detected. The MCP server may be experiencing issues.',
            '检测到服务器内部错误，MCP 服务器可能出现异常。',
          ),
        );
      } else if (errorMessage.includes('Connection refused') || errorMessage.includes('ECONNREFUSED')) {
        setStatusMessage(
          t(
            'Connection refused. Please verify the MCP server is running at the configured URL.',
            '连接被拒绝，请确认 MCP 服务器已在所配置的 URL 上启动。',
          ),
        );
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        setStatusMessage(
          t(
            'Connection timeout. The server may be slow to respond or unreachable.',
            '连接超时，服务器响应过慢或无法访问。',
          ),
        );
      } else if (errorMessage.includes('ENOTFOUND')) {
        setStatusMessage(
          t(
            'Server not found. Please check the server URL and your network connection.',
            '无法解析服务器地址，请检查服务器 URL 和网络连接。',
          ),
        );
      } else {
        setStatusMessage(
          isZh
            ? `连接失败：${translateServerMessage(errorMessage, language)}`
            : `Connection failed: ${errorMessage}`,
        );
      }
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDetails = () => {
    setDetailsAnimating(true);
    setTimeout(() => {
      setShowDetails(!showDetails);
      setDetailsAnimating(false);
    }, 150);
    logMessage(`[ServerStatus] Details ${showDetails ? 'hidden' : 'shown'}, status: ${status}`);
  };

  const handleSettings = () => {
    setSettingsAnimating(true);
    setTimeout(() => {
      setShowSettings(!showSettings);
      setSettingsAnimating(false);
    }, 150);
    logMessage(`[ServerStatus] Settings ${showSettings ? 'hidden' : 'shown'}`);
  };

  const handleServerUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setServerUri(e.target.value);
    setIsEditingUri(true); // Mark as editing when user types
  };

  const handleServerUriFocus = () => {
    setIsEditingUri(true); // Mark as editing when user focuses the input
  };

  const handleServerUriBlur = () => {
    // Don't immediately clear editing flag - wait for save or cancel
  };

  const getDefaultUriForType = (type: ConnectionType): string => {
    if (type === 'websocket') return 'ws://localhost:3006/message';
    if (type === 'streamable-http') return 'http://localhost:3006/mcp';
    return 'http://localhost:3006/sse';
  };

  const handleConnectionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextType = e.target.value as ConnectionType;
    const trimmedUri = serverUri.trim();
    const previousDefault = getDefaultUriForType(connectionType);
    if (!trimmedUri || trimmedUri === previousDefault || (connectionType === 'streamable-http' && trimmedUri === 'http://localhost:3006')) {
      setServerUri(getDefaultUriForType(nextType));
    }
    setConnectionType(nextType);
    setIsEditingConnectionType(true); // Mark as editing when user changes
  };

  const handleConnectionTypeFocus = () => {
    setIsEditingConnectionType(true); // Mark as editing when user focuses the select
  };

  const handleConnectionTypeBlur = () => {
    // Don't immediately clear editing flag - wait for save or cancel
  };

  const handleSaveServerConfig = async () => {
    if (!communicationMethods.updateServerConfig || hasBackgroundError) {
      logMessage('[ServerStatus] Background communication not available');
      return;
    }

    // Set stable loading state and prevent rapid UI changes
    setIsReconnecting(true);
    setLastReconnectTime(new Date().toLocaleTimeString());

    // Use a single stable message throughout the process to prevent flickers
    const stableMessage = t('Saving configuration and connecting...', '正在保存配置并连接...');
    setStatusMessage(stableMessage);

    // Clear any existing error
    setLastErrorMessage('');

    // Track the start time to ensure minimum display duration
    const startTime = Date.now();
    const minDisplayDuration = 1500; // Minimum 1.5 seconds to prevent jitter

    try {
      logMessage(`[ServerStatus] Saving server URI: ${serverUri} with connection type: ${connectionType}`);

      // Update server config using Zustand store
      setServerConfig({ uri: serverUri, connectionType });

      // Also update via background communication for backward compatibility
      await updateServerConfig({ uri: serverUri, connectionType });
      logMessage('[ServerStatus] Server config updated successfully');

      // Clear the editing flags since we successfully saved
      setIsEditingUri(false);
      setIsEditingConnectionType(false);

      // Trigger reconnect
      const success = await forceReconnect();
      logMessage(`[ServerStatus] Reconnection ${success ? 'succeeded' : 'failed'}`);

      // Calculate remaining time to ensure minimum display duration
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        logMessage(`[ServerStatus] Waiting ${remainingTime}ms to prevent visual jitter`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // Single final UI update to prevent flickers
      if (success) {
        setStatusMessage(t('Successfully connected to MCP server', '已成功连接 MCP 服务器'));

        // Refresh tools silently without UI updates
        try {
          const tools = await refreshTools(true);
          logMessage(`[ServerStatus] Successfully refreshed ${tools.length} tools after server change`);
        } catch (refreshError) {
          logMessage(
            `[ServerStatus] Error refreshing tools: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
          );
        }

        // Close settings on success
        setShowSettings(false);
      } else {
        const rawErr = backgroundConnectionError || lastErrorMessage;
        setStatusMessage(
          rawErr
            ? translateServerMessage(rawErr, language)
            : t(
                'Failed to connect to MCP server. Verify the server is running and host access is granted.',
                '连接 MCP 服务器失败，请确认服务已启动且已授予主机访问权限。',
              ),
        );
      }
    } catch (error) {
      // Still ensure minimum display time even for errors
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastErrorMessage(errorMessage);
      setStatusMessage(
        isZh
          ? `配置失败：${translateServerMessage(errorMessage, language)}`
          : `Configuration failed: ${errorMessage}`,
      );
      logMessage(`[ServerStatus] Save config error: ${errorMessage}`);
      // Keep settings open on error
    } finally {
      // Always reset reconnecting state
      setIsReconnecting(false);
    }
  };

  // Determine status color and icon
  const getStatusInfo = () => {
    // Define base colors, assuming dark mode variants are handled by Tailwind prefixes
    const baseColors = {
      emerald: { text: 'text-emerald-500', bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/20' },
      amber: { text: 'text-amber-500', bg: 'bg-amber-100', darkBg: 'dark:bg-amber-900/20' },
      rose: { text: 'text-rose-500', bg: 'bg-rose-100', darkBg: 'dark:bg-rose-900/20' },
      slate: { text: 'text-slate-500', bg: 'bg-slate-100', darkBg: 'dark:bg-slate-900/20' },
    };

    // Determine status display
    const displayStatus = isReconnecting ? 'reconnecting' : status;

    switch (displayStatus) {
      case 'connected':
        return {
          color: baseColors.emerald.text,
          bgColor: cn(baseColors.emerald.bg, baseColors.emerald.darkBg),
          icon: <Icon name="check" className={baseColors.emerald.text} />,
          label: t('Connected', '已连接'),
        };
      case 'reconnecting':
        return {
          color: baseColors.amber.text,
          bgColor: cn(baseColors.amber.bg, baseColors.amber.darkBg),
          icon: <Icon name="refresh" className={cn(baseColors.amber.text, 'animate-spin')} />,
          label: t('Reconnecting', '重连中'),
        };
      case 'disconnected':
        return {
          color: baseColors.rose.text,
          bgColor: cn(baseColors.rose.bg, baseColors.rose.darkBg),
          icon: <Icon name="x" className={baseColors.rose.text} />,
          label: t('Disconnected', '未连接'),
        };
      case 'error':
        return {
          color: baseColors.rose.text,
          bgColor: cn(baseColors.rose.bg, baseColors.rose.darkBg),
          icon: <Icon name="info" className={baseColors.rose.text} />,
          label: t('Error', '错误'),
        };
      default: // Unknown status
        return {
          color: baseColors.slate.text,
          bgColor: cn(baseColors.slate.bg, baseColors.slate.darkBg),
          icon: <Icon name="info" className={baseColors.slate.text} />,
          label: t('Unknown', '未知'),
        };
    }
  };

  // Get status info based on current state
  const statusInfo = getStatusInfo();

  // Determine if we should show enhanced visual cues for disconnected/error states
  const isDisconnectedOrError = status === 'disconnected' || status === 'error';

  return (
    <div
      className={cn(
        'relative px-4 py-3 border-b border-slate-200 dark:border-slate-800 transition-all duration-300 ease-out server-status-stable',
        // Add conditional styling for disconnected/error states with smooth transitions
        isDisconnectedOrError &&
          'bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/10 dark:to-red-900/10 border border-rose-200 dark:border-rose-800/50 rounded-sm shadow-sm',
      )}>
      {/* Success animation overlay - subtle */}
      {showSuccessAnimation && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/20 dark:to-green-900/20 opacity-30 animate-pulse rounded-sm" />
      )}

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ease-out server-status-icon',
              statusInfo.bgColor,
              // Simplified animations to prevent flickers
              isReconnecting ? 'animate-spin' : isDisconnectedOrError && 'animate-pulse',
            )}>
            <div className="transition-transform duration-200">{statusInfo.icon}</div>
          </div>

          <div className="flex flex-col">
            <Typography
              variant="body"
              className={cn(
                'font-semibold transition-colors duration-200 leading-tight',
                // Enhanced text styling with smooth color transitions
                isDisconnectedOrError
                  ? 'text-rose-700 dark:text-rose-400'
                  : status === 'connected'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-200',
              )}>
              {isZh ? `服务器${statusInfo.label}` : `Server ${statusInfo.label}`}
            </Typography>

            {/* Status message with stable height to prevent layout shifts */}
            <div
              className={cn(
                'text-xs mt-0.5 transition-all duration-200 ease-out max-h-20 overflow-hidden status-message-stable',
                isDisconnectedOrError
                  ? 'text-rose-600 dark:text-rose-400 font-medium'
                  : 'text-slate-500 dark:text-slate-400',
              )}>
              {statusMessage}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Simplified reconnect button */}
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className={cn(
              'group relative p-2 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95',
              isReconnecting ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md',
              // Dynamic button styling based on state
              isDisconnectedOrError
                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-900/30'
                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30',
            )}
            aria-label={t('Reconnect to server', '重新连接服务器')}
            title={t('Reconnect to server', '重新连接服务器')}>
            <Icon
              name="refresh"
              size="sm"
              className={cn(
                'transition-transform duration-300',
                isReconnecting ? 'animate-spin' : 'group-hover:rotate-180',
              )}
            />
          </button>

          {/* Simplified settings button */}
          <button
            onClick={handleSettings}
            disabled={settingsAnimating}
            className={cn(
              'group relative p-2 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95',
              'text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:shadow-md dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800',
            )}
            aria-label={t('Server settings', '服务器设置')}
            title={t('Server settings', '服务器设置')}>
            <Icon
              name="settings"
              size="sm"
              className={cn('transition-transform duration-200', showSettings ? 'rotate-90' : 'group-hover:rotate-45')}
            />
          </button>

          {/* Simplified details button */}
          <button
            onClick={handleDetails}
            disabled={detailsAnimating}
            className={cn(
              'group relative p-2 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95',
              'text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:shadow-md dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800',
            )}
            aria-label={t('Show details', '查看连接详情')}
            title={t('Show details', '查看连接详情')}>
            <Icon name="info" size="sm" className="transition-transform duration-200 group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Add prominent alert for disconnected/error states with detailed error message */}
      {isDisconnectedOrError && (
        <div className="mt-2 p-2 bg-rose-100 dark:bg-rose-900/20 rounded-md border border-rose-200 dark:border-rose-800/50">
          <div className="flex items-center gap-2">
            <Icon name="alert-triangle" size="sm" className="text-rose-600 dark:text-rose-400" />
            <div className="flex-1">
              <Typography variant="small" className="text-rose-600 dark:text-rose-400 font-medium">
                {status === 'disconnected'
                  ? t(
                      'Server connection lost. Click the refresh button to reconnect.',
                      '服务器连接已断开，请点击刷新按钮重新连接。',
                    )
                  : t(
                      'Server connection error. Check your configuration and try again.',
                      '服务器连接错误，请检查配置后重试。',
                    )}
              </Typography>
              {/* Show detailed error message if available and not already identical to statusMessage */}
              {(backgroundConnectionError || lastErrorMessage) &&
                translateServerMessage(backgroundConnectionError || lastErrorMessage, language) !== statusMessage && (
                  <Typography variant="small" className="text-rose-500 dark:text-rose-300 mt-1 text-xs">
                    {t('Details: ', '详情：')}
                    {translateServerMessage(backgroundConnectionError || lastErrorMessage, language)}
                  </Typography>
                )}
            </div>
          </div>
        </div>
      )}
      {/* Add connecting status indicator for background communication issues */}
      {(hasBackgroundError || !communicationMethods.sendMessage) && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200/50 dark:border-amber-800/30 p-2 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="animate-spin w-3 h-3 border border-amber-500 border-t-transparent rounded-full"></div>
            <Typography variant="caption" className="text-amber-700 dark:text-amber-300 text-xs">
              {t('Connecting to extension services...', '正在连接扩展后台服务...')}
            </Typography>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
          <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
            <CardContent className="p-4 text-xs text-slate-700 dark:text-slate-300">
              <Typography variant="h4" className="mb-3 text-slate-800 dark:text-slate-100 font-semibold">
                {t('Server Configuration', '服务器配置')}
              </Typography>

              <div className="mb-4">
                <label htmlFor="connection-type" className="block mb-2 text-slate-600 dark:text-slate-400 font-medium">
                  {t('Connection Type', '连接类型')}
                </label>
                <select
                  id="connection-type"
                  value={connectionType}
                  onChange={handleConnectionTypeChange}
                  onFocus={handleConnectionTypeFocus}
                  onBlur={handleConnectionTypeBlur}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-500">
                  <option value="sse">Server-Sent Events (SSE)</option>
                  <option value="websocket">WebSocket</option>
                  <option value="streamable-http">Streamable HTTP</option>
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {connectionType === 'sse'
                    ? t('HTTP-based streaming connection (default for MCP-Proxy)', '基于 HTTP 的流式连接（MCP-Proxy 默认方式）')
                    : connectionType === 'websocket'
                      ? t('Full-duplex WebSocket connection', '全双工 WebSocket 连接')
                      : t('Modern MCP HTTP streaming protocol', '标准 MCP Streamable HTTP 协议')}
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="server-uri" className="block mb-2 text-slate-600 dark:text-slate-400 font-medium">
                  {t('Server URI', '服务器地址 (URI)')}
                </label>
                <input
                  id="server-uri"
                  type="text"
                  value={serverUri}
                  onChange={handleServerUriChange}
                  onFocus={handleServerUriFocus}
                  onBlur={handleServerUriBlur}
                  placeholder={getDefaultUriForType(connectionType)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-500"
                />
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <div>
                    {isZh ? (
                      <>
                        运行 Proxy Server 查看
                        <a
                          href={getReadmeUrl(language)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline ml-1">
                          说明
                        </a>
                      </>
                    ) : (
                      <>
                        To run the Proxy Server, see the
                        <a
                          href={getReadmeUrl(language)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline ml-1">
                          documentation
                        </a>
                        .
                      </>
                    )}
                  </div>
                  <div>
                    {t(
                      'First-time host access must be granted via the MCP-Interceptor toolbar icon.',
                      '首次连接新主机时，需点击浏览器工具栏中的 MCP-Interceptor 图标授予访问权限。',
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setShowSettings(false);
                    setIsEditingUri(false);
                    setIsEditingConnectionType(false);
                    // Reset to stored config when canceling
                    if (serverConfig.uri) {
                      setServerUri(serverConfig.uri);
                    }
                    if (serverConfig.connectionType) {
                      setConnectionType(serverConfig.connectionType);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95">
                  {t('Cancel', '取消')}
                </Button>
                <Button
                  onClick={handleSaveServerConfig}
                  variant="default"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white dark:text-white save-button-stable"
                  disabled={hasBackgroundError || isReconnecting}>
                  {isReconnecting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('Connecting...', '连接中...')}
                    </div>
                  ) : (
                    t('Save & Reconnect', '保存并重连')
                  )}
                </Button>
              </div>

              {hasBackgroundError && (
                <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                  <div className="flex items-center gap-2">
                    <Icon name="alert-triangle" size="sm" className="text-rose-600 dark:text-rose-400" />
                    <p className="font-medium">
                      {t(
                        'Extension background services unavailable. Try reloading the page.',
                        '扩展后台服务不可用，请尝试刷新页面。',
                      )}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Details panel */}
      {showDetails && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
          <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
            <CardContent className="p-4 text-xs text-slate-700 dark:text-slate-300">
              <Typography variant="h4" className="mb-3 text-slate-800 dark:text-slate-100 font-semibold">
                {t('Connection Details', '连接详情')}
              </Typography>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('Status:', '状态：')}</span>
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      status === 'connected'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : isDisconnectedOrError
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400',
                    )}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex justify-between items-start py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('Server URI:', '服务器地址：')}</span>
                  <span className="text-right text-slate-600 dark:text-slate-300 max-w-[200px] break-all">
                    {serverUri || t('Not configured', '未配置')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {t('Connection Type:', '连接类型：')}
                  </span>
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      connectionType === 'websocket'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : connectionType === 'streamable-http'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
                    )}>
                    {connectionType === 'websocket'
                      ? 'WebSocket'
                      : connectionType === 'streamable-http'
                        ? 'Streamable HTTP'
                        : 'SSE'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('Last updated:', '最后更新：')}</span>
                  <span className="text-slate-600 dark:text-slate-300">{new Date().toLocaleTimeString()}</span>
                </div>

                {lastReconnectTime && (
                  <div className="flex justify-between items-center py-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {t('Last reconnect:', '上次重连：')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">{lastReconnectTime}</span>
                  </div>
                )}
              </div>

              {isDisconnectedOrError && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <Icon name="info" size="sm" className="text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-medium mb-2">{t('Troubleshooting tips:', '排查建议：')}</p>
                      <ul className="list-disc ml-4 space-y-1 text-xs">
                        <li>
                          {t(
                            'Verify MCP-Proxy is running at the configured URI (default: SSE at http://localhost:3006/sse)',
                            '确认 MCP-Proxy 已在所配置的地址运行（默认：SSE http://localhost:3006/sse）',
                          )}
                        </li>
                        <li>
                          {t(
                            'Click the MCP-Interceptor toolbar icon and choose "Grant access and connect" to authorize the host',
                            '点击浏览器工具栏中的 MCP-Interceptor 图标，点击“授权访问并连接”授予主机权限',
                          )}
                        </li>
                        <li>
                          {t(
                            'Check network connectivity and restart the proxy service if needed',
                            '检查网络连接，必要时重启代理服务',
                          )}
                        </li>
                        <li>{t('Use the Reconnect button to try again', '点击重连按钮再次尝试')}</li>
                      </ul>
                      {/* Show detailed error in troubleshooting section - prefer background error */}
                      {(backgroundConnectionError || lastErrorMessage || connectionError) && (
                        <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-800/50 rounded border border-amber-200 dark:border-amber-700">
                          <p className="font-medium text-xs mb-1">{t('Last Error:', '最近错误：')}</p>
                          <p className="text-xs break-words">
                            {translateServerMessage(
                              backgroundConnectionError || lastErrorMessage || connectionError || '',
                              language,
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {hasBackgroundError && (
                <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                  <div className="flex items-start gap-2">
                    <Icon name="alert-triangle" size="sm" className="text-rose-600 dark:text-rose-400 mt-0.5" />
                    <div>
                      <p className="font-medium mb-2">
                        {t('Extension Communication Issue:', '扩展通信异常：')}
                      </p>
                      <ul className="list-disc ml-4 space-y-1 text-xs">
                        <li>{t('Try reloading the current page', '请尝试刷新当前页面')}</li>
                        <li>{t('If the issue persists, restart your browser', '若问题持续，请重启浏览器')}</li>
                        <li>
                          {t(
                            'You may need to reinstall the extension if problems continue',
                            '若仍无法恢复，可尝试重新安装或重载扩展',
                          )}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ServerStatus;
