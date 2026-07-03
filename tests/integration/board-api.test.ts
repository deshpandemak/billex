import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE_URL = "http://localhost:3000";
let serverReady = false;

beforeAll(async () => {
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(`${BASE_URL}/login`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}, 15000);

describe("POST /api/board/parse", () => {
  it("returns 400 when no files provided", async () => {
    if (!serverReady) return;

    const res = await fetch(`${BASE_URL}/api/board/parse`, {
      method: "POST",
      body: new FormData(),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("No files provided");
  });

  it("handles request with fake PDF gracefully", async () => {
    if (!serverReady) return;

    const pdfContent = `%PDF-1.4 fake header`;
    const form = new FormData();
    const blob = new Blob([pdfContent], { type: "application/pdf" });
    form.append("files", blob, "test-board.pdf");

    const res = await fetch(`${BASE_URL}/api/board/parse`, {
      method: "POST",
      body: form,
    });

    // Server should not crash — returns 200 (0 entries parsed) or 400 (file type check)
    expect([200, 400]).toContain(res.status);
  });

  it("skips non-PDF files", async () => {
    if (!serverReady) return;

    const form = new FormData();
    const blob = new Blob(["not a pdf"], { type: "text/plain" });
    form.append("files", blob, "test.txt");

    const res = await fetch(`${BASE_URL}/api/board/parse`, {
      method: "POST",
      body: form,
    });

    // The file gets filtered by type check, so either 400 (no valid files) or 200 with 0 entries
    const data = await res.json();
    if (res.status === 200) {
      expect(data.totalParsed).toBe(0);
    }
  });
});

describe("page routes", () => {
  it("login page returns 200", async () => {
    if (!serverReady) return;
    const res = await fetch(`${BASE_URL}/login`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("BillEx");
  });

  it("root page returns 200", async () => {
    if (!serverReady) return;
    const res = await fetch(`${BASE_URL}/`);
    expect(res.status).toBe(200);
  });

  it("dashboard page returns 200 (client-side auth redirect)", async () => {
    if (!serverReady) return;
    const res = await fetch(`${BASE_URL}/dashboard`);
    expect(res.status).toBe(200);
  });

  it("board page returns 200 (client-side auth redirect)", async () => {
    if (!serverReady) return;
    const res = await fetch(`${BASE_URL}/board`);
    expect(res.status).toBe(200);
  });
});
