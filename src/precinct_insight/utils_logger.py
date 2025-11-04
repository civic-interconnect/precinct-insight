"""Centralized logging for the precinct-insight project.

File: src/precinct_insight/utils_logger.py
"""

from __future__ import annotations

import pathlib
import sys

from loguru import logger

_is_configured: bool = False
_log_file_path: pathlib.Path | None = None


def _project_root(start: pathlib.Path | None = None) -> pathlib.Path:
    """Walk up until we see a pyproject.toml or .git; fallback to this file's parent."""
    here = (start or pathlib.Path(__file__)).resolve()
    for p in [here, *here.parents]:
        if (p / "pyproject.toml").exists() or (p / ".git").exists():
            return p
    return here.parent


project_root = _project_root()


def get_log_file_path() -> pathlib.Path:
    """Return the path to the active log file, or default path if not initialized."""
    if _log_file_path is not None:
        return _log_file_path
    # Default under data/logs so repo root stays clean
    return project_root / "data" / "logs" / "project.log"


def init_logger(
    level: str = "INFO",
    *,
    log_dir: str | pathlib.Path = project_root / "data" / "logs",
    log_file_name: str = "project.log",
) -> pathlib.Path:
    """Initialize the logger and return the log file path."""
    global _is_configured, _log_file_path
    if _is_configured:
        return pathlib.Path(log_dir) / log_file_name

    log_folder = pathlib.Path(log_dir).expanduser().resolve()
    log_folder.mkdir(parents=True, exist_ok=True)
    log_file = log_folder / log_file_name

    fmt = "{time:YYYY-MM-DD HH:mm}:{level:<7} {file}:{line} | {message}"

    logger.remove()
    logger.add(sys.stderr, level=level, format=fmt)
    logger.add(
        log_file,
        level=level,
        enqueue=True,
        backtrace=True,
        diagnose=False,
        rotation="10 MB",
        retention="7 days",
        encoding="utf-8",
        format=fmt,
    )
    logger.info(f"Logging to file: {log_file}")
    _is_configured = True
    _log_file_path = log_file
    return log_file


def log_example() -> None:
    """Log example messages at various levels."""
    logger.info("Example info")
    logger.warning("Example warning")
    logger.error("Example error")


def main() -> None:
    log_file = init_logger()
    log_example()
    logger.info(f"View log at {log_file}")


if __name__ == "__main__":
    main()

__all__ = ["get_log_file_path", "init_logger", "log_example", "logger", "project_root"]
