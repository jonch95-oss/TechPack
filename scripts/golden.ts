/**
 * Golden-set check (docs/V2.1-REAL-PACKS.md §12) over the nine golden packs:
 *  - the seven real packs, from the study files in reference/real-packs/ (gitignored) — their
 *    "expected" JSON, keyed to question ids;
 *  - PINK013 and TB25_ACC0023, from the e2e database after a full run (snapshotted to .data/golden/).
 *
 * For each pack it reports:
 *  1. ENTRY — how many of the original's facts the studio can take as they are stated: answers whose
 *     question exists in the category and whose value fits the question, vs facts that need a new
 *     question / reference answer / text in a library field (listed by id, never by value);
 *  2. PROTO GATE — blockers when the pack is entered exactly as the original states it.
 * Nothing confidential is printed or committed: only counts and question ids. The full report goes to
 * .data/golden/<date>.json (gitignored).
 *
 *   npm run golden            (GOLDEN_DB defaults to the e2e database)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validatePack, type RuleResult } from "../src/lib/validation";
import { entered as enteredAnswers, loadGolden, OUT, ROOT, type GoldenPack } from "./golden-lib";

type Report = {
  pack: string;
  category: string;
  facts: number;
  enterable: number;
  notFitting: string[];
  notInBank: string[];
  proposedNew: number;
  blockers: number;
  blockerIds: string[];
  warnings: number;
};

function check(p: GoldenPack): Report {
  const { answers: entered, notFitting, notInBank } = enteredAnswers(p);
  const statuses = Object.fromEntries(Object.keys(entered).map((k) => [k, "confirmed"]));
  const brand = { name: p.brand, licensorRequired: /CHAMPION|TED BAKER/i.test(p.brand) };
  const rules: RuleResult[] = validatePack({ category: p.category, brand, answers: entered, statuses, colorways: p.colorways, chineseOn: false, stage: "PROTO", hardware: p.hardware ?? [], spelling: [] });
  const fails = rules.filter((r) => r.status === "fail");
  // validatePack already includes the stage's completeness (★ / Cell rules).
  const blockerIds = [...new Set(fails.map((r) => r.questionId ?? r.rule))];
  return {
    pack: p.label,
    category: p.category,
    facts: Object.keys(p.answers).length + p.extra.length,
    enterable: Object.keys(entered).length,
    notFitting,
    notInBank,
    proposedNew: p.extra.length,
    blockers: fails.length,
    blockerIds,
    warnings: rules.filter((r) => r.status === "warn").length,
  };
}

/* ------------------------------ run ------------------------------ */

async function main() {
  const packs = await loadGolden();
  const reports = packs.map(check);
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`\n${pad("PACK", 34)}${pad("CATEGORY", 20)}${pad("ENTERABLE", 12)}${pad("DOESN'T FIT", 13)}${pad("NO QUESTION", 13)}${pad("PROPOSED", 10)}${pad("PROTO BLOCKERS", 16)}WARN`);
  for (const r of reports)
    console.log(`${pad(r.pack, 34)}${pad(r.category, 20)}${pad(`${r.enterable}/${r.facts}`, 12)}${pad(r.notFitting.length, 13)}${pad(r.notInBank.length, 13)}${pad(r.proposedNew, 10)}${pad(r.blockerIds.length, 16)}${r.warnings}`);
  const clean = reports.filter((r) => r.blockerIds.length === 0).length;
  console.log(`\nPROTO gate: ${clean}/${reports.length} packs pass with zero blockers.`);
  for (const r of reports.filter((x) => x.blockerIds.length)) console.log(`  ${r.pack}: ${r.blockerIds.slice(0, 12).join(", ")}${r.blockerIds.length > 12 ? ` … +${r.blockerIds.length - 12}` : ""}`);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(reports, null, 1));
  console.log(`\nFull report (ids only): ${path.relative(ROOT, file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
