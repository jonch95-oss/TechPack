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
- **Component codes and style numbers are separate sequences.** The format's digit count is exact, so `XY_LUG_10001` (a style) is never read as component 10001. The next component code skips any number a style already uses. Tests: `tests/unit/codes.test.ts` (`XY_LUG_009`, a neutral stand-in for the brief's example).

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

### Step 3 — standard layout and markup
Jon's decisions (§13): one standard layout for every brand; packaging pages are off by default for every brand.
- **Page order** (`src/lib/page-names.ts`, `src/lib/pdf/plan.ts`):
  OVERVIEW · MEASUREMENTS · REFERENCE IMAGES · COLOURWAYS · TRIMS & HARDWARE · INTERIOR & LINING · LINING / PRINT ARTWORK · CONSTRUCTION DETAILS · BILL OF MATERIALS · SWATCH CARDS · SAMPLE COMMENTS · CHANGE LOG.
  - Empty pages are skipped.
  - Old page names in stored comments, revisions and photo placements are rewritten by migration 0016. `normalizePage()` maps any left over.
- **Standard header** on every page:
  - a style box with STYLE CODE, the date in red followed by the latest revision, and ITEM in bold;
  - a brand box with "BRAND:" and the logo;
  - `P{n} · TITLE` at the bottom right, with *UPDATED* when something on the page changed.
- **Overview** replaces the materials/hardware and product-features pages:
  - the front (and back) flat, or the render with red dimension arrows;
  - the size line, e.g. "16 CM H X 20 CM W X 8 CM D";
  - the headline instruction (new question `header.instruction`);
  - the features box (`pages.product_features` now switches only this box);
  - comments and reference answers, the material callouts, and the facts list (description, category, retailer, season, due date, reference sample, sent by, licensor, hardware, logo, keychain).
- **Colourways** replaces the enlarged CAD page:
  - the material / colour breakdown, showing only the columns in use; the materials are headed by yellow callouts and the logo column is red;
  - an SKU block under each colourway render: SKU#, COLOR, FABRIC, LINING, ZIPPER.
- **Markup:** reference photos sit in a red frame with red captions.
- **Re-laid packs:**
  - PINK013 prints 8 pages (12 once construction, BOM, flats and the change log are added).
  - TB25_ACC0023 prints 6 pages.
  - `tests/e2e/03-phase2-pdf.spec.ts` checks every fact of each original page on the standard page that now carries it.

## Golden run 1 — the real packs through the standard layout
The nine golden packs were printed through the standard layout and compared with their originals. The fixes, by rule:

### P0 — every entered fact reaches the PDF
- **Each category's own size fields** (`src/lib/pdf/doc.ts`):
  - duffels print `size_l/w/h` as L × W × H, and their dimension arrows read L across, H up and W as the depth;
  - sets print one line per `cube.set` piece;
  - luggage prints `lug.size`, plus H/W/D when given.
- **SPECIFICATIONS block** (`src/lib/pdf/specs.ts`):
  - Every answered, visible question that no page already prints goes on page 1 as `LABEL: VALUE`, grouped by section.
  - Page 1's right column shrinks its type (to 72% at most) before anything spills onto SPECIFICATIONS pages after OVERVIEW.
  - Booleans print as the feature, never "YES". Reference answers print via `refText()`.
  - A template that prints an answer in its own words declares those words (`printedAs`, e.g. the strap note, "(CENTERED)"). Either form counts as printed.
  - Parts identified by a description now print with the other hardware rows here.
- **Comments and photos make their page print** (`src/lib/pdf/plan.ts`, `forced`).
  - A page that can't print hands the item on: comments go to page 1, photos to REFERENCE IMAGES. That covers a lining page with no artwork, and the swatch, sample and change-log pages.
  - Each page places a set number of photos: OVERVIEW 2, MEASUREMENTS one detail + one side view, COLOURWAYS 3, TRIMS 4, INTERIOR 3, LINING ARTWORK 1. Extra photos go to REFERENCE IMAGES.
- **TRIMS & HARDWARE paginates** (`trimsLayout`): two panels to a page, continuing as "TRIMS & HARDWARE (2/3)". The logo / photo row goes on the last page.
- **Colourways:**
  - the pack render stands in for the first colourway when that colourway has no render of its own;
  - a single-colourway pack's SKU is the style number alone;
  - photos assigned to COLOURWAYS print.
