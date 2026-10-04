#!/usr/bin/env node
// validate_artifacts.mjs — deterministic completeness check for QA artifacts.
// Usage:
//   node validate_artifacts.mjs <file.md> [more.md ...] [--type test-case|bug-report|test-plan]
// Detects the artifact type per file (override with --type). Exits non-zero on
// any FAIL so it drops into CI or a pre-commit hook. Dependency-free (Node >= 18).
import { readFileSync, existsSync } from 'node:fs'

const PRIORITIES = /^p[012]$/i
const SEVERITIES = /^(critical|major|minor|trivial)$/i
const CASE_TYPES = /^(smoke|regression|functional|negative|boundary|security|exploratory)$/i

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
  const m = body.match(new RegExp(`^\\s*[-*]\\s*\\*\\*${label}\\*\\*\\s*[:·—-]\\s*(.+)$`, 'im'))
  return m ? m[1].trim() : null
}

function section(body, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im')
  const m = body.match(re)
  if (!m) return null
  const start = m.index + m[0].length
  const rest = body.slice(start)
  const next = rest.search(/^##\s+/m)
  return (next === -1 ? rest : rest.slice(0, next)).trim()
}

function hasSteps(text) {
  return !!text && /^\s*\d+\.\s+\S/m.test(text)
}

function placeholders(body) {
  const hits = []
  body.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(/\[([^\]\n]{1,60})\](?!\()/g)) {
      const v = m[1].trim()
      if (v && !/^[xX ]$/.test(v)) hits.push(i + 1)
    }
  })
  return hits
}

function detect(body, title) {
  const t = (title + '\n' + body).toLowerCase()
  if (/^#\s*bug/m.test(title) || /##\s*steps to reproduce/i.test(body) || /##\s*actual/i.test(body))
    return 'bug-report'
  if (/##\s*test scenarios/i.test(body) || /^#\s*test plan/im.test(title)) return 'test-plan'
  if (/##\s*expected result/i.test(body) || /\*\*type\*\*/i.test(body)) return 'test-case'
  if (t.includes('bug')) return 'bug-report'
  return 'test-case'
}

function validateCase(body, fails, warns) {
  const id = field(body, 'ID')
  const title = field(body, 'Title')
  const priority = field(body, 'Priority')
  const type = field(body, 'Type')
  if (!id) fails.push('missing field: ID')
  if (!title) fails.push('missing field: Title')
  if (!priority) fails.push('missing field: Priority')
  else if (!PRIORITIES.test(priority.replace(/\s.*$/, '')))
    fails.push(`Priority "${priority}" is not P0/P1/P2`)
  if (!type) fails.push('missing field: Type')
  else if (!CASE_TYPES.test(type.replace(/\s.*$/, '')))
    warns.push(`Type "${type}" is not a standard kind (smoke/regression/functional/negative/boundary/security/exploratory)`)
  if (!section(body, 'Precondition')) fails.push('missing or empty section: Precondition')
  const steps = section(body, 'Steps')
  if (!steps) fails.push('missing section: Steps')
  else if (!hasSteps(steps)) fails.push('Steps has no numbered items')
  if (!section(body, 'Expected Result')) fails.push('missing or empty section: Expected Result')
}

function validateBug(body, fails, warns) {
  const severity = field(body, 'Severity')
  const priority = field(body, 'Priority')
  const env = field(body, 'Environment')
  if (!severity) fails.push('missing field: Severity')
  else if (!SEVERITIES.test(severity.replace(/\s.*$/, '')))
    fails.push(`Severity "${severity}" is not Critical/Major/Minor/Trivial`)
  if (!priority) fails.push('missing field: Priority')
  else if (!PRIORITIES.test(priority.replace(/\s.*$/, '')))
    fails.push(`Priority "${priority}" is not P0/P1/P2`)
  if (!env) fails.push('missing or empty field: Environment')
  const steps = section(body, 'Steps to Reproduce')
  if (!steps) fails.push('missing section: Steps to Reproduce')
  else if (!hasSteps(steps)) fails.push('Steps to Reproduce has no numbered items')
  if (!section(body, 'Expected')) fails.push('missing or empty section: Expected')
  if (!section(body, 'Actual')) fails.push('missing or empty section: Actual')
  const evidence = section(body, 'Evidence')
  if (!evidence) fails.push('missing or empty section: Evidence')
  else if (evidence.replace(/\s+/g, ' ').trim().length < 15)
    warns.push('Evidence looks thin — name the exact selector/request/query and its result')
}

function validatePlan(body, fails) {
  for (const s of ['Scope', 'Objectives', 'Entry criteria', 'Exit criteria']) {
    const hit = field(body, s) || section(body, s)
    if (!hit) fails.push(`missing field/section: ${s}`)
  }
  if (!/##\s*Test scenarios/i.test(body)) fails.push('missing section: Test scenarios')
  else if (!/\bSC-\d+|\bTC-/i.test(body) && !/^\s*[-*]\s+\S/m.test(section(body.match(/##\s*Test scenarios[\s\S]*/i)?.[0] ?? '')))
    fails.push('Test scenarios has no scenario items')
}

function run(file, forcedType) {
  if (!existsSync(file)) return { file, fails: ['file not found'], warns: [], type: '?' }
  const raw = readFileSync(file, 'utf8')
  const body = stripFences(raw)
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ''
  const type = forcedType || detect(body, title)
  const fails = []
  const warns = []

  if (!title) fails.push('no H1 title found')

  const ph = placeholders(body)
  if (ph.length) fails.push(`${ph.length} unfilled placeholder(s), first on line ${ph[0]}`)
  const todos = raw.split(/\r?\n/).map((l, i) => (/TODO:/i.test(l) ? i + 1 : 0)).filter(Boolean)
  if (todos.length) fails.push(`${todos.length} leftover TODO:, first on line ${todos[0]}`)

  if (type === 'test-case') validateCase(body, fails, warns)
  else if (type === 'bug-report') validateBug(body, fails, warns)
  else if (type === 'test-plan') validatePlan(body, fails)
  else fails.push(`unknown artifact type "${type}"`)

  return { file, type, fails, warns }
}

function report(r) {
  const out = [`ARTIFACT: ${r.file}`, `type: ${r.type}`]
  for (const f of r.fails) out.push(`FAIL  ${f}`)
  for (const w of r.warns) out.push(`WARN  ${w}`)
  out.push(
    r.fails.length
      ? `${r.fails.length} failed, ${r.warns.length} warning(s) — fix before use`
      : `PASS  ${r.warns.length} warning(s)`,
  )
  return out.join('\n')
}

const argv = process.argv.slice(2)
let forcedType = null
const files = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--type') forcedType = argv[++i]
  else files.push(argv[i])
}
if (!files.length) {
  console.log('usage: node validate_artifacts.mjs <file.md> [more.md ...] [--type test-case|bug-report|test-plan]')
  process.exit(2)
}

const results = files.map((f) => run(f, forcedType))
for (const r of results) console.log(report(r) + '\n')
const failed = results.filter((r) => r.fails.length).length
process.exit(failed ? 1 : 0)
