# Spreadsheet export — Excel & Google Sheets

QA documentation lives in spreadsheets: a test-case log, a bug tracker, a
traceability matrix, a run summary. Three paths, cheapest first. Never commit
tokens or real credentials into any sheet or repo file.

## Column schemas

Keep these headers stable so sheets diff cleanly across runs.

- **Test Cases** — `ID, Title, Priority, Type, Precondition, Steps, Test Data, Expected Result`
- **Bugs** — `Title, Severity, Priority, Reproducibility, Environment, Steps to Reproduce, Expected, Actual, Evidence, Suggested Area`
- **Traceability** — `Requirement, Scenario(s), Case(s), Status`
- **Run Summary** — `metric, value` (totals, cases by priority, bugs by severity)

## Path A — CSV (offline, dependency-free, default)

`scripts/export_qa.mjs` parses the markdown artifacts (`assets/*-template.md`
filled in) and writes UTF-8-BOM CSV per table:

```bash
node scripts/export_qa.mjs qa/test-cases.md qa/bugs.md --out qa/sheets/
```

Outputs `qa-test-cases.csv`, `qa-bugs.csv`, `qa-traceability.csv`,
`qa-summary.csv` (only tables with rows). CSV **opens directly in Excel** and
**imports into Google Sheets** (File → Import → Upload). The BOM keeps
non-ASCII (Indonesian text) rendering correctly in Excel. This is the reliable
default — no network, no auth, no dependencies.

## Path B — live Google Sheet (Sheets API)

Push rows straight into a Google Sheet when the user wants a shared, live doc.
Needs a Google Cloud OAuth token or service account with the Sheets API enabled;
read it from an env var the user names (`SHEETS_TOKEN`), never hardcode. If the
`google-workspace-ops` skill or a Google MCP is connected, prefer that.

Create/clear a sheet, then append rows (v4 REST):

```bash
# spreadsheetId from the sheet URL /sheets/d/<ID>/edit
SID="$SPREADSHEET_ID"
RANGE="TestCases!A:H"

curl -sS -X POST \
  "https://sheets.googleapis.com/v4/spreadsheets/$SID/values/$RANGE:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS" \
  -H "Authorization: Bearer $SHEETS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"values":[["TC-LOGIN-001","Valid login","P0","smoke","Logged out","1. Go /login …","qa@x.dev","Redirect /dashboard"]]}'
```

Batch many rows in one `values` array to keep it cheap. For a brand-new sheet,
`POST /v4/spreadsheets` with a `sheets[].properties.title` per table, then
`batchUpdate` to write headers. Return only `{spreadsheetId, updatedRange, updatedRows}`
— not the whole response body.

## Path C — true .xlsx workbook (multi-tab)

When the user needs a real Excel file with tabs (not CSV), use a library — the
repo already installs deps with **pnpm** (npm is unreliable on Windows/Defender):

```bash
pnpm add -D exceljs
```

```js
// build-xlsx.mjs (run with: node build-xlsx.mjs)
import ExcelJS from 'exceljs'
const wb = new ExcelJS.Workbook()
const add = (name, header, rows) => {
  const ws = wb.addWorksheet(name)
  ws.columns = header.map((h) => ({ header: h, key: h, width: 24 }))
  rows.forEach((r) => ws.addRow(r))
  ws.getRow(1).font = { bold: true }
}
// feed from the CSVs export_qa.mjs already produced, or parse the markdown again
add('Test Cases', ['ID','Title','Priority','Type','Precondition','Steps','Test Data','Expected Result'], caseRows)
add('Bugs', ['Title','Severity','Priority','Reproducibility','Environment','Steps to Reproduce','Expected','Actual','Evidence','Suggested Area'], bugRows)
await wb.xlsx.writeFile('qa-report.xlsx')
```

An `.xlsx` can also be uploaded to Google Drive and opened as a Google Sheet
(File → Import, or Drive "Open with → Google Sheets"), so one file serves both.

## Choosing

- Just need the data in a spreadsheet, offline → **Path A (CSV)**.
- Shared live tracker the team edits → **Path B (Sheets API)**.
- A polished multi-tab Excel deliverable → **Path C (.xlsx)**, then optionally
  import to Sheets.

Report what you produced compactly: the file/sheet id, the tables, and the row
counts. Do not paste sheet contents back into chat.
