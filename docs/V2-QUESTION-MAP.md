# V2 question map

For review before v2 work starts (`docs/V2-SEAMLESS-BRIEF.md` §10). Every question id in the bank, for all 16 categories, with:

- **Source** — where the answer comes from in v2, highest priority first (§2): DESIGNER, SPEC, BASE STYLE, LIBRARY, HOUSE, TEMPLATE, AI, DERIVED. `A > B` means A wins over B. EST = a proportional estimate shown in the app only, never printed until settled.
- **Stage** — the stage whose export it blocks (§6): **PROTO** (and therefore production too), **PRODUCTION** only, or **never** (prints blank / TBC; never a guessed value).
- **Today** — ★ required now, ○ optional now; *hidden* = can't be seen on a front render (INFERRED today).

Generated from the live question bank by `scripts/question-map.ts` — change a rule there and re-run, so the map and the code can't drift. Mark up anything you disagree with and I'll change the rules, not the table by hand.

## Summary per category

| Category | Questions | PROTO | PRODUCTION only | never | Settled without typing at PROTO¹ | AI proposes, designer confirms¹ | Designer types¹ |
|---|---|---|---|---|---|---|---|
| Handbags | 118 | 65 | 20 | 33 | 32 | 28 | 5 |
| SLGs | 92 | 42 | 20 | 30 | 27 | 9 | 6 |
| Hardside luggage | 96 | 45 | 20 | 31 | 26 | 15 | 4 |
| Softside luggage | 99 | 47 | 20 | 32 | 27 | 16 | 4 |
| Duffels | 105 | 57 | 20 | 28 | 28 | 25 | 4 |
| Rolling duffels | 115 | 65 | 20 | 30 | 28 | 31 | 6 |
| Men's bags | 116 | 58 | 20 | 38 | 30 | 24 | 4 |
| Belts | 72 | 36 | 20 | 16 | 17 | 15 | 4 |
| Cosmetic bags | 95 | 45 | 20 | 30 | 29 | 12 | 4 |
| Toiletry kits | 95 | 45 | 20 | 30 | 29 | 12 | 4 |
| Coolers / insulated | 107 | 57 | 22 | 28 | 32 | 21 | 4 |
| Packing cubes | 72 | 29 | 20 | 23 | 17 | 8 | 4 |
| Neck pillows | 72 | 31 | 20 | 21 | 16 | 11 | 4 |
| Hardware | 50 | 14 | 20 | 16 | 1 | 9 | 4 |
| Decorative hardware | 40 | 5 | 20 | 15 | 0 | 5 | 0 |
| Print artwork | 38 | 6 | 20 | 12 | 1 | 3 | 2 |

