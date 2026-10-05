/**
 * Batch create (V2 §8): a spreadsheet of styles (style #, name, brand, category, base style,
 * colourways, render file name) or a folder of renders → N draft packs. Pure: parsing, grouping and
 * the checks; the server action creates the packs.
 */
import { CATEGORIES, type Category } from "@/lib/questions/types";

export type BatchRow = {
  line: number;
  styleNo: string;
  styleName: string;
  brand: string;
  category: Category | "";
  base: string;
  colorways: { code: string; name?: string }[];
  renders: string[];
  issues: string[];
};

const HEADERS: Record<keyof Omit<BatchRow, "line" | "issues" | "renders"> | "render", RegExp> = {
  styleNo: /^(style\s*(#|no\.?|number)?|sku)$/i,
  styleName: /^(style\s*)?name$/i,
  brand: /^brand$/i,
  category: /^(category|type)$/i,
  base: /^(base(\s*style)?|start\s*from|copy\s*from)$/i,
  colorways: /^colou?rways?$/i,
  render: /^(render|render\s*file(\s*name)?|image|cad)$/i,
};

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();

/** "BLACK, RED" → -A BLACK, -B RED; "-A, -B" → codes only; "-C NAVY" keeps its code. */
export function parseColourways(s: string): { code: string; name?: string }[] {
  const parts = s.split(/[,;/\n]+/).map(up).filter(Boolean);
  return parts.map((p, i) => {
    const m = p.match(/^(-[A-Z0-9]{1,3})\s*(.*)$/);
    return m ? { code: m[1], name: m[2] || undefined } : { code: `-${String.fromCharCode(65 + i)}`, name: p };
  });
}

export function categoryOf(s: string): Category | "" {
  const t = s.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return "";
  const hit = CATEGORIES.find((c) => c.toLowerCase() === t || c.toLowerCase().replace(/s$/, "") === t.replace(/s$/, ""));
  return hit ?? "";
}

/** Rows from a table whose first non-empty row is the header. Rows with neither style # nor name are skipped. */
export function parseBatchTable(table: string[][]): { rows: BatchRow[]; errors: string[] } {
  const start = table.findIndex((r) => r.some((c) => String(c ?? "").trim()));
  if (start < 0) return { rows: [], errors: ["The sheet is empty."] };
  const head = table[start].map((h) => String(h ?? "").trim());
  const col = Object.fromEntries(Object.entries(HEADERS).map(([k, re]) => [k, head.findIndex((h) => re.test(h))])) as Record<keyof typeof HEADERS, number>;
  const errors = col.styleNo < 0 ? ["No STYLE # column — name a column \"Style #\"."] : [];
  const rows: BatchRow[] = [];
  table.slice(start + 1).forEach((r, i) => {
    const get = (k: keyof typeof HEADERS) => (col[k] >= 0 ? String(r[col[k]] ?? "").trim() : "");
    const styleNo = up(get("styleNo"));
    const styleName = up(get("styleName"));
    if (!styleNo && !styleName) return;
    rows.push({
      line: start + i + 2,
      styleNo,
      styleName,
      brand: get("brand"),
      category: categoryOf(get("category")),
      base: up(get("base")),
      colorways: parseColourways(get("colorways")),
      renders: get("render").split(/[,;]+/).map((x) => x.trim()).filter(Boolean),
      issues: [],
    });
  });
  return { rows, errors };
}

/**
 * A folder of renders grouped into styles by file name: "PINK013-A.png" and "PINK013-B.jpg" are one
 * style with colourways -A and -B; "PINK014.png" is a style with one colourway.
 */
export function groupRenders(fileNames: string[]): { styleNo: string; colorways: { code: string }[]; renders: string[] }[] {
  const out = new Map<string, { styleNo: string; colorways: { code: string }[]; renders: string[] }>();
  for (const f of fileNames) {
    const stem = f.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, "").toUpperCase().replace(/\s+/g, "_");
    const m = stem.match(/^(.+?)[-_ ]?(-[A-Z])$/) ?? stem.match(/^(.+?)-([A-Z])$/);
    const styleNo = (m ? m[1] : stem).replace(/[-_]+$/, "");
    const code = m ? (m[2].startsWith("-") ? m[2] : `-${m[2]}`) : "-A";
    const g = out.get(styleNo) ?? { styleNo, colorways: [], renders: [] };
    if (!g.colorways.some((c) => c.code === code)) g.colorways.push({ code });
    g.renders.push(f);
    out.set(styleNo, g);
  }
  return [...out.values()].map((g) => ({ ...g, colorways: g.colorways.sort((a, b) => a.code.localeCompare(b.code)) }));
}

/** The checks a row must pass before its pack is created. */
export function checkRow(row: BatchRow, ctx: { brands: string[]; taken: (styleNo: string) => boolean; bases: (styleNo: string) => boolean; files: string[]; seen: Set<string> }): string[] {
  const issues: string[] = [];
  if (!/^[A-Z0-9_-]{3,30}$/.test(row.styleNo)) issues.push("Style # — letters, digits, _ or -.");
  else if (ctx.taken(row.styleNo)) issues.push(`${row.styleNo} already exists.`);
  else if (ctx.seen.has(row.styleNo)) issues.push(`${row.styleNo} is in the sheet twice.`);
  if (!row.styleName) issues.push("Style name is required.");
  if (!row.brand || !ctx.brands.some((b) => b.toUpperCase() === row.brand.toUpperCase())) issues.push(row.brand ? `Unknown brand ${row.brand}.` : "Brand is required.");
  if (!row.category) issues.push("Category is required (one of the app's categories).");
  if (row.base && !ctx.bases(row.base)) issues.push(`Base style ${row.base} not found.`);
  for (const r of row.renders) if (!ctx.files.some((f) => f.split(/[\\/]/).pop()!.toLowerCase() === r.toLowerCase())) issues.push(`Render ${r} not uploaded.`);
  return issues;
}
