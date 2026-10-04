#!/usr/bin/env node
// export_qa.mjs — turn QA markdown artifacts into spreadsheet tables (CSV).
// CSV opens directly in Excel and imports into Google Sheets (File > Import).
// For a live Google Sheet or a true multi-tab .xlsx, see references/spreadsheet-export.md.
//
// Usage:
//   node export_qa.mjs <artifact.md> [more.md ...] [--out <dir>]
// Writes qa-test-cases.csv, qa-bugs.csv, qa-traceability.csv, qa-summary.csv
// (only the tables that have rows). Dependency-free (Node >= 18).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
let outDir = '.'
const files = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outDir = argv[++i]
  else files.push(argv[i])
}
if (!files.length) {
  console.log('usage: node export_qa.mjs <artifact.md> [more.md ...] [--out <dir>]')
  process.exit(2)
}

// ---- markdown parsing helpers (mirror validate_artifacts.mjs) -------------
function stripFences(raw) {
  let fence = false
  return raw
    .split(/\r?\n/)
    .filter((l) => {
      if (/^\s*(```|~~~)/.test(l)) {
        fence = !fence
        return false
      }
      return !fence
    })
    .join('\n')
}

function field(body, label) {
  const m = body.match(new RegExp(`^\\s*[-*]\\s*\\*\\*${label}\\*\\*\\s*[:\u00b7\u2014-]\\s*(.+)$`, 'im'))
  return m ? m[1].trim() : ''
}

function section(body, heading) {
  const m = body.match(new RegExp(`^##\\s+${heading}\\s*$`, 'im'))
  if (!m) return ''
  const rest = body.slice(m.index + m[0].length)
  const next = rest.search(/^##\s+/m)
  return (next === -1 ? rest : rest.slice(0, next)).trim()
}

// Split a document into H1 blocks: { title, body }
function blocks(doc) {
  const out = []
  let cur = null
  for (const line of doc.split(/\r?\n/)) {
    const h1 = line.match(/^#\s+(.+)$/)
    if (h1) {
      cur = { title: h1[1].trim(), body: [] }
      out.push(cur)
    } else if (cur) cur.body.push(line)
  }
  return out.map((b) => ({ title: b.title, body: b.body.join('\n') }))
}

// Parse a markdown pipe table into { header: [], rows: [[]] }
function table(body, heading) {
  const sec = heading ? section(body, heading) : body
  const lines = sec.split(/\r?\n/).filter((l) => /^\s*\|.*\|\s*$/.test(l))
  if (lines.length < 2) return null
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const header = cells(lines[0])
  const rows = lines
    .slice(1)
    .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l)) // skip the ---|--- separator
    .map(cells)
    .filter((r) => r.some((c) => c && !/^[-:]+$/.test(c)))
  return rows.length ? { header, rows } : null
}

// ---- collect rows ---------------------------------------------------------
const cases = []
const bugs = []
let trace = null

for (const file of files) {
  if (!existsSync(file)) {
    console.log(`WARN  ${file} not found, skipped`)
    continue
  }
  const doc = stripFences(readFileSync(file, 'utf8'))
  for (const b of blocks(doc)) {
    const t = b.title.toLowerCase()
    if (/test case/.test(t)) {
      cases.push([
        field(b.body, 'ID'),
        field(b.body, 'Title') || b.title.replace(/^test case:?\s*/i, ''),
        field(b.body, 'Priority'),
        field(b.body, 'Type'),
        section(b.body, 'Precondition'),
        section(b.body, 'Steps'),
        section(b.body, 'Test Data'),
        section(b.body, 'Expected Result'),
      ])
    } else if (/bug/.test(t)) {
      bugs.push([
        b.title.replace(/^bug:?\s*/i, ''),
        field(b.body, 'Severity'),
        field(b.body, 'Priority'),
        field(b.body, 'Reproducibility'),
        field(b.body, 'Environment'),
        section(b.body, 'Steps to Reproduce'),
        section(b.body, 'Expected'),
        section(b.body, 'Actual'),
        section(b.body, 'Evidence'),
        section(b.body, 'Suggested Area'),
      ])
    }
  }
  if (!trace) trace = table(doc, 'Traceability')
}

// ---- summary counts -------------------------------------------------------
const count = (rows, idx) => {
  const m = new Map()
  for (const r of rows) {
    const k = (r[idx] || '(blank)').trim()
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const summary = [
  ['metric', 'value'],
  ['test cases (total)', String(cases.length)],
  ...count(cases, 2).map(([k, n]) => [`cases by priority ${k}`, String(n)]),
  ['bugs (total)', String(bugs.length)],
  ...count(bugs, 1).map(([k, n]) => [`bugs by severity ${k}`, String(n)]),
]

// ---- CSV writer -----------------------------------------------------------
const cell = (v) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const csv = (rows) => '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'

const out = resolve(outDir)
mkdirSync(out, { recursive: true })
const written = []
const write = (name, header, rows) => {
  if (!rows.length) return
  const path = join(out, name)
  writeFileSync(path, csv([header, ...rows]), 'utf8')
  written.push(`${name} (${rows.length} rows)`)
}

write('qa-test-cases.csv',
  ['ID', 'Title', 'Priority', 'Type', 'Precondition', 'Steps', 'Test Data', 'Expected Result'], cases)
write('qa-bugs.csv',
  ['Title', 'Severity', 'Priority', 'Reproducibility', 'Environment', 'Steps to Reproduce', 'Expected', 'Actual', 'Evidence', 'Suggested Area'], bugs)
if (trace) {
  const path = join(out, 'qa-traceability.csv')
  writeFileSync(path, csv([trace.header, ...trace.rows]), 'utf8')
  written.push(`qa-traceability.csv (${trace.rows.length} rows)`)
}
const sumPath = join(out, 'qa-summary.csv')
writeFileSync(sumPath, csv(summary), 'utf8')
written.push(`qa-summary.csv (${summary.length - 1} rows)`)

console.log(`Exported QA docs to ${out}`)
for (const w of written) console.log(`  wrote  ${w}`)
console.log('\nOpen in Excel directly, or Google Sheets > File > Import > Upload.')
console.log('For a live Google Sheet or a .xlsx workbook, see references/spreadsheet-export.md.')
