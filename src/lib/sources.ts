import "server-only";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hardware, materials, packAnswers, packFiles, type AnswerStatus, type PackFile } from "@/db/schema";
import { audit } from "@/lib/audit";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { buildSourceInstructions, normaliseSource, READ_SOURCE_SCHEMA, sourceLabel, type ReadSourceOutput, type SourceKind } from "@/lib/ai/read-source";
import { buildSwatchInstructions, normaliseChipBox, READ_SWATCH_SCHEMA, SWATCH_FIELDS, type ReadSwatchOutput } from "@/lib/ai/read-swatch";
import { checkComponentCode, hardwareByCode, loadPack, materialLabel, rebuildLibraryUsage, type LoadedPack } from "@/lib/data";
import { normaliseField } from "@/lib/library-import";
import { assignRows, realCode, resolveParts } from "@/lib/hardware-match";
import type { LibValue, MatrixValue } from "@/lib/questions";
import { readStoredFile } from "@/lib/storage";

export type SourceResult = { answered: number; skippedConfirmed: number; created: string[]; linked: string[]; boardNotes: string[]; dropped: string[] };

/** Everything the AI reads for a pack besides the render. */
export const SOURCE_KINDS = ["spec_sheet", "view_photo", "scale_photo", "swatch_photo", "hardware_sheet"] as const;

/** A spreadsheet as tab-separated text (every sheet), for the model to read. */
async function sheetText(data: Buffer, name: string): Promise<string> {
  if (/\.csv$/i.test(name)) return data.toString("utf8");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const out: string[] = [];
  for (const ws of wb.worksheets) {
    out.push(`# SHEET ${ws.name}`);
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object") {
          const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
          return o.richText ? o.richText.map((t) => t.text).join("") : String(o.text ?? o.result ?? "");
        }
        return String(v);
      });
      out.push(cells.join("\t"));
    });
  }
  return out.join("\n");
}

/**
 * Reads one uploaded source with the AI and writes what it finds into the pack. Answers a designer
 * already confirmed are never touched. Every answer is marked "From <source> — confirm" (EST for
 * measurements read off a ruler).
 */
