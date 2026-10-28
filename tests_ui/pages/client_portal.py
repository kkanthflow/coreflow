from tests_ui.pages.base_page import BasePage


class ClientPortalPage(BasePage):
    """Client users access their portal through the shared project/invoice routes."""

    path = "/projects"

    def wait_until_ready(self) -> None:
        self.heading("My Projects")
