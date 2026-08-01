# skillenv

`skillenv` is a local-first preflight CLI for agent `SKILL.md` files. It extracts declared tools, environment variables, inputs, approval requirements, and side-effect boundaries, then reports whether the current environment can run the skill safely.

## Quickstart

```sh
npm install
npm run smoke
node bin/skillenv.js --json test/fixtures/ready/SKILL.md
```

Install the CLI from npm after release:

```sh
npm install -g skillenv
skillenv --json path/to/SKILL.md
```

## CLI

```sh
skillenv [--json] [--strict] <SKILL.md...>
```

- `--json` emits structured reports for automation.
- `--strict` exits non-zero on warnings as well as errors.
- Without flags, reports are text-first and suitable for pull request comments.

`--help` (or `-h`) prints usage and exits 0. Invoking the CLI without an input,
passing an unknown option, or naming an unreadable input prints a concise error
and exits 2. Completed audits exit 1 when a report fails, or when `--strict`
promotes a warning to failure; otherwise they exit 0. Diagnostics are written to
standard error, while reports and help are written to standard output.

## What It Checks

- Required tools declared under `Required tools`, `Tools`, or `Dependencies`.
- Environment variables explicitly marked `required` under `Environment variables`, `Env vars`, or `Configuration`.
- Approval and dry-run language under `Approval requirements`, `Approvals`, or `External actions`.
- Explicit prohibitions and read-only boundaries under `Side-effect boundaries`, `Side effects`, or `Side effects and safety`.
- Missing required tool declarations.
- Missing approval declarations.

## Safety Notes

`skillenv` never reads secret values, validates credentials, installs tools, or calls external services. It only checks whether environment variable names exist and whether declared command names are present on `PATH`.

## Limitations

- Section extraction is intentionally conservative and Markdown-only.
- Supported list markers are `-`, `*`, `+`, and ordered markers such as `1.` or `1)`.
- Repeated supported sections are combined in document order, with duplicate declarations kept once.
- The CLI detects common live-action verbs but cannot prove a skill is safe.
- Live-action wording fails unless a supported approval, dry-run, prohibition, or read-only boundary is declared. A side-effect declaration that authorizes or describes performing the action is not itself a safety boundary.
- A prohibition in a side-effect section prevents the live-action error, but a skill without an approval section still receives the separate `no-approvals` warning.
- Required tool names should be written as list items, preferably with backticks.
- Required environment variables should be list items containing the variable name and the word `required`; optional variables and examples are ignored.

## Verify

```sh
npm test
npm run check
npm run smoke
npm pack --dry-run
```

## Local Verification

```sh
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```
