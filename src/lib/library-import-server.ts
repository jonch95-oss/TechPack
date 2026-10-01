import "server-only";
import ExcelJS from "exceljs";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { HARDWARE_FINISHES, HARDWARE_MATERIALS, HARDWARE_TYPES } from "@/lib/questions/common";
import {
  FIELD_LABELS,
  emptyRow,
  fieldsFor,
  normaliseField,
  rowsFromTable,
  type ImportRow,
  type LibraryKind,
} from "@/lib/library-import";

type Embedded = { line: number; col: number; data: Buffer; ext: string };

/** Reads the first sheet of an .xlsx, including pictures pasted into cells (matched to their row). */
export async function parseXlsx(kind: LibraryKind, buf: ArrayBuffer, fileName: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  // The template has an instructions sheet; use the first sheet whose columns map.
  const candidates = wb.worksheets.filter((w) => !/instruction|read ?me|^lists$/i.test(w.name));
  let lastErrors: string[] = [`${fileName}: the workbook is empty.`];
  for (const ws of candidates) {
    const table: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      table[row.number - 1] = (row.values as unknown[]).slice(1).map(cellText);
    });
    for (let i = 0; i < table.length; i++) table[i] = table[i] ?? [];
    const parsed = rowsFromTable(kind, table, fileName);
    if (!parsed.rows.length) {
      lastErrors = parsed.errors;
      continue;
    }
    const embedded: Embedded[] = [];
    for (const img of ws.getImages()) {
      const media = wb.getImage(Number(img.imageId));
      if (!media?.buffer) continue;
      embedded.push({
        line: Math.floor(img.range.tl.nativeRow) + 1,
        col: Math.floor(img.range.tl.nativeCol),
        data: Buffer.from(media.buffer as ArrayBuffer),
        ext: media.extension ?? "png",
      });
    }
    return { ...parsed, embedded };
  }
  return { rows: [], errors: lastErrors, embedded: [] as Embedded[] };
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in o) return String(o.text);
    if ("result" in o) return String(o.result ?? "");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

/* ------------------------------------------------------------------ */
/* PDFs — spec sheets, catalogues, scanned swatch cards — read by the AI */
/* ------------------------------------------------------------------ */

function pdfSchema(kind: LibraryKind) {
  const fields = fieldsFor(kind);
  return {
    type: "object",
    additionalProperties: false,
    required: ["rows", "agent_notes"],
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [...fields, "page"],
          properties: { ...Object.fromEntries(fields.map((f) => [f, { type: "string" }])), page: { type: "integer" } },
        },
      },
      agent_notes: { type: "string" },
    },
  };
}

export async function extractFromPdf(kind: LibraryKind, pdf: Buffer, fileName: string, brandNames: string[]) {
  const fields = fieldsFor(kind);
  const instructions =
    kind === "hardware"
      ? [
          `Read this hardware / trims document (${fileName}) and list every component it specifies, one row each.`,
          `Fields: ${fields.map((f) => `${f} (${FIELD_LABELS[f]})`).join(", ")}.`,
          `type must be one of: ${HARDWARE_TYPES.join(", ")} — or the closest wording from the document.`,
          `finish: prefer one of ${HARDWARE_FINISHES.join(", ")}. material: prefer one of ${HARDWARE_MATERIALS.join(", ")}.`,
          `brand: one of ${brandNames.join(", ")} if the document says; else "".`,
          "dimsMm: all dimensions in mm, e.g. \"16 X 42 X 5.5\". construction: HOLLOW or SOLID if stated.",
          "Copy codes exactly as printed. Leave a field \"\" when the document doesn't state it — never guess. CAPITALS. page = PDF page number.",
        ].join("\n")
      : [
          `Read this materials document (${fileName}) — swatch cards, mill spec sheets or colour cards — and list every material colour it specifies, one row each.`,
          `Fields: ${fields.map((f) => `${f} (${FIELD_LABELS[f]})`).join(", ")}.`,
          "Read Chinese too (品名 article name, 成分 composition, 厚度 thickness, 幅宽 width, 属性 finish) and give the values in trade English CAPITALS; keep numbers and tolerances exactly as printed.",
          "One row per colour chip / colour number. Leave a field \"\" when not printed — never guess. page = PDF page number.",
        ].join("\n");
  const res = await callTechnicalDesigner<{ rows: Record<string, string | number>[]; agent_notes: string }>({
    task: kind === "material" ? "read_swatch_card" : "read_library_sheet",
    instructions,
    images: [],
    pdfs: [pdf],
    schema: pdfSchema(kind),
    fixtureName: `import_pdf.${kind}`,
  });
  const rows: ImportRow[] = (res.output.rows ?? []).map((r) => {
    const row = emptyRow(kind, `${fileName} p.${r.page ?? "?"}`);
    for (const f of fields) {
      row.fields[f] = normaliseField(kind, f, r[f]);
      if (row.fields[f]) row.aiFields.push(f);
    }
    return row;
  });
  return { rows, notes: res.output.agent_notes ?? "" };
}

/* ------------------------------------------------------------------ */
/* Excel templates                                                     */
/* ------------------------------------------------------------------ */

const INK = "FF15130F";
const IVORY = "FFF7F4EE";

