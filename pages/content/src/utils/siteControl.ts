import { useEffect, useState, useCallback } from 'react';
import type { AppLanguage } from './i18n';

export const DISABLED_SITES_STORAGE_KEY = 'mcpDisabledSites';
export const LOCAL_SITE_DISABLED_CACHE_KEY = 'mcp_site_disabled';

export interface SupportedSiteInfo {
  id: string;
  labelEn: string;
  labelZh: string;
  hosts: string[];
}

export const SUPPORTED_SITES: SupportedSiteInfo[] = [
  {
    id: 'chatgpt.com',
    labelEn: 'ChatGPT (chatgpt.com)',
    labelZh: 'ChatGPT (chatgpt.com)',
    hosts: ['chatgpt.com', 'chat.openai.com'],
  },
  {
    id: 'gemini.google.com',
    labelEn: 'Google Gemini (gemini.google.com)',
    labelZh: 'Google Gemini (gemini.google.com)',
    hosts: ['gemini.google.com'],
  },
  {
    id: 'aistudio.google.com',
    labelEn: 'Google AI Studio (aistudio.google.com)',
    labelZh: 'Google AI Studio (aistudio.google.com)',
    hosts: ['aistudio.google.com'],
  },
  {
    id: 'chat.deepseek.com',
    labelEn: 'DeepSeek (chat.deepseek.com)',
    labelZh: 'DeepSeek (chat.deepseek.com)',
    hosts: ['chat.deepseek.com'],
  },
  {
    id: 'perplexity.ai',
    labelEn: 'Perplexity (perplexity.ai)',
    labelZh: 'Perplexity (perplexity.ai)',
    hosts: ['perplexity.ai'],
  },
  {
    id: 'grok.com',
    labelEn: 'Grok (grok.com / x.com)',
    labelZh: 'Grok (grok.com / x.com)',
    hosts: ['grok.com', 'x.com', 'twitter.com'],
  },
  {
    id: 'kimi.com',
    labelEn: 'Kimi (kimi.com)',
    labelZh: 'Kimi (kimi.com)',
    hosts: ['kimi.com'],
  },
  {
    id: 'chat.qwen.ai',
    labelEn: 'Qwen Chat (chat.qwen.ai)',
    labelZh: '通义千问 Qwen (chat.qwen.ai)',
    hosts: ['chat.qwen.ai'],
  },
  {
    id: 'chat.z.ai',
    labelEn: 'Z.ai / GLM (chat.z.ai)',
    labelZh: '智谱 Z.ai (chat.z.ai)',
    hosts: ['chat.z.ai', 'z.ai'],
  },
  {
    id: 'openrouter.ai',
    labelEn: 'OpenRouter (openrouter.ai)',
    labelZh: 'OpenRouter (openrouter.ai)',
    hosts: ['openrouter.ai'],
  },
  {
    id: 'chat.mistral.ai',
    labelEn: 'Mistral Chat (chat.mistral.ai)',
    labelZh: 'Mistral Chat (chat.mistral.ai)',
    hosts: ['chat.mistral.ai'],
  },
  {
    id: 't3.chat',
    labelEn: 'T3 Chat (t3.chat)',
    labelZh: 'T3 Chat (t3.chat)',
    hosts: ['t3.chat'],
  },
  {
    id: 'github.com/copilot',
    labelEn: 'GitHub Copilot (github.com/copilot)',
    labelZh: 'GitHub Copilot (github.com/copilot)',
    hosts: ['copilot.github.com', 'github.com'],
  },
  {
    id: 'kagi.com',
    labelEn: 'Kagi (kagi.com)',
    labelZh: 'Kagi (kagi.com)',
    hosts: ['kagi.com'],
  },
];

/**
 * Resolves a hostname (e.g. `chat.openai.com` or `www.chatgpt.com`) to its canonical site ID (`chatgpt.com`).
 */
export function resolveSiteIdFromHostname(hostname?: string): string {
  const raw = (hostname || (typeof window !== 'undefined' ? window.location.hostname : '') || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');

  if (!raw) return '';

  for (const site of SUPPORTED_SITES) {
    if (site.id === raw) return site.id;
    for (const host of site.hosts) {
      if (raw === host || raw.endsWith(`.${host}`)) {
        return site.id;
      }
    }
  }

  return raw;
}

export function getSiteDisplayName(siteIdOrHostname: string, language: AppLanguage = 'en'): string {
  const siteId = resolveSiteIdFromHostname(siteIdOrHostname);
  const found = SUPPORTED_SITES.find(s => s.id === siteId);
  if (found) {
    return language === 'zh' ? found.labelZh : found.labelEn;
  }
  return siteId || siteIdOrHostname;
}

export function normalizeDisabledSites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const normalized = new Set<string>();
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      const id = resolveSiteIdFromHostname(item);
      if (id) normalized.add(id);
    }
  }
  return Array.from(normalized);
}

export function isSiteDisabled(hostname: string, disabledSites: string[]): boolean {
  const siteId = resolveSiteIdFromHostname(hostname);
  if (!siteId) return false;
  const normalizedList = normalizeDisabledSites(disabledSites);
  return normalizedList.includes(siteId);
}

export function getCachedCurrentSiteDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LOCAL_SITE_DISABLED_CACHE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setCachedCurrentSiteDisabled(disabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (disabled) {
      window.localStorage.setItem(LOCAL_SITE_DISABLED_CACHE_KEY, 'true');
    } else {
      window.localStorage.removeItem(LOCAL_SITE_DISABLED_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function fetchDisabledSites(): Promise<string[]> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const result = await chrome.storage.local.get([DISABLED_SITES_STORAGE_KEY]);
      const list = normalizeDisabledSites(result[DISABLED_SITES_STORAGE_KEY]);
      if (typeof window !== 'undefined' && window.location?.hostname) {
        setCachedCurrentSiteDisabled(isSiteDisabled(window.location.hostname, list));
      }
      return list;
    } catch {
      // Fallback to local cache
    }
  }
  if (getCachedCurrentSiteDisabled() && typeof window !== 'undefined' && window.location?.hostname) {
    return [resolveSiteIdFromHostname(window.location.hostname)];
  }
  return [];
}

export async function updateSiteDisabledState(siteIdOrHostname: string, disabled: boolean): Promise<string[]> {
  const targetSiteId = resolveSiteIdFromHostname(siteIdOrHostname);
  const currentList = await fetchDisabledSites();
  const nextSet = new Set<string>(currentList);

  if (disabled) {
    nextSet.add(targetSiteId);
  } else {
    nextSet.delete(targetSiteId);
  }

  const nextList = Array.from(nextSet);

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const currentSiteId = resolveSiteIdFromHostname(window.location.hostname);
    if (currentSiteId === targetSiteId) {
      setCachedCurrentSiteDisabled(disabled);
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [DISABLED_SITES_STORAGE_KEY]: nextList });
    } catch {
      // Ignore storage write errors
    }
  }

  return nextList;
}

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
      const handleStorageChange = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string,
      ) => {
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