¹ Counted over PROTO questions only, by the first source in the chain. Conditional questions (e.g. strap width only when there is a strap) are counted even though a given style shows fewer. "Designer types" includes measurements a spec sheet would fill, and SPEC > BASE STYLE chains count as AI-proposes.

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
| `branding.logo_type` | Logo type | chips | ★ | AI > HOUSE | PROTO |  | 13 categories |
| `branding.foil_colour` | Foil colour | chips | ★ | HOUSE > DESIGNER | PROTO | Only for foil logos. | 13 categories |
| `branding.logo_code` | Logo code | lib | ★ | HOUSE (default logo per brand × logo type) | PROTO | LIBRARY item carries size and finish. | 13 categories |
| `branding.logo_size` | Logo size (W × H) | dims2 | ★ | LIBRARY (logo item) | PROTO | Typed only when the logo item is new. | 13 categories |
| `branding.placement` | Placement | chips | ★ | AI > HOUSE | PROTO |  | 13 categories |
| `branding.offset` | Offset from nearest edge | stepper | ★ | HOUSE > DESIGNER (AI EST proposes) | PROTO | Proportional EST until settled. | 13 categories |
| `branding.offset_edge` | Offset measured from | chips | ○ | HOUSE | PROTO |  | 13 categories |
| `branding.finish` | Logo finish | chips | ○ | LIBRARY (logo item) | PROTO |  | 13 categories |
| `branding.fill` | Fill / inlay colour (Pantone) | text | ○ | LIBRARY (logo item) | never |  | 13 categories |
| `branding.artwork` | Logo artwork (vector, for the die / mould) | file | ○ | LIBRARY | PROTO | Only when the logo item is new. | 13 categories |
| `branding.tool_depth` | Deboss depth / emboss height | stepper | ○ | LIBRARY | never | Only when the logo item is new. | 13 categories |
| `branding.new_tooling` | New die / mould needed | toggle | ○ | LIBRARY | never | Only when the logo item is new. | 13 categories |
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
| `interior.label_centered` | Label centered | toggle | ○ | HOUSE (interior package) / BASE STYLE | never | AI only overrides from interior photos. | 10 categories |
| `interior.seam_binding` | Interior binding on seams | toggle | ○ hidden | HOUSE (interior package) / BASE STYLE | never | AI only overrides from interior photos. | 10 categories |
| `interior.compartments` | Compartments | stepper | ○ hidden | HOUSE (interior package) / BASE STYLE | never | AI only overrides from interior photos. | 10 categories |
| `interior.base_board` | Base board / insert | toggle | ○ hidden | HOUSE (interior package) / BASE STYLE | never | AI only overrides from interior photos. | 10 categories |
| `interior.base_board_mm` | Base board thickness | stepper | ○ | HOUSE (interior package) / BASE STYLE | never | AI only overrides from interior photos. | 10 categories |
| `interior.base_board_material` | Base board material | chips | ○ | HOUSE (interior package) / BASE STYLE | never | AI only overrides from interior photos. | 10 categories |
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
| `cos.shape` | Shape | chips | ★ | AI > BASE STYLE | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_size` | Zip size | chips | ★ | AI > BASE STYLE | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_type` | Zip type | chips | ★ | AI > BASE STYLE | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_tape` | Zip tape colour | chips | ★ | AI > BASE STYLE | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_teeth` | Zip teeth colour | chips | ★ | AI > BASE STYLE | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.zip_path` | Zip path | chips | ★ | AI > BASE STYLE | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.puller` | Puller | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.side_handle` | Side handle | toggle | ○ | AI > BASE STYLE | never |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.side_handle_width` | Side handle width | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.side_handle_doubled` | Doubled | toggle | ○ | AI > BASE STYLE | never |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.lining` | Lining | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.interior_pockets` | Interior pockets | multi | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.padding` | Padding | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.padding_mm` | Padding thickness | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.padding_where` | Padding coverage | chips | ○ | AI > BASE STYLE | never |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.hanging_hook` | Hanging hook | toggle | ○ | AI > BASE STYLE | never |  | Men's bags, Cosmetic bags, Toiletry kits |
| `cos.frame_opening` | Frame opening (train case) | toggle | ○ | AI > BASE STYLE | never |  | Men's bags, Cosmetic bags, Toiletry kits |

## Handbags

40 questions of its own (below) plus 78 shared questions (table above). Prefix `hb.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `hb.silhouette` | Silhouette | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.structure` | Structure | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.closure` | Closure | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.closure.snap_qty` | Snap qty | stepper | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `hb.closure.snap_spacing` | Snap spacing | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `hb.closure.snap_spacing_value` | Snap spacing (centre to centre) | stepper | ★ | DERIVED | PROTO | From flap width + qty + spacing rule. |
| `hb.closure.zip_size` | Zip size | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.closure.zip_type` | Zip type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.flap` | Flap | chips | ○ | AI > BASE STYLE | never |  |
| `hb.flap_height` | Flap height | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | PROTO | Needed for the snap position in mm (§6 closure). |
| `hb.flap_overhang` | Flap overhang | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `hb.top_handle` | Top handle | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `hb.top_handle.qty` | Handle qty | stepper | ○ | AI > BASE STYLE | never |  |
| `hb.top_handle.drop` | Handle drop | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.top_handle.width` | Handle width | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.top_handle.style` | Handle style | chips | ○ | AI > BASE STYLE | never |  |
| `hb.top_handle.attachment` | Handle attachment | chips | ○ | AI > BASE STYLE | PROTO | Attachment is part of the full strap / handle spec (§6). |
| `hb.strap` | Shoulder / crossbody strap | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `hb.strap.removable` | Removable or fixed | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.adjustable` | Adjustable | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `hb.strap.adjust_method` | Adjustment | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `hb.strap.holes` | Hole count | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `hb.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `hb.strap.material` | Strap material | chips | ○ | AI > BASE STYLE | never |  |
| `hb.strap.attachment` | Strap attachment hardware | multi | ★ | AI > BASE STYLE | PROTO | Attachment is part of the full strap / handle spec (§6). |
| `hb.gusset` | Gusset | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hb.gusset_width` | Gusset width (= D) | derived | ○ | DERIVED (= D) | never | Never shown as a question. |
| `hb.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `hb.feet` | Feet | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `hb.feet.qty` | Feet qty | stepper | ○ | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `hb.feet.code` | Feet code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `hb.ext_pockets` | Exterior pockets | rows | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `hb.quilting` | Quilting / embellishment | chips | ○ | AI > BASE STYLE | never |  |
| `hb.quilting_spec` | Quilting / embellishment spec | comment | ○ | DESIGNER | never |  |
| `hb.charm` | Charm or keychain included | toggle | ○ | AI > BASE STYLE | never |  |
| `hb.charm.code` | Charm / keychain code | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |

## SLGs

14 questions of its own (below) plus 78 shared questions (table above). Prefix `slg.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `slg.type` | Type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `slg.card_slots` | Card slots | stepper | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `slg.bill_compartments` | Bill compartments | stepper | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `slg.coin_pocket` | Coin pocket | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `slg.coin_pocket_zip` | Coin pocket zip | chips | ○ | AI > BASE STYLE | never |  |
| `slg.id_window` | ID window | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `slg.id_window_size` | ID window size | dims2 | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `slg.closure` | Closure | chips | ★ | AI > BASE STYLE | PROTO |  |
| `slg.wrist_strap` | Wrist strap | toggle | ○ | AI > BASE STYLE | never |  |
| `slg.wrist_strap.removable` | Wrist strap removable | toggle | ○ | AI > BASE STYLE | never |  |
| `slg.wrist_strap.length` | Wrist strap length | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `slg.wrist_strap.hook` | Wrist strap hook | lib | ○ | AI > BASE STYLE | never |  |
| `slg.folded_dims` | Folded dimensions (W × H) | dims2 | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `slg.open_dims` | Open dimensions (W × H) | dims2 | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |

