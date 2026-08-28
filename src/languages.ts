/**
 * Language detection, and counting test cases only where it can be done
 * honestly.
 *
 * The rule this file exists to enforce: a language with no counter reports
 * `null`, never `0`. A zero is a measurement; a null is an admission. Reporting
 * the second as the first is the "green result over an empty set" failure in
 * miniature — the number looks like evidence and was never taken.
 */

import { stripJsNonCode } from "./scan-js";

export type Language = "typescript" | "javascript" | "python" | "other";

const EXTENSIONS: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
};

export function languageOf(path: string): Language {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "other";
  return EXTENSIONS[path.slice(dot).toLowerCase()] ?? "other";
}

/**
 * Count test cases in one file's source.
 *
 * Returns null when the language has no counter. Parameterised cases
 * (`it.each`, `@pytest.mark.parametrize`) count as ONE, because one is what is
 * written — expanding them would produce a different number in every framework
 * and be comparable across none.
 */
export function countCases(language: Language, source: string): number | null {
  switch (language) {
    case "typescript":
    case "javascript":
      return countJsCases(source);
    case "python":
      return countPythonCases(source);
    default:
      return null;
  }
}

/**
 * `it(`, `test(`, and their `.each`/`.only`/`.failing` variants at any nesting.
 *
 * `describe` is deliberately NOT counted — it is a grouping, and counting it
 * would inflate a suite by its own folder structure. `.skip` and `.todo` are
 * also excluded: a skipped test is not a test that runs, and counting it is how
 * a suite reports coverage it does not have.
 */
function countJsCases(source: string): number {
  const stripped = stripJsNonCode(source);
  // Two patterns, not one.
  //
  // A single pattern that tried to swallow `.each(...)`'s argument list with
  // `[^)]*` breaks the moment that list contains a call — `["bad", inventory()]`
  // closes the group early and the whole match fails. Measured: it silently
  // dropped one case from this package's own schema suite, 8 where the file has
  // 9. So `.each` is counted on its NAME and its arguments are never parsed.
  const each = /(?:^|[\s;{}()])(?:it|test)(?:\.(?:only|concurrent|failing))*\.each\b/g;
  const direct = /(?:^|[\s;{}()])(?:it|test)(?:\.(?:only|concurrent|failing))*\s*(?:`|\()/g;
  return (stripped.match(each) ?? []).length + (stripped.match(direct) ?? []).length;
}

/**
 * `def test_*` and `async def test_*` at any indentation, which covers both
 * bare pytest functions and methods on a `Test*` class.
 */
function countPythonCases(source: string): number {
  const stripped = source.replace(/^\s*#.*$/gm, "");
  const pattern = /^[ \t]*(?:async[ \t]+)?def[ \t]+test[A-Za-z0-9_]*[ \t]*\(/gm;
  return (stripped.match(pattern) ?? []).length;
}
