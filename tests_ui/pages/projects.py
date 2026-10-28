from tests_ui.pages.base_page import BasePage


class ProjectsPage(BasePage):
    path = "/projects"
    search_placeholder = "Search initiatives, scopes, or owners..."

    def wait_until_ready(self) -> None:
        self.heading("Projects & Workstreams")

    def search(self):
        return self.search_input(self.search_placeholder)
