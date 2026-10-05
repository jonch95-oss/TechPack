# V2 question map

For review before v2 work starts (`docs/V2-SEAMLESS-BRIEF.md` §10). Every question id in the bank, for all 16 categories, with:

- **Source** — where the answer comes from in v2, highest priority first (§2): DESIGNER, SPEC, BASE STYLE, LIBRARY, HOUSE, TEMPLATE, AI, DERIVED. `A > B` means A wins over B. EST = a proportional estimate shown in the app only, never printed until settled.
- **Stage** — the stage whose export it blocks (§6): **PROTO** (and therefore production too), **PRODUCTION** only, or **never** (prints blank / TBC; never a guessed value).
- **Today** — ★ required now, ○ optional now; *hidden* = can't be seen on a front render (INFERRED today).

Generated from the live question bank by `scripts/question-map.ts` — change a rule there and re-run, so the map and the code can't drift. Mark up anything you disagree with and I'll change the rules, not the table by hand.

## Summary per category

| Category | Questions | PROTO | PRODUCTION only | never | Settled without typing at PROTO¹ | AI proposes, designer confirms¹ | Designer types¹ |
|---|---|---|---|---|---|---|---|
| Handbags | 118 | 85 | 20 | 13 | 67 | 11 | 7 |
| SLGs | 92 | 59 | 20 | 13 | 47 | 5 | 7 |
| Hardside luggage | 96 | 63 | 20 | 13 | 51 | 5 | 7 |
| Softside luggage | 99 | 66 | 20 | 13 | 53 | 6 | 7 |
| Duffels | 105 | 74 | 20 | 11 | 59 | 11 | 4 |
| Rolling duffels | 115 | 84 | 20 | 11 | 67 | 11 | 6 |
| Men's bags | 116 | 83 | 20 | 13 | 68 | 9 | 6 |
| Belts | 72 | 41 | 20 | 11 | 32 | 5 | 4 |
| Cosmetic bags | 95 | 62 | 20 | 13 | 52 | 4 | 6 |
| Toiletry kits | 95 | 62 | 20 | 13 | 52 | 4 | 6 |
| Coolers / insulated | 107 | 72 | 22 | 13 | 57 | 10 | 5 |
| Packing cubes | 72 | 39 | 20 | 13 | 30 | 5 | 4 |
| Neck pillows | 72 | 39 | 20 | 13 | 30 | 4 | 5 |
| Hardware | 50 | 19 | 20 | 11 | 11 | 3 | 5 |
| Decorative hardware | 40 | 9 | 20 | 11 | 4 | 3 | 2 |
| Print artwork | 38 | 7 | 20 | 11 | 2 | 2 | 3 |

¹ Counted over PROTO questions only, by the first source in the chain. Conditional questions (e.g. strap width only when there is a strap) are counted even though a given style shows fewer. "Designer types" includes measurements a spec sheet would fill, and SPEC > BASE STYLE chains count as AI-proposes. Since change A, "settled" includes BASE STYLE-first fields: settled when the style starts from a base style; with no base style the AI proposes them instead.

## Shared questions (every category, or several)

