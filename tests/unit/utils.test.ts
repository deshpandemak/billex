import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/lib/auth/roles";

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

  it("returns false for user role", () => {
    expect(isAdmin("user")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAdmin(null)).toBe(false);
  });
});
