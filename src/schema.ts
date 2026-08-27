/**
 * The inventory schema, and the reason it has three states rather than two.
 *
 * A test count is only meaningful next to the set it was counted over. This
 * schema therefore refuses to represent "no tests" and "nobody told us where to
 * look" with the same value, because collapsing them is how a dashboard reports
 * a project as untested when it was merely undeclared.
 */

export const SCHEMA_VERSION = 1 as const;

export const TIERS = ["unit", "integration", "e2e"] as const;
export type Tier = (typeof TIERS)[number];

/** Per-language totals within one tier. `cases` is null when the language has no counter. */
export interface LanguageCount {
  files: number;
  /**
   * Null means "not countable", never "zero". Only languages with a counter in
   * `languages.ts` produce a number; everything else is honest about not knowing.
   */
  cases: number | null;
}

/**
 * What one tier reports.
 *
 * `declared: false` is the absent case and carries no numbers at all — there is
 * nothing to report, and a zero here would be a claim nobody made.
 */
export type TierReport =
  | { declared: false }
  | {
      declared: true;
      /**
       * How many globs the manifest supplied. Load-bearing: `0 files over 0
       * globs` and `0 files over 6 globs` are the same output on a careless
       * tool and completely different facts. Renderers must show it.
       */
      globs: number;
      files: number;
      cases: number | null;
      languages: Record<string, LanguageCount>;
    };

export interface Inventory {
  schemaVersion: number;
  project: string;
  /** ISO-8601. */
  generatedAt: string;
  /** The commit the inventory describes, or null when the source is not a git checkout. */
  commit: string | null;
  tiers: Record<Tier, TierReport>;
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

export type ReadResult =
  | { status: "ok"; inventory: Inventory }
  | { status: "unsupported-version"; version: number }
  | { status: "invalid"; errors: string[] };

/**
 * Parse an unknown value into an Inventory.
 *
 * Deliberately total: it returns a status rather than throwing, because the
 * store holds documents published by many repositories on their own merge
 * cadences and will contain mixed schema versions indefinitely. A project that
 * has not merged in two months must render as "stale, unreadable" — not take
 * the page down.
 */
export function readInventory(value: unknown): ReadResult {
  if (typeof value !== "object" || value === null) {
    return { status: "invalid", errors: ["not an object"] };
  }
  const doc = value as Record<string, unknown>;

  if (typeof doc.schemaVersion !== "number") {
    return { status: "invalid", errors: ["schemaVersion missing or not a number"] };
  }
  // Version is checked BEFORE shape: a v2 document failing v1's shape checks
  // would otherwise be reported as malformed rather than as newer than us.
  if (doc.schemaVersion !== SCHEMA_VERSION) {
    return { status: "unsupported-version", version: doc.schemaVersion };
  }

  const errors: string[] = [];
  if (typeof doc.project !== "string" || doc.project.length === 0) {
    errors.push("project missing or empty");
  }
  if (typeof doc.generatedAt !== "string" || Number.isNaN(Date.parse(doc.generatedAt))) {
    errors.push("generatedAt missing or not an ISO-8601 date");
  }
  if (doc.commit !== null && typeof doc.commit !== "string") {
    errors.push("commit must be a string or null");
  }

  const tiers = doc.tiers;
  if (typeof tiers !== "object" || tiers === null) {
    errors.push("tiers missing");
    return { status: "invalid", errors };
  }

  for (const tier of TIERS) {
    const report = (tiers as Record<string, unknown>)[tier];
    if (typeof report !== "object" || report === null) {
      errors.push(`tiers.${tier} missing`);
      continue;
    }
    const r = report as Record<string, unknown>;
    if (typeof r.declared !== "boolean") {
      errors.push(`tiers.${tier}.declared missing or not a boolean`);
      continue;
    }
    if (r.declared === false) continue;

    for (const key of ["globs", "files"] as const) {
      if (typeof r[key] !== "number" || (r[key] as number) < 0) {
        errors.push(`tiers.${tier}.${key} missing or negative`);
      }
    }
    if (r.cases !== null && typeof r.cases !== "number") {
      errors.push(`tiers.${tier}.cases must be a number or null`);
    }
    if (typeof r.languages !== "object" || r.languages === null) {
      errors.push(`tiers.${tier}.languages missing`);
    }
  }

  if (errors.length > 0) return { status: "invalid", errors };
  return { status: "ok", inventory: doc as unknown as Inventory };
}

/* -------------------------------------------------------------------------- */
/* Derived readings                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The shape of a project's test distribution.
 *
 * This is the ONLY summary this package computes, and it is deliberately not a
 * score. Ranking projects by one number is what makes a metric worth gaming;
 * the ratio between tiers is what the pyramid comparison is actually about.
 */
export type Shape =
  | "pyramid"
  | "ice-cream-cone"
  | "hourglass"
  | "flat"
  | "incomplete";

export function shapeOf(inventory: Inventory): Shape {
  const counts = TIERS.map((t) => {
    const r = inventory.tiers[t];
    return r?.declared ? r.files : null;
  });

  // Any undeclared tier makes the shape unknowable. Treating "undeclared" as 0
  // would classify most projects as an ice-cream cone purely by omission.
  if (counts.some((c) => c === null)) return "incomplete";

  // Destructured with defaults rather than a cast: `noUncheckedIndexedAccess`
  // is held deliberately (consumers type-check this source under their own
  // config), so index access is `number | undefined` and the guard above is
  // what actually rules undefined out.
  const [unit = 0, integration = 0, e2e = 0] = counts as number[];
  const total = unit + integration + e2e;
  if (total === 0) return "flat";

  if (unit > integration && integration >= e2e) return "pyramid";
  if (e2e > integration && integration >= unit) return "ice-cream-cone";
  if (unit > integration && e2e > integration) return "hourglass";
  return "flat";
}
