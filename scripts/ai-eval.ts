/**
 * Golden AI eval (V2.1 §11–12): the AI read (analyse_render) on every golden pack's render, scored
 * against the pack's expected answers. Reports the scores; never gates CI.
 *  - PINK013 / TB25_ACC0023: their renders from the e2e database.
 *  - The study packs: a render saved as reference/real-packs/<pack>/render.(png|jpg) — from the
 *    original pack files (gitignored). Packs without one are listed as skipped.
 * Prints counts and question ids only. Needs ANTHROPIC_API_KEY (or AI_FIXTURE_DIR for a dry run).
 *
 *   npm run ai:eval
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { packs } from "../src/db/schema";
import { hardwareByCode, loadPack } from "../src/lib/data";
import { callTechnicalDesigner } from "../src/lib/ai/client";
import { ANALYSE_RENDER_SCHEMA, buildAnalyseInstructions, normaliseAiAnswers, type AnalyseRenderOutput } from "../src/lib/ai/analyse-render";
import { scoreRead, type EvalScore } from "../src/lib/ai/eval";
import { readCroppedFile } from "../src/lib/crop";
import { entered, loadGolden, OUT, REAL, ROOT } from "./golden-lib";

async function renderOf(label: string): Promise<{ data: Buffer; contentType: string } | null> {
  const [row] = await db.select({ id: packs.id }).from(packs).where(eq(packs.styleNo, label));
  if (row && (label === "PINK013" || label === "TB25_ACC0023")) {
    const p = await loadPack(row.id);
    const r = p?.files.find((f) => f.kind === "render");
    return r ? readCroppedFile(r) : null;
  }
  for (const ext of ["png", "jpg", "jpeg"]) {
    const f = path.join(REAL, label, `render.${ext}`);
    if (existsSync(f)) return { data: readFileSync(f), contentType: ext === "png" ? "image/png" : "image/jpeg" };
  }
  return null;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.AI_FIXTURE_DIR) {
    console.log("ANTHROPIC_API_KEY is not set (or AI_FIXTURE_DIR for a dry run) — nothing to evaluate.");
    process.exit(0);
  }
  const hw = await hardwareByCode();
  const results: ({ pack: string } & EvalScore)[] = [];
  const skipped: string[] = [];
  for (const g of await loadGolden()) {
    if (g.category === "Hardware") continue;
    const img = await renderOf(g.label);
    if (!img) {
      skipped.push(g.label);
      continue;
    }
    let res: { output: AnalyseRenderOutput };
    try {
      res = await callTechnicalDesigner<AnalyseRenderOutput>({
      task: "analyse_render",
      instructions: buildAnalyseInstructions({ category: g.category, brand: g.brand, styleNo: g.label, styleName: g.label, colorways: g.colorways, hardwareLibrary: [] }),
      images: [img],
      schema: ANALYSE_RENDER_SCHEMA,
      fixtureName: `analyse_render.${g.label}`,
      });
    } catch (e) {
      skipped.push(`${g.label} (read failed: ${(e as Error).message.slice(0, 60)})`);
      continue;
    }
    const { answers } = normaliseAiAnswers(g.category, res.output, hw);
    results.push({ pack: g.label, ...scoreRead(answers, entered(g).answers) });
  }
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`\n${pad("PACK", 30)}${pad("READ", 6)}${pad("CORRECT", 9)}${pad("WRONG", 7)}${pad("CONFIDENT-WRONG", 17)}INVENTED`);
  for (const r of results) console.log(`${pad(r.pack, 30)}${pad(r.read, 6)}${pad(r.correct, 9)}${pad(r.wrong.length, 7)}${pad(r.confidentWrong.length, 17)}${r.invented.length}`);
  for (const r of results.filter((x) => x.confidentWrong.length || x.invented.length)) {
    console.log(`\n${r.pack}`);
    if (r.confidentWrong.length) console.log(`  confident-wrong: ${r.confidentWrong.join(", ")}`);
    if (r.invented.length) console.log(`  invented: ${r.invented.join(", ")}`);
  }
  if (skipped.length) console.log(`\nNot evaluated: ${skipped.join(", ")} — a study pack needs reference/real-packs/<pack>/render.png.`);
  const total = results.reduce((t, r) => t + r.confidentWrong.length, 0);
  console.log(`\nConfident-wrong on render-unsettled fields: ${total} (target 0).`);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `ai-eval-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(results, null, 1));
  console.log(`Full report: ${path.relative(ROOT, file)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
