/**
 * The isomorphic entry point: types, schema readers, and derived readings.
 * Nothing here touches the filesystem, so it is safe in a browser bundle.
 *
 * The collector lives at `@stonedogcode/tests/node` and the React components at
 * `@stonedogcode/tests/styled`, so a consumer importing the table does not drag
 * `node:fs` into its client bundle.
 */

export {
  SCHEMA_VERSION,
  TIERS,
  readInventory,
  shapeOf,
  type Inventory,
  type LanguageCount,
  type ReadResult,
  type Shape,
  type Tier,
  type TierReport,
} from "./schema";

export {
  MANIFEST_FILENAME,
  readManifest,
  type ManifestResult,
  type TestManifest,
  type TierDeclaration,
} from "./manifest";

export { countCases, languageOf, type Language } from "./languages";

export {
  readableCount,
  toFleetEntry,
  type FleetEntry,
} from "./fleet";