## Hardside luggage

18 questions of its own (below) plus 78 shared questions (table above). Prefix `lug.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `lug.size` | Size | chips | ★ | AI > BASE STYLE | PROTO |  |
| `lug.set_sizes` | Set sizes | multi | ★ | AI > BASE STYLE | PROTO |  |
| `lug.shell` | Shell | chips | ★ | AI > BASE STYLE | PROTO |  |
| `lug.shell_finish` | Shell finish | chips | ○ | AI > BASE STYLE | never |  |
| `lug.wheels` | Wheels | chips | ★ | AI > BASE STYLE | PROTO |  |
| `lug.wheel_diameter` | Wheel diameter | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `lug.trolley` | Trolley handle | chips | ★ | AI > BASE STYLE | PROTO |  |
| `lug.trolley_stages` | Trolley stages | stepper | ○ | AI > BASE STYLE | never |  |
| `lug.trolley_max` | Trolley max height | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `lug.lock` | Lock | chips | ★ | AI > BASE STYLE | PROTO |  |
| `lug.closure` | Closure | chips | ★ | AI > BASE STYLE | PROTO |  |
| `lug.expandable` | Expandable | toggle | ○ | AI > BASE STYLE | never |  |
| `lug.expandable_mm` | Expansion | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `lug.carry_handles` | Carry handles | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `lug.interior_features` | Interior | multi | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `lug.corner_guards` | Corner guards | toggle | ○ | AI > BASE STYLE | never |  |
| `lug.feet_qty` | Feet qty | stepper | ○ hidden | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `lug.branding` | Luggage branding | chips | ○ | AI > BASE STYLE | never |  |

## Softside luggage

21 questions of its own (below) plus 78 shared questions (table above). Prefix `slug.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `slug.size` | Size | chips | ★ | AI > BASE STYLE | PROTO |  |
| `slug.set_sizes` | Set sizes | multi | ★ | AI > BASE STYLE | PROTO |  |
| `slug.body_fabric` | Body fabric | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `slug.denier` | Denier | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `slug.front_pockets` | Front pockets | multi | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `slug.expansion_zip` | Expansion zip | toggle | ○ | AI > BASE STYLE | never |  |
| `slug.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `slug.wheels` | Wheels | chips | ★ | AI > BASE STYLE | PROTO |  |
| `slug.wheel_diameter` | Wheel diameter | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `slug.trolley` | Trolley handle | chips | ★ | AI > BASE STYLE | PROTO |  |
| `slug.trolley_stages` | Trolley stages | stepper | ○ | AI > BASE STYLE | never |  |
| `slug.trolley_max` | Trolley max height | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `slug.lock` | Lock | chips | ★ | AI > BASE STYLE | PROTO |  |
| `slug.closure` | Closure | chips | ★ | AI > BASE STYLE | PROTO |  |
| `slug.expandable` | Expandable | toggle | ○ | AI > BASE STYLE | never |  |
| `slug.expandable_mm` | Expansion | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `slug.carry_handles` | Carry handles | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `slug.interior_features` | Interior | multi | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `slug.corner_guards` | Corner guards | toggle | ○ | AI > BASE STYLE | never |  |
| `slug.feet_qty` | Feet qty | stepper | ○ hidden | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `slug.branding` | Luggage branding | chips | ○ | AI > BASE STYLE | never |  |

## Duffels

32 questions of its own (below) plus 73 shared questions (table above). Prefix `duf.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `duf.size_l` | Length (L) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `duf.size_w` | Width (W) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `duf.size_h` | Height (H) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `duf.capacity` | Capacity (auto) | derived | ○ | DERIVED | never | From the dimensions. |
| `duf.zip_size` | Main closure zip size | chips | ★ | AI > BASE STYLE | PROTO |  |
| `duf.zip_type` | Main closure zip type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `duf.zip_double_slider` | Double slider | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `duf.zip_lockable` | Lockable pulls | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `duf.grab_handles` | Grab handles | chips | ★ | AI > BASE STYLE | PROTO |  |
| `duf.handle_length` | Handle length | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap` | Shoulder / crossbody strap | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `duf.strap.removable` | Removable or fixed | chips | ★ | AI > BASE STYLE | PROTO |  |
| `duf.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.adjustable` | Adjustable | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `duf.strap.adjust_method` | Adjustment | chips | ★ | AI > BASE STYLE | PROTO |  |
| `duf.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `duf.strap.holes` | Hole count | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `duf.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `duf.strap.material` | Strap material | chips | ○ | AI > BASE STYLE | never |  |
| `duf.strap.attachment` | Strap attachment hardware | multi | ★ | AI > BASE STYLE | PROTO | Attachment is part of the full strap / handle spec (§6). |
| `duf.strap.pad` | Shoulder pad | toggle | ○ | AI > BASE STYLE | never |  |
| `duf.end_pockets` | End pockets | toggle | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `duf.shoe_compartment` | Shoe compartment | toggle | ○ | AI > BASE STYLE | never |  |
| `duf.shoe_location` | Shoe compartment location | chips | ○ | AI > BASE STYLE | never |  |
| `duf.trolley_sleeve` | Trolley sleeve | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `duf.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `duf.feet_qty` | Feet qty | stepper | ○ hidden | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `duf.id_tag` | ID tag | toggle | ○ | AI > BASE STYLE | never |  |
| `duf.id_tag_code` | ID tag code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |

