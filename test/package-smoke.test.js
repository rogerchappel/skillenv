import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('package smoke installs the generated tarball and invokes its CLI', { timeout: 30_000 }, () => {
  const result = spawnSync(process.execPath, ['scripts/package-smoke.mjs'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /^Verified skillenv-0\.1\.0\.tgz installs and runs skillenv 0\.1\.0\./m);
});
