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

  test("billing page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/billing");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("admin pleaders page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/admin/pleaders");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("admin fees page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/admin/fees");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("admin users page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });
});