| Question id | Label | Kind | Today | v2 source | Stage | Note | Categories |
|---|---|---|---|---|---|---|---|
| `header.description` | Description | text | ★ | DERIVED | never | Drafted from the answers; trusted, editable, no confirm. | all |
| `header.retailer` | Retailer | chips | ○ | DESIGNER (remembers last per brand) | never | Not required for PROTO. | all |
| `header.season` | Season | chips | ○ | DESIGNER (remembers last per brand) | never | Not required for PROTO. | all |
| `header.due_date` | Due date | date_asap | ★ | DESIGNER (default ASAP) | never | Prints ASAP when blank. | all |
| `header.reference_sample` | Reference sample | text | ○ | DESIGNER (remembers last per brand) | never | Not required for PROTO. | all |
| `header.physical_sample` | Physical sample to follow | toggle | ○ | DESIGNER | never | Banner on page 1 when on. | all |
| `header.licensor` | Licensor | text | ★ | HOUSE (brand) | PRODUCTION | Asked at production only. | all |
| `header.licensor_submission` | Licensor submission # | text | ★ | HOUSE (brand) | PRODUCTION | Asked at production only. | all |
| `header.licensor_status` | Licensor approval status | chips | ★ | HOUSE (brand) | PRODUCTION | Asked at production only. | all |
| `dims.unit` | Unit | chips | ★ | HOUSE | never | Per brand (Pink London cm, Ted Baker inches); never asked. | 10 categories |
| `dims.h` | Height (H) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO | Proportional EST shown in the app only; never printed until settled. | 10 categories |
| `dims.w` | Width (W) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO | As H. | 10 categories |
| `dims.d` | Depth (D) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO | As H. | 10 categories |
| `dims.show_secondary` | Show secondary unit in brackets | toggle | ○ | HOUSE | never | Per brand; never asked. | 10 categories |
| `colorways.names` | Colorway names | per_colorway_text | ○ | AI > DESIGNER | PROTO | Count and names read from the render / board. | all |
| `materials.list` | Materials (each gets a yellow callout number) | materials | ★ | AI + SPEC | PROTO | Fabrics and leathers only; hardware and zippers never numbered. | 13 categories |
| `materials.matrix` | Material / colour breakdown — per colorway | colorway_matrix | ★ | LIBRARY (swatch) > SPEC (text) > DESIGNER | PROTO | Matrix tools + colourway families (§4.4). | 13 categories |
| `branding.logo_type` | Logo type | chips | ★ | BASE STYLE > AI > HOUSE | PROTO | Conflict chip when the AI read differs from the base style. | 13 categories |
| `branding.foil_colour` | Foil colour | chips | ★ | HOUSE > DESIGNER | PROTO | Only for foil logos. | 13 categories |
| `branding.logo_code` | Logo code | lib | ★ | HOUSE (default logo per brand × logo type) | PROTO | LIBRARY item carries size and finish. | 13 categories |
| `branding.logo_size` | Logo size (W × H) | dims2 | ★ | LIBRARY (logo item) | PROTO | Typed only when the logo item is new. | 13 categories |
| `branding.placement` | Placement | chips | ★ | BASE STYLE > AI > HOUSE | PROTO | Conflict chip when the AI read differs from the base style. | 13 categories |
| `branding.offset` | Offset from nearest edge | stepper | ★ | HOUSE > DESIGNER (AI EST proposes) | PROTO | Proportional EST until settled. | 13 categories |
| `branding.offset_edge` | Offset measured from | chips | ○ | HOUSE | PROTO |  | 13 categories |
| `branding.finish` | Logo finish | chips | ○ | LIBRARY (logo item) | PROTO |  | 13 categories |
| `branding.fill` | Fill / inlay colour (Pantone) | text | ○ | LIBRARY (logo item) | PROTO |  | 13 categories |
| `branding.artwork` | Logo artwork (vector, for the die / mould) | file | ○ | LIBRARY | PROTO | Only when the logo item is new. | 13 categories |
| `branding.tool_depth` | Deboss depth / emboss height | stepper | ○ | LIBRARY | PROTO | When `branding.logo_type` is DEBOSS PATCH / EMBOSS / TONAL HEAT STAMP / FOIL HEAT STAMP / ENGRAVED HARDWARE / METAL LOGO PLATE. Only when the logo item is new. | 13 categories |
| `branding.new_tooling` | New die / mould needed | toggle | ○ | LIBRARY | PROTO | Only when the logo item is new. | 13 categories |
| `edge.treatment` | Edge treatment | chips | ★ | HOUSE + TEMPLATE | PROTO | e.g. PU bags: EDGE PAINT. | 13 categories |
| `edge.paint_colour` | Edge paint colour | chips | ★ | HOUSE | PROTO | e.g. DTM; Ted Baker accessories BLACK. | 13 categories |
| `edge.contrast_colour` | Contrast edge colour | text | ★ | DESIGNER | PROTO | Only when CONTRAST. | 13 categories |
| `construction.list` | Edges and seams — cross-section per area | rows | ★ | TEMPLATE (rows) + HOUSE | PROTO | Structure settled by the silhouette template; no typing. | 13 categories |
| `construction.thread_colour` | Thread colour | chips | ★ | HOUSE | PROTO | DTM by default. | 13 categories |
| `hardware.finish` | Hardware finish | chips | ★ | HOUSE (kit) > AI | PROTO | One hardware table (§4.1). | 13 categories |
| `hardware.items` | Hardware items | rows | ★ | AI + HOUSE kit + LIBRARY + SPEC | PROTO | Code, size in mm, finish, qty, location for every part. | 13 categories |
| `placements.list` | Placement in mm — every snap, ring, rivet, foot and lock | rows | ○ | DERIVED (branding + AI positions, EST) | PROTO | Positions entered once (Branding / hardware table). | 13 categories |
| `zippers.list` | Zipper spec — one row per zipper | rows | ★ | AI rows + LIBRARY + SPEC | PROTO | Gauge EST after the first dimension. | all |
| `interior.lined` | Lined | toggle | ★ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.lining_material` | Lining material | lib | ★ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.lining_artwork_type` | Lining artwork | chips | ★ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.lining_print` | Lining print | lib | ★ | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.lining_pantone` | Lining Pantone | text | ★ | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.pockets` | Pockets | rows | ★ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.pocket_edge` | Pocket edge | chips | ★ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.label` | Interior label | lib | ★ | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.label_size` | Interior label size (W × H) | dims2 | ★ | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.label_offset` | Label offset below pocket top | stepper | ★ | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.label_centered` | Label centered | toggle | ○ | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.seam_binding` | Interior binding on seams | toggle | ○ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.compartments` | Compartments | stepper | ○ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.base_board` | Base board / insert | toggle | ○ hidden | HOUSE (interior package) / BASE STYLE | PROTO | AI only overrides from interior photos. | 10 categories |
| `interior.base_board_mm` | Base board thickness | stepper | ○ | HOUSE (interior package) / BASE STYLE | PROTO | When `interior.base_board` = true. AI only overrides from interior photos. | 10 categories |
| `interior.base_board_material` | Base board material | chips | ○ | HOUSE (interior package) / BASE STYLE | PROTO | When `interior.base_board` = true. AI only overrides from interior photos. | 10 categories |
| `pom.list` | Points of measure — value, tolerance and how to measure | rows | ★ | DERIVED (TEMPLATE points + answers) | PROTO | Designer never re-types a value. Tolerances only if the admin switched the section on. | 13 categories |
| `bom.list` | Every component, including what you can't see — quantities only, no prices | rows | ★ | DERIVED (answers + LIBRARY + TEMPLATE skeleton) | PROTO | Hidden parts only if enabled. No prices. | 13 categories |
| `comments.list` | Comments (each is a lettered red circle — one instruction each) | rows | ○ | DESIGNER | never |  | all |
| `pages.product_features` | Product features page | toggle | ○ | HOUSE | never | Per brand. | all |
| `pages.features` | Product features | rows | ○ | HOUSE | never | Per brand. | all |
| `pages.lining_artwork` | Lining artwork | chips | ○ | HOUSE | never | Per brand. | all |
| `pages.swatches` | Swatch card pages | chips | ○ | HOUSE | never | Per brand. | all |
| `opt.tolerances.dims` | Overall dimension tolerance (±) | stepper | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.tolerances.hardware` | Hardware tolerance (±) | stepper | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.tolerances.notes` | Notes | comment | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.stitching.spi` | Stitches per inch | stepper | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.stitching.thread_size` | Thread size | chips | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.stitching.thread_colour` | Thread colour | chips | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.stitching.notes` | Notes | comment | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.reinforcement.type` | Reinforcement | multi | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.reinforcement.thickness` | Thickness | stepper | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.reinforcement.notes` | Where / notes | comment | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.labels.types` | Labels | multi | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.labels.placement` | Placement | chips | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.labels.notes` | Notes | comment | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.packaging.items` | Packaging | multi | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.packaging.notes` | Notes | comment | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.testing.items` | Tests | multi | ★ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `opt.testing.notes` | Notes | comment | ○ | HOUSE switch (off by default) | PRODUCTION | Only when the admin switches the section on for a retailer / brand; never automatic. | all |
| `cos.shape` | Shape | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_size` | Zip size | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_type` | Zip type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_tape` | Zip tape colour | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_teeth` | Zip teeth colour | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_path` | Zip path | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.puller` | Puller | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.side_handle` | Side handle | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.side_handle_width` | Side handle width | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `cos.side_handle` = true. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.side_handle_doubled` | Doubled | toggle | ○ | BASE STYLE > AI | PROTO | When `cos.side_handle` = true. Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.lining` | Lining | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.interior_pockets` | Interior pockets | multi | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.padding` | Padding | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.padding_mm` | Padding thickness | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `cos.padding` = true. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.padding_where` | Padding coverage | chips | ○ | BASE STYLE > AI | PROTO | When `cos.padding` = true. Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.hanging_hook` | Hanging hook | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.frame_opening` | Frame opening (train case) | toggle | ○ | BASE STYLE > AI | PROTO | When `cos.shape` = TRAIN CASE. Conflict chip when the AI read differs from the base style. | Men's bags, Cosmetic bags, Toiletry kits |

