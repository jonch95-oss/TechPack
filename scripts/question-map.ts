/**
 * Writes docs/V2-QUESTION-MAP.md (V2 brief §10): every question id in the bank → where its answer
 * will come from in v2 and the stage that requires it. Generated from the live question bank so
 * nothing is missed; the rules below encode §2 (sources), §4 (hardware / materials), §5 (house
 * standards), §6 (stages) and the §10 handbag table. Re-run after editing the rules:
 *
 *   npx tsx scripts/question-map.ts
 */
import { writeFileSync } from "node:fs";
import { CATEGORIES, sectionsFor, type Category, type Question } from "../src/lib/questions";

type Stage = "PROTO" | "PRODUCTION" | "never";
type Row = { source: string; stage: Stage; note: string };

const PREFIX: Record<Category, string> = {
  Handbags: "hb",
  SLGs: "slg",
  "Hardside luggage": "lug",
  "Softside luggage": "slug",
  Duffels: "duf",
  "Rolling duffels": "rduf",
  "Men's bags": "men",
  Belts: "belt",
  "Cosmetic bags": "cos",
  "Toiletry kits": "cos",
  "Coolers / insulated": "cool",
  "Packing cubes": "cube",
  "Neck pillows": "neck",
  Hardware: "hw",
  "Decorative hardware": "deco",
  "Print artwork": "art",
} as Record<Category, string>;

const req = (q: Question): Stage => (q.required ? "PROTO" : "never");
const isDim = (q: Question) => q.kind === "stepper" && ["dim", "mm"].includes((q as { unit?: string }).unit ?? "");
const isSize = (q: Question) => q.kind === "dims2";
const MEASURE = "SPEC > DESIGNER (AI EST proposes)";

