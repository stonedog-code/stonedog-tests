import { countCases, languageOf } from "../languages";

describe("languageOf", () => {
  it.each([
    ["a.ts", "typescript"],
    ["a.tsx", "typescript"],
    ["a.mjs", "javascript"],
    ["test_thing.py", "python"],
    ["fixture.json", "other"],
    ["Makefile", "other"],
  ])("maps %s to %s", (path, expected) => {
    expect(languageOf(path)).toBe(expected);
  });
});

describe("countCases — JavaScript and TypeScript", () => {
  it("counts it() and test() at any nesting", () => {
    const source = `
      describe("outer", () => {
        it("one", () => {});
        describe("inner", () => {
          test("two", () => {});
          it.only("three", () => {});
        });
      });
    `;
    expect(countCases("typescript", source)).toBe(3);
  });

  it("counts a parameterised block as ONE case", () => {
    // One is what is written. Expanding to the row count would produce a
    // different number in every framework and be comparable across none.
    expect(countCases("typescript", `it.each([1, 2, 3])("n %s", () => {});`)).toBe(1);
  });

  it("does not count describe as a case", () => {
    expect(countCases("typescript", `describe("group", () => {});`)).toBe(0);
  });

  it("does not count a skipped or todo test", () => {
    // A skipped test is not a test that runs. Counting it is how a suite
    // reports coverage it does not have.
    const source = `it.skip("later", () => {}); test.todo("someday");`;
    expect(countCases("typescript", source)).toBe(0);
  });

  it("ignores it() inside comments", () => {
    const source = `
      // it("commented out", () => {});
      /* test("also commented", () => {}); */
      it("real", () => {});
    `;
    expect(countCases("typescript", source)).toBe(1);
  });

  it("counts a tagged-template case", () => {
    expect(countCases("typescript", "it`a templated name`")).toBe(1);
  });
});

describe("countCases — Python", () => {
  it("counts bare and async test functions", () => {
    const source = [
      "def test_one():",
      "    pass",
      "",
      "async def test_two():",
      "    pass",
      "",
      "class TestGroup:",
      "    def test_method(self):",
      "        pass",
    ].join("\n");
    expect(countCases("python", source)).toBe(3);
  });

  it("does not count a helper that merely contains the word test", () => {
    // pytest collects `test_*`, so a fixture helper named `make_test_client`
    // is not a case. Counting it would inflate every suite by its own helpers.
    expect(countCases("python", "def make_test_client():\n    pass\n")).toBe(0);
    expect(countCases("python", "def helper():\n    pass\n")).toBe(0);
  });

  it("ignores commented-out tests", () => {
    expect(countCases("python", "# def test_old():\ndef test_new():\n    pass\n")).toBe(1);
  });
});

describe("countCases — the honesty rule", () => {
  /**
   * The single most important assertion in this file. A language with no
   * counter must report null, never 0: a zero is a measurement and a null is an
   * admission, and reporting the second as the first is a green result over an
   * empty set.
   */
  it("returns null, not 0, for a language it cannot count", () => {
    const result = countCases("other", "some Go or Rust or Java source with tests in it");
    expect(result).toBeNull();
    expect(result).not.toBe(0);
  });
});
