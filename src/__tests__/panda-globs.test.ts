import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

/**
 * A Panda `include` glob that matches nothing fails SILENTLY: the components
 * render with class names that have no CSS rules behind them, and every build
 * stays green. optima-cloud-saas ran for months that way.
 *
 * So the globs are asserted to resolve to real files. This is the only signal
 * there is.
 */
describe("panda.config.ts include globs", () => {
  const config = readFileSync(resolve(repoRoot, "panda.config.ts"), "utf8");

  const includeGlobs = (): string[] => {
    const block = /include:\s*\[([\s\S]*?)\]/.exec(config);
    if (block === null) throw new Error("could not find the include array in panda.config.ts");
    return [...block[1]!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
  };

  it("declares both node_modules locations for @stonedogcode/style", () => {
    // npm workspaces hoist, so which of the two exists depends on the consuming
    // tree. Declaring only one is a coin flip that fails silently.
    const globs = includeGlobs();
    expect(globs).toContain("./node_modules/@stonedogcode/style/src/**/*.{ts,tsx}");
    expect(globs).toContain("../../node_modules/@stonedogcode/style/src/**/*.{ts,tsx}");
  });

  it("has at least one glob that resolves to real files in THIS tree", () => {
    const globs = includeGlobs();
    const resolved = globs.map((glob) => ({
      glob,
      matches: globSync(glob, { cwd: repoRoot }).length,
    }));

    // Report the whole set, so a failure says which glob went dead rather than
    // just that something did.
    const summary = resolved.map((r) => `${r.glob} → ${r.matches}`).join("\n  ");

    expect(resolved.some((r) => r.glob.startsWith("./src/") && r.matches > 0)).toBe(true);

    // At least one of the two @stonedogcode/style paths must resolve here, or
    // this package's own styled layer is being parsed without the design
    // system it is styled with.
    const styleMatches = resolved
      .filter((r) => r.glob.includes("@stonedogcode/style"))
      .reduce((total, r) => total + r.matches, 0);
    expect(styleMatches).toBeGreaterThan(0);

    // Kept as a message rather than an assertion: it is diagnostic context for
    // whichever expectation above fails.
    expect(summary.length).toBeGreaterThan(0);
  });
});
