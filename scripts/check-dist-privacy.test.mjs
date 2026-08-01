import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const scannerPath = fileURLToPath(new URL('./check-dist-privacy.mjs', import.meta.url));

async function runScanner(files = {}, { createDist = true } = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'privacy-canary-'));
  try {
    if (createDist) await mkdir(join(workspace, 'dist'));
    for (const [relativePath, content] of Object.entries(files)) {
      const target = join(workspace, 'dist', relativePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }

    try {
      const result = await execFileAsync(process.execPath, [scannerPath], { cwd: workspace });
      return { code: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      return {
        code: typeof error.code === 'number' ? error.code : 1,
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? '',
      };
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function expectViolation(result, rule, relativePath, privateToken = '') {
  assert.equal(result.code, 1);
  assert.match(result.stderr, new RegExp(`^Privacy rule "${rule}" matched in ${relativePath.replaceAll('.', '\\.')}$`, 'm'));
  if (privateToken) assert.equal(result.stderr.includes(privateToken), false);
}

test('rejects a missing production build', async () => {
  const result = await runScanner({}, { createDist: false });

  expectViolation(result, 'missing build directory', 'dist/');
});

const signatureCanaries = [
  {
    name: 'known source filename',
    rule: 'known source filename',
    path: 'assets/members ai_wont_replace_bot-2099.js',
    content: 'export const ready = true;',
  },
  {
    name: 'old embedded-data marker',
    rule: 'old embedded-data marker',
    path: 'assets/marker.js',
    content: 'const D={"rows"',
  },
  {
    name: 'CSV header row',
    rule: 'CSV-shaped member data',
    path: 'assets/header.js',
    content: 'USER_ID,registration,username,name,ref_link,phone,email,comment,active,plan,end_date,use_trial,recurrent,tags,pay_count,pay_last,pay_1st',
  },
  {
    name: 'normalized member object values',
    rule: 'normalized member object values',
    path: 'assets/snapshot.js',
    content: JSON.stringify({
      id: 'fictional-privacy-id',
      name: 'Fictional Privacy Member',
      telegram: '',
      phone: '',
      startedAt: '2099-01-01T00:00:00.000Z',
      endsAt: '2099-02-01T00:00:00.000Z',
      startedAtMs: 4070908800000,
      endsAtMs: 4073587200000,
      status: 'active',
      plan: 'fictional-plan',
      paymentCount: 1,
      lifetimeDays: 31,
      recurrent: false,
    }),
  },
  {
    name: 'email address',
    rule: 'email address',
    path: 'assets/email.js',
    content: 'fictional.person@example.test',
  },
  {
    name: 'Telegram handle',
    rule: 'Telegram handle',
    path: 'assets/telegram.js',
    content: '@fictional_handle',
  },
  {
    name: 'contiguous phone',
    rule: 'contiguous phone number',
    path: 'assets/phone.js',
    content: '+70000000001',
  },
  {
    name: 'formatted phone',
    rule: 'formatted phone number',
    path: 'assets/formatted-phone.js',
    content: '+7 (000) 000-00-02',
  },
];

for (const canary of signatureCanaries) {
  test(`rejects ${canary.name} without echoing its content`, async () => {
    const result = await runScanner({ [canary.path]: canary.content });

    expectViolation(result, canary.rule, canary.path, canary.content);
  });
}

for (const extension of ['csv', 'json', 'txt', 'tsv', 'ndjson']) {
  test(`rejects unexpected .${extension} member-data artifacts`, async () => {
    const relativePath = `assets/unexpected.${extension}`;
    const result = await runScanner({ [relativePath]: 'synthetic artifact canary' });

    expectViolation(result, 'unexpected member-data artifact', relativePath, 'synthetic artifact canary');
  });
}

test('does not mistake parser constants or member-construction source for data', async () => {
  const safeSource = [
    'const requiredHeaders = ["USER_ID", "registration", "username", "name", "phone", "email", "active", "plan", "end_date", "pay_count", "pay_1st"];',
    'members.push({ id, name, telegram, phone, startedAt: parsedStart.iso, endsAt: parsedEnd.iso, status, plan, paymentCount, lifetimeDays, recurrent });',
  ].join('\n');
  const result = await runScanner({ 'assets/app.js': safeSource });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /no known member-data signatures/i);
  assert.equal(result.stderr, '');
});
