import pytest

from tests_ui.utils.settings import ENV_FILE, REPOSITORY_ROOT, Settings


def test_default_env_file_is_repository_root_file():
    assert ENV_FILE == (REPOSITORY_ROOT / ".env.test").resolve()


def test_sensitive_account_values_are_omitted_from_settings_repr(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("TEST_ACCOUNT_EMAIL", "owner-value-must-stay-private")
    monkeypatch.setenv("TEST_ACCOUNT_PASSWORD", "password-value-must-stay-private")
    settings = Settings.from_environment()

    representation = repr(settings)
    assert "owner-value-must-stay-private" not in representation
    assert "password-value-must-stay-private" not in representation


@pytest.mark.parametrize(
    "app_env,app_url,enabled,expected",
    [
        pytest.param(
            "production",
            "https://auvrynplatform.vercel.app",
            "true",
            True,
            id="explicit-production-opt-in",
        ),
        pytest.param(
            "production",
            "https://auvrynplatform.vercel.app",
            "false",
            False,
            id="opt-in-disabled",
        ),
        pytest.param(
            "staging",
            "https://auvrynplatform.vercel.app",
            "true",
            False,
            id="production-host-not-staging",
        ),
        pytest.param(
            "production",
            "https://staging.example.test",
            "true",
            False,
            id="non-production-host",
        ),
        pytest.param(
            "production",
            "http://auvrynplatform.vercel.app",
            "true",
            False,
            id="insecure-production-url",
        ),
    ],
)
def test_production_owner_gate_requires_explicit_exact_target(
    monkeypatch, app_env: str, app_url: str, enabled: str, expected: bool
):
    monkeypatch.setenv("APP_ENV", app_env)
    monkeypatch.setenv("APP_BASE_URL", app_url)
    monkeypatch.setenv("ALLOW_PRODUCTION_READONLY", enabled)
    monkeypatch.setenv("TEST_ACCOUNT_EMAIL", "owner@example.test")
    monkeypatch.setenv("TEST_ACCOUNT_PASSWORD", "synthetic-password")

    settings = Settings.from_environment()

    assert settings.production_owner_ready is expected
