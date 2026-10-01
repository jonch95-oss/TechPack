# ICON TECH PACK STUDIO — BUILD PROMPT

Paste this whole document into the builder (Claude Code or v0) as the brief for a new Vercel project.
Part 1 is the product spec. Part 2 is the runtime system prompt for the in-app "Technical Designer" agent. Part 3 is the click-through question bank per category. Part 4 is the page templates. Part 5 is the validation rules. Part 6 is the acceptance tests.

---

## PART 1 — PRODUCT SPEC

### 1.1 What it is
This is an internal web app for the Icon Luxury Group design team. A designer uploads a single product render (the "CAD") and answers a click-through question set for the item's category. The app then produces a complete, factory-ready tech pack in the ICON template, together with editable vector line art and the artwork files.

The output is used only for producing files. The app never sends anything to factories.

### 1.2 Users and auth
- The current users are Ella, Emily and Blair. The team will grow.
- Use email login with roles. **Admin** manages users, brands and libraries. **Designer** creates and edits packs. **Viewer** has read-only access.
- "Sent by" on every pack is filled automatically from the logged-in user.
- Every edit records who made it and when.

### 1.3 Brands
There is one ICON template, and the brand is swapped by a field. The brand logo appears in the masthead and is the only visual differentiator.

Brands at launch:
- Pink London
- Off-White
- Palm Angels
- PLAY Palm Angels
- L/AB c/o Off-White
- Ted Baker
- Champion

An admin uploads each brand's logo (SVG preferred) and sets its style/code prefix. For example, Pink London uses `PINK` and Ted Baker uses `TB`.

### 1.4 Categories
- Handbags
- SLGs
- Hardside luggage
- Softside luggage
- Duffels
- Rolling duffels
- Men's bags
- Belts
- Cosmetic bags
- Toiletry kits
- Coolers / insulated
- Packing cubes
- Neck pillows
- Hardware
- Decorative hardware
- Print artwork

Each category has its own question bank (Part 3) on top of a common block.

### 1.5 Languages
English is the default. A per-pack toggle adds **Chinese (Simplified)**. When it is on, every callout, comment, table header and instruction is printed bilingually: English on top, Chinese underneath in a smaller size.

Translation uses a fixed trade glossary maintained by the admin, for example:
- 边油 for edge paint
- 磁扣 for magnetic snap
- 里布 for lining
- 五金 for hardware
- 同色 for DTM

The glossary takes priority over machine translation.

### 1.6 Core flow
1. **New pack.** The designer picks brand and category, and enters style #, style name and colorway suffixes (-A, -B …). Designers assign style numbers; the app does not.
2. **Upload render.** A single image is the expected input. Optional extras are reference photos, construction reference photos, a physical-sample note and swatch-card photos.
3. **AI pre-fill.** The Technical Designer agent (Part 2) reads the render and pre-answers every question it can see. It marks each pre-filled answer "AI-suggested — confirm". The designer confirms or changes each one with a click.
4. **Click-through questions.** Every question is a chip, toggle, dropdown, stepper or library picker. Free text is allowed only in "Other" and Comments.
5. **Line art.** The app generates flat technical line drawings from the render (see 1.7). The designer can edit them.
6. **Auto-callouts.** Dimension lines, numbered material callouts (yellow circles) and lettered comments (red circles) are placed automatically. The designer can drag, edit or delete any of them.
7. **Validation gate** (Part 5). Export is blocked until all required fields pass. A checklist shows what is missing.
8. **Export.** The app produces:
   - a PDF tech pack;
   - the line art as AI, EPS and SVG;
   - raster artwork (lining repeats, colorway renders) as layered PSD;
   - all of the above as a ZIP.

### 1.7 Line art (render → editable flats)
- **Generation.** An image-generation model converts the render into a technical flat. The flat is an orthographic view with a black ~1 pt outline, white fill, dashed stitch lines and no shading, texture or colour.
  - The front view is generated first. The back view is generated second and labelled **"INFERRED — CONFIRM"** until the designer approves it.
  - Side and top views are generated on request.
  - Claude does not generate images. The image step needs a separate image-generation API key (OpenAI or Google). Store it as a Vercel environment variable.
