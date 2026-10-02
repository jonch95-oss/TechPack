import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PackDoc } from "./doc";

/**
 * ICON template pages (BRIEF Part 4) as print HTML: 17 × 11 in landscape, condensed bold type,
 * everything in CAPITALS, PAGE n/N + section tag at top right. Vector where possible (text, tables,
 * dimension diagrams are HTML/SVG; renders and photos are embedded images).
 */

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const up = (s: unknown) => esc(String(s ?? "").toUpperCase());

let fontCss: string | null = null;
function fonts() {
  if (fontCss) return fontCss;
  const f = readFileSync(path.join(process.cwd(), "src", "assets", "fonts", "RobotoCondensed-latin.woff2")).toString("base64");
  fontCss = `@font-face{font-family:"IconCond";src:url(data:font/woff2;base64,${f}) format("woff2");font-weight:300 900;font-style:normal;}`;
  return fontCss;
}

const CSS = () => `
${fonts()}
@page { size: 17in 11in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "IconCond", "Helvetica Neue Condensed", "Arial Narrow", Arial, sans-serif; font-weight: 700; color: #111; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 17in; height: 11in; padding: 0.32in 0.4in; position: relative; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
.page:last-child { page-break-after: auto; break-after: auto; }
.red { color: #e2231a; }
.small { font-size: 9pt; }
.muted { color: #555; }
.tag { position: absolute; top: 0.32in; right: 0.4in; text-align: right; font-size: 13pt; line-height: 1.15; }
.tag .logo { max-height: 0.45in; max-width: 2.2in; margin-top: 6px; }
.style-head { font-size: 30pt; line-height: 1; }
.style-sub { font-size: 11pt; line-height: 1.3; margin-top: 4px; }
.draft { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 50; }
.draft span { font-size: 90pt; color: rgba(226,35,26,0.10); transform: rotate(-18deg); letter-spacing: 0.1em; white-space: nowrap; }
.bubble { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #e2231a; color: #fff; font-size: 11pt; flex: none; }
.callout { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #f7e400; color: #111; border: 1.5px solid #111; font-size: 12pt; flex: none; }
.comments { display: flex; flex-direction: column; gap: 8px; font-size: 11.5pt; }
.comments .c { display: flex; gap: 10px; align-items: flex-start; line-height: 1.25; }
table { border-collapse: collapse; }
.mast { border: 1.5px solid #111; font-size: 9pt; width: 10.4in; }
.mast td { border: 1px solid #111; padding: 3px 6px; vertical-align: top; }
.mast .icon { background: #111; color: #fff; font-size: 9pt; text-align: center; }
.mast .brand { font-size: 17pt; text-align: center; vertical-align: middle; }
.mast b { font-weight: 700; }
.mast .v { font-size: 12pt; }
.banner { color: #e2231a; font-size: 15pt; line-height: 1.25; }
.img { object-fit: contain; display: block; }
.breakdown { width: 100%; font-size: 10pt; border: 1.5px solid #111; }
.breakdown th, .breakdown td { border: 1px solid #111; padding: 5px 6px; text-align: center; vertical-align: middle; }
.breakdown th { font-size: 10pt; }
.breakdown td.cwy { font-size: 20pt; line-height: 1; width: 0.8in; }
.breakdown .ref { color: #e2231a; font-size: 7.5pt; display: block; margin-bottom: 2px; }
.label { font-size: 12pt; }
.big-label { font-size: 18pt; }
.dim { color: #e2231a; font-size: 13pt; }
.box { border: 1.5px solid #111; padding: 10px 14px; }
table.spec { width: 100%; border: 1.5px solid #111; font-size: 8.5pt; }
table.spec th, table.spec td { border: 1px solid #111; padding: 3px 5px; text-align: center; vertical-align: middle; }
table.spec th { background: #111; color: #fff; font-size: 8pt; }
table.spec td.code { font-size: 9pt; white-space: nowrap; }
ul.feat { margin: 0; padding-left: 0; list-style: none; font-size: 11pt; line-height: 1.6; }
ul.feat li::before { content: "-  "; }
`;

function tag(doc: PackDoc, n: number, section: string) {
  return `<div class="tag">PAGE ${n}/${doc.plan.total}<br/>${esc(section)}${doc.brand.logo ? `<br/><img class="logo" src="${doc.brand.logo.src}"/>` : ""}</div>`;
}

function head(doc: PackDoc, n: number, section: string) {
  return `<div class="style-head">${up(doc.pack.styleNo)}</div><div class="style-sub">PAGE ${n}/${doc.plan.total}<br/>${esc(section)}</div>${doc.brand.logo ? `<img src="${doc.brand.logo.src}" style="position:absolute;top:0.32in;right:0.4in;max-height:0.5in;max-width:2.4in"/>` : `<div style="position:absolute;top:0.32in;right:0.4in;font-size:16pt">${up(doc.brand.name)}</div>`}`;
}

function commentsFor(doc: PackDoc, section: string) {
  const cs = doc.comments.filter((c) => c.pages.includes(section));
  if (!cs.length) return "";
  return `<div class="comments">${cs.map((c) => `<div class="c"><span class="bubble">${c.letter}</span><span>${up(c.text)}</span></div>`).join("")}</div>`;
}

function proto(doc: PackDoc) {
  const [first, ...rest] = doc.pack.colorways;
  return `${up(doc.pack.styleNo)}${first ?? ""}${rest.length ? `, ${rest.map((r) => r.replace(/^-/, "")).join(", ")}` : ""}`;
}

