/**
 * Golden PDF run (golden run 1): every golden pack printed through the real PDF builder, then three
 * checks on what printed.
 *  1. ANSWERED → PRINTED: every answered question's value text appears in the PDF text (pdftotext).
 *     Page switches (pages.*) and optional sections that are switched off are exempt.
 *  2. COMMENTS / PHOTOS: every comment's text and every photo's caption appears in the PDF.
 *  3. OVERFLOW: in the print HTML no element's box extends outside its page or its clipping box.
 *
 * The seven study packs are seeded into the e2e database first (their expected answers, with reference
 * answers where the originals answer by reference; no photos). PINK013 / TB25_ACC0023 are read as the
 * e2e run left them. Prints counts, question ids and page lists only; PDFs and the full report go to
 * .data/golden/ (gitignored).
 *
 *   npm run golden:pdf          (GOLDEN_DB defaults to the e2e database)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import sharp from "sharp";
import { brands, hardware, packAnswers, packFiles, packs, prints } from "../src/db/schema";
import { storeFile } from "../src/lib/storage";
import { loadPack } from "../src/lib/data";
import { buildPackDoc } from "../src/lib/pdf/doc";
import { renderPackHtml } from "../src/lib/pdf/html";
import { htmlToPdf } from "../src/lib/pdf/render";
import { OVERFLOW_JS, type OverflowHit } from "../src/lib/pdf/overflow";
import { missingFrom, tight } from "../src/lib/pdf/specs";
import type { AnswerMap } from "../src/lib/questions";
import { entered, loadGolden, OUT, ROOT, type GoldenPack } from "./golden-lib";

const PDF_DIR = path.join(OUT, "pdf");

/** Library values named by a part code ("XX_001", "XX_001 WHEEL") → the seeded part. */
function linkParts(v: unknown, byCode: Map<string, { id: string; code: string }>, byName = new Map<string, { id: string; code: string }>()): unknown {
  if (Array.isArray(v)) return v.map((x) => linkParts(x, byCode, byName));
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("label" in o && "id" in o && !o.id) {
      const hit = byName.get(String(o.label).toUpperCase()) ?? byCode.get(String(o.label).split(/\s+/)[0].toUpperCase());
      if (hit) return { id: hit.id, label: hit.code };
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, linkParts(x, byCode, byName)]));
  }
  return v;
}

async function seed(g: GoldenPack): Promise<string> {
  const { answers } = entered(g);
  let [brand] = await db.select().from(brands).where(eq(brands.name, g.brand));
  if (!brand) {
    const prefix = g.brand.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase() || "GLD";
    [brand] = await db.insert(brands).values({ name: g.brand, codePrefix: prefix, codeFormat: `${prefix}###`, licensorRequired: /CHAMPION|TED BAKER/i.test(g.brand) }).returning();
  }
  // Library parts the study describes (the component sheets' parts), linked by code.
  const byCode = new Map<string, { id: string; code: string }>();
  for (const part of g.library ?? []) {
    if (!part.code) continue;
    const [row] = await db.select().from(hardware).where(eq(hardware.code, part.code));
    const values = { code: part.code, brandId: brand.id, name: part.name, type: part.type || "COMPONENT", dimsMm: part.dimsMm, detailDims: part.detailDims, material: part.material, finish: part.finish, logoTreatment: part.logoTreatment };
    const [h] = row ? await db.update(hardware).set(values).where(eq(hardware.id, row.id)).returning() : await db.insert(hardware).values(values).returning();
    byCode.set(part.code.toUpperCase(), { id: h.id, code: h.code });
  }
  // Prints the study records (a lining sheet's print record), linked by name.
  const byName = new Map<string, { id: string; code: string }>();
  for (const pr of g.prints ?? []) {
    const values = { ...pr, brandId: brand.id };
    const [row] = await db.select().from(prints).where(and(eq(prints.name, pr.name), eq(prints.brandId, brand.id)));
    const [x] = row ? await db.update(prints).set(values).where(eq(prints.id, row.id)).returning() : await db.insert(prints).values(values).returning();
    byName.set(pr.name.toUpperCase(), { id: x.id, code: x.name });
  }
  const linked = linkParts(answers, byCode, byName) as AnswerMap;
  const styleNo = g.label;
  await db.delete(packs).where(eq(packs.styleNo, styleNo));
  // A multi-style pack's colourway style numbers must be free (an earlier run's copy is replaced).
  const styles = g.colorwayStyles ?? {};
  for (const v of Object.values(styles)) await db.delete(packs).where(eq(packs.styleNo, v));
  const [pack] = await db.insert(packs).values({ brandId: brand.id, category: g.category, styleNo, styleName: g.label, colorways: g.colorways, colorwayStyles: styles }).returning();
  const rows = Object.entries(linked).map(([questionId, value]) => ({ packId: pack.id, questionId, value, status: "confirmed" as const, origin: "DESIGNER" as const }));
  if (rows.length) await db.insert(packAnswers).values(rows);
  if (g.category !== "Hardware") await placeholders(pack.id, linked);
  return pack.id;
}

/**
 * Neutral stand-ins for the originals' images (none are in the repo): a grey product shape as the
 * render, and one photo for each comment that points at images, placed by that comment's pages — so
 * callouts, photo pages and comment strips are laid out as they would be with the real files.
 */
