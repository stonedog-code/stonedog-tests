#!/usr/bin/env bash
#
# Regenerate the demo fixtures from REAL repositories.
#
# The fixtures are committed so the standalone server and the component tests
# run against real collected output rather than hand-written mocks — a UI built
# against mock data is a UI nobody has run against the thing it is for.
#
# Sources are all PUBLIC repositories in this organisation, deliberately. An
# inventory carries counts and languages and no paths, so it is not the
# reconnaissance a feature map would be — but a public repo's demo data should
# come from public repos, and that rule is cheaper to keep than to argue.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SIBLINGS="${SIBLINGS:-..}"
MANIFESTS="fixtures/candidate-manifests"

# The projects with a candidate manifest, plus this repository, which has a real
# one at its own root.
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
  npm run --silent collect -- \
    --repo "$repo" \
    --manifest "$MANIFESTS/$project.json" \
    --out "fixtures/$project.json"
  collected=$((collected + 1))
done

# Dogfooding: this repository declares its own tiers for real.
npm run --silent collect -- --repo . --out fixtures/stonedog-tests.json
collected=$((collected + 1))

printf '\ncollected %d fixture(s), skipped %d\n' "$collected" "$skipped" >&2
if [ "$skipped" -gt 0 ]; then
  printf 'Some sources were missing, so fixtures/ is INCOMPLETE — do not commit this run.\n' >&2
  exit 1
fi
