import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "designer", "viewer"]);

/**
 * Status of a single captured value.
 * - ai: AI-suggested from the render ("AI-SUGGESTED — CONFIRM")
 * - est: AI estimate of a measurement ("EST — CONFIRM")
 * - inferred: not visible in a front render ("INFERRED — CONFIRM")
 * - confirmed: entered or confirmed by a designer
 */
export const answerStatusEnum = pgEnum("answer_status", ["ai", "est", "inferred", "confirmed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("designer"),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  /** Temporary passwords set by an admin must be changed at first sign-in. */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  /** e.g. PINK, TB */
  codePrefix: text("code_prefix").notNull(),
  /**
   * Code format; `#` characters are digit placeholders. Defaults to prefix + "###".
   * Admin can override, e.g. "TB_HW####".
   */
  codeFormat: text("code_format").notNull(),
  logoUrl: text("logo_url"),
  /** Champion and Ted Baker packs need licensor approval fields. */
  licensorRequired: boolean("licensor_required").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FieldStatusMap = Record<string, "ai" | "confirmed">;
export type ChipBox = { x: number; y: number; w: number; h: number };

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplier: text("supplier").notNull().default(""),
    articleName: text("article_name").notNull().default(""),
    articleNo: text("article_no").notNull().default(""),
    colourNo: text("colour_no").notNull().default(""),
    colourName: text("colour_name").notNull().default(""),
    composition: text("composition").notNull().default(""),
    thickness: text("thickness").notNull().default(""),
    width: text("width").notNull().default(""),
    finish: text("finish").notNull().default(""),
    cardPhotoUrl: text("card_photo_url"),
    /** Normalised (0..1) red box around the colour chip on the card photo. */
    chipBox: jsonb("chip_box").$type<ChipBox | null>(),
    /** Per-field "AI-read — confirm" state from read_swatch_card. */
    fieldStatus: jsonb("field_status").$type<FieldStatusMap>().notNull().default({}),
    aiNotes: text("ai_notes").notNull().default(""),
    /** Lab dip / strike-off / swatch approval. Packs using an unapproved material get a gate warning. */
    approval: jsonb("approval").$type<Approval>().notNull().default({ status: "PENDING", type: "", date: "", note: "" }),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("materials_supplier_idx").on(t.supplier)],
);

export type Approval = { status: "PENDING" | "APPROVED" | "REJECTED"; type: string; date: string; note: string };
export type FinishSpec = { plating?: string; coating?: string; nickelFree?: boolean; mouldNo?: string; newMould?: boolean; platingThickness?: string };

export type HardwareViews = { front?: string; side?: string; rear?: string; top?: string };

export const hardware = pgTable(
  "hardware",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    brandId: uuid("brand_id").references(() => brands.id),
    name: text("name").notNull().default(""),
    type: text("type").notNull(),
    /** Free mm string, e.g. "40 X 20" or "16 X 42 X 5.5". Hardware is always mm. */
    dimsMm: text("dims_mm").notNull().default(""),
    views: jsonb("views").$type<HardwareViews>().notNull().default({}),
    material: text("material").notNull().default(""),
    finish: text("finish").notNull().default(""),
    logoTreatment: text("logo_treatment").notNull().default(""),
    enamelPantone: text("enamel_pantone").notNull().default(""),
    /** "HOLLOW" | "SOLID" | "" */
    construction: text("construction").notNull().default(""),
    photoUrl: text("photo_url"),
    notes: text("notes").notNull().default(""),
    /** Detail dimensions for the 100% drawing panel, e.g. { label: "TOP WIDTH", mm: 10 } or a note like HOLLOW. */
    detailDims: jsonb("detail_dims").$type<{ label: string; mm?: number | null }[]>().notNull().default([]),
    /** Plating / coating spec, nickel-free, mould number, new mould needed. */
    finishSpec: jsonb("finish_spec").$type<FinishSpec>().notNull().default({}),
    /** Plating sample / mould / sample approval. */
    approval: jsonb("approval").$type<Approval>().notNull().default({ status: "PENDING", type: "", date: "", note: "" }),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("hardware_code_uq").on(t.code)],
);

export type PantoneColour = { system: "C" | "TCX" | "OTHER"; code: string };

