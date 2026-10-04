# Manual console QA playbook

Drive a live web app entirely through the devtools console with
`mcp__browser-use__evaluate_script`. Every observation is a small JSON return,
every interaction a dispatched event, authentication one same-origin `fetch`.
Screenshots are the expensive last resort, not the default. Copy-paste script
bodies live in `references/console-snippets.md`.

## Why the console and not clicks

`mcp__browser-use__click` and `fill` need a live viewport and fail with
`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE` when the in-app Browser panel is closed.
`evaluate_script` does not need a viewport and works at 0×0, so the whole QA run
survives headless. It is also far cheaper in tokens than screenshot-driven QA.

## Phase 0 — session and login

1. `navigate_page` to the app origin once. Everything after reuses the tab.
2. Log in from the console with the app's own endpoint:

   ```js
   await fetch('/api/auth/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email, password }),
   }).then((r) => ({ status: r.status, body: r.ok ? 'ok' : 'rejected' }))
   ```

   Then `navigate_page` again — the cookie jar and any role-based redirect only
   settle after a real navigation.
3. **Verify before spending anything on QA**: fetch the session/me endpoint (or
   hit one protected route) and return `{ ok, role }`. HttpOnly cookies are
   invisible to `document.cookie`, so prove the session by what the server
   answers, not by reading cookies.
4. No login endpoint, or cross-origin/CORS-blocked? Use the scripted form fill in
   `references/console-snippets.md` (native value setter + `input` event, then
   submit). React and Vue ignore a plain `.value =` assignment.

## Phase 1 — smoke

- `list_console_messages`: count errors, ignore analytics/third-party noise,
  quote at most three verbatim.
- `list_network_requests`: count 4xx/5xx, name the worst three as `{url, status}`.
- One `evaluate_script` assertion pass over the route: presence of key selectors,
  expected texts, element counts, no horizontal overflow
  (`document.documentElement.scrollWidth <= innerWidth`) — **skip the overflow
  check when `innerWidth === 0`** (Browser panel closed, overflow is
  unmeasurable and always false-fails). Return the aggregate.

## Phase 2 — interactions

- **Click**: `el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`
  — or `el.click()` for plain handlers. Works at 0×0.
- **Type**: native setter + `dispatchEvent(new Event('input', { bubbles: true }))`
  per field, then submit the form the same way.
- **Navigate** an SPA by clicking its own links, or `location.assign(url)` plus
  `wait_for` on a selector that only exists after the route renders.
- After each interaction, assert the **state**, not the pixels: the DOM changed
  as expected, `window.__STATE`/store says so, or the next fetch returned 2xx.

## Phase 3 — report

Compact markdown, one line per check, verdict at the end:

```markdown
## QA — <url> — <timestamp>
- session: ok (role=admin) via POST /api/auth/login
- console: 0 errors, 1 warning (analytics noise)
- network: 14 requests, 0 failed
- dom: 6/6 assertions ok — nav present, 12 rows, no overflow
- interactions: login→list→detail ok; invalid form shows error state
- verdict: SHIP (0 blockers)
```

If something failed, include the exact selector or response that proves it, so
the fix does not need another QA round to locate it. Turn each failure into a bug
report (`assets/bug-report-template.md`).

## Teardown

On shared staging, log out at the end of a write-heavy pass
(`POST /api/auth/logout`) so the next person's session is not yours. Clean up any
test data you seeded.
