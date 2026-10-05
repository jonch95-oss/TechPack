# TECH PACK STUDIO v2: THE SEAMLESS FLOW

Goal: a designer drops a CAD, answers only what nobody else can know, and exports a factory-ready pack in minutes. The user is a technical designer producing 100+ packs a week.

This brief replaces "answer 75 questions" with "confirm what the studio already knows, then type a dozen numbers."

Read `docs/BRIEF.md` first. Everything there still applies unless this document changes it. Build in the order given in §12, and do not move on until each stage's acceptance test (§11) passes.

---

## 0. Audit results (why this exists)

Sources: the question counts come from running the question bank code. The AI results come from live runs on the preview with the real model; pre-fill time was measured by the test script. Click, keystroke and round-trip counts are estimated by reading the code (no committed script yet; §11 test 1 adds one).

**Question load**
| Category | Questions in bank | Required (★) |
|---|---|---|
| Handbags | 118 | 67 |
| Rolling duffels | 120 | 71 |
| Men's bags | 116 | 65 |
| Duffels | 110 | 63 |
| Coolers | 107 | 63 |
| Hardside / Softside luggage | 96 / 99 | 53 / 54 |
| Cosmetic bags / Toiletry kits | 95 / 95 | 54 / 54 |
| SLGs, Belts, Packing cubes, Neck pillows, Hardware, Decorative hardware, Print artwork | 83–95 | 48–57 |

**PINK013 as entered**
- 82 questions were visible, 45 of them ★.
- Rows (hardware, placements, construction, pockets, points of measure, BOM) add 2–4 required cells each.
- An estimated **~180 clicks, ~120 keystrokes and ~180 server saves per pack** with AI pre-fill; 250+ without it (estimated from the code).

**AI pre-fill, live with the real model.** Jodie and Ted Baker are scored against their finished reference packs. Off-White has no reference pack yet, so it is coverage only.
| Render | AI answers | Still blocking export afterwards |
|---|---|---|
| Jodie | 30 | 63 of 69 rules |
| Ted Baker Dopp | 20 | 54 of 60 rules |
| Off-White mesh | 30 | 58 of 65 rules |

