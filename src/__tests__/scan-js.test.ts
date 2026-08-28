import { countCases } from "../languages";
import { stripJsNonCode } from "../scan-js";

/**
 * Every case in this file is a REAL miscount this package produced against its
 * own suite before the scanner replaced a regex comment-stripper. They are
 * written as regressions, not as hypotheticals.
 */
describe("stripJsNonCode", () => {
  it("does not treat a glob inside a string as the start of a block comment", () => {
    // The original defect. `"gone/*.ts"` opens `/*`, whose closing `*/` is
    // somewhere far below, and everything in between disappears — silently,
    // producing a smaller number that looks entirely reasonable.
    const source = [
      'const manifest = { include: ["nowhere/**/*.test.ts", "gone/*.ts"] };',
      'it("survives", () => {});',
      'it("also survives", () => {});',
    ].join("\n");

    expect(countCases("typescript", source)).toBe(2);
  });

  it("does not treat a JSX self-closing tag as a regex literal", () => {
    // `<Component />` follows a `}` or `"`, both of which read as regex-start
    // context. Scanning for the closing `/` then eats the rest of the file.
    const source = [
      'it("one", () => {',
      "  render(<FleetTable entries={[]} />);",
      "});",
      'it("two", () => {',
      "  render(<FleetTable entries={[]} />);",
      "});",
      'it("three", () => {});',
    ].join("\n");

    expect(countCases("typescript", source)).toBe(3);
  });

  it("does not treat a JSX closing tag as a regex literal", () => {
    const source = ['it("one", () => {', "  render(<Wrap><Inner /></Wrap>);", "});", 'it("two", () => {});'].join("\n");
    expect(countCases("typescript", source)).toBe(2);
  });

  it("still strips a genuine regex literal", () => {
    // The heuristic must not be so timid that a real regex containing `//` or
    // a quote leaks its contents back into the counted source.
    const stripped = stripJsNonCode('const url = /https:\\/\\/example\\.com/;\nit("one", () => {});');
    expect(stripped).not.toContain("example");
    expect(countCases("typescript", 'const url = /https:\\/\\/example\\.com/;\nit("one", () => {});')).toBe(1);
  });

  it("still strips genuine comments", () => {
    const source = [
      "// it(\"a commented test\", () => {});",
      "/* it(\"another\", () => {}); */",
      'it("the only real one", () => {});',
    ].join("\n");
    expect(countCases("typescript", source)).toBe(1);
  });

  it("keeps string delimiters so a call is still recognisable", () => {
    expect(stripJsNonCode('it("a name")')).toBe('it("")');
  });

  it("drops the contents of a template so a fixture source is not counted", () => {
    // A test that writes a fixture file containing `it(...)` must not have that
    // fixture counted as one of its own cases.
    const source = ['it("writes a fixture", async () => {', '  await write("a.test.ts", `it("inner", () => {});`);', "});"].join("\n");
    expect(countCases("typescript", source)).toBe(1);
  });
});

describe("countCases — .each with a call in its table", () => {
  it("counts a multi-line it.each whose data contains a function call", () => {
    // The second real miscount: an argument list matcher of `[^)]*` closes on
    // the `)` of `inventory()` and the whole match fails, dropping the case.
    const source = [
      "it.each([",
      '  ["a", 1],',
      '  ["b", inventory()],',
      '])("rejects %s", (_label, value) => {',
      "  expect(value).toBeDefined();",
      "});",
    ].join("\n");

    expect(countCases("typescript", source)).toBe(1);
  });

  it("counts test.concurrent.each as one case", () => {
    expect(countCases("typescript", 'test.concurrent.each([1])("n", () => {});')).toBe(1);
  });

  it("does not double-count an each block", () => {
    expect(countCases("typescript", 'it.each([1, 2])("n", () => {});')).toBe(1);
  });
});
