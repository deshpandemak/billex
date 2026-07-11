import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  isoToDisplay,
  displayToIso,
  formatTimestampDate,
  formatTimestampDateTime,
} from "@/lib/date";

describe("isoToDisplay", () => {
  it("converts YYYY-MM-DD to DD-MM-YYYY", () => {
    expect(isoToDisplay("2026-07-11")).toBe("11-07-2026");
  });

  it("returns the input unchanged if not in ISO format", () => {
    expect(isoToDisplay("11-07-2026")).toBe("11-07-2026");
    expect(isoToDisplay("")).toBe("");
  });
});

describe("displayToIso", () => {
  it("converts DD-MM-YYYY to YYYY-MM-DD", () => {
    expect(displayToIso("11-07-2026")).toBe("2026-07-11");
  });

  it("returns the input unchanged if not in display format", () => {
    expect(displayToIso("2026-07-11")).toBe("2026-07-11");
    expect(displayToIso("")).toBe("");
  });

  it("round-trips with isoToDisplay", () => {
    expect(displayToIso(isoToDisplay("2026-01-05"))).toBe("2026-01-05");
  });
});

describe("formatTimestampDate", () => {
  it("formats a Timestamp as DD-MM-YYYY", () => {
    const ts = Timestamp.fromDate(new Date(2026, 6, 11)); // 11 Jul 2026, local time
    expect(formatTimestampDate(ts)).toBe("11-07-2026");
  });

  it("returns a dash for null/undefined", () => {
    expect(formatTimestampDate(null)).toBe("—");
    expect(formatTimestampDate(undefined)).toBe("—");
  });
});

describe("formatTimestampDateTime", () => {
  it("formats a Timestamp as DD-MM-YYYY HH:MM", () => {
    const ts = Timestamp.fromDate(new Date(2026, 6, 11, 9, 5));
    expect(formatTimestampDateTime(ts)).toBe("11-07-2026 09:05");
  });

  it("returns a dash for null/undefined", () => {
    expect(formatTimestampDateTime(null)).toBe("—");
    expect(formatTimestampDateTime(undefined)).toBe("—");
  });
});
