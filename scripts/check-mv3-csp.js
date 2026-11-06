import { readFile, readdir, access } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Parse executable syntax so documentation strings and protocol schemas are not mistaken for code.
export function inspectJavaScript(source, filename = 'script.js') {
  const findings = [];
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const remote = value => /^(?:https?:)?\/\//i.test(value);
  const nameOf = node =>
    ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? node.name.text : '';
  const literal = node => node && (ts.isStringLiteralLike(node) ? node.text : undefined);
  function visit(node) {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const name = nameOf(node.expression);
      if (['eval', 'Function'].includes(name)) findings.push(`${name} code execution`);
      if (['setTimeout', 'setInterval'].includes(name) && literal(node.arguments?.[0]) !== undefined)
        findings.push('string timer');
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        ['importScripts', 'Worker', 'SharedWorker'].includes(name)
      ) {
        const url = literal(node.arguments?.[0]);
        if (url && remote(url)) findings.push('remote executable module/worker');
      }
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      remote(literal(node.moduleSpecifier) ?? '')
    )
      findings.push('remote module');
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ['src', 'text', 'textContent'].includes(nameOf(node.left))
    ) {
      if (remote(literal(node.right) ?? '') && nameOf(node.left) === 'src')
        findings.push('remote resource assignment: review executable loading');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...new Set(findings)];
}

export async function scanProduction(directory) {
  const root = resolve(directory);
  const issues = [];
  const files = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) await walk(full);
      else files.push(full);
    }
  }
  await walk(root);
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3) issues.push('manifest must use MV3');
  const csp = manifest.content_security_policy?.extension_pages;
  if (
    csp &&
    (/unsafe-|https?:|\*/i.test(csp) || !/script-src\s+'self'/i.test(csp) || !/object-src\s+'self'/i.test(csp))
  )
    issues.push('unsafe extension CSP');
  const required = [
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'THIRD_PARTY_LICENSES.txt',
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...(manifest.content_scripts ?? []).flatMap(item => item.js ?? []),
  ].filter(Boolean);
  if (manifest.default_locale) required.push(`_locales/${manifest.default_locale}/messages.json`);
  for (const file of required) {
    try {
      await access(join(root, file));
    } catch {
      issues.push(`missing package file: ${file}`);
    }
  }
  for (const item of [...(manifest.content_scripts ?? []), ...(manifest.web_accessible_resources ?? [])]) {
    if ((item.matches ?? []).some(value => ['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*'].includes(value)))
      issues.push('unrestricted page injection/resource access');
  }
  for (const resource of manifest.web_accessible_resources ?? []) {
    if ((resource.matches ?? []).some(pattern => !/^[^:]+:\/\/[^/]+\/\*$/.test(pattern)))
      issues.push('invalid web-accessible resource origin pattern');
  }
  for (const file of files) {
    const name = relative(root, file);
    if (/\.map$|(?:^|\/)(?:refresh|hmr)[^/]*\.js$|(?:^|\/)(?:tests?|node_modules)\//i.test(name))
      issues.push(`development artifact: ${name}`);
    if (/\.(?:js|mjs|cjs)$/.test(name)) {
      const source = await readFile(file, 'utf8');
      issues.push(...inspectJavaScript(source, name).map(issue => `${name}: ${issue}`));
      if (/__HMR_ID|@vite\/client|localhost:8081/.test(source)) issues.push(`${name}: HMR runtime`);
    }
    if (/\.html$/.test(name)) {
      const html = await readFile(file, 'utf8');
      if (/<script[^>]*>(?!\s*<\/script>)[\s\S]*?\S[\s\S]*?<\/script>/i.test(html))
        issues.push(`${name}: inline script`);
      if (/<script[^>]+src\s*=\s*["'](?:https?:)?\/\//i.test(html) || /\bon\w+\s*=/i.test(html))
        issues.push(`${name}: remote script or inline handler`);
      for (const match of html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)) {
        try {
          await access(resolve(file, '..', match[1]));
        } catch {
          issues.push(`${name}: missing script ${match[1]}`);
        }
      }
    }
  }
  return { issues, scripts: files.filter(file => /\.(?:js|mjs|cjs)$/.test(file)).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await scanProduction(process.argv[2] ?? 'dist');
  if (result.issues.length) {
    console.error(result.issues.join('\n'));
    process.exitCode = 1;
  } else console.log(`MV3 production check passed: ${result.scripts} scripts, manifest and package inventory.`);
}