## Rolling duffels

42 questions of its own (below) plus 73 shared questions (table above). Prefix `rduf.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `rduf.size_l` | Length (L) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.size_w` | Width (W) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.size_h` | Height (H) | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.capacity` | Capacity (auto) | derived | ○ | DERIVED | never | From the dimensions. |
| `rduf.zip_size` | Main closure zip size | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.zip_type` | Main closure zip type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.zip_double_slider` | Double slider | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.zip_lockable` | Lockable pulls | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.grab_handles` | Grab handles | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.handle_length` | Handle length | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap` | Shoulder / crossbody strap | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.strap.removable` | Removable or fixed | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.adjustable` | Adjustable | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.strap.adjust_method` | Adjustment | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `rduf.strap.holes` | Hole count | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `rduf.strap.material` | Strap material | chips | ○ | AI > BASE STYLE | never |  |
| `rduf.strap.attachment` | Strap attachment hardware | multi | ★ | AI > BASE STYLE | PROTO | Attachment is part of the full strap / handle spec (§6). |
| `rduf.strap.pad` | Shoulder pad | toggle | ○ | AI > BASE STYLE | never |  |
| `rduf.end_pockets` | End pockets | toggle | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `rduf.shoe_compartment` | Shoe compartment | toggle | ○ | AI > BASE STYLE | never |  |
| `rduf.shoe_location` | Shoe compartment location | chips | ○ | AI > BASE STYLE | never |  |
| `rduf.trolley_sleeve` | Trolley sleeve | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `rduf.base` | Base | chips | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `rduf.feet_qty` | Feet qty | stepper | ○ hidden | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `rduf.id_tag` | ID tag | toggle | ○ | AI > BASE STYLE | never |  |
| `rduf.id_tag_code` | ID tag code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `rduf.wheels_qty` | Wheel qty | stepper | ★ | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `rduf.wheel_diameter` | Wheel diameter | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.wheels_inline` | Inline wheels | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.tele_stages` | Telescopic handle stages | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.tele_max` | Telescopic handle max height | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `rduf.tele_tube` | Telescopic handle tube | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.tele_retract` | Retract position | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.base_type` | Base type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `rduf.skid_guards` | Skid guards | toggle | ○ | AI > BASE STYLE | never |  |
| `rduf.carry_handles` | Carry handles | multi | ○ | AI > BASE STYLE | never |  |

