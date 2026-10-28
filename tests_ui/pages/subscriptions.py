from tests_ui.pages.base_page import BasePage


class SubscriptionsPage(BasePage):
    """Subscription management lives in the Settings billing tab."""

    path = "/settings?tab=billing"

    def wait_until_ready(self) -> None:
        self.heading("Customer Subscription")
