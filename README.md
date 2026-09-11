# skillenv

`skillenv` is a local-first preflight CLI for agent `SKILL.md` files. It extracts declared tools, environment variables, inputs, approval requirements, and side-effect boundaries, then reports whether the current environment can run the skill safely.

## Quickstart

```sh
npm ci
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
- CommonMark ATX section headings from level 1 through level 6 are supported
  with zero to three leading spaces. Four-space-indented headings are treated
  as code rather than section declarations.
- Supported section aliases may use ATX headings or CommonMark setext level-1/level-2 headings. Declarations under nested ATX headings remain part of a supported parent section until the next heading of equal or higher rank. For example, `##### Publishing` beneath `#### Approval Requirements` can contain approval declarations; the next `####` section ends that scope. Setext-looking text inside fenced or four-space-indented code is ignored.
- ATX headings inside valid backtick or tilde fenced code blocks are treated as example content, not section declarations. Fenced examples are excluded from requirement and live-action checks.
- Backtick inline code spans, including spans delimited by multiple backticks, are excluded from live-action checks. Actionable prose before or after a span is still checked; malformed or unmatched backticks remain subject to the heuristic.
- Supported list markers are `-`, `*`, `+`, and ordered markers such as `1.` or `1)`.
- Only Markdown sections are audited; YAML frontmatter declarations are outside the supported format scope. A frontmatter block such as `prerequisites:\n  commands: [node]` (as used by Hermes-style skills) is ignored, and only section-based declarations are checked; see issue #19. The behavior is pinned by the `frontmatter-only` fixture test.
- Repeated supported sections are combined in document order, with duplicate declarations kept once.
- The CLI detects common live-action families and their usual inflections: pushing, publishing, deploying, deleting, merging, sending, charging, and transferring, plus writing to or posting to a destination, creating tickets, and updating CRM. For example, `publishes packages`, `sent email`, and `created tickets` are actionable; nouns such as `publisher metadata` and `ticket creator` are not.
- Live-action wording fails unless a supported approval, dry-run, prohibition, or read-only boundary is declared. A side-effect declaration that authorizes or describes performing the action is not itself a safety boundary.
- Negated or waived approval wording, such as `approval is not required`, `no approval needed`, or `without approval`, is not a safety boundary. An independently declared affirmative approval, dry-run, prohibition, or read-only boundary still applies.
- A prohibition in a side-effect section prevents the live-action error, but a skill without an approval section still receives the separate `no-approvals` warning.
- Required tool names should be written as list items, preferably with backticks.
- Required environment variables should be list items containing the variable name and the word `required`; optional variables and examples are ignored.

## Verify

```sh
npm test
npm run check
npm run smoke
npm run package:smoke
```

## Local Verification

```sh
npm ci
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```