- **Vectorise.** Trace the result to clean SVG (potrace or an equivalent). Close the paths, separate stitch lines into their own layer, and simplify nodes.
- **Edit.** Build an in-browser SVG editor (Paper.js or Fabric.js) with these tools:
  - select and move nodes;
  - delete or add path;
  - draw line, curve and dashed stitch line;
  - mirror;
  - re-trace region;
  - undo/redo;
  - layer panel (outline / stitching / hardware / callouts / dimensions).
- **Scale.** Once overall H × W (× D) are entered, scale the flat so its bounding box matches. All auto-placed dimension lines then read true.
- **Recolour.** The colorway renders on the "Enlarged CAD" page come from the original render, not from the flat. If only one colourway render exists, show the flat filled with the material colour as the other colourway preview. Label that preview "COLOUR INDICATIVE".

### 1.8 Libraries (persistent, shared, admin + designer editable)
**Materials / swatch cards**
- Fields:
  - supplier (e.g. Junfa Leather, Jinxin Leather);
  - card / article name and number (e.g. `AH316HB-P`);
  - colour number and name (e.g. `#24 IRIDESCENT PINK`, `401HB BLACK`);
  - composition;
  - thickness;
  - width;
  - finish / texture;
  - card photo, with a cropped chip highlighted by a red box;
  - styles it is used in.
- On upload, the agent reads the printed spec on the card, including Chinese. For example, the Junfa card reads 品名 镜面A / 成分 50%TPU 50%棉 / 厚度 0.85mm±0.05 / 幅宽 138-140cm. These values are pre-filled and marked "AI-read — confirm".
- No prices are stored. Costing is left to the factory.

**Hardware / trims**
- Fields:
  - code;
  - brand;
  - type;
  - dimensions (mm);
  - views (front / side / rear) at 100% scale;
  - material;
  - finish;
  - logo treatment;
  - enamel colour (Pantone);
  - hollow or solid;
  - photo;
  - styles it is used in.
- Types: logo plate, deboss/emboss patch, zipper pull, zipper (tape, teeth, size, type), magnetic snap, press snap, turnlock, D-ring, O-ring, square ring, swivel hook, lobster clasp, chain, buckle, rivet, feet, keychain/charm, woven label, TPU/rubber patch, wheel, trolley handle, lock.
- Existing hardware is bulk-imported from a CSV or XLSX plus an images folder.
- **Code assignment for new components.** New components get the next free number in the brand's existing format.
  - Example: Pink London uses `PINK` + 3 digits (PINK003, PINK004, PINK005).
  - The app checks used numbers across both components and style numbers in that brand, so the two never collide.
  - The admin can override the format per brand.

**Print / lining artwork**
- Fields:
  - name;
  - brand;
  - motif;
  - repeat type;
  - tile size;
  - colours (Pantone C / TCX);
  - application method;
  - base fabric;
  - source files (AI/EPS/PSD).

### 1.9 Revisions
- The original date is set on first export.
- R1–R4 (and beyond) are each stamped with a date and author, plus an automatic change log ("strap length 120 → 125 cm; logo changed to TPU").
- Changed items are flagged `*UPDATED*` in red on the pages where they appear, as on PINK013.
- Earlier revisions stay downloadable.

### 1.10 Stack
- Next.js (App Router) on Vercel.
- Auth.js or Clerk for authentication.
- Postgres (Neon via Vercel Marketplace) for the database.
- Vercel Blob for files.
- Anthropic API for the spec, vision, validation and translation. Use the current most capable Claude model, set by an environment variable.
- A separate image API for line art.
- PDF: render the page templates to HTML/SVG and print with headless Chromium (`puppeteer-core` + `@sparticuz/chromium`). Flats stay vector inside the PDF.
- Export formats:
  - **AI:** PDF-compatible `.ai` output, which opens in Illustrator.
  - **EPS:** converted from SVG on the server.
  - **PSD:** layered, built with `ag-psd`.
- Environment variables: `ANTHROPIC_API_KEY`, `IMAGE_API_KEY`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, auth secrets.

---

## PART 2 — RUNTIME SYSTEM PROMPT ("TECHNICAL DESIGNER" AGENT)

Use the text below verbatim as the system prompt for every Claude call inside the app.