## Handbags

40 questions of its own (below) plus 78 shared questions (table above). Prefix `hb.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `hb.silhouette` | Silhouette | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.structure` | Structure | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.closure` | Closure | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.closure.snap_qty` | Snap qty | stepper | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `hb.closure.snap_spacing` | Snap spacing | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `hb.closure.snap_spacing_value` | Snap spacing (centre to centre) | stepper | ★ | DERIVED | PROTO | From flap width + qty + spacing rule. |
| `hb.closure.zip_size` | Zip size | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.closure.zip_type` | Zip type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.flap` | Flap | chips | ○ | BASE STYLE > AI | PROTO | When `hb.closure` is FLAP + MAGNETIC SNAP / FLAP + PRESS SNAP / TURNLOCK. Conflict chip when the AI read differs from the base style. |
| `hb.flap_height` | Flap height | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | Needed for the snap position in mm (§6 closure). |
| `hb.flap_overhang` | Flap overhang | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `hb.flap` is yes. |
| `hb.top_handle` | Top handle | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.top_handle.qty` | Handle qty | stepper | ○ | BASE STYLE > AI | PROTO | When `hb.top_handle` = true. Conflict chip when the AI read differs from the base style. |
| `hb.top_handle.drop` | Handle drop | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.top_handle.width` | Handle width | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.top_handle.style` | Handle style | chips | ○ | BASE STYLE > AI | PROTO | When `hb.top_handle` = true. Conflict chip when the AI read differs from the base style. |
| `hb.top_handle.attachment` | Handle attachment | chips | ○ | BASE STYLE > AI | PROTO | Attachment is part of the full strap / handle spec (§6). Conflict chip when the AI read differs from the base style. |
| `hb.strap` | Shoulder / crossbody strap | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.strap.removable` | Removable or fixed | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.adjustable` | Adjustable | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.strap.adjust_method` | Adjustment | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.holes` | Hole count | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `hb.strap.material` | Strap material | chips | ○ | BASE STYLE > AI | PROTO | When `hb.strap` = true. Conflict chip when the AI read differs from the base style. |
| `hb.strap.attachment` | Strap attachment hardware | multi | ★ | BASE STYLE > AI | PROTO | Attachment is part of the full strap / handle spec (§6). Conflict chip when the AI read differs from the base style. |
| `hb.gusset` | Gusset | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.gusset_width` | Gusset width (= D) | derived | ○ | DERIVED (= D) | PROTO | When `hb.gusset` is yes. Never shown as a question. |
| `hb.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `hb.feet` | Feet | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `hb.feet.qty` | Feet qty | stepper | ○ | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `hb.feet.code` | Feet code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `hb.ext_pockets` | Exterior pockets | rows | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `hb.quilting` | Quilting / embellishment | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.quilting_spec` | Quilting / embellishment spec | comment | ○ | DESIGNER | PROTO | When `hb.quilting` is yes. |
| `hb.charm` | Charm or keychain included | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hb.charm.code` | Charm / keychain code | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |

## SLGs

14 questions of its own (below) plus 78 shared questions (table above). Prefix `slg.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `slg.type` | Type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slg.card_slots` | Card slots | stepper | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `slg.bill_compartments` | Bill compartments | stepper | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `slg.coin_pocket` | Coin pocket | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `slg.coin_pocket_zip` | Coin pocket zip | chips | ○ | BASE STYLE > AI | PROTO | When `slg.coin_pocket` = true. Conflict chip when the AI read differs from the base style. |
| `slg.id_window` | ID window | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `slg.id_window_size` | ID window size | dims2 | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `slg.id_window` = true. |
| `slg.closure` | Closure | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slg.wrist_strap` | Wrist strap | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slg.wrist_strap.removable` | Wrist strap removable | toggle | ○ | BASE STYLE > AI | PROTO | When `slg.wrist_strap` = true. Conflict chip when the AI read differs from the base style. |
| `slg.wrist_strap.length` | Wrist strap length | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `slg.wrist_strap.hook` | Wrist strap hook | lib | ○ | BASE STYLE > AI | PROTO | When `slg.wrist_strap` = true. Conflict chip when the AI read differs from the base style. |
| `slg.folded_dims` | Folded dimensions (W × H) | dims2 | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `slg.open_dims` | Open dimensions (W × H) | dims2 | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |

## Hardside luggage

18 questions of its own (below) plus 78 shared questions (table above). Prefix `lug.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `lug.size` | Size | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.set_sizes` | Set sizes | multi | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.shell` | Shell | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.shell_finish` | Shell finish | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.wheels` | Wheels | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.wheel_diameter` | Wheel diameter | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `lug.trolley` | Trolley handle | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.trolley_stages` | Trolley stages | stepper | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.trolley_max` | Trolley max height | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `lug.lock` | Lock | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.closure` | Closure | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.expandable` | Expandable | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.expandable_mm` | Expansion | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `lug.expandable` = true. |
| `lug.carry_handles` | Carry handles | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `lug.interior_features` | Interior | multi | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `lug.corner_guards` | Corner guards | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `lug.feet_qty` | Feet qty | stepper | ○ hidden | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `lug.branding` | Luggage branding | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |

