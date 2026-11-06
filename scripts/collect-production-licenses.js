import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Include a conservative superset of installed dependencies: some bundled libraries are
// declared as build dependencies in workspace packages. No dependency code is packaged here.
const blocks = [];
async function collectPackage(directory) {
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const notices = entries.filter(
    entry => entry.isFile() && /^(?:licen[sc]e|copying|notice|copyright)(?:[.-]|$)/i.test(entry.name),
  );
  const texts = await Promise.all(
    notices.map(async entry => `${entry.name}:\n${await readFile(join(directory, entry.name), 'utf8')}`),
  );
  if (!texts.length) {
    // Some npm distributions keep the actual copyright/license only in README.
    const readme = entries.find(entry => entry.isFile() && /^readme(?:\.|$)/i.test(entry.name));
    if (readme) {
      const source = await readFile(join(directory, readme.name), 'utf8');
      const section = source.search(/^#{1,6}\s+licen[sc]e\s*$/im);
      if (
        section >= 0 &&
        /permission is hereby granted|redistribution and use|public domain/i.test(source.slice(section))
      )
        texts.push(`${readme.name} license section:\n${source.slice(section)}`);
    }
    if (!texts.length) {
      const supplemental = join('third-party/licenses', `${pkg.name.replaceAll('/', '__')}@${pkg.version}.txt`);
      try {
        texts.push(await readFile(supplemental, 'utf8'));
      } catch {
        /* Metadata-only build dependencies remain explicit below. */
      }
    }
  }
  blocks.push({
    key: `${pkg.name}@${pkg.version}`,
    text: `${pkg.name}@${pkg.version}\nDeclared license: ${JSON.stringify(pkg.license ?? pkg.licenses ?? 'Not declared')}\n${texts.join('\n\n') || 'No separate license file distributed; consult package metadata and source before release.'}`,
  });
}
for (const entry of await readdir('node_modules/.pnpm', { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'node_modules') continue;
  const modules = join('node_modules/.pnpm', entry.name, 'node_modules');
  let children;
  try {
    children = await readdir(modules, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const child of children) {
    if (!child.isDirectory()) continue;
    const directory = join(modules, child.name);
    if (child.name.startsWith('@')) {
      for (const scoped of await readdir(directory, { withFileTypes: true }))
        if (scoped.isDirectory()) await collectPackage(join(directory, scoped.name));
    } else await collectPackage(directory);
  }
}
if (!blocks.length)
  throw new Error('No installed dependency licenses found. Run pnpm install --frozen-lockfile first.');
const unique = new Map(blocks.map(block => [block.key, block.text]));
await writeFile(
  'THIRD_PARTY_LICENSES.txt',
  'MCP-Interceptor dependency license inventory (conservative build-time superset)\nGenerated from installed lockfile dependencies; does not distribute dependency source.\n\n' +
    [...unique]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, text]) => text)
      .join('\n\n========================================\n\n') +
    '\n',
);
console.log(`Collected ${unique.size} dependency license notices.`);
