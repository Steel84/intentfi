import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'tests', 'scripts'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if ([...extensions].some(ext => path.endsWith(ext))) files.push(path);
  }
}
roots.forEach(root => walk(root));
const issues = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) issues.push(`${file}:${index + 1}: trailing whitespace`);
    if (/\t/.test(line)) issues.push(`${file}:${index + 1}: tabs are not allowed`);
  });
}
if (issues.length) { console.error(issues.join('\n')); process.exit(1); }
console.log(`style check passed for ${files.length} source files`);