- **Empty values print nothing:** no "()", no bare "MM", no empty "·" separators.

### P1 — layout and markup
- Photo frames are sized to the EXIF-rotated image, so they hug the photo.
- Photo letters are picked from the comment list, and the caption follows the comment. A photo with no comment takes the next free letter. The validator warns when a photo and its comment disagree.
- **Interior page:**
  - with no pocket geometry, the interior photos print large instead of empty frames;
  - photos get their own column;
  - LEFT/RIGHT SIDE pockets map to SIDE 1/SIDE 2, and other walls get their own thumbnail;
  - pocket qty and construction print.
- The measurements detail photo is captioned with its own note.
- **Logo leader:**
  - it starts from `branding.placement`, and points at the back view when the logo is on the back;
  - when nothing says where the logo is, there is no leader, and the validator asks for a click on the render.
- **BACK / SIDE photo roles** ("Overview — back view") print beside the front on OVERVIEW.
- **Material callouts on the drawings:** the yellow numbered callouts sit on the OVERVIEW render and on the colourway renders.
  - They are suggested from each material's locations.
  - The designer places them in the render's mark-up drawer (stored as `marks.callouts`).
- **Swatch cards:** one page per physical card. Every chip used on it is boxed and labelled with its colourway(s).
- **A Hardware-category pack is one component sheet:** the panel, its leftover answers and the finish photo.
- **Hardware views can be cropped to the part** in the library (migration 0017, `hardware.view_crops`). The 100% views print the crop, and an uncropped view shows "Crop to the part" in the studio.
- **Labels:**
  - dates print MM.DD.YYYY;
  - the breakdown says "HARDWARE" unless the pack has snaps;
  - zipper rows with nothing but a position are dropped.
- **Sets at PROTO:** `cube.set` rows with two of L/W/H each satisfy the size rule.

### `npm run golden:pdf`
- Seeds the study packs' expected answers into the e2e database: the reference answers from `golden-entry.json`, and the pack G parts as library hardware. No photos.
- Prints all nine packs and runs three checks:
  - answered → printed;
  - every comment and photo caption printed;
  - no element outside its page or clipping box (`src/lib/pdf/overflow.ts`).
- Prints counts, question ids and page lists only. PDFs and the report go to `.data/golden/`.

## Golden run 2
- **Callouts:**
  - every numbered material gets its yellow callout;
  - a suggestion comes from the material's *first* location;
  - callouts that would land on each other are spread apart (`spreadPoints`), in the PDF and in the studio's mark-up drawer.
- **Comments sit in a strip under the header** on every page except page 1 (`openPage` in `html.ts`), never in the header band.
  - The page body is scaled into the space left under the strip, so nothing meets the comments.
  - Header-band titles stay where they are.
  - The overflow check now also fails any text that runs into the style box, the brand box or the page tag.
- **Photos:**
  - TRIMS & HARDWARE photos get the free space under the panels: one photo takes half the page, several share it. When there's no room for that but a logo row exists, they sit beside the logo; otherwise they get a page of their own.
  - A photo prints at actual size (1:1, with a scale note) only from its real width, entered in the mark-up drawer. A caption saying ACTUAL SIZE without a width is a validator warning, never a guess from the image file.
- **SPECIFICATIONS block:**
  - the studio's own row notes ("seen on render", sources) never print;
  - row questions print as small tables;
  - capacity and the nesting order (derived answers that are facts) print;
  - zips stated by position only are listed under the BOM zipper table, so nothing duplicates.
- **Units:** an mm value in an inch pack prints in inches with the mm in brackets, e.g. 6.75" (171.5 MM). This covers the SPECIFICATIONS block, the logo panel, placements, padding, board and tooling depth. Hardware panels stay in mm.
- **Overlaps:**
  - with views beside the front, the LOGO label sits at the bottom right;
  - the reference grid stops clear of the page tag.
