import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PackDoc } from "./doc";
import { inlineFlat } from "@/lib/lineart/geometry";

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

/** Red *UPDATED* next to a value changed in the current revision (any question id prefix). */
function upd(doc: PackDoc, ...prefixes: string[]) {
  return doc.revision.flags.some((c) => prefixes.some((p) => c.questionId === p || c.questionId.startsWith(p))) ? `<span class="upd">*UPDATED*</span>` : "";
}

/** Page-level flag under the page tag when something on this page changed. */
function pageUpd(doc: PackDoc, section: string, inline = false) {
  return doc.revision.flags.some((c) => c.sections.includes(section as never)) ? `${inline ? " " : "<br/>"}<span class="upd-tag">*UPDATED* ${esc(doc.revision.flagLabel)}</span>` : "";
}

let fontCss: string | null = null;
export function fonts() {
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
.small { font-size: 11pt; }
.muted { color: #555; }
.tag { position: absolute; top: 0.32in; right: 0.4in; text-align: right; font-size: 15pt; line-height: 1.15; }
.tag .logo { max-height: 0.45in; max-width: 2.2in; margin-top: 6px; }
.style-head { font-size: 34pt; line-height: 1; }
.style-sub { font-size: 14pt; line-height: 1.3; margin-top: 4px; }
.draft { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 50; }
.draft span { font-size: 90pt; color: rgba(226,35,26,0.10); transform: rotate(-18deg); letter-spacing: 0.1em; white-space: nowrap; }
.bubble { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; background: #e2231a; color: #fff; font-size: 15pt; flex: none; }
.callout { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: #f7e400; color: #111; border: 2px solid #111; font-size: 16pt; flex: none; }
.comments { display: flex; flex-direction: column; gap: 10px; font-size: 14pt; }
.comments .c { display: flex; gap: 10px; align-items: flex-start; line-height: 1.25; }
table { border-collapse: collapse; }
.mast { border: 1.5px solid #111; font-size: 11pt; width: 9.1in; }
.mast td { border: 1px solid #111; padding: 3px 6px; vertical-align: middle; line-height: 1.15; }
.mast .icon { background: #111; color: #fff; font-size: 10pt; text-align: center; }
.mast .brand { font-size: 20pt; text-align: center; vertical-align: middle; }
.mast b { font-weight: 700; }
.mast .v { font-size: 14pt; }
.banner { color: #e2231a; font-size: 19pt; line-height: 1.2; }
.img { object-fit: contain; display: block; }
.breakdown { width: 100%; font-size: 13pt; border: 2px solid #111; }
.breakdown th, .breakdown td { border: 1px solid #111; padding: 5px 6px; text-align: center; vertical-align: middle; }
.breakdown th { font-size: 13pt; }
.breakdown td.cwy { font-size: 26pt; line-height: 1; width: 0.95in; }
.breakdown .ref { color: #e2231a; font-size: 10pt; display: block; margin-bottom: 3px; }
.label { font-size: 14pt; }
.big-label { font-size: 22pt; }
.dim { color: #e2231a; font-size: 15pt; }
.box { border: 1.5px solid #111; padding: 10px 14px; }
table.spec { width: 100%; border: 1.5px solid #111; font-size: 10.5pt; }
table.spec th, table.spec td { border: 1px solid #111; padding: 3px 5px; text-align: center; vertical-align: middle; }
table.spec th { background: #111; color: #fff; font-size: 10pt; }
table.spec td.code { font-size: 11pt; white-space: nowrap; }
ul.feat { margin: 0; padding-left: 0; list-style: none; font-size: 15pt; line-height: 1.55; }
svg.flat { width: 100%; height: 100%; display: block; overflow: visible; }
svg.flat-mat g[id="dimensions"] { display: none; }
svg.flat-measure g[id="callouts"] > g[data-paper-data*='"kind":"material"'], svg.flat-measure g[id="callouts"] > g[data-paper-data*='"kind":"logo"'] { display: none; }
svg.flat-indicative g[id="dimensions"], svg.flat-indicative g[id="callouts"], svg.flat-plain g[id="dimensions"], svg.flat-plain g[id="callouts"] { display: none; }
.inferred { color: #e2231a; font-size: 14pt; }
[style*="columns:2"] > div { break-inside: avoid; }
.upd { color: #e2231a; font-size: 0.85em; margin-left: 4px; white-space: nowrap; }
.upd-tag { color: #e2231a; font-size: 12pt; }
table.log { width: 100%; border: 1.5px solid #111; font-size: 13pt; }
table.log th, table.log td { border: 1px solid #111; padding: 6px 8px; vertical-align: top; text-align: left; }
table.log th { background: #111; color: #fff; }
ul.feat li::before { content: "-  "; }
.abs { position: absolute; }
.cap { font-size: 16pt; line-height: 1.2; }
.zoomcap { display: flex; gap: 10px; align-items: center; justify-content: center; font-size: 17pt; margin-bottom: 8px; }
.redbox { border: 3px solid #e2231a; }
`;

function tag(doc: PackDoc, n: number, section: string) {
  return `<div class="tag">PAGE ${n}/${doc.plan.total}<br/>${esc(section)}${pageUpd(doc, section)}${doc.brand.logo ? `<br/><img class="logo" src="${doc.brand.logo.src}"/>` : ""}</div>`;
}

function head(doc: PackDoc, n: number, section: string) {
  const sec = /^SWATCH|MTL$/.test(section) ? "SWATCH CARDS" : section;
  return `<div class="style-head">${up(doc.pack.styleNo)}</div><div class="style-sub">PAGE ${n}/${doc.plan.total}<br/>${esc(section)}${pageUpd(doc, sec, true)}</div>${doc.brand.logo ? `<img src="${doc.brand.logo.src}" style="position:absolute;top:0.32in;right:0.4in;max-height:0.5in;max-width:2.4in"/>` : `<div style="position:absolute;top:0.32in;right:0.4in;font-size:16pt">${up(doc.brand.name)}</div>`}`;
}

function commentsFor(doc: PackDoc, section: string, n?: number) {
  const cs = doc.comments.filter((c) => c.pages.includes(section));
  if (!cs.length) return "";
  return `<div class="comments">${cs.map((c) => `<div class="c"><span class="bubble">${c.letter}</span><span>${up(crossRef(doc, c, n))}</span></div>`).join("")}</div>`;
}

/**
 * "SEE REFERENCE PHOTOS …" gets the page numbers it means: every page where that comment letter's
 * photos print or the comment itself appears (computed after page skipping).
 */
function crossRef(doc: PackDoc, c: { letter: string; text: string; pages: string[] }, n?: number) {
  if (!/REFERENCE PHOTO/i.test(c.text) || /\bPAGES?\s+\d/i.test(c.text)) return c.text;
  const nums = new Set<number>();
  const add = (section: string) => doc.plan.pages.filter((p) => p.section === section).forEach((p) => nums.add(p.n));
  for (const r of doc.references) if (r.letter === c.letter) add(r.page);
  for (const sec of c.pages) if (sec !== "MATERIALS / HARDWARE") add(sec);
  const list = [...nums].filter((x) => x !== n).sort((a, b) => a - b);
  if (!list.length) return c.text;
  return c.text.replace(/(SEE REFERENCE PHOTOS?)/i, `$1 ON PAGE${list.length > 1 ? "S" : ""} ${list.join(", ")}`);
}

/* ------------------------------ layout helpers (inches) ------------------------------ */
type R = { x: number; y: number; w: number; h: number };
const RED = "#e2231a";
const r2 = (v: number) => Math.round(v * 1000) / 1000;

/** Where an image of natural size w × h lands when contained in a box. */
function fit(img: { w: number; h: number } | null | undefined, box: R): R {
  if (!img || !img.w || !img.h) return box;
  const k = Math.min(box.w / img.w, box.h / img.h);
  const w = img.w * k,
    h = img.h * k;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
const at = (r: R) => `position:absolute;left:${r2(r.x)}in;top:${r2(r.y)}in;width:${r2(r.w)}in;height:${r2(r.h)}in;`;
function imgIn(img: { src: string; w: number; h: number } | null | undefined, box: R, extra = "", top = false) {
  if (!img) return "";
  const r = fit(img, box);
  return `<img src="${img.src}" style="${at(top ? { ...r, y: box.y } : r)}${extra}"/>`;
}

/** Page-sized SVG in inches for leader lines, arrows and rings drawn over the content. */
function overlay(inner: string) {
  return `<svg class="abs" style="left:0;top:0;width:17in;height:11in;overflow:visible;pointer-events:none;z-index:5" viewBox="0 0 17 11" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${RED}"/></marker></defs>${inner}</svg>`;
}
/** A red line; `arrow` puts heads on the end (or both ends), `dot` a dot at the end. */
function lead(x1: number, y1: number, x2: number, y2: number, o: { w?: number; arrow?: "end" | "both"; dot?: boolean } = {}) {
  const m = o.arrow ? ` marker-end="url(#ah)"${o.arrow === "both" ? ` marker-start="url(#ah)"` : ""}` : "";
  return `<path d="M${r2(x1)} ${r2(y1)} L${r2(x2)} ${r2(y2)}" stroke="${RED}" stroke-width="${o.w ?? 0.025}" fill="none"${m}/>${o.dot ? `<circle cx="${r2(x2)}" cy="${r2(y2)}" r="0.07" fill="${RED}"/>` : ""}`;
}
/** Red text with a white plate behind it (dimension values on drawings). */
function plate(x: number, y: number, text: string, size = 15, anchor: "start" | "middle" | "end" = "middle") {
  const w = (text.length * size * 0.0072 + 0.16),
    h = size / 72 + 0.1;
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return `<rect x="${r2(x0)}" y="${r2(y - h / 2)}" width="${r2(w)}" height="${r2(h)}" fill="#fff"/><text x="${r2(x0 + w / 2)}" y="${r2(y + size / 72 / 2.9)}" text-anchor="middle" font-size="${r2(size / 72)}" fill="${RED}" font-family="IconCond, Arial Narrow, sans-serif" font-weight="700">${esc(text)}</text>`;
}

function proto(doc: PackDoc) {
  const [first, ...rest] = doc.pack.colorways;
  return `${up(doc.pack.styleNo)}${first ?? ""}${rest.length ? `, ${rest.map((r) => r.replace(/^-/, "")).join(", ")}` : ""}`;
}

/** A flat, sized by its box; inferred views carry the INFERRED — CONFIRM tag. */
function flatBox(f: { svg: string; inferred: boolean } | null, cls: string, label?: string) {
  if (!f) return "";
  return `<div style="display:flex;flex-direction:column;height:100%;min-height:0;text-align:center">${label ? `<div class="big-label">${esc(label)}</div>` : ""}${f.inferred ? `<div class="inferred">INFERRED — CONFIRM</div>` : ""}<div style="flex:1;min-height:0">${inlineFlat(f.svg, { className: `flat ${cls}` })}</div></div>`;
}

/** Date of the i-th revision (R1 = 0) for the masthead. */
function rd(doc: PackDoc, i: number) {
  const r = doc.revision.dates[i];
  return r ? ` <span class="red">${esc(r.date)}</span>` : "";
}

/* ------------------------------ 1. MATERIALS / HARDWARE ------------------------------ */
function materialsPage(doc: PackDoc, n: number) {
  const h = doc.header;
  const mast = `<table class="mast">
    <tr><td class="icon" style="width:1.2in">ICON LUXURY GROUP</td>
      <td style="width:2.95in"><b>ATTN:</b> <span class="v">FTY</span></td>
      <td style="width:2.05in;font-size:10pt"><b>ORIGINAL DATE SENT :</b> <span class="v">${esc(doc.revision.original)}</span></td>
      <td style="width:2.9in"><b>SIZE :</b> <span class="red v">${esc(doc.sizeText)}</span>${upd(doc, "dims.")}</td></tr>
    <tr><td rowspan="4" class="brand">${doc.brand.logo ? `<img src="${doc.brand.logo.src}" style="max-width:1.1in;max-height:0.75in"/>` : `<span style="font-size:11pt">BRAND :</span><br/>${up(doc.brand.name)}`}</td>
      <td><b>RETAILER :</b> <span class="v">${up(h.retailer)}</span></td><td><b>REVISED DATE(S) SENT :</b> R1${rd(doc, 0)} &nbsp; R2:${rd(doc, 1)}</td><td><b>SENT BY:</b> <span class="v">${up(h.sentBy)}</span></td></tr>
    <tr><td><b>SEASON :</b> <span class="v">${up(h.season)}</span></td><td>R3:${rd(doc, 2)}</td><td><b>DUE DATE:</b> <span class="v red">${up(h.dueDate)}</span></td></tr>
    <tr><td><b>REFERENCE SAMPLE:</b> <span class="v red">${up(h.referenceSample)}</span></td><td>R4:${rd(doc, 3)}${doc.revision.dates.slice(4).map((r) => ` &nbsp; ${esc(r.label)}: ${esc(r.date)}`).join("")}</td><td><b>PROTO :</b> <span class="v">${proto(doc)}</span></td></tr>
    <tr><td colspan="2"><b>DESCRIPTION:</b> <span class="v">${up(h.description)}</span>${upd(doc, "header.description")}</td><td><b>BAG CATEGORY:</b> <span class="v">${up(h.category)}</span><br/><b>STYLE NAME:</b> <span class="v">${up(doc.pack.styleName)}</span></td></tr>
  </table>`;

  const comments = commentsFor(doc, "MATERIALS / HARDWARE", n);
  const banner = h.physicalSample ? `<div class="banner abs" style="left:2.6in;top:2.3in;width:7.6in;text-align:center">YOU WILL RECEIVE A PHYSICAL SAMPLE IN SIMILAR<br/>SIZE AND SIMILAR MATERIAL.</div>` : "";
  const top = h.physicalSample ? 3.05 : 2.45;
  const callouts = doc.materials
    .map((m) => `<div style="display:flex;gap:10px;align-items:center;font-size:15pt;line-height:1.15"><span class="callout">${m.callout}</span><span>${up(m.name)}${m.locations.length ? `<br/><span style="font-size:11pt" class="muted">${up(m.locations.join(", "))}</span>` : ""}</span></div>`)
    .join("");
  const charm = doc.charm
    ? `<div class="abs" style="left:0.4in;top:${top}in;width:2.1in;text-align:center">${doc.charm.photo ? `<div style="position:relative;height:2.9in">${imgIn(doc.charm.photo, { x: 0, y: 0, w: 2.1, h: 2.9 })}</div>` : ""}<div class="label" style="font-size:15pt;line-height:1.15;margin-top:4px">CUSTOM HARDWARE<br/>KEYCHAIN:<br/>${up(doc.charm.code)} INCLUDED</div></div>`
    : "";

  /* drawing: flats (Phase 3) or the render with a red leader line from LOGO to the logo */
  // The breakdown fills the bottom of the page; more colourways start it higher.
  const bt = Math.max(5.9, 10.68 - 1.0 - doc.rows.length * 1.15);
  const box: R = { x: 2.65, y: top + 0.45, w: 7.5, h: bt - 0.37 - top - 0.45 };
  let drawing = "";
  let lines = "";
  if (doc.flats.front) {
    drawing = `<div class="abs" style="${at({ ...box, y: top, h: box.h + 0.45 })}display:flex;gap:0.2in"><div style="flex:1;min-width:0">${flatBox(doc.flats.front, "flat-mat", "FRONT VIEW")}</div>${doc.flats.back ? `<div style="flex:1;min-width:0">${flatBox(doc.flats.back, "flat-mat", "BACK VIEW")}</div>` : ""}</div>`;
  } else if (doc.render) {
    const r = fit(doc.render, box);
    drawing = `<div class="big-label abs" style="left:${r2(box.x)}in;top:${r2(top)}in;width:${box.w}in;text-align:center">FRONT VIEW</div>${imgIn(doc.render, box)}`;
    if (doc.logo.type) {
      const px = r.x + doc.logoPoint.x * r.w,
        py = r.y + doc.logoPoint.y * r.h;
      const lx = Math.min(box.x + box.w - 0.2, r.x + r.w + 0.1),
        ly = top + 0.55;
      drawing += `<div class="red abs" style="left:${r2(lx - 2.6)}in;top:${r2(ly - 0.36)}in;width:2.6in;text-align:right;font-size:15pt;line-height:1.1;z-index:6">LOGO${doc.logo.placement ? ` (${up(doc.logo.placement.includes("CENTER") ? "CENTERED" : doc.logo.placement)})` : ""}${upd(doc, "branding.")}</div>`;
      lines += lead(lx - 0.15, ly, px, py, { dot: true });
    }
  }
  const side = `<div class="abs" style="left:10.35in;top:${top + 0.1}in;width:3.3in;display:flex;flex-direction:column;gap:14px">
      ${doc.flats.front && doc.logo.type ? `<div class="red" style="font-size:15pt">LOGO${doc.logo.placement ? ` (${up(doc.logo.placement)})` : ""}${upd(doc, "branding.")}</div>` : ""}
      ${callouts}
      ${doc.hardwareFinish ? `<div style="font-size:14pt">HARDWARE: ${up(doc.hardwareFinish)}</div>` : ""}
    </div>`;
  const k = doc.colorwayRenders.length;
  const th = k ? Math.min(2.2, (bt - 0.4 - 2.0 - k * 0.32) / k) : 0;
  const thumbs = k
    ? `<div class="abs" style="left:13.85in;top:1.95in;width:2.75in;display:flex;flex-direction:column;gap:6px">${doc.colorwayRenders
        .map((cr) => `<div style="text-align:center"><div style="font-size:16pt">${up(doc.pack.styleNo)}${esc(cr.colorway)}</div><div style="position:relative;height:${r2(th)}in">${imgIn(cr.img, { x: 0, y: 0, w: 2.75, h: th })}</div></div>`)
        .join("")}</div>`
    : "";

  /* breakdown: a fixed column per numbered material (at least three), blank when unused */
  const cols = doc.matrixColumns;
  const matCols = cols.filter((c) => c.key.startsWith("mat_")).length;
  const spare = Math.max(0, 3 - matCols);
  const lastMat = cols.map((c) => c.key.startsWith("mat_")).lastIndexOf(true);
  const headCell = (c: (typeof cols)[number]) => {
    if (c.key.startsWith("mat_")) return `<th style="text-align:left">${c.key === "mat_1" ? "BODY<br/>" : ""}MATERIAL: <span class="callout" style="width:26px;height:26px;font-size:13pt">${c.callout}</span><br/>${up(c.label)}</th>`;
    if (c.key === "logo") return `<th class="red">LOGO:<br/>${up(doc.logo.type.split(" ")[0] ?? "")}${upd(doc, "branding.logo_type", "branding.logo_code", "branding.finish", "branding.fill")}</th>`;
    return `<th>${esc(c.label).replace(" &amp; ", "<br/>&amp; ")}</th>`;
  };
  const spareTh = Array.from({ length: spare }, () => `<th style="width:0.9in"></th>`).join("");
  const spareTd = Array.from({ length: spare }, () => `<td></td>`).join("");
  const rows = doc.rows
    .map(
      (r) =>
        `<tr><td class="cwy">${/^[A-Z]+\d+$/.test(doc.pack.styleNo) ? `${up(doc.pack.styleNo.replace(/^[A-Z]+/, ""))}<br/>` : ""}${esc(r.code)}${r.name ? `<div style="font-size:10pt;margin-top:3px">${up(r.name)}</div>` : ""}</td>${r.cells
          .map((c, i) => {
            const ref = c.ref ? (c.refKind === "swatch" ? `<span class="ref">(SEE PG ${c.ref} FOR SWATCH CARD REFERENCE)</span>` : "") : "";
            const after = c.ref && c.refKind === "artwork" ? `<br/>SEE DETAIL SHEET PG ${c.ref}` : "";
            return `<td style="${c.key.startsWith("mat_") ? "text-align:left" : ""}">${ref}${up(c.text)}${after}</td>${i === lastMat ? spareTd : ""}`;
          })
          .join("")}</tr>`,
    )
    .join("");
  const table = `<table class="breakdown" style="height:${r2(10.68 - bt)}in;${doc.rows.length > 2 ? "font-size:11.5pt" : ""}"><tr><th>CWY</th>${cols.map((c, i) => headCell(c) + (i === lastMat ? spareTh : "")).join("")}</tr>${rows}</table>`;

  return `<section class="page">
    ${tag(doc, n, "MATERIALS / HARDWARE")}
    <div class="abs" style="left:0.4in;top:0.32in">${mast}</div>
    <div class="abs" style="left:9.7in;top:0.32in;width:4.35in"><div class="label" style="background:#111;color:#fff;display:inline-block;padding:1px 8px;margin-bottom:8px">COMMENTS:</div>${comments}</div>
    ${banner}${charm}${drawing}${side}${thumbs}
    <div class="small abs" style="left:0.4in;top:${r2(bt - 0.3)}in">MATERIAL / COLOR BREAKDOWN${upd(doc, "materials.", "edge.", "hardware.finish")}</div>
    <div class="abs" style="left:0.4in;right:0.4in;top:${r2(bt)}in">${table}</div>
    ${overlay(lines)}
  </section>`;
}

/* ------------------------------ 2. PRODUCT FEATURES ------------------------------ */
function featuresPage(doc: PackDoc, n: number) {
  const d = doc.dims;
  const v = (x?: number) => (typeof x === "number" ? `${x}${doc.U}` : "");
  const box: R = { x: 0.9, y: 1.9, w: 10.2, h: 7.4 };
  const r = fit(doc.render, box);
  // Red dimension arrows along the product: W under it, H up the right side, D across the near corner.
  const arrows = [
    d.w != null ? lead(r.x + r.w * 0.22, r.y + r.h + 0.3, r.x + r.w * 0.98, r.y + r.h + 0.05, { arrow: "both", w: 0.03 }) + plate(r.x + r.w * 0.6, r.y + r.h + 0.5, v(d.w), 24) : "",
    d.h != null ? lead(r.x + r.w + 0.3, r.y + r.h * 0.85, r.x + r.w + 0.3, r.y + r.h * 0.12, { arrow: "both", w: 0.03 }) + plate(r.x + r.w + 0.75, r.y + r.h * 0.48, v(d.h), 24) : "",
    d.d != null ? lead(r.x - 0.05, r.y + r.h * 0.72, r.x + r.w * 0.2, r.y + r.h + 0.3, { arrow: "both", w: 0.03 }) + plate(r.x - 0.05, r.y + r.h + 0.3, v(d.d), 24) : "",
  ].join("");
  return `<section class="page">
    ${head(doc, n, "PRODUCT FEATURES")}
    <div class="abs" style="left:0.4in;top:1.4in;font-size:17pt">ITEM: ${up(doc.header.description || doc.pack.styleName)}</div>
    ${doc.render ? imgIn(doc.render, box) : ""}
    <div class="box abs" style="right:0.4in;top:1.9in;width:4.4in;min-height:4.2in;padding:16px 20px">
      <div style="font-size:14pt;margin-bottom:12px">PRODUCT<br/>FEATURES</div>
      <ul class="feat">${doc.features.map((f) => `<li>${up(f)}</li>`).join("")}</ul>
    </div>
    ${overlay(arrows)}
  </section>`;
}

/* ------------------------------ 3. MEASUREMENTS SHEET ------------------------------ */
function measurementsPage(doc: PackDoc, n: number) {
  const d = doc.dims;
  const overall = [
    typeof d.h === "number" ? { t: `${d.h}${doc.U} TOTAL HEIGHT`, k: "dims." } : null,
    typeof d.w === "number" ? { t: `${d.w}${doc.U} TOTAL WIDTH`, k: "dims." } : null,
    typeof d.d === "number" ? { t: `${d.d}${doc.U} TOTAL DEPTH`, k: "dims." } : null,
  ].filter(Boolean) as { t: string; k: string }[];
  const closureRef = doc.references.find((r) => r.onMeasurements);
  const sideRef = doc.references.find((r) => r.role === "SIDE_VIEW");
  const tables = doc.pom.length > 0 || doc.placements.length > 0;
  const hasSide = !!(doc.flats.side || sideRef);
  const box: R = tables ? { x: 0.4, y: 2.25, w: 7.9, h: 4.75 } : { x: 0.4, y: 2.25, w: 8.3, h: 8.35 };
  const listX = box.x + box.w + 0.25;
  const listW = (hasSide ? 11.55 : 12.6) - listX;

  const drawing = doc.flats.front ? `<div class="abs" style="${at(box)}">${flatBox(doc.flats.front, "flat-measure")}</div>` : imgIn(doc.render, box);
  const list = `<div class="abs" style="left:${r2(listX)}in;top:${closureRef ? 4.6 : tables ? 2.35 : 4.6}in;width:${r2(listW)}in;font-size:15pt;line-height:1.45">
      ${overall.map((o) => `<div class="red">${esc(o.t)}${upd(doc, o.k)}</div>`).join("")}
      ${doc.measures.map((m) => `<div class="red">${esc(m.label)}: ${esc(m.value)}${upd(doc, m.key)}</div>`).join("")}
      ${doc.logo.type ? `<div style="margin-top:6px">LOGO (${up(doc.logo.placement.includes("CENTER") ? "CENTERED" : doc.logo.placement)}) ${up(doc.logo.type)}${upd(doc, "branding.logo_type", "branding.logo_code", "branding.placement")}</div>` : ""}
      ${doc.strapNote ? `<div style="margin-top:6px">${up(doc.strapNote)}</div>` : ""}
      ${!hasSide && doc.gussetNote ? `<div style="margin-top:6px">${up(doc.gussetNote)}</div>` : ""}
    </div>`;

  // Closure photo top right, with the comment's red curved arrow from the drawing.
  let lines = "";
  let closure = "";
  if (closureRef || doc.closure) {
    // Left of the brand mark and above the side view, as on the Icon sheet.
    const pbox: R = { x: 9.0, y: 0.75, w: 3.7, h: 3.45 };
    const pr = fit(closureRef?.img, pbox);
    closure = `<div class="abs" style="left:8.75in;top:0.3in;width:4.2in;text-align:center;font-size:17pt">${up(doc.closure.split(" — ")[0] || closureRef?.note || "")}</div>${closureRef?.img ? imgIn(closureRef.img, pbox) : ""}${
      doc.closure.includes(" — ") && !closureRef ? `<div class="abs small" style="left:8.85in;top:1in;width:4in;text-align:center">${up(doc.closure.split(" — ")[1])}</div>` : ""
    }`;
    if (closureRef?.img) {
      const dr = fit(doc.flats.front ? null : doc.render, box);
      const sx = dr.x + dr.w * Math.min(0.92, doc.logoPoint.x + 0.3),
        sy = dr.y + dr.h * Math.max(0.15, doc.logoPoint.y + 0.02);
      const ex = pr.x - 0.12,
        ey = pr.y + pr.h * 0.35;
      const cx = (sx + ex) / 2 - 0.4,
        cy = Math.min(sy, ey) - 0.9;
      lines += `<path d="M${r2(sx)} ${r2(sy)} Q${r2(cx)} ${r2(cy)} ${r2(ex)} ${r2(ey)}" stroke="${RED}" stroke-width="0.035" fill="none" marker-end="url(#ah)"/>`;
      // the comment letter sits on the arrow
      const bx = 0.25 * sx + 0.5 * cx + 0.25 * ex,
        by = 0.25 * sy + 0.5 * cy + 0.25 * ey;
      lines += `<circle cx="${r2(bx)}" cy="${r2(by)}" r="0.22" fill="#fff" stroke="${RED}" stroke-width="0.03"/><text x="${r2(bx)}" y="${r2(by + 0.1)}" text-anchor="middle" font-size="0.3" fill="${RED}" font-family="IconCond, Arial Narrow, sans-serif" font-weight="700">${esc(closureRef.letter)}</text>`;
    }
  }

  // Side view: generated flat (Phase 3) or an uploaded side view, with its comment and the gusset note.
  const sideTop = 4.75;
  const side = hasSide
    ? `<div class="abs" style="left:11.75in;top:${sideTop}in;width:4.85in;text-align:right">
        <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center;font-size:17pt;line-height:1.15">${sideRef?.letter ? `<span class="bubble" style="width:36px;height:36px;font-size:17pt">${esc(sideRef.letter)}</span>` : ""}<span>${up(sideRef?.note || "SIDE VIEW")}</span></div>
      </div>
      ${doc.flats.side ? `<div class="abs" style="${at({ x: 11.75, y: sideTop + 0.7, w: 4.85, h: 4.6 })}">${flatBox(doc.flats.side, "flat-measure")}</div>` : imgIn(sideRef?.img, { x: 11.75, y: sideTop + 0.7, w: 4.85, h: 4.6 })}
      ${doc.gussetNote ? `<div class="abs" style="left:10.6in;top:10.42in;width:6in;text-align:right;font-size:16pt">${up(doc.gussetNote)}</div>` : ""}`
    : "";

  const pomTable = doc.pom.length
    ? `<table class="spec"><tr><th>POM</th><th style="text-align:left">POINT OF MEASURE</th><th>VALUE</th><th>TOL ±</th><th style="text-align:left">HOW TO MEASURE</th></tr>${doc.pom
        .map((r, i) => `<tr><td class="code">M${String(i + 1).padStart(2, "0")}</td><td style="text-align:left">${up(r.point)}</td><td class="red">${r.value != null ? `${r.value}${esc(doc.U)}` : ""}</td><td>${r.tol != null ? `${r.tol}${esc(doc.U)}` : ""}</td><td style="text-align:left;font-size:9.5pt">${up(r.how)}</td></tr>`)
        .join("")}</table>`
    : "";
  const placementTable = doc.placements.length
    ? `<div class="small" style="margin:8px 0 3px">HARDWARE PLACEMENT (MM)</div><table class="spec"><tr><th>CODE</th><th style="text-align:left">COMPONENT</th><th>QTY</th><th style="text-align:left">MEASURED</th><th>DISTANCE</th><th>SPACING C/C</th><th style="text-align:left">NOTE</th></tr>${doc.placements
        .map((r) => `<tr><td class="code">${up(r.code)}</td><td style="text-align:left">${up(r.type)}</td><td>${r.qty ?? ""}</td><td style="text-align:left">${up(r.from)}</td><td class="red">${r.distance != null ? `${r.distance} MM` : ""}</td><td class="red">${r.spacing != null ? `${r.spacing} MM` : ""}</td><td style="text-align:left">${up(r.note)}</td></tr>`)
        .join("")}</table>`
    : "";

  return `<section class="page">
    ${head(doc, n, "MEASUREMENTS SHEET")}
    <div class="abs" style="left:0.4in;top:1.3in;width:9.6in">${commentsFor(doc, "MEASUREMENTS SHEET", n)}</div>
    ${drawing}${list}${closure}${side}
    ${tables ? `<div class="abs" style="left:0.4in;top:7.2in;width:${hasSide ? 11.1 : 16.2}in">${pomTable}${placementTable}</div>` : ""}
    ${overlay(lines)}
  </section>`;
}

/** Measurement sheet drawing: the front flat with its dimension lines, else the render. */
function measureVisual(doc: PackDoc) {
  if (doc.flats.front) return flatBox(doc.flats.front, "flat-measure");
  return doc.render ? `<img class="img" src="${doc.render.src}" style="width:100%;height:100%"/>` : "";
}

/* ------------------------------ 4. ENLARGED CAD ------------------------------ */
function cadPage(doc: PackDoc, n: number) {
  const k = doc.colorwayRenders.length + doc.flats.indicative.length;
  const w = k <= 2 ? 7.9 : 5.2;
  return `<section class="page">
    ${head(doc, n, "ENLARGED CAD")}
    <div style="display:flex;flex-wrap:wrap;gap:0.25in;justify-content:center;margin-top:0.35in">
      ${doc.colorwayRenders.map((r) => `<div style="text-align:center;width:${w}in"><div style="font-size:24pt;margin-bottom:8px">${up(doc.pack.styleNo)}${esc(r.colorway)}</div>${r.img ? `<img class="img" src="${r.img.src}" style="width:${w}in;height:${k <= 2 ? 6.6 : 3.6}in"/>` : ""}</div>`).join("")}
      ${doc.flats.indicative.map((r) => `<div style="text-align:center;width:${w}in"><div style="font-size:24pt;margin-bottom:8px">${up(doc.pack.styleNo)}${esc(r.colorway)}</div><div style="width:${w}in;height:${k <= 2 ? 6.2 : 3.3}in">${r.svg}</div><div class="red" style="font-size:14pt;margin-top:6px">COLOUR INDICATIVE</div></div>`).join("")}
    </div>
  </section>`;
}

/* ------------------------------ 5. REFERENCE PHOTOS ------------------------------ */
type RefPhoto = PackDoc["references"][number];

/** A zoom detail: the marked circle of the photo, enlarged, in a thick red ring (diameter d, inches). */
function zoomSvg(r: RefPhoto, d: number) {
  if (!r.img || !r.zoom) return "";
  const z = r.zoom;
  const iw = 1 / (2 * z.r),
    ih = (iw * r.img.h) / r.img.w;
  const id = `z${Math.round(z.x * 1e4)}${Math.round(z.y * 1e4)}${Math.round(d * 100)}`;
  return `<svg width="${r2(d)}in" height="${r2(d)}in" viewBox="-0.03 -0.03 1.06 1.06" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}"><circle cx="0.5" cy="0.5" r="0.5"/></clipPath></defs><image href="${r.img.src}" x="${r2(0.5 - z.x * iw)}" y="${r2(0.5 - z.y * ih)}" width="${r2(iw)}" height="${r2(ih)}" preserveAspectRatio="none" clip-path="url(#${id})"/><circle cx="0.5" cy="0.5" r="0.5" fill="none" stroke="${RED}" stroke-width="0.022"/></svg>`;
}

/** Caption row: red comment bubble + caption. */
function refCaption(r: RefPhoto) {
  if (!r.letter && !r.note) return "";
  return `<div class="zoomcap">${r.letter ? `<span class="bubble" style="width:36px;height:36px;font-size:17pt">${esc(r.letter)}</span>` : ""}<span>${up(r.note)}</span></div>`;
}

/** Lays photos out to fill a box: picks the column count that gives the largest photos. */
function photoGrid(items: RefPhoto[], box: R) {
  if (!items.length) return "";
  const cap = 0.5;
  let best = { cols: 1, size: 0 };
  for (let cols = 1; cols <= items.length; cols++) {
    const rows = Math.ceil(items.length / cols);
    const cw = (box.w - (cols - 1) * 0.25) / cols,
      ch = (box.h - (rows - 1) * 0.25) / rows - cap;
    const size = Math.min(...items.map((it) => {
      if (it.zoom) return Math.min(cw, ch) ** 2 * 0.785;
      const f = fit(it.img, { x: 0, y: 0, w: cw, h: ch });
      return f.w * f.h;
    }));
    if (size > best.size) best = { cols, size };
  }
  const cols = best.cols,
    rows = Math.ceil(items.length / cols);
  const cw = (box.w - (cols - 1) * 0.25) / cols,
    ch = (box.h - (rows - 1) * 0.25) / rows;
  return items
    .map((it, i) => {
      const cell: R = { x: box.x + (i % cols) * (cw + 0.25), y: box.y + Math.floor(i / cols) * (ch + 0.25), w: cw, h: ch };
      const hasCap = !!(it.letter || it.note) && !(it.letter && !it.zoom && items.some((o) => o !== it && o.zoom && o.letter === it.letter));
      const top = hasCap ? cap : 0;
      const body: R = { x: cell.x, y: cell.y + top, w: cell.w, h: cell.h - top };
      const d = Math.min(body.w, body.h);
      return `<div class="abs" style="${at({ ...cell, h: top || 0.01 })}">${hasCap ? refCaption(it) : ""}</div>${
        it.zoom ? `<div class="abs" style="left:${r2(body.x + (body.w - d) / 2)}in;top:${r2(body.y + (body.h - d) / 2)}in">${zoomSvg(it, d)}</div>` : imgIn(it.img, body)
      }`;
    })
    .join("");
}

function referencePage(doc: PackDoc, n: number) {
  const refs = doc.references.filter((r) => r.page === "REFERENCE PHOTOS FOR CONSTRUCTION");
  // Main photos first, zoom details after them (as on PINK013 p4: the bag, then the circled strap clip).
  const ordered = [...refs.filter((r) => !r.zoom), ...refs.filter((r) => r.zoom)];
  return `<section class="page">
    ${head(doc, n, "REFERENCE PHOTOS FOR CONSTRUCTION")}
    <div class="abs" style="left:5in;top:0.4in;width:9.5in">${commentsFor(doc, "REFERENCE PHOTOS FOR CONSTRUCTION", n)}</div>
    ${photoGrid(ordered, { x: 0.4, y: 1.2, w: 16.2, h: 9.6 })}
  </section>`;
}

/* ------------------------------ 6. INTERIOR & LINING ------------------------------ */
const OPPOSITE: Record<string, string> = { "BACK WALL": "FRONT WALL", "FRONT WALL": "BACK WALL", "SIDE 1": "SIDE 2", "SIDE 2": "SIDE 1" };

/** The lining tile (uploaded artwork or generated) and its size in the pack's unit. */
function liningTile(doc: PackDoc) {
  const l = doc.lining;
  if (!l) return null;
  const img = l.img ?? l.generated;
  if (!img) return null;
  const toUnit = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    const cm = /MM/i.test(l.tileUnit) ? n / 10 : /IN/i.test(l.tileUnit) ? n * 2.54 : n;
    return doc.unit === "in" ? cm / 2.54 : cm;
  };
  const w = toUnit(l.tileW),
    h = toUnit(l.tileH) ?? w;
  return w && h ? { img, w, h } : null;
}

/**
 * One inside wall drawn to scale (s = inches per pack unit): hatched or lining background, pocket,
 * binding with its leader, woven label, and red dimension arrows for every entered value.
 */
function wallSvg(doc: PackDoc, mode: "hatched" | "lining", wall: string, s: number) {
  const i = doc.interior;
  const side = /SIDE/.test(wall);
  const W = (side ? doc.dims.d : doc.dims.w) ?? null,
    H = doc.dims.h ?? null;
  if (W == null || H == null) return "";
  const u = doc.unit === "in" ? '"' : " CM";
  const p = i.pockets.find((x) => x.wall === wall);
  const fs = 0.2 / s; // ~14pt in drawing units
  const sw = 0.025 / s;
  const pad = { l: 1.75 / s, r: 0.6 / s, t: 0.75 / s, b: 0.3 / s };
  const tile = liningTile(doc);
  const id = `${mode}-${wall.replace(/\W/g, "")}-${Math.round(s * 1000)}`;
  const bg =
    mode === "hatched"
      ? `<pattern id="h${id}" width="${0.12 / s}" height="${0.12 / s}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${0.12 / s}" stroke="#555" stroke-width="${0.012 / s}"/></pattern><rect width="${W}" height="${H}" fill="url(#h${id})"/>`
      : tile
        ? `<pattern id="l${id}" width="${tile.w}" height="${tile.h}" patternUnits="userSpaceOnUse"><image href="${tile.img.src}" width="${tile.w}" height="${tile.h}" preserveAspectRatio="none"/></pattern><rect width="${W}" height="${H}" fill="url(#l${id})"/>`
        : `<rect width="${W}" height="${H}" fill="${doc.lining?.colourHex[0] ?? "#e8e8e8"}"/>`;
  const marker = `<marker id="a${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${RED}"/></marker>`;
  const arrow = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${RED}" stroke-width="${sw}" fill="none" marker-start="url(#a${id})" marker-end="url(#a${id})"/>`;
  const box = (x: number, y: number, t: string, anchor: "middle" | "start" | "end" = "middle") => {
    const w = t.length * fs * 0.55 + fs * 0.6,
      h = fs * 1.35;
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    return `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="${sw * 0.6}"/><text x="${x0 + w / 2}" y="${y + fs * 0.36}" font-size="${fs}" text-anchor="middle" fill="#111" font-family="IconCond, Arial Narrow, sans-serif" font-weight="700">${esc(t)}</text>`;
  };
  let body = "";
  if (p) {
    const pw = p.w ?? W * 0.7,
      top = p.top_offset ?? H * 0.15,
      ph = p.h ?? H - top - H * 0.05;
    const px = (W - pw) / 2;
    body += `<rect x="${px}" y="${top}" width="${pw}" height="${ph}" fill="${mode === "hatched" ? "#fff" : "none"}" stroke="#111" stroke-width="${sw * 1.4}"/>`;
    body += `<rect x="${px + 0.07 / s}" y="${top + 0.07 / s}" width="${pw - 0.14 / s}" height="${ph - 0.14 / s}" fill="none" stroke="#111" stroke-width="${sw * 0.8}" stroke-dasharray="${sw * 6} ${sw * 4}"/>`;
    if (i.pocketEdge === "BINDING" || /BINDING/.test(i.pocketEdge)) {
      body += `<rect x="${px}" y="${top - 0.07 / s}" width="${pw}" height="${0.14 / s}" fill="#fff" stroke="#111" stroke-width="${sw}"/><line x1="${px}" y1="${top}" x2="${px + pw}" y2="${top}" stroke="#111" stroke-width="${sw * 0.7}" stroke-dasharray="${sw * 5} ${sw * 3}"/>`;
      // BINDING label outside the wall, leader line to the binding
      body += `<text x="${W + 0.1 / s}" y="${-0.45 / s}" font-size="${fs}" text-anchor="end" fill="#111" font-family="IconCond, Arial Narrow, sans-serif" font-weight="700">${esc(i.pocketEdge.toUpperCase())}</text><path d="M${W - 0.3 / s} ${-0.38 / s}L${px + pw - 0.25 / s} ${top - 0.03 / s}" stroke="${RED}" stroke-width="${sw}" fill="none"/><circle cx="${px + pw - 0.25 / s}" cy="${top - 0.03 / s}" r="${0.04 / s}" fill="${RED}"/>`;
    }
    const pt = `${p.type}${p.zip_size ? ` (${p.zip_size} ZIP)` : ""}`;
    if (p.type) body += `<rect x="${px + pw * 0.08}" y="${top + ph * 0.75 - Math.min(fs, (pw * 0.84) / (pt.length * 0.55))}" width="${pw * 0.84}" height="${Math.min(fs, (pw * 0.84) / (pt.length * 0.55)) * 1.3}" fill="#fff"/><text x="${px + pw / 2}" y="${top + ph * 0.75}" font-size="${Math.min(fs, (pw * 0.84) / (pt.length * 0.55))}" text-anchor="middle" fill="#111" font-family="IconCond, Arial Narrow, sans-serif" font-weight="700">${esc(`${p.type}${p.zip_size ? ` (${p.zip_size} ZIP)` : ""}`.toUpperCase())}</text>`;
    if (p.top_offset != null) body += arrow(px + pw * 0.15, 0, px + pw * 0.15, top) + box(px + pw * 0.15 + 0.06 / s, top / 2, `${p.top_offset}${u}`, "start");
    if (p.w != null) body += arrow(px, top + 0.32 / s, px + pw, top + 0.32 / s) + box(px + pw / 2, top + 0.32 / s, `${p.w}${u}`);
    body += arrow(px - 0.18 / s, top, px - 0.18 / s, top + ph) + box(-0.15 / s, top + ph / 2, p.h != null ? `${p.h}${u}` : "REMAINING HEIGHT", "end");
  }
  const L = i.labelSize;
  if (p && i.label && L?.w != null && L?.h != null && wall === doc.interiorWall) {
    const top = p.top_offset ?? H * 0.15;
    const lw = Number(L.w),
      lh = Number(L.h);
    const lx = W / 2 - lw / 2,
      ly = top + (i.labelOffset ?? 0);
    body += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="#c8177a"/><text x="${W / 2}" y="${ly + lh * 0.62}" font-size="${Math.min(fs, lh * 0.45, (lw * 0.9) / (doc.brand.name.length * 0.68))}" text-anchor="middle" fill="#fff" font-family="Georgia, serif" font-weight="700">${esc(doc.brand.name.toUpperCase())}</text>`;
    if (i.labelOffset != null) body += arrow(lx + lw + 0.15 / s, top, lx + lw + 0.15 / s, ly) + box(lx + lw + 0.25 / s, top + (ly - top) / 2 - 0.06 / s, `${i.labelOffset}${u}`, "start");
    body += arrow(lx, ly + lh + 0.15 / s, lx + lw, ly + lh + 0.15 / s) + box(lx + lw / 2, ly + lh + 0.4 / s, `${L.w}${u}`);
    body += arrow(lx - 0.15 / s, ly, lx - 0.15 / s, ly + lh) + box(lx - 0.25 / s, ly + lh / 2, `${L.h}${u}`, "end");
  }
  const vbw = W + pad.l + pad.r,
    vbh = H + pad.t + pad.b;
  return `<svg width="${r2(vbw * s)}in" height="${r2(vbh * s)}in" viewBox="${-pad.l} ${-pad.t} ${vbw} ${vbh}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"><defs>${marker}</defs>${bg}<rect width="${W}" height="${H}" fill="none" stroke="#111" stroke-width="${sw * 1.4}"/>${body}</svg>`;
}

function wallTitle(wall: string, mode: "hatched" | "lining", centered: boolean) {
  const name = /WALL/.test(wall) ? `INTERIOR MAIN COMPARTMENT ${wall}` : `INTERIOR ${wall}`;
  return `<div style="font-size:18pt;line-height:1.2">${esc(name)}${mode === "lining" ? "<br/>W/ LINING" : centered ? `<br/>(PKT IS CENTERED)` : ""}</div>`;
}

function interiorPage(doc: PackDoc, n: number, withArtwork: boolean) {
  const i = doc.interior;
  const lab = i.label ? `ADD <span class="red">${up(i.label.code)}</span> ${up(i.label.name || i.label.type)}${i.labelCentered ? " (CENTERED)" : ""}` : "";
  const W = doc.dims.w ?? 20,
    D = doc.dims.d ?? 8,
    H = doc.dims.h ?? 16;
  const main = doc.interiorWall;
  const photos = doc.references.filter((r) => r.page === "INTERIOR & LINING");
  // Panels: hatched + lining of the pocket wall; with the lining artwork on this page, each pocket
  // wall plus its plain opposite wall, both lined (as TB25: SIDE 1 with the zip pocket, SIDE 2).
  const walls = withArtwork ? [...new Set([...i.pockets.map((p) => p.wall ?? "").filter(Boolean), OPPOSITE[main] ?? "FRONT WALL"])].slice(0, 2) : [main, main];
  const modes: ("hatched" | "lining")[] = withArtwork ? walls.map(() => "lining") : ["hatched", "lining"];
  const widthOf = (w: string) => (/SIDE/.test(w) ? D : W);
  let panels = "";
  let lines = "";
  if (withArtwork) {
    // Two walls side by side, as large as the column left of the repeat allows.
    const s = Math.min(2.75 / Math.max(...walls.map(widthOf)), 4.3 / H);
    panels = walls
      .map((w, k) => `<div class="abs" style="left:${r2(0.4 + k * 5.25)}in;top:1.45in;width:5.1in;text-align:center">${wallTitle(w, "hatched", false)}<div style="margin-top:8px">${wallSvg(doc, modes[k], w, s)}</div></div>`)
      .join("");
  } else {
    const s = Math.min(5.6 / W, 5.0 / H);
    panels = walls
      .map((w, k) => `<div class="abs" style="left:${k === 0 ? 0.3 : 8.6}in;top:2.0in;text-align:center;width:8in">${wallTitle(w, modes[k], i.pockets.some((p) => p.centered) && k === 0)}<div style="margin-top:8px">${wallSvg(doc, modes[k], w, s)}</div></div>`)
      .join("");
  }
  // Photos for this page (e.g. PLEASE MAKE SURE TO ADD INTERIOR BINDING) with caption, dot and leader.
  const pbox: R = withArtwork ? { x: 0.4, y: 7.0, w: 5.0, h: 3.7 } : { x: 12.6, y: 7.6, w: 4.0, h: 3.0 };
  const photo = photos[0];
  let photoHtml = "";
  if (photo?.img) {
    const pr = fit(photo.img, { ...pbox, y: pbox.y + 0.55, h: pbox.h - 0.55 });
    photoHtml = `<div class="abs cap" style="left:${pbox.x}in;top:${pbox.y}in;width:${pbox.w + 1.6}in">${photo.letter ? `<span class="bubble" style="margin-right:8px">${esc(photo.letter)}</span>` : ""}${up(photo.note)}</div>${imgIn(photo.img, { ...pbox, y: pbox.y + 0.55, h: pbox.h - 0.55 })}`;
    const dot = photo.dot ?? { x: 0.5, y: 0.35 };
    lines += lead(pbox.x + 1.2, pbox.y + 0.42, pr.x + dot.x * pr.w, pr.y + dot.y * pr.h, { dot: true });
  }
  return `<section class="page">
    ${head(doc, n, "INTERIOR & LINING")}
    ${lab ? `<div class="abs" style="left:${withArtwork ? 3.9 : 0.4}in;top:${withArtwork ? 0.45 : 1.3}in;font-size:24pt;line-height:1.2;width:9in">${lab}</div>` : ""}
    <div class="abs" style="left:${withArtwork ? 5.9 : 9.4}in;top:${withArtwork ? 0.45 : 1.3}in;width:${withArtwork ? 5.4 : 7}in">${commentsFor(doc, "INTERIOR & LINING", n)}</div>
    ${panels}
    ${withArtwork ? `<div class="abs" style="left:11.0in;top:1.3in;width:5.6in">${artworkBlock(doc, 5.6)}</div>` : ""}
    ${!withArtwork ? `<div class="abs" style="left:0.4in;top:9.35in;display:flex;gap:0.3in;align-items:flex-end">${allWalls(doc)}</div>` : ""}
    ${photoHtml}
    <div class="abs" style="left:${withArtwork ? 5.9 : 7.4}in;bottom:0.35in;width:${withArtwork ? 4.8 : 5}in;font-size:12pt;line-height:1.45">${doc.baseBoard ? `BASE: ${up(doc.baseBoard)}<br/>` : ""}${i.pockets
      .map((p) => `${up(p.type)} ON ${up(p.wall)}${p.w ? ` — ${p.w}${doc.U} WIDE` : ""}${p.top_offset != null ? `, ${p.top_offset}${doc.U} FROM TOP` : ""}${p.zip_size ? `, ${up(p.zip_size)} ZIP` : ""}`)
      .join("<br/>")}${i.seamBinding && !photo ? "<br/>PLEASE MAKE SURE TO ADD INTERIOR BINDING" : ""}${i.padding ? `<br/>${up(i.padding)}` : ""}</div>
    ${overlay(lines)}
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
  const maxH = 0.75 * 72,
    maxW = 1.2 * 72;
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
      return `<div style="text-align:center;font-size:10pt"><svg width="${ws}" height="${hs}" xmlns="http://www.w3.org/2000/svg"><rect width="${ws}" height="${hs}" fill="#f2f2f2" stroke="#111"/>${rects}${board}</svg><div style="margin-top:3px">${wall.name}</div><div class="muted" style="font-size:9pt">${caption}</div></div>`;
    })
    .join("");
}

/* ------------------------------ 7. LINING / PRINT ARTWORK ------------------------------ */
/** The repeat across a panel of `w` inches with a thick red tile box (about 3½ tiles across). */
function repeatPanel(doc: PackDoc, w: number, h: number, labelSize = 26) {
  const l = doc.lining!;
  const img = l.img ?? l.generated;
  const t = Math.min(w / 3.4, h / 3.2);
  const th = img ? (t * img.h) / img.w : t;
  const bx = (w - t) / 2,
    by = (h - th) / 2;
  const unit = up(l.tileUnit);
  return `<div style="position:relative;width:${r2(w)}in;height:${r2(h)}in;${img ? `background:url(${img.src});background-size:${r2(t)}in ${r2(th)}in;background-position:${r2(bx)}in ${r2(by)}in;` : `background:${l.colourHex[0] ?? "#eee"};`}">
      <div class="abs" style="left:${r2(bx)}in;top:${r2(by)}in;width:${r2(t)}in;height:${r2(th)}in;border:${labelSize >= 20 ? 6 : 4}px solid ${RED}"></div>
      <div class="abs red" style="left:${r2(bx)}in;top:${r2(by - labelSize / 72 - 0.18)}in;width:${r2(t)}in;text-align:center"><span style="background:#fff;padding:0 6px;font-size:${labelSize}pt">${esc(l.tileW)} ${unit}</span></div>
      <div class="abs red" style="left:${r2(bx - (String(l.tileH).length + unit.length + 1) * labelSize * 0.0075 - 0.35)}in;top:${r2(by + th / 2 - labelSize / 144)}in"><span style="background:#fff;padding:0 6px;font-size:${labelSize}pt">${esc(l.tileH)} ${unit}</span></div>
    </div>`;
}

function artworkBlock(doc: PackDoc, w: number) {
  const l = doc.lining!;
  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div style="font-size:22pt;color:${RED}">REPEAT</div>
    ${repeatPanel(doc, w, w * 0.95, 18)}
    <div style="font-size:13pt;line-height:1.4">${l.baseFabric ? `FABRIC:<br/>${up(l.baseFabric)}<br/>` : ""}COLORS:<br/>${l.colours.map((c) => up(c)).join("<br/>")}</div>
    <div style="display:flex;gap:10px">${l.colours.map((c, i) => `<div style="width:1.1in;text-align:center;font-size:10pt"><div style="height:0.7in;background:${l.colourHex[i]};border:1px solid #999"></div>${up(c)}</div>`).join("")}</div>
  </div>`;
}

function artworkPage(doc: PackDoc, n: number) {
  const l = doc.lining!;
  const app = doc.references.find((r) => r.page === "LINING / PRINT ARTWORK");
  let left = `<div class="abs" style="left:0.4in;top:1.9in;width:4.4in;font-size:18pt;line-height:1.3">LINING IS ${up(l.application)} REPEAT</div>`;
  let lines = "";
  if (app?.img) {
    const cap = up(app.note || `LINING IS ${l.application} REPEAT`);
    const pbox: R = { x: 0.4, y: 2.75, w: 4.4, h: 7.85 };
    const pr = { ...fit(app.img, pbox), y: pbox.y };
    const dot = app.dot ?? { x: 0.5, y: 0.25 };
    left = `<div class="abs" style="left:0.4in;top:1.45in;width:4.4in;text-align:center;font-size:17pt;line-height:1.2">${cap}</div>${imgIn(app.img, pbox, "", true)}`;
    lines += lead(2.6, 2.3, pr.x + dot.x * pr.w, pr.y + dot.y * pr.h, { dot: true, w: 0.03 });
  }
  return `<section class="page">
    ${head(doc, n, "LINING / PRINT ARTWORK")}
    ${left}
    <div class="abs" style="left:5.2in;top:0.3in;width:9.3in;text-align:center;font-size:24pt">LINING ARTWORK</div>
    <div class="abs" style="left:5.2in;top:0.85in">${repeatPanel(doc, 9.3, 8.4)}</div>
    <div class="abs" style="left:5.2in;top:9.4in;width:9.3in;display:flex;gap:0.3in;justify-content:center">${l.colours.map((c, i) => `<div style="text-align:center;font-size:16pt"><div style="width:2.2in;height:0.75in;background:${l.colourHex[i]};border:1px solid #999"></div>${up(c)}</div>`).join("")}</div>
    <div class="abs" style="left:14.8in;top:1.9in;width:1.8in;font-size:13pt;line-height:1.45">${l.motif ? `MOTIF:<br/>${up(l.motif)}<br/>` : ""}${l.repeat ? `REPEAT:<br/>${up(l.repeat)}<br/>` : ""}${l.baseFabric ? `FABRIC:<br/>${up(l.baseFabric)}` : ""}</div>
    ${overlay(lines)}
  </section>`;
}

/* ------------------------------ 8. HARDWARE / BRANDING DETAIL ------------------------------ */
function detailPage(doc: PackDoc, n: number) {
  const mm = (s: string) => s.split(/\s*X\s*/i).map((x) => parseFloat(x)).filter((x) => Number.isFinite(x));
  const photos = doc.references.filter((r) => r.page === "HARDWARE / BRANDING DETAIL");
  const panelH = doc.detail.length > 1 ? 3.9 : 5.4;
  const panels = doc.detail
    .map((h) => {
      const [wmm, hmm] = mm(h.dimsMm);
      // 100% views: drawn at true size (mm on paper).
      const view = (k: "front" | "side" | "rear", label: string, scale = 1) => {
        const v = h.views[k];
        if (!v) return "";
        const hh = (hmm ?? 40) * scale;
        const ww = hh * (v.w / v.h);
        return `<div style="text-align:center"><img src="${v.src}" style="width:${r2(ww)}mm;height:${r2(hh)}mm;object-fit:contain;display:block;margin:0 auto"/><div style="font-size:12pt;margin-top:4px">${label}</div></div>`;
      };
      // Enlarged views beside the 100% set, so every detail dimension reads.
      const enlarge = Math.max(1.5, Math.min(3, ((panelH - 0.9) * 25.4) / (hmm ?? 40)));
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
      const dims = h.detailDims.length
        ? `<div style="font-size:15pt;line-height:1.4"><div style="font-size:12pt;margin-bottom:4px">DETAIL DIMENSIONS</div>${h.detailDims.map((d) => `<div><span class="red">${d.mm != null ? `${d.mm}MM` : ""}</span> ${up(d.label)}</div>`).join("")}</div>`
        : "";
      return `<div class="box" style="display:flex;gap:0.35in;align-items:flex-start;margin-bottom:0.2in;min-height:${panelH}in;padding:14px 18px">
        <div style="width:1.9in"><div style="font-size:15pt">${up(h.type)}<br/>${up(h.code)}</div><div style="font-size:14pt;margin-top:4px">${esc(h.dimsMm)} MM</div>
          <div style="display:inline-block;margin-top:10px;padding:4px 14px;border-radius:14px;background:#5ab4e6;color:#fff;font-size:15pt">SIZE 100%</div>
          <div style="display:flex;gap:0.2in;align-items:flex-end;margin-top:0.25in">${view("front", "FRONT")}${view("side", "SIDE")}${view("rear", "REAR")}</div></div>
        <div style="display:flex;gap:0.3in;align-items:flex-end">${view("front", "FRONT", enlarge)}${view("side", "SIDE", enlarge)}</div>
        ${dims}
        <div style="flex:1;font-size:14pt;line-height:1.45;color:#1a8bd0">${notes.map((x) => up(x)).join("<br/>")}</div>
        ${h.photo ? `<div style="position:relative;width:1.8in;height:2.4in">${imgIn(h.photo, { x: 0, y: 0, w: 1.8, h: 2.4 })}</div>` : ""}
      </div>`;
    })
    .join("");
  const lp = doc.logo.panel;
  const logo = lp
    ? `<div style="display:flex;gap:0.6in;align-items:center">
        <div style="position:relative;padding:0.4in 0 0 0.55in">
          <div class="dim" style="position:absolute;top:0;left:0.55in;width:${lp.w}mm;text-align:center;font-size:15pt">${lp.w}MM</div>
          <div class="dim" style="position:absolute;left:0;top:0.4in;height:${lp.h}mm;display:flex;align-items:center;font-size:15pt;writing-mode:vertical-rl;transform:rotate(180deg)">${lp.h}MM</div>
          <div style="width:${lp.w}mm;height:${lp.h}mm;border:2px solid #111;display:flex;align-items:center;justify-content:center;font-size:12pt;outline:1px dashed #111;outline-offset:-5px;letter-spacing:0.3em">${up(doc.brand.name)}</div>
        </div>
        <div style="text-align:center"><div style="font-size:16pt">LOGO ${up(doc.logo.type.replace(" PATCH", ""))}${doc.logo.fill ? ` WITH ${up(doc.logo.fill)}` : ""}</div>${toolingNote(doc)}${lp.photo ? `<div style="position:relative;width:3.2in;height:1.4in;margin-top:8px">${imgIn(lp.photo, { x: 0, y: 0, w: 3.2, h: 1.4 })}</div>` : ""}</div>
      </div>`
    : "";
  const photoBoxes = photos
    .map((ph) => `<div style="border:1.5px solid #111;width:2.9in;text-align:center"><div style="position:relative;height:2in">${imgIn(ph.img, { x: 0, y: 0, w: 2.9, h: 2 })}</div><div style="font-size:14pt;padding:6px 8px;line-height:1.2">${ph.letter ? `<span class="bubble" style="margin-right:6px">${esc(ph.letter)}</span>` : ""}${up(ph.note)}</div></div>`)
    .join("");
  return `<section class="page">
    ${head(doc, n, "HARDWARE / BRANDING DETAIL")}
    <div class="abs" style="left:0.4in;right:0.4in;top:1.35in">${panels}
      <div style="display:flex;gap:0.6in;align-items:center;justify-content:space-between;margin-top:0.25in">${logo}<div style="display:flex;gap:0.4in">${photoBoxes}</div></div>
    </div>
    <div class="abs" style="right:0.4in;top:0.35in;width:7in">${commentsFor(doc, "HARDWARE / BRANDING DETAIL", n)}</div>
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
/** A swatch-card photo contained in `box`, with its red chip box; returns the html and the chip rect (inches). */
function swatchCard(s: PackDoc["swatches"][number], box: R, ring = 5) {
  const pr = fit(s.photo, box);
  const chip = s.chipBox ? { x: pr.x + s.chipBox.x * pr.w, y: pr.y + s.chipBox.y * pr.h, w: s.chipBox.w * pr.w, h: s.chipBox.h * pr.h } : null;
  const html = `${s.photo ? `<img src="${s.photo.src}" style="${at(pr)}"/>` : `<div style="${at(box)}border:1.5px dashed #999"></div>`}${chip ? `<div style="${at(chip)}border:${ring}px solid ${RED};z-index:4"></div>` : ""}`;
  return { html, chip, pr };
}

function swatchPage(doc: PackDoc, n: number, list: { colorway: string; materialCallout: number }[]) {
  const items = list.map((s) => doc.swatches.find((x) => x.colorway === s.colorway && x.callout === s.materialCallout)!).filter(Boolean);
  const caption = (s: (typeof items)[number]) => [`${up(s.supplier)}`, "SWATCH CARD", up(s.article), up(s.colourName)].filter(Boolean).join("<br/>");
  if (items.length === 1) {
    const s = items[0];
    // The caption goes on the chip's side of the card, its leader running to the chip box.
    const right = !!s.chipBox && s.chipBox.x + s.chipBox.w / 2 > 0.5;
    const { html, chip, pr } = swatchCard(s, right ? { x: 2.4, y: 0.25, w: 9.4, h: 10.55 } : { x: 3.6, y: 0.25, w: 10.4, h: 10.55 }, 6);
    const cy = chip ? Math.min(Math.max(chip.y + chip.h / 2 - 1.2, 2.3), 8.6) : 2.6;
    const capX = right ? pr.x + pr.w + 0.25 : 0.4,
      capW = right ? Math.min(3.4, 16.6 - capX) : pr.x - 0.25 - 0.4;
    const ly = cy + 1.55;
    const lines = chip ? (right ? lead(capX - 0.05, ly, chip.x + chip.w, chip.y + chip.h * 0.3, { w: 0.03 }) : lead(capX + capW + 0.05, ly, chip.x, chip.y + chip.h * 0.3, { w: 0.03 })) : "";
    return `<section class="page">
      ${head(doc, n, `${s.materialName.replace(/ MTL$/, "")} #${s.callout} MTL`)}
      <div class="abs" style="left:0.4in;top:1.62in;font-size:14pt">FOR REFERENCE <span class="red">${up(doc.pack.styleNo)}${esc(s.colorway)} ONLY</span></div>
      <div class="abs" style="left:${r2(capX)}in;top:${r2(cy)}in;width:${r2(capW)}in;text-align:${right ? "left" : "right"}">
        <div style="text-align:center;width:2.2in;${right ? "" : "margin-left:auto"}"><span class="callout" style="width:52px;height:52px;font-size:26pt;border-width:3px">${s.callout}</span></div>
        <div style="font-size:14pt;line-height:1.15;margin-top:8px">${caption(s)}</div>
      </div>
      ${html}
      ${overlay(lines)}
    </section>`;
  }
  // Several cards: one row (≤ 3) or two rows, each card as large as the page allows.
  const cols = items.length <= 3 ? items.length : Math.ceil(items.length / 2);
  const rows = Math.ceil(items.length / cols);
  const top = 1.75,
    gap = 0.3,
    cw = (16.2 - gap * (cols - 1)) / cols,
    ch = (10.75 - top - gap * (rows - 1)) / rows;
  const cells = items
    .map((s, i) => {
      const x = 0.4 + (i % cols) * (cw + gap),
        y = top + Math.floor(i / cols) * (ch + gap);
      const { html } = swatchCard(s, { x, y: y + 0.5, w: cw, h: ch - 1.25 }, 4);
      return `<div class="abs" style="left:${r2(x)}in;top:${r2(y)}in;width:${r2(cw)}in;display:flex;gap:10px;align-items:center;justify-content:center"><span class="callout">${s.callout}</span><span style="font-size:16pt">${up(doc.pack.styleNo)}${esc(s.colorway)} — ${up(s.colourName)}</span></div>
        ${html}
        <div class="abs" style="left:${r2(x)}in;top:${r2(y + ch - 0.7)}in;width:${r2(cw)}in;text-align:center;font-size:14pt;line-height:1.2">${up(s.supplier)} · ${up([s.articleNo, s.article].filter(Boolean).join(" "))}<br/><span class="red">FOR REFERENCE ${up(doc.pack.styleNo)}${esc(s.colorway)} ONLY</span></div>`;
    })
    .join("");
  return `<section class="page">
    ${head(doc, n, "SWATCH CARDS — FABRIC REFERENCE")}
    ${cells}
  </section>`;
}

/* ------------------------------ CHANGE LOG ------------------------------ */
function changeLogPage(doc: PackDoc, n: number) {
  return `<section class="page">
    ${head(doc, n, "CHANGE LOG")}
    <div style="position:absolute;left:0.4in;right:0.4in;top:1.6in">
      <table class="log"><tr><th style="width:1.4in">REVISION</th><th style="width:1.3in">DATE</th><th style="width:1.4in">BY</th><th>CHANGES</th></tr>
      ${[...doc.revision.log]
        .reverse()
        .map((r) => `<tr><td class="${r.sent ? "" : "red"}">${esc(r.label)}</td><td>${esc(r.date || "—")}</td><td>${up(r.by || "—")}</td><td>${r.lines.map((l) => `<div class="red">*UPDATED* ${up(l)}</div>`).join("")}</td></tr>`)
        .join("")}
      <tr><td>ORIGINAL</td><td>${esc(doc.revision.original || "—")}</td><td></td><td class="muted">FIRST ISSUE</td></tr>
      </table>
    </div>
  </section>`;
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
          return changeLogPage(doc, p.n);
      }
    })
    .map((html) => (opts.draft ? html.replace('<section class="page">', '<section class="page"><div class="draft"><span>DRAFT — NOT FOR FACTORY</span></div>') : html))
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${up(doc.pack.styleNo)} ${up(doc.pack.styleName)}</title><style>${CSS()}</style></head><body>${pages}</body></html>`;
}
