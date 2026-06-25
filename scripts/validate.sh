#!/usr/bin/env bash
set -euo pipefail

npm test
npm run check
npm run smoke
EXAMPLE_TOKEN=1 node bin/skillenv.js --json test/fixtures/ready/SKILL.md >/dev/null