```
You are the senior technical designer for Icon Luxury Group. You turn a product render plus a designer's answers into a factory-ready tech pack for Asian factories making handbags, SLGs, luggage, travel accessories, coolers, belts, hardware and print artwork for licensed brands (Pink London, Off-White, Palm Angels, PLAY Palm Angels, L/AB c/o Off-White, Ted Baker, Champion).

Your reader is a factory pattern-maker who will build a proto from this pack alone. Every ambiguity costs a sample round. Write for that reader.

RULES
1. Never invent a measurement. Use only dimensions the designer entered or that are mathematically derivable from them. Anything you estimate from the render is marked "EST — CONFIRM" and cannot pass validation until confirmed.
2. When you read the render, pre-fill answers and tag each "AI-suggested". Say what you saw ("2 snaps visible under flap") — do not guess what you cannot see. The back view, interior and underside are never visible in a single front render: mark them "INFERRED — CONFIRM".
3. Use standard trade terminology and the Icon glossary. Correct spelling in everything you output and in anything the designer types (e.g. CLOURE→CLOSURE, RECIEVE→RECEIVE, IRRIDESCENT→IRIDESCENT, INGRAIVED→ENGRAVED, CHAMPANGE→CHAMPAGNE). Show each correction for one-click accept.
4. Output in CAPITALS for callouts, comments and table entries, matching Icon house style. Units as the designer set them (cm or inches); hardware always in mm.
5. Material callouts are numbered yellow circles (1, 2, 3…) — one number per distinct material, reused everywhere that material appears on every view. Comments are lettered red circles (A, B, C…), each a single instruction, referenced on the pages it concerns ("SEE PG 2/8").
6. "DTM" means dyed to match the body material of that colourway. Use it for edge paint, thread, zipper tape and lining where appropriate.
7. Every colorway must specify every numbered material, lining, edge paint, hardware finish, zipper (tape + teeth) and logo. Never leave a cell blank — use DTM, N/A, or flag it missing.
8. Cross-check the geometry (see validation rules) and report conflicts plainly, e.g. "Flap height 7.5 cm + body below flap must equal 16 cm total height — body below flap not set."
9. If the Chinese toggle is on, translate using the glossary first; keep codes, Pantone numbers and measurements untranslated.
10. Do not add costing, prices, MOQ or lead times. Do not add lab-testing, care-label or packaging requirements unless the designer turned those sections on.
11. Return structured JSON matching the TechPack schema. No prose outside the JSON except in "agent_notes".

TASKS YOU ARE CALLED FOR
- analyse_render: return pre-filled answers + list of visible features + list of what cannot be seen.
- read_swatch_card: extract supplier, article, colour no., composition, thickness, width from a card photo (incl. Chinese text) and locate the chip.
- build_pack: from confirmed answers, produce page content: callout lists, comment text, colorway table, measurement list, product-features list, interior layout, artwork specs.
- validate: run the rules in Part 5 and return pass/fail per rule with the fix needed.
- diff_revision: compare two versions and write the change log + *UPDATED* flags.
- translate: bilingual output per glossary.
```

### 2.1 TechPack JSON schema (minimum)
```json
{
  "header": {"brand":"","style_no":"","style_name":"","description":"","category":"","sub_category":"",
             "retailer":"","season":"","attn":"FTY","sent_by":"","original_date":"","revisions":[{"r":"R1","date":"","by":"","changes":[]}],
             "due_date":"","reference_sample":"","physical_sample_to_follow":false,"proto_colorways":["-A","-B"]},
  "dimensions": {"unit":"cm","height":0,"width":0,"depth":0,"extra":[{"label":"TOP HANDLE DROP","value":0}],"status":"confirmed|est"},
  "materials": [{"callout":1,"name":"MAIN BODY MTL","locations":["FRONT","BACK","FLAP","GUSSET","STRAP"]}],
  "colorways": [{"code":"-A","name":"","cells":{"mat_1":{"library_id":"","text":""},"lining":"","edge_paint":"DTM","hardware_finish":"","zipper":"","logo":""}}],
  "hardware": [{"code":"","type":"","qty":0,"dims_mm":"","finish":"","placement":"","new":false}],
  "branding": [{"type":"","code":"","size_mm":"","placement":"","position_ref":"","finish":""}],
  "construction": {},
  "interior": {},
  "artwork": [],
  "comments": [{"letter":"A","text":"","pages":[1,2]}],
  "product_features": [],
  "optional_sections": {"tolerances":null,"stitching":null,"reinforcement":null,"labels":null,"packaging":null,"testing":null},
  "validation": [{"rule":"","status":"pass|fail","fix":""}],
  "agent_notes": ""
}
```

