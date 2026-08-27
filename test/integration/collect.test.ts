/**
 * The integration tier: the real collector, real files on disk, real globbing.
 *
 * A unit test cannot see this seam. `fs.promises.glob` is the piece most likely
 * to behave differently from what a mock would agree to — brace expansion,
 * `**` depth, and whether a pattern that matches nothing throws or yields
 * nothing are all its behaviour, not ours.
 */

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collect, CollectError } from "../../src/node/collect.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function write(root: string, relative: string, contents: string): Promise<void> {
  const path = join(root, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

describe("collect against a real directory", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "stonedog-tests-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("counts files and cases across tiers and languages", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "sample",
      tiers: {
        unit: { include: ["src/**/*.test.ts"] },
        integration: { include: ["tests/integration/*.py"] },
        e2e: { include: ["e2e/*.spec.ts"] },
      },
    }));
    await write(root, "src/a.test.ts", `it("one", () => {}); it("two", () => {});`);
    await write(root, "src/deep/b.test.ts", `test("three", () => {});`);
    await write(root, "tests/integration/test_api.py", "def test_get():\n    pass\n\ndef test_put():\n    pass\n");
    await write(root, "e2e/flow.spec.ts", `it("walks", () => {});`);
    // Not matched by any glob — proves the globs select rather than the walk.
    await write(root, "src/not-a-test.ts", `it("should not be counted", () => {});`);

    const { inventory, report } = await collect({ repo: root, now: () => new Date("2026-08-27T00:00:00Z") });

    expect(report.globs).toBe(3);
    expect(report.filesMatched).toBe(4);
    expect(report.ambiguous).toEqual([]);

    const unit = inventory.tiers.unit;
    if (!unit.declared) throw new Error("unit should be declared");
    expect(unit.files).toBe(2);
    expect(unit.cases).toBe(3);
    expect(unit.languages.typescript).toEqual({ files: 2, cases: 3 });

    const integration = inventory.tiers.integration;
    if (!integration.declared) throw new Error("integration should be declared");
    expect(integration.files).toBe(1);
    expect(integration.cases).toBe(2);
    expect(integration.languages.python).toEqual({ files: 1, cases: 2 });
  });

  it("keeps an omitted tier undeclared rather than reporting it as zero", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "sample",
      tiers: { unit: { include: ["src/**/*.test.ts"] } },
    }));
    await write(root, "src/a.test.ts", `it("one", () => {});`);

    const { inventory, report } = await collect({ repo: root });

    expect(report.tiersDeclared).toBe(1);
    expect(inventory.tiers.integration).toEqual({ declared: false });
    expect(inventory.tiers.e2e).toEqual({ declared: false });
  });

  it("reports a declared tier whose globs matched nothing, with the glob count", async () => {
    // The whole point of carrying `globs` into the document: this is a manifest
    // defect (someone moved the tests), and it is indistinguishable from an
    // honestly empty tier unless the glob count travels with the zero.
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "sample",
      tiers: { unit: { include: ["nowhere/**/*.test.ts", "gone/*.ts"] } },
    }));

    const { inventory } = await collect({ repo: root });
    const unit = inventory.tiers.unit;
    if (!unit.declared) throw new Error("unit should be declared");
    expect(unit).toEqual({ declared: true, globs: 2, files: 0, cases: null, languages: {} });
  });

  it("counts a file matched by two globs in one tier exactly once", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "sample",
      tiers: { unit: { include: ["src/**/*.test.ts", "src/a.test.ts"] } },
    }));
    await write(root, "src/a.test.ts", `it("one", () => {});`);

    const { inventory } = await collect({ repo: root });
    const unit = inventory.tiers.unit;
    if (!unit.declared) throw new Error("unit should be declared");
    expect(unit.files).toBe(1);
    expect(unit.cases).toBe(1);
  });

  it("surfaces a file claimed by two different tiers instead of silently double-counting", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "sample",
      tiers: {
        unit: { include: ["tests/**/*.test.ts"] },
        integration: { include: ["tests/api.test.ts"] },
      },
    }));
    await write(root, "tests/api.test.ts", `it("one", () => {});`);

    const { report } = await collect({ repo: root });
    expect(report.ambiguous).toEqual([{ file: "tests/api.test.ts", tiers: ["unit", "integration"] }]);
  });

  it("honours exclude", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "sample",
      tiers: { unit: { include: ["src/**/*.test.ts"], exclude: ["src/skip/*.test.ts"] } },
    }));
    await write(root, "src/a.test.ts", `it("one", () => {});`);
    await write(root, "src/skip/b.test.ts", `it("two", () => {});`);

    const { inventory } = await collect({ repo: root });
    const unit = inventory.tiers.unit;
    if (!unit.declared) throw new Error("unit should be declared");
    expect(unit.files).toBe(1);
  });

  it("reports cases as null, not zero, for a language it cannot count", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "sample",
      tiers: { unit: { include: ["src/*.go"] } },
    }));
    await write(root, "src/main_test.go", "func TestThing(t *testing.T) {}");

    const { inventory, report } = await collect({ repo: root });
    const unit = inventory.tiers.unit;
    if (!unit.declared) throw new Error("unit should be declared");
    expect(unit.files).toBe(1);
    expect(unit.cases).toBeNull();
    expect(report.uncountedFiles).toBe(1);
  });

  it("refuses a repository with no manifest rather than guessing", async () => {
    await expect(collect({ repo: root })).rejects.toBeInstanceOf(CollectError);
    await expect(collect({ repo: root })).rejects.toThrow(/Tiers are declared, never inferred/);
  });

  it("refuses a manifest from a newer schema", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({ schemaVersion: 9, project: "s", tiers: {} }));
    await expect(collect({ repo: root })).rejects.toThrow(/schemaVersion 9/);
  });

  it("refuses a malformed manifest and names what is wrong", async () => {
    await write(root, "stonedog-tests.json", JSON.stringify({
      schemaVersion: 1,
      project: "s",
      tiers: { unti: { include: [] } },
    }));
    await expect(collect({ repo: root })).rejects.toThrow(/unknown tier "unti"/);
  });
});

describe("collect against this repository", () => {
  /**
   * Dogfooding, and the only test here that runs over a tree nobody wrote for
   * the occasion. It asserts a floor rather than an exact number so adding a
   * test does not break it — but the floor is non-zero, which is what proves
   * the globs in the committed manifest still point at real files.
   */
  it("finds its own three tiers", async () => {
    const { inventory, report } = await collect({ repo: repoRoot });

    expect(inventory.project).toBe("stonedog-tests");
    expect(report.tiersDeclared).toBe(3);
    expect(report.ambiguous).toEqual([]);

    const unit = inventory.tiers.unit;
    if (!unit.declared) throw new Error("unit should be declared");
    expect(unit.files).toBeGreaterThan(0);
    expect(unit.cases).toBeGreaterThan(0);

    const integration = inventory.tiers.integration;
    if (!integration.declared) throw new Error("integration should be declared");
    // This very file.
    expect(integration.files).toBeGreaterThan(0);
  });

  it("records the commit it describes", async () => {
    const { inventory } = await collect({ repo: repoRoot });
    expect(inventory.commit).toMatch(/^[0-9a-f]{40}$/);
  });
});
