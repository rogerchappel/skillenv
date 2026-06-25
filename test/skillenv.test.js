import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditSkill } from '../src/index.js';

function fixture(name) {
  return readFileSync(new URL(`./fixtures/${name}/SKILL.md`, import.meta.url), 'utf8');
}

test('passes a ready skill with declared tools and approvals', () => {
  const report = auditSkill(fixture('ready'), {
    env: { EXAMPLE_TOKEN: 'present' },
    pathEnv: process.env.PATH
  });

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requirements.envVars, ['EXAMPLE_TOKEN']);
  assert.match(report.requirements.requiredTools.join(','), /node/);
});

test('fails when a required environment variable is missing', () => {
  const report = auditSkill(fixture('missing-env'), {
    env: {},
    pathEnv: process.env.PATH
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.findings[0].code, 'missing-env');
});

test('flags live action wording without approval boundaries', () => {
  const report = auditSkill(fixture('unsafe-action'), {
    env: {},
    pathEnv: process.env.PATH
  });

  assert.equal(report.status, 'fail');
  assert.ok(report.findings.some((finding) => finding.code === 'unsafe-live-action'));
});