## Softside luggage

21 questions of its own (below) plus 78 shared questions (table above). Prefix `slug.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `slug.size` | Size | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.set_sizes` | Set sizes | multi | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.body_fabric` | Body fabric | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `slug.denier` | Denier | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.front_pockets` | Front pockets | multi | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `slug.expansion_zip` | Expansion zip | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `slug.wheels` | Wheels | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.wheel_diameter` | Wheel diameter | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `slug.trolley` | Trolley handle | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.trolley_stages` | Trolley stages | stepper | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.trolley_max` | Trolley max height | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `slug.lock` | Lock | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.closure` | Closure | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.expandable` | Expandable | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.expandable_mm` | Expansion | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `slug.expandable` = true. |
| `slug.carry_handles` | Carry handles | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `slug.interior_features` | Interior | multi | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `slug.corner_guards` | Corner guards | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `slug.feet_qty` | Feet qty | stepper | ○ hidden | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `slug.branding` | Luggage branding | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |

## Duffels

32 questions of its own (below) plus 73 shared questions (table above). Prefix `duf.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `duf.size_l` | Length (L) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `duf.size_w` | Width (W) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `duf.size_h` | Height (H) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `duf.capacity` | Capacity (auto) | derived | ○ | DERIVED | PROTO | From the dimensions. |
| `duf.zip_size` | Main closure zip size | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.zip_type` | Main closure zip type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.zip_double_slider` | Double slider | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.zip_lockable` | Lockable pulls | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.grab_handles` | Grab handles | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.handle_length` | Handle length | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap` | Shoulder / crossbody strap | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.strap.removable` | Removable or fixed | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.adjustable` | Adjustable | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.strap.adjust_method` | Adjustment | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.holes` | Hole count | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `duf.strap.material` | Strap material | chips | ○ | BASE STYLE > AI | PROTO | When `duf.strap` = true. Conflict chip when the AI read differs from the base style. |
| `duf.strap.attachment` | Strap attachment hardware | multi | ★ | BASE STYLE > AI | PROTO | Attachment is part of the full strap / handle spec (§6). Conflict chip when the AI read differs from the base style. |
| `duf.strap.pad` | Shoulder pad | toggle | ○ | BASE STYLE > AI | PROTO | When `duf.strap` = true. Conflict chip when the AI read differs from the base style. |
| `duf.end_pockets` | End pockets | toggle | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `duf.shoe_compartment` | Shoe compartment | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.shoe_location` | Shoe compartment location | chips | ○ | BASE STYLE > AI | PROTO | When `duf.shoe_compartment` = true. Conflict chip when the AI read differs from the base style. |
| `duf.trolley_sleeve` | Trolley sleeve | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `duf.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `duf.feet_qty` | Feet qty | stepper | ○ hidden | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `duf.id_tag` | ID tag | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `duf.id_tag_code` | ID tag code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |

## Rolling duffels

42 questions of its own (below) plus 73 shared questions (table above). Prefix `rduf.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `rduf.size_l` | Length (L) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.size_w` | Width (W) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.size_h` | Height (H) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.capacity` | Capacity (auto) | derived | ○ | DERIVED | PROTO | From the dimensions. |
| `rduf.zip_size` | Main closure zip size | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.zip_type` | Main closure zip type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.zip_double_slider` | Double slider | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.zip_lockable` | Lockable pulls | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.grab_handles` | Grab handles | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.handle_length` | Handle length | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap` | Shoulder / crossbody strap | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.strap.removable` | Removable or fixed | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.adjustable` | Adjustable | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.strap.adjust_method` | Adjustment | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.holes` | Hole count | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `rduf.strap.material` | Strap material | chips | ○ | BASE STYLE > AI | PROTO | When `rduf.strap` = true. Conflict chip when the AI read differs from the base style. |
| `rduf.strap.attachment` | Strap attachment hardware | multi | ★ | BASE STYLE > AI | PROTO | Attachment is part of the full strap / handle spec (§6). Conflict chip when the AI read differs from the base style. |
| `rduf.strap.pad` | Shoulder pad | toggle | ○ | BASE STYLE > AI | PROTO | When `rduf.strap` = true. Conflict chip when the AI read differs from the base style. |
| `rduf.end_pockets` | End pockets | toggle | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `rduf.shoe_compartment` | Shoe compartment | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.shoe_location` | Shoe compartment location | chips | ○ | BASE STYLE > AI | PROTO | When `rduf.shoe_compartment` = true. Conflict chip when the AI read differs from the base style. |
| `rduf.trolley_sleeve` | Trolley sleeve | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `rduf.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `rduf.feet_qty` | Feet qty | stepper | ○ hidden | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `rduf.id_tag` | ID tag | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.id_tag_code` | ID tag code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `rduf.wheels_qty` | Wheel qty | stepper | ★ | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `rduf.wheel_diameter` | Wheel diameter | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.wheels_inline` | Inline wheels | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.tele_stages` | Telescopic handle stages | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.tele_max` | Telescopic handle max height | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.tele_tube` | Telescopic handle tube | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.tele_retract` | Retract position | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.base_type` | Base type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.skid_guards` | Skid guards | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `rduf.carry_handles` | Carry handles | multi | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |

## Men's bags

21 questions of its own (below) plus 95 shared questions (table above). Prefix `men.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `men.type` | Type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `men.laptop` | Laptop compartment | toggle | ○ | BASE STYLE > AI | PROTO | When `men.type` is BRIEFCASE / MESSENGER / BACKPACK / SLING / TOTE / WEEKENDER. Conflict chip when the AI read differs from the base style. |
| `men.laptop_size` | Device size | chips | ○ | BASE STYLE > AI | PROTO | When `men.laptop` = true. Conflict chip when the AI read differs from the base style. |
| `men.laptop_padded` | Padded | toggle | ○ | BASE STYLE > AI | PROTO | When `men.laptop` = true. Conflict chip when the AI read differs from the base style. |
| `men.organiser` | Organiser panel | multi | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `men.trolley_sleeve` | Trolley sleeve | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `men.back_padding` | Back padding | toggle | ○ | BASE STYLE > AI | PROTO | When `men.type` is BACKPACK / SLING. Conflict chip when the AI read differs from the base style. |
| `men.handles` | Handles | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `men.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap` | Shoulder / crossbody strap | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `men.strap.removable` | Removable or fixed | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `men.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.adjustable` | Adjustable | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `men.strap.adjust_method` | Adjustment | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `men.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.holes` | Hole count | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `men.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `men.strap.material` | Strap material | chips | ○ | BASE STYLE > AI | PROTO | When `men.strap` = true. Conflict chip when the AI read differs from the base style. |
| `men.strap.attachment` | Strap attachment hardware | multi | ★ | BASE STYLE > AI | PROTO | Attachment is part of the full strap / handle spec (§6). Conflict chip when the AI read differs from the base style. |

## Belts

15 questions of its own (below) plus 57 shared questions (table above). Prefix `belt.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `belt.width` | Width | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `belt.size_run` | Size run | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `belt.measuring_rule` | Measuring rule | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `belt.lengths` | Length per size (fold to centre hole) | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `belt.hole_qty` | Hole qty | stepper | ★ | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `belt.hole_spacing` | Hole spacing | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `belt.hole_diameter` | Hole diameter | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `belt.tip` | Tip shape | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `belt.buckle` | Buckle | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `belt.buckle_attachment` | Buckle attachment | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `belt.keeper` | Keeper | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `belt.keeper_qty` | Keeper qty | stepper | ○ | BASE STYLE > AI | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). Conflict chip when the AI read differs from the base style. |
| `belt.construction` | Construction | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `belt.reversible` | Reversible (swivel buckle) | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `belt.embossed_logo` | Embossed logo on strap | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |

