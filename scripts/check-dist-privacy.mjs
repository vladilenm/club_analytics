import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const buildDirectory = resolve('dist');
const violations = [];

const contentRules = [
  {
    name: 'real source filename fragment',
    test: (content) => content.includes('members ai_wont_replace_bot'),
  },
  {
    name: 'old embedded-data marker',
    test: (content) => content.includes('const D={"rows"'),
  },
  {
    name: 'phone-number-like token',
    test: (content) => /\+\d{10,15}/.test(content),
  },
];

function relativeBuildPath(filePath) {
  return relative(buildDirectory, filePath).replaceAll('\\', '/');
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }

  return files;
}

function isText(buffer) {
  return !buffer.subarray(0, 8_192).includes(0);
}

let files;
try {
  files = await collectFiles(buildDirectory);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    console.error('Privacy check failed: dist/ does not exist');
    process.exit(1);
  }
  throw error;
}

for (const filePath of files) {
  const buildPath = relativeBuildPath(filePath);
  if (buildPath.toLowerCase().endsWith('.csv')) {
    violations.push({ rule: 'CSV file', path: buildPath });
    continue;
  }

  const buffer = await readFile(filePath);
  if (!isText(buffer)) continue;

  const content = buffer.toString('utf8');
  for (const rule of contentRules) {
    if (rule.test(content)) violations.push({ rule: rule.name, path: buildPath });
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`Privacy rule "${violation.rule}" matched in ${violation.path}`);
  }
  process.exit(1);
}

console.log('Production build contains no member dataset');
