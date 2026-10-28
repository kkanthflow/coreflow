from urllib.parse import urljoin

from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver

from tests_ui.utils.waits import visible


def _xpath_literal(value: str) -> str:
    if "'" not in value:
        return f"'{value}'"
    if '"' not in value:
        return f'"{value}"'
    parts = value.split("'")
    return "concat(" + ', "\'", '.join(f"'{part}'" for part in parts) + ")"


class BasePage:
    path = "/"

    def __init__(self, driver: WebDriver, base_url: str, timeout: int = 12):
        self.driver = driver
        self.base_url = base_url.rstrip("/") + "/"
        self.timeout = timeout

    def open(self, path: str | None = None) -> None:
        self.driver.get(urljoin(self.base_url, (path or self.path).lstrip("/")))

    def heading(self, text: str):
        literal = _xpath_literal(text)
        locator = (
            By.XPATH,
            f"//h1[contains(normalize-space(.), {literal})]"
            f" | //h2[contains(normalize-space(.), {literal})]"
        )
        return visible(self.driver, locator, self.timeout)

    def body_text(self) -> str:
        return self.driver.find_element(By.TAG_NAME, "body").text

    def text_present(self, text: str) -> bool:
        return text in self.body_text()

    def link_to(self, href: str):
        return self.driver.find_element(
            By.CSS_SELECTOR, f'a[href="{href}"]'
        )

    def search_input(self, placeholder: str):
        return self.driver.find_element(
            By.CSS_SELECTOR, f'input[placeholder="{placeholder}"]'
        )
