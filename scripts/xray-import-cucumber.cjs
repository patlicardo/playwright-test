/**
 * Converts Cucumber JSON report to Xray /import/execution payload and uploads it.
 *
 * Target payload shape:
 * {
 *   "testExecutionKey": "PT-2",
 *   "tests": [
 *     { "testKey": "PT-1", "comment": "...", "status": "PASSED" }
 *   ]
 * }
 */
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const defaultBase = 'https://xray.cloud.getxray.app';
const reportPath = process.env.XRAY_CUCUMBER_JSON || 'cucumber-report/cucumber.json';
const jiraKeyRegex = /^[A-Z][A-Z0-9_]+-\d+$/;

function pickBase() {
  const b = (process.env.XRAY_BASE_URL || defaultBase).replace(/\/$/, '');
  if (!b.startsWith('https://')) {
    throw new Error('XRAY_BASE_URL must be an https origin');
  }
  return b;
}

function mapStatus(stepStatuses) {
  if (stepStatuses.some((s) => s === 'failed')) return 'FAILED';
  if (stepStatuses.some((s) => s === 'ambiguous' || s === 'undefined' || s === 'pending')) return 'TODO';
  if (stepStatuses.some((s) => s === 'skipped')) return 'TODO';
  return 'PASSED';
}

function pickFeatureTestKey(featureUri) {
  const uri = String(featureUri || '');
  const file = path.basename(uri);
  const separatorIdx = file.indexOf('--');
  if (separatorIdx <= 0 || !file.toLowerCase().endsWith('.feature')) {
    throw new Error(
      `Feature filename must match "{testKey}--{description}.feature". Got "${file || uri}".`
    );
  }
  const testKey = file.slice(0, separatorIdx).trim();
  if (!jiraKeyRegex.test(testKey)) {
    throw new Error(`Invalid test key "${testKey}" in feature filename "${file}".`);
  }
  return testKey;
}

function extractEvidence(step) {
  const out = [];
  const embeds = Array.isArray(step.embeddings) ? step.embeddings : [];
  let idx = 0;
  for (const e of embeds) {
    const mime = e.mime_type || e.media?.type || '';
    if (!mime.startsWith('image/')) continue;
    const data = e.data || (typeof e.media?.binary === 'string' ? e.media.binary : '');
    if (!data) continue;
    idx += 1;
    out.push({
      filename: `scenario-step-${idx}.${mime.split('/')[1] || 'png'}`,
      contentType: mime,
      data,
    });
  }
  return out;
}

function readCucumber() {
  const abs = path.resolve(process.cwd(), reportPath);
  if (!fs.existsSync(abs)) throw new Error(`Cucumber report not found: ${abs}`);
  const raw = fs.readFileSync(abs, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Expected cucumber-report/cucumber.json to be an array');
  return parsed;
}

function buildExecutionPayload(cucumber, testExecutionKey) {
  if (!testExecutionKey) {
    throw new Error('XRAY_TEST_EXEC_KEY is required');
  }

  const testsByKey = new Map();
  for (const feature of cucumber) {
    const featureTestKey = pickFeatureTestKey(feature.uri);
    const scenarios = Array.isArray(feature.elements) ? feature.elements : [];
    for (const s of scenarios) {
      if (s.type !== 'scenario') continue;
      const testKey = featureTestKey;
      const steps = (Array.isArray(s.steps) ? s.steps : []).filter((st) => !st.hidden);
      const statuses = steps.map((st) => String(st.result?.status || '').toLowerCase()).filter(Boolean);
      const status = mapStatus(statuses);
      const failed = steps.find((st) => String(st.result?.status || '').toLowerCase() === 'failed');
      const failMsg = failed && failed.result?.error_message ? String(failed.result.error_message).trim() : '';
      const commentParts = [
        `Scenario: ${s.name || s.id || 'Unnamed scenario'}`,
        `Result: ${status}`,
      ];
      if (failMsg) commentParts.push(`Failure: ${failMsg}`);
      const comment = commentParts.join('\n');
      const evidences = failed ? extractEvidence(failed) : [];

      const prev = testsByKey.get(testKey);
      if (!prev) {
        testsByKey.set(testKey, { testKey, comment, status, evidences });
        continue;
      }
      // Merge repeated scenarios that map to the same Jira Test key.
      const mergedStatus = prev.status === 'FAILED' || status === 'FAILED'
        ? 'FAILED'
        : prev.status === 'TODO' || status === 'TODO'
          ? 'TODO'
          : 'PASSED';
      testsByKey.set(testKey, {
        testKey,
        status: mergedStatus,
        comment: `${prev.comment}\n\n${comment}`,
        evidences: [...(prev.evidences || []), ...evidences],
      });
    }
  }
  const tests = Array.from(testsByKey.values()).map((t) => {
    const result = {
      testKey: t.testKey,
      comment: t.comment,
      status: t.status,
    };
    if (Array.isArray(t.evidences) && t.evidences.length > 0) {
      result.evidences = t.evidences;
    }
    return result;
  });
  if (tests.length === 0) {
    throw new Error('No scenarios found in cucumber report.');
  }
  return { testExecutionKey, tests };
}

async function auth(base) {
  const id = process.env.XRAY_CLIENT_ID;
  const secret = process.env.XRAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('XRAY_CLIENT_ID and XRAY_CLIENT_SECRET are required');
  const r = await fetch(`${base}/api/v2/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Xray authenticate failed: ${r.status} ${text}`);
  return text.startsWith('"') ? JSON.parse(text) : text.trim();
}

async function upload(base, token, payload) {
  const url = new URL('/api/v2/import/execution', base);
  const r = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const out = await r.text();
  if (!r.ok) throw new Error(`Xray import failed: ${r.status} ${out}`);
  console.log(out);
}

async function main() {
  const base = pickBase();
  const testExecutionKey = process.env.XRAY_TEST_EXEC_KEY;
  if (!testExecutionKey) throw new Error('XRAY_TEST_EXEC_KEY is required');
  const cucumber = readCucumber();
  const payload = buildExecutionPayload(cucumber, testExecutionKey);
  const token = await auth(base);
  await upload(base, token, payload);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
