#!/usr/bin/env node
'use strict';

/**
 * Sync docs/TEST_CASES.md Status/Actual Result/Defect Raised fields from a real
 * Playwright run, instead of hand-editing the matrix after each manual test pass.
 *
 * Run: node tools/sync-test-cases.js
 * Reads:  playwright-report/results.json (Playwright JSON reporter output)
 *         docs/coverage/coverage-summary.json (informational console summary only)
 * Writes: docs/TEST_CASES.md (Status/Actual Result/Defect Raised lines only, for
 *         TC-XXXX blocks whose title has a matching "TC-XXXX: ..." Playwright spec)
 * Then:   node tools/generate-plan.js (regenerates the dashboard)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseCoverage } = require('./lib/parse-coverage');

const ROOT = path.join(__dirname, '..');
const RESULTS_PATH = path.join(ROOT, 'playwright-report', 'results.json');
const TEST_CASES_PATH = path.join(ROOT, 'docs', 'TEST_CASES.md');
const COVERAGE_SUMMARY_PATH = path.join(ROOT, 'docs', 'coverage', 'coverage-summary.json');

const TC_TITLE_RE = /^TC-(\d+):/;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Playwright's outcome per test is derived from its `results[].status` entries;
// `test.status` (the "expected"/"unexpected"/"flaky"/"skipped" summary) maps more
// directly to what we want here.
function outcomeToStatus(outcome) {
  if (outcome === 'expected') return 'Pass';
  if (outcome === 'skipped') return 'Not Run';
  // 'unexpected' (failed) and 'flaky' both surface as a Fail worth investigating.
  return 'Fail';
}

// Walk Playwright's JSON reporter tree (suites nest arbitrarily via `suites`,
// each leaf `specs[]` entry has a `title` and `tests[]` with the actual outcome).
function collectSpecResults(node, out) {
  if (!node) return;
  for (const spec of node.specs || []) {
    const match = TC_TITLE_RE.exec(spec.title);
    if (!match) continue;
    const tcId = `TC-${match[1]}`;
    const test = (spec.tests || [])[0];
    const outcome = test ? test.status : 'skipped';
    const existing = out.get(tcId);
    // If the same TC title appears in more than one project run, prefer a Fail
    // over a Pass so a flaky/failing project isn't hidden by a passing one.
    if (!existing || (outcomeToStatus(outcome) === 'Fail' && existing.status !== 'Fail')) {
      out.set(tcId, { status: outcomeToStatus(outcome), title: spec.title });
    }
  }
  for (const suite of node.suites || []) {
    collectSpecResults(suite, out);
  }
}

function buildResultMap(resultsJson) {
  const out = new Map();
  for (const suite of resultsJson.suites || []) {
    collectSpecResults(suite, out);
  }
  return out;
}

// Mirrors tools/lib/parse-test-cases.js's block-boundary convention: a TC block
// runs from one "^TC-\d+:" line up to (but not including) the next one.
function findBlockRanges(markdown) {
  const re = /^TC-(\d+):/gm;
  const starts = [];
  let match;
  while ((match = re.exec(markdown)) !== null) {
    starts.push({ id: `TC-${match[1]}`, index: match.index });
  }
  return starts.map((s, i) => ({
    id: s.id,
    start: s.index,
    end: i + 1 < starts.length ? starts[i + 1].index : markdown.length,
  }));
}

function rewriteBlock(block, tcId, result, today) {
  const currentDefectMatch = block.match(/^Defect Raised:[ \t]*(.+)$/m);
  const currentDefect = currentDefectMatch ? currentDefectMatch[1].trim() : 'None';

  const statusMark = result.status === 'Pass' ? '[x] Pass' : result.status === 'Fail' ? '[x] Fail' : '[ ] Not Run';
  const actualResult =
    result.status === 'Not Run'
      ? `Skipped in Playwright run (npx playwright test), ${today}.`
      : `Synced from Playwright run (npx playwright test), ${today}. Spec "${result.title}" ${
          result.status === 'Pass' ? 'passed' : 'failed'
        }.`;

  // A fresh pass clears any prior defect reference; a fail keeps whatever bug ID
  // was already recorded (this script never invents a new bug ID).
  const nextDefect = result.status === 'Pass' ? 'None' : currentDefect;

  let next = block;
  next = next.replace(/^Actual Result:.*$/m, `Actual Result: ${actualResult}`);
  next = next.replace(/^Status:.*$/m, `Status: ${statusMark}`);
  next = next.replace(/^Defect Raised:.*$/m, `Defect Raised: ${nextDefect}`);
  return { next, tcId, previousStatus: block.match(/^Status:.*$/m)?.[0], nextStatus: `Status: ${statusMark}` };
}

function syncTestCases(resultMap) {
  const markdown = fs.readFileSync(TEST_CASES_PATH, 'utf8');
  const blocks = findBlockRanges(markdown);
  const today = new Date().toISOString().slice(0, 10);

  let output = markdown;
  let changedCount = 0;
  const touched = [];

  // Rewrite back-to-front so earlier offsets stay valid as we splice.
  for (let i = blocks.length - 1; i >= 0; i--) {
    const { id, start, end } = blocks[i];
    const result = resultMap.get(id);
    if (!result) continue; // no matching Playwright title — leave completely untouched

    const block = output.slice(start, end);
    const { next, previousStatus, nextStatus } = rewriteBlock(block, id, result, today);
    if (next !== block) {
      changedCount += 1;
      touched.push({ id, previousStatus, nextStatus });
    }
    output = output.slice(0, start) + next + output.slice(end);
  }

  if (changedCount > 0) {
    fs.writeFileSync(TEST_CASES_PATH, output);
  }

  return { changedCount, touched, totalMatched: resultMap.size };
}

function printCoverageSummary() {
  const summaryJson = readJson(COVERAGE_SUMMARY_PATH);
  const coverage = parseCoverage(summaryJson);
  if (!coverage.available) {
    console.log('[sync-test-cases] No coverage summary found (run `npm run test:coverage` to generate one).');
    return;
  }
  console.log(
    `[sync-test-cases] Jest coverage — lines ${coverage.lines.toFixed(1)}%, statements ${coverage.statements.toFixed(
      1
    )}%, functions ${coverage.functions.toFixed(1)}%, branches ${coverage.branches.toFixed(1)}%`
  );
}

function main() {
  const resultsJson = readJson(RESULTS_PATH);
  if (!resultsJson) {
    console.error(
      `[sync-test-cases] No Playwright results found at ${path.relative(ROOT, RESULTS_PATH)}. ` +
        'Run a Playwright test project first (the "json" reporter is configured in playwright.config.ts).'
    );
    process.exitCode = 1;
    return;
  }

  const resultMap = buildResultMap(resultsJson);
  const { changedCount, touched, totalMatched } = syncTestCases(resultMap);

  console.log(`[sync-test-cases] Matched ${totalMatched} TC-XXXX title(s) in the Playwright run.`);
  if (changedCount === 0) {
    console.log('[sync-test-cases] docs/TEST_CASES.md already up to date — no changes written.');
  } else {
    console.log(`[sync-test-cases] Updated ${changedCount} TC block(s) in docs/TEST_CASES.md:`);
    for (const t of touched) {
      console.log(`  ${t.id}: ${t.previousStatus?.trim() ?? '(unknown)'} -> ${t.nextStatus.trim()}`);
    }
  }

  printCoverageSummary();

  console.log('[sync-test-cases] Regenerating dashboard...');
  execSync('node tools/generate-plan.js', { cwd: ROOT, stdio: 'inherit' });
}

main();