- Scored visible choices: **26 of 37 right (70%)** — Jodie 17/22, Ted Baker 9/15. Not counted: Jodie logo type (the TPU change was a design decision, not visible) and hardware finish (its chosen value isn't exposed in the pack JSON).
- The misses were exactly the factory-critical ones:
  - Jodie: 1 snap instead of 2; "centred" instead of spaced evenly; strap "removable" when it is fixed; silhouette "TOP-HANDLE" while the AI's own note said "satchel proportions"; logo finish "light gold" vs house "shiny champagne gold".
  - Ted Baker: #5 coil zip instead of #8 plastic with metal finish; "binding" instead of edge-painted PU trim; contrast zip tape when the -A tape is black.
- Non-materials polluted the materials list on all three packs: edge paint, enamel fill, zip tape, zip puller, "metal hardware".
- **Zero rows were filled on any pack** — hardware, pockets, zippers. The AI listed the hardware in its notes; nothing reached the table.
- Pre-fill took 68–91 s as one blocking request. A dropped connection crashes the page with "This page couldn't load", even though the server finishes the job.

**Friction**
- Confirming AI answers is one field at a time (✓ + Next), about 100 clicks per pack.
- Clicking an already-selected chip *clears* it, so "accepting" an AI chip deletes it.
- A stepper blur silently confirms an EST value.
- Hardware is entered 2–3 times (items, placements, logo).
- The colorway × material matrix is filled one swatch at a time. There is no copy -A→all, fill-down or DTM-all.
- There are no brand or category defaults, no templates, no "start from a previous style", no batch upload and no spreadsheet create.
- Duplicate is all-or-nothing, and brand, category and colorways cannot be changed afterwards.
- Every save makes about 13 database round trips (from reading the code), followed by a full validation rebuild 1.2 s later.
- The whole library loads on every pack page. The dashboard and libraries have no search.
- There is no error boundary.
- Every pack needs a second designer's sign-off before the PDF.
- Unconfirmed *non-required* AI answers still block export.

**Conclusion:** a single front render can never supply most of a tech pack. The information already exists elsewhere — previous styles, the brand's house standards, the library items, spec sheets, the board text. v2 pulls it from there and asks the designer only for the rest.

---

## 1. Targets (these are the acceptance numbers)

| Scenario | Designer inputs (typed values + picks) | Clicks | Wall-clock |
|---|---|---|---|
| Repeat silhouette / new colourway of an existing style (likely the bulk of weekly volume — Jon to confirm the share) | ≤ 8 | ≤ 25 | ≤ 3 min |
| New style on a known silhouette (PINK013 from scratch; Pink London house standards entered through the Rulebook UI as brand standards, not copied from the PINK013 record) | ≤ 15 | ≤ 45 | ≤ 6 min |
| Brand-new construction (Off-White mesh) | ≤ 30 | ≤ 90 | ≤ 12 min |
| 10 CADs dropped at once | 0 to start; all 10 pre-filled in the background | — | ≤ 5 min to all drafts ready |

Further targets:
- The designer is **never** asked anything the studio can derive, copy, read from a file, or take from a house standard or library item.
- AI field accuracy on the golden set: **≥ 90%** for visible fields.
- **0** non-materials in the materials list.
- **≥ 90% recall** on visible hardware and pockets.
- A proto pack for PINK013 built from render + house standards + library leaves **≤ 10 open items** before the designer types anything.
- "Pre-filled share" (target ≥ 80% of a pack's required answers filled before typing) is measured on **held-out** styles from the archive import (§5), never on a style that seeded the Rulebook.

---

## 2. Core principle: every answer has a source, and sources have a priority

Store a `source` on every answer and show it as a small tag. Resolve conflicts in this order (highest first):

1. **DESIGNER** — typed or picked by a person.
2. **SPEC** — read from an uploaded spec sheet, factory sheet or measurement chart (show file + page).
3. **BASE STYLE** — inherited from the style this pack was started from.
4. **LIBRARY** — carried by a picked library item: swatch composition and thickness; hardware size, finish and photo; label size; print tile and Pantone.
5. **HOUSE** — brand × category × retailer house standard (§5).
6. **TEMPLATE** — silhouette template: construction rows, points-of-measure list, BOM skeleton, typical snap count by flap width.
7. **AI** — read from the render or other images; always shown with what it saw.
8. **DERIVED** — computed from other answers (gusset = D, POM values, placements in mm, description).

`source` (where a value came from) and `status` (whether it is settled) are **separate fields**:

- **status = settled.** No confirmation needed; the designer can always override.
  - Sources: DESIGNER, SPEC, BASE STYLE, LIBRARY, HOUSE, DERIVED.
  - Also TEMPLATE *structure*: the construction-row list, the points-of-measure point list and the BOM skeleton.
- **status = needs-confirm.**
  - Everything from AI.
  - Every TEMPLATE *number* (e.g. typical strap length).
  - Every proportional estimate.
  - Each is shown as EST or INFERRED, with what was seen.

**Conflicts.**
- The higher-priority source's value is used.
- If a *lower*-priority AI or SPEC value disagrees with it, show a red conflict chip. The designer keeps the current value or switches with one click.
- No other source silently replaces a DESIGNER value. A newer upload can only *propose*.

**Blocking — this keeps BRIEF Part 2 rules 1, 2 and 10 and the house rule "never invent measurements":**
- A needs-confirm answer blocks export if it is required for the pack's stage (§6).
- A needs-confirm answer that is **not** required for the stage does not block. On the PDF it prints as the word **"TBC"** with **no value**.
- An unconfirmed number (EST / INFERRED / TEMPLATE) **never** prints on a pack and **never** goes into the library.
- Update the runtime system prompt (Part 2) to match: estimates may be *shown in the app* but are never output to the pack.

**History.** Every answer keeps source, status, value, who and when. This feeds revisions (§9).

---

## 3. The new flow (5 screens → effectively 3)

### Step 1: DROP (dashboard, one drop zone)
- The designer drops **anything**: one or many CADs, a presentation board, spec sheets (PDF / XLSX / image), swatch card photos, hardware photos, reference and construction photos, previous tech pack PDFs.
- **Auto-classify every file** in one cheap AI pass: render | board | spec sheet | swatch card | hardware photo | reference photo | interior photo | old tech pack. The designer can re-tag with one click.
- **Boards:**
  - Auto-crop the product, one crop per colourway if several are shown.
  - OCR the text: colourway names ("BLACK"), material callouts ("MICRO MESH & LEATHER"), style numbers, "REFER TO SPEC".
  - If the board says REFER TO SPEC and no spec was dropped, show "Drop the spec sheet to skip most of the measurement inputs".
- **Grouping:** several CADs dropped → group them by filename and style-number pattern into packs. A style with several colourway renders becomes one pack with N colourways.
- Create **draft packs immediately** and start background jobs: classify → crop → pre-fill → match library → find similar styles → line art. Show progress on the pack cards. The designer can keep working on other packs.
- Images are resized to ≤ 1568 px before the AI call; any format is converted.

### Step 2: IDENTIFY (one compact screen, ~3–5 clicks)
**Brand.** Guessed from the logo on the render, the filename, the board or the last-used brand. Shown with its logo; one click to change.

**Category + silhouette.** From the AI, with the confidence shown.

**Style # and style name.**
- Parsed from the filename or board.
- If absent, the field is focused with the brand prefix typed. Designers assign style numbers, as decided.
- Brand, category, silhouette, style #, name and colourways must all stay **editable after creation**. Today they cannot be changed.

**"Start from…" (the biggest time-saver).**
- Show the 3 most similar existing packs, ranked by image similarity + same brand + same category/silhouette.
- Choose one with a single click, or choose "Fresh".
- Starting from a style inherits everything not visibly different:
  - construction, interior, lining, labels, hardware kit, points-of-measure list with values, BOM, edge and thread, pages;
  - colourway swatches when the colours match.
- Inherited values are tagged BASE STYLE and trusted. Anything the AI sees differently becomes a conflict chip.

**Colourways.**
- Count and names come from the board OCR or the renders. One render showing BLACK gives one colourway, "BLACK" — not -A/-B blanks.
- Suffixes stay -A, -B…. Colourways can be added, removed or renamed anywhere, and matrix data follows.

### Step 3: REVIEW (one screen; replaces the 22-section scroll)
Layout:
- **Left:** the render (or the flat once ready) with **numbered hotspots** on every detected feature. Click a hotspot to jump to its row; hover a row to light its hotspot.
- **Right:** a compact **spec sheet**, grouped as Body / Closure / Handles & straps / Pockets & zips / Branding / Hardware / Interior / Materials & colours. One line per answer: value, source tag, and what the AI saw (on hover).

Bulk actions:
- "✓ Looks right" per group confirms every AI value in that group.
- "✓ All visible" confirms everything that came from the render with confidence ≥ high.
- Low-confidence and conflict rows are never bulk-confirmed; they sit at the top in amber/red.

Keyboard-first:
- `J`/`K` move between rows; `Enter` confirms; `1–9` pick the nth option; `E` edits; `O` opens Other; `/` searches; `?` shows shortcuts.
- Clicking an already-selected chip **confirms** it (today it clears it). Blur on a stepper commits **only if the value changed**.

Only questions relevant to *this* product appear. Branches the AI or base style resolved collapse to a single line ("Closure: FLAP + 2 MAGNETIC SNAPS, SPACED EVENLY — BASE STYLE").

### Step 4: ONLY YOU KNOW (a generated short list, target ≤ 12 lines)
This list is computed from the product, not from the question bank. For each feature detected or inherited, ask only for the values no source supplied. For the Off-White bag that is:
- H × W × D;
- strap width, total length and adjustment range;
- arrows plate W × H;
- zip length for each front pocket;
- buckle inner width and strap-ring inner size;
- eyelet Ø;
- flap height;
- logo offset.
Then due date, and one swatch per material per colourway.

**Measure mode on the drawing.**
- Each needed measurement is a dimension line on the render or flat. Click it, type the number, press Tab to go to the next line.
- **Proportional estimates:** once one real dimension is entered (e.g. W = 20 cm), compute every other visible dimension from pixel ratios (flap height, handle drop, logo plate size, pocket width, strap width) and pre-fill them as EST with ±. The designer accepts each with Enter or types over it. One typed number unlocks about ten.
- Snap and rivet spacing in mm is computed from flap width + count + "spaced evenly". Never ask for it, and never fail validation on "SPACED EVENLY" when the mm can be derived.

**Swatches.**
- Type-ahead with thumbnails; "recent for this brand" first.
- "Same for all colourways", "DTM all", "copy -A → all, then change body colour".
- A dropped swatch-card photo is read, matched to the library (or created), and placed in the cell.

**Header.**
- Due date defaults to ASAP.
- Retailer, season and reference sample default to the designer's last pack for this brand. Never required for a proto.

### Step 5: EXPORT
- A checklist of what's left, grouped by **what blocks this stage** vs **TBC (prints, doesn't block)**. Each item has a one-click fix inline, never a page jump.
- PDF, line art and PSD are generated as **background jobs**. Download when ready; the designer is notified.
- **Batch export:** select N packs on the dashboard → export all as a ZIP of per-pack ZIPs.
- **Sign-off is a brand/stage setting:** off for proto by default, on for production. When on, use a **review queue** where the reviewer can approve or comment on many packs in a row with keyboard shortcuts.

---

## 4. Hardware and materials: entered once, seamlessly

### 4.1 One hardware table (no double entry)
Merge `hardware.items`, `placements.list` and the logo-plate position into **one table**, one row per part. Columns:
- part (library item with thumbnail);
- qty;
- location (chips: flap, front, side, strap, handle, base, interior, pull…);
- position: edge + mm, or "spaced evenly", or "centred";
- size and finish (read-only from the library unless overridden).

The logo row's position comes from Branding, and Branding edits update it. There is no second entry anywhere.

### 4.2 AI → hardware rows automatically
- Pre-fill outputs a structured `hardware[]`: `type`, `qty`, `location`, `relative size`, `finish as seen`, `bbox` on the render.
  - Off-White: arrows plate ×1 flap; square prong buckle ×1 strap; ring zip pulls ×2 front pockets; rectangular strap rings ×2 top corners; eyelet ×1 flap top-left; #5 metal zips ×2.
  - Jodie: logo plate ×1; magnetic snaps ×2 (inferred, confirm); top-handle rings ×2; strap swivel hooks ×2; charm ×1.
- **Match each detected part to the brand's library** by type + finish + image similarity of the bbox crop. Show the top 3 thumbnails; one click accepts.
- **No match:**
  - "Create from render": the crop becomes the library photo and the code auto-fills as the next free code in the brand format.
  - Type, finish and qty come from the AI. Size comes from the spec sheet or the designer. A proportional estimate may be shown as a suggestion, but it must be confirmed before the item is saved — no estimate ever enters the library. Otherwise the size is one of the "only you know" lines.
  - The item is created inline in a drawer; the designer never leaves the pack.
  - New hardware requires **dims + finish at creation**, because the gate needs them.
- **Edit library items inline** from the pack (with a warning when the item is used in other packs).

### 4.3 Hardware kits (house standard)
Admins define kits per brand + finish. Example — PINK LONDON / SHINY CHAMPAGNE GOLD:
- PINK005 logo plate;
- 14 mm magnetic snap;
- 20 mm O-ring;
- swivel hook;
- PINK004 woven label;
- feet.

The kit's items are offered first and are the default match for anything detected. One click applies a kit, adding rows with standard placements.

### 4.4 Materials
- The materials list holds **only body and trim materials**: fabrics, leathers, PU, mesh, webbing, lining. These are excluded:
  - edge paint, thread, zip tape → construction / zipper columns;
  - hardware → hardware table;
  - enamel → hardware item spec.
- Each material row carries a library link per colourway. **Matrix tools:**
  - copy -A → all;
  - fill down;
  - DTM all;
  - swap one material across colourways;
  - **colourway families** per brand (e.g. Pink London "BLACK / PINK" pair), applied in one click.
- Swatch cards dropped anywhere are read, de-duplicated against the library (supplier + article + colour no.) and linked.

### 4.5 Library hygiene at scale
- A "Library health" view lists items missing size, finish, photo or composition, with a **grid editor** to fix many at once.
- Server-side search, filters (brand / type / finish / supplier) and a virtualised list.
- The picker supports arrow keys + Enter, and genuinely filters by the question's hardware types.

---

## 5. House standards: the "Rulebook" (admin-managed, per brand × category × retailer)

Build an admin-only UI (role: admin) where Jon sets defaults once. Every new pack starts from them, tagged HOUSE (settled, overridable). Seed it with what the two reference packs prove, and leave the rest for the admin to fill.

**Versioning.** The Rulebook is versioned. Each pack records the Rulebook version it started from, and changing a standard never alters an existing pack.

| Setting | Example seed |
|---|---|
| Unit | Pink London **cm**, Ted Baker **inches**, others ask once and remember |
| Secondary unit in brackets | per brand |
| Edge treatment / colour | PU bags: EDGE PAINT, DTM. Ted Baker accessories: "EDGE PAINT ALL PU IN BLACK" |
| Thread colour | DTM |
| Interior package | Pink London: lined, tonal heat-stamp PINK repeat (10 × 10 cm, Pantone 203 C), back-wall slip pocket 14 cm wide, 2.5 cm from top, binding, PINK004 label 4 × 2 cm, 1.5 cm below pocket top, centred |
| Lining base fabric | per brand (e.g. 190D poly) |
| Hardware kit + finish | per brand (§4.3) |
| Logo | default logo item per logo type (PINK005 plate, TB deboss patch 55 × 21.8 mm gunmetal fill) with default placement and offset |
| Construction rows | per silhouette template (edges, seams, cross-sections) |
| Points-of-measure point list | per silhouette (structure only; values come from answers) |
| BOM skeleton | per silhouette: visible components only by default. Hidden components (interlining, board, foam) are listed only if the admin turns that on — the Optional sections decision stands |
| Typical strap / handle values | per silhouette as **TEMPLATE** (e.g. crossbody strap 120 cm, adjust 105–125 cm, 2 cm wide). Shown EST until confirmed or overridden |
| Pages | features page on/off, lining page placement, swatch layout |
| Optional sections | **off by default, as Jon decided.** An admin may switch one on for a retailer or brand (e.g. care/COO labels for a retailer that demands them). Never switched on automatically |
| Licensor fields | per brand; **asked at production stage only**, not at proto |
| Sign-off | per brand × stage |

**Importer — the second biggest lever.** Add "Import past tech packs": drop the team's archive of finished PDFs (hundreds) and Excel BOMs. The AI extracts each into:
- a **base style** (searchable in "Start from…");
- library items (hardware with codes, sizes and photos; swatch cards; prints);
- proposed house standards (most common values per brand × category — the admin approves).

This seeds the whole system from what Icon already has. Target: a new style on a known silhouette starts ≥ 80% filled, measured on held-out imported styles (§11 test 2b).

Importer limits:
- show the page count and estimated AI cost before running;
- run as a background job;
- cap pages per file;
- skip duplicates by file hash;
- everything imported lands as *proposed* for admin approval — nothing becomes HOUSE or a base style unreviewed.

---

## 6. Pack stages: proto vs production (real-world gating)

Two stages only: **PROTO** and **PRODUCTION**. The stage is a field on the pack; changing it is one click. Validation blocks only what the stage needs.

**PROTO.** Everything Jon made required stays required:
- H/W/D;
- closure, including snap count and position in mm (derived where possible);
- **full strap and handle specs** (width, length, drop, adjustable range, attachment);
- materials per colourway (supplier + article + colour, or library swatch);
- **hardware specs** for every part (code, size in mm, finish, qty, location);
- logo type, item, size and position;
- **interior** (lined, lining, pockets with sizes, label and position);
- edge treatment;
- colourway matrix complete.

These may be settled by any trusted source (house, library, base style, derived), so most need no typing. Points of measure and BOM are *derived* and must be complete, but their values come from the answers.

**PRODUCTION.** PROTO, plus:
- licensor fields (brands that need them);
- sign-off (if the brand setting is on);
- any optional section the admin has switched on for this retailer or brand.

**Not required at either stage, and not blocking:**
- retailer, season, reference sample, product-features list, comments.
- If unanswered, they print blank or "TBC" — never a guessed value.

**Validation:**
- **Hard fail at both stages:** flap taller than body H; pocket wider than wall − 2 cm or taller than wall − top offset; logo + offset outside its panel; strap total length < 2 × drop; gusset ≠ D; duplicate style # within a brand.
- Every other geometry or consistency rule is a warning at PROTO and a fail at PRODUCTION.

**Status pipeline (§8) is separate from stage.**
- Statuses are manual flags the designer sets: Draft, Ready, Sent to factory, Proto received, Comments, R1…, Approved.
- The app never sends anything; "Sent to factory" only records that the designer sent it.

---

## 7. AI: what to change

**1. Structured outputs for everything visible.** Not just chips. Output:
- `hardware[]` with bbox;
- `pockets[]` (exterior and visible interior, with location and opening type);
- `zippers[]` (location, path, count, gauge as EST, tape colour seen);
- `materials[]` (body/trim only, enum-checked);
- `colourways[]` (from renders and board OCR);
- `features[]`;
- `board_text`;
- `brand_guess`.

Every item carries `confidence` (high / med / low) and `seen` text.

**2. Self-consistency.**
- A value must agree with its own "seen" text. Run a validator pass; if they disagree, mark the answer low-confidence.
- Real case: the Jodie silhouette came back "TOP-HANDLE" while the note said "satchel proportions".

**3. Hidden counts are never defaulted to 1.**
- Snaps under a flap or rivets inside are INFERRED from base style → house template (flap width > 16 cm → 2 snaps) → otherwise a required "only you know" line.

**4. House vocabulary with visual references.**
- Send the brand's hardware-kit photos and finish chips with the prompt so the AI matches "shiny champagne gold" vs "light gold" against Icon's own references, not general colour words.
- Same for edge finish: send reference crops of edge paint vs binding vs turned edge (the Ted Baker trim was misread as binding).

**5. Use every image.** Send all renders, back, side, interior and board crops in one call. Fields seen in a secondary image become AI, not INFERRED.

**6. Re-estimate after the first real dimension.**
- Once W (or any dimension) is known, run a cheap proportional pass that outputs EST values for every visible length (§3 step 4), plus zipper gauge from tape width relative to W.
- Real case: the Ted Baker #8 zip was read as #5 because there was no scale.

**7. Background jobs.**
- Pre-fill auto-starts on upload; progress shows on the pack card; results stream in group by group.
- A network drop must never crash the page or lose the result. Add `error.tsx` boundaries and retry on save.
- Mechanism: a `jobs` table (type, pack, status, progress, result, error, attempts). The request returns a job id at once and the work runs after the response (Next.js `after()` or a Vercel queue/workflow — check the installed docs, pick one, document it). The client polls or streams status. Give each job route an explicit `maxDuration`. Jobs are idempotent per (pack, type, input hash).

**8. Golden-set evaluation harness.**
- Add `tests/ai-eval/` (code and expected-answer files only).
- Images and reference packs load from the gitignored `reference/` folder; skip with a message when absent. Never commit brand assets.
- Start with PINK013 and TB25_ACC0023. Add the Off-White bag once Jon supplies its spec, then grow the set from imported archives.
- Run with the real model on demand (`npm run ai:eval`). Score per field (exact / acceptable / wrong / missed); run each case 3× and report the median, because live model output varies.
- Print a scorecard and save it to `.data/ai-eval/<date>.json`. There is no CI in this repo, so report the scores rather than gate on them. Track them over time; they decide where the prompt or house references need work.

**9. Cost and speed.**
- Classification and OCR on a fast model at low effort; the main read at high effort.
- Cache by image hash, so re-reading the same render is free.
- Note: the API key is org-level; `ANTHROPIC_WORKSPACE_ID` must stay wired (`src/lib/ai/client.ts`).

---

## 8. Speed and robustness at volume

**Dashboard**
- Server-side search (style #, name, brand, designer), filters (brand, category, stage, status, due, designer) and pagination.
- A "My queue" view.
- Status pipeline: Draft → Ready → Sent to factory → Proto received → Comments → R1 → … → Approved.
- Bulk actions: export, change stage, assign, archive.

**Saving**
- One round trip per save, with an optimistic UI. Debounce and batch rapid edits.
- **Concurrency:** each pack has a version number. A save with a stale version gets a "Emily changed this — reload / keep mine" prompt, never a silent overwrite.
- **Undo** for every bulk action (bulk confirm, fill-down, copy -A→all, kit apply, batch revision) for at least the session.
- Incremental validation of only the affected rules — no full rebuild and spell-check on every click.
- Never reload the whole library per save.

**Editing**
- Rows as a **compact grid** (Tab / Enter / arrow keys, duplicate row, delete row, **paste from Excel**). No stacked cards.

**Errors**
- Error boundaries on every route. A failed save shows inline retry and keeps the typed value.

**Batch create from a spreadsheet**
- Columns: style #, name, brand, category, base style, colourways, render filename. Plus a folder of renders → N draft packs.

**Duplicate → "New from…"**
- Choose which groups to inherit; change brand, category or colourways in the dialog; style # is focused and required.

**Uploads at volume**
- Every upload (single or batch) goes **directly from the browser to Blob** (client upload with a token from `/api/blob`), never through a server route — server bodies cap around 4.5 MB.
- Show per-file progress.

**Identity and naming**
- Style # unique per brand (database constraint).
- Library codes: unique per brand, with a database constraint and a transaction when assigning the next free code, so two designers can't get the same one.
- Export file names follow `{STYLE}_{STYLE-NAME}_{STAGE}_R{n}_{YYYYMMDD}.pdf` (same stem for the ZIP, SVG/AI/EPS and PSD).

**Freeze at export**
- When a PDF is exported, snapshot the library items, house standards and answers it used into that revision.
- Later library edits never change a sent pack. They can be pulled into the next revision with one click, which shows the differences.

**Size sets**
- One pack can carry a size set (luggage 20/24/28, belt runs, packing-cube sets).
- Points of measure become a graded table per size; materials, hardware and construction are shared, with per-size overrides.

**Line art**
- Requires the image API. If it is unavailable, or the product is dark or sheer, **do not** fall back to a raw trace (it produced a solid black blob for the black mesh bag).
- Offer instead: (a) the base style's flat, adjusted; (b) a silhouette template flat scaled to H × W; (c) retry later as a background job.

---

## 9. Revisions loop (where volume teams lose the most time)

- Each pack has a "Factory comments" inbox. Paste comments, drop sample photos or forward the factory email text.
- The AI drafts the changes as a proposed R1 — each change linked to the comment it came from.
- The designer approves item by item. Approved changes get *UPDATED* flags and a change-log entry automatically.
- When a fix applies to every pack with the same base style or the same library item ("all PINK005 plates now TPU"), offer to apply it across those packs as a batch revision.

---

## 10. Question bank: concrete changes

Handbags are shown below. **Before building, Claude Code writes the same table for all 16 categories** into `docs/V2-QUESTION-MAP.md`: every question id → source (HOUSE / TEMPLATE / LIBRARY / BASE STYLE / AI / DERIVED / DESIGNER) and stage (PROTO / PRODUCTION / never). Jon reviews it before the work starts.

| Question(s) | v2 |
|---|---|
| `dims.unit`, `dims.show_secondary` | HOUSE per brand; never asked |
| `header.licensor*` (3) | Brand-level; asked at PRODUCTION only |
| `header.description` | DERIVED; trusted; editable; no confirm |
| `header.retailer`, `season`, `reference_sample` | Remember last used per brand; never required for PROTO |
| `hb.gusset_width` | DERIVED (= D) — already is; never shown as a question |
| `hb.closure.snap_spacing_value` | DERIVED from flap width + qty + spacing rule |
| `hb.strap.drop` | DERIVED from strap length + body H when both are known |
| `hb.top_handle.*`, `hb.strap.*` selections | AI + BASE STYLE; lengths and widths via measure mode / proportional EST |
| `branding.logo_code`, `logo_size`, `offset`, `offset_edge`, `finish`, `fill` | HOUSE default logo per brand × logo type (LIBRARY carries size and finish); offset from proportional EST |
| `branding.artwork`, `tool_depth`, `new_tooling` | Only when the logo item is new; otherwise LIBRARY |
| `edge.*`, `construction.thread_colour`, `construction.list` | HOUSE + silhouette TEMPLATE |
| `hardware.finish`, `hardware.items`, `placements.list` | One hardware table (§4.1), filled by AI + kit + library |
| `zippers.list` | AI rows + LIBRARY; gauge EST after the first dimension |
| `interior.*` (14 questions) | HOUSE interior package per brand, or BASE STYLE; AI only overrides when interior photos are dropped |
| `pom.list` | DERIVED: silhouette TEMPLATE points + values copied from answers. Tolerances only if the admin switched on the tolerances section. The designer never re-types a value |
| `bom.list` | DERIVED: from answers + library + the template skeleton (hidden parts only if the admin enabled them). No prices; consumption is the factory's |
| `pages.*` | HOUSE per brand |
| `opt.*` sections | Off by default (Jon's decision). An admin may switch one on per retailer or brand in the Rulebook; never automatic |

What the designer still decides on a typical new style:
- a few measurements (most proposed by proportional EST);
- the swatch per colourway;
- one or two hidden facts (snap count if no base style, interior if it differs from house).

---

## 11. Acceptance tests (automate these; the numbers in §1 are pass/fail)

1. **Time-and-motion (Playwright, counts every click and keystroke):**
   - (a) PINK013 from its render with Pink London house standards entered through the Rulebook UI (brand standards only — no PINK013 record, no base style): ≤ 15 inputs, ≤ 45 clicks, export-ready at PROTO. This measures clicks, not AI accuracy.
   - (b) A new colourway of PINK013 via "Start from…": ≤ 8 inputs, ≤ 25 clicks.
   - (c) The Off-White micro-mesh bag (render + its spec sheet): ≤ 30 inputs.
   - Print the counts in the test output.
2. **AI golden set (reported, not gating; §7.8):**
   - (a) ≥ 90% accuracy on visible fields;
   - hardware and pocket recall ≥ 90%;
   - 0 non-materials in materials;
   - Jodie snap count is not 1 unless confirmed;
   - every value consistent with its "seen" text.
   - (b) **Held-out fill rate:** after importing an archive, take 5 imported styles out of the Rulebook and base-style pool. Rebuild each from its render alone; ≥ 80% of the PROTO-required answers must be settled or proposed before any typing.
3. **Batch:** drop 10 renders + 1 spreadsheet → 10 draft packs, all pre-filled within 5 min with no further clicks. The UI stays responsive throughout.
4. **Resilience:** kill the network mid-pre-fill → reload → results present and no crash. Kill it mid-save → the value is kept and retried.
5. **Source rules:** BASE STYLE vs AI conflict shows a conflict chip; HOUSE values never need confirming; changing a house standard does not alter already-sent packs.
6. **Hardware once:** the logo plate position is entered in Branding and appears in the hardware table and PDF without re-entry.
7. **Import:** importing the two reference PDFs creates two base styles, their hardware (PINK003/004/005, TB zip pull 16 × 42 mm) and swatch cards (Junfa #2 / #24, Jinxin AH316HB-P 401HB / 823HB / 609HB) in the library.
8. **Regression:** the existing Phase 1–4 e2e suite still passes. The PINK013 and TB25 PDFs still match the reference pages.

---

## 12. Build order

1. **Foundations for speed.**
   - Answer `source` model and priority resolution.
   - Single-round-trip saves, incremental validation, error boundaries.
   - Background job runner (pre-fill, line art, PDF) with progress.
   - Editable brand, category and colourways.
   - Keyboard-first review screen with bulk confirm.
   - Chip and stepper fixes.
2. **Rulebook + stages.** House standards admin (versioned), seeded from what PINK013 / TB25 prove; proto vs production gating; "TBC" printing for non-required blanks (never an unconfirmed value).
3. **Hardware once + kits + library matching + inline create/edit.** Materials-only list; matrix tools; colourway families.
4. **AI v2.**
   - Structured rows, board OCR and auto-crop, multi-image, self-consistency, house references.
   - Proportional re-estimate and measure mode.
   - Golden-set eval harness.
5. **Start from… + New from… + archive importer + batch create (spreadsheet / folder).**
6. **Dashboard at volume** (search, filters, pipeline, bulk) + revisions inbox (§9) + review queue.
7. **Line-art fallbacks** (base-style flat, silhouette template flat), then re-run every acceptance test and report the numbers.

**Before starting, ask Jon only for:**
- roughly what share of weekly packs are repeats or new colourways of existing styles (sets the priority of step 5);
- a batch of past finished tech packs to import (the more the better);
- unit per brand where unknown;
- each brand's default interior and hardware kit if not in the archive;
- the Off-White mesh bag's spec sheet for the golden set.

Everything else is decided above.
