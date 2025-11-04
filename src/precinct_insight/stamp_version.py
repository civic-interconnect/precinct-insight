"""Stamp the current version into VERSION files for docs and distribution."""
from datetime import date
from pathlib import Path

try:
    import setuptools_scm
    version = setuptools_scm.get_version()
except Exception:
    # fallback if no tag yet
    version = "0.0.0"

root = Path(__file__).resolve().parents[1]
today = date.today().isoformat()

# plain text files
(root / "VERSION").write_text(version + "\n", encoding="utf-8")
(root / "docs" / "VERSION").write_text(version + "\n", encoding="utf-8")

# optional json if you ever want it (your patcher supports either)
(root / "docs" / "version.json").write_text(
    '{"dashboard_version": "' + version + '", "generated": "' + today + '"}\n',
    encoding="utf-8",
)

print("Stamped version:", version, "date:", today)
