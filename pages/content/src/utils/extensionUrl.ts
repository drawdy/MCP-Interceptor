/**
 * Stable extension asset URLs for the lifetime of a content-script document.
 *
 * Chrome invalidates an existing content-script context when the extension is
 * reloaded or updated. Calling chrome.runtime.getURL() during a later React
 * render can then throw and unmount the UI. Capture the extension root while
 * the content script is first evaluated and use the cached URL afterwards.
 */
const extensionRootUrl = (() => {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
      return null;
    }
    return chrome.runtime.getURL('');
  } catch {
    return null;
  }
})();

export function getExtensionAssetUrl(path: string): string | null {
  if (!extensionRootUrl) {
    return null;
  }

  try {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return new URL(normalizedPath, extensionRootUrl).toString();
  } catch {
    return null;
  }
}
