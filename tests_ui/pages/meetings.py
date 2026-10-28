from tests_ui.pages.base_page import BasePage


class MeetingsPage(BasePage):
    path = "/meetings"

    def wait_until_ready(self) -> None:
        self.heading("Conferences & Video Rooms")

    def join_code_input(self):
        return self.search_input("Enter meeting room code...")
