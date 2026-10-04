# Test Case

Fill every field. Delete this line and the `[...]` placeholders once done — the
validator (`scripts/validate_artifacts.mjs`) flags leftover placeholders. One
file may hold several cases; repeat the block per case.

```markdown
# Test Case: [TC-FEATURE-000] — [imperative, specific title]

- **ID**: [TC-FEATURE-000]
- **Title**: [what is verified, imperative]
- **Priority**: [P0 | P1 | P2]
- **Type**: [smoke | regression | functional | negative | boundary | security | exploratory]

## Precondition
[State that must hold first — logged in as X, DB seeded, on route Y.]

## Steps
1. [one atomic action]
2. [next action]
3. [next action]

## Test Data
[exact values, or where they come from. Never real user credentials.]

## Expected Result
[observable, falsifiable outcome — status 200, toast "Saved", row count = 1,
redirect to /dashboard. Not "works".]
```

## Field rules

- **ID** — stable and unique across the suite (`TC-LOGIN-004`).
- **Priority** — P0 critical path, P1 major, P2 minor/edge.
- **Type** — one of the listed kinds; pair each happy-path case with a negative.
- **Steps** — numbered, one action each, from a clean state.
- **Expected Result** — must be assertable in the console, the API, or the DB.
