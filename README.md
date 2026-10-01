# Icon Tech Pack Studio

Internal tool: product render + click-through spec questions → factory-ready tech pack (PDF, AI/EPS/SVG line art, PSD artwork).

Spec: `docs/BRIEF.md`. Build plan and rules: `CLAUDE.md`.

## Status

**Phase 1 — Foundation: built.** Auth with roles, Postgres schema, uploads, brands, materials / swatch-card library (AI card reading), hardware library (bulk CSV/XLSX + images import, next-code assignment), print artwork library, new-pack setup, the full Part 3 question bank for all 16 categories, AI pre-fill from the render ("AI-suggested — confirm" / "EST — confirm" / "INFERRED — confirm").

Phase 2 (PDF + validation gate + spell-check) is not started.

## Local development

```bash
npm install
cp .env.example .env.local      # fill DATABASE_URL, AUTH_SECRET, SEED_ADMIN_*
npm run db:migrate
npm run db:seed                 # launch brands + first admin
npm run dev
```

Without `BLOB_READ_WRITE_TOKEN`, uploads are written to `.data/uploads` (development only).
Without `ANTHROPIC_API_KEY`, AI pre-fill and swatch reading show a "not configured" message; everything else works by hand.
`AI_FIXTURE_DIR=tests/fixtures/ai` serves canned AI responses for tests — never set it in Vercel.

## Tests

```bash
npm test                        # unit tests (question bank, code assignment, AI normalisation, import)
npm run test:e2e                # Phase 1 acceptance: PINK013 entered end to end
```

The e2e test needs a Postgres database (`TEST_DATABASE_URL`, default `postgres://postgres@localhost:5433/techpack_test`; it is wiped each run) and the confidential reference pack at `reference/PINK013-A_B_JODIE_SATCHEL.pdf` (ask Jon; `pdfimages` from poppler extracts the render and swatch cards). Set `CHROME` to a Chromium binary if Playwright's own isn't installed.

## Deploying (Vercel project `techpack`)

Environment variables: `DATABASE_URL` (Neon), `AUTH_SECRET` (32+ chars), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5-5`), `BLOB_READ_WRITE_TOKEN`, `IMAGE_API_KEY` (Phase 3). `vercel-build` runs migrations before `next build`. Run `npm run db:seed` once against the production database to create the brands and first admin.