/* ------------------------------ 1. MATERIALS / HARDWARE ------------------------------ */
function materialsPage(doc: PackDoc, n: number) {
  const h = doc.header;
  const mast = `<table class="mast">
    <tr><td class="icon" style="width:1.4in">ICON LUXURY GROUP</td>
      <td style="width:3.3in"><b>ATTN:</b> FTY</td>
      <td style="width:2.4in"><b>ORIGINAL DATE SENT :</b></td>
      <td style="width:3.3in"><b>SIZE :</b> <span class="red">${esc(doc.sizeText)}</span></td></tr>
    <tr><td rowspan="4" class="brand">${doc.brand.logo ? `<img src="${doc.brand.logo.src}" style="max-width:1.25in;max-height:0.7in"/>` : `<span class="small">BRAND :</span><br/>${up(doc.brand.name)}`}</td>
      <td><b>RETAILER :</b> ${up(h.retailer)}</td><td><b>REVISED DATE(S) SENT :</b> R1 &nbsp; R2:</td><td><b>SENT BY:</b> <span class="v">${up(h.sentBy)}</span></td></tr>
    <tr><td><b>SEASON :</b> ${up(h.season)}</td><td>R3:</td><td><b>DUE DATE:</b> <span class="v red">${up(h.dueDate)}</span></td></tr>
    <tr><td><b>REFERENCE SAMPLE:</b> <span class="v red">${up(h.referenceSample)}</span></td><td>R4:</td><td><b>PROTO :</b> <span class="v">${proto(doc)}</span></td></tr>
    <tr><td><b>DESCRIPTION:</b> <span class="v">${up(h.description)}</span></td><td></td><td><b>BAG CATEGORY:</b> <span class="v">${up(h.category)}</span><br/><b>STYLE NAME:</b> <span class="v">${up(doc.pack.styleName)}</span></td></tr>
  </table>`;

  const comments = commentsFor(doc, "MATERIALS / HARDWARE");
  const banner = h.physicalSample ? `<div class="banner">YOU WILL RECEIVE A PHYSICAL SAMPLE IN SIMILAR<br/>SIZE AND SIMILAR MATERIAL.</div>` : "";
  const callouts = doc.materials
    .map((m) => `<div style="display:flex;gap:8px;align-items:center;font-size:10pt"><span class="callout">${m.callout}</span>${up(m.name)}${m.locations.length ? ` <span class="muted">— ${up(m.locations.join(", "))}</span>` : ""}</div>`)
    .join("");
  const logoNote = doc.logo.type ? `<div class="red label">LOGO${doc.logo.placement ? ` (${up(doc.logo.placement)})` : ""}</div>` : "";
  const charm = doc.charm ? `<div style="width:1.6in;text-align:center">${doc.charm.photo ? `<img class="img" src="${doc.charm.photo.src}" style="width:1.5in;height:2.2in"/>` : ""}<div class="label">CUSTOM HARDWARE<br/>KEYCHAIN:<br/>${up(doc.charm.code)} INCLUDED</div></div>` : "";
  const thumbs = doc.colorwayRenders.length
    ? doc.colorwayRenders.map((r) => `<div style="text-align:center"><div class="label">${up(doc.pack.styleNo)}${esc(r.colorway)}</div>${r.img ? `<img class="img" src="${r.img.src}" style="width:2.2in;height:1.6in"/>` : ""}</div>`).join("")
    : "";

  const cols = doc.matrixColumns;
  const headCell = (c: (typeof cols)[number]) => {
    if (c.key.startsWith("mat_")) return `<th style="text-align:left">${c.key === "mat_1" ? "BODY<br/>" : ""}MATERIAL: <span class="callout" style="width:20px;height:20px;font-size:10pt">${c.callout}</span><br/>${up(c.label)}</th>`;
    if (c.key === "logo") return `<th class="red">LOGO:<br/>${up(doc.logo.type.split(" ")[0] ?? "")}</th>`;
    return `<th>${esc(c.label).replace(" &amp; ", "<br/>&amp; ")}</th>`;
  };
  const table = `<table class="breakdown"><tr><th>CWY</th>${cols.map(headCell).join("")}</tr>${doc.rows
    .map(
      (r) =>
        `<tr><td class="cwy">${/^[A-Z]+\d+$/.test(doc.pack.styleNo) ? `${up(doc.pack.styleNo.replace(/^[A-Z]+/, ""))}<br/>` : ""}${esc(r.code)}${r.name ? `<div style="font-size:8pt;margin-top:3px">${up(r.name)}</div>` : ""}</td>${r.cells
          .map((c) => {
            const ref = c.ref ? (c.refKind === "swatch" ? `<span class="ref">(SEE PG ${c.ref} FOR SWATCH CARD REFERENCE)</span>` : "") : "";
            const after = c.ref && c.refKind === "artwork" ? `<br/>SEE DETAIL SHEET PG ${c.ref}` : "";
            return `<td style="${c.key.startsWith("mat_") ? "text-align:left" : ""}">${ref}${up(c.text)}${after}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</table>`;

  return `<section class="page">
    ${tag(doc, n, "MATERIALS / HARDWARE")}
    <div style="display:flex;gap:0.3in;align-items:flex-start">${mast}<div style="flex:1;padding-top:2px;padding-right:2.3in"><div class="label" style="background:#111;color:#fff;display:inline-block;padding:1px 6px;margin-bottom:6px">COMMENTS:</div>${comments}</div></div>
    <div style="display:flex;gap:0.3in;margin-top:0.18in;height:4.35in">
      ${charm}
      <div style="flex:1;display:flex;flex-direction:column;align-items:center">
        ${banner}
        <div style="display:flex;gap:0.3in;align-items:flex-start;margin-top:6px;flex:1;min-height:0;width:100%">
          <div style="text-align:center;flex:1.2;min-height:0;height:100%;display:flex;flex-direction:column">
            <div class="big-label">FRONT VIEW</div>
            ${doc.render ? `<img class="img" src="${doc.render.src}" style="width:100%;flex:1;min-height:0"/>` : ""}
          </div>
          <div style="flex:0.8;display:flex;flex-direction:column;gap:8px;padding-top:0.4in">${logoNote}${callouts}${doc.hardwareFinish ? `<div style="font-size:10pt">HARDWARE: ${up(doc.hardwareFinish)}</div>` : ""}</div>
        </div>
      </div>
      <div style="width:2.4in;display:flex;flex-direction:column;gap:10px">${thumbs}</div>
    </div>
    <div class="small" style="margin:6px 0 2px">MATERIAL / COLOR BREAKDOWN</div>
    ${table}
  </section>`;
}

/* ------------------------------ 2. PRODUCT FEATURES ------------------------------ */
function featuresPage(doc: PackDoc, n: number) {
  const d = doc.dims;
  const v = (x?: number) => (typeof x === "number" ? `${x}${doc.U}` : "");
  return `<section class="page">
    ${head(doc, n, "PRODUCT FEATURES")}
    <div style="position:absolute;left:0.4in;top:1.35in;font-size:13pt">ITEM: ${up(doc.header.description || doc.pack.styleName)}</div>
    <div style="position:absolute;left:0.6in;top:1.8in;width:10.6in;height:8.4in">
      ${doc.render ? `<img class="img" src="${doc.render.src}" style="width:9.4in;height:7.2in;margin:0.2in auto 0 0.4in"/>` : ""}
      <div class="dim" style="position:absolute;right:0;top:3.3in;font-size:22pt">${esc(v(d.h))}</div>
      <div class="dim" style="position:absolute;left:4.6in;bottom:0;font-size:22pt">${esc(v(d.w))}</div>
      <div class="dim" style="position:absolute;left:0;bottom:0.7in;font-size:22pt">${esc(v(d.d))}</div>
    </div>
    <div class="box" style="position:absolute;right:0.4in;top:1.8in;width:4.4in;min-height:3.4in">
      <div class="small" style="margin-bottom:10px">PRODUCT<br/>FEATURES</div>
      <ul class="feat">${doc.features.map((f) => `<li>${up(f)}</li>`).join("")}</ul>
    </div>
  </section>`;
}

/* ------------------------------ 3. MEASUREMENTS SHEET ------------------------------ */
function measurementsPage(doc: PackDoc, n: number) {
  const d = doc.dims;
  const overall = [
    typeof d.h === "number" ? `${d.h}${doc.U} TOTAL HEIGHT` : "",
    typeof d.w === "number" ? `${d.w}${doc.U} TOTAL WIDTH` : "",
    typeof d.d === "number" ? `${d.d}${doc.U} TOTAL DEPTH` : "",
  ].filter(Boolean);
  const detailRef = doc.references.find((r) => r.onMeasurements);
  const tables = doc.pom.length > 0 || doc.placements.length > 0;
  const pomTable = doc.pom.length
    ? `<table class="spec"><tr><th>POM</th><th style="text-align:left">POINT OF MEASURE</th><th>VALUE</th><th>TOL ±</th><th style="text-align:left">HOW TO MEASURE</th></tr>${doc.pom
        .map((r, i) => `<tr><td class="code">M${String(i + 1).padStart(2, "0")}</td><td style="text-align:left">${up(r.point)}</td><td class="red">${r.value != null ? `${r.value}${esc(doc.U)}` : ""}</td><td>${r.tol != null ? `${r.tol}${esc(doc.U)}` : ""}</td><td style="text-align:left;font-size:7.5pt">${up(r.how)}</td></tr>`)
        .join("")}</table>`
    : "";
  const placementTable = doc.placements.length
    ? `<div class="small" style="margin:10px 0 3px">HARDWARE PLACEMENT (MM)</div><table class="spec"><tr><th>CODE</th><th style="text-align:left">COMPONENT</th><th>QTY</th><th style="text-align:left">MEASURED</th><th>DISTANCE</th><th>SPACING C/C</th><th style="text-align:left">NOTE</th></tr>${doc.placements
        .map((r) => `<tr><td class="code">${up(r.code)}</td><td style="text-align:left">${up(r.type)}</td><td>${r.qty ?? ""}</td><td style="text-align:left">${up(r.from)}</td><td class="red">${r.distance != null ? `${r.distance} MM` : ""}</td><td class="red">${r.spacing != null ? `${r.spacing} MM` : ""}</td><td style="text-align:left">${up(r.note)}</td></tr>`)
        .join("")}</table>`
    : "";
  if (tables)
    return `<section class="page">
    ${head(doc, n, "MEASUREMENTS SHEET")}
    <div style="position:absolute;left:0.4in;top:1.45in;width:5.6in">${commentsFor(doc, "MEASUREMENTS SHEET")}</div>
    <div style="position:absolute;left:0.4in;top:2.6in;width:6.2in;height:4.6in">${doc.render ? `<img class="img" src="${doc.render.src}" style="width:100%;height:100%"/>` : ""}</div>
    <div style="position:absolute;left:0.4in;top:7.35in;width:6.2in;columns:2;column-gap:0.3in;font-size:10pt;line-height:1.5">
      ${overall.map((o) => `<div class="red">${esc(o)}</div>`).join("")}
      ${doc.measures.map((m) => `<div class="red">${esc(m.label)}: ${esc(m.value)}</div>`).join("")}
      ${doc.logo.type ? `<div>LOGO (${up(doc.logo.placement.includes("CENTER") ? "CENTERED" : doc.logo.placement)})</div>` : ""}
      ${doc.gussetNote ? `<div>${up(doc.gussetNote)}</div>` : ""}
      ${doc.strapNote ? `<div>${up(doc.strapNote)}</div>` : ""}
    </div>
    <div style="position:absolute;left:6.9in;top:2.6in;width:6.3in">${pomTable}${placementTable}</div>
    ${
      detailRef || doc.closure
        ? `<div style="position:absolute;right:0.4in;top:1.45in;width:3.1in;text-align:center">
        <div class="label">${up(doc.closure.split(" — ")[0] || detailRef?.note || "")}</div>
        ${detailRef?.img ? `<img class="img" src="${detailRef.img.src}" style="width:3in;height:3in;margin:6px auto"/>` : ""}
        ${detailRef ? `<span class="bubble" style="width:30px;height:30px;font-size:15pt">${esc(detailRef.letter)}</span>` : ""}
        ${doc.closure.includes(" — ") ? `<div class="small" style="margin-top:6px">${up(doc.closure.split(" — ")[1])}</div>` : ""}
      </div>`
        : ""
    }
  </section>`;
  return `<section class="page">
    ${head(doc, n, "MEASUREMENTS SHEET")}
    <div style="position:absolute;left:0.4in;top:1.45in;width:5.6in">${commentsFor(doc, "MEASUREMENTS SHEET")}</div>
    <div style="position:absolute;left:0.4in;top:2.6in;width:9.6in;height:7.9in">
      ${doc.render ? `<img class="img" src="${doc.render.src}" style="width:100%;height:100%"/>` : ""}
    </div>
    <div style="position:absolute;left:10.3in;top:2.6in;width:3.0in;display:flex;flex-direction:column;gap:10px">
      ${overall.map((o) => `<div class="dim">${esc(o)}</div>`).join("")}
      ${doc.measures.map((m) => `<div class="dim">${esc(m.label)}: ${esc(m.value)}</div>`).join("")}
      ${doc.logo.type ? `<div class="label">LOGO (${up(doc.logo.placement.includes("CENTER") ? "CENTERED" : doc.logo.placement)})</div>` : ""}
      ${doc.gussetNote ? `<div class="label">${up(doc.gussetNote)}</div>` : ""}
      ${doc.strapNote ? `<div class="label">${up(doc.strapNote)}</div>` : ""}
    </div>
    ${
      detailRef || doc.closure
        ? `<div style="position:absolute;right:0.4in;top:1.45in;width:3.2in;text-align:center">
        <div class="label">${up(doc.closure.split(" — ")[0] || detailRef?.note || "")}</div>
        ${detailRef?.img ? `<img class="img" src="${detailRef.img.src}" style="width:3.1in;height:3.1in;margin:6px auto"/>` : ""}
        ${detailRef ? `<span class="bubble" style="width:30px;height:30px;font-size:15pt">${esc(detailRef.letter)}</span>` : ""}
        ${doc.closure.includes(" — ") ? `<div class="small" style="margin-top:6px">${up(doc.closure.split(" — ")[1])}</div>` : ""}
      </div>`
        : ""
    }
  </section>`;
}

/* ------------------------------ 4. ENLARGED CAD ------------------------------ */
function cadPage(doc: PackDoc, n: number) {
  const k = doc.colorwayRenders.length;
  const w = k <= 2 ? 7.9 : 5.2;
  return `<section class="page">
    ${head(doc, n, "ENLARGED CAD")}
    <div style="display:flex;flex-wrap:wrap;gap:0.25in;justify-content:center;margin-top:0.35in">
      ${doc.colorwayRenders.map((r) => `<div style="text-align:center;width:${w}in"><div style="font-size:24pt;margin-bottom:8px">${up(doc.pack.styleNo)}${esc(r.colorway)}</div>${r.img ? `<img class="img" src="${r.img.src}" style="width:${w}in;height:${k <= 2 ? 6.6 : 3.6}in"/>` : ""}</div>`).join("")}
    </div>
  </section>`;
}

/* ------------------------------ 5. REFERENCE PHOTOS ------------------------------ */
function referencePage(doc: PackDoc, n: number) {
  const refs = doc.references.filter((r) => !r.onMeasurements);
  const w = refs.length <= 1 ? 7.5 : refs.length <= 2 ? 7 : 4.8;
  return `<section class="page">
    ${head(doc, n, "REFERENCE PHOTOS FOR CONSTRUCTION")}
    <div style="position:absolute;left:4in;top:0.45in;width:8in">${commentsFor(doc, "REFERENCE PHOTOS FOR CONSTRUCTION")}</div>
    <div style="display:flex;flex-wrap:wrap;gap:0.35in;justify-content:center;margin-top:0.6in">
      ${refs
        .map(
          (r) => `<div style="width:${w}in;text-align:center">
        <div style="display:flex;gap:10px;align-items:center;justify-content:center;margin-bottom:8px"><span class="bubble" style="width:30px;height:30px;font-size:15pt">${esc(r.letter)}</span><span class="label">${up(r.note)}</span></div>
        ${r.img ? `<img class="img" src="${r.img.src}" style="width:${w}in;height:${refs.length <= 2 ? 6.8 : 3.8}in"/>` : ""}
      </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

/* ------------------------------ 6. INTERIOR & LINING ------------------------------ */
function wallSvg(doc: PackDoc, mode: "hatched" | "lining", w: number, h: number) {
  const i = doc.interior;
  const p = i.pockets.find((x) => x.wall === "BACK WALL") ?? i.pockets[0];
  const side = p?.wall === "SIDE 1" || p?.wall === "SIDE 2";
  // The wall is the bag's W × H (front/back) or D × H (sides). Only entered values are labelled —
  // the drawing never shows a number the designer didn't give.
  const W = (side ? doc.dims.d : doc.dims.w) ?? 20,
    H = doc.dims.h ?? 16;
  const sx = w / W,
    sy = h / H;
  const u = doc.unit === "in" ? "IN" : "CM";
  const known = { pw: p?.w != null, top: p?.top_offset != null, ph: p?.h != null };
  const pw = p?.w ?? W * 0.7,
    top = p?.top_offset ?? H * 0.12,
    ph = p?.h ?? H - top - H * 0.06;
  const px = (W - pw) / 2;
  const fill =
    mode === "hatched"
      ? `<pattern id="hatch-${mode}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#555" stroke-width="1"/></pattern><rect width="${w}" height="${h}" fill="url(#hatch-${mode})"/>`
      : doc.lining?.img
        ? `<pattern id="lin" width="${Math.max(40, w / 4)}" height="${Math.max(40, w / 4)}" patternUnits="userSpaceOnUse"><image href="${doc.lining.img.src}" width="${Math.max(40, w / 4)}" height="${Math.max(40, w / 4)}" preserveAspectRatio="xMidYMid slice"/></pattern><rect width="${w}" height="${h}" fill="url(#lin)"/>`
        : `<rect width="${w}" height="${h}" fill="#f4d0dc"/>`;
  const L = i.labelSize;
  const hasLabel = !!i.label && L?.w != null && L?.h != null;
  const lw = (L?.w ?? 0) * sx,
    lh = (L?.h ?? 0) * sy;
  const lx = (W / 2) * sx - lw / 2,
    ly = (top + (i.labelOffset ?? 0)) * sy;
  const red = "#e2231a";
  const t = (x: number, y: number, s: string, anchor = "middle") => `<text x="${x}" y="${y}" font-size="13" text-anchor="${anchor}" fill="#111" style="font-family:IconCond">${esc(s)}</text>`;
  return `<svg width="${w + 120}" height="${h + 40}" viewBox="-110 -10 ${w + 120} ${h + 40}" xmlns="http://www.w3.org/2000/svg">
    <g>${fill}</g>
    ${p ? `<rect x="${px * sx}" y="${top * sy}" width="${pw * sx}" height="${ph * sy}" fill="${mode === "hatched" ? "#fff" : "none"}" stroke="#111" stroke-width="1.5"/>
    <rect x="${px * sx + 3}" y="${top * sy + 3}" width="${pw * sx - 6}" height="${ph * sy - 6}" fill="none" stroke="#111" stroke-dasharray="4 3"/>
    ${p.type ? t((px + pw / 2) * sx, (top + ph / 2) * sy + 4, `${p.type}${p.zip_size ? ` (${p.zip_size} ZIP)` : ""}`) : ""}
    ${known.pw ? `<line x1="${px * sx}" y1="${top * sy - 4}" x2="${(px + pw) * sx}" y2="${top * sy - 4}" stroke="${red}" stroke-width="1.5"/>${t((px + pw / 2) * sx, top * sy - 8, `${p.w} ${u}`)}` : ""}
    ${known.top ? `<line x1="${(W / 2) * sx - 60}" y1="0" x2="${(W / 2) * sx - 60}" y2="${top * sy}" stroke="${red}" stroke-width="1.5"/>${t((W / 2) * sx - 66, (top * sy) / 2 + 4, `${p.top_offset} ${u}`, "end")}` : ""}
    <line x1="${px * sx - 12}" y1="${top * sy}" x2="${px * sx - 12}" y2="${(top + ph) * sy}" stroke="${red}" stroke-width="1.5"/>
    ${t(px * sx - 18, (top + ph / 2) * sy, known.ph ? `${p.h} ${u}` : "REMAINING HEIGHT", "end")}
    ${doc.interior.pocketEdge ? t((px + pw) * sx - 4, top * sy - 22, doc.interior.pocketEdge, "end") : ""}` : ""}
    ${hasLabel ? `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="#c8177a"/>
    <text x="${lx + lw / 2}" y="${ly + lh / 2 + 5}" font-size="13" text-anchor="middle" fill="#fff" style="font-family:IconCond">${esc(doc.brand.name.toUpperCase())}</text>
    ${i.labelOffset != null ? `<line x1="${lx + lw + 8}" y1="${top * sy}" x2="${lx + lw + 8}" y2="${ly}" stroke="${red}" stroke-width="1.5"/>${t(lx + lw + 14, (top * sy + ly) / 2 + 4, `${i.labelOffset} ${u}`, "start")}` : ""}
    <line x1="${lx}" y1="${ly + lh + 8}" x2="${lx + lw}" y2="${ly + lh + 8}" stroke="${red}" stroke-width="1.5"/>
    ${t(lx + lw / 2, ly + lh + 24, `${L!.w} ${u}`)}
    <line x1="${lx - 8}" y1="${ly}" x2="${lx - 8}" y2="${ly + lh}" stroke="${red}" stroke-width="1.5"/>
    ${t(lx - 12, ly + lh / 2 + 4, `${L!.h} ${u}`, "end")}` : ""}
  </svg>`;
}

function interiorPage(doc: PackDoc, n: number, withArtwork: boolean) {
  const i = doc.interior;
  const lab = i.label ? `ADD ${up(i.label.code)} ${up(i.label.name || i.label.type)}${i.labelCentered ? " (CENTERED)" : ""}` : "";
  const pocketList = i.pockets
    .map((p) => `${up(p.type)} ON ${up(p.wall)}${p.w ? ` — ${p.w}${doc.U} WIDE` : ""}${p.top_offset != null ? `, ${p.top_offset}${doc.U} FROM TOP` : ""}${p.centered ? " (PKT IS CENTERED)" : ""}${p.zip_size ? `, ${up(p.zip_size)} ZIP` : ""}`)
    .join("<br/>");
  const w = withArtwork ? 5.6 : 6.6;
  const wall = (i.pockets.find((p) => p.wall === "BACK WALL") ?? i.pockets[0])?.wall ?? "BACK WALL";
  const wallW = (/SIDE/.test(wall) ? doc.dims.d : doc.dims.w) ?? 20;
  const ratio = (doc.dims.h ?? 16) / wallW;
  const dw = Math.min(w * 72, 4.6 * 72 / ratio);
  const wallTitle = /WALL/.test(wall) ? `INTERIOR MAIN COMPARTMENT ${up(wall)}` : `INTERIOR ${up(wall)}`;
  return `<section class="page">
    ${head(doc, n, "INTERIOR & LINING")}
    <div style="position:absolute;left:0.4in;top:1.45in;font-size:17pt;line-height:1.25">${lab}</div>
    <div style="position:absolute;left:5.4in;top:0.5in;width:7.5in">${commentsFor(doc, "INTERIOR & LINING")}</div>
    <div style="position:absolute;left:0.4in;top:2.4in;display:flex;gap:0.35in;align-items:flex-start">
      <div style="text-align:center"><div class="label">${wallTitle}</div><div class="small">${i.pockets.some((p) => p.centered) ? "(PKT IS CENTERED)" : ""}</div>${wallSvg(doc, "hatched", dw, dw * ratio)}</div>
      <div style="text-align:center"><div class="label">${wallTitle}<br/>W/ LINING</div>${wallSvg(doc, "lining", dw, dw * ratio)}</div>
      ${withArtwork ? `<div style="width:3.2in">${artworkBlock(doc, 3)}</div>` : ""}
    </div>
    <div style="position:absolute;left:0.4in;top:7.75in;display:flex;gap:0.3in;align-items:flex-end">${allWalls(doc)}</div>
    <div style="position:absolute;right:0.4in;bottom:0.4in;width:5.4in;font-size:10pt;line-height:1.5">${doc.baseBoard ? `BASE: ${up(doc.baseBoard)}<br/>` : ""}${pocketList}${i.pocketEdge ? `<br/>POCKET EDGE: ${up(i.pocketEdge)}` : ""}${i.seamBinding ? "<br/>PLEASE MAKE SURE TO ADD INTERIOR BINDING" : ""}${i.padding ? `<br/>${up(i.padding)}` : ""}</div>
  </section>`;
}

/** Every inside wall — front, back, both sides and the base — with its pockets (or NO POCKET). */
function allWalls(doc: PackDoc) {
  const W = doc.dims.w,
    H = doc.dims.h,
    D = doc.dims.d;
  if (W == null || H == null || D == null) return "";
  const walls: { name: string; w: number; h: number }[] = [
    { name: "FRONT WALL", w: W, h: H },
    { name: "BACK WALL", w: W, h: H },
    { name: "SIDE 1", w: D, h: H },
    { name: "SIDE 2", w: D, h: H },
    { name: "BASE", w: W, h: D },
  ];
  const maxH = 1.6 * 72,
    maxW = 2.0 * 72;
  const scale = Math.min(...walls.map((x) => Math.min(maxH / x.h, maxW / x.w)));
  return walls
    .map((wall) => {
      const ws = wall.w * scale,
        hs = wall.h * scale;
      const pk = doc.interior.pockets.filter((p) => p.wall === wall.name);
      const rects = pk
        .map((p, i) => {
          const pw = (p.w ?? wall.w * 0.7) * scale,
            top = (p.top_offset ?? wall.h * 0.12) * scale,
            ph = (p.h ?? wall.h * 0.55) * scale;
          return `<rect x="${(ws - pw) / 2}" y="${top + i * 4}" width="${pw}" height="${Math.min(ph, hs - top - 2)}" fill="#fff" stroke="#111" stroke-dasharray="3 2"/>`;
        })
        .join("");
      const board = wall.name === "BASE" && doc.baseBoard ? `<rect x="3" y="3" width="${ws - 6}" height="${hs - 6}" fill="none" stroke="#e2231a" stroke-dasharray="5 3"/>` : "";
      const caption = pk.length ? pk.map((p) => up(p.type)).join(", ") : wall.name === "BASE" && doc.baseBoard ? "BASE BOARD" : "NO POCKET";
      return `<div style="text-align:center;font-size:8pt"><svg width="${ws}" height="${hs}" xmlns="http://www.w3.org/2000/svg"><rect width="${ws}" height="${hs}" fill="#f2f2f2" stroke="#111"/>${rects}${board}</svg><div style="margin-top:3px">${wall.name}</div><div class="muted" style="font-size:7pt">${caption}</div></div>`;
    })
    .join("");
}

/* ------------------------------ 7. LINING / PRINT ARTWORK ------------------------------ */
function artworkBlock(doc: PackDoc, scale: number) {
  const l = doc.lining!;
  const tile = Math.min(scale * 0.9, 3.6);
  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div style="font-size:${scale >= 5 ? 22 : 15}pt;color:#e2231a">REPEAT</div>
    <div style="position:relative;width:${tile * 2}in;height:${tile * 2}in;${l.img ? `background:url(${l.img.src});background-size:${tile}in ${tile}in;` : "background:#f4d0dc;"}border:1px solid #ccc">
      <div style="position:absolute;left:${tile / 2}in;top:${tile / 2}in;width:${tile}in;height:${tile}in;border:3px solid #e2231a"></div>
      <div class="dim" style="position:absolute;left:${tile / 2}in;top:${tile / 2 - 0.3}in;width:${tile}in;text-align:center">${esc(l.tileW)} ${up(l.tileUnit)}</div>
      <div class="dim" style="position:absolute;left:${tile * 1.5 + 0.08}in;top:${tile}in">${esc(l.tileH)} ${up(l.tileUnit)}</div>
    </div>
    <div style="font-size:11pt;line-height:1.45">${l.baseFabric ? `FABRIC:<br/>${up(l.baseFabric)}<br/>` : ""}COLORS:<br/>${l.colours.map((c) => up(c)).join("<br/>")}</div>
    <div style="display:flex;gap:8px">${l.colours.map((c) => `<div style="width:0.9in;text-align:center;font-size:8pt"><div style="height:0.6in;background:${pantoneHex(c)};border:1px solid #999"></div>${up(c)}</div>`).join("")}</div>
  </div>`;
}

function artworkPage(doc: PackDoc, n: number) {
  const l = doc.lining!;
  return `<section class="page">
    ${head(doc, n, "LINING / PRINT ARTWORK")}
    <div style="position:absolute;left:0.4in;top:2.1in;width:5.5in;font-size:15pt;line-height:1.35">LINING IS ${up(l.application)} REPEAT${l.motif ? `<br/><span class="small">MOTIF: ${up(l.motif)}</span>` : ""}${l.repeat ? `<br/><span class="small">REPEAT: ${up(l.repeat)}</span>` : ""}</div>
    <div style="position:absolute;left:6.2in;top:0.6in">
      <div style="font-size:15pt;margin-bottom:10px">LINING ARTWORK</div>
      ${artworkBlock(doc, 5)}
    </div>
  </section>`;
}

/* ------------------------------ 8. HARDWARE / BRANDING DETAIL ------------------------------ */
function detailPage(doc: PackDoc, n: number) {
  const mm = (s: string) => s.split(/\s*X\s*/i).map((x) => parseFloat(x)).filter((x) => Number.isFinite(x));
  const panels = doc.detail
    .map((h) => {
      const [wmm, hmm] = mm(h.dimsMm);
      const size = (v?: number) => (v ? `${v}mm` : "auto");
      const view = (k: "front" | "side" | "rear", label: string) =>
        h.views[k] ? `<div style="text-align:center"><img src="${h.views[k]!.src}" style="width:${size(k === "side" ? undefined : wmm)};height:${size(hmm)};object-fit:contain"/><div class="small">${label}</div></div>` : "";
      const fs = h.finishSpec as { plating?: string; coating?: string; nickelFree?: boolean; mouldNo?: string; newMould?: boolean; platingThickness?: string };
      const notes = [
        h.material,
        h.finish,
        fs.plating && `PLATING: ${fs.plating}${fs.platingThickness ? ` ${fs.platingThickness}` : ""}`,
        fs.coating && `COATING: ${fs.coating}`,
        fs.nickelFree && "NICKEL-FREE",
        fs.mouldNo && `MOULD NO. ${fs.mouldNo}`,
        fs.newMould && "NEW MOULD REQUIRED",
        h.logoTreatment,
        h.enamel && `ENAMEL ${h.enamel}`,
        h.construction,
        h.notes,
        h.approval !== "APPROVED" && `SAMPLE APPROVAL: ${h.approval}`,
      ].filter(Boolean);
      return `<div class="box" style="display:flex;gap:0.3in;align-items:flex-start;margin-bottom:0.2in">
        <div style="width:2in"><div class="label">${up(h.type)}<br/>${up(h.code)}</div><div style="font-size:11pt;margin-top:4px">${esc(h.dimsMm)} MM</div>
          <div style="display:inline-block;margin-top:8px;padding:3px 12px;border-radius:12px;background:#5ab4e6;color:#fff;font-size:11pt">SIZE 100%</div></div>
        <div style="display:flex;gap:0.25in;align-items:flex-end">${view("front", "FRONT")}${view("side", "SIDE")}${view("rear", "REAR")}</div>
        <div style="flex:1;font-size:11pt;line-height:1.5;color:#1a8bd0">${notes.map((x) => up(x)).join("<br/>")}</div>
        ${h.photo ? `<img class="img" src="${h.photo.src}" style="width:1.4in;height:1.6in"/>` : ""}
      </div>`;
    })
    .join("");
  const lp = doc.logo.panel;
  const logo = lp
    ? `<div style="display:flex;gap:0.5in;align-items:center;margin-top:0.2in">
        <div style="position:relative;padding:0.3in 0 0 0.45in">
          <div class="dim" style="position:absolute;top:0;left:0.45in;width:${lp.w}mm;text-align:center;font-size:11pt">${lp.w}MM</div>
          <div class="dim" style="position:absolute;left:0;top:0.3in;height:${lp.h}mm;display:flex;align-items:center;font-size:11pt;writing-mode:vertical-rl;transform:rotate(180deg)">${lp.h}MM</div>
          <div style="width:${lp.w}mm;height:${lp.h}mm;border:1.5px solid #111;display:flex;align-items:center;justify-content:center;font-size:8pt;outline:1px dashed #111;outline-offset:-4px">${up(doc.brand.name)}</div>
        </div>
        <div style="text-align:center"><div class="label">LOGO ${up(doc.logo.type.replace(" PATCH", ""))}${doc.logo.fill ? ` WITH ${up(doc.logo.fill)}` : ""}</div>${toolingNote(doc)}${lp.photo ? `<img class="img" src="${lp.photo.src}" style="width:2.4in;height:1in;margin-top:6px"/>` : ""}</div>
      </div>`
    : "";
  return `<section class="page">
    ${head(doc, n, "HARDWARE / BRANDING DETAIL")}
    <div style="margin-top:0.35in">${panels}${logo}</div>
    <div style="position:absolute;right:0.4in;top:1.45in;width:4in">${commentsFor(doc, "HARDWARE / BRANDING DETAIL")}</div>
  </section>`;
}

function toolingNote(doc: PackDoc) {
  const t = doc.tooling;
  const lines = [t.depth && `DEPTH / HEIGHT: ${t.depth}`, t.newTooling && "NEW DIE / MOULD REQUIRED", t.artwork && `ARTWORK FILE: ${t.artwork}`].filter(Boolean);
  return lines.length ? `<div style="font-size:9.5pt;color:#1a8bd0;margin-top:4px;line-height:1.4">${lines.map((l) => up(l)).join("<br/>")}</div>` : "";
}

/* ------------------------------ CONSTRUCTION DETAILS ------------------------------ */
function crossSection(edge: string) {
  const L = (y: number) => `<rect x="10" y="${y}" width="120" height="8" fill="#ddd" stroke="#111"/>`;
  const stitch = (x: number) => `<line x1="${x}" y1="10" x2="${x}" y2="58" stroke="#e2231a" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  const svg = (inner: string) => `<svg width="150" height="70" viewBox="0 0 150 70" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  switch (edge) {
    case "TURNED EDGE":
      return svg(`${L(20)}${L(40)}<path d="M130 20 q14 14 0 28" fill="none" stroke="#111" stroke-width="8"/>${stitch(110)}`);
    case "RAW EDGE PAINTED":
      return svg(`${L(22)}${L(32)}<rect x="128" y="20" width="6" height="22" fill="#e2231a"/>${stitch(115)}`);
    case "PIPED":
      return svg(`${L(16)}${L(46)}<circle cx="132" cy="35" r="9" fill="#fff" stroke="#111" stroke-width="2"/><path d="M110 24 q22 0 22 11 q0 11 -22 11" fill="none" stroke="#111" stroke-width="3"/>${stitch(112)}`);
    case "BOUND":
      return svg(`${L(26)}${L(36)}<path d="M100 20 h32 q8 0 8 8 v14 q0 8 -8 8 h-32" fill="none" stroke="#111" stroke-width="5"/>${stitch(112)}`);
    case "FOLDED & STITCHED":
      return svg(`${L(24)}<path d="M10 40 h118 q8 -8 0 -16" fill="none" stroke="#111" stroke-width="8"/>${stitch(105)}`);
    case "BONDED & PAINTED":
      return svg(`${L(24)}<rect x="10" y="32" width="120" height="3" fill="#c79a3b"/>${L(35)}<rect x="128" y="22" width="6" height="23" fill="#e2231a"/>`);
    default:
      return svg(`${L(26)}${L(36)}${stitch(110)}`);
  }
}

function constructionPage(doc: PackDoc, n: number) {
  const rows = doc.construction;
  return `<section class="page">
    ${head(doc, n, "CONSTRUCTION DETAILS")}
    <div style="position:absolute;left:5in;top:0.5in;width:7.8in">${commentsFor(doc, "CONSTRUCTION DETAILS")}</div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:0.25in;margin-top:0.55in">
      ${rows
        .map(
          (r) => `<div class="box" style="display:flex;gap:12px;align-items:center">${crossSection(r.edge)}<div style="font-size:9.5pt;line-height:1.4"><div style="font-size:11pt">${up(r.area)}</div>${up(r.edge)}<br/>${up(r.stitch)}${r.spi ? ` · ${esc(r.spi)} SPI` : ""}${r.thread ? `<br/>${up(r.thread)}` : ""}${r.allowance ? `<br/>SEAM ALLOWANCE ${up(r.allowance)}` : ""}</div></div>`,
        )
        .join("")}
    </div>
    <div style="display:flex;gap:0.5in;margin-top:0.35in;font-size:10.5pt;line-height:1.6">
      ${doc.threadColour ? `<div>THREAD COLOUR: ${up(doc.threadColour)}</div>` : ""}
      ${
        doc.materialLayout.length
          ? `<div>${doc.materialLayout.map((m) => `<div style="display:flex;gap:8px;align-items:center"><span class="callout" style="width:20px;height:20px;font-size:10pt">${m.callout}</span>${up(m.name)}${m.direction ? ` — DIRECTION: ${up(m.direction)}` : ""}${m.matching && m.matching !== "NONE" ? ` — <span class="red">${up(m.matching)}</span>` : ""}</div>`).join("")}</div>`
          : ""
      }
    </div>
  </section>`;
}

/* ------------------------------ BILL OF MATERIALS ------------------------------ */
function bomPage(doc: PackDoc, n: number) {
  const zip = doc.zippers.length
    ? `<div class="small" style="margin:14px 0 3px">ZIPPERS</div><table class="spec"><tr><th>POSITION</th><th>SIZE</th><th>TYPE</th><th>OPENING</th><th>ENDS</th><th>SLIDER</th><th>PULLER</th><th>ATTACHMENT</th><th>TAPE</th><th>TEETH</th></tr>${doc.zippers
        .map((z) => `<tr><td>${up(z.position)}</td><td>${up(z.size)}</td><td>${up(z.type)}</td><td class="red">${esc(z.length)}</td><td>${up(z.ends)}</td><td>${up(z.slider)}</td><td>${up(z.puller)}</td><td>${up(z.attachment)}</td><td>${up(z.tape)}</td><td>${up(z.teeth)}</td></tr>`)
        .join("")}</table>`
    : "";
  const labels = Object.entries(doc.contentLabels).filter(([, v]) => v.text);
  const content = labels.length
    ? `<div class="small" style="margin:14px 0 3px">CONTENT LABEL (FROM THE MATERIAL LIBRARY)</div><table class="spec">${labels.map(([cw, v]) => `<tr><td class="code" style="width:1.6in">${up(doc.pack.styleNo)}${esc(cw)}</td><td style="text-align:left">${up(v.text)}${v.missing.length ? ` <span class="red">— COMPOSITION MISSING: ${up(v.missing.join(", "))}</span>` : ""}</td></tr>`).join("")}</table>`
    : "";
  return `<section class="page">
    ${head(doc, n, "BILL OF MATERIALS")}
    <div class="small muted" style="position:absolute;left:5in;top:0.55in">QUANTITIES PER FINISHED BAG. NO PRICES — COSTING BY FACTORY. “FTY TO CONFIRM” = FACTORY TO CONFIRM CONSUMPTION.</div>
    <div style="margin-top:0.45in">
      ${
        doc.bom.length
          ? `<table class="spec"><tr><th>#</th><th>COMPONENT</th><th style="text-align:left">DESCRIPTION / CODE</th><th>QTY</th><th>UNIT</th><th style="text-align:left">PLACEMENT</th><th style="text-align:left">COLOUR</th></tr>${doc.bom
              .map((r, i) => `<tr><td>${i + 1}</td><td>${up(r.component)}</td><td style="text-align:left">${up(r.description)}</td><td>${r.qty ?? ""}</td><td>${up(r.unit)}</td><td style="text-align:left">${up(r.placement)}</td><td style="text-align:left">${up(r.colour)}</td></tr>`)
              .join("")}</table>`
          : ""
      }
      ${zip}${content}
    </div>
  </section>`;
}

/* ------------------------------ SAMPLE COMMENTS ------------------------------ */
function samplePage(doc: PackDoc, n: number) {
  const r = doc.sampleRound!;
  const stage = { PROTO: "PROTO", SMS: "SALESMAN SAMPLE", PP: "PRE-PRODUCTION", TOP: "TOP OF PRODUCTION" }[r.stage] ?? r.stage;
  return `<section class="page">
    ${head(doc, n, "SAMPLE COMMENTS")}
    <div style="position:absolute;left:5in;top:0.5in;font-size:15pt">${esc(stage)} ${r.number > 1 ? `#${r.number}` : ""} — ${up(r.verdict)}${r.receivedAt ? ` <span class="small muted">RECEIVED ${esc(r.receivedAt)}</span>` : ""}</div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:0.3in;margin-top:0.6in">
      ${r.comments
        .map(
          (c) => `<div>
        <div style="position:relative;width:100%;height:3.2in;background:#f4f4f4">
          ${c.img ? `<img src="${c.img.src}" style="width:100%;height:100%;object-fit:contain"/>` : ""}
          ${c.markup.map((m) => `<div style="position:absolute;left:${m.x * 100}%;top:${m.y * 100}%;width:${m.r * 200}%;aspect-ratio:1;transform:translate(-50%,-50%);border:3px solid #e2231a;border-radius:50%"></div><span class="bubble" style="position:absolute;left:${m.x * 100}%;top:${m.y * 100}%;transform:translate(60%,-160%)">${esc(m.letter || c.letter)}</span>`).join("")}
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;font-size:10.5pt;line-height:1.3"><span class="bubble">${esc(c.letter)}</span><span>${up(c.text)}<br/><span class="${c.status === "OPEN" || c.status === "REVISE" ? "red" : "muted"}" style="font-size:8.5pt">${up(c.status)}${c.carried ? " · CARRIED FROM LAST ROUND" : ""}</span></span></div>
      </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

/* ------------------------------ 9. SWATCH CARDS ------------------------------ */
function swatchPage(doc: PackDoc, n: number, list: { colorway: string; materialCallout: number }[]) {
  const items = list.map((s) => doc.swatches.find((x) => x.colorway === s.colorway && x.callout === s.materialCallout)!).filter(Boolean);
  const one = items.length === 1;
  const card = (s: (typeof items)[number], wIn: number, hIn: number) => `
    <div style="position:relative;width:${wIn}in;height:${hIn}in;overflow:hidden;background:#fff">
      ${s.photo ? `<img src="${s.photo.src}" style="width:100%;height:100%;object-fit:fill"/>` : ""}
      ${s.chipBox ? `<div style="position:absolute;left:${s.chipBox.x * 100}%;top:${s.chipBox.y * 100}%;width:${s.chipBox.w * 100}%;height:${s.chipBox.h * 100}%;border:4px solid #e2231a"></div>` : ""}
    </div>`;
  if (one) {
    const s = items[0];
    return `<section class="page">
      ${head(doc, n, `${s.materialName.replace(/ MTL$/, "")} #${s.callout} MTL`)}
      <div style="position:absolute;left:0.4in;top:1.75in;font-size:11pt">FOR REFERENCE <span class="red">${up(doc.pack.styleNo)}${esc(s.colorway)} ONLY</span></div>
      <div style="position:absolute;left:0.6in;top:3.6in;width:2.6in;text-align:center"><span class="callout" style="width:44px;height:44px;font-size:22pt">${s.callout}</span>
        <div style="font-size:12pt;margin-top:8px;line-height:1.3">${up(s.supplier)}<br/>SWATCH CARD<br/>${up(s.article)}<br/>${up(s.colourName)}</div></div>
      <div style="position:absolute;left:4in;top:0.4in">${card(s, 6.6, 8.8)}</div>
    </section>`;
  }
  return `<section class="page">
    ${head(doc, n, "SWATCH CARDS — FABRIC REFERENCE")}
    <div style="display:flex;flex-wrap:wrap;gap:0.4in;justify-content:center;margin-top:0.4in">
      ${items
        .map(
          (s) => `<div style="text-align:center;width:4.4in">
        <div style="display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:6px"><span class="callout">${s.callout}</span><span class="label">${up(doc.pack.styleNo)}${esc(s.colorway)} — ${up(s.colourName)}</span></div>
        ${card(s, 4.4, 5.6)}
        <div style="font-size:10pt;margin-top:6px">${up(s.supplier)} · ${up([s.articleNo, s.article].filter(Boolean).join(" "))}</div>
        <div class="red" style="font-size:10pt">FOR REFERENCE ${up(doc.pack.styleNo)}${esc(s.colorway)} ONLY</div>
      </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

/** Rough on-screen chips for common Pantone references (print uses the Pantone number). */
function pantoneHex(code: string) {
  const c = code.toUpperCase();
  const known: Record<string, string> = { "203 C": "#eba8c6", "17-3914": "#8b8d8f", BLACK: "#111111" };
  for (const [k, v] of Object.entries(known)) if (c.includes(k)) return v;
  return "#ddd";
}

export function renderPackHtml(doc: PackDoc, opts: { draft?: boolean } = {}) {
  const pages = doc.plan.pages
    .map((p) => {
      switch (p.section) {
        case "MATERIALS / HARDWARE":
          return materialsPage(doc, p.n);
        case "PRODUCT FEATURES":
          return featuresPage(doc, p.n);
        case "MEASUREMENTS SHEET":
          return measurementsPage(doc, p.n);
        case "ENLARGED CAD":
          return cadPage(doc, p.n);
        case "REFERENCE PHOTOS FOR CONSTRUCTION":
          return referencePage(doc, p.n);
        case "INTERIOR & LINING":
          return interiorPage(doc, p.n, p.withArtwork);
        case "LINING / PRINT ARTWORK":
          return artworkPage(doc, p.n);
        case "HARDWARE / BRANDING DETAIL":
          return detailPage(doc, p.n);
        case "SWATCH CARDS":
          return swatchPage(doc, p.n, p.swatches);
        case "CONSTRUCTION DETAILS":
          return constructionPage(doc, p.n);
        case "BILL OF MATERIALS":
          return bomPage(doc, p.n);
        case "SAMPLE COMMENTS":
          return samplePage(doc, p.n);
        case "CHANGE LOG":
          return "";
      }
    })
    .map((html) => (opts.draft ? html.replace('<section class="page">', '<section class="page"><div class="draft"><span>DRAFT — NOT FOR FACTORY</span></div>') : html))
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${up(doc.pack.styleNo)} ${up(doc.pack.styleName)}</title><style>${CSS()}</style></head><body>${pages}</body></html>`;
}
