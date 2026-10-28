import pytest
from selenium.webdriver.common.by import By

from tests_ui.pages.base_page import BasePage
from tests_ui.utils.settings import Settings
from tests_ui.utils.waits import visible

PROTECTED_ROUTES = [
    pytest.param("/dashboard", id="dashboard"),
    pytest.param("/workflows", id="workflows"),
    pytest.param("/workflows/new", id="workflow-builder"),
    pytest.param("/workflows/12345/edit", id="workflow-edit"),
    pytest.param("/workflows/templates", id="workflow-templates"),
    pytest.param("/workflows/history", id="workflow-history"),
    pytest.param("/workflows/12345/history", id="workflow-detail-history"),
    pytest.param("/workflows/approvals", id="workflow-approvals"),
    pytest.param("/projects", id="projects"),
    pytest.param("/projects/new", id="project-create"),
    pytest.param("/projects/12345", id="project-detail"),
    pytest.param("/projects/12345/client-room", id="client-project-room"),
    pytest.param("/tasks", id="tasks"),
    pytest.param("/tasks/12345", id="task-detail"),
    pytest.param("/calendar", id="calendar"),
    pytest.param("/meetings", id="meetings"),
    pytest.param("/meetings/new", id="meeting-schedule"),
    pytest.param("/meetings/instant", id="instant-meeting"),
    pytest.param("/meetings/12345", id="meeting-prejoin"),
    pytest.param("/meetings/12345/room", id="meeting-room"),
    pytest.param("/chat", id="chat"),
    pytest.param("/chat/12345", id="chat-room"),
    pytest.param("/employees", id="employees"),
    pytest.param("/employees/12345", id="employee-profile"),
    pytest.param("/departments", id="departments"),
    pytest.param("/clients", id="clients"),
    pytest.param("/invoices", id="invoices"),
    pytest.param("/invoices/new", id="invoice-create"),
    pytest.param("/invoices/12345", id="invoice-detail"),
    pytest.param("/invoices/12345/edit", id="invoice-edit"),
    pytest.param("/payments", id="payments", marks=pytest.mark.payments),
    pytest.param("/analytics", id="analytics"),
    pytest.param("/settings", id="settings"),
    pytest.param("/settings?tab=billing", id="subscription-billing"),
    pytest.param("/billing", id="billing-alias"),
    pytest.param("/subscription", id="subscription-alias"),
    pytest.param("/audit-logs", id="audit-logs"),
]


@pytest.mark.regression
@pytest.mark.permissions
@pytest.mark.parametrize("route", PROTECTED_ROUTES)
def test_anonymous_user_is_redirected_from_protected_route(
    driver, settings: Settings, route: str
):
    page = BasePage(driver, settings.app_base_url, settings.wait_timeout)
    page.open(route)
    visible(driver, (By.CSS_SELECTOR, 'a[href="/login"]'), settings.wait_timeout)
    assert driver.current_url.rstrip("/") == settings.app_base_url, (
        f"Anonymous access to {route} was not redirected to the public root"
    )
