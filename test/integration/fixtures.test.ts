/**
 * The committed fixtures are what the standalone server and the e2e tier run
 * against, so they are load-bearing data rather than sample files. These assert
 * they are real, readable, and collected the honest way.
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readInventory, TIERS } from "../../src/schema.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturesDir = join(repoRoot, "fixtures");

describe("committed fixtures", () => {
  it("has fixtures at all, and says how many", async () => {
    // The count is the assertion. `0 valid of 0` and `0 valid of 5` are the
    // same green tick on a careless suite and completely different facts.
    const names = (await readdir(fixturesDir)).filter((name) => name.endsWith(".json"));
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  it("every fixture parses as a valid v1 inventory", async () => {
    const names = (await readdir(fixturesDir)).filter((name) => name.endsWith(".json"));
    const failures: string[] = [];

    for (const name of names) {
      const result = readInventory(JSON.parse(await readFile(join(fixturesDir, name), "utf8")));
      if (result.status !== "ok") {
        failures.push(`${name}: ${result.status === "invalid" ? result.errors.join("; ") : `v${result.version}`}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("names each fixture after the project inside it", async () => {
    // The server derives the project name from the filename. A mismatch would
    // render one project's numbers under another's name — wrong, and wrong in a
    // way that looks entirely plausible.
    const names = (await readdir(fixturesDir)).filter((name) => name.endsWith(".json"));

    for (const name of names) {
      const result = readInventory(JSON.parse(await readFile(join(fixturesDir, name), "utf8")));
      if (result.status !== "ok") throw new Error(`${name} is not a valid inventory`);
      expect(result.inventory.project).toBe(name.replace(/\.json$/, ""));
    }
  });

  it("records a commit for every fixture, so a stale one can be spotted", async () => {
    const names = (await readdir(fixturesDir)).filter((name) => name.endsWith(".json"));

    for (const name of names) {
      const result = readInventory(JSON.parse(await readFile(join(fixturesDir, name), "utf8")));
      if (result.status !== "ok") throw new Error(`${name} is not a valid inventory`);
      expect(result.inventory.commit).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it("declares at least one tier with files in every fixture", async () => {
    // A fixture where every tier is undeclared or empty would make the demo
    // server render a table of dashes while still passing every structural
    // check above.
    const names = (await readdir(fixturesDir)).filter((name) => name.endsWith(".json"));

    for (const name of names) {
      const result = readInventory(JSON.parse(await readFile(join(fixturesDir, name), "utf8")));
      if (result.status !== "ok") throw new Error(`${name} is not a valid inventory`);
      const counted = TIERS.filter((tier) => {
        const report = result.inventory.tiers[tier];
        return report.declared && report.files > 0;
      });
      expect(counted.length).toBeGreaterThan(0);
    }
  });
});

describe("how the fixtures are collected", () => {
  /**
   * A manifest is per-project knowledge and belongs at that project's root.
   * Four repositories now declare their own, and this repository must not go
   * back to supplying one on their behalf — that would be this package deciding
   * what another repository's tests are, which is the guessing the whole design
   * refuses.
   *
   * `--manifest` remains a real feature of the collector for trying a candidate
   * before committing it. This asserts only that the fixture pipeline does not
   * use it.
   */
  it("does not pass --manifest, so every source declares its own tiers", async () => {
    const script = await readFile(join(repoRoot, "scripts/collect-fixtures.sh"), "utf8");
    // Skip the comment lines, which discuss the flag on purpose.
    const code = script
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(code).not.toContain("--manifest");
  });

  it("does not carry candidate manifests any more", async () => {
    const entries = await readdir(fixturesDir, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    expect(directories).toEqual([]);
  });
});
