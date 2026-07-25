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

test('accumulates repeated section aliases and extracts supported list markers', () => {
  const report = auditSkill(fixture('list-syntax'), {
    env: { PRIMARY_TOKEN: 'present', SECONDARY_TOKEN: 'present' },
    pathEnv: process.env.PATH
  });

  assert.deepEqual(report.requirements.requiredTools, ['node', 'git', 'npm']);
  assert.deepEqual(report.requirements.envVars, ['PRIMARY_TOKEN', 'SECONDARY_TOKEN']);
  assert.deepEqual(report.requirements.inputs, ['repository', 'output directory']);
  assert.deepEqual(report.requirements.approvals, [
    'Confirm before publishing.',
    'Keep writes in dry-run mode by default.'
  ]);
  assert.deepEqual(report.requirements.sideEffects, [
    'Read repository files.',
    'Write a local report.'
  ]);
});
