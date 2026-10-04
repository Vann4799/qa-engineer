# CI/CD — GitHub Actions

Run the test suite on push/PR and block merge on failure. Start from
`assets/qa-ci.yml`; adapt to the repo's package manager and structure. **Do not
modify an existing pipeline without the user's go-ahead** — CI is shared
infrastructure.

## Core ideas

- **Trigger** on `pull_request` (gate the merge) and `push` to the base branch
  (catch what landed). Use `paths:` filters so docs-only changes skip the run.
- **Cache** dependencies and the Playwright browser binary so runs are fast and
  cheap. `actions/setup-node` has built-in `cache: 'pnpm'`; cache
  `~/.cache/ms-playwright` keyed on the lockfile.
- **Fail the build** on any test failure — the job's exit code is the gate. Add a
  branch-protection required check so a red run blocks merge.
- **Publish evidence** as artifacts on failure: `playwright-report/`, `test-results/`
  (traces), Newman JSON. Upload with `if: always()` or `if: failure()` so they
  survive a red run.
- **Secrets** come from repo Secrets (`QA_EMAIL`, `QA_PW`, `DATABASE_URL`), never
  committed. Reference as `${{ secrets.NAME }}` into env.

## Smoke vs regression split

Run the fast `@smoke` subset on every PR, the full regression on a schedule or on
push to base:

```yaml
- name: Smoke (PR gate)
  if: github.event_name == 'pull_request'
  run: pnpm exec playwright test --grep @smoke

- name: Full regression
  if: github.event_name == 'push'
  run: pnpm exec playwright test
```

A `schedule:` cron job (e.g. nightly) runs the heavy suite off the PR path.

## Matrix

Test across browsers when the app supports them:

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1/4, 2/4, 3/4, 4/4]      # Playwright sharding for big suites
    browser: [chromium, firefox, webkit]
```

Use `--shard=${{ matrix.shard }}` to split a large suite across runners; merge
reports with `pnpm exec playwright merge-reports`.

## Reading a run

```bash
gh run list --limit 5                       # recent runs
gh run view <id>                            # jobs + steps
gh run view <id> --log-failed               # only failing step logs
gh run download <id> -n playwright-report   # fetch artifacts
```

Report CI status compactly: run id/conclusion, which job failed, the failing test
names, and the artifact link. Do not paste the whole log.

## Non-Playwright suites

- **API (Newman)**: `newman run collection.json -e env.json --reporter cli,json`,
  export the JSON, parse `{ total, failed }`.
- **Unit/integration** the app already has: run them in the same job so QA sees
  the whole gate, or a separate job that also must pass.
- Keep the workflow dependency-light; pin action versions (`@v4`) not floating tags.
