from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver

from tests_ui.pages.base_page import BasePage
from tests_ui.utils.waits import clickable, visible


class AuthenticationPage(BasePage):
    path = "/login"
    email_placeholder = "operator@company.com"
    password_placeholder = "••••••••••••"

    def __init__(self, driver: WebDriver, base_url: str, timeout: int = 12):
        super().__init__(driver, base_url, timeout)
        self.email = (By.CSS_SELECTOR, f'input[placeholder="{self.email_placeholder}"]')
        self.password = (
            By.CSS_SELECTOR, f'input[placeholder="{self.password_placeholder}"]'
        )
        self.submit = (
            By.XPATH,
            "//button[.//span[normalize-space()='Unlock Workspace']]",
        )

    def wait_until_ready(self) -> None:
        self.heading("Unlock Workspace")
        visible(self.driver, self.email, self.timeout)
        visible(self.driver, self.password, self.timeout)

    def fill_credentials(self, email: str, password: str) -> None:
        visible(self.driver, self.email, self.timeout).send_keys(email)
        visible(self.driver, self.password, self.timeout).send_keys(password)

    def submit_login(self) -> None:
        clickable(self.driver, self.submit, self.timeout).click()

    def password_input_type(self) -> str:
        return visible(self.driver, self.password, self.timeout).get_attribute("type")

    def toggle_password_visibility(self) -> None:
        password = visible(self.driver, self.password, self.timeout)
        password_container = password.find_element(By.XPATH, "..")
        password_container.find_element(By.TAG_NAME, "button").click()

    def submit_is_disabled(self) -> bool:
        return visible(self.driver, self.submit, self.timeout).get_attribute(
            "disabled"
        ) is not None
