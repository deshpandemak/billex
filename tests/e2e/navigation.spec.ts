import { test, expect } from "@playwright/test";

test.describe("Navigation and auth guards", () => {
  test("root redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("board page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/board");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("cases page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/cases");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("entries page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/entries");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("reports page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("admin page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });
});
