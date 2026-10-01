import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
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
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("materials_supplier_idx").on(t.supplier)],
);

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
