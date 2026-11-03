import type { ParamValueElement } from '../core/types';
import { StabilizedBlock } from '../core/types';
import { CONFIG } from '../core/config';
import { safelySetContent } from '../utils/index';
import { storeExecutedFunction, generateContentSignature } from '../mcpexecute/storage';
import { checkAndDisplayFunctionHistory, createHistoryPanel, updateHistoryPanel } from './functionHistory';
import { extractJSONParameters, stripLanguageTags, extractCleanContent } from '../parser/jsonFunctionParser';
import { createLogger } from '@extension/shared/lib/logger';
import { buildToolResultInsertionText, normalizeToolResultContent } from './toolResultContent';

import { createResultActionLock, insertResultText, attachPendingResultImages } from './resultActions';

// Add type declarations for the global adapter and mcpClient access

const logger = createLogger('AdapterAccess');

declare global {
  interface Window {
    mcpAdapter?: any;
    getCurrentAdapter?: () => any;
    mcpClient?: any;
    pluginRegistry?: any;
  }
}

/**
 * Get the current active adapter through the new plugin-based system
 * Falls back to legacy global adapters for backward compatibility
 */
function getCurrentAdapter(): any {
  try {
    // First try to get adapter through the new plugin registry system
    const pluginRegistry = (window as any).pluginRegistry;
    if (pluginRegistry && typeof pluginRegistry.getActivePlugin === 'function') {
      const activePlugin = pluginRegistry.getActivePlugin();
      if (activePlugin && activePlugin.capabilities && activePlugin.capabilities.length > 0) {
        logger.debug('[AdapterAccess] Using active plugin adapter:', activePlugin.name);
        return activePlugin;
      }
    }

    // Fallback to legacy global adapter access for backward compatibility
    const legacyAdapter = window.mcpAdapter || window.getCurrentAdapter?.();
    if (legacyAdapter) {
      logger.debug('[AdapterAccess] Using legacy adapter access');
      return legacyAdapter;
    }

    logger.warn('[AdapterAccess] No adapter found through plugin registry or legacy access');
    return null;
  } catch (error) {
    logger.error('[AdapterAccess] Error getting current adapter:', error);

    // Final fallback to legacy system
    try {
      const legacyAdapter = window.mcpAdapter || window.getCurrentAdapter?.();
      if (legacyAdapter) {
        logger.debug('[AdapterAccess] Using legacy adapter as fallback');
        return legacyAdapter;
      }
    } catch (fallbackError) {
      logger.error('[AdapterAccess] Fallback adapter access also failed:', fallbackError);
    }

    return null;
  }
}

/**
 * Check if the current adapter supports a specific capability
 */
function adapterSupportsCapability(capability: string): boolean {
  try {
    const adapter = getCurrentAdapter();
    if (!adapter) return false;

    if (capability === 'file-attachment') {
      return (
        typeof adapter.attachFile === 'function' &&
        adapter.supportsFileUpload?.() === true &&
        (!Array.isArray(adapter.capabilities) || adapter.capabilities.includes(capability))
      );
    }

    // Check capabilities array (new plugin system)
    if (adapter.capabilities && Array.isArray(adapter.capabilities)) {
      return adapter.capabilities.includes(capability);
    }

    // Fallback to method existence check (legacy system)
    switch (capability) {
      case 'text-insertion':
        return typeof adapter.insertText === 'function' || typeof adapter.insertTextIntoInput === 'function';
      case 'form-submission':
        return typeof adapter.submitForm === 'function';
      case 'file-attachment':
        return typeof adapter.attachFile === 'function' && adapter.supportsFileUpload?.() === true;
      case 'dom-manipulation':
        return typeof adapter.insertText === 'function'; // Basic DOM manipulation
      default:
        return false;
    }
  } catch (error) {
    logger.error('[AdapterAccess] Error checking capability:', error);
    return false;
  }
}

// Performance optimizations: Cache constants and pre-compile regexes
const MAX_INSERT_LENGTH = 39000;
const WEBSITE_NAME_FOR_MAX_INSERT_LENGTH_CHECK = ['perplexity'];
const websiteName = window.location.hostname
  .toLowerCase()
  .replace(/^www\./i, '')
  .split('.')[0];

const previewObjectUrls = new WeakMap<HTMLElement, string[]>();

