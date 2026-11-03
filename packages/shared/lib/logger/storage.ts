import type { ILoggerStorage } from './types.js';
import { LogLevel } from './types.js';

const STORAGE_KEY = 'mcp_logger_config';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Chrome Storage-based logger persistence
 */
export class LoggerStorage implements ILoggerStorage {
  private storageKey: string;

  constructor(storageKey: string = STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /**
   * Get the global log level from storage
   */
  async getLevel(): Promise<LogLevel | null> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return null;
      }

      const result = await chrome.storage.local.get(this.storageKey);
      const config = result[this.storageKey];

      if (isRecord(config) && typeof config.level === 'number') {
        return config.level as LogLevel;
      }

      return null;
    } catch (error) {
      console.error('[LoggerStorage] Failed to get level:', error);
      return null;
    }
  }

  /**
   * Set the global log level in storage
   */
  async setLevel(level: LogLevel): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }

      const existing = await chrome.storage.local.get(this.storageKey);
      const stored = existing[this.storageKey];
      const config = isRecord(stored) ? stored : {};

      config.level = level;

      await chrome.storage.local.set({ [this.storageKey]: config });
    } catch (error) {
      console.error('[LoggerStorage] Failed to set level:', error);
    }
  }

  /**
   * Get component-specific log levels from storage
   */
  async getComponentLevels(): Promise<Record<string, LogLevel>> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return {};
      }

      const result = await chrome.storage.local.get(this.storageKey);
      const config = result[this.storageKey];

      if (isRecord(config) && isRecord(config.componentLevels)) {
        return config.componentLevels as Record<string, LogLevel>;
      }

      return {};
    } catch (error) {
      console.error('[LoggerStorage] Failed to get component levels:', error);
      return {};
    }
  }

  /**
   * Set a component-specific log level in storage
   */
  async setComponentLevel(component: string, level: LogLevel): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }

      const existing = await chrome.storage.local.get(this.storageKey);
      const stored = existing[this.storageKey];
      const config = isRecord(stored) ? stored : {};
      const componentLevels = isRecord(config.componentLevels) ? config.componentLevels : {};

      componentLevels[component] = level;
      config.componentLevels = componentLevels;

      await chrome.storage.local.set({ [this.storageKey]: config });
    } catch (error) {
      console.error('[LoggerStorage] Failed to set component level:', error);
    }
  }

  /**
   * Clear all logger configuration from storage
   */
  async clear(): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }

      await chrome.storage.local.remove(this.storageKey);
    } catch (error) {
      console.error('[LoggerStorage] Failed to clear storage:', error);
    }
  }
}
