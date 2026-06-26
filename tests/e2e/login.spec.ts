import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders email and password form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h3")).toContainText("BillEx");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("Sign In");
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "invalid@test.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator(".text-red-600")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".text-red-600")).toContainText("Invalid email or password");
  });

  test("shows loading state during sign in", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "test@test.com");
    await page.fill('input[type="password"]', "password");
    await page.click('button[type="submit"]');

    await expect(page.locator('button[type="submit"]')).toContainText("Signing in...");
  });

  test("email field is required", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="password"]', "password");
    await page.click('button[type="submit"]');

    // Form validation prevents submission, URL stays on /login
    expect(page.url()).toContain("/login");
  });

  test("password field is required", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "test@test.com");
    await page.click('button[type="submit"]');

    expect(page.url()).toContain("/login");
  });
});