## Men's bags

21 questions of its own (below) plus 95 shared questions (table above). Prefix `men.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `men.type` | Type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `men.laptop` | Laptop compartment | toggle | ○ | AI > BASE STYLE | never |  |
| `men.laptop_size` | Device size | chips | ○ | AI > BASE STYLE | never |  |
| `men.laptop_padded` | Padded | toggle | ○ | AI > BASE STYLE | never |  |
| `men.organiser` | Organiser panel | multi | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `men.trolley_sleeve` | Trolley sleeve | toggle | ○ hidden | BASE STYLE > HOUSE > DESIGNER | never | AI only from extra photos (back / side / interior). |
| `men.back_padding` | Back padding | toggle | ○ | AI > BASE STYLE | never |  |
| `men.handles` | Handles | chips | ○ | AI > BASE STYLE | never |  |
| `men.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap` | Shoulder / crossbody strap | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `men.strap.removable` | Removable or fixed | chips | ★ | AI > BASE STYLE | PROTO |  |
| `men.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.adjustable` | Adjustable | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `men.strap.adjust_method` | Adjustment | chips | ★ | AI > BASE STYLE | PROTO |  |
| `men.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `men.strap.holes` | Hole count | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `men.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `men.strap.material` | Strap material | chips | ○ | AI > BASE STYLE | never |  |
| `men.strap.attachment` | Strap attachment hardware | multi | ★ | AI > BASE STYLE | PROTO | Attachment is part of the full strap / handle spec (§6). |

## Belts

15 questions of its own (below) plus 57 shared questions (table above). Prefix `belt.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `belt.width` | Width | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `belt.size_run` | Size run | chips | ★ | AI > BASE STYLE | PROTO |  |
| `belt.measuring_rule` | Measuring rule | chips | ★ | AI > BASE STYLE | PROTO |  |
| `belt.lengths` | Length per size (fold to centre hole) | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `belt.hole_qty` | Hole qty | stepper | ★ | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `belt.hole_spacing` | Hole spacing | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `belt.hole_diameter` | Hole diameter | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `belt.tip` | Tip shape | chips | ★ | AI > BASE STYLE | PROTO |  |
| `belt.buckle` | Buckle | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `belt.buckle_attachment` | Buckle attachment | chips | ★ | AI > BASE STYLE | PROTO |  |
| `belt.keeper` | Keeper | chips | ★ | AI > BASE STYLE | PROTO |  |
| `belt.keeper_qty` | Keeper qty | stepper | ○ | AI > BASE STYLE | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `belt.construction` | Construction | chips | ★ | AI > BASE STYLE | PROTO |  |
| `belt.reversible` | Reversible (swivel buckle) | toggle | ○ | AI > BASE STYLE | never |  |
| `belt.embossed_logo` | Embossed logo on strap | toggle | ○ | AI > BASE STYLE | never |  |

## Cosmetic bags

0 questions of its own (below) plus 95 shared questions (table above). Prefix `cos.`.


## Toiletry kits

0 questions of its own (below) plus 95 shared questions (table above). Prefix `cos.`.


## Coolers / insulated

