/**
 * A fleet is a list of projects, and a project that has published nothing is
 * still a row.
 *
 * This type exists so a renderer cannot accidentally drop a project it could
 * not read. "No inventory published", "published something we cannot parse" and
 * "published a newer schema" are three different facts, and a project that
 * vanishes from a table reads as a project that is fine.
 */

import { readInventory, type Inventory } from "./schema.js";

export type FleetEntry =
  | { project: string; status: "ok"; inventory: Inventory }
  /** Nothing has been published for this project yet. */
  | { project: string; status: "none" }
  /** Published, but this reader is older than the document. */
  | { project: string; status: "unsupported-version"; version: number }
  /** Published and malformed, or the fetch failed. */
  | { project: string; status: "unreadable"; reason: string };

/**
 * Turn whatever the host fetched into an entry, without throwing.
 *
 * Pass `undefined` for a project with no document. Any parse failure becomes an
 * `unreadable` row rather than an exception, because one project's malformed
 * document must never take the whole table down — projects publish on their own
 * merge cadences and the store holds mixed versions indefinitely.
 */
export function toFleetEntry(project: string, document: unknown): FleetEntry {
  if (document === undefined || document === null) {
    return { project, status: "none" };
  }

  const result = readInventory(document);
  switch (result.status) {
    case "ok":
      return { project, status: "ok", inventory: result.inventory };
    case "unsupported-version":
      return { project, status: "unsupported-version", version: result.version };
    case "invalid":
      return { project, status: "unreadable", reason: result.errors.join("; ") };
  }
}

/**
 * How many projects in a fleet actually contributed numbers.
 *
 * Every surface that shows a fleet total must also show this. A total over
 * three readable projects out of nine looks identical to a total over nine
 * unless the denominator is on screen next to it.
 */
export function readableCount(entries: readonly FleetEntry[]): {
  readable: number;
  total: number;
} {
  return {
    readable: entries.filter((entry) => entry.status === "ok").length,
    total: entries.length,
  };
}
