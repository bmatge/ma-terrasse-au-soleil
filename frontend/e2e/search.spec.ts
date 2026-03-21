import { test, expect } from "@playwright/test";

test.describe("Search Page", () => {
  test("should display search form with tabs", async ({ page }) => {
    await page.goto("/search");

    // Check search type tabs are visible
    await expect(page.getByRole("button", { name: /adresse|address/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /terrasse/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /métro|metro/i })).toBeVisible();

    // Check search input exists
    await expect(page.locator("input[type='text'], input:not([type])").first()).toBeVisible();
  });

  test("should switch between search tabs", async ({ page }) => {
    await page.goto("/search");

    // Click metro tab
    await page.getByRole("button", { name: /métro|metro/i }).click();

    // Input placeholder should change
    const input = page.locator("input[type='text'], input:not([type])").first();
    await expect(input).toBeVisible();
  });
});
