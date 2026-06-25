# skillenv

`skillenv` is a local-first preflight CLI for agent `SKILL.md` files. It extracts declared tools, environment variables, inputs, approval requirements, and side-effect boundaries, then reports whether the current environment can run the skill safely.

## Quickstart

```sh
npm install
npm run smoke
node bin/skillenv.js --json test/fixtures/ready/SKILL.md
```

## CLI

```sh
skillenv [--json] [--strict] <SKILL.md...>
```

- `--json` emits structured reports for automation.
- `--strict` exits non-zero on warnings as well as errors.
- Without flags, reports are text-first and suitable for pull request comments.

## What It Checks

- Required tools declared under `Required tools`, `Tools`, or `Dependencies`.
- Environment variables declared under `Environment variables`, `Env vars`, or `Configuration`.
- Approval and dry-run language for live external actions.
- Missing required tool declarations.
- Missing approval declarations.

## Safety Notes

`skillenv` never reads secret values, validates credentials, installs tools, or calls external services. It only checks whether environment variable names exist and whether declared command names are present on `PATH`.

## Limitations

- Section extraction is intentionally conservative and Markdown-only.
- The CLI detects common live-action verbs but cannot prove a skill is safe.
- Required tool names should be written as list items, preferably with backticks.
