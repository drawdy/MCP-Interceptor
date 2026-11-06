import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import setRelatedLocaleImports from './set_related_locale_import.js';
import { IS_DEV } from '@extension/env';

(() => {
  const i18nPath = IS_DEV ? 'lib/i18n-dev.ts' : 'lib/i18n-prod.ts';
  cpSync(i18nPath, resolve('lib', 'i18n.ts'));

  // The product uses bundled popup/content translations, not Chrome message catalogs.
  // Do not ship unused boilerplate _locales metadata without a default_locale.

  if (IS_DEV) {
    setRelatedLocaleImports();
  }
  console.log('I18n build complete');
})();
