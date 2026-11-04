/**
 * Permanent headless verification for the solo typing surface.
 *
 * Runs against a production preview build (dev StrictMode double-renders and
 * would make the render budget meaningless). By default the script starts and
 * stops `vite preview` itself, so `npm run verify:typing` is a single command:
 *
 *   npm run build
 *   npm run verify:typing
 *
 * Checks:
 *   - words mode: a 60-key burst re-renders the typing container at most
 *     RENDER_BUDGET times (`19wpm:render:typing-test`);
 *   - Tab reset: one keystroke edge and one reset edge, no per-key renders;
 *   - words mode finish: full passage -> /results, counters and replay events;
 *   - replay: the play control starts playback and characters are replayed;
 *   - timed finish: a 15 s run ends itself, with ~15 s duration and history.
 *
 * Env:
 *   BASE_URL              reuse an already running server instead of spawning
 *   VERIFY_PORT           preview port when spawning (default 4179)
 *   CHROME                Chrome executable (defaults to common install paths)
 *   RENDER_BUDGET         max container renders for the 60-key burst (default 3)
 *   RESET_RENDER_BUDGET   max container renders for Tab reset (default 4)
 */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST_INDEX = join(ROOT, 'dist', 'index.html');
const PORT = Number(process.env.VERIFY_PORT || 4179);
const EXTERNAL_BASE = process.env.BASE_URL || '';
const BASE_URL = EXTERNAL_BASE || `http://127.0.0.1:${PORT}`;
const RENDER_BUDGET = Number(process.env.RENDER_BUDGET ?? 3);
const RESET_RENDER_BUDGET = Number(process.env.RESET_RENDER_BUDGET ?? 4);
const RENDER_MARK = '19wpm:render:typing-test';

const CHROME_CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Chrome not found. Set CHROME to a Chrome or Edge executable, for example:\n' +
    '  $env:CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"'
  );
}

async function waitForServer(url, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`Preview server did not answer at ${url}: ${lastError?.message ?? 'timeout'}`);
}

function startPreview() {
  const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) throw new Error(`Vite CLI not found at ${viteBin}`);

  const child = spawn(
    process.execPath,
    [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, getOutput: () => output };
}

function stopPreview(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

async function waitForTypingReady(page) {
  await page.waitForFunction(() => {
    const cursor = document.querySelector('.typing-cursor');
    return cursor !== null && !document.body.innerText.includes('Loading passage');
  }, { timeout: 20000 });
}

async function readPassage(page) {
  const passage = await page.evaluate(() => {
    const cursor = document.querySelector('.typing-cursor');
    const content = cursor?.parentElement;
    if (!content) return '';
    return [...content.children]
      .filter((element) => element !== cursor)
      .map((element) => element.textContent ?? '')
      .join(' ');
  });
  if (!passage) throw new Error('Could not read the passage text from the DOM');
  return passage;
}

async function clearRenderMarks(page) {
  await page.evaluate((name) => performance.clearMarks(name), RENDER_MARK);
}

async function countRenderMarks(page) {
  return page.evaluate(
    (name) => performance.getEntriesByName(name, 'mark').length,
    RENDER_MARK
  );
}

async function focusTyping(page) {
  await page.focus('div[tabindex="0"]');
}

async function readStoredResult(page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem('19wpm-last-result');
    return raw ? JSON.parse(raw) : null;
  });
}

async function countTypedChars(page) {
  return page.evaluate(
    () => document.querySelectorAll('.char-correct, .char-incorrect').length
  );
}

async function openSolo(browser, path) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: 30000 });
  await waitForTypingReady(page);
  return { page, runtimeErrors };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [];