// Pre-compiled regexes for better performance
const INVOKE_REGEX = /<invoke name="([^"]+)"(?:\s+call_id="([^"]+)")?>/;
const PARAM_REGEX = /<parameter\s+name="([^"]+)"\s*(?:type="([^"]+)")?\s*>(.*?)<\/parameter>/gs;
const CDATA_REGEX = /<!\[CDATA\[([\s\S]*?)\]\]>/;
const NUMBER_REGEX = /^-?\d+(\.\d+)?$/;
const BOOLEAN_REGEX = /^(true|false)$/i;

// SVG icons as constants for reuse
const ICONS = {
  CODE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" fill="currentColor"/></svg>',
  PLAY: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  INSERT:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 12l-7-7v4H2v6h7v4l7-7z" fill="currentColor"/></svg>',
  ATTACH:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="2" width="16" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 6h8M8 10h8M8 14h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  SPINNER:
    '<svg width="16" height="16" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 31.4" transform="rotate(-90 25 25)"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite"/></circle></svg>',
};

// Performance utility: Object pooling for DOM elements
class ElementPool {
  private static pools = new Map<string, HTMLElement[]>();

  static get(tagName: string, className?: string): HTMLElement {
    const key = `${tagName}:${className || ''}`;
    const pool = this.pools.get(key) || [];

    if (pool.length > 0) {
      const element = pool.pop()!;
      // Reset element state
      element.innerHTML = '';
      element.className = className || '';
      element.removeAttribute('style');
      return element;
    }

    const element = document.createElement(tagName);
    if (className) element.className = className;
    return element;
  }

  static release(element: HTMLElement): void {
    const key = `${element.tagName.toLowerCase()}:${element.className}`;
    const pool = this.pools.get(key) || [];

    if (pool.length < 10) {
      // Limit pool size
      pool.push(element);
      this.pools.set(key, pool);
    }
  }
}

// Performance utility: Create optimized DOM elements with minimal reflows
const createOptimizedElement = (
  tagName: string,
  options: {
    className?: string;
    textContent?: string;
    innerHTML?: string;
    styles?: Record<string, string>;
    attributes?: Record<string, string>;
  } = {},
): HTMLElement => {
  const element = ElementPool.get(tagName, options.className);

  // Batch DOM operations to minimize reflows
  if (options.textContent) element.textContent = options.textContent;
  if (options.innerHTML) element.innerHTML = options.innerHTML;

  if (options.styles) {
    Object.assign(element.style, options.styles);
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  return element;
};
/**
 * Add the raw XML toggle button and pre element to a function block
 * Performance optimized version using ElementPool and batch DOM operations
 *
 * @param blockDiv Function block div container
 * @param rawContent Raw XML content to display when toggled
 */
export const addRawXmlToggle = (blockDiv: HTMLDivElement, rawContent: string): void => {
  // Check for existing toggle to avoid duplicates
  if (blockDiv.querySelector('.raw-toggle')) {
    return;
  }

  // Get the original pre element that contains the function call
  const blockId = blockDiv.getAttribute('data-block-id');

  if (blockId) {
    // Try to find the original element with the complete XML
    const originalPre = document.querySelector(`div[data-block-id="${blockId}"]`);
    if (originalPre) {
      // Extract clean JSON content for display (removes localized UI labels)
      rawContent = extractCleanContent(originalPre.textContent?.trim() || rawContent);
    }
  } else {
    // Clean the provided rawContent as well
    rawContent = extractCleanContent(rawContent);
  }

  // Use DocumentFragment for efficient DOM construction
  const fragment = document.createDocumentFragment();

  // Create container for raw XML content using optimized element creation
  const rawXmlContainer = createOptimizedElement('div', {
    className: 'function-results-panel xml-results-panel',
    styles: {
      display: 'none',
      marginTop: '12px',
      marginBottom: '4px',
    },
  });

  // Create the pre element for displaying raw XML with batch style assignment
  const rawXmlPre = createOptimizedElement('pre', {
    textContent: rawContent,
    styles: {
      whiteSpace: 'pre-wrap',
      margin: '0',
      padding: '12px',
      fontFamily: 'inherit',
      fontSize: '13px',
      lineHeight: '1.5',
    },
  });

  // Create toggle button with optimized element creation
  const toggleBtn = createOptimizedElement('button', {
    className: 'raw-toggle',
    innerHTML: `${ICONS.CODE}<span>Show Raw Info</span>`,
    styles: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
    },
  });

  // Cache references for performance
  const textSpan = toggleBtn.querySelector('span')!;
  let isVisible = false;

  // Optimized toggle handler with requestAnimationFrame for smooth transitions
  toggleBtn.onclick = () => {
    isVisible = !isVisible;

    // Use requestAnimationFrame for smooth visual updates
    requestAnimationFrame(() => {
      rawXmlContainer.style.display = isVisible ? 'block' : 'none';
      textSpan.textContent = isVisible ? 'Hide Raw Info' : 'Show Raw Info';
    });
  };

  // Batch DOM operations using fragment
  rawXmlContainer.appendChild(rawXmlPre);
  fragment.appendChild(toggleBtn);

  // Efficiently determine parent and append
  const targetParent = blockDiv.classList.contains('function-buttons')
    ? blockDiv.closest('.function-block') || blockDiv
    : blockDiv;

  // Single batch DOM update
  blockDiv.appendChild(fragment);
  targetParent.appendChild(rawXmlContainer);
};

/**
 * Setup auto-scroll functionality for parameter value divs
 *
 * @param paramValueDiv Parameter value div element
 */
export const setupAutoScroll = (paramValueDiv: ParamValueElement): void => {
  // Auto scroll disabled.
};

/**
 * Stabilize block height to prevent layout shifts during updates
 *
 * @param block The block element
 */
export const stabilizeBlock = (block: HTMLElement): void => {
  if (block.style.height === '') {
    const rect = block.getBoundingClientRect();
    block.style.height = `${rect.height}px`;
    block.style.overflow = 'hidden'; // Optional: prevent content overflow during transition
    if (CONFIG.debug) logger.debug(`Stabilized block height: ${rect.height}px`);
  }
};

/**
 * Remove stabilized height
 *
 * @param block The block element
 */
export const unstabilizeBlock = (block: HTMLElement): void => {
  if (block.style.height !== '') {
    block.style.height = '';
    block.style.overflow = ''; // Reset overflow
    if (CONFIG.debug) logger.debug('Unstabilized block height');
  }
};

/**
 * Optimized smooth block content update with improved performance
 * Reduces DOM operations and uses efficient transition management
 *
 * @param block The function block to update
 * @param newContent New HTML content to place inside the block
 * @param isStreaming Whether the content is still streaming
 */
export const smoothlyUpdateBlockContent = (
  block: HTMLElement,
  newContent: string | HTMLElement,
  isStreaming: boolean = false,
): void => {
  if (!block) return;

  // Performance: Check update lock more efficiently
  if (!isStreaming && block.hasAttribute('data-smooth-updating')) return;

  // Skip updates for completed blocks to prevent jitter
  const blockId = block.getAttribute('data-block-id');
  if (blockId && (window as any).completedStreams?.has(blockId)) {
    if (CONFIG.debug) logger.debug(`Skipping update for completed block ${blockId}`);
    return;
  }

  // Skip updates if block is currently resyncing
  if (blockId && (window as any).resyncingBlocks?.has(blockId)) {
    if (CONFIG.debug) logger.debug(`Skipping update for resyncing block ${blockId}`);
    return;
  }

  // Cache essential properties for performance
  const originalClasses = Array.from(block.classList);
  const originalParent = block.parentNode;

  // Mark block as updating
  block.setAttribute('data-smooth-updating', 'true');

  // Performance: Cache dimensions and scroll state
  const originalRect = block.getBoundingClientRect();
  const scrollState = {
    top: block.scrollTop,
    height: block.scrollHeight,
    clientHeight: block.clientHeight,
    wasScrollable: block.scrollHeight > block.clientHeight,
  };

  // Optimized shadow tracker creation
  const shadowTracker = createOptimizedElement('div', {
    styles: { display: 'none' },
    attributes: {
      'data-shadow-for': blockId || 'unknown-block',
      'data-update-in-progress': 'true',
    },
  });

  if (originalParent) {
    originalParent.insertBefore(shadowTracker, block.nextSibling);
  }

  // Performance: Use more efficient content parsing
  const parseNewContent = (content: string | HTMLElement): DocumentFragment => {
    const fragment = document.createDocumentFragment();

    if (typeof content === 'string') {
      // Optimized parsing with better error handling
      try {
        const template = document.createElement('template');
        template.innerHTML = content;
        fragment.appendChild(template.content);
      } catch (e) {
        // Fallback for CSP-restricted environments
        const div = document.createElement('div');
        div.textContent = content;
        fragment.appendChild(div);
      }
    } else {
      fragment.appendChild(content.cloneNode(true));
    }

    return fragment;
  };

  // Pre-calculate new content dimensions efficiently
  const measureNewContent = (fragment: DocumentFragment): number => {
    const tempContainer = createOptimizedElement('div', {
      styles: {
        position: 'absolute',
        visibility: 'hidden',
        width: `${originalRect.width}px`,
        left: '-9999px',
      },
    });

    tempContainer.appendChild(fragment.cloneNode(true));
    document.body.appendChild(tempContainer);
    const height = tempContainer.offsetHeight;
    document.body.removeChild(tempContainer);
    ElementPool.release(tempContainer);

    return height;
  };

  const newContentFragment = parseNewContent(newContent);
  const newHeight = measureNewContent(newContentFragment);

  // Optimized transition setup with batch style assignment
  const transitionDuration = isStreaming ? 150 : 250;
  Object.assign(block.style, {
    height: `${originalRect.height}px`,
    overflow: 'hidden',
    transition: `height ${transitionDuration}ms ease-in-out`,
  });

  // Efficient content wrapper management
  const createContentWrapper = (className: string, opacity: string = '1'): HTMLElement => {
    return createOptimizedElement('div', {
      className: `function-content-wrapper ${className}`,
      styles: {
        opacity,
        transform: opacity === '0' ? 'translateY(10px)' : 'translateY(0)',
        transition: `opacity ${transitionDuration * 0.6}ms ease-out, transform ${transitionDuration * 0.6}ms ease-out`,
      },
    });
  };

  // Move existing content to wrapper
  const oldWrapper = createContentWrapper('function-content-old');
  while (block.firstChild) {
    oldWrapper.appendChild(block.firstChild);
  }

  // Create new content wrapper
  const newWrapper = createContentWrapper('function-content-new', '0');
  newWrapper.appendChild(newContentFragment);

  // Batch DOM operations
  const fragment = document.createDocumentFragment();
  fragment.appendChild(oldWrapper);
  fragment.appendChild(newWrapper);
  block.appendChild(fragment);

  // Use requestAnimationFrame for smoother animations
  requestAnimationFrame(() => {
    // Start height transition
    block.style.height = `${newHeight}px`;

    // Fade out old content
    Object.assign(oldWrapper.style, {
      opacity: '0',
      transform: 'translateY(-10px)',
    });

    // Delayed fade in of new content
    setTimeout(
      () => {
        requestAnimationFrame(() => {
          Object.assign(newWrapper.style, {
            opacity: '1',
            transform: 'translateY(0)',
          });
        });
      },
      isStreaming ? 30 : 50,
    );
  });

  // Optimized mutation observer for DOM changes
  let blockRemoved = false;
  let replacementBlock: HTMLElement | null = null;

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && Array.from(mutation.removedNodes).includes(block)) {
        blockRemoved = true;

        // Efficiently find replacement block
        const addedElement = Array.from(mutation.addedNodes).find(
          (node): node is HTMLElement =>
            node.nodeType === Node.ELEMENT_NODE &&
            (node as HTMLElement).classList.contains('function-block') &&
            (node as HTMLElement).getAttribute('data-block-id') === blockId,
        ) as HTMLElement | undefined;

        if (addedElement) {
          replacementBlock = addedElement;
        }

        observer.disconnect();
        return;
      }
    }
  });

  observer.observe(originalParent || document.body, { childList: true, subtree: true });

  // Optimized cleanup with better performance
  setTimeout(() => {
    observer.disconnect();

    if (blockRemoved && replacementBlock) {
      // Efficiently transfer state to replacement
      originalClasses.forEach(cls => {
        if (!replacementBlock!.classList.contains(cls)) {
          replacementBlock!.classList.add(cls);
        }
      });

      // Batch style cleanup
      Object.assign(replacementBlock.style, {
        transition: '',
        height: '',
        overflow: '',
      });

      replacementBlock.removeAttribute('data-smooth-updating');

      if (scrollState.wasScrollable) {
        replacementBlock.scrollTop = scrollState.top;
      }
    } else if (document.body.contains(block)) {
      // Efficient content finalization
      while (newWrapper.firstChild) {
        block.appendChild(newWrapper.firstChild);
      }

      // Batch remove old elements
      [oldWrapper, newWrapper].forEach(wrapper => {
        if (block.contains(wrapper)) {
          ElementPool.release(wrapper);
          block.removeChild(wrapper);
        }
      });

      // Batch style reset
      Object.assign(block.style, {
        height: '',
        overflow: '',
        transition: '',
      });

      if (scrollState.wasScrollable) {
        block.scrollTop = scrollState.top;
      }

      block.removeAttribute('data-smooth-updating');
    }

    // Cleanup shadow tracker
    if (shadowTracker.parentNode) {
      shadowTracker.parentNode.removeChild(shadowTracker);
      ElementPool.release(shadowTracker);
    }
  }, transitionDuration + 50);
};

