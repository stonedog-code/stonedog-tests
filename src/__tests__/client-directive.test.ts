import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const styledDir = resolve(here, "../styled");

/**
 * Every component module under `src/styled/` must declare `"use client"`.
 *
 * ## Why this is a source assertion and not a render test
 *
 * `src/__tests__/fleet-table.test.tsx` renders `FleetTable` in jsdom and passes
 * whether or not the directive is present, because a jsdom render imports the
 * module directly and there is no RSC boundary to cross. That is exactly how
 * NEH-1284 shipped: eleven green component tests over a component that threw on
 * the first render in a real Next.js server tree.
 *
 * The directive is a property of the SOURCE TEXT — it is what a bundler's RSC
 * pass keys on — so the source text is the only honest thing to assert. A
 * consumer rendering `<FleetTable>` from a Server Component gets a client
 * reference for `StyledTable`, whose compound `.Header` / `.Body` / `.Row` /
 * `.Cell` / `.Caption` members do not survive the boundary and read
 * `undefined`. React throws, and Next renders "This page couldn't load" with no
 * detail anywhere in the browser.
 *
 * ## The count is part of the assertion
 *
 * A guard that inspects an empty set passes and reports nothing. If `readdirSync`
 * ever returns nothing — the directory moves, the extension changes — this must
 * fail rather than congratulate itself, so the size of the input set is asserted
 * before its contents.
 */
describe("src/styled component modules", () => {
  const componentFiles = readdirSync(styledDir)
    .filter((name) => name.endsWith(".tsx"))
    .sort();

  it("finds the component modules to check", () => {
    // Non-vacuity. Without this the loop below can examine nothing and pass.
    expect(componentFiles.length).toBeGreaterThanOrEqual(2);
    expect(componentFiles).toContain("fleet-table.tsx");
    expect(componentFiles).toContain("tier-cell.tsx");
  });

  it.each(componentFiles)('%s declares "use client" as its first statement', (name) => {
    const source = readFileSync(join(styledDir, name), "utf8");

    // The directive is only a directive when it leads the module. A bundler
    // ignores one placed after an import or a comment block, and it would then
    // read as present to a careless grep while doing nothing at all.
    const firstStatement = source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "");

    expect(firstStatement).toMatch(/^["']use client["'];?$/);
  });
});
