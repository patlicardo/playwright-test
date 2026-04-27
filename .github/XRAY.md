# Jira Xray and this repository

## How a “run from Jira / Xray” maps to this repo

1. **Xray** stores automated tests as Jira *Test* issues. Each *scenario* in `features/*.feature` should be tagged with that issue’s key, e.g. `@DEMO-101` (replace `DEMO` with your Jira project key).
2. An execution is started from Xray (or another automation) by calling the GitHub workflow **`Xray (Cucumber)`** (file: `.github/workflows/xray-cucumber.yml`) and passing the **Test** key you want to run, e.g. `DEMO-101`. Cucumber is invoked as `cucumber-js --tags @DEMO-101`.
3. After the run, optional **Xray result import** uploads `cucumber-report/cucumber.json` to a Jira *Test Execution* (when API secrets and keys are set).

## How results are imported to an existing *Test Execution*

The workflow runs `scripts/xray-import-cucumber.cjs` after a successful `cucumber.json` is produced. It authenticates to **Xray Cloud** and then calls:

`POST /api/v2/import/execution/cucumber?projectKey=…&testExecIssueKey=…`

with the Cucumber file as the JSON body. This matches what many teams use in Jira/Community posts (the parameter name is **`testExecIssueKey`**, not `testExecKey` in `xrayFields`).

**Why we stopped using the third-party GitHub action here:** the standard **multipart** `info` file cannot set `xrayFields.testExecKey` (Xray Cloud returns *invalid field: testExecKey*), and the action can also send an extra `testInfo` part that Xray Cloud rejects with *Unexpected field (testInfo)*. The script only sends what the Cloud v2 import expects.

**If a new Test Execution (e.g. PT-3) still appears:** double-check in Jira that the issue is really a *Test Execution* in that project, is in a state that allows new runs, and that your Gherkin tags map to the *Test* issues in that run. If the API still misbehaves, see [Import Execution Results (REST) – Xray Cloud](https://docs.getxray.app/display/XRAYCLOUD/Import+Execution+Results+-+REST+v2) or Xray support.

## GitHub: repository secrets (for Xray)

For **Xray Cloud**, create a **Client id** and **Client secret** under Jira: **Jira** → **Apps** → **Xray** → **API** (or your org’s current path). In the GitHub repo, add:

| Secret                 | Value                          |
| ---------------------- | ------------------------------ |
| `XRAY_CLIENT_ID`      | Xray API client id             |
| `XRAY_CLIENT_SECRET`  | Xray API client secret         |

These are only used in the *Import results to Xray* step when a Test Execution and project key are provided.

## Trigger options

### 1) Manual: GitHub *Actions* → *Xray (Cucumber)* → *Run workflow*

- **xray_test_key** – Jira *Test* issue key (must match a `@TAG` on a scenario, without `@`).
- **cucumber_tag_expression** (optional) – full tag expression, e.g. `@DEMO-101 or @DEMO-102`; if set, overrides *xray_test_key*.
- **xray_test_exec_key** / **xray_project_key** (optional) – to attach the Cucumber report to an existing *Test Execution* in Xray.

### 2) `workflow_dispatch` API (Jira, scripts, or Xray’s “Trigger GitHub workflow” if your plan supports it)

You need a **Personal access token (classic)** with **`workflow`** scope, or a fine‑grained token with **Actions: Read and write** on this repository.

- URL: `POST /repos/{owner}/{repo}/actions/workflows/xray-cucumber.yml/dispatches`
- Body: `{"ref":"main","inputs":{"xray_test_key":"DEMO-101",...}}`

### 3) `repository_dispatch` (Jira automations, generic webhooks)

- **Event type** must be: `xray-cucumber` (see `on.repository_dispatch.types` in the workflow).
- **Example `client_payload`:**

  ```json
  {
    "xray_test_key": "DEMO-101",
    "cucumber_tag_expression": "",
    "xray_test_exec_key": "DEMO-500",
    "xray_project_key": "DEMO"
  }
  ```

- URL: `POST /repos/{owner}/{repo}/dispatches` with `{"event_type":"xray-cucumber","client_payload":{...}}` and a token with `repo` scope (or an equivalent for fine‑grained tokens).

## Xray’s own “Trigger a GitHub workflow”

Atlassian’s steps depend on your **Xray** edition (Cloud vs Server/DC) and license. In Xray, look for the GitHub / CI connection wizard and point it at:

- The workflow **name** or path: `xray-cucumber.yml` (or the display name *Xray (Cucumber)* in GitHub’s UI, depending on what the wizard accepts).
- **Branch:** usually `main`.
- Map the **Jira Test** issue key to the input **`xray_test_key`**.

If your team uses Xray to **export** Gherkin from Jira, keep those tags/keys in sync with this repo, or re‑export so scenarios stay aligned.

## Replace placeholder tags

`features/example.feature` uses `@DEMO-101` and `@DEMO-102`. Replace with your real Xray *Test* issue keys so filtering and result import line up in Jira.

## Resources

- [Trigger a GitHub workflow (Xray documentation)](https://docs.getxray.app/) — search the docs for your product’s GitHub / CI page.
- [mikepenz/xray-action](https://github.com/mikepenz/xray-action) — optional; this repo uses `scripts/xray-import-cucumber.cjs` for Cloud to avoid the issues above.
- [Xray: Import execution results](https://docs.getxray.app/) — official API/behavior for reports.
