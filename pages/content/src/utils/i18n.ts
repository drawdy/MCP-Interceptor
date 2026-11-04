import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/ui.store';
import { useShallow } from 'zustand/shallow';

export type AppLanguage = 'en' | 'zh';

const STORAGE_KEY = 'mcpLanguage';

export const normalizeLanguage = (lang?: string): AppLanguage => {
  if (!lang) return 'en';
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
};

export const getCurrentLanguage = (): AppLanguage => {
  try {
    const raw = useUIStore.getState().preferences.language;
    return normalizeLanguage(raw);
  } catch {
    return 'en';
  }
};

export const getReadmeUrl = (lang: AppLanguage): string =>
  lang === 'zh'
    ? 'https://github.com/drawdy/MCP-Interceptor/blob/main/README_zh.md'
    : 'https://github.com/drawdy/MCP-Interceptor/blob/main/README.md';

export const translateServerMessage = (message: string, lang: AppLanguage): string => {
  if (!message || lang === 'en') return message;

  if (message === 'Configure an MCP server to connect.') {
    return '请先配置 MCP 服务器后再连接。';
  }
  if (message === 'Configure an MCP server before reconnecting.') {
    return '请先配置 MCP 服务器后再重新连接。';
  }
  if (message === 'Configure an MCP server before executing tools.') {
    return '执行工具前请先配置 MCP 服务器。';
  }
  if (message === 'Reconnecting...') {
    return '正在重新连接...';
  }

  const permissionMatch = message.match(
    /^Access to (.+) is not granted\. Click the MCP-Interceptor toolbar icon and choose "Grant access and connect"\.$/,
  );
  if (permissionMatch) {
    return `尚未授予对 ${permissionMatch[1]} 的访问权限。请点击浏览器工具栏中的 MCP-Interceptor 图标并选择“授权访问并连接”。`;
  }

  return message;
};

let storageListenerInitialized = false;

const initChromeStorageLanguageSync = () => {
  if (storageListenerInitialized) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  storageListenerInitialized = true;

  try {
    chrome.storage.local
      .get([STORAGE_KEY])
      .then(result => {
        if (typeof result[STORAGE_KEY] === 'string') {
          const normalized = normalizeLanguage(result[STORAGE_KEY]);
          const current = normalizeLanguage(useUIStore.getState().preferences.language);
          if (normalized !== current) {
            useUIStore.getState().updatePreferences({ language: normalized });
          }
        } else {
          const current = normalizeLanguage(useUIStore.getState().preferences.language);
          chrome.storage.local.set({ [STORAGE_KEY]: current }).catch(() => {});
        }
      })
      .catch(() => {});

    chrome.storage.onChanged?.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]?.newValue) {
        const nextLang = normalizeLanguage(changes[STORAGE_KEY].newValue);
        const current = normalizeLanguage(useUIStore.getState().preferences.language);
        if (nextLang !== current) {
          useUIStore.getState().updatePreferences({ language: nextLang });
        }
      }
    });
  } catch {
    // Ignore storage access errors in restricted contexts
  }
};

export const useLanguage = () => {
  const { rawLanguage, updatePreferences } = useUIStore(
    useShallow(state => ({
      rawLanguage: state.preferences.language,
      updatePreferences: state.updatePreferences,
    })),
  );

  const language: AppLanguage = normalizeLanguage(rawLanguage);
  const isZh = language === 'zh';

  useEffect(() => {
    initChromeStorageLanguageSync();
  }, []);

  const setLanguage = useCallback(
    (nextLang: AppLanguage) => {
      updatePreferences({ language: nextLang });
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ [STORAGE_KEY]: nextLang }).catch(() => {});
        }
      } catch {
        // Ignore storage write errors
      }
    },
    [updatePreferences],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  }, [language, setLanguage]);

  const t = useCallback(
    (enText: string, zhText: string): string => (isZh ? zhText : enText),
    [isZh],
  );

  return {
    language,
    isZh,
    setLanguage,
    toggleLanguage,
    t,
  };
};

