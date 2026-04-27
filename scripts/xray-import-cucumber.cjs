/**
 * Xray Cloud: POST /api/v2/import/execution/cucumber with testExecIssueKey + projectKey.
 * The multipart "info" file cannot set testExecKey in xrayFields (API rejects that field);
 * the non-multipart endpoint targets an existing Test Execution via query string instead.
 * @see https://docs.getxray.app/display/XRAYCLOUD/Import+Execution+Results+-+REST+v2
 */
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const defaultBase = 'https://xray.cloud.getxray.app';
const reportPath = process.env.XRAY_CUCUMBER_JSON || 'cucumber-report/cucumber.json';

function pickBase() {
  const b = (process.env.XRAY_BASE_URL || defaultBase).replace(/\/$/, '');
  if (!b.startsWith('https://')) {
    throw new Error('XRAY_BASE_URL must be an https origin');
  }
  return b;
}

async function auth(base) {
  const id = process.env.XRAY_CLIENT_ID;
  const secret = process.env.XRAY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('XRAY_CLIENT_ID and XRAY_CLIENT_SECRET are required');
  }
  const r = await fetch(`${base}/api/v2/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret }),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Xray authenticate failed: ${r.status} ${text}`);
  }
  let token = text.trim();
  if (token.startsWith('"') && token.endsWith('"')) {
    try {
      token = JSON.parse(token);
    } catch {
      // keep raw
    }
  }
  return token;
}

function buildImportUrl(base, projectKey, testExecKey) {
  // Xray Cloud v2 uses testExecIssueKey (not testExecKey) for this endpoint.
  const u = new URL('/api/v2/import/execution/cucumber', base);
  u.searchParams.set('projectKey', projectKey);
  u.searchParams.set('testExecIssueKey', testExecKey);
  return u.toString();
}

async function importCucumber(base, token) {
  const projectKey = process.env.XRAY_PROJECT_KEY;
  const testExecKey = process.env.XRAY_TEST_EXEC_KEY;
  if (!projectKey || !testExecKey) {
    throw new Error('XRAY_PROJECT_KEY and XRAY_TEST_EXEC_KEY are required');
  }
  const abs = path.resolve(process.cwd(), reportPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Cucumber report not found: ${abs}`);
  }
  const body = fs.readFileSync(abs);
  const url = buildImportUrl(base, projectKey, testExecKey);
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  const out = await r.text();
  if (!r.ok) {
    throw new Error(`Xray import failed: ${r.status} ${out}`);
  }
  console.log(out);
}

async function main() {
  const base = pickBase();
  const token = await auth(base);
  await importCucumber(base, token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
