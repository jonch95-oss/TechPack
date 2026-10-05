/**
 * Which standard pages a pack gets (V2.1 §2.4 — one layout for every brand), in order, with empty
 * pages skipped and page numbers / cross-references computed after skipping. A page also prints when
 * a comment or photo is assigned to it (golden run 1, P0.2).
 */
import type { PageSection } from "@/lib/page-names";

export type PlanInput = {
  hasInterior: boolean;
  /** The colourways page (variant table) prints when the pack has materials or colourway renders. */
  hasColourways?: boolean;
  hasExtraMeasurements: boolean;
  colorwayRenderCount: number;
  referencePhotoCount: number;
  hasLiningArtwork: boolean;
  liningArtworkOnInterior: boolean;
  detailPanelCount: number;
  /** One entry per swatch card (a card used by several colourways is one entry). */
  swatches: { colorway: string; materialCallout: number }[];
  swatchesOnOnePage: boolean;
  revisionCount: number;
  hasConstruction?: boolean;
  hasBom?: boolean;
  hasSampleComments?: boolean;
  /** Pages that print because a comment or photo is assigned to them. */
  forced?: PageSection[];
  /** TRIMS & HARDWARE runs over this many pages (panels that don't fit continue as "(2/3)"). */
  trimsPages?: number;
  /** SPECIFICATIONS pages after OVERVIEW: the answers the overview has no room for. */
  specPages?: number;
  /** A Hardware-category pack is one component sheet: the TRIMS & HARDWARE page only. */
  componentOnly?: boolean;
  /** Swatch-card page for each colourway × material (a shared card is listed under every colourway it serves). */
  swatchUse?: { colorway: string; materialCallout: number; card: number }[];
};

export type Part = { i: number; of: number };

export type PlannedPage =
  | { section: "OVERVIEW" }
  | { section: "SPECIFICATIONS"; part: Part }
  | { section: "MEASUREMENTS" }
  | { section: "REFERENCE IMAGES" }
  | { section: "COLOURWAYS" }
  | { section: "INTERIOR & LINING"; withArtwork: boolean }
  | { section: "LINING / PRINT ARTWORK" }
  | { section: "TRIMS & HARDWARE"; part: Part }
  | { section: "SWATCH CARDS"; swatches: { colorway: string; materialCallout: number }[] }
  | { section: "CONSTRUCTION DETAILS" }
  | { section: "BILL OF MATERIALS" }
  | { section: "CHANGE LOG" }
  | { section: "SAMPLE COMMENTS" };

export type Plan = {
  pages: (PlannedPage & { n: number })[];
  total: number;
  /** "7/8" for the page holding a colorway × material swatch card. */
  swatchRef: (colorway: string, callout: number) => string | null;
  /** Page holding the lining artwork. */
  artworkRef: () => string | null;
  ref: (section: PageSection) => string | null;
  has: (section: string) => boolean;
};

