/**
 * Keystroke latency benchmark for the solo typing surface.
 *
 * Reads the app's own performance measures (`19wpm:keystroke`), which wrap the
 * keydown handler and the layout effect that commits the keystroke to the DOM.
 * The number reported here is therefore keydown -> committed layout, not paint:
 * it isolates the engine/render cost a change is responsible for.
 *
 * Usage:
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/bench.js
 *   node scripts/bench.js --json
 *   BUDGET_P95_MS=8 node scripts/bench.js     # exits 1 when p95 regresses
 *
 * Env:
 *   BASE_URL       default http://localhost:4173
 *   CHROME         default C:/Program Files/Google/Chrome/Application/chrome.exe
 *   WARMUP_KEYS    keystrokes discarded before sampling (default 80)
 *   SAMPLE_KEYS    keystrokes sampled (default 200)
 *   KEY_INTERVAL_MS  delay between synthetic keys (default 12)
 *   BUDGET_P95_MS  optional p95 gate in milliseconds
 */
import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WARMUP_KEYS = Number(process.env.WARMUP_KEYS ?? 80);
const SAMPLE_KEYS = Number(process.env.SAMPLE_KEYS ?? 200);
const KEY_INTERVAL_MS = Number(process.env.KEY_INTERVAL_MS ?? 12);
const BUDGET_P95_MS = process.env.BUDGET_P95_MS ? Number(process.env.BUDGET_P95_MS) : null;
const JSON_OUTPUT = process.argv.includes('--json');

const KEYSTROKE_MEASURE = '19wpm:keystroke';
const VIEWPORT_MEASURE = '19wpm:viewport';

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(durations) {
  if (durations.length === 0) return null;
  const sorted = [...durations].sort((a, b) => a - b);
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  return {
    n: durations.length,
    mean: Number(mean.toFixed(2)),
    p50: Number(percentile(sorted, 50).toFixed(2)),
    p95: Number(percentile(sorted, 95).toFixed(2)),
    p99: Number(percentile(sorted, 99).toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

function pad(value, width) {
  return String(value).padStart(width);
}

function printRow(label, stats) {
  if (!stats) {
    console.log(`${label.padEnd(10)} (no samples)`);
    return;
  }
  console.log(
    `${label.padEnd(10)}${pad(stats.n, 6)}${pad(stats.mean, 9)}${pad(stats.p50, 8)}${pad(stats.p95, 8)}${pad(stats.p99, 8)}${pad(stats.max, 8)}`
  );
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

let exitCode = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto(`${BASE_URL}/solo?mode=words&count=100`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelectorAll('.typing-cursor').length > 0 && !document.body.innerText.includes('Loading passage'),
    { timeout: 20000 }
  );

  const passageText = await page.evaluate(() => {
    const cursor = document.querySelector('.typing-cursor');
    const content = cursor?.parentElement;
    if (!content) return '';
    return [...content.children]
      .filter((element) => element !== cursor)
      .map((element) => element.textContent ?? '')
      .join(' ');
  });

  if (passageText.length === 0) throw new Error('Could not read the passage text from the DOM');

  const warmup = passageText.slice(0, Math.min(WARMUP_KEYS, passageText.length));
  const sample = passageText.slice(warmup.length, warmup.length + SAMPLE_KEYS);
  if (sample.length === 0) throw new Error('Passage is too short for the requested warmup + sample keystrokes');

  await page.focus('div[tabindex="0"]');
  await page.keyboard.type(warmup, { delay: KEY_INTERVAL_MS });

  await page.evaluate(
    (names) => names.forEach((name) => performance.clearMeasures(name)),
    [KEYSTROKE_MEASURE, VIEWPORT_MEASURE]
  );

  await page.keyboard.type(sample, { delay: KEY_INTERVAL_MS });
  await new Promise((resolve) => setTimeout(resolve, 200));

  const samples = await page.evaluate(
    (names) => {
      const entries = performance.getEntriesByType('measure');
      const collect = (name) => entries.filter((entry) => entry.name === name).map((entry) => entry.duration);
      return { keystroke: collect(names[0]), viewport: collect(names[1]) };
    },
    [KEYSTROKE_MEASURE, VIEWPORT_MEASURE]
  );

  const keystroke = summarize(samples.keystroke);
  const viewport = summarize(samples.viewport);

  if (!keystroke) {
    throw new Error(`No ${KEYSTROKE_MEASURE} measures were recorded; is the solo surface mounted and focused?`);
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ baseUrl: BASE_URL, keystroke, viewport, runtimeErrors }, null, 2));
  } else {
    console.log(`\nSolo keystroke latency @ ${BASE_URL}`);
    console.log(`sampled ${sample.length} keys (interval ${KEY_INTERVAL_MS} ms, warmup ${warmup.length})`);
    console.log('\nmetric         n     mean     p50     p95     p99     max   (ms)');
    printRow('keystroke', keystroke);
    printRow('viewport', viewport);
    console.log('');
  }

  if (runtimeErrors.length > 0) {
    console.error(`Runtime errors during the run:\n  ${runtimeErrors.join('\n  ')}`);
    exitCode = 1;
  }

  if (BUDGET_P95_MS !== null) {
    if (keystroke.p95 > BUDGET_P95_MS) {
      console.error(`keystroke p95 ${keystroke.p95} ms exceeds the ${BUDGET_P95_MS} ms budget`);
      exitCode = 1;
    } else if (!JSON_OUTPUT) {
      console.log(`keystroke p95 ${keystroke.p95} ms within the ${BUDGET_P95_MS} ms budget`);
    }
  }
} catch (error) {
  console.error(`Benchmark failed: ${error instanceof Error ? error.message : error}`);
  exitCode = 1;
} finally {
  await browser.close();
}

process.exit(exitCode);
