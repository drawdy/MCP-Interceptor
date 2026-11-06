/** Increment for material changes to page-content processing. Never migrate consent implicitly. */
export const PRIVACY_CONSENT_VERSION = '2026-11-06';
export const PRIVACY_CONSENT_KEYS = [
  'privacyConsentGranted',
  'privacyConsentVersion',
  'privacyConsentTimestamp',
] as const;

export function hasPrivacyConsent(value: Record<string, unknown>): boolean {
  return (
    value.privacyConsentGranted === true &&
    value.privacyConsentVersion === PRIVACY_CONSENT_VERSION &&
    typeof value.privacyConsentTimestamp === 'number' &&
    Number.isFinite(value.privacyConsentTimestamp) &&
    value.privacyConsentTimestamp > 0
  );
}

export async function readPrivacyConsent(): Promise<boolean> {
  try {
    return hasPrivacyConsent(await chrome.storage.local.get([...PRIVACY_CONSENT_KEYS]));
  } catch {
    return false;
  }
}
