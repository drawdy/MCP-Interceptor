import { readFile } from 'node:fs/promises';

const backgroundPath = process.argv[2] ?? 'dist/background.js';
const manifestPath = process.argv[3] ?? 'dist/manifest.json';
const background = await readFile(backgroundPath, 'utf8');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const forbidden = [
  { label: 'new Function', pattern: /\bnew\s+Function\b/ },
  { label: 'eval()', pattern: /\beval\s*\(/ },
];
const matches = forbidden.filter(item => item.pattern.test(background)).map(item => item.label);
const csp = manifest.content_security_policy?.extension_pages ?? '';
if (/unsafe-eval/i.test(csp)) matches.push('unsafe-eval in extension_pages CSP');

if (matches.length > 0) {
  console.error('MV3 CSP check failed for ' + backgroundPath + ': ' + matches.join(', '));
  process.exitCode = 1;
} else {
  console.log('MV3 CSP check passed: ' + backgroundPath + ' contains no eval/new Function and CSP is strict.');
}
