/**
 * Seeds the TB25_ACC0023 Ted Baker Dopp kit (BRIEF Part 6 item 2) straight into the test database,
 * using only what the reference pack states. Phase 1's PINK013 test already covers entering a pack
 * through the click-through UI; this gives Phase 2 a second, very different pack to print.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { brands, hardware, materials, packAnswers, packFiles, packs, prints, users } from "../../src/db/schema";
import type { tbAssets } from "./assets";

type Assets = NonNullable<ReturnType<typeof tbAssets>>;

export async function seedTb25(a: Assets, adminEmail: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const db = drizzle(sql);
  const dir = path.join(process.cwd(), ".data", "uploads", "e2e-tb");
  mkdirSync(dir, { recursive: true });
  const file = (name: string, data: Buffer) => {
    writeFileSync(path.join(dir, name), data);
    return `/api/files/e2e-tb/${name}`;
  };

  const [user] = await db.select().from(users).where(eq(users.email, adminEmail));
  const [tb] = await db.select().from(brands).where(eq(brands.name, "Ted Baker"));
  const existing = await db.select().from(packs).where(eq(packs.styleNo, "TB25_ACC0023"));
  if (existing.length) {
    await sql.end();
    return existing[0].id;
  }

  /* ---- library ---- */
  const card1 = file("jinxin-401-823.jpg", a.swatchBlackBrown);
  const card2 = file("jinxin-609.jpg", a.swatchNavy);
  const jinxin = async (colourNo: string, colourName: string, photo: string, chipBox: { x: number; y: number; w: number; h: number }) =>
    (
      await db
        .insert(materials)
        .values({
          supplier: "JINXIN",
          articleName: "GINGHAM EFFECT PU",
          articleNo: "AH316HB-P",
          colourNo,
          colourName,
          cardPhotoUrl: photo,
          chipBox,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning()
    )[0];
  const black = await jinxin("401HB", "BLACK", card1, { x: 0.02, y: 0.03, w: 0.96, h: 0.42 });
  const brown = await jinxin("823HB", "BROWN", card1, { x: 0.02, y: 0.53, w: 0.96, h: 0.4 });
  const navy = await jinxin("609HB", "NAVY", card2, { x: 0.05, y: 0.02, w: 0.9, h: 0.96 });

  const [lining] = await db
    .insert(prints)
    .values({
      name: "TED BAKER LINK LINING PRINT",
      brandId: tb.id,
      motif: "TED BAKER LINK",
      motifUrl: file("lining-tile.png", a.lining),
      repeatType: "STRAIGHT",
      tileW: "14",
      tileH: "20.8",
      tileUnit: "mm",
      colours: [
        { system: "OTHER", code: "BLACK" },
        { system: "TCX", code: "17-3914 TCX SHARKSKIN" },
      ],
      application: "DIGITAL PRINT",
      baseFabricText: "190D POLY HEAT SEAL TEXTURE",
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  // TB001 / TB002 are created by the PDF import test; make sure they exist and carry the detail views.
  const upsertHw = async (code: string, values: Partial<typeof hardware.$inferInsert>) => {
    const [h] = await db.select().from(hardware).where(eq(hardware.code, code));
    if (h) return (await db.update(hardware).set(values).where(eq(hardware.id, h.id)).returning())[0];
    return (await db.insert(hardware).values({ code, brandId: tb.id, type: values.type!, ...values }).returning())[0];
  };
  const pull = await upsertHw("TB001", {
    type: "ZIPPER PULL",
    name: "TED BAKER ZIPPER PULL",
    dimsMm: "16 X 42",
    material: "ZINC ALLOY",
    finish: "GUNMETAL",
    logoTreatment: "INKED METALLIC LOGO",
    enamelPantone: "DTM TO TRIM",
    construction: "HOLLOW",
    notes: "EMBOSSED ENAMEL INLAY DTM TO THE TRIM W/ FRONT METALLIC LOGO INKED. BEVELLED. ETCHED DESIGN ON THE SIDE.",
    views: { front: file("pull-front.png", a.pullFront), side: file("pull-side.png", a.pullSide) },
    detailDims: [
      { label: "PULL WIDTH", mm: 10 },
      { label: "PULL THICKNESS", mm: 2.4 },
      { label: "PULL LENGTH", mm: 42 },
      { label: "SLIDER LENGTH", mm: 22 },
      { label: "LOGO PLATE WIDTH", mm: 8 },
      { label: "LOGO PLATE LENGTH", mm: 14.5 },
      { label: "SLOT LENGTH", mm: 5.5 },
      { label: "HOLLOW" },
    ],
  });
  const patch = await upsertHw("TB002", {
    type: "DEBOSS/EMBOSS PATCH",
    name: "PU DEBOSSED LOGO PATCH",
    dimsMm: "55 X 21.8",
    finish: "GUNMETAL",
    logoTreatment: "DEBOSSED GROOVE",
    photoUrl: file("logo-patch.png", a.logo),
  });

  /* ---- pack ---- */
  const [pack] = await db
    .insert(packs)
    .values({
      brandId: tb.id,
      category: "Toiletry kits",
      styleNo: "TB25_ACC0023",
      styleName: "GINGHAM PU MEN'S DOPP KIT",
      colorways: ["-A", "-B", "-C"],
      sentBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  const lib = (row: { id: string }, label: string) => ({ id: row.id, label });
  const answers: Record<string, unknown> = {
    "header.description": "GINGHAM PU MEN'S DOPP KIT",
    "header.due_date": "ASAP",
    "header.licensor": "TED BAKER",
    "header.licensor_submission": "TO FOLLOW",
    "header.licensor_status": "NOT SUBMITTED",
    "dims.unit": "INCHES",
    "dims.h": 5.25,
    "dims.w": 10.25,
    "dims.d": 4.25,
    "colorways.names": { "-A": "BLACK", "-B": "BROWN", "-C": "NAVY" },
    "cos.shape": "BOX / DOPP",
    "cos.zip_size": "#8",
    "cos.zip_type": "PLASTIC W/ METAL FINISH",
    "cos.zip_tape": "DTM",
    "cos.zip_teeth": "GUNMETAL",
    "cos.zip_path": "TOP",
    "cos.puller": lib(pull, "TB001"),
    "cos.side_handle": true,
    "cos.side_handle_width": 22,
    "cos.side_handle_doubled": true,
    "cos.lining": "PRINTED POLY",
    "cos.interior_pockets": ["ZIP"],
    "cos.padding": true,
    "cos.padding_mm": 1,
    "cos.padding_where": "ALL OVER",
    "materials.list": [
      { callout: 1, name: "GINGHAM EFFECT PU LEATHER", locations: ["FRONT", "BACK", "BASE"] },
      { callout: 2, name: "SMOOTH PU LEATHER TRIM", locations: ["TRIM", "HANDLE", "PIPING"] },
    ],
    "materials.matrix": Object.fromEntries(
      (
        [
          ["-A", black, "BLACK", "#8 PLASTIC W/ METAL FINISH, BLACK TAPE, GUNMETAL COLOR TEETH"],
          ["-B", brown, "DTM", "#8 PLASTIC W/ METAL FINISH, DTM TAPE, GUNMETAL COLOR TEETH"],
          ["-C", navy, "DTM", "#8 PLASTIC W/ METAL FINISH, DTM TAPE, GUNMETAL COLOR TEETH"],
        ] as const
      ).map(([cw, mat, trim, zip]) => [
        cw,
        {
          mat_1: { lib: lib(mat, `JINXIN GINGHAM EFFECT PU / ${mat.colourNo} ${mat.colourName}`) },
          mat_2: { text: trim },
          lining: { lib: lib(lining, `PRINT: ${lining.name}`) },
          edge_paint: { text: "BLACK" },
          zipper: { text: zip },
          hardware_finish: { text: "GUNMETAL" },
          logo: { text: "PU DEBOSSED LOGO PATCH WITH GUNMETAL FILLING REF TO TB002" },
        },
      ]),
    ),
    "branding.logo_type": "DEBOSS PATCH",
    "branding.logo_code": lib(patch, "TB002"),
    "branding.logo_size": { w: 55, h: 21.8 },
    "branding.fill": "GUNMETAL",
    "edge.treatment": "EDGE PAINT",
    "edge.paint_colour": "BLACK",
    "hardware.finish": "GUNMETAL",
    "hardware.items": [
      { item: lib(pull, "TB001"), qty: 1, placement: "MAIN ZIP" },
      { item: lib(patch, "TB002"), qty: 1, placement: "FRONT" },
    ],
    "interior.lined": true,
    "interior.lining_artwork_type": "PRINT (LIBRARY)",
    "interior.lining_print": lib(lining, `PRINT: ${lining.name}`),
    "interior.pockets": [{ type: "ZIP POCKET", wall: "SIDE 1", zip_size: "#5" }],
    "interior.seam_binding": true,
    "comments.list": [
      { text: "DOUBLED PU 22MM HANDLE. PLEASE EDGE PAINT ALL PU IN BLACK.", pages: ["MATERIALS / HARDWARE"] },
      { text: "#5 NYLON COIL ZIPPERED POCKET ON INTERIOR SIDE 1.", pages: ["INTERIOR & LINING"] },
      { text: "PLEASE MAKE SURE TO ADD INTERIOR BINDING.", pages: ["INTERIOR & LINING"] },
    ],
    "pages.product_features": true,
    "pages.features": [
      "ZIPPERED MAIN COMPARTMENT",
      "BACK ZIPPERED POCKET",
      "PU TRIM",
      "GINGHAM EFFECT PU BODY",
      "PU DEBOSSED LOGO",
      "GUNMETAL HARDWARE",
      "INTERIOR ORG",
      "PRINTED LINING",
      "1MM PADDING ALL OVER",
    ].map((text) => ({ text })),
    "pages.lining_artwork": "ON INTERIOR PAGE",
    "pages.swatches": "ALL ON ONE PAGE",
  };
  await db.insert(packAnswers).values(Object.entries(answers).map(([questionId, value]) => ({ packId: pack.id, questionId, value, status: "confirmed" as const, updatedBy: user.id })));
  await db.insert(packFiles).values([
    { packId: pack.id, kind: "render", url: file("render.png", a.render), name: "TB25_ACC0023.png", marks: { dot: { x: 0.69, y: 0.73 } }, createdBy: user.id },
    ...a.refs.map((r, i) => ({ packId: pack.id, kind: "reference" as const, url: file(`ref-${i + 1}.jpg`, r), name: `ref-${i + 1}.jpg`, tag: String.fromCharCode(68 + i), note: "REFERENCE IMAGES", createdBy: user.id })),
    { packId: pack.id, kind: "construction", url: file("binding.jpg", a.binding), name: "binding.jpg", tag: "C", note: "PLEASE MAKE SURE TO ADD INTERIOR BINDING", page: "INTERIOR & LINING", marks: { dot: { x: 0.5, y: 0.5 } }, createdBy: user.id },
    { packId: pack.id, kind: "construction", url: file("teeth.jpg", a.teeth), name: "teeth.jpg", tag: "G", note: "METAL FINISH PLASTIC TEETH REFERENCE", page: "HARDWARE / BRANDING DETAIL", createdBy: user.id },
  ]);
  await sql.end();
  return pack.id;
}