export async function readSource(packId: string, fileId: string, user: { id: string }, progress: (s: string) => Promise<void>): Promise<SourceResult> {
  const p = await loadPack(packId);
  if (!p) throw new Error("Pack not found.");
  const [file] = await db.select().from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  if (!file) throw new Error("That upload was removed.");
  const result: SourceResult = { answered: 0, skippedConfirmed: 0, created: [], linked: [], boardNotes: [], dropped: [] };
  await progress("Reading the upload");
  const f = await readStoredFile(file.url);

  if (file.kind === "swatch_photo") await readSwatch(p, file, f, user, result);
  else await readGeneric(p, file, f, user, result, progress);

  const summary = [
    result.answered && `${result.answered} ANSWER(S)`,
    result.created.length && `NEW IN LIBRARY: ${result.created.join(", ")}`,
    result.linked.length && `LINKED: ${result.linked.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");
  await db.update(packFiles).set({ note: (summary || "NOTHING NEW FOUND").slice(0, 300) }).where(eq(packFiles.id, file.id));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "ai", field: `source:${file.kind}`, after: { file: file.name, ...result } });
  const after = await loadPack(packId);
  if (after) await rebuildLibraryUsage(packId, after.answers);
  return result;
}

/**
 * Writes one answer with where it came from. A spec sheet is a trusted source (V2 brief §2): its
 * values are settled ("confirmed", tagged SPEC SHEET); photos and rulers still need confirming. Never
 * replaces an answer a designer set or confirmed — only unconfirmed answers, or this source's own.
 */
function writer(p: LoadedPack, user: { id: string }, result: SourceResult) {
  return async (questionId: string, value: unknown, status: AnswerStatus, source: string, note: string) => {
    // Confirmed values belong to the designer, unless they came from this same source (a re-read).
    // Hardware rows and breakdown cells from another upload may still be merged into (parts linked,
    // sizes added, a spec's material text replaced by the swatch card itself).
    const from = p.meta[questionId]?.source;
    const mergeable = (questionId === "hardware.items" || questionId === "materials.matrix") && !!from;
    if (p.statuses[questionId] === "confirmed" && from !== source && !mergeable) {
      result.skippedConfirmed++;
      return;
    }
    const now = new Date();
    await db
      .insert(packAnswers)
      .values({ packId: p.pack.id, questionId, value, status, source, aiNote: note, aiValue: value, updatedBy: user.id, updatedAt: now })
      .onConflictDoUpdate({ target: [packAnswers.packId, packAnswers.questionId], set: { value, status, source, aiNote: note, aiValue: value, updatedBy: user.id, updatedAt: now } });
    p.answers[questionId] = value;
    result.answered++;
  };
}

async function readGeneric(p: LoadedPack, file: PackFile, f: { data: Buffer; contentType: string }, user: { id: string }, result: SourceResult, progress: (s: string) => Promise<void>) {
  const kind = file.kind as SourceKind;
  const unit = p.answers["dims.unit"] === "INCHES" ? "in" : "cm";
  const isPdf = f.contentType.includes("pdf") || /\.pdf$/i.test(file.name);
  const isSheet = /\.(xlsx|csv)$/i.test(file.name) || /spreadsheet|csv/.test(f.contentType);
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files can't be read — save it as .xlsx or export CSV, then upload again.");
  const res = await callTechnicalDesigner<ReadSourceOutput>({
    task: "read_source",
    instructions: buildSourceInstructions({ kind, view: file.tag, category: p.pack.category, styleNo: p.pack.styleNo, unit, answers: p.answers, colorways: p.pack.colorways, sheetText: isSheet ? await sheetText(f.data, file.name) : undefined }),
    images: isPdf || isSheet ? [] : [f],
    pdfs: isPdf ? [f.data] : [],
    schema: READ_SOURCE_SCHEMA,
    fixtureName: [`read_source.${kind}.${p.pack.styleNo}`, `read_source.${kind}`],
  });
  await progress("Filling in the answers");
  const out = res.output;
  result.boardNotes = (out.board_notes ?? []).map((n) => n.toUpperCase());
  const hw = await hardwareByCode();
  const { values, notes, dropped } = normaliseSource(p.pack.category, out, p.answers, unit, hw, p.pack.colorways);
  if (values["materials.matrix"]) values["materials.matrix"] = await libraryMaterials(values["materials.matrix"] as MatrixValue);
  result.dropped = dropped;
  const source = sourceLabel(kind, file.tag);
  const write = writer(p, user, result);
  for (const [qid, v] of Object.entries(values)) {
    // A ruler gives estimates; everything read off a sheet or seen on a photo is "from <source>".
    const status = kind === "spec_sheet" ? "confirmed" : kind === "scale_photo" && isMeasure(qid) ? "est" : "sourced";
    await write(qid, v, status, source, (notes[qid] ?? []).join("; ").slice(0, 400) || `FROM ${source}`);
  }
  if (out.hardware?.length) await linkHardware(p, out.hardware, source, kind === "spec_sheet" ? "confirmed" : "sourced", write, result);
}

/**
 * Spec-sheet materials arrive as text ("BLACK SMOOTH LEATHER 1.2MM"); a library material that clearly
 * is that one (its article and colour name both appear in the text) is linked instead.
 */
async function libraryMaterials(matrix: MatrixValue): Promise<MatrixValue> {
  const all = await db.select().from(materials);
  const words = (s: string) => s.toUpperCase().replace(/[^0-9A-Z.]+/g, " ").trim();
  for (const cw of Object.keys(matrix))
    for (const [k, cell] of Object.entries(matrix[cw])) {
      if (!cell.text || cell.lib) continue;
      const t = ` ${words(cell.text)} `;
      const m = all.find((x) => x.articleName && x.colourName && t.includes(` ${words(x.articleName)} `) && t.includes(` ${words(x.colourName)} `));
      if (m) matrix[cw][k] = { lib: { id: m.id, label: materialLabel(m) } };
    }
  return matrix;
}

const isMeasure = (qid: string) => /^dims\.|\.width$|\.length$|\.drop$|\.height$|_height$|pom\.list|adjust_m(in|ax)/.test(qid);

/**
 * Hardware from a spec sheet / supplier sheet / photo: each part keeps its own type and gets its own
 * library item (matched on a real supplier code or the same size, else added with the next free
 * code), then fills the pack row of its own type with the sheet's size. See lib/hardware-match.
 */
async function linkHardware(p: LoadedPack, parts: NonNullable<ReadSourceOutput["hardware"]>, source: string, status: "sourced" | "confirmed", write: ReturnType<typeof writer>, result: SourceResult) {
  const lib = await db.select().from(hardware).where(eq(hardware.brandId, p.brand.id));
  const resolved = resolveParts(parts, lib);
  const created = new Map<string, (typeof lib)[number]>();
  const linked: { type: string; size: string; item: LibValue; description: string }[] = [];
  for (const r of resolved) {
    let item = r.match ?? created.get(r.key) ?? null;
    if (!item) {
      const code = (await checkComponentCode(p.brand.id, "")).suggestion;
      if (!code) continue;
      const supplierCode = realCode(r.part.supplier_code);
      [item] = await db
        .insert(hardware)
        .values({
          brandId: p.brand.id,
          code,
          type: r.type,
          name: (r.part.description || r.type).toUpperCase(),
          dimsMm: r.size.replace(/ MM$/, ""),
          material: normaliseField("hardware", "material", r.part.material),
          finish: normaliseField("hardware", "finish", r.part.finish),
          notes: [`FROM ${source}`, supplierCode && `SUPPLIER CODE ${supplierCode}`].filter(Boolean).join(" · "),
        })
        .returning();
      created.set(r.key, item);
      lib.push(item);
      result.created.push(`${code} ${r.type}`);
    } else if (!result.linked.includes(item.code)) result.linked.push(item.code);
    linked.push({ type: r.type, size: r.size, item: { id: item.id, label: item.code }, description: r.part.description || r.type });
  }
  const typeOf = new Map(lib.map((h) => [h.id, h.type]));
  const rows = assignRows((p.answers["hardware.items"] as Record<string, unknown>[] | undefined) ?? [], linked, (id) => typeOf.get(id));
  await write("hardware.items", rows, status, source, `PARTS FROM ${source}: ${linked.map((l) => `${l.item.label} ${l.type}${l.size ? ` ${l.size}` : ""}`).join(", ")}`);
}

/** Swatch card: read it, match a library material (supplier + colour no. + article) or add one, and put it in the breakdown cell. */
async function readSwatch(p: LoadedPack, file: PackFile, f: { data: Buffer; contentType: string }, user: { id: string }, result: SourceResult) {
  const [callout, colorway] = file.tag.split("|");
  const res = await callTechnicalDesigner<ReadSwatchOutput>({
    task: "read_swatch_card",
    instructions: buildSwatchInstructions({}),
    images: [f],
    schema: READ_SWATCH_SCHEMA,
    fixtureName: [`read_swatch_card.${p.pack.styleNo}${colorway ?? ""}`, "read_swatch_card"],
  });
  const fields: Record<string, string> = {};
  for (const k of SWATCH_FIELDS) fields[k] = normaliseField("material", k, res.output[k]);
  const all = await db.select().from(materials);
  const key = (m: { supplier: string; colourNo: string; articleName: string }) => [m.supplier, m.colourNo.replace(/^#/, ""), m.articleName].map((x) => x.trim().toUpperCase()).join("|");
  const wanted = key({ supplier: fields.supplier, colourNo: fields.colourNo, articleName: fields.articleName });
  let mat = all.find((m) => key(m) === wanted);
  if (!mat) {
    [mat] = await db
      .insert(materials)
      .values({
        ...(fields as Record<(typeof SWATCH_FIELDS)[number], string>),
        cardPhotoUrl: file.url,
        chipBox: normaliseChipBox(res.output.chip_box),
        fieldStatus: Object.fromEntries(SWATCH_FIELDS.filter((k) => fields[k]).map((k) => [k, "ai" as const])),
        aiNotes: res.output.agent_notes ?? "",
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();
    result.created.push(materialLabel(mat));
  } else result.linked.push(materialLabel(mat));
  if (!callout || !colorway) return;
  const matrix = structuredClone((p.answers["materials.matrix"] as MatrixValue | undefined) ?? {});
  matrix[colorway] = { ...(matrix[colorway] ?? {}), [`mat_${callout}`]: { lib: { id: mat.id, label: materialLabel(mat) } } };
  await writer(p, user, result)("materials.matrix", matrix, "sourced", "SWATCH CARD", `SWATCH CARD FOR MATERIAL ${callout} ${colorway}: ${materialLabel(mat)}`);
}
