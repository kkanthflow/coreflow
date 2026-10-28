import pytest

from tests_ui.pages.dashboard import DashboardPage
from tests_ui.pages.invoices import InvoicesPage
from tests_ui.pages.projects import ProjectsPage
from tests_ui.pages.workflows import WorkflowsPage
from tests_ui.utils.settings import Settings

OWNER_READONLY_PAGES = [
    pytest.param(DashboardPage, "/dashboard", id="dashboard-summary"),
    pytest.param(ProjectsPage, "/projects", id="project-list"),
    pytest.param(InvoicesPage, "/invoices", id="invoice-list"),
    pytest.param(WorkflowsPage, "/workflows", id="workflow-list"),
]


@pytest.mark.production_readonly
@pytest.mark.parametrize("page_type,route", OWNER_READONLY_PAGES)
def test_owner_can_open_readonly_workspace_page(
    production_owner_driver, settings: Settings, page_type, route: str
):
    page = page_type(
        production_owner_driver, settings.app_base_url, settings.wait_timeout
    )
    page.open(route)
    page.wait_until_ready()
    assert production_owner_driver.current_url.endswith(route)


@pytest.mark.production_readonly
@pytest.mark.projects
def test_owner_project_search_control_is_visible(
    production_owner_driver, settings: Settings
):
    page = ProjectsPage(
        production_owner_driver, settings.app_base_url, settings.wait_timeout
    )
    page.open()
    page.wait_until_ready()
    assert page.search().is_displayed()


@pytest.mark.production_readonly
@pytest.mark.invoices
def test_owner_invoice_search_control_is_visible(
    production_owner_driver, settings: Settings
):
    page = InvoicesPage(
        production_owner_driver, settings.app_base_url, settings.wait_timeout
    )
    page.open()
    page.wait_until_ready()
    assert page.search().is_displayed()


@pytest.mark.production_readonly
@pytest.mark.workflows
def test_owner_workflow_search_control_is_visible(
    production_owner_driver, settings: Settings
):
    page = WorkflowsPage(
        production_owner_driver, settings.app_base_url, settings.wait_timeout
    )
    page.open()
    page.wait_until_ready()
    assert page.search().is_displayed()
