# V2 build notes

Working notes for `docs/V2-SEAMLESS-BRIEF.md`, one section per §12 step: what was built, where it lives, and what is still open.

## Step 1 — Foundations for speed

### Answer sources and priority (§2)
- Every row in `pack_answers` has an **origin** (`DESIGNER`, `SPEC`, `BASE_STYLE`, `LIBRARY`, `HOUSE`, `TEMPLATE`, `AI`, `DERIVED`) and a **status**. The two are separate fields.
- `source` holds the detail: the upload ("SPEC SHEET", "BACK PHOTO") or the base style's number.
- **The rules** live in `src/lib/answer-source.ts` (pure, unit-tested in `tests/unit/answer-source.test.ts`):
  - A higher-priority origin replaces a lower one.
  - A value a person confirmed counts as theirs (DESIGNER).
  - A lower-priority **AI or SPEC** value that disagrees becomes a `conflict`: a red chip offering Keep or Switch. HOUSE, TEMPLATE and DERIVED defaults never raise one.
  - The same value from a better source upgrades it. For example, an AI estimate that the spec sheet proves becomes settled.
- **Every write** goes through `src/lib/answer-write.ts`: designer saves, AI pre-fill, uploads, duplicates (BASE STYLE), and derived fills (description, POM template, BOM). Each write is one SQL statement that also appends to `answer_history`: value, origin, status, source, action, who and when.
- **Migration 0013** backfills origins on existing answers:
  - spec-sheet answers become SPEC;
  - anything the AI read becomes AI;
  - the rest becomes DESIGNER.

### Saving
- **One save** is three parallel phases:
  1. the pack and the current answer are read together;
  2. the answer and its history line are written, while the pack's timestamp is touched;
  3. the audit line is written, and library usage is rebuilt only when a library link changed.
  - Before: about 13 sequential queries plus a full pack reload.
- **Stale writes.** The client sends the `updatedAt` it last saw.
  - If another person changed the answer since then, nothing is overwritten. The save indicator shows "<name> changed this — reload / keep mine".
  - This check is per answer, not a pack version number, so two designers editing different fields never collide.
- **Failed saves.** A failed save keeps the typed value on screen and offers Retry. Offline gets its own message.
- **Spell-check is incremental** (`spellcheckParts`). Each answer's text is checked once and cached, so re-validating after a save re-checks only the changed answer. The validation rules themselves are pure and take milliseconds.
- **Error boundaries.** `error.tsx` covers the studio, a pack, the library and admin; `global-error.tsx` covers the root. Both show a plain message, a Try again button and the error digest.

### Background jobs
- **Mechanism.** The `jobs` table holds kind, params, status, step, result and error.
  - `POST /api/packs/:id/jobs` inserts a row and runs the job after the response, via Next.js `after()` within that route's `maxDuration = 300`.
  - The client polls `GET /api/packs/:id/jobs/:jobId` through `useJob`. A reload resumes polling any job still running.
  - A job with no progress for 6 minutes is marked failed.
  - Starting the same kind again (same view, file or draft flag) while one is running returns the running job.
- **Kinds:** `PREFILL`, `FLAT` (line art), `SOURCE` (uploads the AI reads), `BOARD` (board notes) and **`PDF`**, new in this step. The PDF job:
  - builds through `src/lib/pdf/export.ts` (shared with the direct download route);
  - stores the file in private Blob;
  - hands back an authenticated URL that the export panel shows as a download link.
  - A final export still issues the revision (R1, R2 …) exactly as before.

### Studio
- **Chips.** Clicking the selected chip confirms it. A small ✕ clears it.
- **Steppers.** Blur commits only when the value changed. Enter always commits, which accepts an EST value.
- **Setup stays editable** (Edit setup):
  - style #, name, brand and category;
  - colourways: add, rename, or remove any one. Removing re-letters the ones after it, and their breakdown cells, names and colourway-tagged uploads follow (`src/lib/colorways.ts`).