export function planPages(i: PlanInput): Plan {
  const forced = new Set<string>(i.forced ?? []);
  const pages: PlannedPage[] = [];
  const parts = (n: number) => Array.from({ length: Math.max(1, n) }, (_, k) => ({ i: k + 1, of: Math.max(1, n) }));
  if (i.componentOnly) {
    for (const part of parts(i.trimsPages ?? 1)) pages.push({ section: "TRIMS & HARDWARE", part });
  } else {
    pages.push({ section: "OVERVIEW" });
    if (i.specPages) for (const part of parts(i.specPages)) pages.push({ section: "SPECIFICATIONS", part });
    if (i.hasExtraMeasurements || forced.has("MEASUREMENTS")) pages.push({ section: "MEASUREMENTS" });
    if (i.referencePhotoCount > 0 || forced.has("REFERENCE IMAGES")) pages.push({ section: "REFERENCE IMAGES" });
    if (i.hasColourways || i.colorwayRenderCount > 0 || forced.has("COLOURWAYS")) pages.push({ section: "COLOURWAYS" });
    if (i.detailPanelCount > 0 || forced.has("TRIMS & HARDWARE")) for (const part of parts(i.trimsPages ?? 1)) pages.push({ section: "TRIMS & HARDWARE", part });
    if (i.hasInterior || forced.has("INTERIOR & LINING")) pages.push({ section: "INTERIOR & LINING", withArtwork: i.hasLiningArtwork && i.liningArtworkOnInterior });
    if (i.hasLiningArtwork && !(pages.some((p) => p.section === "INTERIOR & LINING") && i.liningArtworkOnInterior)) pages.push({ section: "LINING / PRINT ARTWORK" });
    if (i.hasConstruction || forced.has("CONSTRUCTION DETAILS")) pages.push({ section: "CONSTRUCTION DETAILS" });
    if (i.hasBom || forced.has("BILL OF MATERIALS")) pages.push({ section: "BILL OF MATERIALS" });
    if (i.swatches.length) {
      if (i.swatchesOnOnePage) pages.push({ section: "SWATCH CARDS", swatches: i.swatches });
      else for (const s of i.swatches) pages.push({ section: "SWATCH CARDS", swatches: [s] });
    }
  }
  if (i.hasSampleComments) pages.push({ section: "SAMPLE COMMENTS" });
  if (i.revisionCount > 0) pages.push({ section: "CHANGE LOG" });

  const numbered = pages.map((p, k) => ({ ...p, n: k + 1 }));
  const total = numbered.length;
  const tag = (n: number) => `${n}/${total}`;
  return {
    pages: numbered,
    total,
    swatchRef: (cw, callout) => {
      // A card shared by several colourways prints once: find the card this colourway × material uses.
      const use = i.swatchUse?.find((s) => s.colorway === cw && s.materialCallout === callout);
      const card = use ? i.swatches[use.card] : { colorway: cw, materialCallout: callout };
      const p = numbered.find((x) => x.section === "SWATCH CARDS" && x.swatches.some((s) => s.colorway === card?.colorway && s.materialCallout === card?.materialCallout));
      return p ? tag(p.n) : null;
    },
    artworkRef: () => {
      const p = numbered.find((x) => x.section === "LINING / PRINT ARTWORK") ?? numbered.find((x) => x.section === "INTERIOR & LINING" && x.withArtwork);
      return p ? tag(p.n) : null;
    },
    ref: (section) => {
      const p = numbered.find((x) => x.section === section);
      return p ? tag(p.n) : null;
    },
    has: (section) => numbered.some((x) => x.section === section),
  };
}

/**
 * How TRIMS & HARDWARE splits over pages (golden run 1, P0.3): component panels in order, as many as
 * fit the page (one panel alone gets the tall layout), then the logo / embellishment rows, then the
 * photos — each continuing on a new page when the current one is full.
 */
export const TRIMS = { area: 9.2, panel: 3.9, single: 5.4, gap: 0.2, row: 2.6, width: 16.2 } as const;
export type TrimsPage = { from: number; to: number; rows: number[]; photos: false | "grid" | "row" };

/** A logo panel's width on the page: wider when it carries the part's photo. */
export function logoPanelWidth(p: { photoUrl?: string | null }) {
  return p.photoUrl ? 9.2 : 3.9;
}

/** Logo panels (by width, inches) packed into rows across the page: the panel indices of each row. */
export function logoRows(widths: number[], max: number = TRIMS.width, gap = 0.3): number[][] {
  const rows: number[][] = [];
  let used = Infinity;
  widths.forEach((w, i) => {
    if (used + gap + w > max) {
      rows.push([i]);
      used = w;
    } else {
      rows[rows.length - 1].push(i);
      used += gap + w;
    }
  });
  return rows;
}

/** `rowWidths`: how wide each logo row is (inches), so photos can sit beside a short one. */
export function trimsLayout(panels: number, rowWidths: number[], hasPhotos = false): TrimsPage[] {
  const h = (panels > 1 ? TRIMS.panel : TRIMS.single) + TRIMS.gap;
  const perPage = Math.max(1, Math.floor((TRIMS.area + TRIMS.gap) / h));
  const pages: TrimsPage[] = [];
  for (let k = 0; k < panels; k += perPage) pages.push({ from: k, to: Math.min(panels, k + perPage), rows: [], photos: false });
  const used = (p: TrimsPage) => (p.to - p.from) * h + p.rows.length * TRIMS.row;
  rowWidths.forEach((_, r) => {
    const last = pages[pages.length - 1];
    if (last && used(last) + TRIMS.row <= TRIMS.area) last.rows.push(r);
    else pages.push({ from: panels, to: panels, rows: [r], photos: false });
  });
  // Photos need room to be read (golden run 2 #3): a grid in at least 3 in, else beside a short last
  // logo row, else a page of their own.
  if (hasPhotos) {
    const last = pages[pages.length - 1];
    const lastRow = last?.rows[last.rows.length - 1];
    if (last && TRIMS.area - used(last) >= 3) last.photos = "grid";
    else if (last && lastRow != null && rowWidths[lastRow] <= TRIMS.width - 3.6) last.photos = "row";
    else pages.push({ from: panels, to: panels, rows: [], photos: "grid" });
  }
  return pages.length ? pages : [{ from: 0, to: 0, rows: [], photos: false }];
}
