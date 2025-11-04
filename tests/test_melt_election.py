# tests/test_melt_election.py
from pathlib import Path
import pandas as pd
import pytest

from precinct_insight.melt_election import (
    DATA_DIR,
    RAW_DIR,
    OUT_DIR,
    melt_mn_election,
    write_tall,
    _find_raw_file,
)

REQUIRED_COLS = [
    "precinct_id",
    "year",
    "office",
    "party",
    "votes",
    "county",
    "precinct_name",
    "registered",
    "turnout_eligible",
]
ALLOWED_OFFICES = {"POTUS", "US_SENATE", "US_HOUSE"}


def _raw_or_skip(year: int) -> Path:
    try:
        return _find_raw_file(year)
    except FileNotFoundError:
        pytest.skip(f"Raw file for {year} not found in {RAW_DIR}")


@pytest.mark.parametrize("year", [2022, 2024])
def test_melt_has_rows_and_columns(year: int):
    raw = _raw_or_skip(year)
    df = melt_mn_election(raw, year)
    # Non-empty
    assert isinstance(df, pd.DataFrame)
    assert list(df.columns) == REQUIRED_COLS
    assert len(df) > 0

    # Sanity: allowed office labels only
    assert set(df["office"].unique()).issubset(ALLOWED_OFFICES)

    # Types and non-negative numeric invariants
    for col in ["votes", "registered", "turnout_eligible"]:
        assert pd.api.types.is_integer_dtype(df[col]) or pd.api.types.is_numeric_dtype(df[col])
        assert (df[col] >= 0).all()

    # Required identifiers must be present (not null/empty)
    assert df["precinct_id"].notna().all()
    assert (df["precinct_id"].astype(str).str.len() > 0).all()
    assert df["year"].eq(year).all()


@pytest.mark.parametrize("year", [2022, 2024])
def test_write_tall_creates_file(tmp_path: Path, year: int):
    raw = _raw_or_skip(year)
    df = melt_mn_election(raw, year)
    out = tmp_path / f"election_results_{year}.csv"

    p = write_tall(df, out)
    assert p == out
    assert p.exists()
    # Quick readback check for header integrity
    df2 = pd.read_csv(p)
    assert list(df2.columns) == REQUIRED_COLS


def test_data_dirs_exist():
    # Not a hard failure if RAW_DIR is empty; just confirm structure
    assert DATA_DIR.exists()
    assert OUT_DIR.exists()
