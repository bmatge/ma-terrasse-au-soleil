import { test, expect } from "@playwright/test";

test.describe("Favorites Page", () => {
  test("should show empty state when no favorites", async ({ page }) => {
    // Clear localStorage
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("fav-terrasses"));

    await page.goto("/favorites");

    // Should show empty state message
    await expect(page.locator("text=💛")).toBeVisible();
  });

  test("should navigate to favorites from bottom nav", async ({ page }) => {
    await page.goto("/");

    // Click favorites in bottom nav
    const favButton = page.locator("div[style*='position: fixed'] button").nth(2);
    await favButton.click();

    await expect(page).toHaveURL("/favorites");
  });
});
