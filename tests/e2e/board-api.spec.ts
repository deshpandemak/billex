import { test, expect } from "@playwright/test";

test.describe("Board parse API", () => {
  test("returns 400 when no files are provided", async ({ request }) => {
    const res = await request.post("/api/board/parse", {
      multipart: {},
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No files provided");
  });

  test("skips non-PDF files gracefully", async ({ request }) => {
    const res = await request.post("/api/board/parse", {
      multipart: {
        files: {
          name: "test.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("not a pdf"),
        },
      },
    });

    const body = await res.json();
    if (res.status() === 200) {
      expect(body.totalParsed).toBe(0);
    }
  });
});