export async function buildTemplate(kind: LibraryKind, brandNames: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Icon Tech Pack Studio";
  const title = kind === "hardware" ? "Hardware" : "Materials";
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });

  const cols =
    kind === "hardware"
      ? [
          { key: "code", header: "Code", width: 14, example: "EXAMPLE" },
          { key: "brand", header: "Brand", width: 18, example: "Pink London" },
          { key: "type", header: "Type", width: 20, example: "LOGO PLATE" },
          { key: "name", header: "Name", width: 30, example: "PINK LONDON LOGO PLATE" },
          { key: "dimsMm", header: "Dims (mm)", width: 16, example: "40 X 12 X 2" },
          { key: "material", header: "Material", width: 20, example: "ZINC ALLOY" },
          { key: "finish", header: "Finish", width: 24, example: "SHINY CHAMPAGNE GOLD" },
          { key: "logoTreatment", header: "Logo treatment", width: 20, example: "ENGRAVED" },
          { key: "enamelPantone", header: "Enamel (Pantone)", width: 18, example: "" },
          { key: "construction", header: "Hollow/solid", width: 13, example: "SOLID" },
          { key: "photo", header: "Photo", width: 22, example: "paste a picture here, or a file name" },
          { key: "front", header: "Front view", width: 16, example: "" },
          { key: "side", header: "Side view", width: 16, example: "" },
          { key: "rear", header: "Rear view", width: 16, example: "" },
          { key: "notes", header: "Notes", width: 30, example: "" },
        ]
      : [
          { key: "supplier", header: "Supplier", width: 20, example: "EXAMPLE" },
          { key: "articleName", header: "Article name", width: 20, example: "SMOOTH PU" },
          { key: "articleNo", header: "Article no.", width: 14, example: "AH316HB-P" },
          { key: "colourNo", header: "Colour no.", width: 12, example: "#24" },
          { key: "colourName", header: "Colour name", width: 22, example: "IRIDESCENT PINK" },
          { key: "composition", header: "Composition", width: 24, example: "50% TPU 50% COTTON" },
          { key: "thickness", header: "Thickness", width: 14, example: "0.85MM ±0.05" },
          { key: "width", header: "Width", width: 14, example: "138-140CM" },
          { key: "finish", header: "Finish / texture", width: 20, example: "MIRROR" },
          { key: "photo", header: "Card photo", width: 22, example: "paste a picture here, or a file name" },
        ];
  ws.columns = cols.map((c) => ({ key: c.key, header: c.header, width: c.width }));
  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((c) => {
    c.font = { name: "Arial", bold: true, color: { argb: IVORY }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    c.alignment = { vertical: "middle" };
  });
  const ex = ws.addRow(Object.fromEntries(cols.map((c) => [c.key, c.example])));
  ex.eachCell((c) => (c.font = { name: "Arial", italic: true, color: { argb: "FF8A8175" }, size: 10 }));

  const addList = (colLetter: string, values: string[]) => {
    values.forEach((v, i) => (lists.getCell(`${colLetter}${i + 1}`).value = v));
    return `Lists!$${colLetter}$1:$${colLetter}$${Math.max(1, values.length)}`;
  };
  const validations: Record<string, string> = {};
  if (kind === "hardware") {
    validations.brand = addList("A", brandNames);
    validations.type = addList("B", HARDWARE_TYPES);
    validations.finish = addList("C", HARDWARE_FINISHES);
    validations.material = addList("D", HARDWARE_MATERIALS);
    validations.construction = addList("E", ["HOLLOW", "SOLID"]);
  }
  cols.forEach((c, i) => {
    const list = validations[c.key];
    if (!list) return;
    const letter = ws.getColumn(i + 1).letter;
    for (let r = 3; r <= 500; r++) {
      ws.getCell(`${letter}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [list],
        showErrorMessage: false, // "Other" values are allowed; the studio calls them out on review
      };
    }
  });

  const help = wb.addWorksheet("Instructions");
  help.getColumn(1).width = 110;
  const lines =
    kind === "hardware"
      ? [
          "ICON TECH PACK STUDIO — HARDWARE IMPORT",
          "",
          "One row per component. Row 2 is an example and is ignored.",
          "Code: enter the code (e.g. PINK006). The studio calls out duplicates, clashes with style numbers and codes outside the brand's format before anything is saved.",
          "Type, finish, material and hollow/solid have drop-down lists; you can type something else and it will be flagged for a check.",
          "Dimensions are always in millimetres, e.g. 16 X 42 X 5.5.",
          "Photo: paste a picture into the Photo cell of the row, OR type a file name and upload that photo with the sheet.",
          "Front / side / rear views: file names of 100%-scale view images uploaded with the sheet.",
          "No prices, MOQ or lead times — the factory fills those.",
        ]
      : [
          "ICON TECH PACK STUDIO — MATERIALS / SWATCH CARD IMPORT",
          "",
          "One row per colour. Row 2 is an example and is ignored.",
          "Card photo: paste a picture of the swatch card into the Card photo cell, OR type a file name and upload that photo with the sheet.",
          "You can also skip the sheet entirely and upload card photos or PDFs — the studio reads them, including Chinese.",
          "No prices — costing is left to the factory.",
        ];
  lines.forEach((l, i) => {
    const c = help.getCell(`A${i + 1}`);
    c.value = l;
    c.font = { name: "Arial", size: i === 0 ? 13 : 10, bold: i === 0 };
    c.alignment = { wrapText: true };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
