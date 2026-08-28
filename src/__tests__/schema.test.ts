import { readInventory, shapeOf, SCHEMA_VERSION, type Inventory } from "../schema";

const tier = (files: number) => ({
  declared: true as const,
  globs: 1,
  files,
  cases: files * 2,
  languages: { typescript: { files, cases: files * 2 } },
});

const inventory = (overrides: Partial<Inventory> = {}): Inventory => ({
  schemaVersion: SCHEMA_VERSION,
  project: "demo",
  generatedAt: "2026-08-27T00:00:00.000Z",
  commit: "abc123",
  tiers: { unit: tier(10), integration: tier(5), e2e: tier(2) },
  ...overrides,
});

describe("readInventory", () => {
  it("accepts a well-formed document", () => {
    const result = readInventory(inventory());
    expect(result.status).toBe("ok");
  });

  // The non-vacuity half: the reader must actually reject things. A validator
  // only ever observed accepting has been run, not tested.
  it.each([
    ["not an object", 42],
    ["missing schemaVersion", { project: "d", tiers: {} }],
    ["missing project", { ...inventory(), project: "" }],
    ["a non-ISO generatedAt", { ...inventory(), generatedAt: "last tuesday" }],
    ["a missing tier", { ...inventory(), tiers: { unit: tier(1), integration: tier(1) } }],
    ["a negative file count", { ...inventory(), tiers: { ...inventory().tiers, unit: { ...tier(1), files: -1 } } }],
  ])("rejects %s", (_label, document) => {
    expect(readInventory(document).status).toBe("invalid");
  });

  it("reports a newer schema as unsupported rather than invalid", () => {
    // Version is checked BEFORE shape on purpose: a v2 document that fails v1's
    // shape rules must not be reported as malformed, or the operator debugs the
    // publisher instead of upgrading the reader.
    const result = readInventory({ schemaVersion: 99, anything: true });
    expect(result).toEqual({ status: "unsupported-version", version: 99 });
  });

  it("never throws, whatever it is handed", () => {
    for (const value of [null, undefined, [], "", 0, { tiers: null }]) {
      expect(() => readInventory(value)).not.toThrow();
    }
  });
});

describe("shapeOf", () => {
  it("names a pyramid", () => {
    expect(shapeOf(inventory())).toBe("pyramid");
  });

  it("names an ice-cream cone", () => {
    expect(
      shapeOf(inventory({ tiers: { unit: tier(1), integration: tier(4), e2e: tier(9) } })),
    ).toBe("ice-cream-cone");
  });

  it("names an hourglass", () => {
    expect(
      shapeOf(inventory({ tiers: { unit: tier(9), integration: tier(1), e2e: tier(6) } })),
    ).toBe("hourglass");
  });

  /**
   * The load-bearing case. Treating an undeclared tier as zero would classify
   * almost every project in this fleet as an ice-cream cone purely by omission
   * — a confident, wrong reading produced from absent data.
   */
  it("refuses to name a shape when any tier is undeclared", () => {
    expect(
      shapeOf(
        inventory({ tiers: { unit: tier(10), integration: { declared: false }, e2e: tier(2) } }),
      ),
    ).toBe("incomplete");
  });

  it("calls an all-empty declared project flat, not a pyramid", () => {
    expect(shapeOf(inventory({ tiers: { unit: tier(0), integration: tier(0), e2e: tier(0) } }))).toBe(
      "flat",
    );
  });
});
