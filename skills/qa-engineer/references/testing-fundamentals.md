# Testing fundamentals

How to design tests and write the artifacts. Use the templates in `assets/`; do
not freehand the formats. Validate every test case and bug report with
`scripts/validate_artifacts.mjs`.

## Test design techniques

- **Equivalence partitioning** — split inputs into classes that behave the same;
  test one per class (valid + each invalid class). Cuts combinatorial explosion.
- **Boundary value analysis** — bugs live at edges. For a range 1–100 test 0, 1,
  2, 99, 100, 101. For a string with max length test len-1, len, len+1.
- **Decision table** — when several conditions combine, list every rule
  (condition → expected action) so no combination is missed.
- **State transition** — for flows with states (draft→submitted→approved→
  rejected), test each valid transition and each invalid one.
- **Error guessing** — from experience: empty/null, wrong type, duplicate
  submit, concurrency, special chars, SQL/HTML injection, huge payload, slow
  network, expired session, wrong permission.

## Test scenario vs test case

- A **scenario** is one line: *what* to verify ("user can reset a forgotten
  password"). Lives in the test plan.
- A **test case** is the executable detail: preconditions, numbered steps, test
  data, and an observable expected result. One case = one behaviour.

## Writing a test case

From `assets/test-case-template.md`:

- **ID** — stable and unique (e.g. `TC-LOGIN-004`).
- **Title** — imperative and specific, not "test login".
- **Priority** — P0 critical path, P1 major, P2 minor/edge.
- **Type** — smoke, regression, functional, negative, boundary, security,
  exploratory.
- **Precondition** — the state that must hold first (logged in as X, DB seeded).
- **Steps** — atomic, numbered, one action each. No "and then also".
- **Test data** — exact values, or a pointer to where they come from. Never real
  user credentials.
- **Expected** — what an observer can confirm (status 200, toast "Saved", row
  count = 1, redirect to `/dashboard`). Not "works".

Good expected results are **observable and falsifiable**. If you cannot assert it
in the console, the API, or the DB, rewrite it until you can.

## Bug report

From `assets/bug-report-template.md`. A bug that cannot be reproduced cannot be
fixed, so the report's job is reproduction + evidence.

- **Title** — `<what breaks> <where> <when>` ("Checkout total shows NaN when cart
  has a 0-price item").
- **Severity** — impact on the system: Critical (data loss/crash/security),
  Major (feature broken, no workaround), Minor (feature degraded, workaround
  exists), Trivial (cosmetic).
- **Priority** — how fast to fix: P0 now, P1 this sprint, P2 backlog. Severity
  and priority are independent — a typo on the homepage is Trivial severity but
  may be P1 priority.
- **Environment** — URL/branch/commit, browser, OS, account role, device.
- **Steps to reproduce** — numbered, from a clean state, minimal.
- **Expected vs Actual** — the gap, stated plainly.
- **Evidence** — the exact selector, request/response, SQL result, console error,
  or exit code. This is what makes it actionable. A screenshot only if the ground
  rules allowed one.
- **Suggested area** — the component/endpoint/query likely at fault, if known.
- **Reproducibility** — Always / Sometimes (1 in N) / Once.

Severity decides the verdict; a single Critical or a cluster of Majors blocks a
release.

## Test types and when to run them

- **Smoke** — the critical-path subset. Run on every new build/deploy to decide
  if it is testable at all. Minutes, not hours.
- **Regression** — everything that could break from a change. Run after a fix or
  before a release. Scope by what changed; say what you skipped.
- **Functional** — does each feature meet its requirement. Run per feature.
- **Negative** — invalid input, wrong permission, missing data, abuse. Pair every
  happy-path case with at least one negative.
- **Exploratory** — unscripted, charter-driven, timeboxed. Use when the script is
  green but you suspect the unknown. Write a charter, not steps:

  > Explore <target> with <technique/resources> to discover <information>,
  > timeboxed to <N> minutes.

  Capture what you find as new test cases or bugs afterwards.

## Traceability

Every requirement maps to at least one scenario, every P0 scenario to at least
one test case, every failed case to a bug. When you finish, state the counts so
coverage is checkable, not asserted.
