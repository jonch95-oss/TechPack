/**
 * Click-through question bank types (BRIEF Part 3).
 *
 * UI conventions: chips = single select, multi = multi-select, toggle = yes/no,
 * stepper = number with unit, lib = library picker with "+ New".
 * Every chip set ends with "Other…" (rendered by the UI, value stored as the typed text).
 * Free text is only allowed in "Other" and Comments (plus the header identity fields).
 */

export const CATEGORIES = [
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
  "Hardware",
  "Decorative hardware",
  "Print artwork",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type LibKind = "material" | "hardware" | "print";

/** Unit of a stepper. "dim" follows the pack's chosen unit (cm / in). */
export type StepUnit = "dim" | "mm" | "qty" | "in" | "L" | "h" | "spi" | "deg" | "D" | "%";

export type Condition =
  | { q: string; eq: unknown }
  | { q: string; in: readonly unknown[] }
  | { q: string; truthy: true }
  | { q: string; includes: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { category: readonly Category[] };

type Base = {
  id: string;
  label: string;
  /** ★ — required, blocks export */
  required?: boolean;
  showIf?: Condition;
  help?: string;
  /** Whether a front render can show this. Back / interior / underside answers are "INFERRED — CONFIRM". */
  visibility?: "visible" | "inferred" | "never";
};

export type ChipsQ = Base & { kind: "chips"; options: string[]; noOther?: boolean };
export type MultiQ = Base & { kind: "multi"; options: string[]; noOther?: boolean };
export type ToggleQ = Base & { kind: "toggle" };
export type StepperQ = Base & { kind: "stepper"; unit: StepUnit; min?: number; step?: number };
export type DimsQ = Base & { kind: "dims2"; unit: StepUnit };
export type LibQ = Base & { kind: "lib"; lib: LibKind; hardwareTypes?: string[]; multi?: false };
export type TextQ = Base & { kind: "text"; placeholder?: string };
export type CommentQ = Base & { kind: "comment" };
/** A file upload (e.g. vector logo artwork for the deboss die). Value: { url, name }. */
export type FileQ = Base & { kind: "file"; accept?: string };
export type DateQ = Base & { kind: "date_asap" };
export type DerivedQ = Base & { kind: "derived"; from: string; unit: StepUnit };

type ColBase = {
  key: string;
  label: string;
  required?: boolean;
  /** Required only while this optional section is switched on (e.g. POM tolerance ↔ "opt.tolerances"). */
  requiredWithSection?: string;
  showIf?: { key: string; in: string[] };
  noOther?: boolean;
};
export type Column = ColBase &
  (
    | { kind: "chips"; options: string[] }
    | { kind: "multi"; options: string[] }
    | { kind: "stepper"; unit: StepUnit }
    | { kind: "toggle" }
    | { kind: "text" }
    | { kind: "lib"; lib: LibKind; hardwareTypes?: string[] }
  );

/** A repeating table (pockets, hardware items, set composition …). */
export type RowsQ = Base & { kind: "rows"; columns: Column[]; addLabel?: string; minRows?: number };

/** Auto-detected list of materials; each gets a callout number. */
export type MaterialsQ = Base & { kind: "materials" };
/** Per colorway × per material / lining / edge paint / hardware finish / zipper / logo. */
export type MatrixQ = Base & { kind: "colorway_matrix" };
/** A text per colorway (e.g. colorway names). */
export type PerColorwayQ = Base & { kind: "per_colorway_text" };

export type Question =
  | ChipsQ
  | MultiQ
  | ToggleQ
  | StepperQ
  | DimsQ
  | LibQ
  | TextQ
  | CommentQ
  | FileQ
  | DateQ
  | DerivedQ
  | RowsQ
  | MaterialsQ
  | MatrixQ
  | PerColorwayQ;

export type Section = {
  id: string;
  title: string;
  /** Optional sections are collapsed and off by default (turned on per pack). */
  optional?: boolean;
  showIf?: Condition;
  questions: Question[];
};

/** Values stored for each kind. */
export type LibValue = { id: string; label: string };
export type MaterialEntry = {
  callout: number;
  name: string;
  locations: string[];
  /** Grain / nap / print direction on the cut panels. */
  direction?: string;
  /** Pattern matching at seams (checks, stripes, placed prints). */
  matching?: string;
};
export type MatrixCell = { lib?: LibValue; text?: string };
export type MatrixValue = Record<string, Record<string, MatrixCell>>;
export type Dims2Value = { w: number | null; h: number | null };

export type AnswerMap = Record<string, unknown>;
