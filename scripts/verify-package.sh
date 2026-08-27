#!/usr/bin/env bash
# Copyright (C) 2026 StoneDogCode L.L.C.
# SPDX-License-Identifier: Apache-2.0
#
# Prove the PACKAGE works, not just the checkout.
#
# Everything the test suite does runs against source files sitting in this
# repository, where `files`, the `exports` map and the tarball contents are
# invisible. Those are exactly what breaks at publish time — after review, when
# the version is already burned and cannot be reused.
#
# So: pack it, install the tarball into a throwaway project, and use it the way a
# consumer would — typecheck against the published `exports`, then execute the
# collector against a real directory.
#
# The `./styled` entry point is checked for PRESENCE but not imported. It needs
# React, Panda and a generated `styled-system`, none of which exist in a
# throwaway consumer; a tarball missing it still installs fine and fails at the
# consumer's first import, so its absence is what this has to catch.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Sanity floor for the tarball. Comfortably under the real count so ordinary
# growth does not trip it, far above what a `files`-misconfigured package would
# produce (3: package.json, README, LICENSE).
MIN_FILES=12

fail() { printf '\n\033[31mFAIL: %s\033[0m\n' "$*" >&2; exit 1; }

cd "$ROOT"
# The filename is read by GLOBBING the (empty, freshly-made) destination, not by
# taking the last line of `npm pack`'s output.
#
# `npm pack | tail -1` is the obvious form and it is unreliable: npm's notice
# block is not consistently on stderr, so `tail -1` sometimes returns a notice
# line instead of the filename. The tarball path is then wrong, every `tar -tzf`
# reads nothing, and the script fails on whichever assertion happens to come
# first — reporting a MISSING ENTRY POINT for a tarball that contains it.
#
# That is worse than a crash: a guard that fails for the wrong reason sends the
# reader to fix a file that is fine. Caught while planting a defect to check this
# script was not vacuous.
npm pack --pack-destination "$WORK" >/dev/null 2>&1 || fail "npm pack failed"
TARBALL="$(find "$WORK" -maxdepth 1 -name '*.tgz' | head -1)"
[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || fail "npm pack produced no tarball in $WORK"
echo "packed: $(basename "$TARBALL")"

# The listing is read ONCE into a variable, and nothing below pipes into
# `grep -q`. That combination is a real trap under `set -o pipefail`:
#
#   tar -tzf "$TARBALL" | grep -q "__tests__"
#
# `grep -q` exits the instant it matches, `tar` then dies of SIGPIPE (141), and
# pipefail reports the PIPELINE as failed — so a successful match reads as "no
# match" and the guard silently never fires. Whether it happens depends on
# whether tar finishes writing before grep exits, so it varies with the size of
# the listing: this script passed on a 17-entry tarball and failed to catch a
# planted defect in a 24-entry one.
#
# That is this package's own subject matter — a check that reports green over a
# set it never really examined — so it is fixed rather than worked around.
# `grep -c` consumes all of its input and cannot provoke SIGPIPE.
LISTING="$(tar -tzf "$TARBALL")"

FILES="$(printf '%s\n' "$LISTING" | grep -c . || true)"
echo "tarball contains $FILES entries"
[ "$FILES" -ge "$MIN_FILES" ] || fail "only $FILES entries in the tarball; expected at least $MIN_FILES. Check \`files\` in package.json."

# No test file may reach a consumer: they are statically parsed by the
# consumer's Panda build and they import jest globals that are not dependencies.
case "$LISTING" in
  *__tests__*)
    printf '%s\n' "$LISTING" | grep "__tests__" >&2 || true
    fail "the tarball contains test files"
    ;;
esac
echo "no test files in the tarball"

# Every path the `exports` map names, plus the styled layer's actual components
# — the barrel re-exports them and a `files` pattern could ship one without the
# other. A tarball missing any of these installs cleanly and fails at the
# consumer's first import.
for entry in \
  package/src/index.ts \
  package/src/node/index.ts \
  package/src/styled/index.ts \
  package/src/styled/fleet-table.tsx \
  package/src/styled/tier-cell.tsx
