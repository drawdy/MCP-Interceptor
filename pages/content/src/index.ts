/** Minimal entry: do not import page-processing modules before affirmative consent. */
import { hasPrivacyConsent, PRIVACY_CONSENT_KEYS } from '@extension/shared/lib/privacy-consent';
import { DISABLED_SITES_STORAGE_KEY, isSiteDisabled, normalizeDisabledSites } from './utils/siteControl';

let loadingRuntime = false;
let revision = 0;
function stopAndReload(): void {
  // Stop renderer monitoring synchronously even if navigation is slow or cancelled.
  (globalThis as typeof globalThis & { mcpInterceptorStop?: () => void }).mcpInterceptorStop?.();
  location.reload();
}

async function reconcile(): Promise<void> {
  const current = ++revision;
  try {
    const stored = await chrome.storage.local.get([...PRIVACY_CONSENT_KEYS, DISABLED_SITES_STORAGE_KEY]);
    if (current !== revision) return;
    const allowed =
      hasPrivacyConsent(stored) &&
      !isSiteDisabled(location.hostname, normalizeDisabledSites(stored[DISABLED_SITES_STORAGE_KEY]));
    if (loadingRuntime) {
      // A fresh document cancels observers, timers, in-flight initialization and injected controls,
      // including adapter-specific resources. The next entry checks storage again.
      if (!allowed) stopAndReload();
      return;
    }
    if (!allowed) return;
    loadingRuntime = true;
    await import(/* @vite-ignore */ chrome.runtime.getURL('content/runtime.iife.js'));
  } catch (error) {
    // Fail closed if storage or module loading fails.
    console.error('MCP-Interceptor could not verify privacy authorization.', error);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && [...PRIVACY_CONSENT_KEYS, DISABLED_SITES_STORAGE_KEY].some(key => key in changes)) {
    // Stop the old document immediately on any authorization change while runtime is loaded.
    // This also closes the race with an asynchronous runtime import or initialization.
    if (loadingRuntime) {
      stopAndReload();
      return;
    }
    void reconcile();
  }
});
void reconcile();
