import pytest
from selenium.webdriver.common.by import By

from tests_ui.pages.auth import AuthenticationPage
from tests_ui.pages.base_page import BasePage
from tests_ui.utils.settings import Settings
from tests_ui.utils.waits import visible

PUBLIC_ROUTES = [
    pytest.param("/", "Sign In", id="landing-page"),
    pytest.param("/login", "Unlock Workspace", id="login-page"),
    pytest.param("/register", "Create Workspace Account", id="registration-page"),
    pytest.param("/pricing", "Freelancer Subscription Plans", id="pricing-page"),
    pytest.param("/privacy-policy", "AUVRYN Privacy Policy", id="privacy-policy"),
    pytest.param("/terms", "AUVRYN Terms of Service", id="terms-page"),
    pytest.param("/contact", "Contact AUVRYN", id="contact-page"),
]


@pytest.mark.smoke
@pytest.mark.parametrize("route,page_marker", PUBLIC_ROUTES)
def test_public_page_renders(driver, settings: Settings, route: str, page_marker: str):
    page = BasePage(driver, settings.app_base_url, settings.wait_timeout)
    page.open(route)
    if route == "/":
        visible(driver, (By.CSS_SELECTOR, 'a[href="/login"]'), settings.wait_timeout)
        assert page_marker in page.body_text()
    else:
        heading = page.heading(page_marker)
        assert heading.is_displayed()


@pytest.mark.smoke
def test_landing_page_links_to_sign_in(driver, settings: Settings):
    page = BasePage(driver, settings.app_base_url, settings.wait_timeout)
    page.open("/")
    assert page.link_to("/login").is_displayed()


@pytest.mark.smoke
def test_landing_feature_navigation_targets_exist(driver, settings: Settings):
    page = BasePage(driver, settings.app_base_url, settings.wait_timeout)
    page.open("/")
    for section in ("projects", "tasks", "chat", "finance", "analytics", "pricing"):
        assert page.link_to(f"#{section}").is_displayed()
        assert driver.find_element(By.ID, section).is_displayed()


@pytest.mark.smoke
@pytest.mark.authentication
def test_login_fields_use_email_and_password_types(driver, settings: Settings):
    page = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    assert visible(driver, page.email, settings.wait_timeout).get_attribute("type") == "email"
    assert page.password_input_type() == "password"


@pytest.mark.smoke
@pytest.mark.authentication
def test_login_submit_starts_disabled(driver, settings: Settings):
    page = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    assert page.submit_is_disabled()


@pytest.mark.smoke
@pytest.mark.authentication
def test_login_submit_enables_after_valid_format_credentials(
    driver, settings: Settings
):
    page = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    page.fill_credentials("synthetic@example.invalid", "synthetic-passphrase")
    assert not page.submit_is_disabled()


@pytest.mark.smoke
@pytest.mark.authentication
@pytest.mark.parametrize(
    "password,expected_ready",
    [
        pytest.param("abc", False, id="short-password"),
        pytest.param("abcde", False, id="five-character-password"),
        pytest.param("abcdef", True, id="minimum-length-password"),
    ],
)
def test_login_readiness_uses_six_character_password_minimum(
    driver, settings: Settings, password: str, expected_ready: bool
):
    page = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    page.fill_credentials("synthetic@example.invalid", password)
    assert (not page.submit_is_disabled()) is expected_ready


@pytest.mark.smoke
@pytest.mark.authentication
@pytest.mark.parametrize(
    "email,shows_valid_format",
    [
        pytest.param("operator@example.com", True, id="valid-email-format"),
        pytest.param("operator", False, id="missing-at-sign"),
    ],
)
def test_login_shows_email_format_indicator(
    driver, settings: Settings, email: str, shows_valid_format: bool
):
    page = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    visible(driver, page.email, settings.wait_timeout).send_keys(email)
    assert ("Valid format" in page.body_text()) is shows_valid_format


@pytest.mark.smoke
@pytest.mark.authentication
def test_login_password_visibility_toggle_changes_input_type(
    driver, settings: Settings
):
    page = AuthenticationPage(driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    assert page.password_input_type() == "password"
    page.toggle_password_visibility()
    assert page.password_input_type() == "text"
    page.toggle_password_visibility()
    assert page.password_input_type() == "password"


@pytest.mark.smoke
def test_unknown_route_returns_to_public_landing(driver, settings: Settings):
    page = BasePage(driver, settings.app_base_url, settings.wait_timeout)
    page.open("/this-route-does-not-exist")
    visible(driver, (By.CSS_SELECTOR, 'a[href="/login"]'), settings.wait_timeout)
    assert driver.current_url.rstrip("/") == settings.app_base_url
