import { describe, expect, it } from "vitest";
import { signoffRequired } from "@/lib/status";

describe("V2 §3 step 5 — sign-off is a brand × stage setting", () => {
  it("is off for proto and on for production by default", () => {
    expect(signoffRequired("PROTO", {})).toBe(false);
    expect(signoffRequired("PRODUCTION", {})).toBe(true);
  });
  it("follows the brand", () => {
    expect(signoffRequired("PROTO", { signoffProto: true })).toBe(true);
    expect(signoffRequired("PRODUCTION", { signoffProduction: false })).toBe(false);
  });
});
