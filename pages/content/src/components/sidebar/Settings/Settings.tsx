import React, { useState } from 'react';
import { useUserPreferences } from '@src/hooks';
import { Card, CardContent } from '@src/components/ui/card';
import { Typography, Icon } from '../ui';
import { AutomationService } from '@src/services/automation.service';
import { cn } from '@src/lib/utils';
import { createLogger } from '@extension/shared/lib/logger';
import { useLanguage } from '@src/utils/i18n';
import { useSiteControl, getSiteDisplayName } from '@src/utils/siteControl';

// Default delay values in seconds

const logger = createLogger('Settings');

const DEFAULT_DELAYS = {
  autoInsertDelay: 2,
  autoSubmitDelay: 2,
  autoExecuteDelay: 2
} as const;

const Settings: React.FC = () => {
  const { preferences, updatePreferences } = useUserPreferences();
  const { language, isZh, t } = useLanguage();
  const {
    currentSiteId,
    isCurrentSiteEnabled,
    isSiteEnabled,
    setSiteEnabled,
    toggleCurrentSite,
    supportedSites,
  } = useSiteControl();
  const [showAllSites, setShowAllSites] = useState(false);
  const [showSiteHelp, setShowSiteHelp] = useState(false);

  // Handle delay input changes
  const handleDelayChange = (type: 'autoInsert' | 'autoSubmit' | 'autoExecute', value: string) => {
    const delay = Math.max(0, parseInt(value) || 0); // Ensure non-negative integer
    logger.debug(`${type} delay changed to: ${delay}`);
    
    // Update user preferences store with the new delay
    updatePreferences({ [`${type}Delay`]: delay });

    // Store in localStorage
    try {
      const storedDelays = JSON.parse(localStorage.getItem('mcpDelaySettings') || '{}');
      localStorage.setItem('mcpDelaySettings', JSON.stringify({
        ...storedDelays,
        [`${type}Delay`]: delay
      }));
    } catch (error) {
      logger.error('[Settings] Error storing delay settings:', error);
    }

    // Update automation state on window
    AutomationService.getInstance().updateAutomationStateOnWindow().catch(console.error);
  };

  // Load stored delays on component mount, set default to 2 seconds if not set
  React.useEffect(() => {
    try {
      const storedDelays = JSON.parse(localStorage.getItem('mcpDelaySettings') || '{}');
      // If no stored delays, use defaults
      if (Object.keys(storedDelays).length === 0) {
        updatePreferences(DEFAULT_DELAYS);
        localStorage.setItem('mcpDelaySettings', JSON.stringify(DEFAULT_DELAYS));
      } else {
        // Use stored delays
        updatePreferences(storedDelays);
      }
    } catch (error) {
      logger.error('[Settings] Error loading stored delay settings:', error);
      // Set defaults on error
      updatePreferences(DEFAULT_DELAYS);
      localStorage.setItem('mcpDelaySettings', JSON.stringify(DEFAULT_DELAYS));
    }
  }, [updatePreferences]);

  return (
    <div className="p-4 space-y-4">
      <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-800">
        <CardContent className="p-4">
          <div className="relative mb-3">
            <div className="flex items-center gap-1.5">
              <Typography variant="h4" className="text-slate-700 dark:text-slate-300">
                {t('Website Access', '网站启用管理')}
              </Typography>
              <button
                type="button"
                onMouseEnter={() => setShowSiteHelp(true)}
                onMouseLeave={() => setShowSiteHelp(false)}
                onClick={() => setShowSiteHelp(prev => !prev)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5 rounded focus:outline-none cursor-pointer"
                aria-label={t('Website access help', '网站启用管理说明')}>
                <Icon name="info" size="xs" />
              </button>
            </div>

            {showSiteHelp && (
              <div
                onMouseEnter={() => setShowSiteHelp(true)}
                onMouseLeave={() => setShowSiteHelp(false)}
                className="absolute left-0 right-0 top-full mt-1.5 z-50 p-2.5 text-xs leading-relaxed rounded-md shadow-lg bg-slate-900 dark:bg-slate-800 text-slate-100 dark:text-slate-200 border border-slate-700 animate-in fade-in duration-150">
                {t(
                  'Disable on sites where built-in tools are enough (e.g., chatgpt.com). Once disabled, you can re-enable it from the toolbar icon or another site.',
                  '可在自带工具已满足需求的网站（如 chatgpt.com）关闭插件以避免干扰。关闭后可通过浏览器工具栏图标或其他网站的设置随时重新开启。',
                )}
              </div>
            )}
          </div>

          {currentSiteId && (
            <div className="p-3 mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('Current Website', '当前网站')}
                  </div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {getSiteDisplayName(currentSiteId, language)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCurrentSite()}
                  role="switch"
                  aria-checked={isCurrentSiteEnabled}
                  className={cn(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    isCurrentSiteEnabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600',
                  )}
                  title={
                    isCurrentSiteEnabled
                      ? t('Click to disable plugin on this site', '点击在当前网站禁用插件')
                      : t('Click to enable plugin on this site', '点击在当前网站启用插件')
                  }>
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      isCurrentSiteEnabled ? 'translate-x-5' : 'translate-x-0',
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowAllSites(prev => !prev)}
              className="flex items-center justify-between w-full py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              <span>{t('Manage all supported websites', '管理全部支持的网站')}</span>
              <Icon
                name="chevron-right"
                size="xs"
                className={cn('transition-transform duration-200', showAllSites ? 'rotate-90' : '')}
              />
            </button>

            {showAllSites && (
              <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {supportedSites.map(site => {
                  const enabled = isSiteEnabled(site.id);
                  const isCurrent = site.id === currentSiteId;
                  return (
                    <div
                      key={site.id}
                      className={cn(
                        'flex items-center justify-between px-2.5 py-2 rounded-md border text-xs',
                        isCurrent
                          ? 'border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-900/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40',
                      )}>
                      <span className="text-slate-700 dark:text-slate-200 truncate mr-2">
                        {isZh ? site.labelZh : site.labelEn}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSiteEnabled(site.id, !enabled)}
                        role="switch"
                        aria-checked={enabled}
                        className={cn(
                          'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                          enabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600',
                        )}>
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                            enabled ? 'translate-x-4' : 'translate-x-0',
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-800">
        <CardContent className="p-4">
          <Typography variant="h4" className="mb-4 text-slate-700 dark:text-slate-300">
            {t('Automation Delay Settings', '自动化延迟设置')}
          </Typography>
          
          <div className="space-y-4">
            {/* Auto Insert Delay */}
            <div>
              <label
                htmlFor="auto-insert-delay"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('Auto Insert Delay (seconds)', '自动插入延迟（秒）')}
              </label>
              <input
                id="auto-insert-delay"
                type="number"
                min="0"
                value={preferences.autoInsertDelay || 0}
                onChange={(e) => handleDelayChange('autoInsert', e.target.value)}
                disabled={false}
                className={cn(
                  "w-full p-2 text-sm border rounded-md",
                  "bg-white dark:bg-slate-900",
                  "border-slate-300 dark:border-slate-600",
                  "text-slate-900 dark:text-slate-100"
                )}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('Delay before auto-inserting content', '工具执行完成后自动插入结果到输入框前的等待时间')}
              </p>
            </div>

            {/* Auto Submit Delay */}
            <div>
              <label
                htmlFor="auto-submit-delay"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('Auto Submit Delay (seconds)', '自动提交延迟（秒）')}
              </label>
              <input
                id="auto-submit-delay"
                type="number"
                min="0"
                value={preferences.autoSubmitDelay || 0}
                onChange={(e) => handleDelayChange('autoSubmit', e.target.value)}
                disabled={false}
                className={cn(
                  "w-full p-2 text-sm border rounded-md",
                  "bg-white dark:bg-slate-900",
                  "border-slate-300 dark:border-slate-600",
                  "text-slate-900 dark:text-slate-100"
                )}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('Delay before auto-submitting form', '自动插入结果后自动发送消息前的等待时间')}
              </p>
            </div>

            {/* Auto Execute Delay */}
            <div>
              <label
                htmlFor="auto-execute-delay"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('Auto Execute Delay (seconds)', '自动执行延迟（秒）')}
              </label>
              <input
                id="auto-execute-delay"
                type="number"
                min="0"
                value={preferences.autoExecuteDelay || 0}
                onChange={(e) => handleDelayChange('autoExecute', e.target.value)}
                disabled={false}
                className={cn(
                  "w-full p-2 text-sm border rounded-md",
                  "bg-white dark:bg-slate-900",
                  "border-slate-300 dark:border-slate-600",
                  "text-slate-900 dark:text-slate-100"
                )}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('Delay before auto-executing functions', '检测到工具调用后自动执行前的等待时间')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
