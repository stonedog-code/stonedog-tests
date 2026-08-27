/**
 * Reduce JavaScript/TypeScript source to just its code, discarding comments,
 * string contents and regex literals.
 *
 * This exists because the obvious approach — a regex that strips `/* … *␘/` and
 * `// …` — is wrong in a way that produces a plausible number rather than an
 * error. A glob in a string literal, `"gone/*.ts"`, contains `/*`, which opens
 * a comment the regex then closes at the next `*␘/` somewhere further down the
 * file, silently deleting every test in between.
 *
 * That is not hypothetical. It was found by this package counting its OWN
 * integration suite as 6 tests when the file contains 12: a manifest fixture
 * with the glob `"gone/*.ts"` ate half the file, and the count looked entirely
 * reasonable. A wrong number that looks right is the failure mode this whole
 * package is built to avoid, so the counter cannot be the thing that has it.
 *
 * String and template DELIMITERS are kept while their contents are dropped, so
 * `it("name")` and `` it`name` `` still read as calls while `` `it("x")` ``
 * inside a fixture string correctly does not.
 */

/**
 * Whether a `/` at this point starts a regex literal rather than a division.
 *
 * Decided from the previous significant character, which is the standard
 * heuristic. It is not a parser and does not need to be: the cost of getting it
 * wrong is a miscounted file, and the alternative is a TypeScript parse of every
 * test file in a fleet.
 */
function startsRegex(previousSignificant: string, next: string | undefined): boolean {
  // JSX, not division and not a regex. `<FleetTable />` closes on `}` or `"`
  // — both of which look like regex-start context — and treating that `/` as a
  // regex literal scans forward to the next `/` in the file, deleting whatever
  // is in between. That is how a .tsx component suite counted 6 tests instead
  // of 11.
  if (next === ">") return false;
  // `</Component>`: a closing tag. `<` followed by `/` is never valid JS.
  if (previousSignificant === "<") return false;

  if (previousSignificant === "") return true;
  return "(,=:[!&|?{};+-*%~^<>".includes(previousSignificant);
}

export function stripJsNonCode(source: string): string {
  let out = "";
  let index = 0;
  let previousSignificant = "";

  const isSpace = (character: string): boolean => character === " " || character === "\t" || character === "\n" || character === "\r";

  while (index < source.length) {
    const current = source[index]!;
    const next = source[index + 1];

    if (current === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      out += " ";
      continue;
    }

    if (current === '"' || current === "'" || current === "`") {
      const quote = current;
      out += quote;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === quote) break;
        index += 1;
      }
      out += quote;
      index += 1;
      previousSignificant = quote;
      continue;
    }

    if (current === "/" && startsRegex(previousSignificant, next)) {
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        // A character class may legally contain an unescaped `/`.
        if (source[index] === "[") {
          index += 1;
          while (index < source.length && source[index] !== "]") {
            if (source[index] === "\\") index += 1;
            index += 1;
          }
        }
        if (source[index] === "/") break;
        index += 1;
      }
      index += 1;
      while (index < source.length && /[a-z]/.test(source[index]!)) index += 1;
      out += " ";
      previousSignificant = " ";
      continue;
    }

    out += current;
    if (!isSpace(current)) previousSignificant = current;
    index += 1;
  }

  return out;
}