---

## PART 3 — CLICK-THROUGH QUESTION BANK

Use these UI conventions:
- **[chips]** = single select.
- **[multi]** = multi-select.
- **[toggle]** = yes/no.
- **[stepper]** = number with unit.
- **[lib]** = library picker with a "+ New" option.

Every chip set ends with "Other…". Fields marked ★ are **required** and block export.

### 3.0 COMMON BLOCK (all categories)

**Header**
- ★ Brand [chips + logo]
- ★ Style # [text]
- ★ Style name [text]
- ★ Description [auto-drafted, editable]
- ★ Category / sub-category [chips]
- Retailer [chips: TJX/Marshalls, TJ Maxx, HomeGoods, Sierra, Winners, Bealls, Ross, Burlington, Other]
- Season [chips]
- ★ Due date [date / ASAP]
- Reference sample [text + photo]
- Physical sample to follow [toggle]. When on, print the red banner "YOU WILL RECEIVE A PHYSICAL SAMPLE IN SIMILAR SIZE AND SIMILAR MATERIAL".

**Dimensions**
- ★ Unit [cm / inches]
- ★ H [stepper]
- ★ W [stepper]
- ★ D [stepper]
- Show the secondary unit in brackets [toggle]

**Colorways**
- ★ Number of colorways [stepper]
- ★ Suffix per colorway [auto: -A, -B, -C]
- Colorway name [text]

**Materials**
- ★ Materials [auto-detected list from the render; add, remove or rename]. Each one gets a callout number.
- ★ Per colorway, per material [lib: swatch card + colour no. / DTM].

**Branding**
- ★ Logo type [chips]:
  - metal logo plate
  - deboss patch
  - emboss
  - tonal heat stamp
  - foil heat stamp (gold / silver / gunmetal / other)
  - print
  - woven label
  - TPU / rubber patch
  - embroidery
  - enamel badge
  - engraved hardware
  - metal lettering
- ★ Logo code [lib]
- ★ Logo size [mm]
- ★ Placement [chips: centered on flap, centered on front panel, bottom-right, top-left, on strap, on pull, Other]
- ★ Offset [mm from the nearest edge]
- Fill/inlay colour [lib / Pantone]

**Edge finish**
- ★ Edge treatment [chips: edge paint, turned edge, piping, binding, raw / heat-sealed]
- ★ Edge paint colour [chips: DTM, contrast + colour, BLACK]

**Hardware**
- ★ Hardware finish [chips:
  - shiny champagne gold
  - light gold
  - antique brass
  - gunmetal
  - shiny nickel
  - matte black
  - rose gold
  - Other]
- ★ Hardware items [lib, multi + qty each]
- New item → [wizard]:
  - type
  - dimensions
  - views
  - material [zinc alloy / brass / iron / plastic w/ metal finish / aluminium]
  - logo treatment
  - enamel colour
  - hollow/solid
  - Code is auto-assigned.

**Interior** (where the item has one)
- ★ Lined [toggle]
- ★ Lining material [lib]
- ★ Lining artwork [lib print / plain / Pantone]
- ★ Pockets [multi, each with W × H and position]:
  - slip pocket
  - zip pocket (zip size)
  - phone pocket
  - card slots (qty)
  - pen loop
  - key leash
  - mesh pocket
  - elastic loops (qty)
- ★ Pocket edge [chips: binding, turned, folded]
- ★ Interior label [lib + size + offset from pocket top]
- Interior binding on seams [toggle]
- Compartments [stepper]

**Comments and references**
- Reference photos [upload; each gets a lettered red callout]
- Construction references [upload]
- Free comments

**Optional sections** (collapsed, off by default; turn on per pack)
- Tolerances
- Stitching (SPI, thread size and colour)
- Reinforcement / interlining
- Care and content labels
- Packaging (dust bag, stuffing, poly bag, hangtag, carton)
- Testing / compliance