export const prints = pgTable("prints", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  brandId: uuid("brand_id").references(() => brands.id),
  motif: text("motif").notNull().default(""),
  motifUrl: text("motif_url"),
  repeatType: text("repeat_type").notNull().default(""),
  tileW: text("tile_w").notNull().default(""),
  tileH: text("tile_h").notNull().default(""),
  tileUnit: text("tile_unit").notNull().default("cm"),
  colours: jsonb("colours").$type<PantoneColour[]>().notNull().default([]),
  application: text("application").notNull().default(""),
  baseFabricId: uuid("base_fabric_id").references(() => materials.id),
  baseFabricText: text("base_fabric_text").notNull().default(""),
  sourceFiles: jsonb("source_files").$type<{ name: string; url: string }[]>().notNull().default([]),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const packStatusEnum = pgEnum("pack_status", ["DRAFT", "IN_REVIEW", "APPROVED", "SENT", "PROTO_RECEIVED", "CLOSED"]);

export const packs = pgTable(
  "packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id),
    category: text("category").notNull(),
    styleNo: text("style_no").notNull(),
    styleName: text("style_name").notNull(),
    colorways: jsonb("colorways").$type<string[]>().notNull().default(["-A"]),
    chineseOn: boolean("chinese_on").notNull().default(false),
    status: packStatusEnum("status").notNull().default("DRAFT"),
    factory: text("factory").notNull().default(""),
    factoryStyleNo: text("factory_style_no").notNull().default(""),
    /** Who asked for review, and the second designer who signed it off for export. */
    reviewRequestedBy: uuid("review_requested_by").references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Pack the style was duplicated from (carry-over). */
    copiedFrom: uuid("copied_from"),
    /** Last analyse_render output: visible features / not visible / notes. */
    aiAnalysis: jsonb("ai_analysis").$type<{
      visible_features: string[];
      not_visible: string[];
      agent_notes: string;
      ran_at: string;
      model: string;
    } | null>(),
    sentBy: uuid("sent_by").references(() => users.id),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("packs_style_uq").on(t.styleNo)],
);

export type FileMarks = {
  /** Zoom detail: circular crop (fractions of the photo), printed in a thick red ring. */
  zoom?: { x: number; y: number; r: number } | null;
  /** Red dot a leader line points to (on the render: the logo). */
  dot?: { x: number; y: number } | null;
  /** SIDE_VIEW: the side-view slot on the measurements sheet. APPLICATION: how the print is applied. */
  role?: "SIDE_VIEW" | "APPLICATION" | null;
};

export const packFileKindEnum = pgEnum("pack_file_kind", [
  "render",
  "colorway_render",
  "reference",
  "construction",
  "reference_sample",
  "swatch_photo",
]);

export const packFiles = pgTable("pack_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  packId: uuid("pack_id")
    .notNull()
    .references(() => packs.id, { onDelete: "cascade" }),
  kind: packFileKindEnum("kind").notNull(),
  url: text("url").notNull(),
  name: text("name").notNull().default(""),
  /** For colorway renders: the suffix (e.g. "-B"). For references: the comment letter. */
  tag: text("tag").notNull().default(""),
  note: text("note").notNull().default(""),
  /**
   * Template page this photo prints on (e.g. a side view on the MEASUREMENTS SHEET, a binding photo
   * on INTERIOR & LINING). Null = from its comment letter's pages, as before.
   */
  page: text("page"),
  /** Mark-up: a circular zoom crop, a red dot (leader-line target) and / or the photo's role. */
  marks: jsonb("marks").$type<FileMarks>().notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const packAnswers = pgTable(
  "pack_answers",
  {
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    value: jsonb("value").$type<unknown>(),
    status: answerStatusEnum("status").notNull().default("confirmed"),
    /** What the agent saw, e.g. "2 SNAPS VISIBLE UNDER FLAP". */
    aiNote: text("ai_note").notNull().default(""),
    /** The AI's original value, kept when a designer overrides it. */
    aiValue: jsonb("ai_value").$type<unknown>(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.packId, t.questionId] })],
);