do
  found="$(printf '%s\n' "$LISTING" | grep -Fxc "$entry" || true)"
  [ "$found" -ge 1 ] || fail "the tarball is missing $entry, which the package needs"
done
echo "all three entry points and the styled components present"

mkdir -p "$WORK/consumer/src"
cd "$WORK/consumer"

cat > package.json <<'JSON'
{ "name": "consumer-check", "private": true, "type": "module", "version": "1.0.0" }
JSON

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ESNext", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true,
    "lib": ["dom", "esnext"], "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
JSON

# Imports through the package NAME, never a relative path, so this resolves via
# the published `exports` map rather than the local file layout.
cat > src/check.ts <<'TS'
import {
  SCHEMA_VERSION, TIERS, readInventory, shapeOf, toFleetEntry, readableCount,
  MANIFEST_FILENAME, readManifest, countCases, languageOf,
  type Inventory, type Tier, type TierReport, type FleetEntry,
} from "@stonedogcode/tests";
import { collect, CollectError, type CollectResult } from "@stonedogcode/tests/node";

if (SCHEMA_VERSION !== 1) throw new Error("unexpected schema version");
if (TIERS.length !== 3) throw new Error("expected three tiers");
if (MANIFEST_FILENAME !== "stonedog-tests.json") throw new Error("unexpected manifest filename");
if (languageOf("a.py") !== "python") throw new Error("languageOf broken");
if (countCases("other", "whatever") !== null) throw new Error("uncountable language must be null");

const entry: FleetEntry = toFleetEntry("nothing-published", undefined);
if (entry.status !== "none") throw new Error("absent document must read as none");
if (readableCount([entry]).total !== 1) throw new Error("denominator lost");

const bad = readManifest({ schemaVersion: 1, project: "x", tiers: { unti: { include: [] } } });
if (bad.status !== "invalid") throw new Error("an unknown tier name must be rejected");

async function run(): Promise<void> {
  const result: CollectResult = await collect({ repo: process.argv[2]! });
  const unit: TierReport = result.inventory.tiers.unit;
  if (!unit.declared) throw new Error("unit should be declared");
  if (unit.files !== 1) throw new Error(`expected 1 unit file, got ${unit.files}`);
  if (unit.cases !== 2) throw new Error(`expected 2 cases, got ${unit.cases}`);

  const parsed = readInventory(JSON.parse(JSON.stringify(result.inventory)));
  if (parsed.status !== "ok") throw new Error("a freshly collected inventory must read back as ok");
  const inventory: Inventory = parsed.inventory;
  const tier: Tier = "unit";
  if (!inventory.tiers[tier].declared) throw new Error("round trip lost a tier");
  if (shapeOf(inventory) !== "incomplete") throw new Error("undeclared tiers must not yield a shape");

  try {
    await collect({ repo: "/definitely/not/a/repo" });
    throw new Error("collect should refuse a directory with no manifest");
  } catch (error) {
    if (!(error instanceof CollectError)) throw new Error("expected a CollectError");
  }

  console.log("consumer check OK");
}

void run();
TS

npm install --silent --no-audit --no-fund "$TARBALL" typescript@^5.9.3 @types/node@^22 >/dev/null
echo "installed the tarball into a throwaway consumer"

npx tsc --noEmit || fail "the package does not typecheck through its published exports"
echo "typecheck through published exports: clean"

# A real directory for the collector to walk, built here so the check does not
# depend on anything in the source repository.
SAMPLE="$WORK/sample"
mkdir -p "$SAMPLE/src"
cat > "$SAMPLE/stonedog-tests.json" <<'JSON'
{ "schemaVersion": 1, "project": "sample", "tiers": { "unit": { "include": ["src/**/*.test.ts"] } } }
JSON
printf 'it("one", () => {});\nit("two", () => {});\n' > "$SAMPLE/src/a.test.ts"

npx tsx src/check.ts "$SAMPLE" 2>/dev/null || npx --yes tsx src/check.ts "$SAMPLE" || fail "the installed package does not run"

printf '\n\033[32mPACKAGE OK\033[0m — packed, installed, typechecked and executed as a consumer.\n'
