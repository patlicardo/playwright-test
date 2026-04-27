# Jira Xray and this repository

## How a “run from Jira / Xray” maps to this repo

1. **Xray** stores automated tests as Jira *Test* issues. Each *scenario* in `features/*.feature` should be tagged with that issue’s key, e.g. `@DEMO-101` (replace `DEMO` with your Jira project key).
2. An execution is started from Xray (or another automation) by calling the GitHub workflow **`Xray (Cucumber)`** (file: `.github/workflows/xray-cucumber.yml`) and passing the **Test** key you want to run, e.g. `DEMO-101`. Cucumber is invoked as `cucumber-js --tags @DEMO-101`.
3. After the run, optional **Xray result import** uploads `cucumber-report/cucumber.json` to a Jira *Test Execution* (when API secrets and keys are set).

## Why a new Test Execution (e.g. PT-3) was created instead of updating PT-2

On **Xray Cloud**, the *standard* REST endpoint `POST /api/v2/import/execution/cucumber` (non-multipart) **creates a new** Test Execution for that import. Query parameters like `testExecKey` on that call do not attach the report to an existing run (see Xray’s [code snippets and REST docs](https://github.com/Xray-App/xray-code-snippets) for Cucumber: *“a Test Execution will be created”*). That is why `mikepenz/xray-action` could log your requested key and still return a **new** key in the response.

The workflow in this repo uses the **Cucumber multipart** import instead: a small `info` JSON (with `xrayFields.testExecKey` set to your existing *Test Execution*, e.g. PT-2) is sent with the `cucumber.json` so Xray can **attach to that execution** rather than open a new one.

### If you see `Unexpected field (testInfo) (11)`

`mikepenz/xray-action` can add a `testInfo` part to the multipart form when it also receives a **non-empty** `projectKey` input, even if you did not mean to send it. The Xray Cloud Cucumber **multipart** endpoint does not expect that part. The *Import* step in our workflow uses `projectKey: ""` and keeps the Jira project on the *Prepare* `info` file instead, so the request only has `info` and `results`.

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
- [mikepenz/xray-action](https://github.com/mikepenz/xray-action) — imports Cucumber JSON into Xray.
- [Xray: Import execution results](https://docs.getxray.app/) — official API/behavior for reports.