/** Which packs use which library item ("styles it is used in"). Rebuilt on every answer save. */
export const libraryUsage = pgTable(
  "library_usage",
  {
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id, { onDelete: "cascade" }),
    lib: text("lib").notNull(), // material | hardware | print
    itemId: uuid("item_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.packId, t.lib, t.itemId] }), index("library_usage_item_idx").on(t.itemId)],
);

/** Every edit records who made it and when. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    field: text("field"),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

export type User = typeof users.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Hardware = typeof hardware.$inferSelect;
export type Print = typeof prints.$inferSelect;
export type Pack = typeof packs.$inferSelect;
export type PackFile = typeof packFiles.$inferSelect;
export type PackAnswer = typeof packAnswers.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type AnswerStatus = (typeof answerStatusEnum.enumValues)[number];

/** Factory questions and our answers, so the next designer can see why something changed. */
export const factoryQuestions = pgTable("factory_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  packId: uuid("pack_id")
    .notNull()
    .references(() => packs.id, { onDelete: "cascade" }),
  askedBy: text("asked_by").notNull().default(""),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  answeredBy: uuid("answered_by").references(() => users.id),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sampleStageEnum = pgEnum("sample_stage", ["PROTO", "SMS", "PP", "TOP"]);

/** A sample round (proto, salesman sample, pre-production, top of production). */
export const sampleRounds = pgTable("sample_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  packId: uuid("pack_id")
    .notNull()
    .references(() => packs.id, { onDelete: "cascade" }),
  stage: sampleStageEnum("stage").notNull(),
  number: integer("number").notNull().default(1),
  receivedAt: text("received_at").notNull().default(""),
  factory: text("factory").notNull().default(""),
  verdict: text("verdict").notNull().default("PENDING"), // PENDING | APPROVED | APPROVED W/ COMMENTS | REJECTED
  notes: text("notes").notNull().default(""),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Markup = { x: number; y: number; r: number; letter: string }[];

export const sampleComments = pgTable("sample_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id")
    .notNull()
    .references(() => sampleRounds.id, { onDelete: "cascade" }),
  letter: text("letter").notNull(),
  text: text("text").notNull(),
  photoUrl: text("photo_url"),
  markup: jsonb("markup").$type<Markup>().notNull().default([]),
  status: text("status").notNull().default("OPEN"), // OPEN | ACCEPTED | REVISE
  /** Comment this one was carried over from (previous round). */
  carriedFrom: uuid("carried_from"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PackStatus = (typeof packStatusEnum.enumValues)[number];
export type SampleRound = typeof sampleRounds.$inferSelect;
export type SampleComment = typeof sampleComments.$inferSelect;
export type FactoryQuestion = typeof factoryQuestions.$inferSelect;

/* ------------------------------------------------------------------ */
/* Phase 3 — line art                                                  */
/* ------------------------------------------------------------------ */

export const flatViewEnum = pgEnum("flat_view", ["FRONT", "BACK", "SIDE", "TOP"]);

/**
 * One editable technical flat per pack and view. `svg` is the layered drawing (layers: fill,
 * outline, stitching, hardware, callouts, dimensions) in the traced image's pixel space; its root
 * carries `data-px-per-unit` once scaled to the entered H × W (× D).
 * Status: DRAFT (generated, editable) · INFERRED (back view — "INFERRED — CONFIRM" until approved)
 * · CONFIRMED.
 */
export const flats = pgTable(
  "flats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id, { onDelete: "cascade" }),
    view: flatViewEnum("view").notNull(),
    status: text("status").notNull().default("DRAFT"),
    /** AI (image API) · TRACE (traced straight from the render) · UPLOAD (designer's own drawing) */
    source: text("source").notNull().default("AI"),
    /** The raster the vectors were traced from (kept for re-tracing regions). */
    sourceUrl: text("source_url"),
    svg: text("svg").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("flats_pack_view_idx").on(t.packId, t.view)],
);

/* ------------------------------------------------------------------ */
/* Phase 4 — revisions and Chinese                                     */
/* ------------------------------------------------------------------ */

export type RevisionChange = { questionId: string; label: string; before: string; after: string; sections: string[] };

/**
 * Number 0 is the original (its date is the ORIGINAL DATE SENT); 1… are R1, R2, … Each keeps the
 * answers and flats as sent, the automatic change log against the previous one, and its PDF.
 */
export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    snapshot: jsonb("snapshot").$type<{ answers: Record<string, unknown>; flats: Record<string, string> }>().notNull(),
    changes: jsonb("changes").$type<RevisionChange[]>().notNull().default([]),
    pdfUrl: text("pdf_url"),
    pages: integer("pages").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("revisions_pack_number_idx").on(t.packId, t.number)],
);

/** Admin-maintained trade glossary; always wins over machine translation. */
export const glossary = pgTable("glossary", {
  id: uuid("id").primaryKey().defaultRandom(),
  en: text("en").notNull().unique(),
  zh: text("zh").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Cache of machine translations of whole lines (glossary terms are applied before the model). */
export const translations = pgTable("translations", {
  en: text("en").primaryKey(),
  zh: text("zh").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Flat = typeof flats.$inferSelect;
export type FlatView = (typeof flatViewEnum.enumValues)[number];
export type Revision = typeof revisions.$inferSelect;