### 3.1 HANDBAGS
- ★ Silhouette [chips]:
  - satchel
  - top-handle
  - tote
  - shoulder
  - crossbody
  - hobo
  - bucket
  - baguette
  - clutch
  - camera
  - saddle
  - belt bag
  - backpack
  - mini / micro
- ★ Structure [chips: soft, semi-structured, structured]
- ★ Closure [chips]:
  - flap + magnetic snap (qty, spacing)
  - flap + press snap
  - turnlock
  - top zip (zip size and type)
  - open top + magnetic snap
  - drawstring
  - kiss-lock
  - toggle
  - none
- Flap [chips: full, half, envelope, rounded, squared]
- Flap height [stepper]
- Flap overhang [stepper]
- ★ Top handle [toggle]. If on:
  - qty
  - ★ drop
  - width
  - style [flat, rolled, doubled/bonded, chain, chain + leather]
  - attachment [D-ring, O-ring, loop, rivet tab, swivel]
- ★ Shoulder/crossbody strap [toggle]. If on:
  - ★ removable or fixed
  - ★ width
  - ★ total length
  - ★ adjustable [toggle → adjustment range + hole count or buckle/slider]
  - drop
  - material [same as body, chain, webbing, combo]
  - ★ attachment hardware [swivel hook, D-ring, side loop, rivet]
- ★ Gusset [chips: standard (no pleats), pleated, accordion, boxed, none]
- ★ Gusset width = D
- Base [chips: flat, boarded]
- Feet [toggle → qty + code]
- Exterior pockets [multi + size]
- Quilting / embellishment [chips + spec]
- Charm or keychain included [toggle → lib code]

### 3.2 SLGs
- ★ Type [chips]:
  - card case
  - bifold
  - trifold
  - zip-around
  - continental
  - coin purse
  - wristlet
  - pouch
  - key case
  - passport holder
  - phone case/pouch
  - lanyard ID
- ★ Card slots [stepper]
- Bill compartments [stepper]
- Coin pocket [toggle + zip]
- ID window [toggle + size]
- ★ Closure [chips: zip-around, snap tab, none, magnetic]
- Wrist strap [toggle → removable, length, hook]
- ★ Folded and open dimensions (for folding styles)

### 3.3 HARDSIDE LUGGAGE
- ★ Size [chips]:
  - carry-on 20"
  - carry-on 21"
  - medium 24/25"
  - large 28/29"
  - set (select sizes)
- ★ Shell [chips: PC, ABS, ABS+PC, PP, aluminium]
- Shell finish [chips: matte, gloss, textured, embossed pattern, printed]
- ★ Wheels [chips: 8 double spinner, 4 single spinner, 2 inline]
- Wheel diameter [mm]
- ★ Trolley handle [chips: aluminium single tube, aluminium double tube]
- Trolley stages [stepper]
- Max height [stepper]
- ★ Lock [chips: TSA combo zip lock, TSA frame latch, none]
- ★ Closure [chips: zipper, aluminium frame]
- Expandable [toggle → mm]
- ★ Carry handles [multi: top, side, bottom + type]
- Interior [multi]:
  - zip divider panel
  - cross/compression straps
  - mesh pocket
  - shoe bag
  - wet pocket
- Corner guards [toggle]
- Feet [qty]
- Branding [chips: metal badge on shell, embossed shell, printed]
- Carry-on: automatic check of overall size (including wheels and handles) against airline carry-on limits, with a warning.

### 3.4 SOFTSIDE LUGGAGE
Same as 3.3, except:
- ★ Body fabric [lib + denier]
- Front pockets [multi]
- Expansion zip [toggle]
- Base [chips: soft, boarded, hard tub]

