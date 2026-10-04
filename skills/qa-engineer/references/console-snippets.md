# evaluate_script snippets

Every body below is meant to be pasted into `mcp__browser-use__evaluate_script`
as-is (wrap in an async IIFE if the host needs it). Each returns a small plain
object — never a node, never an unbounded array. Replace `EMAIL`, `PASSWORD`,
`SELECTOR` with real values at call time; never save credentials into the file.

## Login — same-origin fetch (the default route)

```js
(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  return { status: r.status, ok: r.ok }
})()
```

Follow with `navigate_page` to the protected route, then verify:

```js
(async () => {
  const r = await fetch('/api/auth/session')   // or /api/me, /api/whoami
  const j = r.ok ? await r.json() : {}
  return { ok: r.ok, role: j.role ?? j.user?.role ?? null }
})()
```

If the app guards writes with CSRF, read the token the app reads:

```js
document.querySelector('meta[name="csrf-token"]')?.content
  ?? document.cookie.match(/csrf=([^;]+)/)?.[1] ?? null
```

and send it as the header the app expects.

## Login — scripted form fill (no endpoint, or CORS-blocked)

React/Vue controlled inputs ignore `el.value = x`; use the native setter so the
framework's own listener fires:

```js
(() => {
  const set = (sel, value) => {
    const el = document.querySelector(sel)
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return !!el
  }
  const email = set('input[type="email"], input[name="email"]', EMAIL)
  const pass = set('input[type="password"]', PASSWORD)
  const btn = document.querySelector('form button[type="submit"], form input[type="submit"]')
  if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  else document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  return { email, pass, submitted: !!btn }
})()
```

## Click without a viewport

```js
(() => {
  const el = document.querySelector(SELECTOR)
  if (!el) return { ok: false, why: 'selector not found' }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  return { ok: true, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40) }
})()
```

## Aggregate assertion pass (smoke)

Edit the `checks` array per route; keep samples ≤ 3:

```js
(() => {
  const q = (s) => document.querySelectorAll(s)
  const checks = [
    ['nav exists', q('nav, header [role="navigation"]').length > 0],
    ['rows rendered', q('table tbody tr, [data-row]').length >= 1],
    // viewport 0x0 means the Browser panel is closed; overflow cannot be measured
    ['no horizontal overflow', window.innerWidth === 0 || document.documentElement.scrollWidth <= window.innerWidth],
    ['error banner absent', q('[role="alert"], .error-banner').length === 0],
  ]
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
  return { ok: failed.length === 0, n: checks.length, failed }
})()
```

## State read (after an interaction)

```js
(() => ({
  route: location.pathname,
  title: document.title,
  state: window.__STATE ?? window.__NEXT_DATA__?.props?.pageProps ?? null,
  rows: document.querySelectorAll('table tbody tr').length,
}))()
```

Trim `state` before returning if it is large: pick the keys you assert on inside
the page, do not ship the blob.

## Console + network summary

Use the MCP tools, then compress:

- `list_console_messages` → count by level, drop analytics/third-party hosts,
  quote ≤ 3 errors verbatim.
- `list_network_requests` → `{ total, failed: n, worst: [url, status] ×3 }`.

## Logout / session teardown

```js
(async () => {
  const r = await fetch('/api/auth/logout', { method: 'POST' })
  return { ok: r.ok }
})()
```

Run it at the end of a write-heavy QA pass on shared staging, so the next
person's session is not yours.
