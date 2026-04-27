/**
 * Xray Cloud: POST /api/v2/import/execution/cucumber
 * Use query param **testExecutionKey** to target an existing *Test Execution* (not testExecIssueKey
 * or testExecKey — if those are used, the API can ignore them and create a new execution).
 * @see https://docs.getxray.app/display/XRAYCLOUD/Import+Execution+Results+-+REST+v2
 * @see https://docs.getxray.app/display/XRAYCLOUD/Using+Xray+JSON+format+to+import+execution+results
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

/**
 * @param {string} testExecutionKey  Jira key of the existing Test Execution (e.g. PT-2)
 */
function buildImportUrl(base, projectKey, testExecutionKey) {
  // Official Cloud docs use "testExecutionKey" for the existing TE; other names are often ignored
  // and a new Test Execution is created (e.g. PT-4) even when you pass a key.
  const u = new URL('/api/v2/import/execution/cucumber', base);
  u.searchParams.set('testExecutionKey', testExecutionKey);
  const omit = process.env.XRAY_OMIT_PROJECT_KEY === '1' || process.env.XRAY_OMIT_PROJECT_KEY === 'true';
  if (projectKey && !omit) {
    u.searchParams.set('projectKey', projectKey);
  }
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
  // Cloud often still creates a *new* Test Execution (new issue key) if the query is ignored
  // or the execution cannot be updated (status, or tests not in that run).
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    return;
  }
  const newKey = parsed && parsed.key;
  if (newKey && newKey === testExecKey) {
    return;
  }
  if (newKey && newKey !== testExecKey) {
    const msg =
      `Xray returned issue ${newKey} but you asked to record results in ${testExecKey} — ` +
      `a new Test Execution was created instead of updating the existing one. ` +
      `Check: (1) use an Open Test Execution, (2) the Cucumber @tags match the Tests linked to that run, ` +
      `(3) Xray Cloud “Import” docs for the exact query parameters on your org (see .github/XRAY.md). ` +
      `To allow new TE from CI, set XRAY_ALLOW_NEW_EXECUTION=1.`;
    if (process.env.XRAY_ALLOW_NEW_EXECUTION === '1' || process.env.XRAY_ALLOW_NEW_EXECUTION === 'true') {
      console.warn('Warning: ' + msg);
      return;
    }
    throw new Error(msg);
  }
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
