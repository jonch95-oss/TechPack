/**
 * The overflow check (golden run 1, P0.3): in the laid-out print HTML, no element's box may extend
 * outside its page, nor outside a clipping box it sits in (overflow: hidden), and no clipping box may
 * hide content. Run in the page with page.evaluate(OVERFLOW_JS). Kept as a string so bundlers don't
 * rewrite it. Returns one entry per offending element (outermost only) with its page number and a
 * selector — never its text, so the report stays free of pack content.
 */
export type OverflowHit = { page: number; selector: string; kind: "page" | "clipped" | "hidden-content"; by: number };

export const OVERFLOW_JS = `(() => {
  const TOL = 2;
  const out = [];
  const sel = (el) => {
    const cls = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    const parts = [];
    let e = el;
    while (e && !(e.classList && e.classList.contains("page"))) {
      const c = typeof e.className === "string" ? e.className : (e.className && e.className.baseVal) || "";
      const i = e.parentElement ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0;
      parts.unshift(e.tagName.toLowerCase() + (c ? "." + c.trim().split(/\\s+/).join(".") : "") + ":" + i);
      e = e.parentElement;
    }
    return parts.slice(-4).join(" > ") || el.tagName.toLowerCase() + (cls ? "." + cls : "");
  };
  const pages = Array.prototype.slice.call(document.querySelectorAll("section.page"));
  pages.forEach((pg, k) => {
    const P = pg.getBoundingClientRect();
    const flagged = new Set();
    const all = Array.prototype.slice.call(pg.querySelectorAll("*"));
    for (const el of all) {
      if (el.closest(".draft")) continue;
      const tag = el.tagName.toLowerCase();
      if (el.closest("svg") && tag !== "svg") continue;
      if (tag === "br" || tag === "style") continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      let parentFlagged = false;
      for (let a = el.parentElement; a && a !== pg; a = a.parentElement) if (flagged.has(a)) { parentFlagged = true; break; }
      if (parentFlagged) continue;
      let hit = null;
      const by = Math.max(P.left - r.left, P.top - r.top, r.right - P.right, r.bottom - P.bottom);
      if (by > TOL) hit = { kind: "page", by };
      for (let a = el.parentElement; !hit && a && a !== pg; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === "visible" && s.overflowY === "visible") continue;
        const A = a.getBoundingClientRect();
        const d = Math.max(A.left - r.left, A.top - r.top, r.right - A.right, r.bottom - A.bottom);
        if (d > TOL) hit = { kind: "clipped", by: d };
      }
      if (!hit && (cs.overflowX !== "visible" || cs.overflowY !== "visible") && !el.classList.contains("page")) {
        const d = Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight);
        if (d > TOL) hit = { kind: "hidden-content", by: d };
      }
      if (hit) {
        flagged.add(el);
        out.push({ page: k + 1, selector: sel(el), kind: hit.kind, by: Math.round(hit.by) });
      }
    }
  });
  return out;
})()`;
