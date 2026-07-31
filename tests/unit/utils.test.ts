import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import { isAdmin, isBillViewer, isDataOperator } from "@/lib/auth/roles";

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
