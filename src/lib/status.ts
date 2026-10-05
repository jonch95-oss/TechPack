import type { PackStatus } from "@/db/schema";

export const STATUS_LABEL: Record<PackStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Signed off",
  SENT: "Sent to factory",
  PROTO_RECEIVED: "Proto received",
  CLOSED: "Closed",
};

export function statusTone(s: PackStatus): "ok" | "ai" | "neutral" | "gold" {
  return s === "APPROVED" || s === "SENT" ? "ok" : s === "IN_REVIEW" ? "ai" : s === "PROTO_RECEIVED" ? "gold" : "neutral";
}

/** Statuses at which the final PDF may be exported (a second designer has signed off). */
export const SIGNED_OFF: PackStatus[] = ["APPROVED", "SENT", "PROTO_RECEIVED", "CLOSED"];

/**
 * Whether the final PDF needs a second designer's sign-off: a brand × stage setting (V2 §3 step 5),
 * off for proto and on for production unless the brand says otherwise.
 */
export function signoffRequired(stage: "PROTO" | "PRODUCTION", brand: { signoffProto?: boolean; signoffProduction?: boolean }) {
  return stage === "PRODUCTION" ? brand.signoffProduction !== false : brand.signoffProto === true;
}
