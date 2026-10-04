# Bug Report

Fill every field. Delete this line and the `[...]` placeholders once done — the
validator (`scripts/validate_artifacts.mjs`) flags leftover placeholders. A bug
that cannot be reproduced cannot be fixed: the report's job is reproduction +
evidence.

```markdown
# Bug: [what breaks] [where] [when]

- **Severity**: [Critical | Major | Minor | Trivial]
- **Priority**: [P0 | P1 | P2]
- **Reproducibility**: [Always | Sometimes | Once]
- **Environment**: [url or branch/commit, browser, OS, account role, device]

## Steps to Reproduce
1. [from a clean state, minimal]
2. [next step]

## Expected
[what should happen]

## Actual
[what happens instead]

## Evidence
[exact selector, request/response, SQL result, console error, or exit code that
proves it. Screenshot only if the ground rules allowed one.]

## Suggested Area
[component / endpoint / query likely at fault, if known]
```

## Field rules

- **Severity** — impact on the system: Critical (data loss / crash / security),
  Major (feature broken, no workaround), Minor (degraded, workaround exists),
  Trivial (cosmetic).
- **Priority** — how fast to fix: P0 now, P1 this sprint, P2 backlog. Independent
  of severity.
- **Environment** — enough to reproduce the exact conditions.
- **Steps to Reproduce** — numbered, minimal, from a clean state.
- **Expected vs Actual** — the gap, stated plainly.
- **Evidence** — what makes it actionable; the exact failing artifact.
