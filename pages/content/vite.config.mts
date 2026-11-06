import { build as bundleEntry } from 'esbuild';
import { resolve } from 'node:path';
import { makeEntryPointPlugin } from '@extension/hmr';
import { withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  plugins: [
    IS_DEV && makeEntryPointPlugin(),
    {
      name: 'consent-entry',
      async generateBundle() {
        // Keep the runtime in a separate packaged file. Inlining dynamic imports can
        // execute imported module side effects before the consent check.
        const result = await bundleEntry({
          entryPoints: [resolve(srcDir, 'index.ts')],
          bundle: true,
          write: false,
          format: 'iife',
          minify: !IS_DEV,
          platform: 'browser',
        });
        this.emitFile({ type: 'asset', fileName: 'index.iife.js', source: result.outputFiles[0].text });
      },
    },
  ],
  build: {
    lib: {
      name: 'ContentScript',
      fileName: 'index',
      formats: ['iife'],
      entry: resolve(srcDir, 'runtime.ts'),
    },
    outDir: resolve(rootDir, '..', '..', 'dist', 'content'),
    rollupOptions: {
      input: {
        content: resolve(srcDir, 'runtime.ts'),
      },
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'runtime.iife.js',
        assetFileNames: '[name].[ext]',
      },
    },
    cssCodeSplit: false,
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
});