## Cosmetic bags

0 questions of its own (below) plus 95 shared questions (table above). Prefix `cos.`.


## Toiletry kits

0 questions of its own (below) plus 95 shared questions (table above). Prefix `cos.`.


## Coolers / insulated

29 questions of its own (below) plus 78 shared questions (table above). Prefix `cool.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `cool.type` | Type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.capacity_cans` | Capacity (cans) | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.capacity_l` | Capacity (litres) | stepper | ★ | DERIVED | PROTO | From the dimensions. |
| `cool.insulation` | Insulation | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `cool.insulation_mm` | Insulation thickness | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `cool.liner` | Liner | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `cool.seams` | Seams | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `cool.opening` | Opening | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.waterproof_zip` | Waterproof zip | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.bottle_opener` | Bottle opener | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.bottle_opener_code` | Bottle opener code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `cool.ext_pockets` | Exterior pockets | multi | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `cool.grab_handles` | Handles | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap` | Shoulder / crossbody strap | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.strap.removable` | Removable or fixed | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.adjustable` | Adjustable | toggle | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.strap.adjust_method` | Adjustment | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.holes` | Hole count | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cool.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `cool.strap.material` | Strap material | chips | ○ | BASE STYLE > AI | PROTO | When `cool.strap` = true. Conflict chip when the AI read differs from the base style. |
| `cool.strap.attachment` | Strap attachment hardware | multi | ★ | BASE STYLE > AI | PROTO | Attachment is part of the full strap / handle spec (§6). Conflict chip when the AI read differs from the base style. |
| `cool.strap.pad` | Shoulder pad | toggle | ○ | BASE STYLE > AI | PROTO | When `cool.strap` = true. Conflict chip when the AI read differs from the base style. |
| `cool.cold_claim` | Cold-retention claim | toggle | ○ | DESIGNER | PRODUCTION | Claims need test reports. |
| `cool.cold_hours` | Cold retention | stepper | ★ | DESIGNER | PRODUCTION | Claims need test reports. |

## Packing cubes

10 questions of its own (below) plus 62 shared questions (table above). Prefix `cube.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `cube.set` | Set composition | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `cube.body_fabric` | Body fabric | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `cube.denier` | Denier | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cube.mesh` | Mesh panel | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cube.mesh_position` | Mesh position | chips | ○ | BASE STYLE > AI | PROTO | When `cube.mesh` = true. Conflict chip when the AI read differs from the base style. |
| `cube.compression` | Compression zip | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cube.double_slider` | Double-slider zip | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cube.grab_loop` | Grab loop | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cube.label_window` | Label window | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `cube.nesting` | Nesting order (auto) | derived | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |

## Neck pillows

10 questions of its own (below) plus 62 shared questions (table above). Prefix `neck.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `neck.shape` | Shape | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.fill` | Fill | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.foam_density` | Memory foam density (kg/m³) | stepper | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.cover` | Cover | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.removable_cover` | Removable cover | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.cover_zip` | Cover zip | chips | ○ | BASE STYLE > AI | PROTO | When `neck.removable_cover` = true. Conflict chip when the AI read differs from the base style. |
| `neck.front_closure` | Front closure | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.luggage_clip` | Luggage clip / strap loop | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.carry_pouch` | Carry pouch | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `neck.pouch_size` | Compressed pouch size | dims2 | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `neck.carry_pouch` = true. |

## Hardware

17 questions of its own (below) plus 33 shared questions (table above). Prefix `hw.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `hw.type` | Type | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.component` | Component (library) | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `hw.views` | Views to draw | multi | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.scale` | Drawing scale | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.overall_w` | Overall width | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `hw.overall_h` | Overall height | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `hw.overall_d` | Overall depth / thickness | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `hw.detail_dims` | Detail dimensions | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `hw.material` | Material | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.finish` | Finish | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.logo_treatment` | Logo treatment | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.enamel_colour` | Enamel colour | text | ★ | DESIGNER | PROTO |  |
| `hw.hollow` | Hollow sections | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.hollow_where` | Hollow where | comment | ○ | DESIGNER | PROTO | When `hw.hollow` = true. |
| `hw.edge` | Edge | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.etched_sides` | Etched side pattern | toggle | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `hw.attachment` | Attachment | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |

