# Release Candidate

## Scope

Initial public build of `skillenv`, including a CLI, parser, fixtures, tests, smoke command, and local-first skill instructions.

## Verification

- `npm test` passed.
- `npm run check` passed.
- `npm run smoke` passed.
- `npm run validate` passed.

## Classification

Ship. The first release candidate catches missing environment variables, unsafe live-action wording, and missing skill declarations while keeping all checks local-first.
