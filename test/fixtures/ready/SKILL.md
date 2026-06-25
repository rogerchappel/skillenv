# Ready Skill

Use this skill when a maintainer needs to inspect a repository and prepare a dry-run action plan.

## Required Tools

- `node`

## Environment Variables

- `EXAMPLE_TOKEN` is required by the downstream skill, but this preflight only checks that the name exists.

## Approval Requirements

- Keep writes in dry-run mode unless the user gives explicit approval.
- Confirm before publishing, deploying, sending, or updating external systems.

## Side-Effect Boundaries

- Read local files.
- Write reports to stdout.

## Examples

- Run the preflight before using the skill in CI.

## Validation Workflow

- Run the fixture smoke command.
