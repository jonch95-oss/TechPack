import { describe, expect, it, vi } from "vitest";
import { friendlyAIError } from "@/lib/ai/errors";

vi.spyOn(console, "error").mockImplementation(() => {});

const apiError = (status: number, body: object) => Object.assign(new Error(`${status} ${JSON.stringify(body)}`), { status });

describe("friendlyAIError", () => {
  it("turns the preview's key error into plain English, without the raw JSON", () => {
    const e = apiError(401, { type: "error", error: { type: "authentication_error", message: "API key not scoped to a workspace" } });
    const msg = friendlyAIError(e, "claude", "AI pre-fill");
    expect(msg).toMatch(/rejected its API key/);
    expect(msg).not.toMatch(/[{}"]|authentication_error/);
  });
  it("explains an image account with no credit", () => {
    expect(friendlyAIError(new Error("You exceeded your current quota, please check your plan and billing details."), "image", "Drawing the flat")).toMatch(/out of credit/);
  });
  it("busy, unreachable and missing-key cases", () => {
    expect(friendlyAIError(apiError(429, { error: { type: "rate_limit_error" } }), "claude", "AI pre-fill")).toMatch(/busy/);
    expect(friendlyAIError(apiError(529, { error: { type: "overloaded_error" } }), "claude", "AI pre-fill")).toMatch(/Couldn't reach the AI service/);
    expect(friendlyAIError(Object.assign(new Error("ANTHROPIC_API_KEY is not set"), { name: "AIUnavailableError" }), "claude", "AI pre-fill")).toMatch(/isn't set up yet/);
  });
  it("falls back to a generic message, never the raw text", () => {
    expect(friendlyAIError(new Error('{"weird":"thing"}'), "claude", "AI pre-fill")).toBe("AI pre-fill didn't work this time. Try again, or answer by hand.");
  });
});
