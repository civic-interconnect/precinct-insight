"""Melt Minnesota precinct election results (wide -> long).

File: src/precinct_insight/melt_election.py
"""

from pathlib import Path

import pandas as pd

from .utils_logger import init_logger, logger, project_root

# Resolved directories based on repo root
ROOT_DIR = project_root
DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
OUT_DIR = DATA_DIR  # final tall csvs go here


# ---- Office specs and party maps ----
PARTY_MAPS = {
    "USPRS": {  # President
        "USPRSR": "REP",
        "USPRSDFL": "DEM",
        "USPRSLIB": "LIB",
        "USPRSWTP": "WTP",
        "USPRSG": "GRN",
        "USPRSSLP": "SLP",
        "USPRSSWP": "SWP",
        "USPRSJFA": "JFA",
        "USPRSIND": "IND",
        "USPRSWI": "WI",
    },
    "USSEN": {  # U.S. Senate
        "USSENR": "REP",
        "USSENDFL": "DEM",
        "USSENLIB": "LIB",
        "USSENIA": "IA",
        "USSENWI": "WI",
    },
    "USREP": {  # U.S. House
        "USREPR": "REP",
        "USREPDFL": "DEM",
        "USREPWI": "WI",
    },
    # You can add state races later:
    # "MNSEN": {...}, "MNLEG": {...}
}

OFFICE_LABEL = {
    "USPRS": "POTUS",
    "USSEN": "US_SENATE",
    "USREP": "US_HOUSE",
}

KEEP_COLS = ["VTDID", "COUNTYNAME", "PCTNAME", "REG7AM", "TOTVOTING"]


def _melt_office(df: pd.DataFrame, prefix: str) -> pd.DataFrame:
    """Return tall rows for a given office prefix if present; else empty DataFrame."""
    # collect exact vote columns for this office (exclude the TOTAL column)
    party_map = PARTY_MAPS[prefix]
    vote_cols = [c for c in df.columns if c in party_map]
    if not vote_cols:
        return pd.DataFrame(
            columns=[
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
        )

    tall = (
        df[KEEP_COLS + vote_cols]
        .melt(id_vars=KEEP_COLS, var_name="party_col", value_name="votes")
        .assign(party=lambda d: d["party_col"].map(party_map))
        .dropna(subset=["party"])
        .copy()
    )
    # standardize names and types
    tall = tall.rename(
        columns={
            "VTDID": "precinct_id",
            "COUNTYNAME": "county",
            "PCTNAME": "precinct_name",
            "REG7AM": "registered",
            "TOTVOTING": "turnout_eligible",
        }
    )
    tall["county"] = tall["county"].str.title()
    tall["precinct_name"] = tall["precinct_name"].str.title()
    tall["votes"] = pd.to_numeric(tall["votes"], errors="coerce").fillna(0).astype(int)
    tall["registered"] = pd.to_numeric(tall["registered"], errors="coerce").fillna(0).astype(int)
    tall["turnout_eligible"] = (
        pd.to_numeric(tall["turnout_eligible"], errors="coerce").fillna(0).astype(int)
    )
    tall["office"] = OFFICE_LABEL[prefix]
    return tall[
        [
            "precinct_id",
            "office",
            "party",
            "votes",
            "county",
            "precinct_name",
            "registered",
            "turnout_eligible",
        ]
    ]


def melt_mn_election(raw_file: str | Path, year: int) -> pd.DataFrame:
    """Return tall precinct results for whatever offices exist in the file."""
    raw_file = Path(raw_file)
    logger.info(f"Melt MN election data {year} from {raw_file}")
    df = _read_precinct_results(raw_file).fillna("0")

    pieces = []
    for prefix in ["USPRS", "USSEN", "USREP"]:
        part = _melt_office(df, prefix)
        if not part.empty:
            pieces.append(part)

    if not pieces:
        logger.warning("No known office columns found (USPRS/USSEN/USREP). Output will be empty.")
        cols = [
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
        return pd.DataFrame(columns=cols)

    out = pd.concat(pieces, ignore_index=True)
    out["year"] = int(year)
    # reorder columns
    return out[
        [
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
    ]


def write_tall(df: pd.DataFrame, out_csv: Path) -> Path:
    """Write tall DataFrame to CSV and return path."""
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False)
    logger.info(f"Wrote {out_csv}")
    return out_csv


def _read_precinct_results(path: Path) -> pd.DataFrame:
    """Read either CSV or Excel and return the PrecinctResults sheet as a DataFrame."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")
    if path.suffix.lower() == ".csv":
        # Try UTF-8, fall back to Windows-1252 for safety
        try:
            return pd.read_csv(path, dtype=str)
        except UnicodeDecodeError:
            return pd.read_csv(path, dtype=str, encoding="cp1252")
    if path.suffix.lower() in {".xlsx", ".xls"}:
        xls = pd.ExcelFile(path)
        sheet = "PrecinctResults" if "PrecinctResults" in xls.sheet_names else None
        if sheet is None:
            # auto-detect a sheet that contains VTDID
            for s in xls.sheet_names:
                head = pd.read_excel(xls, sheet_name=s, nrows=1, engine="openpyxl")
                if "VTDID" in head.columns:
                    sheet = s
                    break
        if sheet is None:
            raise ValueError("Could not find a sheet with a VTDID column.")
        return pd.read_excel(xls, sheet_name=sheet, dtype=str, engine="openpyxl")
    raise ValueError(f"Unsupported file type: {path.suffix}")


def _find_raw_file(year: int) -> Path:
    """Find the raw file for a given year under RAW_DIR."""
    for pat in [
        f"*{year}*precinct*results*.csv",
        f"*{year}*results*precinct*.csv",
        f"*{year}*results-by-precinct*.csv",
    ]:
        m = list((RAW_DIR).glob(pat))
        if m:
            return m[0]
    for pat in [
        f"*{year}*precinct*results*.xlsx",
        f"*{year}*results*precinct*.xlsx",
        f"*{year}*results-by-precinct*.xlsx",
        f"*{year}*-general-*-results-by-precinct-*.xlsx",
    ]:
        m = list((RAW_DIR).glob(pat))
        if m:
            return m[0]
    existing = "\n  - " + "\n  - ".join(sorted(p.name for p in RAW_DIR.glob("*")))
    raise FileNotFoundError(
        f"No raw file for {year} under {RAW_DIR}.{existing if existing.strip() else ''}"
    )


def run_year(year: int) -> Path:
    """Run melt for a given year and write output CSV."""
    raw = _find_raw_file(year)
    out = OUT_DIR / f"election_results_{year}.csv"
    df = melt_mn_election(raw, year)
    return write_tall(df, out)


def main() -> None:
    """Melt election results for specified years."""
    import argparse
    from shutil import copy2

    docs_data = project_root / "docs" / "data"
    docs_data.mkdir(parents=True, exist_ok=True)
    init_logger()

    ap = argparse.ArgumentParser(description="Melt MN precinct election results")
    ap.add_argument("--year", type=int, nargs="*", help="Years to process, e.g. --year 2022 2024")
    args = ap.parse_args()
    years = args.year or (2022, 2024)
    for y in years:
        run_year(y)
        copy2(OUT_DIR / f"election_results_{y}.csv", docs_data / f"election_results_{y}.csv")


if __name__ == "__main__":
    main()