- **AI read:** edge treatment, thread colour, logo method, metal finish names, shell / fabric material and wheel type are INFERRED / low confidence unless the read says it saw them unambiguously (`RENDER_UNSETTLED`). Material types from a render are inferred too.
  - `npm run ai:eval` runs the read on every golden render and scores it (`src/lib/ai/eval.ts`): correct, wrong, **confident-wrong** (target 0) and invented measurements.
  - It needs `ANTHROPIC_API_KEY`, plus a render per study pack at `reference/real-packs/<pack>/render.png`.
- **Golden seed:** a neutral placeholder render, plus a photo for each comment that points at images, so layouts are exercised as with the real files.

### Step 4 — multi-style packs, sets, size families, units
- **Multi-style packs (§4):**
  - each colourway can carry its own style # (pack setup), unique across the studio like any style # (migration 0018, `packs.colorway_styles`);
  - the header's STYLE CODE lists them all, each colourway's SKU is its own, the PDF is named for all of them, and the dashboard search finds every one.
  - **Named variants** without a suffix ("VINTAGE") are allowed. Removing a colourway re-letters suffixes only.
- **Per-colourway SKU facts:** the print file name and Pantone per colourway (`colorways.print_file`, `colorways.pantone`). With a print file and no Pantone the SKU block reads PANTONE: SEE PRINT FILE.
- **Per-colourway features:** a feature row's "only on" column prints "<STYLE #> ONLY".
- **Sets (§5):**
  - each `cube.set` row has a piece type (CUBE / POUCH …) and its own material;
  - a flat piece needs no H;
  - the size lines name the piece ("POUCH M: …");
  - nesting runs within each piece type.
- **Size families:** `header.size_family` and `header.sample_size` print on page 1 (SIZES / SAMPLE SIZE).
- **Unit per brand:** a brand's unit (admin → brands) is the unit a new pack starts in.

## V2.1 step 5 — branding, embellishment, trims, components
### Logos and embellishments
- `branding.items` holds every logo and embellishment after the main one. Each has:
  - method (screen print, TPU / raised TPU, print on webbing, embroidery, patch / sewn-on patch, deboss / emboss / tonal emboss, heat stamp, foil, trapunto, rhinestone / hotfix, metal plate / plaque, enamel badge, woven label, knock-out, pop stitching);
  - artwork (print library) or file name, W / H (mm), colour / Pantone;
  - placement and position, relief, orientation, border / finish;
  - count and motif (rhinestones, trapunto);
  - the colourway(s) it is only on.
- `branding.artwork_print` gives the main logo artwork from the print library.
- **Artwork panel for every method** (TRIMS & HARDWARE):
  - the artwork at its stated size, with a dimension line for each given dimension (inches with mm in brackets in an inch pack);
  - "ACTUAL SIZE (1:1)" when it fits the panel, otherwise reduced and said so;
  - a width-only logo keeps its artwork's own proportions and gets no H line;
  - panels pack into rows across the page (`logoRows`); TRIMS & HARDWARE paginates over component panels, then logo rows, then photos.
- **Decision:** logos made as hardware (metal plate / plaque, enamel badge, engraved hardware, metal lettering) print as their component's panel, not as an artwork panel. They are parts, with their own sheet.
- **Golden:** a study's proposed `_new.branding.items` (type, width in inches, colour, placement) is now entered as `branding.items`.

### Breakdown trim columns
- `materials.trims` lists the pack's own trim columns (name, note). Each becomes a breakdown column after the materials, keyed `trim_<n>` and headed by a `T<n>` callout, filled per colourway like any other cell.
- A trim column always prints, even before its cells are filled, so a missing value shows.
- **Decision:** a removed trim keeps the numbers of the ones after it (`trim_<n>` follows the row index), so filled cells never move to another trim.
- **Golden:** a study's proposed `_new.materials.matrix_trims` (colourway → trim → value) is entered as `materials.trims` plus the `trim_<n>` cells.