async function placeholders(packId: string, a: AnswerMap) {
  const shape = async (w: number, h: number, label: string) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${w * 0.1}" y="${h * 0.12}" width="${w * 0.8}" height="${h * 0.76}" rx="${w * 0.06}" fill="#9a9a9a" stroke="#333" stroke-width="6"/><text x="50%" y="52%" font-size="${h * 0.08}" text-anchor="middle" fill="#fff" font-family="Arial">${label}</text></svg>`) }])
      .png()
      .toBuffer();
  const url = await storeFile(`golden/${packId}`, "render.png", await shape(1600, 1100, "RENDER"), "image/png");
  await db.insert(packFiles).values({ packId, kind: "render", url, name: "render.png" });
  const comments = (a["comments.list"] as { text?: string }[] | undefined) ?? [];
  for (const [i, c] of comments.entries()) {
    if (!/IMAGE|PHOTO|REFERENCE|BELOW|SAMPLE|SHOWN|THIS BAG|LIKE/i.test(c.text ?? "")) continue;
    const letter = String.fromCharCode(65 + i);
    const photo = await storeFile(`golden/${packId}`, `photo-${letter}.png`, await shape(1200, 900, `PHOTO ${letter}`), "image/png");
    await db.insert(packFiles).values({ packId, kind: "reference", url: photo, name: `photo-${letter}.png`, tag: letter, note: String(c.text).toUpperCase() });
  }
}

type Result = {
  pack: string;
  pages: string[];
  answered: number;
  notPrinted: string[];
  comments: number;
  commentsMissing: string[];
  photos: number;
  photosMissing: string[];
  overflow: OverflowHit[];
};

async function printAndCheck(label: string, packId: string): Promise<Result> {
  const p = (await loadPack(packId))!;
  p.pack.chineseOn = false;
  const doc = await buildPackDoc(p);
  let overflow: OverflowHit[] = [];
  const pdf = await htmlToPdf(renderPackHtml(doc, { draft: true }), {
    inspect: async (page) => {
      overflow = (await page.evaluate(OVERFLOW_JS)) as OverflowHit[];
    },
  });
  mkdirSync(PDF_DIR, { recursive: true });
  const file = path.join(PDF_DIR, `${label.replace(/[^\w-]+/g, "_")}.pdf`);
  writeFileSync(file, pdf);
  // "SEE REFERENCE PHOTOS" comments get their page numbers added on print: compare without them.
  const text = tight(execFileSync("pdftotext", ["-raw", file, "-"]).toString()).replace(/ONPAGES?\d+(,\d+)*/g, "");

  const answered = doc.specs;
  const notPrinted = missingFrom(answered, text).map((s) => s.qid);
  const comments = ((p.answers["comments.list"] as { text?: string }[] | undefined) ?? []).map((c, i) => ({ letter: String.fromCharCode(65 + i), text: c.text ?? "" })).filter((c) => c.text.trim());
  const commentsMissing = comments.filter((c) => !text.includes(tight(c.text))).map((c) => c.letter);
  const photos = p.files.filter((f) => (f.kind === "reference" || f.kind === "construction") && f.note.trim());
  const photosMissing = photos.filter((f) => !text.includes(tight(f.note))).map((f) => f.tag || f.id.slice(0, 8));
  return { pack: label, pages: doc.plan.pages.map((x) => `${x.n}:${x.section}${"part" in x && x.part.of > 1 ? ` (${x.part.i}/${x.part.of})` : ""}`), answered: answered.length, notPrinted, comments: comments.length, commentsMissing, photos: photos.length, photosMissing, overflow };
}

async function main() {
  const golden = await loadGolden();
  const results: Result[] = [];
  for (const g of golden) {
    let id: string | null = null;
    if (g.label === "PINK013" || g.label === "TB25_ACC0023") {
      const [row] = await db.select({ id: packs.id }).from(packs).where(eq(packs.styleNo, g.label));
      id = row?.id ?? null;
      if (!id) {
        console.log(`${g.label}: not in the e2e database — run the e2e suite once.`);
        continue;
      }
    } else id = await seed(g);
    results.push(await printAndCheck(g.label, id));
  }
  // Seeded study packs stay in the e2e database for inspection; the next e2e run resets it.

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`\n${pad("PACK", 30)}${pad("PAGES", 7)}${pad("ANSWERED→PRINTED", 18)}${pad("COMMENTS", 10)}${pad("PHOTOS", 8)}OVERFLOW`);
  for (const r of results)
    console.log(`${pad(r.pack, 30)}${pad(r.pages.length, 7)}${pad(`${r.answered - r.notPrinted.length}/${r.answered}`, 18)}${pad(`${r.comments - r.commentsMissing.length}/${r.comments}`, 10)}${pad(`${r.photos - r.photosMissing.length}/${r.photos}`, 8)}${r.overflow.length}`);
  const fails = results.filter((r) => r.notPrinted.length || r.commentsMissing.length || r.photosMissing.length || r.overflow.length);
  for (const r of fails) {
    console.log(`\n${r.pack}`);
    if (r.notPrinted.length) console.log(`  not printed: ${r.notPrinted.join(", ")}`);
    if (r.commentsMissing.length) console.log(`  comments missing: ${r.commentsMissing.join(", ")}`);
    if (r.photosMissing.length) console.log(`  photos missing: ${r.photosMissing.join(", ")}`);
    for (const o of r.overflow.slice(0, 12)) console.log(`  overflow p${o.page} ${o.kind} ${o.by}px ${o.selector}`);
    if (r.overflow.length > 12) console.log(`  … +${r.overflow.length - 12} overflow`);
  }
  console.log(`\nPage lists:`);
  for (const r of results) console.log(`  ${r.pack}: ${r.pages.join(" | ")}`);
  console.log(`\n${results.length - fails.length}/${results.length} packs pass all three checks.`);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `pdf-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(results, null, 1));
  console.log(`Full report: ${path.relative(ROOT, file)} · PDFs: ${path.relative(ROOT, PDF_DIR)}/`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
