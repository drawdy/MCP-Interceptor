import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function selectChecks(paths, all = false) {
  const global =
    all ||
    paths.some(
      path =>
        [
          '.example.env',
          '.npmrc',
          '.nvmrc',
          'package.json',
          'pnpm-lock.yaml',
          'pnpm-workspace.yaml',
          'tsconfig.json',
          'turbo.json',
          '.github/workflows/build-zip.yml',
        ].includes(path) || path.startsWith('.github/scripts/'),
    );
  const code = paths.filter(path => !path.endsWith('.md'));
  const build =
    global ||
    code.some(
      path =>
        /^(chrome-extension|pages|packages|bash-scripts)\//.test(path) &&
        !/(^|\/)(tests?|__tests__)\//.test(path) &&
        !/\.(test|spec)\.[^/]+$/.test(path),
    ) ||
    code.includes('scripts/check-mv3-csp.js');
  const csp =
    global ||
    code.some(
      path =>
        /^chrome-extension\/(src|tests)\//.test(path) ||
        /^chrome-extension\/(package|tsconfig)\.json$/.test(path) ||
        /^packages\/(storage|shared)\//.test(path),
    );
  const parser =
    global ||
    code.some(
      path =>
        path.startsWith('pages/content/src/render_prescript/src/') ||
        path === 'pages/content/package.json' ||
        path === 'tests/json-function-parser-multiline.test.ts' ||
        path === 'tests/run-json-function-parser-multiline.js',
    );
  return { build, tests: [...(csp ? ['csp'] : []), ...(parser ? ['parser'] : [])] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { BASE_SHA: base, HEAD_SHA: head = 'HEAD', EVENT_NAME: event } = process.env;
  const all = event === 'workflow_dispatch' || !base || /^0+$/.test(base);
  let paths = [];
  if (!all) {
    // PRs compare against the common ancestor; pushes compare the actual pushed range.
    const from =
      event === 'pull_request' ? execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim() : base;
    paths = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', from, head], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
  }
  const result = selectChecks(paths, all);
  console.log(JSON.stringify({ paths, ...result }, null, 2));
  appendFileSync(process.env.GITHUB_OUTPUT, `build=${result.build}\ntests=${JSON.stringify(result.tests)}\n`);
}