29 questions of its own (below) plus 78 shared questions (table above). Prefix `cool.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `cool.type` | Type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `cool.capacity_cans` | Capacity (cans) | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `cool.capacity_l` | Capacity (litres) | stepper | ★ | DERIVED | PROTO | From the dimensions. |
| `cool.insulation` | Insulation | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `cool.insulation_mm` | Insulation thickness | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `cool.liner` | Liner | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `cool.seams` | Seams | chips | ★ hidden | BASE STYLE > HOUSE > DESIGNER | PROTO | AI only from extra photos (back / side / interior). |
| `cool.opening` | Opening | chips | ★ | AI > BASE STYLE | PROTO |  |
| `cool.waterproof_zip` | Waterproof zip | toggle | ○ | AI > BASE STYLE | never |  |
| `cool.bottle_opener` | Bottle opener | toggle | ○ | AI > BASE STYLE | never |  |
| `cool.bottle_opener_code` | Bottle opener code | lib | ○ | LIBRARY (+ HOUSE kit) | PROTO | When the part is present: every hardware part needs code, size, finish, qty (§6). |
| `cool.ext_pockets` | Exterior pockets | multi | ○ | AI rows + SPEC sizes | PROTO | When the style has them: each pocket's size (W × H) and zip opening. |
| `cool.grab_handles` | Handles | chips | ○ | AI > BASE STYLE | never |  |
| `cool.handle_drop` | Handle drop | stepper | ○ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap` | Shoulder / crossbody strap | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `cool.strap.removable` | Removable or fixed | chips | ★ | AI > BASE STYLE | PROTO |  |
| `cool.strap.width` | Strap width | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.length` | Strap total length | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.adjustable` | Adjustable | toggle | ★ | AI > BASE STYLE | PROTO |  |
| `cool.strap.adjust_method` | Adjustment | chips | ★ | AI > BASE STYLE | PROTO |  |
| `cool.strap.adjust_min` | Adjustment range — shortest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.adjust_max` | Adjustment range — longest | stepper | ★ | SPEC > BASE STYLE > TEMPLATE (EST) > DESIGNER | PROTO | Full strap / handle specs are PROTO. Template numbers shown EST until confirmed. |
| `cool.strap.holes` | Hole count | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `cool.strap.drop` | Strap drop | stepper | ○ | DERIVED | PROTO | From strap length + body H when both are known. |
| `cool.strap.material` | Strap material | chips | ○ | AI > BASE STYLE | never |  |
| `cool.strap.attachment` | Strap attachment hardware | multi | ★ | AI > BASE STYLE | PROTO | Attachment is part of the full strap / handle spec (§6). |
| `cool.strap.pad` | Shoulder pad | toggle | ○ | AI > BASE STYLE | never |  |
| `cool.cold_claim` | Cold-retention claim | toggle | ○ | DESIGNER | PRODUCTION | Claims need test reports. |
| `cool.cold_hours` | Cold retention | stepper | ★ | DESIGNER | PRODUCTION | Claims need test reports. |

## Packing cubes

10 questions of its own (below) plus 62 shared questions (table above). Prefix `cube.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `cube.set` | Set composition | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `cube.body_fabric` | Body fabric | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `cube.denier` | Denier | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `cube.mesh` | Mesh panel | toggle | ○ | AI > BASE STYLE | never |  |
| `cube.mesh_position` | Mesh position | chips | ○ | AI > BASE STYLE | never |  |
| `cube.compression` | Compression zip | toggle | ○ | AI > BASE STYLE | never |  |
| `cube.double_slider` | Double-slider zip | toggle | ○ | AI > BASE STYLE | never |  |
| `cube.grab_loop` | Grab loop | toggle | ○ | AI > BASE STYLE | never |  |
| `cube.label_window` | Label window | toggle | ○ | AI > BASE STYLE | never |  |
| `cube.nesting` | Nesting order (auto) | derived | ○ | AI > BASE STYLE | never |  |

## Neck pillows

