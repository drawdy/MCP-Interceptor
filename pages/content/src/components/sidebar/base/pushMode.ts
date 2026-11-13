export const PUSH_MODE_STYLE_ID = 'mcp-sidebar-push-styles';

/**
 * Returns the stylesheet injected into the host document to support push content mode
 * across sites using viewport-width root containers (such as ChatGPT's `.w-screen`).
 */
export function getPushModeStylesheetText(): string {
  return `
    /* High-priority push mode styles with !important to override website styles */
    html.push-mode-enabled {
      position: relative !important;
      overflow-x: hidden !important;
      width: calc(100% - var(--sidebar-width-mcp, 320px)) !important;
      max-width: calc(100% - var(--sidebar-width-mcp, 320px)) !important;
      margin-right: var(--sidebar-width-mcp, 320px) !important;
      transition: margin-right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
                  width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
                  max-width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
      box-sizing: border-box !important;
    }

    /* Ensure body and full-viewport app shells shrink with the pushed root instead of staying at 100vw */
    html.push-mode-enabled body {
      width: 100% !important;
      max-width: 100% !important;
      margin-right: 0 !important;
      padding-right: 0 !important;
      overflow-x: hidden !important;
      box-sizing: border-box !important;
    }

    html.push-mode-enabled body > div:not(#mcp-sidebar-shadow-host):not(#mcp-popover-portal):not(.mcp-popover-container),
    html.push-mode-enabled body > main,
    html.push-mode-enabled #__next,
    html.push-mode-enabled #root,
    html.push-mode-enabled #app,
    html.push-mode-enabled .w-screen,
    html.push-mode-enabled .w-dvw,
    html.push-mode-enabled .w-svw,
    html.push-mode-enabled .w-lvw,
    html.push-mode-enabled [class*="w-[100vw]"],
    html.push-mode-enabled [class*="w-[100dvw]"] {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    /* Ensure fixed sidebar stays anchored on the right edge */
    html.push-mode-enabled .sidebar {
      right: 0;
    }

    /* Add smooth resize styles */
    .sidebar {
      transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    }

    .sidebar.resizing {
      transition: none !important;
    }

    /* Enhanced shadow host animations */
    #mcp-sidebar-shadow-host {
      opacity: 0;
      transform: translateX(30px) scale(0.95);
      transition: opacity 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
                  transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    }

    #mcp-sidebar-shadow-host.initialized {
      opacity: 1;
      transform: translateX(0) scale(1);
    }

    #mcp-sidebar-shadow-host.showing {
      transition-duration: 0s;
    }

    #mcp-sidebar-shadow-host.hiding {
      opacity: 0;
      transform: translateX(20px) scale(0.98);
      transition: opacity 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53),
                  transform 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }

    /* Add subtle backdrop effect */
    body:has(#mcp-sidebar-shadow-host.initialized) {
      transition: filter 0.3s ease;
    }

    /* Smooth page content adjustments */
    body {
      transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
  `;
}

/**
 * Ensures the push mode `<style>` element exists in `doc.head` with the latest rules.
 */
export function ensurePushModeStylesheet(doc: Document = document): HTMLStyleElement | null {
  if (!doc || !doc.head) {
    return null;
  }

  const nextCss = getPushModeStylesheetText();
  const existing = doc.getElementById(PUSH_MODE_STYLE_ID) as HTMLStyleElement | null;
  if (existing) {
    if (existing.textContent !== nextCss) {
      existing.textContent = nextCss;
    }
    return existing;
  }

  const styleEl = doc.createElement('style');
  styleEl.id = PUSH_MODE_STYLE_ID;
  styleEl.textContent = nextCss;
  doc.head.appendChild(styleEl);
  return styleEl;
}

/**
 * Applies push content mode inline styles and classes to `html` and `body`.
 */
export function applyPushModeDomStyles(width: number, isCollapsed: boolean, doc: Document = document): void {
  const html = doc.documentElement;
  if (!html) return;

  html.classList.remove('push-mode-transform');
  html.style.removeProperty('transform');

  html.style.setProperty('--sidebar-width-mcp', `${width}px`);
  html.style.setProperty('position', 'relative', 'important');
  html.style.setProperty('margin-right', `${width}px`, 'important');
  html.style.setProperty('width', `calc(100% - ${width}px)`, 'important');
  html.style.setProperty('max-width', `calc(100% - ${width}px)`, 'important');
  html.style.setProperty('min-height', '100vh', 'important');
  html.style.setProperty('box-sizing', 'border-box', 'important');

  if (doc.body) {
    doc.body.style.setProperty('width', '100%', 'important');
    doc.body.style.setProperty('max-width', '100%', 'important');
    doc.body.style.setProperty('margin-right', '0', 'important');
    doc.body.style.setProperty('padding-right', '0', 'important');
    doc.body.style.setProperty('box-sizing', 'border-box', 'important');
  }

  html.classList.add('push-mode-enabled');
  if (isCollapsed) {
    html.classList.add('sidebar-collapsed');
  } else {
    html.classList.remove('sidebar-collapsed');
  }
}

/**
 * Updates push mode width-related CSS variables and dimensions during sidebar resize.
 */
export function updatePushModeDomWidth(width: number, doc: Document = document): void {
  const html = doc.documentElement;
  if (!html) return;

  html.style.setProperty('--sidebar-width-mcp', `${width}px`);
  html.style.setProperty('margin-right', `${width}px`, 'important');
  html.style.setProperty('width', `calc(100% - ${width}px)`, 'important');
  html.style.setProperty('max-width', `calc(100% - ${width}px)`, 'important');
}

/**
 * Removes all push content mode inline styles and classes from `html` and `body`.
 */
export function clearPushModeDomStyles(doc: Document = document): void {
  const html = doc.documentElement;
  if (html) {
    html.style.removeProperty('--sidebar-width-mcp');
    html.style.removeProperty('position');
    html.style.removeProperty('margin-right');
    html.style.removeProperty('width');
    html.style.removeProperty('max-width');
    html.style.removeProperty('min-height');
    html.style.removeProperty('box-sizing');
    html.style.removeProperty('transform');
    html.classList.remove('push-mode-enabled', 'sidebar-collapsed', 'push-mode-transform');
  }

  if (doc.body) {
    doc.body.style.removeProperty('width');
    doc.body.style.removeProperty('max-width');
    doc.body.style.removeProperty('margin-right');
    doc.body.style.removeProperty('padding-right');
    doc.body.style.removeProperty('box-sizing');
  }
}

/**
 * Checks whether push mode classes and inline dimensions are still intact on `html` and `body`.
 */
export function isPushModeDomIntact(width: number, isCollapsed: boolean, doc: Document = document): boolean {
  const html = doc.documentElement;
  if (!html) return false;

  const expectedWidth = `${width}px`;
  const hasPushClass = html.classList.contains('push-mode-enabled');
  const collapsedMatches = isCollapsed
    ? html.classList.contains('sidebar-collapsed')
    : !html.classList.contains('sidebar-collapsed');
  const hasCssVar = html.style.getPropertyValue('--sidebar-width-mcp').trim() === expectedWidth;
  const hasMargin = html.style.getPropertyValue('margin-right').trim() === expectedWidth;
  const hasWidth = html.style.getPropertyValue('width').trim() === `calc(100% - ${expectedWidth})`;
  const bodyIntact = !doc.body || doc.body.style.getPropertyValue('max-width').trim() === '100%';

  return hasPushClass && collapsedMatches && hasCssVar && hasMargin && hasWidth && bodyIntact;
}
