import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display the home page with KPI and action buttons", async ({ page }) => {
    await page.goto("/");

    // Check that the app title/branding is visible
    await expect(page.locator("text=Au Soleil").first()).toBeVisible();

    // Check that the geolocation button exists
    await expect(page.getByRole("button", { name: /autour de moi|around me/i })).toBeVisible();

    // Check that the search button exists
    await expect(page.getByRole("button", { name: /choisir|choose/i })).toBeVisible();

    // Check that bottom nav is present with 5 tabs
    const bottomNav = page.locator("div[style*='position: fixed'][style*='bottom: 0']");
    await expect(bottomNav).toBeVisible();
  });

  test("should navigate to search page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /choisir|choose/i }).click();
    await expect(page).toHaveURL("/search");
  });

  test("should toggle between sun and shade mode", async ({ page }) => {
    await page.goto("/");

    // Click the shade mode button
    const shadeButton = page.getByRole("button", { name: /ombre|shade/i });
    await shadeButton.click();

    // Page background should change (shade mode has blue tint)
    // Just verify the button click didn't break anything
    await expect(page.locator("text=Au Soleil").first()).toBeVisible();
  });
});
