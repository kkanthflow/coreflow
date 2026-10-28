# Auvryn UI tests (Selenium + pytest)

This folder is an independent Python UI test package for the existing Auvryn web
application. It does not modify application behavior. Tests use explicit waits,
Chrome via Selenium Manager, Page Objects, failure screenshots, and a self-contained
pytest-html report.

## What is covered

- Public landing, login, registration, pricing, contact, privacy, and terms pages.
- Login form controls and client-side state, without submitting credentials.
- Anonymous route protection for every protected route declared in
  `web/src/App.tsx`.
- Read-only, authenticated page checks for dashboard, projects, invoices, billing,
  client portal, chat, meetings, and workflows.
- An explicitly gated production-owner subset for dashboard, project list,
  invoice list, and workflow list/search controls.
- Unique pytest IDs and markers for smoke, regression, authentication, projects,
  invoices, payments, client portal, meetings, workflows, and permissions.

Quotations are an invoice-studio template (`quotation_estimate`), not a standalone
route. The editor test is staging-only and is not part of production-owner checks.
Subscription management is the Settings billing tab (`/settings?tab=billing`);
it is excluded from production checks because billing history is sensitive.
The client portal shares the projects and invoices routes and renders client-specific
content according to role, so it requires a separate client account. Production
checks exclude chat (which fetches/decrypts message previews) and meetings (which
fetches participant data). No checkout, payment submission, account creation,
record creation/edit/deletion, subscription change, or production write is
performed. Meeting creation and workflow execution require a future staging-only
test explicitly designed with cleanup.

The test runner loads `.env.test` from the repository root (or from the path
specified by `TEST_ENV_FILE`). The file is not created by the framework and must
be provisioned locally. Credentials are excluded from settings representations
and are never logged. Failure screenshots are disabled whenever the browser is
on the production host.

Staging-authenticated checks require credentials, `APP_ENV=staging`, and a
non-production `APP_BASE_URL`. The production-owner checks are a separate,
read-only subset and require all of `APP_ENV=production`,
`APP_BASE_URL=https://auvrynplatform.vercel.app`,
`ALLOW_PRODUCTION_READONLY=true`, and local owner values for
`TEST_ACCOUNT_EMAIL` / `TEST_ACCOUNT_PASSWORD`. The flag only enables the
specific `production_readonly` tests; it does not enable write tests. Client
portal checks require their own client account and cannot be run as an owner.

## Windows PowerShell setup

From the repository root:

```powershell
py -3 -m venv .venv-ui
.\.venv-ui\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r tests_ui\requirements-test.txt
Copy-Item tests_ui\.env.test.example .env.test
```

In VS Code, open **Command Palette → Python: Select Interpreter** and select
`${workspaceFolder}\.venv-ui\Scripts\python.exe`.

For local staging tests, edit `.env.test` and set `APP_ENV=staging`,
`APP_BASE_URL` to the staging deployment, and `TEST_ACCOUNT_EMAIL` /
`TEST_ACCOUNT_PASSWORD` to a synthetic staging-only account. Never put credentials
in `.env.test.example` or commit `.env.test`. Data-changing tests are disabled by
default; enabling `ALLOW_TEST_DATA_CHANGES=true` is an explicit safeguard for
staging-only tests and does not override the production-host block.

To opt into the reviewed production-owner read-only subset, configure the local
`.env.test` with `APP_ENV=production`, the exact production `APP_BASE_URL`,
`TEST_ACCOUNT_EMAIL`, `TEST_ACCOUNT_PASSWORD`, and
`ALLOW_PRODUCTION_READONLY=true`. Run only `-m production_readonly`; this
subset opens dashboard, project, invoice, and workflow pages and checks search
controls without submitting forms or typing into the search fields. It does not
permit project, invoice, workflow, subscription, or payment mutations.

## Running tests

Run one test module:

```powershell
python -m pytest -c tests_ui\pytest.ini tests_ui\tests\test_public_smoke.py
```

Run one test:

```powershell
python -m pytest -c tests_ui\pytest.ini tests_ui\tests\test_public_smoke.py::test_login_submit_starts_disabled
```

Run fast public smoke checks:

```powershell
python -m pytest -c tests_ui\pytest.ini -m smoke
```

Run the complete suite:

```powershell
python -m pytest -c tests_ui\pytest.ini
```

Generate the HTML report (the default pytest command also generates it):

```powershell
python -m pytest -c tests_ui\pytest.ini --html=tests_ui\reports\report.html --self-contained-html
```

The report, Selenium log, and failure screenshots are written under
`tests_ui\reports\` and ignored by Git. Failed tests include a screenshot in the
HTML report when the browser session is still available.

With no staging credentials, the suite still collects 70 cases: public UI and
anonymous route checks run, while authenticated dashboard, client portal, and
invoice-studio checks are skipped rather than attempting production sign-in.

Use `--headed` to override `HEADLESS=true` for a visible Chrome session:

```powershell
python -m pytest -c tests_ui\pytest.ini --headed -m smoke
```

## Environment variables

Copy `.env.test.example` to `.env.test`. `--app-url` overrides
`APP_BASE_URL` for a single run. Other supported variables are `API_BASE_URL`,
`BROWSER` (`chrome`), `HEADLESS`, `WAIT_TIMEOUT`, `PAGE_LOAD_TIMEOUT`,
`TEST_ACCOUNT_EMAIL`, `TEST_ACCOUNT_PASSWORD`, `CLIENT_TEST_ACCOUNT_EMAIL`,
`CLIENT_TEST_ACCOUNT_PASSWORD`, `ALLOW_TEST_DATA_CHANGES`, and
`ALLOW_PRODUCTION_READONLY`.
Selenium Manager resolves the ChromeDriver version; install Chrome locally first.
