import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { traceLineArt } from "@/lib/lineart/trace";
import { untraceable } from "@/lib/lineart/generate";
import { annotate, flatSvg, readDimensions, readMeta, replaceLayer, setDimMeta, splitContours, tracedLayers } from "@/lib/lineart/geometry";

/** A 1000 × 700 "flat": a 2 px rectangle body with a dashed stitch line inside it. */
async function drawing() {
  const dashes = Array.from({ length: 20 }, (_, i) => `<line x1="${230 + i * 27}" y1="250" x2="${244 + i * 27}" y2="250" stroke="#000" stroke-width="3"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><rect width="1000" height="700" fill="#fff"/><rect x="200" y="200" width="600" height="400" fill="none" stroke="#000" stroke-width="4"/>${dashes}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("line art", () => {
  it("traces closed outlines and puts stitch dashes on their own layer", async () => {
    const t = await traceLineArt(await drawing());
    const pad = Math.round(1000 * 0.14);
    expect(t.w).toBe(1000 + 2 * pad);
    expect(t.outline.length).toBe(1);
    expect(t.stitching.length).toBeGreaterThanOrEqual(18);
    expect(t.bbox!.x).toBeCloseTo(198 + pad, -1);
    expect(t.bbox!.w).toBeCloseTo(604, -1);
    // The silhouette fills the whole body rectangle.
    const sil = splitContours(t.silhouette!)[0];
    expect(sil.bbox.w).toBeGreaterThan(560);
    expect(Math.abs(sil.area)).toBeGreaterThan(560 * 360);
  });

  it("scales to the entered W and draws dimension lines that read true", async () => {
    const t = await traceLineArt(await drawing());
    const base = flatSvg({ view: "FRONT", unit: "cm", pxPerUnit: null, bbox: t.bbox, w: t.w, h: t.h }, tracedLayers(t));
    const res = annotate({
      view: "FRONT",
      unit: "cm",
      w: t.w,
      h: t.h,
      bbox: t.bbox,
      dims: { h: 16, w: 20, d: 8 },
      extras: { handleDrop: 6.5, flapHeight: 7.5, logoOffsetMm: 15 },
      materials: [{ callout: 1, name: "MAIN BODY MTL", locations: ["FRONT", "FLAP"] }],
      comments: [{ letter: "A" }],
      logo: { code: "PINK005", type: "METAL PLATE" },
    });
    expect(res.pxPerUnit).toBeCloseTo(t.bbox!.w / 20, 5);
    let svg = setDimMeta(base, { pxPerUnit: res.pxPerUnit, unit: "cm", view: "FRONT" });
    svg = replaceLayer(svg, "dimensions", res.dimensions);
    svg = replaceLayer(svg, "callouts", res.callouts);
    const dims = Object.fromEntries(readDimensions(svg).map((d) => [d.key, d.text]));
    expect(dims).toMatchObject({ W: "20 CM", H: "16 CM", HANDLE_DROP: "6.5 CM", FLAP: "7.5 CM", LOGO_OFFSET: "1.5 CM" });
    expect(svg).toContain(">20 CM<");
    expect(svg).toContain(">HANDLE DROP 6.5 CM<");
    expect(svg).toContain(">LOGO PINK005<");
    // Layers survive replacement and metadata reads back.
    expect(readMeta(svg)).toMatchObject({ view: "FRONT", unit: "cm", w: t.w, h: t.h });
    for (const id of ["fill", "outline", "stitching", "hardware", "dimensions", "callouts"]) expect(svg).toContain(`id="${id}"`);
  });

  it("reads Paper.js-style double-quoted metadata", () => {
    const svg = `<svg viewBox="0 0 100 50"><g id="outline" data-paper-data="{&quot;bbox&quot;:{&quot;x&quot;:0,&quot;y&quot;:0,&quot;w&quot;:50,&quot;h&quot;:20}}"></g><g id="dimensions" data-paper-data="{&quot;pxPerUnit&quot;:2.5,&quot;unit&quot;:&quot;in&quot;}"><g data-paper-data="{&quot;kind&quot;:&quot;dim&quot;,&quot;key&quot;:&quot;W&quot;,&quot;x1&quot;:0,&quot;y1&quot;:0,&quot;x2&quot;:25.625,&quot;y2&quot;:0}"></g></g></svg>`;
    expect(readMeta(svg)).toMatchObject({ pxPerUnit: 2.5, unit: "in", bbox: { w: 50 } });
    expect(readDimensions(svg)[0].text).toBe('10.25"');
  });

  it("splits potrace paths into contours with signed area", () => {
    const c = splitContours("M 0 0 L 10 0 L 10 10 L 0 10 Z M 2 2 L 2 8 L 8 8 L 8 2 Z");
    expect(c).toHaveLength(2);
    expect(Math.sign(c[0].area)).not.toBe(Math.sign(c[1].area));
    expect(c[0].bbox).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });
});

describe("trace fallback guard (round 3, item 6)", () => {
  const board = (fill: string, defs = "") =>
    sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs>${defs}</defs><rect width="600" height="600" fill="#fff"/><rect x="100" y="150" width="400" height="300" fill="${fill}" stroke="#555" stroke-width="3"/></svg>`)).png().toBuffer();
  it("traces a light product", async () => {
    expect(await untraceable(await board("#d9c7b0"))).toBe("");
  });
  it("refuses a dark product (traces as a solid blob)", async () => {
    expect(await untraceable(await board("#151515"))).toMatch(/too dark/);
  });
  it("refuses a sheer / micro-mesh product", async () => {
    const mesh = `<pattern id="m" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#ddd"/><circle cx="3" cy="3" r="1.6" fill="#222"/></pattern>`;
    expect(await untraceable(await board("url(#m)", mesh))).toMatch(/sheer/);
  });
});
