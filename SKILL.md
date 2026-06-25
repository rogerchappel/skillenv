# skillenv

Use this skill when reviewing an agent `SKILL.md` before sharing, installing, or running it in a new environment.

## Required Inputs

- One or more local `SKILL.md` paths.
- The current shell environment for PATH and environment variable presence.

## Required Tools

- `node`
- `npm`

## Optional Tools

- `gh` for opening release candidate pull requests.

## Environment Variables

- No secret values are required.
- Skills under review may declare their own variables, such as `GITHUB_TOKEN`.

## Side-Effect Boundaries

- Read local Markdown files only.
- Do not install tools or packages for the user.
- Do not call external services.
- Do not print secret values.

## Approval Requirements

- Ask for explicit approval before running commands that mutate a repository or external account.
- Keep connector, publishing, deploy, and send actions in dry-run mode unless the user approves a live write.

## Examples

- Run `node bin/skillenv.js SKILL.md` before publishing a skill.
- Run `node bin/skillenv.js --json skills/*/SKILL.md` to collect reports for automation.

## Validation Workflow

- Run `npm test`.
- Run `npm run check`.
- Run `npm run smoke`.
- Run `npm run validate`.

## Limitations

- This skill is a preflight helper, not a full security audit.
- It cannot validate that credentials are correct.
