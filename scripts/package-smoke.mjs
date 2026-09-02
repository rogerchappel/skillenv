import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporaryRoot = mkdtempSync(join(tmpdir(), 'skillenv-package-smoke-'));
let tarball;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
  }
  return result;
}

try {
  const packed = run('npm', ['pack', '--json', '--ignore-scripts']);
  const manifest = JSON.parse(packed.stdout);
  if (!Array.isArray(manifest) || manifest.length !== 1 || !manifest[0]?.filename) {
    throw new Error('npm pack did not report exactly one tarball');
  }
  tarball = resolve(root, manifest[0].filename);

  const project = join(temporaryRoot, 'consumer');
  run('npm', ['init', '--yes'], { cwd: temporaryRoot });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: temporaryRoot });

  const bin = process.platform === 'win32'
    ? join(temporaryRoot, 'node_modules', '.bin', 'skillenv.cmd')
    : join(temporaryRoot, 'node_modules', '.bin', 'skillenv');
  const help = run(bin, ['--help'], { cwd: temporaryRoot });
  if (!help.stdout.startsWith('Usage: skillenv')) throw new Error('installed CLI help was not usable');

  copyFileSync(join(root, 'test', 'fixtures', 'ready', 'SKILL.md'), project);
  const audit = run(bin, ['--json', project], {
    cwd: temporaryRoot,
    env: { EXAMPLE_TOKEN: 'present' }
  });
  const report = JSON.parse(audit.stdout);
  if (report.reports?.[0]?.status !== 'pass') throw new Error('installed CLI fixture audit did not pass');

  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  process.stdout.write(`Verified ${basename(tarball)} installs and runs skillenv ${packageJson.version}.\n`);
} finally {
  if (tarball) rmSync(tarball, { force: true });
  rmSync(temporaryRoot, { recursive: true, force: true });
}
