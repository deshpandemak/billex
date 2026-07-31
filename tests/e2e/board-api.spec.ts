import { test, expect } from "@playwright/test";

test.describe("Board parse API", () => {
  test("returns 401 when no auth token is provided", async ({ request }) => {
    const res = await request.post("/api/board/parse", {
      multipart: {},
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("returns 401 for invalid auth token", async ({ request }) => {
    const res = await request.post("/api/board/parse", {
      headers: { Authorization: "Bearer invalid-token" },
      multipart: {},
    });

    expect(res.status()).toBe(401);
  });
});
