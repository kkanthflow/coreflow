import logging
from pathlib import Path


def configure_logging(report_dir: Path) -> None:
    report_dir.mkdir(parents=True, exist_ok=True)
    root_logger = logging.getLogger()
    if any(
        isinstance(handler, logging.FileHandler)
        and Path(handler.baseFilename) == (report_dir / "selenium.log").resolve()
        for handler in root_logger.handlers
    ):
        return

    handler = logging.FileHandler(
        report_dir / "selenium.log", encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s"
    ))
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)
