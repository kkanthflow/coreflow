from selenium.webdriver.common.by import By

from tests_ui.pages.base_page import BasePage
from tests_ui.utils.waits import visible


class DashboardPage(BasePage):
    path = "/dashboard"

    def wait_until_ready(self) -> None:
        visible(
            self.driver,
            (By.XPATH, "//h1[contains(normalize-space(.), 'Good ')]"),
            self.timeout,
        )
