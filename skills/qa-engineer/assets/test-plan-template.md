# Test Plan / Test Scenarios

Fill every field. Delete this line and the `[...]` placeholders once done. The
plan drives everything downstream: scenarios here become test cases, which become
automated specs.

```markdown
# Test Plan: [feature or release]

- **Scope**: [what is being tested]
- **Out of scope**: [explicitly not tested, and why]
- **Environment(s)**: [local / staging / preview URL, browser(s), account roles]
- **Owner**: [who runs this]
- **Date**: [YYYY-MM-DD]

## Objectives
[what a pass proves — the quality bar for this release/feature]

## Entry criteria
[what must be true before testing starts — build deployed, DB seeded, creds available]

## Exit criteria
[what must be true to stop — all P0 cases pass, no open Critical/Major bugs, smoke green]

## Risk & priority
| Area | Risk | Priority | Why |
|------|------|----------|-----|
| [area] | [high/med/low] | [P0/P1/P2] | [impact if it breaks] |

## Test scenarios
One line each — *what* to verify. Expand the P0 ones into test cases
(`assets/test-case-template.md`).

### Happy path
- [SC-001] [user can …]
- [SC-002] [user can …]

### Negative / boundary
- [SC-003] [invalid input is rejected with …]
- [SC-004] [permission denied when …]

### Regression
- [SC-005] [existing feature X still works after this change]

## Techniques applied
[equivalence partitioning, boundary value, decision table, state transition,
error guessing — which and where]

## Automation candidates
[scenarios stable + high-value enough to promote into Playwright]

## Traceability
| Requirement | Scenario(s) | Case(s) | Status |
|-------------|-------------|---------|--------|
| [req] | [SC-00x] | [TC-xxx] | [pass/fail/pending] |
```