### Component record (§7)
- **Types added:** hubcap, trolley tube / handle system, push button, carry handle, corner guard, strap slider / adjuster, cord lock, bungee-cord puller, webbing puller, finish standard (wheel, zipper slider, eyelet were already there).
- **Finishes added:** MULTI-COLOR (VACUUM-PLATED IRIDESCENT), AGED SILVER, BLACK, PANTONE-MATCHED PLASTIC. **Materials added:** PLASTIC, RUBBER, TPU. Section is a new view option.
- **Library record:** a new `hardware.record` jsonb (migration 0019) holds colour, relief treatments (treatment + depth mm + location), orientation, mounting, parent part, usage per style (style, qty, location) and the finish standard. The hardware form has a "Component record" block for them.
- **Component sheet questions:** `hw.colour`, `hw.relief`, `hw.orientation`, `hw.parent`, `hw.usage`, `hw.finish_standard`; `hw.attachment` is now "Mounting / attachment" with the record's mounting options. The sheet's answers win over the library record.
- **Print:** each relief is a red R<n> callout phrased depth + treatment + location ("1.5MM DEBOSSED LOGO ART"); colour, mounting, orientation, parent ("PART OF") and each usage ("USED ON") print in the panel notes. Library parts used in style packs print the same facts from their record.
- **Decision — shared finish standard:** a finish standard is a library item of type FINISH STANDARD (its photo is the standard photo, its finish spec the plating). Parts point at one, so every part in that finish shares the same photo and spec; the panel prints "FINISH STANDARD" + its headline + photo.
- **Decision:** `hw.colour` is offered on every component sheet (not only non-metal) because sheets give a colour for parts whose material isn't stated.
- **Golden:** component sheets now enter colour, mounting, orientation, parent and usage, and the study's RELIEF-kind detail dimensions as `hw.relief` rows instead of detail dimensions.
- **Not yet:** the CSV / XLSX hardware import does not read the record columns.

### Hardside interior and the lining sheet
- `interior.layout` (hardside luggage only): rows of half (LID HALF / BASE HALF / BOTH HALVES), feature (zippered divider panel, zippered pocket, zippered compression compartment, mesh pocket, elastic compression straps, X straps with centre buckle, shoe bag, wet pocket, label), qty and note.
- INTERIOR & LINING prints the layout half by half, numbered; features with no half stated print under INTERIOR (the half is never guessed).
- **Decision — lining sheet:** a lining-and-interior sheet is not a part. Its print record is a print-library item (motif, repeat, tile with its own unit, colours, application, base fabric) that the style pack's `interior.lining_print` points at, so it prints on INTERIOR & LINING / LINING ARTWORK; its called-out features become the style pack's `interior.layout`. It no longer prints as a component sheet.
- **Golden:** the study's lining sheet is entered that way. The style pack gains a LINING / PRINT ARTWORK page; the component sheets keep their original numbers (one number is now skipped).

## V2.1 step 6 — packaging, vocabulary, library
### Packaging, labels and compliance pages (§8)
- Five optional sections, **off by default for every brand**, switched on per pack like the other optional sections (`optional.<id>`): `pkg.hangtag`, `pkg.coo_label`, `pkg.warranty_card`, `pkg.polybag`, `pkg.carton_label`.
  - Hangtag: size, construction (flat / fold-over), paper, coating notes, PMS colours, front / inside / back copy, UPC placeholder (FPO), RN #, COO line, bilingual Prop 65, licensor TM line, artwork.
  - COO label: size, content line, RN #, made-in line (EN / FR), other copy, placement, artwork.
  - Master carton label: labels per carton, label size, minimum SKU text size (pt, ≥ 80), placement, field list, field values, artwork.
  - Warranty card: size, paper, copy, artwork. Poly bag: size, material / gauge, closure, vent holes, suffocation warning, other print, artwork.
- Each switched-on item prints its own PACKAGING & LABELS page after the swatch cards: the piece at its stated size with dimension lines (ACTUAL SIZE when it fits, else reduced and said so; "SIZE NOT GIVEN" otherwise), its artwork or "ARTWORK TO BE PROVIDED", and a table of its answers.
- "To be provided" is the reference answer (`TO_BE_PROVIDED`): accepted at PROTO, blocks PRODUCTION like any other.
- **Decision:** switching is per pack only for now. A brand or retailer default (switch on for every new pack of that brand / retailer) is a small follow-up — listed for Jon.
- **Golden:** the studies' proposed `_new.packaging.*`, `_new.labels.interior_coo` and `_new.brand.rn_number` switch the pages on and fill them; `_new.packaging.artwork_status: TO BE PROVIDED` becomes the artwork's reference answer.
