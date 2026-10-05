/**
 * Reference answers (V2.1 §1): real proto packs answer many questions with a reference instead of a
 * value — "PLEASE FOLLOW REFERENCE IMAGE 2", "SAME AS <STYLE #>", "FROM PREVIOUS DEVELOPMENT".
 * Any question accepts one. At PROTO it is a settled answer and prints as written. At PRODUCTION,
 * TO_BE_PROVIDED and OPEN_OPTIONS block, and SAME_AS must resolve to a pack or library item.
 */
export const REF_KINDS = ["PER_IMAGE", "SAME_AS", "PREVIOUS_DEVELOPMENT", "FACTORY_STANDARD", "SCALE_TO_CAD", "OPEN_OPTIONS", "TO_BE_PROVIDED"] as const;
export type RefKind = (typeof REF_KINDS)[number];

export type ReferenceAnswer = {
  ref: RefKind;
  /** Free text: the instruction as written, or what the previous development / options are. */
  text?: string;
  /** SAME_AS: the style # (or library code) it is the same as, and optionally which part. */
  styleNo?: string;
  part?: string;
  /** PER_IMAGE: the reference photo's letter / number as printed ("2", "B"). */
  image?: string;
};

export const REF_LABEL: Record<RefKind, string> = {
  PER_IMAGE: "Follow reference image",
  SAME_AS: "Same as style",
  PREVIOUS_DEVELOPMENT: "From previous development",
  FACTORY_STANDARD: "Factory standard",
  SCALE_TO_CAD: "Scale to CAD",
  OPEN_OPTIONS: "Open to options",
  TO_BE_PROVIDED: "To be provided",
};

export function isReference(v: unknown): v is ReferenceAnswer {
  return !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as { ref?: unknown }).ref === "string" && (REF_KINDS as readonly string[]).includes((v as { ref: string }).ref);
}

/** As it prints on the pack (capitals). */
export function refText(r: ReferenceAnswer): string {
  const t = (r.text ?? "").trim();
  const up = (s: string) => s.toUpperCase();
  switch (r.ref) {
    case "PER_IMAGE":
      return up(t || `PLEASE FOLLOW REFERENCE IMAGE${r.image ? ` ${r.image}` : "S"}`);
    case "SAME_AS":
      return up(`${r.part ? `${r.part} ` : ""}SAME AS ${r.styleNo ?? ""}${t ? ` — ${t}` : ""}`.trim());
    case "PREVIOUS_DEVELOPMENT":
      return up(t ? `FROM PREVIOUS DEVELOPMENT — ${t}` : "FROM PREVIOUS DEVELOPMENT");
    case "FACTORY_STANDARD":
      return up(t || "FACTORY STANDARD");
    case "SCALE_TO_CAD":
      return up(t || "SCALE AS NEEDED TO MATCH SIZE ON CAD");
    case "OPEN_OPTIONS":
      return up(t || "WE ARE OPEN TO ALL AFFORDABLE OPTIONS");
    case "TO_BE_PROVIDED":
      return up(t || "TO BE PROVIDED");
  }
}

/** What a reference answer still owes at PRODUCTION ("" = nothing). `resolves` says whether a SAME_AS style / code exists in the studio. */
export function productionProblem(r: ReferenceAnswer, resolves: (styleNoOrCode: string) => boolean): string {
  if (r.ref === "TO_BE_PROVIDED") return "Still “to be provided” — give the value before production.";
  if (r.ref === "OPEN_OPTIONS") return "Still “open to options” — choose one before production.";
  if (r.ref === "SAME_AS" && !(r.styleNo && resolves(r.styleNo))) return `“Same as ${r.styleNo ?? "?"}” must point at a pack or library item in the studio.`;
  return "";
}

/** Splits answers into plain values (for templates and rules) and reference answers (printed as written). */
export function splitReferences<T extends Record<string, unknown>>(answers: T): { values: T; refs: Record<string, ReferenceAnswer> } {
  const values = {} as Record<string, unknown>;
  const refs: Record<string, ReferenceAnswer> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (isReference(v)) refs[k] = v;
    else values[k] = v;
  }
  return { values: values as T, refs };
}
