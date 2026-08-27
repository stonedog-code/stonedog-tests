#!/usr/bin/env bash
#
# Regenerate the demo fixtures from REAL repositories, using each repository's
# OWN committed manifest.
#
# The fixtures are committed so the standalone server and the component tests
# run against real collected output rather than hand-written mocks — a UI built
# against mock data is a UI nobody has run against the thing it is for.
#
# Sources are all PUBLIC repositories in this organisation, deliberately. An
# inventory carries counts and languages and no paths, so it is not the
# reconnaissance a feature map would be — but a public repo's demo data should
# come from public repos, and that rule is cheaper to keep than to argue.
#
# There is no `--manifest` here any more, and its absence is the point: each of
# these projects now declares its own tiers at its own root, reviewed by the
# people who know what those tests are. Passing a manifest from this repository
# would mean this package deciding what another repository's tests are, which is
# exactly the guessing the whole design refuses.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SIBLINGS="${SIBLINGS:-..}"

PROJECTS="stonedog-howto stonedog-style stonedog-testrunner diagram-viewer"

collected=0
skipped=0

for project in $PROJECTS; do
  repo="$SIBLINGS/$project"
  if [ ! -d "$repo/.git" ]; then
    # Say so rather than passing over a missing source. A fixtures step that
    # silently produces fewer files is the empty-set failure this package is
    # about, committed into the repository.
    printf 'SKIP %s: no checkout at %s\n' "$project" "$repo" >&2
    skipped=$((skipped + 1))
    continue
  fi
  if [ ! -f "$repo/stonedog-tests.json" ]; then
    printf 'SKIP %s: no stonedog-tests.json — the project declares its own tiers\n' "$project" >&2
    skipped=$((skipped + 1))
    continue
  fi
  npm run --silent collect -- --repo "$repo" --out "fixtures/$project.json"
  collected=$((collected + 1))
done

# Dogfooding: this repository declares its own tiers too.
npm run --silent collect -- --repo . --out fixtures/stonedog-tests.json
collected=$((collected + 1))

printf '\ncollected %d fixture(s), skipped %d\n' "$collected" "$skipped" >&2
if [ "$skipped" -gt 0 ]; then
  printf 'Some sources were missing, so fixtures/ is INCOMPLETE — do not commit this run.\n' >&2
  exit 1
fi
