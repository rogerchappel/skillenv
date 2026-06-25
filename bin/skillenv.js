#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditSkill, formatTextReport } from '../src/index.js';

function usage() {
  return `Usage: skillenv [--json] [--strict] <SKILL.md...>

Options:
  --json     Emit JSON instead of text
  --strict   Treat warnings as failures
  --help     Show this help`;
}

const args = process.argv.slice(2);
const json = args.includes('--json');
const strict = args.includes('--strict');
const help = args.includes('--help') || args.includes('-h');
const paths = args.filter((arg) => !arg.startsWith('--'));

if (help) {
  console.log(usage());
  process.exit(0);
}

if (paths.length === 0) {
  console.error(usage());
  process.exit(2);
}

const reports = paths.map((inputPath) => {
  const filePath = resolve(inputPath);
  const body = readFileSync(filePath, 'utf8');
  return auditSkill(body, { filePath, env: process.env });
});

if (json) {
  console.log(JSON.stringify({ reports }, null, 2));
} else {
  console.log(reports.map(formatTextReport).join('\n\n'));
}

const hasFailures = reports.some((report) => report.status === 'fail');
const hasWarnings = reports.some((report) => report.status === 'warn');
process.exitCode = hasFailures || (strict && hasWarnings) ? 1 : 0;