## Decorative hardware

7 questions of its own (below) plus 33 shared questions (table above). Prefix `deco.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `deco.components` | Components | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `deco.pendant_shape` | Pendant shape | chips | ○ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `deco.pendant_dims` | Pendant dims (W × H) | dims2 | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | When `deco.pendant_shape` is yes. |
| `deco.enamel` | Enamel colours (Pantone each) | text | ○ | DESIGNER | PROTO | When `deco.pendant_shape` is yes. |
| `deco.pendant_logo` | Pendant logo | chips | ○ | BASE STYLE > AI | PROTO | When `deco.pendant_shape` is yes. Conflict chip when the AI read differs from the base style. |
| `deco.finish` | Finish | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `deco.attachment` | Attachment to the product | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |

## Print artwork

5 questions of its own (below) plus 33 shared questions (table above). Prefix `art.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `art.print` | Artwork (library) | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `art.motif_scale` | Motif scale | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `art.placement` | Placement | chips | ★ | BASE STYLE > AI | PROTO | Conflict chip when the AI read differs from the base style. |
| `art.placed_position` | Placed position | text | ★ | DESIGNER | PROTO |  |
| `art.placed_size` | Placed size (W × H) | dims2 | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |

## Decisions (round 6)

- Open points 1–6 of the first draft: approved as proposed — construction rows and thread colour stay PROTO (settled by TEMPLATE / HOUSE, no typing); POM and BOM are DERIVED and PROTO with tolerances off unless the admin switches them on; interior follows the house package; hidden-on-render questions come from BASE STYLE / HOUSE first; component packs take LIBRARY / SPEC; cooler cold claims are PRODUCTION.
- **A. BASE STYLE > AI** for every visible field, with a conflict chip when the AI read differs from the base style. AI still beats HOUSE.
- **B. Part specs are PROTO when the part exists.** "never" is only for admin and presentation fields (retailer, season, reference sample, due date, physical-sample banner, description, comments, pages, unit display). A conditional question is required at PROTO only when its parent is yes — the note says when.
