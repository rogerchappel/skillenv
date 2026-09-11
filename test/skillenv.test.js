import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditSkill, parseSections } from '../src/index.js';

test('setext section aliases match ATX behavior with LF and CRLF', () => {
  const atx = `# Skill\n\n## Required Tools\n\n- node\n\n## Environment Variables\n\n- API_URL (required)\n\n## Inputs\n\n- repository\n\n## Approval Requirements\n\n- Confirm before publishing.\n\n## Side Effects\n\n- Publishes a package.`;
  const setext = atx
    .replace('# Skill', 'Skill\n=====')
    .replace(/^## (Required Tools|Environment Variables|Inputs|Approval Requirements|Side Effects)$/gm, '$1\n---');
  for (const newline of ['\n', '\r\n']) {
    const options = { pathEnv: process.env.PATH, env: { API_URL: 'test' } };
    assert.deepEqual(
      auditSkill(setext.replaceAll('\n', newline), options),
      auditSkill(atx.replaceAll('\n', newline), options)
    );
  }
});

test('setext-looking text in fenced and indented code is ignored', () => {
  const sections = parseSections('```md\nRequired Tools\n---\n```\n\n    Approval Requirements\n    ---');
  assert.equal(sections['required tools'], undefined);
  assert.equal(sections['approval requirements'], undefined);
});

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

test('treats frontmatter-only tool declarations as out of scope (issue #19)', () => {
  // Pins the documented behavior: a `prerequisites.commands` entry in YAML
  // frontmatter is not parsed, so the skill yields the no-required-tools
  // warning. Any future decision to audit frontmatter must change this test
  // deliberately (see README Limitations).
  const report = auditSkill(fixture('frontmatter-only'), {
    env: {},
    pathEnv: process.env.PATH
  });

  assert.equal(report.status, 'warn');
  assert.deepEqual(report.requirements.requiredTools, []);
  const warning = report.findings.find((finding) => finding.code === 'no-required-tools');
  assert.ok(warning, 'expected a no-required-tools finding');
  assert.equal(warning.level, 'warn');
});

test('does not treat negated or waived approval wording as a safety boundary', () => {
  const declarations = [
    'Approval is not required before publishing packages.',
    'No approval needed before publishing packages.',
    'Explicit consent is waived for publishing packages.',
    'Publishing proceeds without approval.',
    'Do not approve package publishing.'
  ];

  for (const declaration of declarations) {
    const report = auditSkill(`# Action\n\nThis skill publishes packages.\n\n## Required Tools\n\n- \`node\`\n\n## Approval Requirements\n\n- ${declaration}`, {
      pathEnv: process.env.PATH
    });
    assert.equal(report.status, 'fail', declaration);
    assert.ok(report.findings.some((finding) => finding.code === 'unsafe-live-action'), declaration);
  }
});

test('retains affirmative boundaries in mixed and repeated declarations', () => {
  const cases = [
    ['Approval is not required for reads.', 'Confirm before publishing packages.'],
    ['No approval needed for local inspection; confirm before publishing packages.'],
    ['Approval is required before publishing.', 'Approval is not required for reads.'],
    ['Keep publishing in dry-run mode.', 'No approval needed for reads.'],
    ['Publishing is read-only by default.', 'Approval is waived for inspection.']
  ];

  for (const declarations of cases) {
    const list = declarations.map((declaration) => `- ${declaration}`).join('\n');
    const report = auditSkill(`# Action\n\nThis skill publishes packages.\n\n## Required Tools\n\n- \`node\`\n\n## Approval Requirements\n\n${list}`, {
      pathEnv: process.env.PATH
    });
    assert.equal(report.findings.some((finding) => finding.code === 'unsafe-live-action'), false, declarations.join(' | '));
  }
});

test('flags inflected common live-action families without matching unrelated words', () => {
  const actionable = [
    'publishes packages', 'deployed releases', 'deleting files', 'merges pull requests',
    'sent email', 'charges cards', 'transferred funds', 'wrote to disk',
    'posting to Slack', 'created tickets', 'updates CRM'
  ];

  for (const prose of actionable) {
    const report = auditSkill(`# Action\n\nThis skill ${prose}.\n\n## Required Tools\n\n- \`node\``, {
      env: {}, pathEnv: process.env.PATH
    });
    assert.equal(report.status, 'fail', prose);
    assert.ok(report.findings.some((finding) => finding.code === 'unsafe-live-action'), prose);
  }

  for (const prose of ['publisher metadata', 'deployment notes', 'file merger', 'email sender', 'ticket creator']) {
    const report = auditSkill(`# Description\n\nThis skill documents ${prose}.\n\n## Required Tools\n\n- \`node\``, {
      env: {}, pathEnv: process.env.PATH
    });
    assert.equal(report.status, 'warn', prose);
    assert.equal(report.findings.some((finding) => finding.code === 'unsafe-live-action'), false, prose);
  }
});

test('accepts inflected live actions with supported safety boundaries', () => {
  const cases = [
    ['Approval Requirements', 'Confirm before publishing packages.'],
    ['Side-Effect Boundaries', 'Never delete files.'],
    ['Side Effects', 'Read-only by default when updating CRM.']
  ];

  for (const [heading, boundary] of cases) {
    const report = auditSkill(`# Bounded action\n\nThis skill publishes packages.\n\n## Required Tools\n\n- \`node\`\n\n## ${heading}\n\n- ${boundary}`, {
      env: {}, pathEnv: process.env.PATH
    });
    assert.equal(report.findings.some((finding) => finding.code === 'unsafe-live-action'), false);
  }
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

test('parses supported ATX sections indented up to three spaces', () => {
  const markdown = [
    '# Indented sections',
    '',
    ' ## Required Tools',
    '',
    '- `node`',
    '',
    '  ## Environment Variables',
    '',
    '- `INDENTED_TOKEN` is required.',
    '',
    '   ## Approvals',
    '',
    '- Confirm before publishing.',
    '',
    '   ## Side Effects',
    '',
    '- Write a local report.'
  ].join('\r\n');

  const report = auditSkill(markdown, {
    env: { INDENTED_TOKEN: 'present' },
    pathEnv: process.env.PATH
  });

  assert.deepEqual(report.requirements.requiredTools, ['node']);
  assert.deepEqual(report.requirements.envVars, ['INDENTED_TOKEN']);
  assert.deepEqual(report.requirements.approvals, ['Confirm before publishing.']);
  assert.deepEqual(report.requirements.sideEffects, ['Write a local report.']);
});

test('does not parse four-space or fenced ATX examples as sections', () => {
  const sections = parseSections([
    '## Required Tools',
    '- `node`',
    '    ## Environment Variables',
    '    - `CODE_TOKEN` is required.',
    '```markdown',
    '   ## Inputs',
    '- example input',
    '```'
  ].join('\n'));

  assert.match(sections['required tools'], /## Environment Variables/);
  assert.match(sections['required tools'], /## Inputs/);
  assert.equal(sections['environment variables'], undefined);
  assert.equal(sections.inputs, undefined);
});

test('inherits approval and side-effect sections through nested headings for LF input', () => {
  const report = auditSkill(`# Nested boundaries

This skill can publish a report and write to the output directory.

## Required Tools

### Runtime

- \`node\`

## Approval Requirements

### Publishing

- Confirm before publishing.

## Side-Effect Boundaries

### Local output

- Do not write without approval.

## Examples

### Unsafe example

- Publish without confirmation.
`, { pathEnv: process.env.PATH });

  assert.deepEqual(report.requirements.requiredTools, ['node']);
  assert.deepEqual(report.requirements.approvals, ['Confirm before publishing.']);
  assert.deepEqual(report.requirements.sideEffects, ['Do not write without approval.']);
  assert.equal(report.status, 'pass');
});

test('inherits requirement sections through nested headings for CRLF input', () => {
  const markdown = [
    '# Nested requirements',
    '',
    '## Environment Variables',
    '',
    '### Authentication',
    '',
    '- `PRIMARY_TOKEN` is required.',
    '',
    '```markdown',
    '## Approval Requirements',
    '### Example only',
    '- Publish without confirmation.',
    '```',
    '',
    '## Inputs',
    '',
    '### Files',
    '',
    '- repository',
    '',
    '## Notes',
    '',
    '### Not an input',
    '',
    '- ignored peer content'
  ].join('\r\n');

  const report = auditSkill(markdown, {
    env: { PRIMARY_TOKEN: 'present' },
    pathEnv: process.env.PATH
  });

  assert.deepEqual(report.requirements.envVars, ['PRIMARY_TOKEN']);
  assert.deepEqual(report.requirements.inputs, ['repository']);
  assert.deepEqual(report.requirements.approvals, []);
  assert.equal(report.findings.some((finding) => finding.code === 'unsafe-live-action'), false);
});

test('parses supported sections and nested boundaries through ATX level 6', () => {
  const report = auditSkill(`# Deep sections

###### Required Tools

- \`node\`

##### Environment Variables

- \`DEEP_TOKEN\` is required.

#### Approval Requirements

###### Publishing

- Keep writes in dry-run mode.
`, {
    env: { DEEP_TOKEN: 'present' },
    pathEnv: process.env.PATH
  });

  assert.deepEqual(report.requirements.requiredTools, ['node']);
  assert.deepEqual(report.requirements.envVars, ['DEEP_TOKEN']);
  assert.deepEqual(report.requirements.approvals, ['Keep writes in dry-run mode.']);
  assert.equal(report.status, 'pass');
});

test('preserves deep parent scope until a peer or higher heading for CRLF input', () => {
  const markdown = [
    '#### Environment Variables',
    '',
    '##### Runtime',
    '',
    '- `FIRST_TOKEN` is required.',
    '',
    '###### Details',
    '',
    '- `SECOND_TOKEN` is required.',
    '',
    '##### Notes',
    '',
    '- `THIRD_TOKEN` is required.',
    '',
    '#### Inputs',
    '',
    '##### Files',
    '',
    '- repository',
    '',
    '### Notes',
    '',
    '- ignored peer content'
  ].join('\r\n');

  const sections = parseSections(markdown);

  assert.match(sections['environment variables'], /FIRST_TOKEN/);
  assert.match(sections['environment variables'], /SECOND_TOKEN/);
  assert.match(sections['environment variables'], /THIRD_TOKEN/);
  assert.equal(sections.inputs, '- repository');
  assert.equal(sections.notes, '- ignored peer content');
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

test('ignores live-action words inside inline code spans', () => {
  const report = auditSkill(`# Inline literals

The commands \`publish\` and \`\`deploy --dry-run\`\` are parser examples.

## Required Tools

- \`node\`
`, { pathEnv: process.env.PATH });

  assert.equal(report.status, 'warn');
  assert.equal(report.findings.some((finding) => finding.code === 'unsafe-live-action'), false);
});

test('detects live-action prose adjacent to inline code', () => {
  const report = auditSkill(`# Inline literals

Use \`npm\` to publish the package.

## Required Tools

- \`node\`
`, { pathEnv: process.env.PATH });

  assert.equal(report.status, 'fail');
  assert.equal(report.findings.some((finding) => finding.code === 'unsafe-live-action'), true);
});

test('continues detecting live-action prose around fenced and inline examples', () => {
  const report = auditSkill(`# Mixed examples

\`\`\`sh
publish --example
\`\`\`

The literal \`deploy\` is harmless, but do not merge this change automatically.

## Required Tools

- \`node\`
`, { pathEnv: process.env.PATH });

  assert.equal(report.status, 'fail');
  assert.equal(report.findings.some((finding) => finding.code === 'unsafe-live-action'), true);
});
