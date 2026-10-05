/**
 * What PROTO requires (V2.1 §1.3, recalibrated to Icon's real proto packs). At PROTO a pack needs:
 *  - style code, item, brand, date (on the pack itself);
 *  - overall dimensions — the ones the category gives (partial sizes allowed);
 *  - per colourway: colour and material (swatch, fabric code, supplier card text, or a reference);
 *  - logo method and location;
 *  - hardware identity for each visible part (library code, a description, or a reference);
 *  - and Jon's earlier requirement — hardware specs, full strap / handle specs, interior — where a
 *    reference answer satisfies it.
 * Everything else may be blank at PROTO (it prints nothing, never a guess). PRODUCTION requires
 * every ★ question, as before.
 */
import type { Question } from "@/lib/questions/types";

export type Stage = "PROTO" | "PRODUCTION";

const PROTO_REQUIRED: RegExp[] = [
  // Overall dimensions the category gives.
  /^dims\.(unit|h|w|d)$/,
  /\.size_[lwh]$/,
  /^(lug|slug)\.size$/,
  // Colourways: colour and material per colourway.
  /^materials\.(list|matrix)$/,
  // Logo method + location.
  /^branding\.(logo_type|placement)$/,
  // Hardware: identity of each visible part (and its specs — a reference answer satisfies them).
  /^hardware\.items$/,
  /^hw\.(type|component)$/,
  // Full strap / handle specs (when the part exists — conditional questions only show then).
  /\.(strap|top_handle|wrist_strap|handles?)\.(width|length|drop|adjust_min|adjust_max|attachment)$/,
  /handle_(length|drop|attachment)$/,
  // Interior (lined or not, lining, pockets) — a reference answer satisfies it.
  /^interior\.(lined|lining_material|pockets)$/,
];

/** Is this question required at this stage? */
export function requiredAt(q: Question, stage: Stage): boolean {
  if (!q.required) return false;
  if (stage === "PRODUCTION") return true;
  return PROTO_REQUIRED.some((re) => re.test(q.id));
}