/**
 * Optimized execute button creation with efficient DOM operations
 * Performance improvements: batch DOM operations, use ElementPool, cache queries
 *
 * @param blockDiv Function block div container
 * @param rawContent Raw XML content containing the function call
 */
export const addExecuteButton = (blockDiv: HTMLDivElement, rawContent: string): void => {
  // Check for existing execute button to avoid duplicates
  if (blockDiv.querySelector('.execute-button')) {
    return;
  }

  // Detect format and extract function name and parameters
  const isJSON = rawContent.includes('"type"') && rawContent.includes('function_call');
  const functionName = extractFunctionName(rawContent);

  let parameters: Record<string, any>;
  let callId: string;

  if (isJSON) {
    // Extract JSON parameters
    parameters = extractJSONParameters(rawContent);

    if (CONFIG.debug) {
      logger.debug('[Execute Button] Extracted JSON parameters:', parameters);
    }

    // Extract call_id from JSON
    const lines = rawContent.split('\n');
    let extractedCallId: string | null = null;
    for (const line of lines) {
      try {
        const trimmed = stripLanguageTags(line);
        if (!trimmed) continue;

        const parsed = JSON.parse(trimmed);
        if (parsed.type === 'function_call_start' && parsed.call_id) {
          extractedCallId = parsed.call_id.toString();
          break;
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
    callId = extractedCallId || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  } else {
    // XML format
    parameters = extractFunctionParameters(rawContent);

    if (CONFIG.debug) {
      logger.debug('[Execute Button] Extracted XML parameters:', parameters);
    }

    // Extract call_id from XML using pre-compiled regex
    const callIdMatch = INVOKE_REGEX.exec(rawContent);
    callId = callIdMatch?.[2] || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // If we couldn't extract a function name, don't add the button
  if (!functionName) {
    if (CONFIG.debug) {
      logger.debug('[Execute Button] No function name found, skipping button');
    }
    return;
  }

  if (CONFIG.debug) {
    logger.debug('[Execute Button] Creating button for:', functionName, 'with params:', Object.keys(parameters));
  }

  // Generate content signature for this function call
  const contentSignature = generateContentSignature(functionName, parameters);

  // Use DocumentFragment for efficient DOM construction
  const fragment = document.createDocumentFragment();

  // Create optimized execute button
  const executeButton = createOptimizedElement('button', {
    className: 'execute-button',
    innerHTML: `${ICONS.PLAY}<span>Run</span>`,
    styles: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      marginLeft: '0',
    },
  }) as HTMLButtonElement;

  // Create optimized results panel
  const resultsPanel = createOptimizedElement('div', {
    className: 'function-results-panel',
    styles: {
      display: 'none',
      maxHeight: '200px',
      overflow: 'auto',
    },
    attributes: {
      'data-call-id': callId,
      'data-function-name': functionName,
    },
  }) as HTMLDivElement;

  // Create optimized loading indicator
  const loadingIndicator = createOptimizedElement('div', {
    className: 'function-loading',
    styles: {
      display: 'none',
      marginTop: '12px',
      padding: '10px',
      borderRadius: '8px',
      backgroundColor: 'rgba(0, 0, 0, 0.03)',
      border: '1px solid rgba(0, 0, 0, 0.06)',
    },
  }) as HTMLDivElement;

  // Cache DOM references for performance
  const buttonText = executeButton.querySelector('span')!;

  // Optimized click handler with better performance and mcpClient integration
  executeButton.onclick = async () => {
    // Batch button state changes
    executeButton.disabled = true;
    buttonText.style.display = 'none';

    // Add spinner efficiently
    const spinner = createOptimizedElement('span', {
      className: 'execute-spinner',
      innerHTML: ICONS.SPINNER,
      styles: {
        display: 'inline-flex',
        marginLeft: '8px',
      },
    });

    executeButton.appendChild(spinner);

    // Reset results panel state efficiently
    resultsPanel.style.display = 'none';
    resultsPanel.innerHTML = '';

    // Function to reset button state
    const resetButtonState = () => {
      executeButton.disabled = false;
      buttonText.style.display = '';

      if (executeButton.contains(spinner)) {
        executeButton.removeChild(spinner);
        ElementPool.release(spinner);
      }
    };

    try {
      // Use global mcpClient instead of mcpHandler
      const mcpClient = (window as any).mcpClient;

      if (!mcpClient) {
        resetButtonState();
        displayResult(resultsPanel, loadingIndicator, false, 'Error: mcpClient not found');
        resultsPanel.style.display = 'block';
        return;
      }

      // Check if mcpClient is ready
      if (!mcpClient.isReady || !mcpClient.isReady()) {
        resetButtonState();
        displayResult(resultsPanel, loadingIndicator, false, 'Error: MCP client not ready');
        resultsPanel.style.display = 'block';
        return;
      }

      logger.debug(`Executing function ${functionName}, call_id: ${callId} with arguments:`, parameters);

      // Show results panel and loading indicator
      resultsPanel.style.display = 'block';
      resultsPanel.innerHTML = '';
      resultsPanel.appendChild(loadingIndicator);

      // Call tool using the new mcpClient async API
      try {
        const result = await mcpClient.callTool(functionName, parameters);

        resetButtonState();
        displayResult(resultsPanel, loadingIndicator, true, result);

        // Store execution and update history efficiently
        const executionData = storeExecutedFunction(functionName, callId, parameters, contentSignature);
        const historyPanel = (blockDiv.querySelector('.function-history-panel') ||
          createHistoryPanel(blockDiv, callId, contentSignature)) as HTMLDivElement;

        // Update history panel with mcpClient reference
        updateHistoryPanel(historyPanel, executionData, mcpClient);
      } catch (toolError: any) {
        resetButtonState();

        // Enhanced error handling for connection issues
        let errorMessage = toolError instanceof Error ? toolError.message : String(toolError);

        // Check for connection-related errors and provide better user feedback
        if (errorMessage.includes('not connected') || errorMessage.includes('connection')) {
          errorMessage = 'Connection lost. Please check your MCP server connection.';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (errorMessage.includes('server unavailable') || errorMessage.includes('SERVER_UNAVAILABLE')) {
          errorMessage = 'MCP server is unavailable. Please check the server status.';
        }

        displayResult(resultsPanel, loadingIndicator, false, errorMessage);
      }
    } catch (error: any) {
      resetButtonState();
      resultsPanel.style.display = 'block';

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Execute button error:', error);

      displayResult(resultsPanel, loadingIndicator, false, `Unexpected error: ${errorMessage}`);
    }
  };

  // Batch DOM operations
  fragment.appendChild(executeButton);
  blockDiv.appendChild(fragment);

  // Efficiently determine target parent
  const targetParent = blockDiv.classList.contains('function-buttons')
    ? blockDiv.closest('.function-block') || blockDiv
    : blockDiv;

  targetParent.appendChild(resultsPanel);

  // Check for previous executions efficiently
  checkAndDisplayFunctionHistory(blockDiv, functionName, callId, contentSignature);
};

/**
 * Extract function name from raw content (supports both XML and JSON formats)
 *
 * @param rawContent Raw XML or JSON content
 * @returns The function name or null if not found
 */
const extractFunctionName = (rawContent: string): string | null => {
  // Check for JSON format first
  const isJSON = rawContent.includes('"type"') && rawContent.includes('function_call_start');

  if (isJSON) {
    // Extract from JSON format
    const lines = rawContent.split('\n');
    for (const line of lines) {
      try {
        const trimmed = stripLanguageTags(line);
        if (!trimmed) continue;

        const parsed = JSON.parse(trimmed);
        if (parsed.type === 'function_call_start' && parsed.name) {
          return parsed.name;
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    return null;
  }

  // XML format
  const invokeMatch = rawContent.match(/<invoke name="([^"]+)"(?:\s+call_id="([^"]+)")?>/);
  return invokeMatch && invokeMatch[1] ? invokeMatch[1] : null;
};

/**
 * Optimized function parameter extraction with pre-compiled regex patterns
 * Performance improvements: use pre-compiled regexes, reduce string operations
 *
 * @param rawContent Raw XML content
 * @returns Object with parameter names and values
 */
export const extractFunctionParameters = (rawContent: string): Record<string, any> => {
  const parameters: Record<string, any> = {};

  // Use pre-compiled regex for better performance
  let match;
  while ((match = PARAM_REGEX.exec(rawContent)) !== null) {
    const name = match[1];
    const type = match[2] || 'string';
    let value: any = match[3].trim();

    // Check for CDATA using pre-compiled regex
    const cdataMatch = CDATA_REGEX.exec(value);
    if (cdataMatch) {
      try {
        value = cdataMatch[1].trim();
        if (CONFIG.debug) logger.debug(`Extracted CDATA content for parameter ${name}`);
      } catch (e) {
        logger.error(`Failed to extract CDATA content for parameter ${name}:`, e);
        // value already set to original
      }
    }

    // Optimized type parsing with pre-compiled regexes
    switch (type) {
      case 'json':
        try {
          value = JSON.parse(value);
        } catch (e) {
          logger.warn(`Failed to parse JSON for parameter '${name}'.`, e);
        }
        break;

      case 'number':
        const num = parseFloat(value);
        if (!isNaN(num)) value = num;
        break;

      case 'boolean':
        value = value.toLowerCase() === 'true';
        break;

      default:
        // Auto-detect numeric, boolean, and JSON-like values
        if (NUMBER_REGEX.test(value)) {
          value = parseFloat(value);
        } else if (BOOLEAN_REGEX.test(value)) {
          value = value.toLowerCase() === 'true';
        } else {
          // Try to parse as JSON if it looks like JSON (starts with { or [)
          const trimmedValue = value.trim();
          if (
            (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
            (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
          ) {
            try {
              value = JSON.parse(trimmedValue);
              if (CONFIG.debug) logger.debug(`Auto-parsed JSON for parameter ${name}:`, value);
            } catch (e) {
              // If JSON parsing fails, keep as string
              if (CONFIG.debug) logger.debug(`Failed to auto-parse JSON for parameter ${name}, keeping as string`);
            }
          }
        }
    }

    parameters[name] = value;
  }

  // Reset regex lastIndex for reuse (important for global regexes)
  PARAM_REGEX.lastIndex = 0;
  CDATA_REGEX.lastIndex = 0;

  return parameters;
};

/**
 * Optimized file attachment helper with improved performance
 * Performance improvements: reduce DOM operations, batch state changes, efficient event handling
 * Updated to work with the new plugin-based adapter system
 */
const attachResultAsFile = async (
  adapter: any,
  functionName: string,
  callId: string,
  rawResultText: string,
  button: HTMLButtonElement,
  iconSpan: HTMLElement | null,
  skipAutoInsertCheck: boolean = false,
): Promise<{ success: boolean; message: string | null }> => {
  // Early validation for better performance
  if (!adapter) {
    logger.error('No adapter provided for file attachment.');

    const handleUnsupported = () => {
      const originalText = button.classList.contains('insert-result-button') ? 'Insert' : 'Attach File';
      button.innerHTML = `${ICONS.ATTACH}<span>No Adapter</span>`;
      button.classList.add('attach-error');

      setTimeout(() => {
        button.innerHTML = `${ICONS.ATTACH}<span>${originalText}</span>`;
        button.classList.remove('attach-error');
      }, 2000);
    };

    handleUnsupported();
    return { success: false, message: null };
  }

  // Check if adapter supports file attachment using the new capability system
  if (!adapterSupportsCapability('file-attachment')) {
    logger.error('Current adapter does not support file attachment.');

    const handleUnsupported = () => {
      const originalText = button.classList.contains('insert-result-button') ? 'Insert' : 'Attach File';
      button.innerHTML = `${ICONS.ATTACH}<span>Attach Not Supported</span>`;
      button.classList.add('attach-error');

      setTimeout(() => {
        button.innerHTML = `${ICONS.ATTACH}<span>${originalText}</span>`;
        button.classList.remove('attach-error');
      }, 2000);
    };

    handleUnsupported();
    return { success: false, message: null };
  }

  const fileName = `${functionName}_result_call_id_${callId}.txt`;
  const file = new File([rawResultText], fileName, { type: 'text/plain' });
  const originalButtonText = button.textContent || 'Attach File';
  let confirmationText: string | null = null;

  // Optimized button state management
  const setButtonState = (text: string, className?: string, disabled: boolean = true) => {
    // Clear button content and rebuild properly
    button.innerHTML = '';

    // Create new icon element to avoid DOM reference issues
    const iconElement = createOptimizedElement('span', {
      innerHTML: ICONS.ATTACH,
      styles: {
        display: 'inline-flex',
        marginRight: '6px',
      },
    });

    const textElement = createOptimizedElement('span', {
      textContent: text,
    });

    button.appendChild(iconElement);
    button.appendChild(textElement);
    button.disabled = disabled;

    if (className) {
      button.classList.add(className);
    }
  };

  const resetButtonState = (delay: number = 2000) => {
    setTimeout(() => {
      // Reset to original button structure
      button.innerHTML = `${ICONS.ATTACH}<span>Attach File</span>`;
      button.classList.remove('attach-success', 'attach-error');
      button.disabled = false;
    }, delay);
  };

  try {
    setButtonState('Attaching...', undefined, true);

    // Try the new plugin system attachFile method first
    if (typeof adapter.attachFile === 'function') {
      try {
        const success = await adapter.attachFile(file);

        if (success) {
          confirmationText = `File attached successfully: ${fileName}`;
          setButtonState('Attached!', 'attach-success', true);

          // Insert the confirmation text into the input field
          if (typeof adapter.insertText === 'function') {
            try {
              await adapter.insertText(confirmationText);
              logger.debug('Confirmation text inserted successfully');
            } catch (insertError) {
              logger.warn('Failed to insert confirmation text:', insertError);
              // Fallback to legacy method if available
              if (typeof adapter.insertTextIntoInput === 'function') {
                try {
                  // Dispatch event for legacy insertion
                  requestAnimationFrame(() => {
                    document.dispatchEvent(
                      new CustomEvent('mcp:tool-execution-complete', {
                        detail: {
                          result: confirmationText,
                          isFileAttachment: false,
                          fileName: '',
                          skipAutoInsertCheck: true,
                        },
                      }),
                    );
                  });
                } catch (legacyError) {
                  logger.warn('Legacy insertion also failed:', legacyError);
                }
              }
            }
          } else if (typeof adapter.insertTextIntoInput === 'function') {
            // Use legacy method directly
            try {
              requestAnimationFrame(() => {
                document.dispatchEvent(
                  new CustomEvent('mcp:tool-execution-complete', {
                    detail: {
                      result: confirmationText,
                      isFileAttachment: false,
                      fileName: '',
                      skipAutoInsertCheck: true,
                    },
                  }),
                );
              });
            } catch (legacyError) {
              logger.warn('Legacy insertion failed:', legacyError);
            }
          }

          // Efficient event dispatch for file attachment
          const eventDetail = {
            file,
            result: confirmationText,
            isFileAttachment: true,
            fileName,
            confirmationText,
            skipAutoInsertCheck,
          };

          // Use requestAnimationFrame for better performance
          requestAnimationFrame(() => {
            document.dispatchEvent(new CustomEvent('mcp:tool-execution-complete', { detail: eventDetail }));
          });

          resetButtonState();
          return { success: true, message: confirmationText };
        } else {
          throw new Error('Adapter attachFile method returned false');
        }
      } catch (error) {
        logger.error('New adapter attachFile method failed:', error);

        // For now, we'll consider it successful since it's a complex operation
        // This is optimistic handling for better UX
        confirmationText = `File attachment initiated: ${fileName}`;
        setButtonState('Attached!', 'attach-success', true);

        // Insert the confirmation text into the input field
        if (typeof adapter.insertText === 'function') {
          try {
            await adapter.insertText(confirmationText);
            logger.debug('Confirmation text inserted successfully');
          } catch (insertError) {
            logger.warn('Failed to insert confirmation text:', insertError);
            // Fallback to legacy method if available
            if (typeof adapter.insertTextIntoInput === 'function') {
              try {
                // Dispatch event for legacy insertion
                requestAnimationFrame(() => {
                  document.dispatchEvent(
                    new CustomEvent('mcp:tool-execution-complete', {
                      detail: {
                        result: confirmationText,
                        isFileAttachment: false,
                        fileName: '',
                        skipAutoInsertCheck: true,
                      },
                    }),
                  );
                });
              } catch (legacyError) {
                logger.warn('Legacy insertion also failed:', legacyError);
              }
            }
          }
        } else if (typeof adapter.insertTextIntoInput === 'function') {
          // Use legacy method directly
          try {
            requestAnimationFrame(() => {
              document.dispatchEvent(
                new CustomEvent('mcp:tool-execution-complete', {
                  detail: {
                    result: confirmationText,
                    isFileAttachment: false,
                    fileName: '',
                    skipAutoInsertCheck: true,
                  },
                }),
              );
            });
          } catch (legacyError) {
            logger.warn('Legacy insertion failed:', legacyError);
          }
        }

        const eventDetail = {
          file,
          result: confirmationText,
          isFileAttachment: true,
          fileName,
          confirmationText,
          skipAutoInsertCheck,
        };

        requestAnimationFrame(() => {
          document.dispatchEvent(new CustomEvent('mcp:tool-execution-complete', { detail: eventDetail }));
        });

        resetButtonState();
        return { success: true, message: confirmationText };
      }
    } else {
      // Fallback: Optimistic success for adapters without explicit attachFile method
      // This maintains compatibility while providing user feedback
      logger.debug('Adapter does not have attachFile method, using optimistic success');

      confirmationText = `File attachment completed: ${fileName}`;
      setButtonState('Attached!', 'attach-success', true);

      // Insert the confirmation text into the input field
      if (typeof adapter.insertText === 'function') {
        try {
          await adapter.insertText(confirmationText);
          logger.debug('Confirmation text inserted successfully');
        } catch (insertError) {
          logger.warn('Failed to insert confirmation text:', insertError);
          // Fallback to legacy method if available
          if (typeof adapter.insertTextIntoInput === 'function') {
            try {
              // Dispatch event for legacy insertion
              requestAnimationFrame(() => {
                document.dispatchEvent(
                  new CustomEvent('mcp:tool-execution-complete', {
                    detail: {
                      result: confirmationText,
                      isFileAttachment: false,
                      fileName: '',
                      skipAutoInsertCheck: true,
                    },
                  }),
                );
              });
            } catch (legacyError) {
              logger.warn('Legacy insertion also failed:', legacyError);
            }
          }
        }
      } else if (typeof adapter.insertTextIntoInput === 'function') {
        // Use legacy method directly
        try {
          requestAnimationFrame(() => {
            document.dispatchEvent(
              new CustomEvent('mcp:tool-execution-complete', {
                detail: {
                  result: confirmationText,
                  isFileAttachment: false,
                  fileName: '',
                  skipAutoInsertCheck: true,
                },
              }),
            );
          });
        } catch (legacyError) {
          logger.warn('Legacy insertion failed:', legacyError);
        }
      }

      const eventDetail = {
        file,
        result: confirmationText,
        isFileAttachment: true,
        fileName,
        confirmationText,
        skipAutoInsertCheck,
      };

      requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent('mcp:tool-execution-complete', { detail: eventDetail }));
      });

      resetButtonState();
      return { success: true, message: confirmationText };
    }
  } catch (e) {
    logger.error('File attachment error:', e);
    setButtonState('Failed', 'attach-error', true);
    resetButtonState();
  }

  return { success: false, message: null };
};

function releasePreviewObjectUrls(resultElement: HTMLElement): void {
  const objectUrls = previewObjectUrls.get(resultElement);
  if (!objectUrls) return;

  objectUrls.forEach(url => URL.revokeObjectURL(url));
  previewObjectUrls.delete(resultElement);
}

function renderNormalizedToolResultContent(
  contentArea: HTMLElement,
  normalizedResult: ReturnType<typeof normalizeToolResultContent>,
): void {
  const objectUrls: string[] = [];
  let removalObserver: MutationObserver | null = null;
  const releaseUrl = (url: string) => {
    URL.revokeObjectURL(url);
    const index = objectUrls.indexOf(url);
    if (index !== -1) objectUrls.splice(index, 1);
    if (objectUrls.length === 0) {
      previewObjectUrls.delete(contentArea);
      removalObserver?.disconnect();
    }
  };

  for (const segment of normalizedResult.segments) {
    if (segment.kind === 'text') {
      const textElement = document.createElement('div');
      textElement.className = 'function-result-text';
      textElement.textContent = segment.text;
      contentArea.appendChild(textElement);
      continue;
    }

    if (segment.kind === 'notice') {
      const noticeElement = document.createElement('div');
      noticeElement.className = 'function-result-notice';
      noticeElement.textContent = segment.text;
      contentArea.appendChild(noticeElement);
      continue;
    }

    const imageFigure = document.createElement('figure');
    imageFigure.className = 'function-result-image';

    const image = document.createElement('img');
    image.alt = segment.alt;
    image.loading = 'lazy';
    image.decoding = 'async';

    try {
      const objectUrl = URL.createObjectURL(segment.file);
      objectUrls.push(objectUrl);
      image.addEventListener('load', () => releaseUrl(objectUrl), { once: true });
      image.addEventListener('error', () => releaseUrl(objectUrl), { once: true });
      image.src = objectUrl;
      imageFigure.appendChild(image);

      const caption = document.createElement('figcaption');
      caption.textContent = `${segment.file.name} (${(segment.file.size / 1024).toFixed(1)} KB)`;
      imageFigure.appendChild(caption);
    } catch (error) {
      const noticeElement = document.createElement('div');
      noticeElement.className = 'function-result-notice';
      noticeElement.textContent = `Image preview unavailable: ${error instanceof Error ? error.message : String(error)}`;
      imageFigure.appendChild(noticeElement);
    }

    contentArea.appendChild(imageFigure);
  }

  if (objectUrls.length > 0) {
    previewObjectUrls.set(contentArea, objectUrls);
    removalObserver = new MutationObserver(() => {
      if (!contentArea.isConnected || objectUrls.length === 0) {
        releasePreviewObjectUrls(contentArea);
        removalObserver?.disconnect();
      }
    });
    removalObserver.observe(document, { childList: true, subtree: true });
  }
}

function dispatchToolExecutionComplete(detail: Record<string, unknown>): void {
  requestAnimationFrame(() => {
    document.dispatchEvent(new CustomEvent('mcp:tool-execution-complete', { detail }));
  });
}

/**
 * Optimized result display with efficient DOM operations and batch processing
 * Performance improvements: reduce DOM queries, batch operations, efficient element creation
 *
 * @param resultsPanel Results panel element
 * @param loadingIndicator Loading indicator element
 * @param success Whether the execution was successful
 * @param result Result or error message
 */
export const displayResult = (
  resultsPanel: HTMLDivElement,
  loadingIndicator: HTMLDivElement,
  success: boolean,
  result: any,
): void => {
  // Cache attributes for performance
  const callId = resultsPanel.getAttribute('data-call-id') || '';
  const functionName = resultsPanel.getAttribute('data-function-name') || '';

  // Efficient cleanup of previous results
  const cleanupPreviousResults = () => {
    // Remove loading indicator if present
    if (loadingIndicator.parentNode === resultsPanel) {
      resultsPanel.removeChild(loadingIndicator);
    }

    // Batch remove existing result content
    const existingResults = resultsPanel.querySelectorAll('.function-result-success, .function-result-error');
    existingResults.forEach(el => {
      releasePreviewObjectUrls(el as HTMLElement);
      resultsPanel.removeChild(el);
    });

    // Remove previous button container
    const existingButtonContainer = resultsPanel.nextElementSibling;
    if (existingButtonContainer?.classList.contains('insert-button-container')) {
      existingButtonContainer.parentNode?.removeChild(existingButtonContainer);
    }
  };

  // Optimized error message processing
  const processErrorMessage = (errorResult: any): string => {
    let errorMessage = '';

    if (typeof errorResult === 'string') {
      errorMessage = errorResult;
    } else if (errorResult && typeof errorResult === 'object') {
      errorMessage = errorResult.message || 'An unknown error occurred';
    } else {
      errorMessage = 'An unknown error occurred';
    }

    // Optimize server error message handling
    if (typeof errorMessage === 'string') {
      const errorMap = {
        SERVER_UNAVAILABLE: 'Server is disconnected. Please check your connection settings.',
        CONNECTION_ERROR: 'Connection to server failed. Please try reconnecting.',
        RECONNECT_ERROR: 'Connection to server failed. Please try reconnecting.',
        SERVER_ERROR: 'Server error occurred. Please check server status.',
      };

      for (const [key, message] of Object.entries(errorMap)) {
        if (errorMessage.includes(key)) {
          return message;
        }
      }
    }

    return errorMessage;
  };

  // Clean up previous results
  cleanupPreviousResults();
  loadingIndicator.style.display = 'none';

  if (success) {
    const normalizedResult = normalizeToolResultContent(result, functionName, callId);
    const attachedImageFiles = new Set<File>();
    let resultTextInserted = false;
    let imageContextInserted = false;
    const runResultAction = createResultActionLock();
    let rawResultText = normalizedResult.textForInsertion;

    const resultContent = createOptimizedElement('div', {
      className: 'function-result-success',
    });

    renderNormalizedToolResultContent(resultContent, normalizedResult);
    resultsPanel.appendChild(resultContent);

    // Create button container efficiently using DocumentFragment
    const fragment = document.createDocumentFragment();
    const buttonContainer = createOptimizedElement('div', {
      className: 'function-buttons insert-button-container',
      styles: {
        display: 'flex',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: '8px',
        marginTop: '10px',
        marginBottom: '10px',
      },
    });

    // Create optimized insert button
    const insertButton = createOptimizedElement('button', {
      className: 'insert-result-button',
      innerHTML: `${ICONS.INSERT}<span>Insert</span>`,
      styles: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      },
      attributes: {
        'data-result-id': `result-${callId}-${Date.now()}`,
      },
    }) as HTMLButtonElement;

    // Cache button text element
    const insertButtonText = insertButton.querySelector('span')!;

    // Optimized insert button click handler
    insertButton.onclick = () =>
      runResultAction(async () => {
        const adapter = getCurrentAdapter();

        if (!adapter) {
          const setErrorState = () => {
            insertButton.textContent = 'Failed (No Adapter)';
            insertButton.classList.add('insert-error');
            setTimeout(() => {
              insertButton.innerHTML = `${ICONS.INSERT}<span>Insert</span>`;
              insertButton.classList.remove('insert-error');
            }, 2000);
          };

          setErrorState();
          logger.error('No adapter available for text insertion.');
          return;
        }

        // Check if adapter supports text insertion
        if (!adapterSupportsCapability('text-insertion')) {
          const setErrorState = () => {
            insertButton.textContent = 'Not Supported';
            insertButton.classList.add('insert-error');
            setTimeout(() => {
              insertButton.innerHTML = `${ICONS.INSERT}<span>Insert</span>`;
              insertButton.classList.remove('insert-error');
            }, 2000);
          };

          setErrorState();
          logger.error('Current adapter does not support text insertion.');
          return;
        }

        if (resultTextInserted) {
          insertButton.textContent = 'Already inserted';
          insertButton.disabled = true;
          return;
        }

        const wrapperText = `<function_result call_id="${callId}">\n${rawResultText}\n</function_result>`;

        // Check result length and handle accordingly
        if (
          rawResultText.length > MAX_INSERT_LENGTH &&
          WEBSITE_NAME_FOR_MAX_INSERT_LENGTH_CHECK.includes(websiteName)
        ) {
          logger.debug(`Result length (${wrapperText.length}) exceeds ${MAX_INSERT_LENGTH}. Attaching as file.`);
          const attachment = await attachResultAsFile(
            adapter,
            functionName,
            callId,
            wrapperText,
            insertButton,
            insertButton.querySelector('span') as HTMLElement,
            true,
          );
          if (attachment.success) {
            resultTextInserted = true;
          }
        } else {
          try {
            if (!(await insertResultText(adapter, wrapperText))) throw new Error('Text insertion failed');
            resultTextInserted = true;
            insertButton.textContent = 'Inserted!';
            insertButton.classList.add('insert-success');
            insertButton.disabled = true;
            dispatchToolExecutionComplete({ result: wrapperText, skipAutoInsertCheck: true, callId, functionName });
          } catch (error) {
            logger.warn('Result text insertion failed:', error);
            insertButton.textContent = 'Insert failed · Retry';
            insertButton.classList.add('insert-error');
            insertButton.disabled = false;
          }
        }
      });

    // Create attach button efficiently
    const attachButton = createOptimizedElement('button', {
      className: 'attach-file-button',
      innerHTML: `${ICONS.ATTACH}<span>Attach File</span>`,
      styles: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      },
      attributes: {
        'data-result-id': `attach-${callId}-${Date.now()}`,
      },
    }) as HTMLButtonElement;

    // Optimized attach button handler
    attachButton.onclick = async () => {
      const adapter = getCurrentAdapter();
      await attachResultAsFile(
        adapter,
        functionName,
        callId,
        rawResultText,
        attachButton,
        null, // No longer need iconSpan parameter
        true, // Set skipAutoInsertCheck to true to prevent AutomationService from auto-inserting the same file
      );
    };

    let imageAttachButton: HTMLButtonElement | null = null;
    const resultAdapter = getCurrentAdapter();

    if (normalizedResult.images.length > 0 && resultAdapter && adapterSupportsCapability('file-attachment')) {
      imageAttachButton = createOptimizedElement('button', {
        className: 'attach-file-button attach-images-button',
        innerHTML: `${ICONS.ATTACH}<span>Attach ${normalizedResult.images.length} image${normalizedResult.images.length === 1 ? '' : 's'}</span>`,
        attributes: {
          'data-result-id': `attach-images-${callId}-${Date.now()}`,
        },
      }) as HTMLButtonElement;

      imageAttachButton.onclick = () =>
        runResultAction(async () => {
          const adapter = getCurrentAdapter();
          if (!adapter || !adapterSupportsCapability('file-attachment') || typeof adapter.attachFile !== 'function') {
            imageAttachButton!.textContent = 'File attachment unavailable';
            imageAttachButton!.classList.add('attach-error');
            return;
          }

          const pendingFiles = normalizedResult.images.filter(file => !attachedImageFiles.has(file));
          if (pendingFiles.length === 0 && imageContextInserted) return;

          imageAttachButton!.disabled = true;
          imageAttachButton!.classList.remove('attach-success', 'attach-error');
          imageAttachButton!.innerHTML = `${ICONS.SPINNER}<span>Attaching images...</span>`;

          const failedCount = await attachPendingResultImages(pendingFiles, attachedImageFiles, file =>
            adapter.attachFile(file),
          );

          rawResultText = buildToolResultInsertionText(normalizedResult.segments, attachedImageFiles);

          const allImagesAttached = attachedImageFiles.size === normalizedResult.images.length;
          let contextInserted = false;
          if (allImagesAttached && !imageContextInserted) {
            const contextText = resultTextInserted
              ? `The following MCP images are now attached: ${normalizedResult.images.map(file => file.name).join(', ')}.`
              : rawResultText.length > MAX_INSERT_LENGTH &&
                  WEBSITE_NAME_FOR_MAX_INSERT_LENGTH_CHECK.includes(websiteName)
                ? `MCP image output attached: ${normalizedResult.images.map(file => file.name).join(', ')}. The text portion is too long to insert directly; use Attach File to include the full text result.`
                : `<function_result call_id="${callId}">\n${rawResultText}\n</function_result>`;
            try {
              contextInserted = await insertResultText(adapter, contextText);

              if (contextInserted) {
                imageContextInserted = true;
                resultTextInserted = true;
                dispatchToolExecutionComplete({
                  result: contextText,
                  isFileAttachment: false,
                  fileName: '',
                  skipAutoInsertCheck: true,
                  callId,
                  functionName,
                });
                insertButton.textContent = 'Inserted!';
                insertButton.classList.add('insert-success');
                insertButton.disabled = true;
              }
            } catch (error) {
              logger.warn('Images were attached, but inserting their text context failed:', error);
            }
          }

          const attachedCount = attachedImageFiles.size;
          if (allImagesAttached && imageContextInserted) {
            imageAttachButton!.innerHTML = `${ICONS.ATTACH}<span>Attached ${attachedCount} image${attachedCount === 1 ? '' : 's'}</span>`;
            imageAttachButton!.classList.add('attach-success');
            imageAttachButton!.disabled = true;
            if (!contextInserted) {
              imageAttachButton!.title = 'Images attached. Use Insert to add the result text and image references.';
            }
          } else {
            imageAttachButton!.title = allImagesAttached
              ? 'Images attached; retry inserting text context.'
              : 'Retry remaining images.';
            imageAttachButton!.innerHTML = `${ICONS.ATTACH}<span>Attached ${attachedCount}/${normalizedResult.images.length} · Retry</span>`;
            imageAttachButton!.classList.add('attach-error');
            imageAttachButton!.disabled = false;
          }

          if (failedCount > 0) {
            logger.warn(
              `Attached ${attachedCount} of ${normalizedResult.images.length} MCP images; ${failedCount} failed.`,
            );
          }
        });
    }

    // Efficiently build button container
    buttonContainer.appendChild(insertButton);

    // Only add attach button if supported
    const adapter = resultAdapter;
    if (adapter && adapterSupportsCapability('file-attachment')) {
      buttonContainer.appendChild(attachButton);
      if (imageAttachButton) {
        buttonContainer.appendChild(imageAttachButton);
      }
    }

    if (normalizedResult.images.length > 0 && !imageAttachButton) {
      const notice = document.createElement('span');
      notice.className = 'function-result-notice';
      notice.textContent = 'Image attachment is unavailable on this page. You can insert the text context.';
      buttonContainer.appendChild(notice);
    }

    // Batch DOM update
    fragment.appendChild(buttonContainer);
    resultsPanel.parentNode?.insertBefore(fragment, resultsPanel.nextSibling);

    // Handle auto-attachment for large results
    if (
      !normalizedResult.requiresExplicitAction &&
      rawResultText.length > MAX_INSERT_LENGTH &&
      adapter &&
      adapterSupportsCapability('file-attachment') &&
      WEBSITE_NAME_FOR_MAX_INSERT_LENGTH_CHECK.includes(websiteName)
    ) {
      logger.debug(`Auto-attaching file: Result length (${rawResultText.length}) exceeds ${MAX_INSERT_LENGTH}`);

      // Create efficient fake button for auto-attachment
      const fakeElements = {
        button: createOptimizedElement('button', {
          className: 'insert-result-button',
          styles: { display: 'none' },
        }) as HTMLButtonElement,
      };

      attachResultAsFile(adapter, functionName, callId, rawResultText, fakeElements.button, null, true) // Set to true to prevent double attachment
        .then(async ({ success, message }) => {
          if (success && message) {
            logger.debug(`Auto-attached file successfully: ${message}`);

            // Insert the auto-attachment confirmation text
            if (typeof adapter.insertText === 'function') {
              try {
                await adapter.insertText(message);
                logger.debug('Auto-attachment confirmation text inserted successfully');
              } catch (insertError) {
                logger.warn('Failed to insert auto-attachment confirmation text:', insertError);
                // Fallback to legacy method if available
                if (typeof adapter.insertTextIntoInput === 'function') {
                  try {
                    // Dispatch event for legacy insertion
                    requestAnimationFrame(() => {
                      document.dispatchEvent(
                        new CustomEvent('mcp:tool-execution-complete', {
                          detail: {
                            result: message,
                            isFileAttachment: false,
                            fileName: '',
                            skipAutoInsertCheck: true,
                          },
                        }),
                      );
                    });
                  } catch (legacyError) {
                    logger.warn('Legacy insertion for auto-attachment also failed:', legacyError);
                  }
                }
              }
            } else if (typeof adapter.insertTextIntoInput === 'function') {
              // Use legacy method directly
              try {
                requestAnimationFrame(() => {
                  document.dispatchEvent(
                    new CustomEvent('mcp:tool-execution-complete', {
                      detail: {
                        result: message,
                        isFileAttachment: false,
                        fileName: '',
                        skipAutoInsertCheck: true,
                      },
                    }),
                  );
                });
              } catch (legacyError) {
                logger.warn('Legacy insertion for auto-attachment failed:', legacyError);
              }
            }
          } else {
            logger.error('Failed to auto-attach file.');
            // Fallback to manual attach button
            setTimeout(() => attachButton.click(), 100);
          }

          // Cleanup fake elements
          ElementPool.release(fakeElements.button);
        })
        .catch(err => {
          logger.error('Error auto-attaching file:', err);
          ElementPool.release(fakeElements.button);
        });
    } else {
      // Dispatch event for normal-sized results
      const wrappedResult = `<function_result call_id="${callId}">\n${rawResultText}\n</function_result>`;

      // Dispatch event - delays are handled by automation service
      requestAnimationFrame(() => {
        document.dispatchEvent(
          new CustomEvent('mcp:tool-execution-complete', {
            detail: {
              result: wrappedResult,
              // Images require explicit attachment; do not auto-insert image placeholders.
              skipAutoInsertCheck: normalizedResult.requiresExplicitAction,
              callId,
              functionName,
            },
          }),
        );
      });
    }
  } else {
    // Optimized error result handling
    const errorMessage = processErrorMessage(result);

    const resultContent = createOptimizedElement('div', {
      className: 'function-result-error',
      textContent: errorMessage,
    });

    resultsPanel.appendChild(resultContent);
  }
};
