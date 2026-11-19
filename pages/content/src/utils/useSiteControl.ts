import { useEffect, useState, useCallback } from 'react';
import {
  SUPPORTED_SITES,
  DISABLED_SITES_STORAGE_KEY,
  resolveSiteIdFromHostname,
  normalizeDisabledSites,
  isSiteDisabled,
  getCachedCurrentSiteDisabled,
  setCachedCurrentSiteDisabled,
  fetchDisabledSites,
  updateSiteDisabledState,
} from './siteControl';

export function useSiteControl() {
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentSiteId = resolveSiteIdFromHostname(currentHostname);
  const [disabledSites, setDisabledSites] = useState<string[]>(() =>
    getCachedCurrentSiteDisabled() && currentSiteId ? [currentSiteId] : [],
  );

  useEffect(() => {
    let mounted = true;
    fetchDisabledSites().then(list => {
      if (mounted) {
        setDisabledSites(list);
      }
    });

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes[DISABLED_SITES_STORAGE_KEY]) {
          const updated = normalizeDisabledSites(changes[DISABLED_SITES_STORAGE_KEY].newValue);
          if (mounted) {
            setDisabledSites(updated);
          }
          if (currentHostname) {
            setCachedCurrentSiteDisabled(isSiteDisabled(currentHostname, updated));
          }
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        mounted = false;
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }

    return () => {
      mounted = false;
    };
  }, [currentHostname]);

  const isSiteEnabled = useCallback(
    (siteIdOrHostname: string) => {
      return !isSiteDisabled(siteIdOrHostname, disabledSites);
    },
    [disabledSites],
  );

  const isCurrentSiteEnabled = !isSiteDisabled(currentHostname, disabledSites);

  const setSiteEnabled = useCallback(async (siteIdOrHostname: string, enabled: boolean) => {
    const nextList = await updateSiteDisabledState(siteIdOrHostname, !enabled);
    setDisabledSites(nextList);
  }, []);

  const toggleCurrentSite = useCallback(async () => {
    if (!currentSiteId) return;
    await setSiteEnabled(currentSiteId, !isCurrentSiteEnabled);
  }, [currentSiteId, isCurrentSiteEnabled, setSiteEnabled]);

  return {
    currentSiteId,
    disabledSites,
    isCurrentSiteEnabled,
    isSiteEnabled,
    setSiteEnabled,
    toggleCurrentSite,
    supportedSites: SUPPORTED_SITES,
  };
}
