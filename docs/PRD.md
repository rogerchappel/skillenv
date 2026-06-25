# PRD: skillenv

## Summary

`skillenv` audits agent skills for runtime requirements and approval boundaries before another agent or maintainer tries to use them.

## Goals

- Make skill runtime requirements visible.
- Catch missing local tools and environment variable names.
- Flag live-action wording without approval or dry-run boundaries.
- Provide text and JSON outputs for local use and CI.

## Non-Goals

- No credential validation.
- No automatic dependency installation.
- No network calls.
- No LLM-based parsing.

## Users

- Agent skill authors preparing public repos.
- Maintainers reviewing skill pull requests.
- Automation that gates skill package changes.

## MVP Requirements

- Parse common Markdown sections in `SKILL.md`.
- Extract required tools, optional tools, env vars, inputs, side effects, and approvals.
- Check command presence on `PATH`.
- Check environment variable name presence without reading values.
- Exit non-zero on missing required requirements or unsafe live-action language.

## Success Criteria

- Fixture-backed tests cover pass, missing-env, and unsafe-action cases.
- CLI smoke command works from a fresh checkout.
- Release candidate PR documents verification results.
