import type { AdapterConfig } from './types';
import { GEMINI_DEFAULT_CONFIG } from './gemini.config';
import { CHATGPT_DEFAULT_CONFIG } from './chatgpt.config';
import { createLogger } from '@extension/shared/lib/logger';

/**
 * Configuration manager for adapters
 * Provides bundled, typed configuration defaults for supported adapters
 */

const logger = createLogger('AdapterConfigManager');

export class AdapterConfigManager {
  private static instance: AdapterConfigManager;
  private configCache = new Map<string, AdapterConfig>();

  private constructor() {}

  static getInstance(): AdapterConfigManager {
    if (!AdapterConfigManager.instance) {
      AdapterConfigManager.instance = new AdapterConfigManager();
    }
    return AdapterConfigManager.instance;
  }

  /**
   * Kept for compatibility with adapters that initialize the config manager.
   * Adapter configuration is bundled locally; there is no remote config client.
   */
  initialize(_context: unknown): void {}

  /**
   * Get configuration for a specific adapter
   * @param adapterName - Name of the adapter (e.g., 'gemini')
   * @param variant - Optional variant (e.g., 'experimental', 'testing')
   * @returns Promise<AdapterConfig>
   */
  async getAdapterConfig(adapterName: string, variant?: string): Promise<AdapterConfig> {
    const cacheKey = `${adapterName}_adapter_config${variant ? `_${variant}` : ''}`;

    logger.debug(`Getting adapter config for ${adapterName} (${variant || 'default'})`);
    logger.debug(`Cache key: ${cacheKey}`);
    logger.debug(`Current cache keys:`, Array.from(this.configCache.keys()));

    // Check cache first
    if (this.configCache.has(cacheKey)) {
      logger.debug(`Using cached config for ${adapterName} (${variant || 'default'})`);
      return this.configCache.get(cacheKey)!;
    }

    // Use bundled, reviewed defaults; no remote configuration client is included.
    const config: AdapterConfig = this.getDefaultConfig(adapterName);

    // Cache the resolved config
    this.configCache.set(cacheKey, config);

    logger.debug(`Returning Final config for ${adapterName} (${variant || 'default'}): ${JSON.stringify(config)}`);

    return config;
  }

  /**
   * Get specific selector from adapter config
   */
  async getSelector(
    adapterName: string,
    selectorName: keyof AdapterConfig['selectors'],
    variant?: string,
  ): Promise<string> {
    const config = await this.getAdapterConfig(adapterName, variant);
    return config.selectors[selectorName] || '';
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(
    adapterName: string,
    featureName: keyof AdapterConfig['features'],
    variant?: string,
  ): Promise<boolean> {
    const config = await this.getAdapterConfig(adapterName, variant);
    return config.features[featureName] || false;
  }

  /**
   * Get UI configuration
   */
  async getUIConfig(adapterName: string, variant?: string): Promise<AdapterConfig['ui']> {
    const config = await this.getAdapterConfig(adapterName, variant);
    return config.ui;
  }

  /**
   * Clear cached adapter configuration so bundled defaults are reloaded
   */
  clearCache(adapterName?: string) {
    if (adapterName) {
      // Clear specific adapter cache
      const keysToDelete = Array.from(this.configCache.keys()).filter(key =>
        key.startsWith(`${adapterName}_adapter_config`),
      );
      keysToDelete.forEach(key => this.configCache.delete(key));
    } else {
      // Clear all cache
      this.configCache.clear();
    }
  }

  /**
   * Get default configuration for adapter
   */
  private getDefaultConfig(adapterName: string): AdapterConfig {
    switch (adapterName.toLowerCase()) {
      case 'gemini':
        return { ...GEMINI_DEFAULT_CONFIG };
      case 'chatgpt':
        return { ...CHATGPT_DEFAULT_CONFIG };
      default:
        logger.warn(`No default config found for ${adapterName}, using Gemini defaults`);
        return { ...GEMINI_DEFAULT_CONFIG };
    }
  }
}

// Export singleton instance
export const adapterConfigManager = AdapterConfigManager.getInstance();
