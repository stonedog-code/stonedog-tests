/**
 * The `@stonedogcode/style` presentation layer (`@stonedogcode/tests/styled`).
 *
 * A separate entry point on purpose: the core package has no styling
 * dependency, and importing this module is what opts a consumer into Panda CSS
 * and the design system.
 *
 * Consumers of this entry point must, in their own `panda.config.ts`:
 *   - add `stonedogStylePreset()` to `presets`, alongside `@pandacss/preset-base`
 *     and `@pandacss/preset-panda` (a `presets` array REPLACES the defaults);
 *   - add BOTH `./node_modules/@stonedogcode/tests/src/**` and
 *     `../../node_modules/@stonedogcode/tests/src/**` to `include`, plus the same
 *     pair for `@stonedogcode/style`. npm workspaces hoist, so which path exists
 *     depends on the tree, and a glob that matches nothing fails silently — the
 *     components render with class names that have no CSS behind them.
 */

export { FleetTable, type FleetTableProps } from "./fleet-table";
export { TierCell, type TierCellProps } from "./tier-cell";
