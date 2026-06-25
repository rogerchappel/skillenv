import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

const SECTION_ALIASES = {
  requiredTools: ['required tools', 'tools', 'dependencies'],
  optionalTools: ['optional tools'],
  environment: ['environment variables', 'env vars', 'configuration'],
  approvals: ['approval requirements', 'approvals', 'external actions'],
  sideEffects: ['side-effect boundaries', 'side effects', 'side effects and safety'],
  inputs: ['inputs', 'required inputs']
};

const LIVE_ACTION_PATTERN = /\b(push|publish|deploy|delete|merge|send|charge|transfer|write to|post to|create ticket|update crm)\b/i;
const APPROVAL_PATTERN = /\b(approval|approve|explicit consent|dry-run|dry run|confirm before|read-only by default)\b/i;

export function auditSkill(markdown, options = {}) {
  const sections = parseSections(markdown);
  const requirements = extractRequirements(sections);
  const findings = [];

  for (const tool of requirements.requiredTools) {
    if (!hasCommand(tool, options.pathEnv)) {
      findings.push({
        level: 'error',
        code: 'missing-tool',
        message: `Required tool '${tool}' was not found on PATH.`
      });
    }
  }

  for (const envName of requirements.envVars) {
    if (!options.env || !Object.prototype.hasOwnProperty.call(options.env, envName)) {
      findings.push({
        level: 'error',
        code: 'missing-env',
        message: `Required environment variable '${envName}' is not set.`
      });
    }
  }

  if (requirements.requiredTools.length === 0) {
    findings.push({
      level: 'warn',
      code: 'no-required-tools',
      message: 'No required tools were declared.'
    });
  }

  if (requirements.approvals.length === 0) {
    findings.push({
      level: 'warn',
      code: 'no-approvals',
      message: 'No approval requirements were declared.'
    });
  }

  const unsafeLiveAction = LIVE_ACTION_PATTERN.test(markdown) && !APPROVAL_PATTERN.test(sections.approvals || '');
  if (unsafeLiveAction) {
    findings.push({
      level: 'error',
      code: 'unsafe-live-action',
      message: 'Live-action wording appears without clear approval or dry-run boundaries.'
    });
  }

  const status = findings.some((finding) => finding.level === 'error')
    ? 'fail'
    : findings.some((finding) => finding.level === 'warn')
      ? 'warn'
      : 'pass';

  return {
    filePath: options.filePath || null,
    status,
    requirements,
    findings
  };
}

export function parseSections(markdown) {
  const sections = {};
  let current = 'preamble';
  sections[current] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (heading) {
      current = normalizeHeading(heading[1]);
      sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()])
  );
}

export function extractRequirements(sections) {
  const read = (name) => {
    const aliases = SECTION_ALIASES[name] || [name];
    const parts = aliases.map((alias) => sections[normalizeHeading(alias)]).filter(Boolean);
    return parts.join('\n');
  };

  return {
    requiredTools: unique(extractListItems(read('requiredTools')).map(cleanCommand).filter(Boolean)),
    optionalTools: unique(extractListItems(read('optionalTools')).map(cleanCommand).filter(Boolean)),
    envVars: unique(extractEnvVars(read('environment'))),
    inputs: extractListItems(read('inputs')),
    approvals: extractListItems(read('approvals')),
    sideEffects: extractListItems(read('sideEffects'))
  };
}

export function formatTextReport(report) {
  const lines = [
    `skillenv ${report.status.toUpperCase()} ${report.filePath || ''}`.trim(),
    `required tools: ${report.requirements.requiredTools.join(', ') || 'none declared'}`,
    `env vars: ${report.requirements.envVars.join(', ') || 'none declared'}`
  ];

  for (const finding of report.findings) {
    lines.push(`${finding.level.toUpperCase()} ${finding.code}: ${finding.message}`);
  }

  return lines.join('\n');
}

function normalizeHeading(value) {
  return value.toLowerCase().replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractListItems(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+(.*)$/)?.[1]?.trim())
    .filter(Boolean);
}

function extractEnvVars(text) {
  const names = new Set();
  for (const item of extractListItems(text)) {
    const match = item.match(/`?([A-Z][A-Z0-9_]{2,})`?/);
    if (match) names.add(match[1]);
  }
  return [...names];
}

function cleanCommand(value) {
  const match = value.match(/`([^`]+)`/);
  const raw = (match ? match[1] : value).trim();
  return raw.split(/\s+/)[0].replace(/[,:;.]+$/, '');
}

function hasCommand(command, pathEnv = process.env.PATH || '') {
  if (!command || command.includes('/')) return false;
  for (const pathPart of pathEnv.split(delimiter)) {
    if (!pathPart) continue;
    try {
      accessSync(join(pathPart, command), constants.X_OK);
      return true;
    } catch {
      // Keep scanning PATH.
    }
  }
  return false;
}

function unique(values) {
  return [...new Set(values)];
}
