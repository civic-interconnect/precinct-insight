# DEVELOPER.md


## Setup

1. Fork the repo.
2. Clone your fork and open it in VS Code.
3. Open a terminal (examples below use PowerShell on Windows).

```powershell
git clone https://github.com/civic-interconnect/precinct-insight.git
cd precinct-insight
```

Open docs/index.html in Live Server (VS Code Extension), e.g. <http://127.0.0.1:5500/docs/index.html>

## Python Dev 1. One-time setup

- Open the repo directory in VS Code.
- Open a terminal in VS Code.

```shell
uv python pin 3.12
uv venv

.venv\Scripts\activate # Windows
# source .venv/bin/activate  # Mac/Linux/WSL

uv sync --extra dev --extra docs --upgrade
uv run pre-commit install
uv run python -m precinct_insight.melt_election
```

## Dev 2. Validate Local Changes

```shell
git pull origin main
uvx pre-commit autoupdate
git add .
uvx ruff check . --fix
uvx ruff format .
uvx deptry .
uvx pyright
uv run pytest
```

Run the pre-commit hooks (twice, if needed):

```shell
pre-commit run --all-files
```

## Before Starting Changes

```shell
git pull
npm install
ncu -u
rm -rf node_modules package-lock.json #bash/zsh only
npm install
```

## Releasing New Version

After verifying changes, update the version number in:

- README.md badge
- VERSION
- docs/VERSION

Use the new release number in the commands below. 

```shell
git pull
npx depcheck
npx knip
npx eslint --fix 
uv run pytest -q
```

```shell
git add .
git commit -m "Prep vx.y.z"
git push -u origin main

git tag vx.y.z -m "x.y.z"
git push origin vx.y.z
```

Version the JS & docs to match.

```shell
uv run python -m precinct_insight.stamp_version
git add .
git commit -m "Stamp version vx.y.z"
git push 
```