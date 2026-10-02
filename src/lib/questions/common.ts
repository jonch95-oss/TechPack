import type { Section } from "./types";
import { PAGE_SECTIONS } from "@/lib/page-names";

export const HARDWARE_TYPES = [
  "LOGO PLATE",
  "DEBOSS/EMBOSS PATCH",
  "ZIPPER PULL",
  "ZIPPER",
  "MAGNETIC SNAP",
  "PRESS SNAP",
  "TURNLOCK",
  "D-RING",
  "O-RING",
  "SQUARE RING",
  "SWIVEL HOOK",
  "LOBSTER CLASP",
  "CHAIN",
  "BUCKLE",
  "RIVET",
  "FEET",
  "KEYCHAIN/CHARM",
  "WOVEN LABEL",
  "TPU/RUBBER PATCH",
  "WHEEL",
  "TROLLEY HANDLE",
  "LOCK",
];

export const HARDWARE_FINISHES = [
  "SHINY CHAMPAGNE GOLD",
  "LIGHT GOLD",
  "ANTIQUE BRASS",
  "GUNMETAL",
  "SHINY NICKEL",
  "MATTE BLACK",
  "ROSE GOLD",
];

export const HARDWARE_MATERIALS = ["ZINC ALLOY", "BRASS", "IRON", "PLASTIC W/ METAL FINISH", "ALUMINIUM"];

export const LOGO_TYPES = [
  "METAL LOGO PLATE",
  "DEBOSS PATCH",
  "EMBOSS",
  "TONAL HEAT STAMP",
  "FOIL HEAT STAMP",
  "PRINT",
  "WOVEN LABEL",
  "TPU / RUBBER PATCH",
  "EMBROIDERY",
  "ENAMEL BADGE",
  "ENGRAVED HARDWARE",
  "METAL LETTERING",
];

export const RETAILERS = ["TJX/MARSHALLS", "TJ MAXX", "HOMEGOODS", "SIERRA", "WINNERS", "BEALLS", "ROSS", "BURLINGTON"];
export const SEASONS = ["SS26", "FW26", "HOLIDAY 26", "SS27", "FW27", "HOLIDAY 27"];

export const POCKET_TYPES = [
  "SLIP POCKET",
  "ZIP POCKET",
  "PHONE POCKET",
  "CARD SLOTS",
  "PEN LOOP",
  "KEY LEASH",
  "MESH POCKET",
  "ELASTIC LOOPS",
];
export const WALLS = ["BACK WALL", "FRONT WALL", "SIDE 1", "SIDE 2", "BASE", "DIVIDER"];

export const POM_POINTS = [
  "TOTAL HEIGHT",
  "TOTAL WIDTH",
  "TOTAL DEPTH",
  "TOP WIDTH",
  "BASE WIDTH",
  "HANDLE DROP",
  "HANDLE LENGTH",
  "HANDLE WIDTH",
  "STRAP TOTAL LENGTH",
  "STRAP DROP",
  "STRAP WIDTH",
  "FLAP HEIGHT",
  "FLAP OVERHANG",
  "GUSSET WIDTH",
  "ZIP OPENING",
  "POCKET WIDTH",
  "POCKET HEIGHT",
  "LOGO OFFSET",
];

export const PLACEMENT_FROM = ["FROM TOP EDGE", "FROM SIDE SEAM", "FROM FLAP EDGE", "FROM BASE", "FROM CENTRE", "FROM HANDLE BASE"];

export const ZIP_SIZES = ["#3", "#5", "#8", "#10"];
export const ZIP_TYPES_ALL = ["COIL", "METAL", "MOLDED", "PLASTIC W/ METAL FINISH"];

export const EDGE_CONSTRUCTIONS = ["TURNED EDGE", "RAW EDGE PAINTED", "PIPED", "BOUND", "FOLDED & STITCHED", "BONDED & PAINTED"];
export const CONSTRUCTION_AREAS = ["BODY SEAMS", "FLAP EDGE", "TOP EDGE", "GUSSET SEAMS", "HANDLE", "STRAP", "POCKET EDGE", "BASE SEAM", "LINING SEAMS"];

export const BOM_COMPONENTS = [
  "MAIN MATERIAL",
  "TRIM",
  "LINING",
  "INTERLINING",
  "BOARD",
  "FOAM / PADDING",
  "THREAD",
  "PIPING CORD",
  "EDGE PAINT",
  "ZIPPER",
  "ZIPPER PULL",
  "WEBBING",
  "HARDWARE",
  "LABEL",
  "PACKAGING",
];

