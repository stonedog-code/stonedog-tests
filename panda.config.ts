import { defineConfig } from "@pandacss/dev";
import { stonedogStylePreset } from "@stonedogcode/style/preset";

/**
 * This package's OWN Panda config, so it can typecheck and test its styled
 * layer. It is NOT what a consumer uses — a consumer builds `styled-system`
 * from its own config and merely adds `stonedogStylePreset()` to `presets` and
 * this package's source to `include`. See the README.
 */
export default defineConfig({
  preflight: false,

  /**
   * The base presets are listed EXPLICITLY. Supplying a `presets` array
   * REPLACES Panda's defaults rather than adding to them; omit these two and
   * the design system's recipes lose every token they lean on — the grey scale,
   * the radii, the spacing steps — and Panda drops those declarations silently.
   */
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda", stonedogStylePreset()],

  /**
   * `@stonedogcode/style` is listed because it ships TypeScript SOURCE: Panda
   * finds styles by statically parsing files at the CONSUMER's build, and a
   * package Panda never parses contributes no CSS — its components then render
   * with class names that have no rules behind them, with nothing failing.
   *
   * Both `node_modules` locations, deliberately. npm workspaces hoist, so which
   * one exists depends on the tree, and a glob matching nothing is silent.
   * `src/__tests__/panda-globs.test.ts` asserts these resolve to real files.
   */
  include: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@stonedogcode/style/src/**/*.{ts,tsx}",
    "../../node_modules/@stonedogcode/style/src/**/*.{ts,tsx}",
  ],
  exclude: ["./src/**/__tests__/**/*"],

  outdir: "styled-system",
  jsxFramework: "react",

  /**
   * Emit `.js` rather than Panda's default `.mjs`, purely so this package can
   * test itself: TypeScript will downlevel a `.js` file for Jest but never a
   * `.mjs` one, whose extension forces ESM output whatever `module` says.
   */
  outExtension: "js",
});
