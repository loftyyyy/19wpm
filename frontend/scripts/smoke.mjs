import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'url';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const routes = [
  { path: '/', expectText: 'Type better. Race smarter.' },
  { path: '/solo', expectText: 'Loading passage...' },
  { path: '/results', expectText: 'No test result found.' },
  { path: '/login', expectText: 'Crafted for focused performance.' },
  { path: '/oauth2/callback', redirect: '/login' },
  { path: '/dashboard', redirect: '/login' },
  { path: '/create', redirect: '/login' },
  { path: '/compete', expectText: 'Compete' },
  { path: '/leaderboard', expectText: 'Leaderboard' },
  { path: '/about', expectText: 'About 19wpm' },
  { path: '/race', expectText: 'Sign in to compete' },
];

const isChunkish = (msg) =>
  /\.js|import|chunk|module script|SyntaxError|ReferenceError|TypeError|dynamically imported/i.test(msg);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

let failed = 0;
for (const r of routes) {
  const page = await browser.newPage();
  const chunkResponses = [];
  const chunkFailures = [];
  const consoleErrors = [];
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('/assets/') && u.endsWith('.js')) {
      chunkResponses.push(`${res.status()} ${u.split('/').pop()}`);
    }
  });
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.endsWith('.js')) chunkFailures.push(`FAILED ${u.split('/').pop()}: ${req.failure()?.errorText}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  let ok = false;
  let detail = '';
  try {
    await page.goto(`${BASE}${r.path}`, { waitUntil: 'load', timeout: 20000 });
    if (r.redirect) {
      await page.waitForFunction((target) => location.pathname === target, { timeout: 15000 }, r.redirect);
      ok = true;
      detail = `redirected to ${r.redirect}`;
    } else {
      await page.waitForFunction((text) => document.body.innerText.includes(text), { timeout: 15000 }, r.expectText);
      ok = true;
      detail = `found "${r.expectText}"`;
    }
  } catch (e) {
    detail = `ERROR: ${e.message}`;
  }
  if (!ok) failed++;
  const suspicious = consoleErrors.filter(isChunkish);
  const benign = consoleErrors.filter((m) => !isChunkish(m));
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${r.path}`);
  console.log(`      ${detail}`);
  console.log(`      chunks: ${chunkResponses.length ? chunkResponses.join(', ') : '(none)'}`);
  if (chunkFailures.length) console.log(`      CHUNK FAILURES: ${chunkFailures.join(' | ')}`);
  if (suspicious.length) console.log(`      SUSPICIOUS CONSOLE: ${suspicious.join(' | ')}`);
  if (benign.length) console.log(`      console (api/etc): ${benign.join(' | ')}`);
  await page.close();
}
await browser.close();
console.log(failed === 0 ? '\nALL ROUTES PASSED' : `\n${failed} ROUTE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
