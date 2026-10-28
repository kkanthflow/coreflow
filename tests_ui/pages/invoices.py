from tests_ui.pages.base_page import BasePage


class InvoicesPage(BasePage):
    path = "/invoices"
    search_placeholder = "Search invoice ID or client..."

    def wait_until_ready(self) -> None:
        self.heading("Invoices & Billing Telemetry")

    def search(self):
        return self.search_input(self.search_placeholder)