async function runCheck(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, error });
    console.log(`[FAIL] ${name}`);
    console.log(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertNoRuntimeErrors(runtimeErrors) {
  assert(runtimeErrors.length === 0, `runtime errors: ${runtimeErrors.join(' | ')}`);
}

let preview = null;
let browser = null;

try {
  if (!EXTERNAL_BASE) {
    if (!existsSync(DIST_INDEX)) {
      throw new Error('No production build found. Run `npm run build` before `npm run verify:typing`.');
    }
    preview = startPreview();
    try {
      await waitForServer(BASE_URL);
    } catch (error) {
      throw new Error(`${error.message}\n--- vite preview output ---\n${preview.getOutput()}`);
    }
    console.log(`Preview: ${BASE_URL}`);
  } else {
    await waitForServer(BASE_URL);
    console.log(`Using existing server: ${BASE_URL}`);
  }

  browser = await puppeteer.launch({
    executablePath: resolveChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 1. Words mode: a burst must not re-render the container per key.
  await runCheck('words mode: 60-key burst render budget', async () => {
    const { page, runtimeErrors } = await openSolo(browser, '/solo?mode=words&count=100');
    try {
      const passage = await readPassage(page);
      assert(passage.length >= 60, `passage too short for a 60-key burst (${passage.length} chars)`);

      await clearRenderMarks(page);
      await focusTyping(page);
      const burst = passage.slice(0, 60);
      await page.keyboard.type(burst, { delay: 6 });
      await sleep(150);

      const renders = await countRenderMarks(page);
      const typed = await countTypedChars(page);
      // Spaces live between word spans, so only non-space characters have a span.
      const expectedTyped = [...burst].filter((char) => char !== ' ').length;
      console.log(`       ${renders} container render(s) for 60 keys; ${typed} typed spans`);
      assert(
        typed >= expectedTyped - 1,
        `expected the burst to commit ~${expectedTyped} characters, found ${typed} typed spans`
      );
      assert(
        renders <= RENDER_BUDGET,
        `typing container rendered ${renders} times for 60 keys (budget ${RENDER_BUDGET})`
      );
      assertNoRuntimeErrors(runtimeErrors);
    } finally {
      await page.close();
    }
  });

  // 2. Tab reset: clears the run without a render per previous keystroke.
  await runCheck('words mode: Tab reset clears the run', async () => {
    const { page, runtimeErrors } = await openSolo(browser, '/solo?mode=words&count=100');
    try {
      const passage = await readPassage(page);
      await focusTyping(page);
      await page.keyboard.type(passage.slice(0, 40), { delay: 6 });
      await sleep(100);
      assert((await countTypedChars(page)) > 0, 'no characters were typed before the reset');

      await clearRenderMarks(page);
      await page.keyboard.press('Tab');
      await sleep(200);

      const renders = await countRenderMarks(page);
      const typed = await countTypedChars(page);
      assert(typed === 0, `reset left ${typed} typed spans behind`);
      assert(
        renders <= RESET_RENDER_BUDGET,
        `typing container rendered ${renders} times for Tab reset (budget ${RESET_RENDER_BUDGET})`
      );
      const body = await page.evaluate(() => document.body.innerText);
      assert(body.includes('Start typing to begin'), 'reset did not restore the idle prompt');
      console.log(`       ${renders} container render(s) for Tab reset; passage cleared`);
      assertNoRuntimeErrors(runtimeErrors);
    } finally {
      await page.close();
    }
  });

  // 3. Words mode finish -> results, result payload, and replay.
  await runCheck('words mode: finish navigates to /results with a replay', async () => {
    const { page, runtimeErrors } = await openSolo(browser, '/solo?mode=words&count=10');
    try {
      const passage = await readPassage(page);
      await focusTyping(page);
      await page.keyboard.type(passage, { delay: 6 });

      await page.waitForFunction(() => location.pathname === '/results', { timeout: 15000 });
      await page.waitForFunction(
        () => document.body.innerText.includes('Test Complete'),
        { timeout: 10000 }
      );
      const body = await page.evaluate(() => document.body.innerText);
      assert(body.includes('Test Complete'), 'results page did not render its heading');

      const result = await readStoredResult(page);
      assert(result !== null, 'no result was stored in sessionStorage');
      assert(result.passage === passage, 'stored result passage does not match the typed passage');
      assert(result.accuracy === 100, `expected 100% accuracy, got ${result.accuracy}%`);
      assert(
        result.replayEvents.length >= passage.length,
        `expected >= ${passage.length} replay events, got ${result.replayEvents.length}`
      );

      assert(body.includes('Watch Replay'), 'results page has no replay section');
      await page.click('button[title="Play"]');
      await page.waitForFunction(
        () => document.body.innerText.includes('Replaying') || document.body.innerText.includes('Replay Complete'),
        { timeout: 5000 }
      );
      await page.waitForFunction(
        () => document.body.innerText.includes('Replay Complete'),
        { timeout: 15000 }
      );
      const replayed = await page.evaluate(
        () => document.querySelectorAll('.char-correct').length
      );
      assert(replayed > 0, 'replay finished without marking any character correct');
      console.log(`       /results, ${result.replayEvents.length} replay events, ${replayed} chars replayed`);
      assertNoRuntimeErrors(runtimeErrors);
    } finally {
      await page.close();
    }
  });

  // 4. Timed mode: the test must finish itself and record a full history.
  await runCheck('timed mode: 15 s run finishes with history', async () => {
    const { page, runtimeErrors } = await openSolo(browser, '/solo?mode=time&time=15');
    try {
      const passage = await readPassage(page);
      await focusTyping(page);
      await page.keyboard.type(passage.slice(0, 20), { delay: 8 });

      await page.waitForFunction(() => location.pathname === '/results', { timeout: 25000 });
      await page.waitForFunction(
        () => document.body.innerText.includes('Test Complete'),
        { timeout: 10000 }
      );
      const result = await readStoredResult(page);
      assert(result !== null, 'no timed result was stored in sessionStorage');
      assert(result.testMode === 'timed', `expected a timed result, got ${result.testMode}`);
      assert(
        result.duration >= 14 && result.duration <= 16,
        `expected a ~15 s duration, got ${result.duration}`
      );
      assert(
        result.wpmHistory.length >= 15,
        `expected >= 15 history points, got ${result.wpmHistory.length}`
      );
      console.log(
        `       finished in ${result.duration}s with ${result.wpmHistory.length} history points`
      );
      assertNoRuntimeErrors(runtimeErrors);
    } finally {
      await page.close();
    }
  });
} catch (error) {
  console.error(`\nVerification could not run: ${error instanceof Error ? error.message : error}`);
  checks.push({ name: 'setup', ok: false, error });
} finally {
  if (browser) await browser.close();
  stopPreview(preview?.child);
  if (preview) await sleep(300);
}

const failed = checks.filter((check) => !check.ok);
console.log('');
if (failed.length === 0 && checks.length === 4) {
  console.log('ALL TYPING CHECKS PASSED');
  process.exit(0);
}
console.log(`${failed.length || checks.length} CHECK(S) FAILED`);
process.exit(1);
