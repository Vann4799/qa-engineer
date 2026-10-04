# API testing

Test the contract behind the UI: status codes, response schema, auth,
validation, and idempotency. Assert on the response; capture only the fields
under test, never the whole body.

## What to cover per endpoint

- **Happy path** — valid request → expected status (200/201/204) and shape.
- **Auth** — missing token → 401; wrong/expired token → 401; insufficient role →
  403. Never leak whether a user exists via a different code.
- **Validation** — missing required field, wrong type, too long, bad enum,
  malformed JSON → 400 with a useful error body naming the field.
- **Not found** — unknown id → 404, not 500.
- **Method** — wrong verb → 405.
- **Idempotency/side effects** — a duplicate POST does not create two rows; a PUT
  is stable across repeats.
- **Boundaries** — pagination limits, empty list → `[]` not `null`, large payload.
- **Contract** — response keys/types match what the frontend consumes.

## From the browser console (same-origin)

When QA-ing a deployed app, call its own API with `fetch` so cookies/CORS match
production:

```js
(async () => {
  const r = await fetch('/api/items?page=1', { headers: { 'Accept': 'application/json' } })
  const j = r.ok ? await r.json() : null
  return { status: r.status, ok: r.ok, count: Array.isArray(j?.items) ? j.items.length : null }
})()
```

For a write, include the CSRF header the app uses (see `console-snippets.md`).

## From the shell (curl)

Prefer this for backend-only or local testing:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa@x.dev","password":"'"$PW"'"}'
```

Capture the body separately and assert with `jq` — return counts/fields, not the
raw dump:

```bash
curl -sS "$BASE/api/items" -H "Authorization: Bearer $TOKEN" \
  | jq '{ status: "ok", n: (.items|length), first_id: .items[0].id }'
```

## Postman / Newman

For a repeatable suite the user maintains in Postman:

- Keep one collection per service, one folder per resource, environment variables
  for `baseUrl` and tokens — never hardcode secrets in the collection.
- Add **tests** in the request's Tests tab:
  ```js
  pm.test('status 200', () => pm.response.to.have.status(200))
  pm.test('has items array', () => pm.expect(pm.response.json().items).to.be.an('array'))
  ```
- Chain requests with collection variables (`pm.collectionVariables.set('id', …)`).
- Run headless in CI with **Newman**:
  ```bash
  newman run collection.json -e env.json --reporter cli,json \
    --reporter-json-export results.json
  ```
  Parse `results.json` for `{ total, failed }` rather than shipping the whole run.

## Reporting an API failure

The bug evidence is the exact request (method, path, headers minus secrets, body)
and the exact response (status + the relevant body fields). Reproduce with the
smallest request that still fails.
