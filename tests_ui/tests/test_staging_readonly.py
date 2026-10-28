import pytest
from selenium.webdriver.common.by import By

from tests_ui.pages.base_page import BasePage
from tests_ui.pages.chat import ChatPage
from tests_ui.pages.dashboard import DashboardPage
from tests_ui.pages.invoices import InvoicesPage
from tests_ui.pages.meetings import MeetingsPage
from tests_ui.pages.projects import ProjectsPage
from tests_ui.pages.subscriptions import SubscriptionsPage
from tests_ui.pages.workflows import WorkflowsPage
from tests_ui.utils.settings import Settings
from tests_ui.utils.waits import visible

READONLY_PAGES = [
    pytest.param(DashboardPage, "/dashboard", "Good ", id="dashboard-shell"),
    pytest.param(ProjectsPage, "/projects", "Projects & Workstreams", id="projects"),
    pytest.param(InvoicesPage, "/invoices", "Invoices & Billing Telemetry", id="invoices"),
    pytest.param(ChatPage, "/chat", "Chat", id="chat"),
    pytest.param(MeetingsPage, "/meetings", "Conferences & Video Rooms", id="meetings"),
    pytest.param(WorkflowsPage, "/workflows", "Workflow Automations", id="workflows"),
    pytest.param(SubscriptionsPage, "/settings?tab=billing", "Customer Subscription", id="subscriptions"),
]


@pytest.mark.regression
@pytest.mark.parametrize("page_type,route,heading", READONLY_PAGES)
def test_staging_page_renders_expected_heading(
    authenticated_driver, settings: Settings, page_type, route: str, heading: str
):
    page = page_type(
        authenticated_driver, settings.app_base_url, settings.wait_timeout
    )
    page.open(route)
    page.heading(heading)
    assert heading in page.body_text()


@pytest.mark.regression
@pytest.mark.projects
def test_project_search_control_is_available_on_staging(
    authenticated_driver, settings: Settings
):
    page = ProjectsPage(authenticated_driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    assert page.search().is_displayed()


@pytest.mark.regression
@pytest.mark.invoices
def test_invoice_search_control_is_available_on_staging(
    authenticated_driver, settings: Settings
):
    page = InvoicesPage(authenticated_driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    assert page.search().is_displayed()


@pytest.mark.regression
@pytest.mark.meetings
def test_meeting_join_code_input_is_available_on_staging(
    authenticated_driver, settings: Settings
):
    page = MeetingsPage(authenticated_driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    assert page.join_code_input().is_displayed()


@pytest.mark.regression
@pytest.mark.workflows
def test_workflow_search_control_is_available_on_staging(
    authenticated_driver, settings: Settings
):
    page = WorkflowsPage(authenticated_driver, settings.app_base_url, settings.wait_timeout)
    page.open()
    page.wait_until_ready()
    assert page.search().is_displayed()


@pytest.mark.regression
@pytest.mark.authentication
def test_staging_login_reaches_dashboard(authenticated_driver):
    visible(authenticated_driver, (By.TAG_NAME, "body"))
    assert "/dashboard" in authenticated_driver.current_url


@pytest.mark.regression
@pytest.mark.client_portal
def test_synthetic_client_account_reaches_client_projects(client_driver, settings: Settings):
    from tests_ui.pages.client_portal import ClientPortalPage

    page = ClientPortalPage(
        client_driver, settings.app_base_url, settings.wait_timeout
    )
    page.open()
    page.wait_until_ready()
    assert "My Projects" in page.body_text()