### 3.5 DUFFELS
- ★ Size L × W × H; capacity in litres is auto-computed
- ★ Main closure zip [size #8/#10, coil / metal / molded, double slider [toggle], lockable pulls [toggle]]
- ★ Grab handles [chips: wrap, separate]
- Handle length [stepper]
- Handle drop [stepper]
- ★ Shoulder strap [removable, width, length, adjustable, shoulder pad [toggle]]
- End pockets [toggle]
- Shoe compartment [toggle + location]
- Trolley sleeve [toggle]
- Base [chips: soft, boarded]
- Feet [qty]
- ID tag [toggle + code]

### 3.6 ROLLING DUFFELS
Everything in 3.5, plus:
- ★ Wheels [qty, diameter mm, inline]
- ★ Telescopic handle [stages, max height, single or double tube, retract position]
- ★ Base type [chips: hard tub, boarded panel]
- Skid guards [toggle]
- Top, side and bottom carry handles [multi]

### 3.7 MEN'S BAGS
- ★ Type [chips]:
  - briefcase
  - messenger
  - backpack
  - sling
  - tote
  - weekender
  - Dopp kit (routes to 3.9)
- Laptop compartment [toggle → device size 13/14/15/16", padded]
- Organiser panel [multi]
- Trolley sleeve [toggle]
- Back padding [toggle]
- Straps and handles as in 3.1 / 3.5

### 3.8 BELTS
- ★ Width [mm]
- ★ Size run [chips: S-M-L-XL, waist 28–44, one size]
- ★ Measuring rule: fold to centre hole
- ★ Length per size [auto-graded table]
- ★ Holes [qty, spacing in mm, hole diameter]
- ★ Tip shape [chips: pointed, rounded, square]
- ★ Buckle [lib code]
- ★ Buckle attachment [chips: stitched, screw (Chicago screw), snap (interchangeable)]
- ★ Keeper [chips: fixed, floating, metal]
- Keeper material [stepper]
- ★ Construction [chips: single-ply, bonded 2-ply, stitched edge, raw edge-painted]
- Reversible [toggle → swivel buckle]
- Embossed logo on strap [toggle]

### 3.9 COSMETIC BAGS / TOILETRY KITS
- ★ Shape [chips]:
  - dome
  - box / Dopp
  - flat pouch
  - train case
  - hanging
  - trapezoid
- ★ Zip [size #3/#5/#8, type (coil / metal / molded / plastic with metal finish), tape colour, teeth colour, path (top, around, 3-sided)]
- ★ Puller [lib code]
- Side handle [toggle → width, doubled]
- ★ Lining [chips: printed poly (lib), PEVA, TPU-coated waterproof, plain]
- ★ Interior pockets [multi: mesh, zip, elastic loops]
- Padding [toggle → thickness in mm, all-over or panels]
- Hanging hook [toggle]
- Frame opening (train case) [toggle]

### 3.10 COOLERS / INSULATED (Champion, Ted Baker)
- ★ Type [chips]:
  - soft cooler tote
  - backpack cooler
  - lunch bag
  - lunch tote
  - bottle bag
  - wine tote
  - hard cooler
- ★ Capacity [cans qty and litres]
- ★ Insulation [chips: EPE foam, closed-cell PE, PU foam]
- Insulation thickness [mm]
- ★ Liner [chips: PEVA food-safe, TPU, aluminium foil laminate]
- ★ Seams [chips: RF/heat-welded leakproof, stitched + taped, stitched]
- ★ Opening [chips: zip top, flip lid, roll top]
- Waterproof zip [toggle]
- Bottle opener [toggle + code]
- Exterior pockets [multi]
- Strap and handles as in 3.5
- ★ Licensor approval fields [licensor, submission #, status]
- Cold-retention claim [toggle → hours]. If on, validation warns: "claim requires test report".

### 3.11 PACKING CUBES
- ★ Set composition [stepper per size + dimensions each]
- ★ Body fabric [lib + denier]
- Mesh panel [toggle + position]
- Compression zip [toggle]
- Double-slider zip [toggle]
- Grab loop [toggle]
- Label window [toggle]
- Nesting order [auto]

### 3.12 NECK PILLOWS
- ★ Shape [chips: U, J, hooded, wrap]
- ★ Fill [chips: memory foam (density), microbeads, inflatable, fibre]
- ★ Cover [chips: velour, jersey, minky, other]
- Removable cover [toggle → zip]
- ★ Front closure [chips: snap strap, toggle, none]
- Luggage clip / strap loop [toggle]
- Carry pouch [toggle → compression size]

### 3.13 HARDWARE (product or component sheet)
- ★ Type [lib types]
- ★ Views to draw [multi: front, side, rear, top]
- ★ Drawing scale: 100%
- ★ Overall dims [mm]
- ★ Detail dims [auto-callouts on the drawing]
- ★ Material [chips]
- ★ Finish [chips]
- ★ Logo treatment [chips]:
  - engraved
  - debossed groove
  - embossed
  - enamel inlay (colour)
  - laser
  - inked metallic logo
- Hollow sections [toggle + where]
- Edge [chips: bevelled, rounded, square]
- Etched side pattern [toggle]
- Attachment [chips: screw, rivet, prong, sewn tab]

### 3.14 DECORATIVE HARDWARE (charms, keychains, chains, studs)
- ★ Components [multi + qty, e.g. lobster clasp (size), chain (link type, link size, length), split ring, pendant]
- Pendant [shape, dims, enamel colours (Pantone each), logo]
- ★ Finish [chips]
- ★ Attachment to the product [chips: clipped to D-ring, sewn tab, loose in bag]

### 3.15 PRINT ARTWORK
- ★ Motif [upload logo/art, or text + font]
- ★ Repeat [chips: straight, half-drop, brick, diagonal, mirror, tossed]
- ★ Tile size [W × H, e.g. 10 × 10 cm]
- Motif scale [mm]
- ★ Colours [Pantone C / TCX each]
- ★ Application [chips: digital print, screen print, heat transfer, tonal heat stamp, foil stamp, jacquard, deboss, emboss]
- ★ Base fabric [lib]
- ★ Placement [chips: all-over, engineered/placed (position + size)]
- Outputs:
  - vector tile (AI/EPS/SVG)
  - layered PSD tile
  - full-page repeat preview with the red tile box and dimensions

---

## PART 4 — PAGE TEMPLATES (ICON house style)

Page specs:
- 17 × 11 in landscape, 300 dpi equivalent, vector where possible.
- Font: Helvetica Neue Condensed Bold (or Arial Narrow Bold as a fallback).
- All callouts in capitals.
- Footer and page tag at top-right: "PAGE n/N" + section name.

Pages are generated in this order, and empty pages are skipped:

1. **MATERIALS / HARDWARE**
   - Masthead table:
     - ICON LUXURY GROUP block
     - brand logo
     - ATTN, retailer, season, reference sample (red), description
     - original date and R1–R4
     - size, sent by, due date (red), proto, category, style name
   - COMMENTS box with red lettered bubbles.
   - Optional red banner: physical sample.
   - Front and back flats with yellow material callouts and red leader lines to logo and hardware.
   - Charm or decorative hardware drawn to the side with its code.
   - Colourway thumbnails on the right, labelled with style + suffix.
   - Bottom: MATERIAL / COLOUR BREAKDOWN table with these columns:
     - CWY
     - one column per numbered material
     - LINING
     - EDGE PAINT
     - ZIPPER (if any)
     - HARDWARE & SNAP
     - LOGO

     Each cell refers to swatch pages ("SEE PG 7/8").
2. **PRODUCT FEATURES**: front 3/4 render with overall dims in red, plus a bulleted feature list (Ted Baker style). Included when the toggle is on (default on).
3. **MEASUREMENTS SHEET**:
   - large front flat with all red dimension lines;
   - handle drop, strap length and flap height;
   - logo offset;
   - closure detail photo with a red arrow and letter;
   - side view showing gusset and strap attachment;
   - note on gusset type.
4. **ENLARGED CAD**: one large render per colourway.
5. **REFERENCE PHOTOS FOR CONSTRUCTION**: uploaded photos, with circular red zoom-ins referencing comment letters.
6. **INTERIOR & LINING**:
   - interior wall layout(s) with pocket size, pocket offset from top, binding, label size and offset;
   - hatched version and lining-artwork version side by side.
7. **LINING / PRINT ARTWORK**: full repeat, red tile box with dims, Pantone/TCX chips, fabric spec, and a reference photo of the application method.
8. **HARDWARE / BRANDING DETAIL**: one panel per custom component, with:
   - "SIZE 100%" tag;
   - multi-view drawings;
   - full mm callouts;
   - finish and enamel callouts;
   - logo patch with mm dims.
9. **SWATCH CARD PAGES**: one per colourway material. Each shows:
   - the card photo with a red box on the chip;
   - a yellow callout number;
   - supplier, article and colour;
   - "FOR REFERENCE [STYLE-SUFFIX] ONLY" in red.
10. **CHANGE LOG** (only when revisions exist).

---

## PART 5 — VALIDATION RULES (the gate before export)

**Completeness**
- All ★ fields are confirmed. None are left "AI-suggested" or "EST".
- Every material × colourway cell is filled.
- Every hardware item has a code, dimensions and finish.
- Every comment letter appears on at least one drawing.

**Geometry**
- Flap height ≤ body height.
- Body panel heights sum to total H.
- Pocket W ≤ interior wall W − 2 cm, and pocket H ≤ wall H − top offset.
- Logo size + offset fits inside the panel it sits on.
- Handle drop > 0 and plausible for the category: handbag top handle 5–20 cm, duffel 15–30 cm.
- Strap total length ≥ 2 × drop.
- Gusset width = D.
- Belt lengths grade evenly.
- Carry-on size is within airline limits.

**Consistency**
- Every material number appears on the flats and in the table.
- Hardware finish matches across handle rings, snaps, logo and charm unless deliberately overridden.
- The units are consistent throughout.
- Page cross-references (e.g. "SEE PG 6/8") point to the right page after page skipping.

**Language**
- Spell-check runs against the trade dictionary.
- All callouts are in capitals.
- With Chinese on, every English line has a Chinese line.

**Licensor**
- Champion and Ted Baker packs have the licensor approval fields completed.

**Claims**
- Cold-retention, waterproof or leakproof claims raise a warning that a test report is needed.

Each failure shows the exact fix required, with a one-click jump to the field.

---

## PART 6 — ACCEPTANCE TESTS

Ship only when both reference packs reproduce from their render plus click answers alone:

1. **PINK013 "JODIE" (Pink London satchel)**
   - 16 × 20 × 8 cm.
   - 6.5 cm handle drop.
   - Flap 7.5 cm, with 2 magnetic snaps spaced evenly.
   - Fixed shoulder strap on side loops with swivel hooks.
   - Standard gusset with no pleats.
   - TPU logo plate centred 1.5 cm above the flap edge. Reference PINK005, shiny champagne gold.
   - Keychain PINK003.
   - Lining in tonal heat-stamp PINK repeat, 10 × 10 cm tile, Pantone 203 C.
   - Back-wall slip pocket 14 cm wide, 2.5 cm from the top, with binding.
   - PINK004 woven label 4 × 2 cm, 1.5 cm below the pocket top.
   - Colourway -A: Junfa smooth PU #2 iridescent black.
   - Colourway -B: Junfa smooth PU #24 iridescent pink.
   - Edge paint DTM.
2. **TB25_ACC023 (Ted Baker gingham PU men's Dopp kit)**
   - 10.25 × 4.25 × 5.25 in.
   - Gingham-effect PU body: Jinxin AH316HB-P (401HB black, 823HB brown, 609HB navy).
   - Smooth PU trim.
   - #8 plastic zip with metal finish and gunmetal teeth. Black tape on Black; DTM tape on the others.
   - Doubled 22 mm PU handle.
   - All PU edge-painted black.
   - PU deboss logo patch 55 × 21.8 mm with gunmetal fill.
   - Zipper pull 16 × 42 mm, gunmetal:
     - embossed enamel inlay DTM;
     - metallic logo inked;
     - bevelled and hollow;
     - etched sides;
     - 100% scale drawing.
   - Interior:
     - 190D poly lining with heat-seal texture, repeat 20.8 mm / 0.55";
     - colours Black and 17-3914 TCX Sharkskin;
     - #5 nylon coil zip pocket on side 1;
     - interior binding;
     - 1 mm padding all over.
3. **Spell-check** must flag CLOURE, RECIEVE, IRRIDESCENT and INGRAIVED, all of which appear in the source packs.
4. **Bilingual export** of PINK013 must render cleanly with Chinese under every English line.
5. **Revision test:** changing the PINK013 logo from metal to TPU must produce R1 with "*UPDATED*" on pages 1 and 2, plus a change-log entry.
