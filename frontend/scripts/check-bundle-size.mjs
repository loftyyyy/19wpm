import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const budgets = JSON.parse(
  await readFile(path.join(root, 'performance-budgets.json'), 'utf8')
);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const files = await walk(dist);
const assets = [];
for (const file of files) {
  if (!/\.(js|css)$/.test(file)) continue;
  const contents = await readFile(file);
  assets.push({
    relative: path.relative(dist, file).replaceAll(path.sep, '/'),
    bytes: contents.byteLength,
    gzipBytes: gzipSync(contents).byteLength,
  });
}

const indexHtml = await readFile(path.join(dist, 'index.html'), 'utf8');
const initialAssets = new Set(
  [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) =>
    match[1].replace(/^\//, '')
  )
);

const jsAssets = assets.filter((asset) => asset.relative.endsWith('.js'));
const cssAssets = assets.filter((asset) => asset.relative.endsWith('.css'));
const initialBytes = assets
  .filter((asset) => initialAssets.has(asset.relative))
  .reduce((total, asset) => total + asset.gzipBytes, 0);
const totalJsGzipBytes = jsAssets.reduce(
  (total, asset) => total + asset.gzipBytes,
  0
);
const totalCssGzipBytes = cssAssets.reduce(
  (total, asset) => total + asset.gzipBytes,
  0
);
const largestJsGzipBytes = Math.max(
  0,
  ...jsAssets.map((asset) => asset.gzipBytes)
);

const checks = [
  ['Total JavaScript (gzip)', totalJsGzipBytes, budgets.totalJsGzipBytes],
  ['Initial JS + CSS (gzip)', initialBytes, budgets.initialGzipBytes],
  ['Largest JavaScript chunk (gzip)', largestJsGzipBytes, budgets.largestJsGzipBytes],
  ['Total CSS (gzip)', totalCssGzipBytes, budgets.totalCssGzipBytes],
];

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
let failed = false;

for (const [label, actual, budget] of checks) {
  const passed = actual <= budget;
  failed ||= !passed;
  console.log(
    `${passed ? 'PASS' : 'FAIL'} ${label}: ${formatKb(actual)} / ${formatKb(budget)}`
  );
}

if (failed) {
  console.error('\nBundle budget exceeded. Reduce the payload or update performance-budgets.json with justification.');
  process.exitCode = 1;
} else {
  console.log('\nBundle budgets passed.');
}
