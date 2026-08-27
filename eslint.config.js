import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules/**", "styled-system/**", "coverage/**", "dist/**", "fixtures/**", "server/dist/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2023, sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: { console: "readonly", process: "readonly", URL: "readonly", fetch: "readonly" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      // `no-undef` is redundant under TypeScript and produces false positives
      // for DOM and Node globals the parser already knows about.
      "no-undef": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "test/**/*.ts", "e2e/**/*.ts"],
    languageOptions: {
      globals: {
        describe: "readonly", it: "readonly", test: "readonly", expect: "readonly",
        beforeAll: "readonly", afterAll: "readonly", beforeEach: "readonly", afterEach: "readonly",
        jest: "readonly",
      },
    },
  },
];