/** Exact ids from §10 and §5 first; then patterns; then the default for the question's kind. */
function classify(q: Question): Row {
  const id = q.id;
  const x: Record<string, Row> = {
    "dims.unit": { source: "HOUSE", stage: "never", note: "Per brand (Pink London cm, Ted Baker inches); never asked." },
    "dims.show_secondary": { source: "HOUSE", stage: "never", note: "Per brand; never asked." },
    "dims.h": { source: MEASURE, stage: "PROTO", note: "Proportional EST shown in the app only; never printed until settled." },
    "dims.w": { source: MEASURE, stage: "PROTO", note: "As H." },
    "dims.d": { source: MEASURE, stage: "PROTO", note: "As H." },
    "header.description": { source: "DERIVED", stage: "never", note: "Drafted from the answers; trusted, editable, no confirm." },
    "header.retailer": { source: "DESIGNER (remembers last per brand)", stage: "never", note: "Not required for PROTO." },
    "header.season": { source: "DESIGNER (remembers last per brand)", stage: "never", note: "Not required for PROTO." },
    "header.reference_sample": { source: "DESIGNER (remembers last per brand)", stage: "never", note: "Not required for PROTO." },
    "header.due_date": { source: "DESIGNER (default ASAP)", stage: "never", note: "Prints ASAP when blank." },
    "header.physical_sample": { source: "DESIGNER", stage: "never", note: "Banner on page 1 when on." },
    "colorways.names": { source: "AI > DESIGNER", stage: "PROTO", note: "Count and names read from the render / board." },
    "materials.list": { source: "AI + SPEC", stage: "PROTO", note: "Fabrics and leathers only; hardware and zippers never numbered." },
    "materials.matrix": { source: "LIBRARY (swatch) > SPEC (text) > DESIGNER", stage: "PROTO", note: "Matrix tools + colourway families (§4.4)." },
    "branding.logo_type": { source: "AI > HOUSE", stage: "PROTO", note: "" },
    "branding.foil_colour": { source: "HOUSE > DESIGNER", stage: "PROTO", note: "Only for foil logos." },
    "branding.logo_code": { source: "HOUSE (default logo per brand × logo type)", stage: "PROTO", note: "LIBRARY item carries size and finish." },
    "branding.logo_size": { source: "LIBRARY (logo item)", stage: "PROTO", note: "Typed only when the logo item is new." },
    "branding.placement": { source: "AI > HOUSE", stage: "PROTO", note: "" },
    "branding.offset": { source: "HOUSE > DESIGNER (AI EST proposes)", stage: "PROTO", note: "Proportional EST until settled." },
    "branding.offset_edge": { source: "HOUSE", stage: "PROTO", note: "" },
    "branding.finish": { source: "LIBRARY (logo item)", stage: "PROTO", note: "" },
    "branding.fill": { source: "LIBRARY (logo item)", stage: "never", note: "" },
    "branding.artwork": { source: "LIBRARY", stage: "PROTO", note: "Only when the logo item is new." },
    "branding.tool_depth": { source: "LIBRARY", stage: "never", note: "Only when the logo item is new." },
    "branding.new_tooling": { source: "LIBRARY", stage: "never", note: "Only when the logo item is new." },
    "edge.treatment": { source: "HOUSE + TEMPLATE", stage: "PROTO", note: "e.g. PU bags: EDGE PAINT." },
    "edge.paint_colour": { source: "HOUSE", stage: "PROTO", note: "e.g. DTM; Ted Baker accessories BLACK." },
    "edge.contrast_colour": { source: "DESIGNER", stage: "PROTO", note: "Only when CONTRAST." },
    "construction.list": { source: "TEMPLATE (rows) + HOUSE", stage: "PROTO", note: "Structure settled by the silhouette template; no typing." },
    "construction.thread_colour": { source: "HOUSE", stage: "PROTO", note: "DTM by default." },
    "hardware.finish": { source: "HOUSE (kit) > AI", stage: "PROTO", note: "One hardware table (§4.1)." },
    "hardware.items": { source: "AI + HOUSE kit + LIBRARY + SPEC", stage: "PROTO", note: "Code, size in mm, finish, qty, location for every part." },
    "placements.list": { source: "DERIVED (branding + AI positions, EST)", stage: "PROTO", note: "Positions entered once (Branding / hardware table)." },
    "zippers.list": { source: "AI rows + LIBRARY + SPEC", stage: "PROTO", note: "Gauge EST after the first dimension." },
    "pom.list": { source: "DERIVED (TEMPLATE points + answers)", stage: "PROTO", note: "Designer never re-types a value. Tolerances only if the admin switched the section on." },
    "bom.list": { source: "DERIVED (answers + LIBRARY + TEMPLATE skeleton)", stage: "PROTO", note: "Hidden parts only if enabled. No prices." },
    "comments.list": { source: "DESIGNER", stage: "never", note: "" },
  };
  if (x[id]) return x[id];
  if (id.startsWith("header.licensor")) return { source: "HOUSE (brand)", stage: "PRODUCTION", note: "Asked at production only." };
  if (id.startsWith("pages.")) return { source: "HOUSE", stage: "never", note: "Per brand." };
  if (id.startsWith("opt.")) return { source: "HOUSE switch (off by default)", stage: "PRODUCTION", note: "Only when the admin switches the section on for a retailer / brand; never automatic." };
  if (id.startsWith("interior.")) return { source: "HOUSE (interior package) / BASE STYLE", stage: req(q), note: "AI only overrides from interior photos." };
  if (/\.gusset_width$/.test(id)) return { source: "DERIVED (= D)", stage: "never", note: "Never shown as a question." };
  if (/\.snap_spacing_value$/.test(id)) return { source: "DERIVED", stage: "PROTO", note: "From flap width + qty + spacing rule." };
  if (/\.strap\.drop$/.test(id)) return { source: "DERIVED", stage: "PROTO", note: "From strap length + body H when both are known." };
  if (/\.capacity(_l)?$/.test(id)) return { source: "DERIVED", stage: req(q), note: "From the dimensions." };
  if (/\.(strap|top_handle|wrist_strap)\.(width|length|adjust_min|adjust_max|drop)$/.test(id) || /handle_(drop|length)$/.test(id))
    return { source: "SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER", stage: req(q) === "never" && /strap|handle/.test(id) ? "PROTO" : req(q), note: "Full strap / handle specs are PROTO. Template numbers shown EST until confirmed." };
  if (/\.(strap|top_handle|wrist_strap|handles?)\.attachment$/.test(id) || /handle_attachment$/.test(id))
    return { source: "AI > BASE STYLE", stage: "PROTO", note: "Attachment is part of the full strap / handle spec (§6)." };
  if (/\.(strap|top_handle|wrist_strap)(\.|$)/.test(id)) return { source: "AI > BASE STYLE", stage: q.required ? "PROTO" : "never", note: "" };
  if (/\.flap_height$/.test(id)) return { source: MEASURE, stage: "PROTO", note: "Needed for the snap position in mm (§6 closure)." };
  if (/(ext_pockets|front_pockets|end_pockets)$/.test(id)) return { source: "AI rows + SPEC sizes", stage: "PROTO", note: "When the style has them: each pocket's size (W × H) and zip opening." };
  if (/\.(feet|charm|id_tag)\.?(qty|code)$|_(qty|code)$/.test(id) && !/snap_qty|card|cans/.test(id))
    return { source: q.kind === "lib" ? "LIBRARY (+ HOUSE kit)" : "AI > BASE STYLE", stage: "PROTO", note: "When the part is present: every hardware part needs code, size, finish, qty (§6)." };
  if (/cold_claim|cold_hours/.test(id)) return { source: "DESIGNER", stage: "PRODUCTION", note: "Claims need test reports." };
  if (q.kind === "lib") return { source: "LIBRARY (+ HOUSE kit)", stage: req(q), note: "" };
  if (isDim(q) || isSize(q)) return { source: MEASURE, stage: req(q), note: q.visibility === "inferred" ? "Hidden on a front render." : "" };
  if (q.kind === "file") return { source: "DESIGNER (upload) / LIBRARY", stage: req(q), note: "" };
  if (q.visibility === "inferred") return { source: "BASE STYLE > HOUSE > DESIGNER", stage: req(q), note: "AI only from extra photos (back / side / interior)." };
  if (q.kind === "comment" || q.kind === "text") return { source: "DESIGNER", stage: req(q), note: "" };
  if (q.kind === "rows") return { source: "AI rows + DESIGNER", stage: req(q), note: "" };
  return { source: "AI > BASE STYLE", stage: req(q), note: "" };
}