- **Review** is a mode beside "All questions" and is remembered per browser:
  - a compact spec sheet grouped Body / Closure / Handles & straps / Pockets & zips / Branding / Hardware / Interior / Materials & colours;
  - conflicts and low-confidence rows come first;
  - bulk actions: "✓ Looks right" per group and "✓ All visible";
  - keys: J/K, Enter, 1–9, E/O, /, ?, Esc.
  - The rules are in `src/lib/review.ts`.

### Open after step 1
- **"All visible"** accepts render reads with high confidence. Until AI v2 (step 4) reports a confidence on every value, a render read with no confidence counts as visible. EST, INFERRED, upload reads, conflicts and low-confidence rows are never bulk-confirmed.
- **Review hotspots** on the render (numbered, bbox-linked) need the AI's bounding boxes, which come in step 4.
- **Default view.** All questions stays the default view until Jon has tried Review. Flipping the default is one line.
- **Client-side batching.** Rapid edits are not yet coalesced in the browser; each committed value is one save.

## V2.1 (docs/V2.1-REAL-PACKS.md) — §13 steps 1–2

### Step 1 — the four bugs
- **Duffels / Rolling duffels** now show the Dimensions section for its unit. H/W/D stay hidden there, because those categories give L × W × H in their own section. Test: `tests/unit/v21-bugs.test.ts`.
- **A Hardware-category pack prints its own component.** The panel is built from the pack's `hw.*` answers (overall size, detail dimensions, material, finish, logo treatment, chosen views) over the library item.
- **No 40 mm fallback.** Views are drawn from the part's own size (`src/lib/pdf/true-size.ts`):
  - one number ("DIA 8") sets the longer side;
  - W × H fits at the image's aspect;
  - with no size, the panel says "NOT TO SCALE — SIZE NOT GIVEN" instead of "SIZE 100%".
  - The TOP view now renders too.
- **Component codes and style numbers are separate sequences.** The format's digit count is exact, so `PA_LUG_10001` (a style) is never read as component 10001. The next component code skips any number a style already uses. Tests: `tests/unit/codes.test.ts` (`PA_LUG_009`).

### Step 2 — reference answers and the PROTO gate
- **Reference answers** (`src/lib/reference-answer.ts`):
  - Any question can be answered "by reference": follow reference image, same as <style #> [part], from previous development, factory standard, scale to CAD, open to options, to be provided.
  - At PROTO they are settled. They print as written: on page 1 for now; the standard layout (step 3) places them inline.
  - At PRODUCTION, "to be provided" and "open to options" block, and "same as" must resolve to a pack or library code in the studio.
- **Hardware identity.** A part may be identified by a **description** before it has a library code: "Use … as a description" in the library picker. Described parts print on page 1.
- **Pack stage.** Each pack has a stage, PROTO or PRODUCTION, switched with one click on the pack.
  - Migration 0015 starts packs that already have an SMS / PP / TOP round at PRODUCTION.
- **PROTO gate** (`src/lib/stage-gate.ts`). Only these are required at PROTO:
  - overall size (two of H/W/D for flat products);
  - materials and the material cells per colourway (a per-colourway lining in the breakdown counts as the lining);
  - logo method + location;
  - hardware identity;
  - strap / handle specs and interior, where a reference answer satisfies them.
  - Other rows need only their part identity; partial sizes are fine. Unconfirmed answers that aren't required don't block.
  - In `validatePack`, only those completeness rules and the hard geometry rules (flap > H, pocket too big, logo outside its panel, strap < 2 × drop, gusset ≠ D) fail at PROTO; everything else is a warning. Licensor fields are checked at PRODUCTION only.
- **Golden set:** `npm run golden` (`scripts/golden.ts`). Inputs:
  - the seven study files (`reference/real-packs/`, gitignored);
  - PINK013 / TB25_ACC0023 from the e2e database, snapshotted to `.data/golden/`;
  - `reference/real-packs/golden-entry.json` (gitignored): the fields each original answers by reference.
  - It prints counts and question ids only.
