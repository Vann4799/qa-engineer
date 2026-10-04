#!/usr/bin/env node
// Repo test suite: the validator, exporter and scaffolder must behave as
// documented, and the skill folder must keep the shape its own conventions
// demand. Dependency-free; run with `node tests/run.mjs`. Exit 0 = all passed.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL = join(ROOT, 'skills', 'qa-engineer')
const VALIDATE = join(SKILL, 'scripts', 'validate_artifacts.mjs')
const EXPORT = join(SKILL, 'scripts', 'export_qa.mjs')
const SCAFFOLD = join(SKILL, 'scripts', 'scaffold_playwright.mjs')
const FIX = join(ROOT, 'tests', 'fixtures')
const GOOD_CASE = join(FIX, 'good', 'case.md')
const GOOD_BUG = join(FIX, 'good', 'bug.md')
const GOOD_PLAN = join(FIX, 'good', 'plan.md')
const GOOD_TRACE = join(FIX, 'good', 'trace.md')
const BAD_BUG = join(FIX, 'bad', 'bug.md')

let failed = 0
let ran = 0
const check = (name, ok, detail = '') => {
  ran++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}
const run = (script, args) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' }) }
  } catch (e) {
    return { code: e.status ?? -1, out: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

/* ---- validator: good artifacts pass clean ---- */

for (const [label, file, type] of [
  ['test case', GOOD_CASE, 'test-case'],
  ['bug report', GOOD_BUG, 'bug-report'],
  ['test plan', GOOD_PLAN, 'test-plan'],
]) {
  const r = run(VALIDATE, [file])
  check(`a clean ${label} passes`, r.code === 0 && /\bPASS\b/.test(r.out), r.out)
  check(`and is detected as ${type}`, new RegExp(`type:\\s*${type}`).test(r.out), r.out)
  check(`and reports zero warnings`, /0 warning\(s\)/.test(r.out), r.out)
}

/* ---- validator: a broken bug report exits non-zero and names each fault ---- */

const bad = run(VALIDATE, [BAD_BUG])
check('a broken bug report exits non-zero', bad.code === 1, `exit ${bad.code}`)
for (const [label, needle] of [
  ['unfilled placeholder is a FAIL', /FAIL.*unfilled placeholder/s],
  ['leftover TODO is a FAIL', /FAIL.*leftover TODO/s],
  ['a bad Severity is a FAIL', /FAIL.*Severity "Super-bad"/s],
  ['a bad Priority is a FAIL', /FAIL.*Priority "P9"/s],
  ['a missing Actual section is a FAIL', /FAIL.*Actual/s],
  ['a missing Evidence section is a FAIL', /FAIL.*Evidence/s],
])
  check(label, needle.test(bad.out), 'not reported')

check('the validator exits 2 with no files', run(VALIDATE, []).code === 2)
check('a missing file is a FAIL, not a crash', run(VALIDATE, [join(FIX, 'nope.md')]).code === 1)

/* ---- exporter ---- */

const out = mkdtempSync(join(tmpdir(), 'qa-export-'))
const exp = run(EXPORT, [GOOD_CASE, GOOD_BUG, GOOD_TRACE, '--out', out])
check('the exporter exits 0', exp.code === 0, exp.out)
for (const f of ['qa-test-cases.csv', 'qa-bugs.csv', 'qa-traceability.csv', 'qa-summary.csv'])
  check(`and writes ${f}`, existsSync(join(out, f)))

const casesCsv = readFileSync(join(out, 'qa-test-cases.csv'), 'utf8')
check('the cases CSV carries a UTF-8 BOM for Excel', casesCsv.charCodeAt(0) === 0xfeff)
check('and the test case id survived parsing', casesCsv.includes('TC-LOGIN-001'), casesCsv.slice(0, 120))
const bugsCsv = readFileSync(join(out, 'qa-bugs.csv'), 'utf8')
check('the bugs CSV carries the severity', bugsCsv.includes('Major'), bugsCsv.slice(0, 120))
const traceCsv = readFileSync(join(out, 'qa-traceability.csv'), 'utf8')
check('the traceability table became rows', traceCsv.includes('TC-CHECKOUT-004'), traceCsv.slice(0, 120))
const sumCsv = readFileSync(join(out, 'qa-summary.csv'), 'utf8')
check('the summary counts one case and one bug', /test cases \(total\),1/.test(sumCsv) && /bugs \(total\),1/.test(sumCsv), sumCsv)
check('the exporter exits 2 with no files', run(EXPORT, []).code === 2)
rmSync(out, { recursive: true, force: true })

/* ---- scaffolder ---- */

const scaffoldDir = mkdtempSync(join(tmpdir(), 'qa-scaffold-'))
rmSync(scaffoldDir, { recursive: true, force: true }) // start from a path that does not exist
const sc = run(SCAFFOLD, [scaffoldDir])
check('the scaffolder exits 0', sc.code === 0, sc.out)
for (const f of ['package.json', 'playwright.config.ts', 'pages/LoginPage.ts', 'specs/login.spec.ts'])
  check(`and writes ${f}`, existsSync(join(scaffoldDir, f)))
check('a second run refuses to clobber without --force', run(SCAFFOLD, [scaffoldDir]).code === 1)
check('--force overwrites', run(SCAFFOLD, [scaffoldDir, '--force']).code === 0)
rmSync(scaffoldDir, { recursive: true, force: true })

/* ---- skill shape (the conventions this repo was built to) ---- */

const skillMd = readFileSync(join(SKILL, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')
const fm = skillMd.match(/^---\n([\s\S]*?)\n---/)
check('SKILL.md has frontmatter', !!fm)
check('frontmatter names the skill', /^name: qa-engineer$/m.test(fm?.[1] ?? ''))
const desc = (fm?.[1] ?? '').match(/^description: >-\n([\s\S]*?)^\w/m)?.[1] ?? ''
check('description is a single trigger paragraph under 1024 chars', desc.length > 80 && desc.length <= 1024, `${desc.length} chars`)
check('body stays under 500 lines', skillMd.split('\n').length < 500)
check('no README or CHANGELOG inside the skill folder',
  !readdirSync(SKILL).some((f) => /^(README|CHANGELOG|CONTRIBUTING)\.md$/i.test(f)))

const mentioned = new Set([...skillMd.matchAll(/(?:references|assets|scripts)\/[\w.-]+/g)].map((m) => m[0]))
for (const dir of ['references', 'assets', 'scripts'])
  for (const f of readdirSync(join(SKILL, dir)))
    check(`${dir}/${f} is referenced from SKILL.md`, mentioned.has(`${dir}/${f}`))

/* ---- repo shape ---- */

for (const f of ['README.md', 'LICENSE', 'package.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'cli/index.mjs'])
  check(`${f} exists`, existsSync(join(ROOT, f)))
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
check('the npm package declares the installer as its bin', pkg.bin?.['qa-engineer'] === 'cli/index.mjs')
check('and ships the skill folder it installs', (pkg.files ?? []).includes('skills'))
const plugin = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'))
check('the plugin manifest points at the skill folder', plugin.skills?.includes('./skills/'))
const market = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'))
check('the marketplace name is unique to this repo', market.name === 'vann4799-qa')
const version = skillMd.match(/^version:\s*([\d.]+)$/m)?.[1]
check(`SKILL.md, package.json and plugin.json agree on version (${version})`,
  version === plugin.version && version === pkg.version)

/* ---- installer ---- */

const CLI = join(ROOT, 'cli', 'index.mjs')
const listed = run(CLI, ['--list'])
check('the installer lists every host',
  listed.code === 0 && ['Claude Code', 'Codex / OpenCode', 'Qoder CLI', 'Hermes Agent'].every((l) => listed.out.includes(l)), listed.out)
check('and names the Hermes command instead of copying it', /hermes skills add/.test(listed.out))

const sandbox = mkdtempSync(join(tmpdir(), 'qa-host-'))
const first = run(CLI, ['--dir', sandbox])
check('the installer copies the skill into a host directory',
  first.code === 0 && existsSync(join(sandbox, 'qa-engineer', 'SKILL.md')), first.out)
check('including the reference files', existsSync(join(sandbox, 'qa-engineer', 'references', 'testing-fundamentals.md')))
const second = run(CLI, ['--dir', sandbox])
check('a second run refuses to clobber without --force', /already installed/.test(second.out), second.out)
check('--force overwrites', run(CLI, ['--dir', sandbox, '--force']).code === 0)
check('the installed copy still validates its own fixture',
  run(join(sandbox, 'qa-engineer', 'scripts', 'validate_artifacts.mjs'), [GOOD_CASE]).code === 0)
rmSync(sandbox, { recursive: true, force: true })

console.log(failed ? `\n${failed} of ${ran} check(s) failed` : `\n${ran} checks passed`)
process.exit(failed ? 1 : 0)