/* ---------------------- Round 6 decisions (Jon) ---------------------- */

/** "never" is only for admin and presentation fields; everything else that describes the product is PROTO. */
const ADMIN = new Set(["header.retailer", "header.season", "header.reference_sample", "header.due_date", "header.physical_sample", "header.description", "comments.list", "dims.unit", "dims.show_secondary"]);
const isAdmin = (q: Question) => ADMIN.has(q.id) || q.id.startsWith("pages.");

type Cond = NonNullable<Question["showIf"]>;
function condText(c: Cond | undefined): string {
  if (!c) return "";
  if ("all" in c) return c.all.map((x) => condText(x as Cond)).filter(Boolean).join(" and ");
  if ("any" in c) return c.any.map((x) => condText(x as Cond)).filter(Boolean).join(" or ");
  if ("category" in c) return "";
  if ("truthy" in c) return `\`${c.q}\` is yes`;
  if ("eq" in c) return `\`${c.q}\` = ${String(c.eq)}`;
  if ("in" in c) return `\`${c.q}\` is ${c.in.join(" / ")}`;
  if ("includes" in c) return `\`${c.q}\` includes ${c.includes}`;
  return "";
}

function decide(q: Question): Row {
  const r = { ...classify(q) };
  // A. The base style wins over the AI read (conflict chip when they differ); AI still beats HOUSE. Hidden fields
  // already put BASE STYLE first (open point 4), so this applies to every field.
  {
    const before = r.source;
    r.source = r.source.replace(/^AI > BASE STYLE/, "BASE STYLE > AI").replace(/^AI > HOUSE/, "BASE STYLE > AI > HOUSE");
    if (r.source !== before) r.note = [r.note, "Conflict chip when the AI read differs from the base style."].filter(Boolean).join(" ");
  }
  // B. When a part exists on the product, its spec is PROTO; "never" only for admin / presentation fields.
  if (r.stage === "never" && !isAdmin(q)) {
    r.stage = "PROTO";
    const when = condText(q.showIf as Cond | undefined);
    r.note = [when && `When ${when}.`, r.note].filter(Boolean).join(" ");
  }
  return r;
}

/** The categories a section can ever show in (its category condition, if any). */
function applies(section: { showIf?: unknown }, category: Category) {
  const s = section.showIf as { category?: string[] } | undefined;
  return !s?.category || s.category.includes(category);
}

type Entry = { q: Question; section: string; cats: Category[] };
const entries = new Map<string, Entry>();
for (const c of CATEGORIES)
  for (const s of sectionsFor(c)) {
    if (!applies(s, c)) continue;
    for (const q of s.questions) {
      const e = entries.get(q.id) ?? { q, section: s.title ?? s.id, cats: [] };
      e.cats.push(c);
      entries.set(q.id, e);
    }
  }

const esc = (s: string) => s.replace(/\|/g, "\\|");
const today = (q: Question) => `${q.required ? "★" : "○"}${q.visibility === "inferred" ? " hidden" : ""}`;
const row = (e: Entry, withCats: boolean) => {
  const r = decide(e.q);
  const cats = e.cats.length === CATEGORIES.length ? "all" : e.cats.length > 3 ? `${e.cats.length} categories` : e.cats.join(", ");
  return `| \`${e.q.id}\` | ${esc(e.q.label)} | ${e.q.kind} | ${today(e.q)} | ${r.source} | ${r.stage} | ${esc(r.note)}${withCats ? ` | ${cats}` : ""} |`;
};