/** Categories whose common block includes an interior. */
const INTERIOR_CATEGORIES = [
  "Handbags",
  "SLGs",
  "Hardside luggage",
  "Softside luggage",
  "Duffels",
  "Rolling duffels",
  "Men's bags",
  "Cosmetic bags",
  "Toiletry kits",
  "Coolers / insulated",
] as const;

/** Component sheets (hardware, decorative hardware, print artwork) skip the bag-body blocks. */
const BODY_CATEGORIES = [
  "Handbags",
  "SLGs",
  "Hardside luggage",
  "Softside luggage",
  "Duffels",
  "Rolling duffels",
  "Men's bags",
  "Belts",
  "Cosmetic bags",
  "Toiletry kits",
  "Coolers / insulated",
  "Packing cubes",
  "Neck pillows",
] as const;

const DIMS_CATEGORIES = BODY_CATEGORIES.filter((c) => c !== "Belts" && c !== "Duffels" && c !== "Rolling duffels");

/** 3.0 COMMON BLOCK (all categories). Brand / style # / style name / category / colorway suffixes live on the pack itself. */
export const COMMON_SECTIONS: Section[] = [
  {
    id: "header",
    title: "Header",
    questions: [
      { id: "header.description", label: "Description", kind: "text", required: true, help: "Auto-drafted from your answers; edit freely." },
      { id: "header.retailer", label: "Retailer", kind: "chips", options: RETAILERS },
      { id: "header.season", label: "Season", kind: "chips", options: SEASONS },
      { id: "header.due_date", label: "Due date", kind: "date_asap", required: true },
      { id: "header.reference_sample", label: "Reference sample", kind: "text", help: "Photo can be added under Uploads → Reference sample." },
      {
        id: "header.physical_sample",
        label: "Physical sample to follow",
        kind: "toggle",
        help: 'Prints the red banner "YOU WILL RECEIVE A PHYSICAL SAMPLE IN SIMILAR SIZE AND SIMILAR MATERIAL".',
      },
      {
        id: "header.licensor",
        label: "Licensor",
        kind: "text",
        showIf: { any: [{ category: ["Coolers / insulated"] }, { q: "$brand.licensorRequired", eq: true }] },
        required: true,
      },
      {
        id: "header.licensor_submission",
        label: "Licensor submission #",
        kind: "text",
        showIf: { any: [{ category: ["Coolers / insulated"] }, { q: "$brand.licensorRequired", eq: true }] },
        required: true,
      },
      {
        id: "header.licensor_status",
        label: "Licensor approval status",
        kind: "chips",
        options: ["NOT SUBMITTED", "SUBMITTED", "APPROVED", "APPROVED W/ COMMENTS", "REJECTED"],
        showIf: { any: [{ category: ["Coolers / insulated"] }, { q: "$brand.licensorRequired", eq: true }] },
        required: true,
      },
    ],
  },
  {
    id: "dims",
    title: "Dimensions",
    showIf: { category: [...DIMS_CATEGORIES] },
    questions: [
      { id: "dims.unit", label: "Unit", kind: "chips", options: ["CM", "INCHES"], required: true, noOther: true },
      { id: "dims.h", label: "Height (H)", kind: "stepper", unit: "dim", required: true, step: 0.25 },
      { id: "dims.w", label: "Width (W)", kind: "stepper", unit: "dim", required: true, step: 0.25 },
      { id: "dims.d", label: "Depth (D)", kind: "stepper", unit: "dim", required: true, step: 0.25 },
      { id: "dims.show_secondary", label: "Show secondary unit in brackets", kind: "toggle" },
    ],
  },
  {
    id: "colorways",
    title: "Colorways",
    questions: [{ id: "colorways.names", label: "Colorway names", kind: "per_colorway_text" }],
  },
  {
    id: "materials",
    title: "Materials",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      {
        id: "materials.list",
        label: "Materials (each gets a yellow callout number)",
        kind: "materials",
        required: true,
      },
      {
        id: "materials.matrix",
        label: "Material / colour breakdown — per colorway",
        kind: "colorway_matrix",
        required: true,
      },
    ],
  },
  {
    id: "branding",
    title: "Branding",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      { id: "branding.logo_type", label: "Logo type", kind: "chips", options: LOGO_TYPES, required: true },
      {
        id: "branding.foil_colour",
        label: "Foil colour",
        kind: "chips",
        options: ["GOLD", "SILVER", "GUNMETAL"],
        showIf: { q: "branding.logo_type", eq: "FOIL HEAT STAMP" },
        required: true,
      },
      { id: "branding.logo_code", label: "Logo code", kind: "lib", lib: "hardware", required: true },
      { id: "branding.logo_size", label: "Logo size (W × H)", kind: "dims2", unit: "mm", required: true },
      {
        id: "branding.placement",
        label: "Placement",
        kind: "chips",
        options: ["CENTERED ON FLAP", "CENTERED ON FRONT PANEL", "BOTTOM-RIGHT", "TOP-LEFT", "ON STRAP", "ON PULL"],
        required: true,
      },
      { id: "branding.offset", label: "Offset from nearest edge", kind: "stepper", unit: "mm", required: true },
      {
        id: "branding.offset_edge",
        label: "Offset measured from",
        kind: "chips",
        options: ["FLAP EDGE", "TOP EDGE", "BOTTOM EDGE", "SIDE EDGE", "SEAM"],
      },
      { id: "branding.finish", label: "Logo finish", kind: "chips", options: [...HARDWARE_FINISHES, "DTM", "TONAL"] },
      { id: "branding.fill", label: "Fill / inlay colour (Pantone)", kind: "text", placeholder: "e.g. PANTONE 203 C / GUNMETAL" },
      {
        id: "branding.artwork",
        label: "Logo artwork (vector, for the die / mould)",
        kind: "file",
        accept: ".ai,.eps,.svg,.pdf",
        help: "The vector file the factory cuts the deboss die, emboss plate or mould from.",
      },
      {
        id: "branding.tool_depth",
        label: "Deboss depth / emboss height",
        kind: "stepper",
        unit: "mm",
        step: 0.1,
        showIf: { q: "branding.logo_type", in: ["DEBOSS PATCH", "EMBOSS", "TONAL HEAT STAMP", "FOIL HEAT STAMP", "ENGRAVED HARDWARE", "METAL LOGO PLATE"] },
      },
      { id: "branding.new_tooling", label: "New die / mould needed", kind: "toggle" },
    ],
  },
  {
    id: "edge",
    title: "Edge finish",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      {
        id: "edge.treatment",
        label: "Edge treatment",
        kind: "chips",
        options: ["EDGE PAINT", "TURNED EDGE", "PIPING", "BINDING", "RAW / HEAT-SEALED"],
        required: true,
      },
      {
        id: "edge.paint_colour",
        label: "Edge paint colour",
        kind: "chips",
        options: ["DTM", "CONTRAST", "BLACK"],
        required: true,
        showIf: { q: "edge.treatment", eq: "EDGE PAINT" },
      },
      {
        id: "edge.contrast_colour",
        label: "Contrast edge colour",
        kind: "text",
        showIf: { q: "edge.paint_colour", eq: "CONTRAST" },
        required: true,
      },
    ],
  },
  {
    id: "hardware",
    title: "Hardware",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      { id: "hardware.finish", label: "Hardware finish", kind: "chips", options: HARDWARE_FINISHES, required: true },
      {
        id: "hardware.items",
        label: "Hardware items",
        kind: "rows",
        required: true,
        addLabel: "Add hardware",
        columns: [
          { key: "item", label: "Item", kind: "lib", lib: "hardware", required: true },
          { key: "qty", label: "Qty", kind: "stepper", unit: "qty", required: true },
          { key: "placement", label: "Placement", kind: "text" },
          { key: "seen", label: "Seen on render", kind: "text" },
        ],
      },
    ],
  },
  {
    id: "interior",
    title: "Interior",
    showIf: { category: [...INTERIOR_CATEGORIES] },
    questions: [
      { id: "interior.lined", label: "Lined", kind: "toggle", required: true, visibility: "inferred" },
      {
        id: "interior.lining_material",
        label: "Lining material",
        kind: "lib",
        lib: "material",
        required: true,
        showIf: { q: "interior.lined", eq: true },
        visibility: "inferred",
      },
      {
        id: "interior.lining_artwork_type",
        label: "Lining artwork",
        kind: "chips",
        options: ["PRINT (LIBRARY)", "PLAIN", "PANTONE"],
        noOther: true,
        required: true,
        showIf: { q: "interior.lined", eq: true },
        visibility: "inferred",
      },
      {
        id: "interior.lining_print",
        label: "Lining print",
        kind: "lib",
        lib: "print",
        required: true,
        showIf: { q: "interior.lining_artwork_type", eq: "PRINT (LIBRARY)" },
      },
      {
        id: "interior.lining_pantone",
        label: "Lining Pantone",
        kind: "text",
        required: true,
        showIf: { q: "interior.lining_artwork_type", eq: "PANTONE" },
      },
      {
        id: "interior.pockets",
        label: "Pockets",
        kind: "rows",
        required: true,
        addLabel: "Add pocket",
        visibility: "inferred",
        columns: [
          { key: "type", label: "Type", kind: "chips", options: POCKET_TYPES, required: true },
          { key: "wall", label: "Position", kind: "chips", options: WALLS, required: true },
          { key: "w", label: "W", kind: "stepper", unit: "dim", required: true },
          { key: "h", label: "H (blank = remaining height)", kind: "stepper", unit: "dim" },
          { key: "top_offset", label: "From top", kind: "stepper", unit: "dim", required: true },
          { key: "centered", label: "Centered", kind: "toggle" },
          { key: "construction", label: "Pocket construction", kind: "chips", options: ["FLAT", "GUSSETED", "BELLOWS", "PLEATED"] },
          { key: "zip_size", label: "Zip size", kind: "chips", options: ["#3", "#5", "#8"], showIf: { key: "type", in: ["ZIP POCKET"] } },
          { key: "qty", label: "Qty", kind: "stepper", unit: "qty", showIf: { key: "type", in: ["CARD SLOTS", "ELASTIC LOOPS"] } },
        ],
      },
      {
        id: "interior.pocket_edge",
        label: "Pocket edge",
        kind: "chips",
        options: ["BINDING", "TURNED", "FOLDED"],
        required: true,
        visibility: "inferred",
      },
      { id: "interior.label", label: "Interior label", kind: "lib", lib: "hardware", hardwareTypes: ["WOVEN LABEL", "TPU/RUBBER PATCH", "DEBOSS/EMBOSS PATCH"], required: true },
      { id: "interior.label_size", label: "Interior label size (W × H)", kind: "dims2", unit: "dim", required: true },
      { id: "interior.label_offset", label: "Label offset below pocket top", kind: "stepper", unit: "dim", required: true },
      { id: "interior.label_centered", label: "Label centered", kind: "toggle" },
      { id: "interior.seam_binding", label: "Interior binding on seams", kind: "toggle", visibility: "inferred" },
      { id: "interior.compartments", label: "Compartments", kind: "stepper", unit: "qty", visibility: "inferred" },
      { id: "interior.base_board", label: "Base board / insert", kind: "toggle", visibility: "inferred" },
      { id: "interior.base_board_mm", label: "Base board thickness", kind: "stepper", unit: "mm", step: 0.5, showIf: { q: "interior.base_board", eq: true } },
      { id: "interior.base_board_material", label: "Base board material", kind: "chips", options: ["EVA", "PE BOARD", "LEATHERBOARD", "CARDBOARD", "PLASTIC"], showIf: { q: "interior.base_board", eq: true } },
    ],
  },
  {
    id: "construction",
    title: "Construction",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      {
        id: "construction.list",
        label: "Edges and seams — cross-section per area",
        kind: "rows",
        required: true,
        addLabel: "Add area",
        help: "Each area prints as a cross-section on the construction page.",
        columns: [
          { key: "area", label: "Area", kind: "chips", options: CONSTRUCTION_AREAS, required: true },
          { key: "edge", label: "Edge / seam", kind: "chips", options: EDGE_CONSTRUCTIONS, required: true },
          { key: "stitch", label: "Stitch", kind: "chips", options: ["LOCKSTITCH 301", "CHAINSTITCH 401", "SADDLE STITCH", "NO STITCH"], required: true },
          { key: "spi", label: "SPI", kind: "stepper", unit: "spi" },
          { key: "thread", label: "Thread", kind: "chips", options: ["BONDED NYLON TEX 40", "BONDED NYLON TEX 70", "BONDED NYLON TEX 90", "BONDED NYLON TEX 135", "POLYESTER TEX 70"] },
          { key: "allowance", label: "Seam allowance", kind: "stepper", unit: "mm" },
        ],
      },
      { id: "construction.thread_colour", label: "Thread colour", kind: "chips", options: ["DTM", "CONTRAST", "BLACK", "WHITE", "TONAL"], required: true },
    ],
  },
  {
    id: "placements",
    title: "Hardware placement",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      {
        id: "placements.list",
        label: "Placement in mm — every snap, ring, rivet, foot and lock",
        kind: "rows",
        addLabel: "Add placement",
        help: "“Spaced evenly” isn't measurable — give the distance from an edge and the spacing centre to centre.",
        columns: [
          { key: "item", label: "Component", kind: "lib", lib: "hardware", required: true },
          { key: "qty", label: "Qty", kind: "stepper", unit: "qty", required: true },
          { key: "from", label: "Measured", kind: "chips", options: PLACEMENT_FROM, required: true },
          { key: "distance", label: "Distance", kind: "stepper", unit: "mm", required: true },
          { key: "spacing", label: "Spacing c/c", kind: "stepper", unit: "mm" },
          { key: "note", label: "Note", kind: "text" },
        ],
      },
    ],
  },
  {
    id: "zippers",
    title: "Zippers",
    showIf: { q: "$hasZipper", eq: true },
    questions: [
      {
        id: "zippers.list",
        label: "Zipper spec — one row per zipper",
        kind: "rows",
        required: true,
        addLabel: "Add zipper",
        columns: [
          { key: "position", label: "Position", kind: "chips", options: ["MAIN", "FRONT POCKET", "BACK POCKET", "INTERIOR POCKET", "EXPANSION", "SIDE"], required: true },
          { key: "size", label: "Size", kind: "chips", options: ZIP_SIZES, required: true, noOther: true },
          { key: "type", label: "Type", kind: "chips", options: ZIP_TYPES_ALL, required: true },
          { key: "length", label: "Opening length", kind: "stepper", unit: "dim", required: true },
          { key: "ends", label: "Ends", kind: "chips", options: ["CLOSED END", "OPEN END", "TWO-WAY"], required: true },
          { key: "slider", label: "Slider", kind: "chips", options: ["AUTO-LOCK", "NON-LOCK", "PIN-LOCK", "REVERSIBLE", "DOUBLE SLIDER"], required: true },
          { key: "puller", label: "Puller", kind: "lib", lib: "hardware", hardwareTypes: ["ZIPPER PULL"] },
          { key: "attachment", label: "Puller attachment", kind: "chips", options: ["DIRECT", "CORD LOOP", "JUMP RING", "LEATHER TAB"] },
          { key: "tape", label: "Tape colour", kind: "chips", options: ["DTM", "BLACK", "CONTRAST", "PER COLOURWAY"], required: true },
          { key: "teeth", label: "Teeth colour", kind: "chips", options: ["DTM", ...HARDWARE_FINISHES], required: true },
        ],
      },
    ],
  },
  {
    id: "pom",
    title: "Points of measure",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      {
        id: "pom.list",
        label: "Points of measure — value, tolerance and how to measure",
        kind: "rows",
        required: true,
        addLabel: "Add point of measure",
        help: "Load the template for this silhouette, then fill values. Values already answered above are copied in; nothing is guessed.",
        columns: [
          { key: "point", label: "Point", kind: "chips", options: POM_POINTS, required: true },
          { key: "value", label: "Value", kind: "stepper", unit: "dim", required: true },
          { key: "tol", label: "Tolerance ±", kind: "stepper", unit: "dim", required: true },
          { key: "how", label: "How to measure", kind: "text", required: true },
        ],
      },
    ],
  },
  {
    id: "bom",
    title: "Bill of materials",
    showIf: { category: [...BODY_CATEGORIES] },
    questions: [
      {
        id: "bom.list",
        label: "Every component, including what you can't see — quantities only, no prices",
        kind: "rows",
        required: true,
        addLabel: "Add component",
        help: "Build it from your answers, then add the hidden parts (interlining, board, foam, thread, glue).",
        columns: [
          { key: "component", label: "Component", kind: "chips", options: BOM_COMPONENTS, required: true },
          { key: "description", label: "Description / code", kind: "text", required: true },
          { key: "qty", label: "Qty per bag", kind: "stepper", unit: "qty" },
          { key: "unit", label: "Unit", kind: "chips", options: ["PC", "PAIR", "SET", "CM", "M", "YD", "FTY TO CONFIRM"], required: true, noOther: true },
          { key: "placement", label: "Placement", kind: "text" },
          { key: "colour", label: "Colour", kind: "text" },
        ],
      },
    ],
  },
  {
    id: "comments",
    title: "Comments & references",
    questions: [
      {
        id: "comments.list",
        label: "Comments (each is a lettered red circle — one instruction each)",
        kind: "rows",
        addLabel: "Add comment",
        columns: [
          { key: "text", label: "Comment", kind: "text", required: true },
          { key: "pages", label: "Shown on", kind: "multi", options: PAGE_SECTIONS.filter((p) => p !== "CHANGE LOG"), required: true, noOther: true },
        ],
      },
    ],
  },
  {
    id: "pages",
    title: "Pages",
    questions: [
      {
        id: "pages.product_features",
        label: "Product features page",
        kind: "toggle",
        help: "Front 3/4 render with overall dimensions in red and a bulleted feature list (Ted Baker style). On unless you turn it off.",
      },
      {
        id: "pages.features",
        label: "Product features",
        kind: "rows",
        addLabel: "Add feature",
        showIf: { q: "pages.product_features", in: [true, undefined, null] },
        columns: [{ key: "text", label: "Feature", kind: "text", required: true }],
      },
      {
        id: "pages.lining_artwork",
        label: "Lining artwork",
        kind: "chips",
        options: ["OWN PAGE", "ON INTERIOR PAGE"],
        noOther: true,
        help: "Own page (as on PINK013) or alongside the interior walls (as on TB25_ACC0023).",
      },
      {
        id: "pages.swatches",
        label: "Swatch card pages",
        kind: "chips",
        options: ["ONE PAGE PER COLORWAY MATERIAL", "ALL ON ONE PAGE"],
        noOther: true,
      },
    ],
  },
  {
    id: "opt.tolerances",
    title: "Tolerances",
    optional: true,
    questions: [
      { id: "opt.tolerances.dims", label: "Overall dimension tolerance (±)", kind: "stepper", unit: "dim", required: true },
      { id: "opt.tolerances.hardware", label: "Hardware tolerance (±)", kind: "stepper", unit: "mm" },
      { id: "opt.tolerances.notes", label: "Notes", kind: "comment" },
    ],
  },
  {
    id: "opt.stitching",
    title: "Stitching",
    optional: true,
    questions: [
      { id: "opt.stitching.spi", label: "Stitches per inch", kind: "stepper", unit: "spi", required: true },
      { id: "opt.stitching.thread_size", label: "Thread size", kind: "chips", options: ["TEX 40", "TEX 70", "TEX 90", "TEX 135", "TEX 210"], required: true },
      { id: "opt.stitching.thread_colour", label: "Thread colour", kind: "chips", options: ["DTM", "CONTRAST", "BLACK", "WHITE"], required: true },
      { id: "opt.stitching.notes", label: "Notes", kind: "comment" },
    ],
  },
  {
    id: "opt.reinforcement",
    title: "Reinforcement / interlining",
    optional: true,
    questions: [
      { id: "opt.reinforcement.type", label: "Reinforcement", kind: "multi", options: ["EVA", "FOAM", "BOARD", "NON-WOVEN", "BONDED LEATHERBOARD"], required: true },
      { id: "opt.reinforcement.thickness", label: "Thickness", kind: "stepper", unit: "mm" },
      { id: "opt.reinforcement.notes", label: "Where / notes", kind: "comment" },
    ],
  },
  {
    id: "opt.labels",
    title: "Care and content labels",
    optional: true,
    questions: [
      { id: "opt.labels.types", label: "Labels", kind: "multi", options: ["CARE LABEL", "CONTENT LABEL", "COUNTRY OF ORIGIN", "RN/CA NUMBER"], required: true },
      { id: "opt.labels.placement", label: "Placement", kind: "chips", options: ["INSIDE POCKET", "SIDE SEAM", "UNDER LABEL"] },
      { id: "opt.labels.notes", label: "Notes", kind: "comment" },
    ],
  },
  {
    id: "opt.packaging",
    title: "Packaging",
    optional: true,
    questions: [
      { id: "opt.packaging.items", label: "Packaging", kind: "multi", options: ["DUST BAG", "STUFFING", "POLY BAG", "HANGTAG", "CARTON"], required: true },
      { id: "opt.packaging.notes", label: "Notes", kind: "comment" },
    ],
  },
  {
    id: "opt.testing",
    title: "Testing / compliance",
    optional: true,
    questions: [
      { id: "opt.testing.items", label: "Tests", kind: "multi", options: ["PROP 65", "CPSIA LEAD", "REACH", "COLOURFAST", "FOOD CONTACT", "WATERPROOF"], required: true },
      { id: "opt.testing.notes", label: "Notes", kind: "comment" },
    ],
  },
];
