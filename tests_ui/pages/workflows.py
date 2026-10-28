from tests_ui.pages.base_page import BasePage


class WorkflowsPage(BasePage):
    path = "/workflows"
    search_placeholder = "Search workflows by title, trigger, or actions..."

    def wait_until_ready(self) -> None:
        self.heading("Workflow Automations")

    def search(self):
        return self.search_input(self.search_placeholder)