const shared = [...entries.values()].filter((e) => e.cats.length > 1);
const lines: string[] = [];
lines.push(
  "# V2 question map",
  "",
  "For review before v2 work starts (`docs/V2-SEAMLESS-BRIEF.md` §10). Every question id in the bank, for all 16 categories, with:",
  "",
  "- **Source** — where the answer comes from in v2, highest priority first (§2): DESIGNER, SPEC, BASE STYLE, LIBRARY, HOUSE, TEMPLATE, AI, DERIVED. `A > B` means A wins over B. EST = a proportional estimate shown in the app only, never printed until settled.",
  "- **Stage** — the stage whose export it blocks (§6): **PROTO** (and therefore production too), **PRODUCTION** only, or **never** (prints blank / TBC; never a guessed value).",
  "- **Today** — ★ required now, ○ optional now; *hidden* = can't be seen on a front render (INFERRED today).",
  "",
  "Generated from the live question bank by `scripts/question-map.ts` — change a rule there and re-run, so the map and the code can't drift. Mark up anything you disagree with and I'll change the rules, not the table by hand.",
  "",
);

// Summary per category.
lines.push("## Summary per category", "", "| Category | Questions | PROTO | PRODUCTION only | never | Settled without typing at PROTO¹ | AI proposes, designer confirms¹ | Designer types¹ |", "|---|---|---|---|---|---|---|---|");
for (const c of CATEGORIES) {
  const mine = [...entries.values()].filter((e) => e.cats.includes(c));
  const rs = mine.map((e) => decide(e.q));
  const proto = rs.filter((r) => r.stage === "PROTO");
  const settled = proto.filter((r) => /^(HOUSE|TEMPLATE|LIBRARY|DERIVED|BASE STYLE)/.test(r.source)).length;
  const types = proto.filter((r) => /^DESIGNER|^SPEC > DESIGNER/.test(r.source)).length;
  lines.push(`| ${c} | ${mine.length} | ${proto.length} | ${rs.filter((r) => r.stage === "PRODUCTION").length} | ${rs.filter((r) => r.stage === "never").length} | ${settled} | ${proto.length - settled - types} | ${types} |`);
}
lines.push(
  "",
  "¹ Counted over PROTO questions only, by the first source in the chain. Conditional questions (e.g. strap width only when there is a strap) are counted even though a given style shows fewer. \"Designer types\" includes measurements a spec sheet would fill, and SPEC > BASE STYLE chains count as AI-proposes. Since change A, \"settled\" includes BASE STYLE-first fields: settled when the style starts from a base style; with no base style the AI proposes them instead.",
  "",
);

lines.push("## Shared questions (every category, or several)", "", "| Question id | Label | Kind | Today | v2 source | Stage | Note | Categories |", "|---|---|---|---|---|---|---|---|");
for (const e of shared) lines.push(row(e, true));
lines.push("");

for (const c of CATEGORIES) {
  const own = [...entries.values()].filter((e) => e.cats.length === 1 && e.cats[0] === c);
  const sharedHere = shared.filter((e) => e.cats.includes(c)).length;
  lines.push(`## ${c}`, "", `${own.length} questions of its own (below) plus ${sharedHere} shared questions (table above). Prefix \`${PREFIX[c]}.\`.`, "");
  if (own.length) {
    lines.push("| Question id | Label | Kind | Today | v2 source | Stage | Note |", "|---|---|---|---|---|---|---|");
    for (const e of own) lines.push(row(e, false));
  }
  lines.push("");
}

lines.push(
  "## Decisions (round 6)",
  "",
  "- Open points 1–6 of the first draft: approved as proposed — construction rows and thread colour stay PROTO (settled by TEMPLATE / HOUSE, no typing); POM and BOM are DERIVED and PROTO with tolerances off unless the admin switches them on; interior follows the house package; hidden-on-render questions come from BASE STYLE / HOUSE first; component packs take LIBRARY / SPEC; cooler cold claims are PRODUCTION.",
  "- **A. BASE STYLE > AI** for every visible field, with a conflict chip when the AI read differs from the base style. AI still beats HOUSE.",
  "- **B. Part specs are PROTO when the part exists.** \"never\" is only for admin and presentation fields (retailer, season, reference sample, due date, physical-sample banner, description, comments, pages, unit display). A conditional question is required at PROTO only when its parent is yes — the note says when.",
  "",
);

writeFileSync("docs/V2-QUESTION-MAP.md", lines.join("\n"));
console.log(`docs/V2-QUESTION-MAP.md: ${entries.size} question ids, ${shared.length} shared.`);
