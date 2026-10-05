/** A material as it prints and is picked: supplier, article and shade, or its Icon F-code first. */
export function materialLabel(m: { supplier: string; articleName: string; colourNo: string; colourName: string; iconCode?: string; qualityOnly?: boolean }) {
  const art = m.articleName ? ` ${m.articleName}` : "";
  // A quality reference names no colour (V2.1 §10).
  const col = m.qualityOnly ? "" : [m.colourNo && (m.colourNo.startsWith("#") ? m.colourNo : `#${m.colourNo}`), m.colourName].filter(Boolean).join(" ");
  const ref = m.qualityOnly ? " (QUALITY REFERENCE)" : "";
  // Icon's cross-brand fabric code leads: "F-0000 SWATCH #12 — SUPPLIER ARTICLE".
  if (m.iconCode) return `${m.iconCode}${col ? ` SWATCH ${col}` : ""} — ${m.supplier}${art}${ref}`.trim().toUpperCase();
  return `${m.supplier}${art}${col ? ` / ${col}` : ""}${ref}`.trim().toUpperCase();
}
