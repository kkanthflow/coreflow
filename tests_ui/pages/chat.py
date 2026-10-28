from tests_ui.pages.base_page import BasePage


class ChatPage(BasePage):
    path = "/chat"
    search_placeholder = "Search conversations..."

    def wait_until_ready(self) -> None:
        self.heading("Chat")

    def search(self):
        return self.search_input(self.search_placeholder)
