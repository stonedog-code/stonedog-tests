import { readManifest } from "../manifest";

const valid = {
  schemaVersion: 1,
  project: "demo",
  tiers: {
    unit: { include: ["src/**/*.test.ts"] },
    integration: { include: ["test/integration/**/*.test.ts"] },
    e2e: { include: [] },
  },
};

describe("readManifest", () => {
  it("accepts a well-formed manifest", () => {
    expect(readManifest(valid).status).toBe("ok");
  });

  it("accepts a tier declared empty, and keeps it distinct from an absent one", () => {
    const result = readManifest(valid);
    if (result.status !== "ok") throw new Error("expected ok");

    // `e2e: { include: [] }` is a positive statement; omitting the key is not.
    // The whole surface depends on these two staying different.
    expect(result.manifest.tiers.e2e).toEqual({ include: [] });
    expect(result.manifest.tiers.e2e).not.toBeUndefined();
  });

  it("treats an omitted tier as absent rather than empty", () => {
    const result = readManifest({ ...valid, tiers: { unit: { include: ["a"] } } });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.manifest.tiers.integration).toBeUndefined();
  });

  /**
   * A typo like "integrations" would otherwise silently produce an undeclared
   * tier, and the surface would report "none declared" for a tier the author
   * did declare — a wrong answer that looks like a considered one.
   */
  it("rejects an unknown tier name instead of ignoring it", () => {
    const result = readManifest({
      ...valid,
      tiers: { ...valid.tiers, integrations: { include: ["x"] } },
    });
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") throw new Error("expected invalid");
    expect(result.errors.join(" ")).toContain("integrations");
  });

  it.each([
    ["a missing schemaVersion", { project: "d", tiers: {} }],
    ["an empty project", { ...valid, project: "" }],
    ["tiers missing", { schemaVersion: 1, project: "d" }],
    ["a non-array include", { ...valid, tiers: { unit: { include: "src/**" } } }],
    ["a non-string glob", { ...valid, tiers: { unit: { include: [42] } } }],
  ])("rejects %s", (_label, document) => {
    expect(readManifest(document).status).toBe("invalid");
  });

  it("reports a newer manifest schema as unsupported", () => {
    expect(readManifest({ schemaVersion: 7, project: "d", tiers: {} })).toEqual({
      status: "unsupported-version",
      version: 7,
    });
  });
});
