import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../bin/skillenv.js', import.meta.url));

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8'
  });
}

test('rejects an unknown option with usage', () => {
  const result = run(['--bogus', 'test/fixtures/ready/SKILL.md']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: unknown option --bogus\n\nUsage:/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('reports missing and unreadable input paths without a stack', () => {
  for (const input of ['missing.md', 'test/fixtures/ready']) {
    const result = run([input]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, new RegExp(`^Error: cannot read input ${input.replaceAll('/', '\\/')}:`));
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  }
});

test('prints help and treats no input as usage error', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage:/);
  assert.equal(help.stderr, '');

  const noInput = run([]);
  assert.equal(noInput.status, 2);
  assert.match(noInput.stderr, /^Usage:/);
});

test('strict mode promotes warnings to a failure', () => {
  const normal = run(['test/fixtures/warning/SKILL.md']);
  const strict = run(['--strict', 'test/fixtures/warning/SKILL.md']);
  assert.equal(normal.status, 0);
  assert.equal(strict.status, 1);
});

test('emits JSON from the package entrypoint', () => {
  const result = run(['--json', 'test/fixtures/ready/SKILL.md'], { EXAMPLE_TOKEN: 'present' });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).reports[0].status, 'pass');
});

test('indented requirement aliases affect JSON status and exit code', () => {
  const directory = mkdtempSync(join(tmpdir(), 'skillenv-indented-'));
  const input = join(directory, 'SKILL.md');

  try {
    writeFileSync(input, [
      '# Indented requirements',
      '   ## Required Tools',
      '- `definitely_missing_skillenv_tool`',
      '  ## Environment Variables',
      '- `MISSING_INDENTED_TOKEN` is required.',
      ' ## Approval Requirements',
      '- Confirm before publishing.',
      '   ## Side-effect boundaries',
      '- Write a local report.'
    ].join('\n'));
    const result = run(['--json', input]);
    const report = JSON.parse(result.stdout).reports[0];

    assert.equal(result.status, 1);
    assert.equal(report.status, 'fail');
    assert.deepEqual(report.requirements.requiredTools, ['definitely_missing_skillenv_tool']);
    assert.deepEqual(report.requirements.envVars, ['MISSING_INDENTED_TOKEN']);
    assert.deepEqual(report.requirements.approvals, ['Confirm before publishing.']);
    assert.deepEqual(report.requirements.sideEffects, ['Write a local report.']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('audits multiple input files', () => {
  const result = run([
    'test/fixtures/ready/SKILL.md',
    'test/fixtures/missing-env/SKILL.md'
  ], { EXAMPLE_TOKEN: 'present' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ready\/SKILL\.md/);
  assert.match(result.stdout, /missing-env\/SKILL\.md/);
});

test('exits 1 for inflected unbounded live-action prose', () => {
  const directory = mkdtempSync(join(tmpdir(), 'skillenv-live-action-'));
  const input = join(directory, 'SKILL.md');

  try {
    writeFileSync(input, '# Action\n\nThis skill publishes packages.\n\n## Required Tools\n\n- `node`\n');
    const result = run([input]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /skillenv FAIL/);
    assert.match(result.stdout, /ERROR unsafe-live-action:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('exits 1 and reports JSON failure for negated approval wording', () => {
  const directory = mkdtempSync(join(tmpdir(), 'skillenv-negated-approval-'));
  const input = join(directory, 'SKILL.md');

  try {
    writeFileSync(input, '# Action\n\nThis skill publishes packages.\n\n## Required Tools\n\n- `node`\n\n## Approval Requirements\n\n- No approval needed before publishing packages.\n');
    const result = run(['--json', input]);
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout).reports[0];
    assert.equal(report.status, 'fail');
    assert.ok(report.findings.some((finding) => finding.code === 'unsafe-live-action'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
