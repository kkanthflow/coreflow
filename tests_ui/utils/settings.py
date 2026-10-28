import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

TESTS_UI_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = TESTS_UI_DIR.parent
configured_env_file = Path(
    os.getenv("TEST_ENV_FILE", REPOSITORY_ROOT / ".env.test")
)
ENV_FILE = (
    configured_env_file
    if configured_env_file.is_absolute()
    else REPOSITORY_ROOT / configured_env_file
).resolve()
load_dotenv(ENV_FILE, override=False)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_env: str
    app_base_url: str
    api_base_url: str
    browser: str
    headless: bool
    wait_timeout: int
    page_load_timeout: int
    account_email: str = field(repr=False)
    account_password: str = field(repr=False)
    client_account_email: str = field(repr=False)
    client_account_password: str = field(repr=False)
    allow_test_data_changes: bool
    allow_production_readonly: bool
    report_dir: Path

    @classmethod
    def from_environment(cls, base_url_override: str | None = None) -> "Settings":
        return cls(
            app_env=os.getenv("APP_ENV", "test").strip().lower(),
            app_base_url=(base_url_override or os.getenv(
                "APP_BASE_URL", "https://auvrynplatform.vercel.app"
            )).rstrip("/"),
            api_base_url=os.getenv(
                "API_BASE_URL", "https://coreflow-one-seven.vercel.app/api"
            ).rstrip("/"),
            browser=os.getenv("BROWSER", "chrome").strip().lower(),
            headless=_as_bool(os.getenv("HEADLESS"), default=True),
            wait_timeout=int(os.getenv("WAIT_TIMEOUT", "12")),
            page_load_timeout=int(os.getenv("PAGE_LOAD_TIMEOUT", "45")),
            account_email=os.getenv("TEST_ACCOUNT_EMAIL", "").strip(),
            account_password=os.getenv("TEST_ACCOUNT_PASSWORD", ""),
            client_account_email=os.getenv("CLIENT_TEST_ACCOUNT_EMAIL", "").strip(),
            client_account_password=os.getenv("CLIENT_TEST_ACCOUNT_PASSWORD", ""),
            allow_test_data_changes=_as_bool(
                os.getenv("ALLOW_TEST_DATA_CHANGES"), default=False
            ),
            allow_production_readonly=_as_bool(
                os.getenv("ALLOW_PRODUCTION_READONLY"), default=False
            ),
            report_dir=TESTS_UI_DIR / "reports",
        )

    @property
    def is_production_host(self) -> bool:
        hostname = (urlparse(self.app_base_url).hostname or "").lower()
        return hostname == "auvrynplatform.vercel.app"

    @property
    def staging_account_ready(self) -> bool:
        return (
            self.staging_host_ready
            and bool(self.account_email)
            and bool(self.account_password)
        )

    @property
    def staging_host_ready(self) -> bool:
        return self.app_env == "staging" and not self.is_production_host

    @property
    def production_owner_ready(self) -> bool:
        parsed_url = urlparse(self.app_base_url)
        return (
            self.app_env == "production"
            and parsed_url.scheme == "https"
            and parsed_url.hostname == "auvrynplatform.vercel.app"
            and self.allow_production_readonly
            and bool(self.account_email)
            and bool(self.account_password)
        )

    @property
    def data_changes_enabled(self) -> bool:
        return self.staging_account_ready and self.allow_test_data_changes
