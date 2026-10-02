# Icon Tech Pack Studio

Internal tool: product render + click-through spec questions → factory-ready tech pack (PDF, AI/EPS/SVG line art, PSD artwork).

Spec: `docs/BRIEF.md`. Build plan and rules: `CLAUDE.md`.

## Status

**Phase 1 — Foundation: built.** Auth with roles, Postgres schema, uploads, brands, materials / swatch-card library (AI card reading), hardware library, print artwork library, new-pack setup, the full Part 3 question bank for all 16 categories, AI pre-fill from the render ("AI-suggested — confirm" / "EST — confirm" / "INFERRED — confirm").

**Library uploads:** hardware and swatch cards can be added from the Excel templates (Library → Add in bulk → Download template), any CSV/XLSX (pictures pasted into cells come across), PDFs read by the AI, or a batch/folder of photos — all reviewed in a table with call-outs before saving. Component codes are entered by designers and checked against every component and style number.

**Phase 2 — Tech pack PDF: built.** Icon template pages (Part 4) at 17 × 11 in from `/api/packs/:id/pdf`, the Part 5 validation gate (export blocked until it passes; `?draft=1` gives a watermarked draft any time), and spell-check against the trade dictionary with one-click corrections. Until Phase 3 adds line art, the CAD render stands in for the flats and dimensions are listed rather than drawn.

**Technical-designer additions: built.** Points of measure with tolerances and how-to-measure (templates per silhouette, house tolerances), hardware placement in mm, full zipper spec, construction details with cross-sections / stitch / SPI / thread / allowance, material direction and pattern matching, every interior wall + base board, bill of materials (quantities only — no prices), content-label text from library compositions, hardware finish spec (plating, coating, nickel-free, mould), logo artwork + tool depth + new-tooling flag. Lab-dip / strike-off / plating / mould approvals in the libraries (packs warn on anything not approved). Pack status with second-designer sign-off before the final PDF (editing a signed-off pack sends it back to draft), dashboard filters by status and due date, duplicate pack, factory + factory Q&A log, and a sample review log (PROTO / SMS / PP / TOP) with lettered photo mark-up; open comments carry into the next round and print on a SAMPLE COMMENTS page.

First sign-in: the deploy seeds `jonc@iconluxurygroup.com` as admin with the password in `SEED_ADMIN_PASSWORD`; it must be changed at first sign-in.

## Local development

```bash
npm install
cp .env.example .env.local      # fill DATABASE_URL, AUTH_SECRET, SEED_ADMIN_*
npm run db:migrate
npm run db:seed                 # launch brands + first admin
npm run dev
```

Without `BLOB_STORE_ID`, uploads are written to `.data/uploads` (development only). Either way files are served only to signed-in users through `/api/files/…`.
Without `ANTHROPIC_API_KEY`, AI pre-fill and swatch reading show a "not configured" message; everything else works by hand.
`AI_FIXTURE_DIR=tests/fixtures/ai` serves canned AI responses for tests — never set it in Vercel.

## Tests

```bash
npm test                        # unit tests (question bank, code assignment, AI normalisation, import)
npm run test:e2e                # library uploads; PINK013 entered end to end (Phase 1); PDFs page for page + gate + spell-check (Phase 2)
```

The e2e test needs a Postgres database (`TEST_DATABASE_URL`, default `postgres://postgres@localhost:5433/techpack_test`; it is wiped each run) and the confidential reference pack at `reference/PINK013-A_B_JODIE_SATCHEL.pdf` (ask Jon; `pdfimages` from poppler extracts the render and swatch cards). Set `CHROME` (and `CHROME_PATH` for PDF export) to a Chromium binary if Playwright's own isn't installed. The TB25 assets also need ImageMagick (`convert`).

## Deploying (Vercel project `techpack`)

Environment variables: `DATABASE_URL` (Neon, pooled — runtime) and `DATABASE_URL_UNPOOLED` (migrations + seed), `AUTH_SECRET` (32+ chars), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `BLOB_STORE_ID` + `BLOB_WEBHOOK_PUBLIC_KEY` (private Blob store, authenticated with Vercel OIDC — no read-write token), `IMAGE_API_KEY` (Phase 3), and `SEED_ADMIN_PASSWORD` (temporary password for the first admin). `vercel-build` runs migrations and the seed before `next build`.
