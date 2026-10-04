# Database testing (MySQL / PostgreSQL)

A green UI can still hide a bad write. Verify persistence, referential
integrity, cascades, and cleanup with the smallest read query that proves the
point. Return counts or the specific columns you assert on — never `SELECT *`
across a whole table into context.

## Safety first

- **Reads** to verify state are fine on any environment the user owns.
- **Writes** (seed/cleanup) go to local or a test schema only, never production,
  never shared staging without the user's go-ahead.
- Always scope by a test marker so cleanup cannot touch real data: seed rows with
  a recognisable prefix (`qa_test_…`) or capture their ids and delete by id.
- Wrap destructive checks in a transaction you roll back when you only need to
  observe.

## Connecting

Read connection info from an env var the user names; never hardcode or commit
credentials.

```bash
# PostgreSQL
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM users WHERE email LIKE 'qa_test_%'"

# MySQL
mysql --defaults-extra-file=<(printf '[client]\nuser=%s\npassword=%s\n' "$DB_USER" "$DB_PW") \
  -h "$DB_HOST" "$DB_NAME" -N -B -e "SELECT count(*) FROM orders WHERE ref LIKE 'qa_test_%'"
```

`-tA` (psql) and `-N -B` (mysql) strip headers/formatting so the output is a bare
value the agent can assert on cheaply.

## What to verify

- **Persistence** — the row the UI created actually exists, with the right
  values:
  ```sql
  SELECT id, status, total FROM orders WHERE ref = 'qa_test_001';
  ```
- **Uniqueness** — a duplicate submit did not create two rows:
  ```sql
  SELECT count(*) FROM orders WHERE ref = 'qa_test_001';  -- expect 1
  ```
- **Referential integrity / cascade** — deleting a parent removed or nulled the
  children as designed:
  ```sql
  SELECT count(*) FROM order_items WHERE order_id = $DELETED_ID;  -- expect 0 if ON DELETE CASCADE
  ```
- **Constraints** — a value that should be rejected (negative price, null
  required col, bad enum) did not persist; the write failed, not silently stored.
- **State transitions** — the status column matches the workflow after an action.
- **Aggregates** — a computed total equals the sum of its parts:
  ```sql
  SELECT o.total, SUM(i.qty * i.price) AS calc
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.ref = 'qa_test_001' GROUP BY o.total;  -- total must equal calc
  ```
- **Soft delete / audit** — `deleted_at` set rather than the row gone; audit log
  entry written.

## Seed and cleanup

Seed the exact rows a test needs, tagged, then remove them at the end so the
environment is unchanged:

```sql
-- seed (local/test schema only)
INSERT INTO users (email, name) VALUES ('qa_test_u1@x.dev', 'QA One') RETURNING id;

-- cleanup by the same marker
DELETE FROM users WHERE email LIKE 'qa_test_%';
```

For a repeatable suite, put seed/teardown in the automation setup
(`references/automation-playwright.md`) or a migration-safe fixture, not in ad-hoc
SQL that leaks.

## Evidence for a bug

When the DB disagrees with the UI, the bug evidence is the query and its exact
result — e.g. `SELECT status FROM orders WHERE ref='qa_test_001'` → `pending`,
but the UI showed `paid`. That gap is the actionable proof.
