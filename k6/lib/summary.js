import { BASE_URL, RUN_ID } from '../config.js';

const BUILT_INS = {
  checks: true,
  data_received: true,
  data_sent: true,
  dropped_iterations: true,
  http_req_blocked: true,
  http_req_connecting: true,
  http_req_duration: true,
  http_req_failed: true,
  http_req_receiving: true,
  http_req_sending: true,
  http_req_tls_handshaking: true,
  http_req_waiting: true,
  http_reqs: true,
  iteration_duration: true,
  iterations: true,
  vus: true,
  vus_max: true,
};

function metricValues(metric) {
  const values = metric.values || {};
  const out = {};
  Object.keys(values).forEach((key) => {
    out[key] = values[key];
  });
  return out;
}

function metricSnapshot(data) {
  const metrics = {};
  Object.keys(data.metrics).forEach((name) => {
    const metric = data.metrics[name];
    metrics[name] = {
      type: metric.type,
      contains: metric.contains,
      values: metricValues(metric),
      thresholds: metric.thresholds || {},
    };
  });
  return metrics;
}

function fmt(value, digits) {
  if (value === undefined || value === null) return 'n/a';
  if (typeof value !== 'number') return String(value);
  return value.toFixed(digits === undefined ? 2 : digits);
}

function thresholdLines(metrics) {
  const lines = [];
  Object.keys(metrics).forEach((name) => {
    const thresholds = metrics[name].thresholds || {};
    Object.keys(thresholds).forEach((expression) => {
      const result = thresholds[expression];
      const ok = typeof result === 'object' ? result.ok : result;
      lines.push(`  [${ok ? 'PASS' : 'FAIL'}] ${name}: ${expression}`);
    });
  });
  return lines;
}

function customLines(metrics) {
  const lines = [];
  Object.keys(metrics).sort().forEach((name) => {
    if (BUILT_INS[name]) return;
    const metric = metrics[name];
    const values = metric.values || {};
    if (metric.type === 'trend') {
      lines.push(`  ${name}: avg=${fmt(values.avg)}ms p95=${fmt(values['p(95)'])}ms p99=${fmt(values['p(99)'])}ms max=${fmt(values.max)}ms`);
    } else if (metric.type === 'counter') {
      lines.push(`  ${name}: ${fmt(values.count, 0)}`);
    } else if (metric.type === 'rate') {
      lines.push(`  ${name}: ${fmt(values.rate * 100)}%`);
    } else if (metric.type === 'gauge') {
      lines.push(`  ${name}: ${fmt(values.value)}`);
    }
  });
  return lines;
}

function humanSummary(data, meta) {
  const metrics = data.metrics || {};
  const checks = metrics.checks ? metrics.checks.values : {};
  const duration = metrics.http_req_duration ? metrics.http_req_duration.values : {};
  const reqs = metrics.http_reqs ? metrics.http_reqs.values : {};
  const failed = metrics.http_req_failed ? metrics.http_req_failed.values : {};
  const iterations = metrics.iterations ? metrics.iterations.values : {};
  const vusMax = metrics.vus_max ? metrics.vus_max.values : {};
  const thresholds = thresholdLines(metrics);

  const lines = [];
  lines.push(`Test: ${meta.name}`);
  lines.push(`Run ID: ${RUN_ID}`);
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Checks: ${fmt(checks.rate * 100)}% (${checks.passes || 0} passed / ${checks.fails || 0} failed)`);
  lines.push(`HTTP requests: ${fmt(reqs.count, 0)}`);
  lines.push(`HTTP error rate: ${fmt(failed.rate * 100)}%`);
  lines.push(`HTTP duration: avg=${fmt(duration.avg)}ms p95=${fmt(duration['p(95)'])}ms p99=${fmt(duration['p(99)'])}ms max=${fmt(duration.max)}ms`);
  lines.push(`Iterations: ${fmt(iterations.count, 0)}`);
  lines.push(`Max VUs: ${fmt(vusMax.max, 0)}`);
  if (meta.notes) {
    lines.push('');
    lines.push('Notes:');
    meta.notes.forEach((note) => lines.push(`  - ${note}`));
  }
  lines.push('');
  lines.push('Thresholds:');
  if (thresholds.length === 0) {
    lines.push('  none');
  } else {
    thresholds.forEach((line) => lines.push(line));
  }
  lines.push('');
  lines.push('Custom metrics:');
  const custom = customLines(metrics);
  if (custom.length === 0) {
    lines.push('  none');
  } else {
    custom.forEach((line) => lines.push(line));
  }
  lines.push('');
  return lines.join('\n');
}

export function makeSummary(meta) {
  return function handleSummary(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = meta.name.replace(/[^a-zA-Z0-9_-]/g, '-');
    const report = {
      test: meta.name,
      run_id: RUN_ID,
      base_url: BASE_URL,
      generated_at: new Date().toISOString(),
      notes: meta.notes || [],
      metrics: metricSnapshot(data),
    };
    const text = humanSummary(data, meta);
    return {
      [`results/${safeName}-${timestamp}.json`]: JSON.stringify(report, null, 2),
      [`results/${safeName}-${timestamp}.txt`]: text,
      stdout: text,
    };
  };
}
