import pytest

from tests_ui.pages.quotations import QuotationsPage
from tests_ui.utils.settings import Settings


@pytest.mark.regression
@pytest.mark.invoices
def test_quotation_template_uses_invoice_studio_route(
    authenticated_driver, settings: Settings
):
    page = QuotationsPage(
        authenticated_driver, settings.app_base_url, settings.wait_timeout
    )
    page.open()
    assert "/invoices/new" in authenticated_driver.current_url
    page.wait_until_ready()
    page.select_quotation_template()
    assert "QUOTATION / ESTIMATE" in page.body_text()
    assert page.invoice_number().startswith("EST-")
