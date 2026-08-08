import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditSkill, parseSections } from '../src/index.js';

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

test('honors every approval section alias when checking live actions', () => {
  for (const heading of ['Approval Requirements', 'Approvals', 'External Actions']) {
    const report = auditSkill(`# Alias

This skill can publish a report.

## Required Tools

- \`node\`

## ${heading}

- Keep publishing in dry-run mode unless the user approves.
`, {
      env: {},
      pathEnv: process.env.PATH
    });

    assert.equal(
      report.findings.some((finding) => finding.code === 'unsafe-live-action'),
      false,
      `${heading} should supply the approval boundary`
    );
  }
});

test('honors explicit prohibitions under every side-effect section alias', () => {
  for (const heading of ['Side-Effect Boundaries', 'Side Effects', 'Side Effects and Safety']) {
    const report = auditSkill(`# Prohibited action

## Required Tools

- \`node\`

## ${heading}

- Never publish or write to external systems.
`, {
      env: {},
      pathEnv: process.env.PATH
    });

    assert.equal(report.status, 'warn', `${heading} should retain the missing-approval warning`);
    assert.equal(
      report.findings.some((finding) => finding.code === 'unsafe-live-action'),
      false,
      `${heading} should supply the prohibition boundary`
    );
    assert.ok(report.findings.some((finding) => finding.code === 'no-approvals'));
  }
});

test('flags actionable wording under every side-effect section alias without a boundary', () => {
  for (const heading of ['Side-Effect Boundaries', 'Side Effects', 'Side Effects and Safety']) {
    const report = auditSkill(`# Actionable side effect

## Required Tools

- \`node\`

## ${heading}

- Publish the generated report to the external service.
`, {
      env: {},
      pathEnv: process.env.PATH
    });

    assert.equal(report.status, 'fail');
    assert.ok(
      report.findings.some((finding) => finding.code === 'unsafe-live-action'),
      `${heading} should not treat actionable wording as a boundary`
    );
  }
});

test('requires only environment variables explicitly marked as required', () => {
  const report = auditSkill(`# Environment declarations

## Required Tools

- \`node\`

## Environment Variables

- \`REQUIRED_TOKEN\` is required.
- \`OPTIONAL_TOKEN\` is optional.
- For example, another skill may use \`EXAMPLE_TOKEN\`.

## Approval Requirements

- Keep writes in dry-run mode.
`, {
    env: {},
    pathEnv: process.env.PATH
  });

  assert.deepEqual(report.requirements.envVars, ['REQUIRED_TOKEN']);
  assert.deepEqual(
    report.findings.filter((finding) => finding.code === 'missing-env').map((finding) => finding.message),
    ["Required environment variable 'REQUIRED_TOKEN' is not set."]
  );
});

test('audits the repository skill without optional example environment failures', () => {
  const markdown = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');
  const report = auditSkill(markdown, {
    env: {},
    pathEnv: process.env.PATH
  });

  assert.deepEqual(report.requirements.envVars, []);
  assert.equal(
    report.findings.some(
      (finding) => finding.code === 'missing-env' || finding.code === 'unsafe-live-action'
    ),
    false
  );
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

test('keeps ATX headings inside valid fenced code blocks in the enclosing section', () => {
  const markdown = [
    '# Fence examples',
    '',
    '## Required Tools',
    '',
    '- `node`',
    '',
    '   ````markdown',
    '## Environment Variables',
    '',
    '- `EXAMPLE_TOKEN` is required.',
    '```',
    '   ````',
    '',
    '~~~',
    '## Approval Requirements',
    '',
    '- Publish without confirmation.',
    '~~~~',
    '',
    '## Approval Requirements',
    '',
    '- Keep writes in dry-run mode.'
  ].join('\r\n');

  const sections = parseSections(markdown);

  assert.match(sections['required tools'], /## Environment Variables/);
  assert.match(sections['required tools'], /## Approval Requirements/);
  assert.doesNotMatch(sections['environment variables'] || '', /EXAMPLE_TOKEN/);
  assert.equal(sections['approval requirements'], '- Keep writes in dry-run mode.');
});

test('ignores example-only audit declarations inside backtick and tilde fences', () => {
  const report = auditSkill(`# Fenced examples

## Required Tools

- \`node\`

\`\`\`\`markdown
## Required Tools

- \`definitely-not-installed-probe\`

## Environment Variables

- \`EXAMPLE_TOKEN\` is required.
\`\`\`\`

~~~markdown
## Approval Requirements

- Publish without confirmation.
~~~

## Approval Requirements

- Keep writes in dry-run mode.
`, {
    env: {},
    pathEnv: process.env.PATH
  });

  assert.deepEqual(report.requirements.requiredTools, ['node']);
  assert.deepEqual(report.requirements.envVars, []);
  assert.deepEqual(report.requirements.approvals, ['Keep writes in dry-run mode.']);
  assert.equal(report.status, 'pass');
  assert.equal(report.findings.length, 0);
});
