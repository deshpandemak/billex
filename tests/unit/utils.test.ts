import { describe, it, expect } from "vitest";
import { cn, displayToIso, formatDate, formatDateTime } from "@/lib/utils";
import { isAdmin, isBillViewer, isDataOperator } from "@/lib/auth/roles";
import { DESIGNATION_LABELS, DESIGNATIONS } from "@/types";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });
});

describe("isAdmin", () => {
  it("returns true for admin role", () => {
    expect(isAdmin("admin")).toBe(true);
  });

  it("returns false for data_operator role", () => {
    expect(isAdmin("data_operator")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe("isDataOperator", () => {
  it("returns true for data_operator role", () => {
    expect(isDataOperator("data_operator")).toBe(true);
  });

  it("returns false for admin role", () => {
    expect(isDataOperator("admin")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isDataOperator(null)).toBe(false);
  });
});

describe("isBillViewer", () => {
  it("returns true for bill_viewer role", () => {
    expect(isBillViewer("bill_viewer")).toBe(true);
  });

  it("returns false for admin role", () => {
    expect(isBillViewer("admin")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isBillViewer(null)).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats an ISO date string as DD-MM-YYYY", () => {
    expect(formatDate("2026-07-15")).toBe("15-07-2026");
  });

  it("pads single-digit day and month", () => {
    expect(formatDate("2026-01-05")).toBe("05-01-2026");
  });

  it("formats a native Date object", () => {
    expect(formatDate(new Date(2026, 6, 15))).toBe("15-07-2026");
  });

  it("formats a Firestore-Timestamp-like object with toDate()", () => {
    const fakeTimestamp = { toDate: () => new Date(2026, 6, 15) } as unknown as Parameters<typeof formatDate>[0];
    expect(formatDate(fakeTimestamp)).toBe("15-07-2026");
  });

  it("returns an em dash for null, undefined, or empty string", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("returns an em dash for an unparseable string", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("appends a formatted time after the date", () => {
    const result = formatDateTime(new Date(2026, 6, 15, 14, 30));
    expect(result).toBe("15-07-2026, 02:30 pm");
  });

  it("returns an em dash for null or undefined", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });
});

describe("displayToIso", () => {
  it("converts DD-MM-YYYY to YYYY-MM-DD", () => {
    expect(displayToIso("15-07-2026")).toBe("2026-07-15");
  });

  it("returns the input unchanged if not in display format", () => {
    expect(displayToIso("2026-07-15")).toBe("2026-07-15");
    expect(displayToIso("")).toBe("");
  });

  it("round-trips with formatDate", () => {
    expect(displayToIso(formatDate("2026-01-05"))).toBe("2026-01-05");
  });
});

describe("DESIGNATION_LABELS", () => {
  it("uses abbreviations instead of full designation names", () => {
    expect(DESIGNATION_LABELS.GP).toBe("GP");
    expect(DESIGNATION_LABELS.ADDL_GP).toBe("Addl GP");
    expect(DESIGNATION_LABELS.AGP).toBe("AGP");
    expect(DESIGNATION_LABELS.BPANEL).toBe("B'Pnl");
  });

  it("has a label for every designation", () => {
    DESIGNATIONS.forEach((d) => {
      expect(DESIGNATION_LABELS[d]).toBeTruthy();
    });
  });
});
