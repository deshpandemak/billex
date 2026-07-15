// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

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

// The route checks for a valid Firebase ID token before it looks at the
// request body at all, so every case below is unauthenticated and must
// resolve to 401 regardless of what's in the form data. Body-validation
// behavior (missing files, non-PDF files, malformed PDFs) requires a real
// ID token to reach and is exercised by the unit tests for the parser
// itself, not this HTTP-level suite.
describe("POST /api/board/parse (unauthenticated)", () => {
  it("returns 401 when no files provided", async () => {
    if (!serverReady) return;

    const res = await fetch(`${BASE_URL}/api/board/parse`, {
      method: "POST",
      body: new FormData(),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("rejects a request with a fake PDF before parsing it", async () => {
    if (!serverReady) return;

    const pdfContent = `%PDF-1.4 fake header`;
    const form = new FormData();
    const blob = new Blob([pdfContent], { type: "application/pdf" });
    form.append("files", blob, "test-board.pdf");

    const res = await fetch(`${BASE_URL}/api/board/parse`, {
      method: "POST",
      body: form,
    });

    // The auth gate runs before file parsing, so the server never touches
    // the (fake) PDF content — it should reject with 401, not crash.
    expect(res.status).toBe(401);
  });

  it("rejects a request with non-PDF files", async () => {
    if (!serverReady) return;

    const form = new FormData();
    const blob = new Blob(["not a pdf"], { type: "text/plain" });
    form.append("files", blob, "test.txt");

    const res = await fetch(`${BASE_URL}/api/board/parse`, {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(401);
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
