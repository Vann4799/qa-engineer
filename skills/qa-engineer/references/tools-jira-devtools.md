# Tools — Jira + Browser DevTools

## Jira

Track test work and bugs as tickets. **Creating, transitioning, or commenting on a
ticket is a shared-state action — do not do it without the user's go-ahead.**
Draft the ticket content first, show it, then act.

If a Jira MCP server or the `jira-integration` skill is connected, use it.
Otherwise drive the REST API with `curl` and a token from an env var the user
names (`JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BASE_URL`) — never committed.

### Bug ticket

Map the bug report (`assets/bug-report-template.md`) onto Jira fields:

```bash
curl -sS -X POST "$JIRA_BASE_URL/rest/api/3/issue" \
  -H "Authorization: Bearer $JIRA_API_TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "fields": {
      "project": { "key": "QA" },
      "issuetype": { "name": "Bug" },
      "summary": "Checkout total shows NaN with a 0-price item",
      "priority": { "name": "High" },
      "labels": ["regression", "checkout"],
      "description": { "type": "doc", "version": 1, "content": [
        { "type": "paragraph", "content": [{ "type": "text",
          "text": "Env: staging @ abc123. Severity: Major. Steps + evidence below." }] }
      ] }
    }
  }' | jq '{ id, key }'
```

Severity → the report's own field (Jira has no universal severity); Priority →
Jira `priority`. Put steps, expected vs actual, and evidence in the description
(ADF format for the v3 API, or Markdown/wiki for v2). Attach the trace/screenshot
to the issue via `/rest/api/3/issue/{key}/attachments` if the ground rules allowed
one.

### Transitions and queries

```bash
# move a ticket (e.g. To Do → In Progress); get valid ids first
curl -sS "$JIRA_BASE_URL/rest/api/3/issue/QA-123/transitions" \
  -H "Authorization: Bearer $JIRA_API_TOKEN" | jq '.transitions[] | {id, name}'

curl -sS -X POST "$JIRA_BASE_URL/rest/api/3/issue/QA-123/transitions" \
  -H "Authorization: Bearer $JIRA_API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"transition":{"id":"21"}}'

# JQL: open bugs for this cycle, compact
curl -sS -G "$JIRA_BASE_URL/rest/api/3/search" \
  --data-urlencode 'jql=project=QA AND issuetype=Bug AND status!=Done ORDER BY priority DESC' \
  --data-urlencode 'fields=summary,status,priority' \
  -H "Authorization: Bearer $JIRA_API_TOKEN" \
  | jq '.issues[] | { key: .key, s: .fields.status.name, p: .fields.priority.name, t: .fields.summary }'
```

Return the compact list, not the raw payload. Link tickets to the PR/commit
(`git-github.md`) so the fix and the bug trace together.

## Browser DevTools

The console QA playbook (`references/console-qa.md`) *is* DevTools driven
programmatically through `mcp__browser-use__evaluate_script`. When you need
something the MCP does not expose, reason about these panels:

- **Console** — errors/warnings; the MCP `list_console_messages` mirrors it.
  Filter out analytics/third-party noise before counting.
- **Network** — status, timing, payloads; `list_network_requests` mirrors it. Look
  for 4xx/5xx, slow calls, failed XHR/fetch, wrong content-type, missing auth
  header, oversized responses.
- **Application/Storage** — cookies (HttpOnly invisible to JS), localStorage,
  sessionStorage, IndexedDB. Prove session by the server's answer, not by reading
  these.
- **Elements** — the DOM you assert against; how you find the stable selector for
  a `dispatchEvent` click. Prefer `data-testid` and ARIA roles.
- **Lighthouse** — performance/a11y/SEO audit when the user asks for those
  specifically; it is expensive, run only on request.

Everything you observe collapses to a small JSON return — a count, a status, a
boolean, ≤3 samples. The report is not the app; do not ship the panel contents.
