@AGENTS.md

# Icon Tech Pack Studio

Internal app for the Icon Luxury Group design team (Ella, Emily, Blair, growing): upload a product render, answer click-through category questions, get a factory-ready tech pack (PDF + AI/EPS/SVG line art + layered PSD artwork). Hosted on Vercel (project `techpack`), auto-deploys from `main`.

**The full spec is `docs/BRIEF.md`. Read it before any work.** It has six parts: product spec, the runtime "Technical Designer" system prompt (use verbatim), the question bank per category, page templates, validation rules, and acceptance tests.

## Reference packs
The two finished reference tech packs (PINK013 Jodie satchel, TB25_ACC0023 Ted Baker Dopp kit) are confidential brand product designs and are NOT committed to this repo. Ask Jon for them and keep them in `reference/` (gitignored). Part 6 of the brief describes their contents in enough detail to build against.

## Build in phases — do not start the next until the current one passes its test
1. **Foundation:** auth with roles (admin / designer / viewer), Postgres (Neon) schema, Vercel Blob uploads, brands with logos and code prefixes, materials/swatch-card library, hardware library with bulk CSV/XLSX import and next-code assignment, print artwork library, new-pack setup, the full click-through question flow (Part 3), AI pre-fill from the render with "AI-suggested — confirm" state.
   Test: PINK013 can be entered end to end from its render with every answer in Part 6 captured.
2. **Tech pack PDF:** the Icon template pages (Part 4) rendered to vector PDF, the validation gate (Part 5), spell-check against the trade dictionary.
   Test: PINK013 and TB25_ACC0023 PDFs match the reference packs page for page; spell-check flags CLOURE, RECIEVE, IRRIDESCENT, INGRAIVED.
3. **Line art:** render → AI flat (image API) → vector trace → in-browser SVG editor → auto-callouts and dimension lines, scaled to entered H × W × D.
   Test: front flat of the Jodie render is editable and its dimension lines read 16 × 20 cm.
4. **Revisions, Chinese, exports:** R1–Rn with change log and *UPDATED* flags, bilingual EN/中文 output via glossary, AI/EPS/SVG/PSD/ZIP export.
   Test: Part 6 items 4 and 5.

## Environment variables (set in Vercel, never commit)
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `IMAGE_API_KEY`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, auth secrets.

## House rules
- Never invent measurements in generated packs; unconfirmed values block export.
- All callouts, comments and table entries in CAPITALS.
- No costing, prices, MOQ or lead times anywhere — the factory fills those.
