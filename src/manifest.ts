/**
 * The per-project declaration.
 *
 * Tiers are DECLARED, never inferred. A collector that guesses tiers from paths
 * produces confident numbers that mean different things in every repository —
 * measured across nine repos in this fleet, where `__tests__` directories carry
 * no tier marker at all and "integration" appears in filenames in three
 * different senses.
 *
 * Which globs are which tier is per-project knowledge, so it lives in the
 * project, exactly as a feature map keeps its governed roots out of the shared
 * package.
 */

import { SCHEMA_VERSION, TIERS, type Tier } from "./schema.js";

/** The filename a project commits at its root. */
export const MANIFEST_FILENAME = "stonedog-tests.json";

export interface TierDeclaration {
  /**
   * Globs, relative to the repository root. An EMPTY array is a positive
   * statement — "this tier exists as a decision, and it is empty" — and is not
   * the same as omitting the key, which says nothing.
   */
  include: string[];
  exclude?: string[];
}

export interface TestManifest {
  schemaVersion: number;
  project: string;
  tiers: Partial<Record<Tier, TierDeclaration>>;
}

export type ManifestResult =
  | { status: "ok"; manifest: TestManifest }
  | { status: "unsupported-version"; version: number }
  | { status: "invalid"; errors: string[] };

export function readManifest(value: unknown): ManifestResult {
  if (typeof value !== "object" || value === null) {
    return { status: "invalid", errors: ["not an object"] };
  }
  const doc = value as Record<string, unknown>;

  if (typeof doc.schemaVersion !== "number") {
    return { status: "invalid", errors: ["schemaVersion missing or not a number"] };
  }
  if (doc.schemaVersion !== SCHEMA_VERSION) {
    return { status: "unsupported-version", version: doc.schemaVersion };
  }

  const errors: string[] = [];
  if (typeof doc.project !== "string" || doc.project.length === 0) {
    errors.push("project missing or empty");
  }

  const tiers = doc.tiers;
  if (typeof tiers !== "object" || tiers === null) {
    return { status: "invalid", errors: [...errors, "tiers missing"] };
  }

  // An unknown tier name is an ERROR, not something to ignore. A typo like
  // "integrations" would otherwise silently produce an undeclared tier, and the
  // surface would report "none declared" for a tier the author did declare.
  for (const key of Object.keys(tiers as Record<string, unknown>)) {
    if (!(TIERS as readonly string[]).includes(key)) {
      errors.push(`unknown tier "${key}" (expected one of: ${TIERS.join(", ")})`);
    }
  }

  for (const tier of TIERS) {
    const decl = (tiers as Record<string, unknown>)[tier];
    if (decl === undefined) continue;
    if (typeof decl !== "object" || decl === null) {
      errors.push(`tiers.${tier} must be an object`);
      continue;
    }
    const d = decl as Record<string, unknown>;
    if (!Array.isArray(d.include) || d.include.some((g) => typeof g !== "string")) {
      errors.push(`tiers.${tier}.include must be an array of strings`);
    }
    if (d.exclude !== undefined && (!Array.isArray(d.exclude) || d.exclude.some((g) => typeof g !== "string"))) {
      errors.push(`tiers.${tier}.exclude must be an array of strings`);
    }
  }

  if (errors.length > 0) return { status: "invalid", errors };
  return { status: "ok", manifest: doc as unknown as TestManifest };
}
