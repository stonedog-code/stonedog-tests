import { expect, test } from "@playwright/test";

/**
 * These assert against the committed fixtures, which are collected from real
 * repositories — so they are checking that real data reaches a real browser and
 * renders, not that a mock renders.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("fleet-table")).toBeVisible();
});

test("renders a row for every project in the fixtures", async ({ page }) => {
  for (const project of [
    "stonedog-howto",
    "stonedog-style",
    "stonedog-testrunner",
    "diagram-viewer",
    "stonedog-tests",
  ]) {
    await expect(page.getByTestId(`row-${project}`)).toBeVisible();
  }
});

test("states how many fixtures it read, so an empty set cannot look like a full one", async ({ page }) => {
  await expect(page.getByTestId("examined")).toContainText("Read 5 fixture file(s)");
  await expect(page.getByText(/5 of 5 projects reported an inventory/)).toBeVisible();
});

test("shows stonedog-style's undeclared integration tier as undeclared, not as zero", async ({ page }) => {
  const row = page.getByTestId("row-stonedog-style");
  await expect(row.getByTestId("tier-undeclared")).toHaveCount(1);
  await expect(row.getByTestId("tier-undeclared")).toContainText("none declared");
  // And therefore it must refuse to name a shape.
  await expect(row.getByTestId("shape-incomplete")).toBeVisible();
});

test("names stonedog-howto a pyramid from its real counts", async ({ page }) => {
  await expect(page.getByTestId("row-stonedog-howto").getByTestId("shape-pyramid")).toBeVisible();
});

/**
 * The assertion jsdom structurally cannot make. A zero-sized box always fits.
 */
test("the page does not scroll horizontally", async ({ page }) => {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});

test("the table itself scrolls rather than the page, when it is too wide", async ({ page }) => {
  // The design system's table wraps its content in a scroll container; this
  // proves the wide-content rule holds at whatever viewport this project runs.
  const container = page.getByTestId("styled-table-scrollbar");
  await expect(container).toBeVisible();
  const scrolls = await container.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.overflowX === "auto" || style.overflowX === "scroll";
  });
  expect(scrolls).toBe(true);
});
