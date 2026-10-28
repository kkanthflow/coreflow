from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def visible(driver: WebDriver, locator: tuple[str, str], timeout: int = 12):
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located(locator)
    )


def clickable(driver: WebDriver, locator: tuple[str, str], timeout: int = 12):
    return WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable(locator)
    )


def url_contains(driver: WebDriver, fragment: str, timeout: int = 12) -> bool:
    WebDriverWait(driver, timeout).until(EC.url_contains(fragment))
    return True
