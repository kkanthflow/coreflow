import logging
import re
from typing import Generator
from urllib.parse import urlparse

import pytest
from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.remote.webdriver import WebDriver

from tests_ui.pages.auth import AuthenticationPage
from tests_ui.utils.logging_config import configure_logging
from tests_ui.utils.settings import TESTS_UI_DIR, Settings
from tests_ui.utils.waits import url_contains

LOGGER = logging.getLogger(__name__)


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--headed", action="store_true", default=False,
        help="Run Chrome with a visible browser window.",
    )
    parser.addoption(
        "--app-url", action="store", default=None,
        help="Override APP_BASE_URL for this pytest run.",
    )


@pytest.fixture(scope="session")
def settings(pytestconfig: pytest.Config) -> Settings:
    return Settings.from_environment(pytestconfig.getoption("--app-url"))


@pytest.fixture(scope="session", autouse=True)
def test_logging(settings: Settings) -> None:
    configure_logging(settings.report_dir)
    LOGGER.info(
        "Starting UI test run: environment=%s, base_url=%s",
        settings.app_env,
        settings.app_base_url,
    )


@pytest.fixture
def driver(
    settings: Settings, pytestconfig: pytest.Config
) -> Generator[WebDriver, None, None]:
    if settings.browser != "chrome":
        pytest.fail(f"Unsupported BROWSER={settings.browser!r}; only Chrome is configured.")

    options = Options()
    if settings.headless and not pytestconfig.getoption("--headed"):
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,1000")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--no-first-run")

    try:
        browser = webdriver.Chrome(options=options)
    except WebDriverException as exc:
        pytest.fail(
            "Chrome WebDriver could not start. Install Chrome and allow Selenium "
            f"Manager to resolve the matching driver. Details: {exc}"
        )

    browser.implicitly_wait(0)
    browser.set_page_load_timeout(settings.page_load_timeout)
    LOGGER.info("Started Chrome session %s", browser.session_id)
    yield browser
    LOGGER.info("Closing Chrome session %s", browser.session_id)
    browser.quit()


@pytest.fixture
def authenticated_driver(
    request: pytest.FixtureRequest, settings: Settings
) -> WebDriver:
    if not settings.account_email or not settings.account_password:
        pytest.skip("Set TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD for staging UI tests.")
    if not settings.staging_account_ready:
        pytest.skip(
            "Authenticated UI tests require APP_ENV=staging, a synthetic account, "
            "and a non-production APP_BASE_URL."
        )

    driver = request.getfixturevalue("driver")
    auth = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    auth.open()
    auth.wait_until_ready()
    auth.fill_credentials(settings.account_email, settings.account_password)
    auth.submit_login()
    try:
        url_contains(driver, "/dashboard", settings.wait_timeout * 2)
    except TimeoutException as exc:
        pytest.fail(f"Staging test account did not reach the dashboard: {exc}")
    return driver


@pytest.fixture
def client_driver(request: pytest.FixtureRequest, settings: Settings) -> WebDriver:
    if not settings.client_account_email or not settings.client_account_password:
        pytest.skip(
            "Set CLIENT_TEST_ACCOUNT_EMAIL and CLIENT_TEST_ACCOUNT_PASSWORD "
            "for client-portal tests."
        )
    if not settings.staging_host_ready:
        pytest.skip(
            "Client-portal tests require APP_ENV=staging and a non-production host."
        )

    driver = request.getfixturevalue("driver")
    auth = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    auth.open()
    auth.wait_until_ready()
    auth.fill_credentials(
        settings.client_account_email, settings.client_account_password
    )
    auth.submit_login()
    try:
        url_contains(driver, "/projects", settings.wait_timeout * 2)
    except TimeoutException as exc:
        pytest.fail(f"Staging client account did not reach the projects portal: {exc}")
    return driver


@pytest.fixture
def production_owner_driver(
    request: pytest.FixtureRequest, settings: Settings
) -> WebDriver:
    if not settings.allow_production_readonly:
        pytest.skip(
            "Set ALLOW_PRODUCTION_READONLY=true to opt into reviewed, "
            "read-only owner checks."
        )
    if not settings.account_email or not settings.account_password:
        pytest.skip(
            "Set TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD in the local "
            "repository-root .env.test."
        )
    if not settings.production_owner_ready:
        pytest.skip(
            "Production owner checks require APP_ENV=production and the exact "
            "Auvryn production HTTPS host."
        )

    driver = request.getfixturevalue("driver")
    auth = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    auth.open()
    auth.wait_until_ready()
    auth.fill_credentials(settings.account_email, settings.account_password)
    auth.submit_login()
    try:
        url_contains(driver, "/dashboard", settings.wait_timeout * 2)
    except TimeoutException as exc:
        pytest.fail(f"Owner account did not reach the dashboard: {exc}")
    return driver


@pytest.fixture
def data_change_driver(
    authenticated_driver: WebDriver, settings: Settings
) -> WebDriver:
    if not settings.data_changes_enabled:
        pytest.skip(
            "Data-changing UI tests require ALLOW_TEST_DATA_CHANGES=true on staging."
        )
    hostname = (urlparse(settings.app_base_url).hostname or "").lower()
    if hostname == "auvrynplatform.vercel.app":
        pytest.fail("Refusing to run data-changing tests against the production host.")
    return authenticated_driver


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):
    outcome = yield
    report = outcome.get_result()
    if report.when not in {"setup", "call"} or not report.failed:
        return

    settings = item.funcargs.get("settings")
    if settings is not None and settings.is_production_host:
        LOGGER.warning(
            "Skipping failure screenshot on production to prevent sensitive "
            "account or business data from entering the report."
        )
        return

    browser = item.funcargs.get("driver")
    if browser is None:
        browser = item.funcargs.get("authenticated_driver")
    if browser is None:
        browser = item.funcargs.get("data_change_driver")
    if browser is None:
        return

    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", item.nodeid).strip("_")
    screenshot = TESTS_UI_DIR / "reports" / f"{safe_name}.png"
    try:
        if browser.save_screenshot(str(screenshot)):
            LOGGER.error("Failure screenshot saved: %s", screenshot)
            if hasattr(report, "extras"):
                import pytest_html

                report.extras = getattr(report, "extras", []) + [
                    pytest_html.extras.image(str(screenshot), name="Failure screenshot")
                ]
    except WebDriverException:
        LOGGER.exception("Could not capture screenshot for %s", item.nodeid)
