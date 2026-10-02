/**
 * SVG → EPS for the line art (BRIEF 1.10 "EPS: converted from SVG on the server"). Pure JS, no
 * Ghostscript: handles what flats contain — paths (all commands; arcs become lines), lines,
 * polylines, rects, circles, ellipses and text, with inherited fill / stroke / dash / fill-rule and
 * transforms. Coordinates are SVG user units = PostScript points.
 */

type Attrs = Record<string, string>;
type Node = { tag: string; attrs: Attrs; children: Node[]; text: string };
type M = [number, number, number, number, number, number];

/** Minimal XML reader for the SVG we write (no DTDs, no CDATA). */
export function parseXml(src: string): Node {
  const root: Node = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) {
      if (stack.length > 1) stack.pop();
    } else if (m[2]) {
      const attrs: Attrs = {};
      for (const a of m[3].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
      const node: Node = { tag: m[2], attrs, children: [], text: "" };
      stack[stack.length - 1].children.push(node);
      if (!m[4]) stack.push(node);
    } else if (m[5] && stack.length > 1) stack[stack.length - 1].text += decode(m[5]);
  }
  return root;
}

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const ID: M = [1, 0, 0, 1, 0, 0];

export function parseTransform(t?: string): M {
  let out = ID;
  if (!t) return out;
  for (const m of t.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let x: M = ID;
    if (m[1] === "matrix") x = n.slice(0, 6) as M;
    else if (m[1] === "translate") x = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (m[1] === "scale") x = [n[0], 0, 0, n[1] ?? n[0], 0, 0];
    else if (m[1] === "rotate") {
      const r = ((n[0] ?? 0) * Math.PI) / 180;
      const c = Math.cos(r),
        s = Math.sin(r);
      x = [c, s, -s, c, 0, 0];
      if (n.length >= 3) x = mul(mul([1, 0, 0, 1, n[1], n[2]], x), [1, 0, 0, 1, -n[1], -n[2]]);
    } else if (m[1] === "skewX") x = [1, 0, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (m[1] === "skewY") x = [1, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    out = mul(out, x);
  }
  return out;
}

type Seg = { op: "M" | "L" | "C" | "Z"; p: number[] };

/** Path data → absolute M / L / C / Z. */
export function parsePath(d: string): Seg[] {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out: Seg[] = [];
  let i = 0,
    cmd = "",
    x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    lcx = 0,
    lcy = 0,
    lq: [number, number] | null = null;
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0,
      oy = rel ? y : 0;
    if (C === "Z") {
      out.push({ op: "Z", p: [] });
      x = sx;
      y = sy;
      lq = null;
      if (i < toks.length && !/[a-zA-Z]/.test(toks[i])) i++;
      continue;
    }
    if (C === "M") {
      x = ox + num();
      y = oy + num();
      sx = x;
      sy = y;
      out.push({ op: "M", p: [x, y] });
      cmd = rel ? "l" : "L";
      lcx = x;
      lcy = y;
      lq = null;
    } else if (C === "L" || C === "H" || C === "V") {
      if (C === "L") {
        x = ox + num();
        y = oy + num();
      } else if (C === "H") x = ox + num();
      else y = oy + num();
      out.push({ op: "L", p: [x, y] });
      lcx = x;
      lcy = y;
      lq = null;
    } else if (C === "C" || C === "S") {
      let x1: number, y1: number;
      if (C === "C") {
        x1 = ox + num();
        y1 = oy + num();
      } else {
        x1 = 2 * x - lcx;
        y1 = 2 * y - lcy;
      }
      const x2 = ox + num(),
        y2 = oy + num(),
        ex = ox + num(),
        ey = oy + num();
      out.push({ op: "C", p: [x1, y1, x2, y2, ex, ey] });
      lcx = x2;
      lcy = y2;
      x = ex;
      y = ey;
      lq = null;
    } else if (C === "Q" || C === "T") {
      let qx: number, qy: number;
      if (C === "Q") {
        qx = ox + num();
        qy = oy + num();
      } else [qx, qy] = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
      const ex = ox + num(),
        ey = oy + num();
      out.push({ op: "C", p: [x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey] });
      lq = [qx, qy];
      x = ex;
      y = ey;
      lcx = x;
      lcy = y;
    } else if (C === "A") {
      i += 5; // rx ry rotation large-arc sweep — approximated by a line to the end point
      x = ox + num();
      y = oy + num();
      out.push({ op: "L", p: [x, y] });
      lq = null;
    } else i++;
  }
  return out;
}

function colour(v: string | undefined): [number, number, number] | null {
  if (!v || v === "none" || v === "transparent") return null;
  const named: Record<string, string> = { black: "#000000", white: "#ffffff", red: "#ff0000" };
  let h = named[v.toLowerCase()] ?? v;
  const rgb = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(h);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  if (!h.startsWith("#")) return [0, 0, 0];
  if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const INHERIT = ["fill", "stroke", "stroke-width", "stroke-dasharray", "fill-rule", "font-size", "font-weight", "text-anchor", "stroke-linecap", "stroke-linejoin"];

export function svgToEps(svg: string, title = "flat"): string {
  const root = parseXml(svg).children.find((c) => c.tag === "svg");
  if (!root) throw new Error("Not an SVG");
  const vb = (root.attrs.viewBox ?? `0 0 ${root.attrs.width ?? 100} ${root.attrs.height ?? 100}`).split(/[\s,]+/).map(Number);
  const [vx, vy, W, H] = vb;
  // SVG (y down, origin top-left of the viewBox) → PostScript (y up).
  const base: M = [1, 0, 0, -1, -vx, H + vy];
  const body: string[] = [];
  const pt = (m: M, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  const paint = (style: Attrs, m: M, pathPs: string) => {
    const fill = colour(style.fill ?? "#000000");
    const stroke = colour(style.stroke);
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    if (fill) body.push(`newpath ${pathPs} ${fill.map(f).join(" ")} setrgbcolor ${style["fill-rule"] === "evenodd" ? "eofill" : "fill"}`);
    if (stroke) {
      const dash = (style["stroke-dasharray"] ?? "none") === "none" ? "[] 0" : `[${style["stroke-dasharray"].split(/[\s,]+/).filter(Boolean).map((v) => f(Number(v) * scale)).join(" ")}] 0`;
      const cap = { butt: 0, round: 1, square: 2 }[style["stroke-linecap"] ?? "butt"] ?? 0;
      const join = { miter: 0, round: 1, bevel: 2 }[style["stroke-linejoin"] ?? "miter"] ?? 0;
      body.push(`newpath ${pathPs} ${stroke.map(f).join(" ")} setrgbcolor ${f(Number(style["stroke-width"] ?? 1) * scale)} setlinewidth ${cap} setlinecap ${join} setlinejoin ${dash} setdash stroke`);
    }
  };
  const segsPs = (segs: Seg[], m: M) =>
    segs
      .map((s) => {
        if (s.op === "Z") return "closepath";
        const p: number[] = [];
        for (let k = 0; k < s.p.length; k += 2) p.push(...pt(m, s.p[k], s.p[k + 1]));
        return `${p.map(f).join(" ")} ${s.op === "M" ? "moveto" : s.op === "L" ? "lineto" : "curveto"}`;
      })
      .join(" ");

  const walk = (n: Node, inherited: Attrs, m: M) => {
    const style: Attrs = { ...inherited };
    for (const k of INHERIT) if (n.attrs[k] != null) style[k] = n.attrs[k];
    if (n.attrs.style) for (const d of n.attrs.style.split(";")) {
      const [k, v] = d.split(":").map((x) => x.trim());
      if (k && v && INHERIT.includes(k)) style[k] = v;
    }
    if (n.attrs.display === "none" || n.attrs.visibility === "hidden") return;
    const mm = n.attrs.transform ? mul(m, parseTransform(n.attrs.transform)) : m;
    const a = (k: string) => Number(n.attrs[k] ?? 0);
    switch (n.tag) {
      case "svg":
      case "g":
        for (const c of n.children) walk(c, style, mm);
        return;
      case "path":
        if (n.attrs.d) paint(style, mm, segsPs(parsePath(n.attrs.d), mm));
        return;
      case "line":
        paint({ ...style, fill: "none" }, mm, segsPs([{ op: "M", p: [a("x1"), a("y1")] }, { op: "L", p: [a("x2"), a("y2")] }], mm));
        return;
      case "polyline":
      case "polygon": {
        const nums = (n.attrs.points ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
        const segs: Seg[] = [];
        for (let k = 0; k + 1 < nums.length; k += 2) segs.push({ op: k ? "L" : "M", p: [nums[k], nums[k + 1]] });
        if (n.tag === "polygon") segs.push({ op: "Z", p: [] });
        paint(n.tag === "polyline" ? { ...style, fill: "none" } : style, mm, segsPs(segs, mm));
        return;
      }
      case "rect": {
        const x = a("x"),
          y = a("y"),
          w = a("width"),
          h = a("height");
        paint(style, mm, segsPs([{ op: "M", p: [x, y] }, { op: "L", p: [x + w, y] }, { op: "L", p: [x + w, y + h] }, { op: "L", p: [x, y + h] }, { op: "Z", p: [] }], mm));
        return;
      }
      case "circle":
      case "ellipse": {
        const cx = a("cx"),
          cy = a("cy"),
          rx = n.tag === "circle" ? a("r") : a("rx"),
          ry = n.tag === "circle" ? a("r") : a("ry");
        const k = 0.5523;
        paint(style, mm, segsPs([
          { op: "M", p: [cx + rx, cy] },
          { op: "C", p: [cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry] },
          { op: "C", p: [cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy] },
          { op: "C", p: [cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry] },
          { op: "C", p: [cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy] },
          { op: "Z", p: [] },
        ], mm));
        return;
      }
      case "text": {
        const text = (n.text + n.children.map((c) => c.text).join(" ")).replace(/\s+/g, " ").trim();
        if (!text) return;
        const [px, py] = pt(mm, a("x"), a("y"));
        const ang = (Math.atan2(mm[1], mm[0]) * 180) / Math.PI;
        const size = Number(style["font-size"] ?? 16) * (Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2])) || 1);
        const fill = colour(style.fill ?? "#000000") ?? [0, 0, 0];
        const s = text.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "-");
        const anchor = style["text-anchor"] === "middle" ? `(${s}) stringwidth pop 2 div neg 0 rmoveto` : style["text-anchor"] === "end" ? `(${s}) stringwidth pop neg 0 rmoveto` : "";
        body.push(`gsave ${fill.map(f).join(" ")} setrgbcolor /Helvetica-Bold findfont ${f(size)} scalefont setfont ${f(px)} ${f(py)} translate ${f(ang)} rotate 0 0 moveto ${anchor} (${s}) show grestore`);
        return;
      }
      default:
        for (const c of n.children) walk(c, style, mm);
    }
  };
  walk(root, { fill: "#000000" }, base);
  return [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${Math.ceil(W)} ${Math.ceil(H)}`,
    `%%HiResBoundingBox: 0 0 ${f(W)} ${f(H)}`,
    `%%Title: ${title.replace(/[\r\n]/g, " ")}`,
    "%%Creator: Icon Tech Pack Studio",
    "%%LanguageLevel: 2",
    "%%EndComments",
    "gsave",
    ...body,
    "grestore",
    "showpage",
    "%%EOF",
    "",
  ].join("\n");
}
