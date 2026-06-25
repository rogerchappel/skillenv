# Orchestration

## Inputs

- Local paths to one or more `SKILL.md` files.
- Current process `PATH`.
- Current process environment variable names.

## Flow

1. Read skill Markdown from disk.
2. Parse common headings into normalized sections.
3. Extract requirement lists and environment variable names.
4. Check required commands on `PATH`.
5. Check required environment variable names are present.
6. Flag live-action language that lacks approval or dry-run boundaries.
7. Emit text or JSON and set the exit code.

## Side Effects

- Reads local files.
- Writes reports to stdout and errors to stderr.
- Does not write files, install packages, or call external services.

## Failure Modes

- Exit `2` for CLI usage errors.
- Exit `1` for failed preflight findings.
- Exit `1` in strict mode when warnings are present.