10 questions of its own (below) plus 62 shared questions (table above). Prefix `neck.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `neck.shape` | Shape | chips | ★ | AI > BASE STYLE | PROTO |  |
| `neck.fill` | Fill | chips | ★ | AI > BASE STYLE | PROTO |  |
| `neck.foam_density` | Memory foam density (kg/m³) | stepper | ★ | AI > BASE STYLE | PROTO |  |
| `neck.cover` | Cover | chips | ★ | AI > BASE STYLE | PROTO |  |
| `neck.removable_cover` | Removable cover | toggle | ○ | AI > BASE STYLE | never |  |
| `neck.cover_zip` | Cover zip | chips | ○ | AI > BASE STYLE | never |  |
| `neck.front_closure` | Front closure | chips | ★ | AI > BASE STYLE | PROTO |  |
| `neck.luggage_clip` | Luggage clip / strap loop | toggle | ○ | AI > BASE STYLE | never |  |
| `neck.carry_pouch` | Carry pouch | toggle | ○ | AI > BASE STYLE | never |  |
| `neck.pouch_size` | Compressed pouch size | dims2 | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |

## Hardware

17 questions of its own (below) plus 33 shared questions (table above). Prefix `hw.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `hw.type` | Type | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hw.component` | Component (library) | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `hw.views` | Views to draw | multi | ★ | AI > BASE STYLE | PROTO |  |
| `hw.scale` | Drawing scale | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hw.overall_w` | Overall width | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `hw.overall_h` | Overall height | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `hw.overall_d` | Overall depth / thickness | stepper | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |
| `hw.detail_dims` | Detail dimensions | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `hw.material` | Material | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hw.finish` | Finish | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hw.logo_treatment` | Logo treatment | chips | ★ | AI > BASE STYLE | PROTO |  |
| `hw.enamel_colour` | Enamel colour | text | ★ | DESIGNER | PROTO |  |
| `hw.hollow` | Hollow sections | toggle | ○ | AI > BASE STYLE | never |  |
| `hw.hollow_where` | Hollow where | comment | ○ | DESIGNER | never |  |
| `hw.edge` | Edge | chips | ○ | AI > BASE STYLE | never |  |
| `hw.etched_sides` | Etched side pattern | toggle | ○ | AI > BASE STYLE | never |  |
| `hw.attachment` | Attachment | chips | ○ | AI > BASE STYLE | never |  |

## Decorative hardware

7 questions of its own (below) plus 33 shared questions (table above). Prefix `deco.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `deco.components` | Components | rows | ★ | AI rows + DESIGNER | PROTO |  |
| `deco.pendant_shape` | Pendant shape | chips | ○ | AI > BASE STYLE | never |  |
| `deco.pendant_dims` | Pendant dims (W × H) | dims2 | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `deco.enamel` | Enamel colours (Pantone each) | text | ○ | DESIGNER | never |  |
| `deco.pendant_logo` | Pendant logo | chips | ○ | AI > BASE STYLE | never |  |
| `deco.finish` | Finish | chips | ★ | AI > BASE STYLE | PROTO |  |
| `deco.attachment` | Attachment to the product | chips | ★ | AI > BASE STYLE | PROTO |  |

## Print artwork

5 questions of its own (below) plus 33 shared questions (table above). Prefix `art.`.

| Question id | Label | Kind | Today | v2 source | Stage | Note |
|---|---|---|---|---|---|---|
| `art.print` | Artwork (library) | lib | ★ | LIBRARY (+ HOUSE kit) | PROTO |  |
| `art.motif_scale` | Motif scale | stepper | ○ | SPEC > DESIGNER (AI EST proposes) | never |  |
| `art.placement` | Placement | chips | ★ | AI > BASE STYLE | PROTO |  |
| `art.placed_position` | Placed position | text | ★ | DESIGNER | PROTO |  |
| `art.placed_size` | Placed size (W × H) | dims2 | ★ | SPEC > DESIGNER (AI EST proposes) | PROTO |  |

## Open points for your review

1. **Construction rows and thread colour** are marked PROTO but settled by HOUSE / TEMPLATE, so they need no typing. Say if they should be "never" at proto instead.
2. **Points of measure and BOM** are DERIVED and PROTO (§6 says they must be complete). Tolerances stay off unless the admin turns the tolerances section on.
3. **Interior** follows the brand's house interior package for every category that has one. Categories without an interior (belts, hardware, print artwork) never see these questions.
4. **Hidden-on-render questions** (base, feet, lining, interior pockets …) come from BASE STYLE or HOUSE first. AI answers them only when back / side / interior photos are dropped.
5. **Hardware, Decorative hardware and Print artwork** are component packs. Their own questions are mostly LIBRARY or SPEC (supplier sheets), and their measurements are PROTO when required today.
6. **Cooler cold-hold claims** move to PRODUCTION, because they need test reports.
