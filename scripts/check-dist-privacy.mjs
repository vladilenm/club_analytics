import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

const buildDirectory = resolve('dist');
const violations = [];
const memberArtifactExtensions = new Set(['.csv', '.json', '.txt', '.tsv', '.ndjson']);
const requiredHeaders = new Set([
  'USER_ID',
  'registration',
  'username',
  'name',
  'ref_link',
  'phone',
  'email',
  'comment',
  'active',
  'plan',
  'end_date',
  'use_trial',
  'recurrent',
  'tags',
  'pay_count',
  'pay_last',
  'pay_1st',
]);

function hasCsvShapedMemberData(content) {
  return content.split(/\r?\n/).some((line) => {
    const normalizedLine = line.replace(/^\uFEFF/, '').trim();
    const delimiter = normalizedLine.includes('\t') ? '\t' : ',';
    const cells = normalizedLine.split(delimiter).map((cell) => cell.trim().replace(/^['"]|['"]$/g, ''));
    const headerHits = cells.filter((cell) => requiredHeaders.has(cell)).length;

    if (cells[0] === 'USER_ID' && headerHits >= 8) return true;
    if (cells.length < 8) return false;

    const dateCells = cells.filter((cell) => /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/.test(cell)).length;
    const hasStatus = cells.some((cell) => /^(?:0|1|active|churned)$/.test(cell));
    const hasPaymentCount = cells.some((cell) => /^[1-9]\d*$/.test(cell));
    return dateCells >= 2 && hasStatus && hasPaymentCount;
  });
}

function hasNormalizedMemberObjectValues(content) {
  const objectCandidates = content.match(/\{[^{}]{0,3000}\}/gs) ?? [];
  const key = (name) => `(?:["']?${name}["']?)\\s*:\\s*`;
  const literalRules = [
    new RegExp(`${key('id')}["'][^"'\\r\\n]+["']`),
    new RegExp(`${key('name')}["'][^"'\\r\\n]*["']`),
    new RegExp(`${key('startedAt')}["']\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z["']`),
    new RegExp(`${key('endsAt')}["']\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z["']`),
    new RegExp(`${key('startedAtMs')}\\d{10,16}(?!\\d)`),
    new RegExp(`${key('endsAtMs')}\\d{10,16}(?!\\d)`),
    new RegExp(`${key('status')}["'](?:active|churned)["']`),
    new RegExp(`${key('paymentCount')}[1-9]\\d*`),
    new RegExp(`${key('lifetimeDays')}\\d+`),
    new RegExp(`${key('recurrent')}(?:true|false)`),
  ];

  return objectCandidates.some((candidate) => literalRules.every((rule) => rule.test(candidate)));
}

function hasTelegramHandle(content) {
  const cssAtRules = new Set(['font', 'keyframes', 'layer', 'media', 'page', 'property', 'supports']);

  for (const match of content.matchAll(/@[A-Za-z][A-Za-z0-9_]{4,31}\b/g)) {
    const previousCharacter = match.index === 0 ? '' : content[match.index - 1];
    const followingCharacters = content.slice(match.index + match[0].length);
    if (previousCharacter && /[@\p{L}\p{N}._%+-]/u.test(previousCharacter)) continue;
    if (/^:\d+:\d+/.test(followingCharacters)) continue;
    if (cssAtRules.has(match[0].slice(1).toLowerCase())) continue;
    return true;
  }

  return false;
}

function hasFormattedPhoneNumber(content) {
  for (const match of content.matchAll(/\+[\d\s().-]{10,30}/g)) {
    const candidate = match[0];
    const digitCount = candidate.replace(/\D/g, '').length;
    if (digitCount >= 10 && digitCount <= 15 && /[\s().-]/.test(candidate)) return true;
  }

  return false;
}

const contentRules = [
  {
    name: 'known source filename',
    test: (content) => content.toLowerCase().includes('members ai_wont_replace_bot'),
  },
  {
    name: 'old embedded-data marker',
    test: (content) => content.includes('const D={"rows"'),
  },
  {
    name: 'CSV-shaped member data',
    test: hasCsvShapedMemberData,
  },
  {
    name: 'normalized member object values',
    test: hasNormalizedMemberObjectValues,
  },
  {
    name: 'email address',
    test: (content) => /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/i.test(content),
  },
  {
    name: 'Telegram handle',
    test: hasTelegramHandle,
  },
  {
    name: 'contiguous phone number',
    test: (content) => /\+\d{10,15}(?!\d)/.test(content),
  },
  {
    name: 'formatted phone number',
    test: hasFormattedPhoneNumber,
  },
];

function relativeBuildPath(filePath) {
  return relative(buildDirectory, filePath).replaceAll('\\', '/').replace(/[\r\n]/g, '?');
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
    console.error('Privacy rule "missing build directory" matched in dist/');
    process.exit(1);
  }
  throw error;
}

for (const filePath of files) {
  const buildPath = relativeBuildPath(filePath);
  const lowerBuildPath = buildPath.toLowerCase();

  if (lowerBuildPath.includes('members ai_wont_replace_bot')) {
    violations.push({ rule: 'known source filename', path: buildPath });
    continue;
  }
  if (memberArtifactExtensions.has(extname(lowerBuildPath))) {
    violations.push({ rule: 'unexpected member-data artifact', path: buildPath });
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

console.log('Production build contains no known member-data signatures');
