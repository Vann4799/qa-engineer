# Version control — Git + GitHub

Commit the QA artifacts and automation code cleanly. Follow the repo's existing
conventions; when none exist, use the flow below. **Never push, open a PR, or
merge without the user's explicit go-ahead** — these are shared-state actions.

## Branching

Branch off the repo's main/base branch, name it for the work:

```bash
git status                       # always check before anything destructive
git switch -c test/login-e2e     # or qa/checkout-regression, fix/BUG-123-repro
```

Prefixes teams use: `test/`, `qa/`, `feat/`, `fix/`. Match what `git log` shows.

## Commit

Stage deliberately — review what you include, and never sweep secrets or test
data into a commit:

```bash
git add e2e/ qa/                 # add the dirs you changed, not `git add .` blindly
git status                       # confirm nothing unexpected is staged
git commit -m "test(e2e): add login + dashboard smoke suite"
```

Conventional-commit style is common for QA work:
`test: …`, `test(e2e): …`, `ci: …`, `fix: …`, `docs(qa): …`.

Before committing, check the diff for leaked credentials, `.env`, storageState
files (`fixtures/auth.json`), or DB dumps — add them to `.gitignore` instead:

```
# .gitignore for QA
fixtures/auth.json
test-results/
playwright-report/
blob-report/
*.local
```

## Pull request

Open a PR against the base branch, describe what the tests cover and any bugs
found, link the Jira tickets:

```bash
gh pr create --base main --head test/login-e2e \
  --title "test(e2e): login + dashboard smoke suite" \
  --body "$(cat <<'EOF'
## What
Adds a Playwright smoke suite for login and dashboard.

## Coverage
- TC-LOGIN-001..004 (happy + negative)
- TC-DASH-001 (session guard)

## Notes
Found BUG-123 (dashboard 500 on empty cart) — linked, not fixed here.
EOF
)"
```

Use `gh` when the repo is on GitHub and the CLI is authenticated. Fill the
template the repo provides if there is one (`.github/pull_request_template.md`).

## Keeping in sync

```bash
git fetch origin
git rebase origin/main        # or merge, per repo convention
```

Resolve conflicts rather than discarding work; if a rebase goes wrong,
`git rebase --abort` returns to the pre-rebase state. In a shared worktree, never
use bare `git stash`/`stash pop` — use a tagged stash and `apply` the exact entry.

## Reading history for QA context

```bash
git log --oneline -20                     # what changed recently
git log --oneline -- e2e/                 # history of the test code
git blame -L 10,30 path/to/spec.ts        # who/why for a flaky line
```

Use this to scope regression: what changed since the last green run is what needs
re-testing.
