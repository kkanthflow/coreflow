from tests_ui.pages.base_page import BasePage
from selenium.webdriver.common.by import By

from tests_ui.utils.waits import visible


class QuotationsPage(BasePage):
    """Quotation documents are an invoice-studio template, not a separate route."""

    path = "/invoices/new"
    template_name = "Quotation / Estimate"

    def wait_until_ready(self) -> None:
        visible(
            self.driver,
            (
                By.XPATH,
                f"//h3[normalize-space()='{self.template_name}']",
            ),
            self.timeout,
        )

    def select_quotation_template(self) -> None:
        self.driver.find_element(
            By.XPATH, f"//h3[normalize-space()='{self.template_name}']"
        ).click()

    def invoice_number(self) -> str:
        return self.driver.find_element(
            By.CSS_SELECTOR, 'input[title="Click to customize invoice number"]'
        ).get_attribute("value")
