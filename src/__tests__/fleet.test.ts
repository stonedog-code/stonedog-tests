import { readableCount, toFleetEntry } from "../fleet.js";
import { SCHEMA_VERSION, type Inventory } from "../schema.js";

const good: Inventory = {
  schemaVersion: SCHEMA_VERSION,
  project: "demo",
  generatedAt: "2026-08-27T00:00:00.000Z",
  commit: null,
  tiers: {
    unit: { declared: true, globs: 1, files: 3, cases: 9, languages: { typescript: { files: 3, cases: 9 } } },
    integration: { declared: false },
    e2e: { declared: false },
  },
};

describe("toFleetEntry", () => {
  it("reads a good document", () => {
    expect(toFleetEntry("demo", good)).toEqual({ project: "demo", status: "ok", inventory: good });
  });

  /**
   * The three non-ok states must stay distinguishable. "Published nothing",
   * "published something newer than us" and "published something broken" want
   * three different responses from an operator, and collapsing them into one
   * "no data" row throws that away.
   */
  it("distinguishes nothing-published from unreadable from too-new", () => {
    expect(toFleetEntry("a", undefined).status).toBe("none");
    expect(toFleetEntry("b", null).status).toBe("none");
    expect(toFleetEntry("c", { schemaVersion: 99 }).status).toBe("unsupported-version");
    expect(toFleetEntry("d", { schemaVersion: 1, project: "" }).status).toBe("unreadable");
  });

  it("never throws on hostile input, so one bad project cannot blank the table", () => {
    for (const value of [[], "", 0, { tiers: 1 }, { schemaVersion: "1" }]) {
      expect(() => toFleetEntry("x", value)).not.toThrow();
    }
  });
});

describe("readableCount", () => {
  /**
   * A total over three readable projects out of nine looks identical to a total
   * over nine unless the denominator is on screen next to it. Every surface
   * showing a fleet total must show this.
   */
  it("reports the denominator, not just the numerator", () => {
    const entries = [
      toFleetEntry("a", good),
      toFleetEntry("b", undefined),
      toFleetEntry("c", { schemaVersion: 99 }),
    ];
    expect(readableCount(entries)).toEqual({ readable: 1, total: 3 });
  });

  it("counts an all-unreadable fleet as 0 of n, never as an empty fleet", () => {
    const entries = [toFleetEntry("a", undefined), toFleetEntry("b", undefined)];
    expect(readableCount(entries)).toEqual({ readable: 0, total: 2 });
  });
});
