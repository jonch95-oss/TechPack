/**
 * Print artwork for the pack when no artwork file was uploaded: one repeat tile built from the print
 * library fields — motif text, colour and repeat type. PINK013's lining ("PINK WORDMARK", tonal heat
 * stamp, Pantone 203 C) becomes a tonal diagonal PINK wordmark. Pure: returns SVG.
 */

const PANTONE: Record<string, string> = {
  "203 C": "#eba8c6",
  "17-3914": "#8b8d8f",
  "19-4005": "#232326",
  "11-0601": "#f4f5f0",
  "186 C": "#c8102e",
  "286 C": "#0033a0",
  "BLACK C": "#2d2926",
  "COOL GRAY 7 C": "#97999b",
  "872 C": "#85714d",
  BLACK: "#111111",
  WHITE: "#ffffff",
  NAVY: "#1f2a44",
  PINK: "#eba8c6",
  GOLD: "#c9a24a",
};

/** Screen colour for a Pantone / TCX reference (print always quotes the code itself). */
export function pantoneHex(code: string) {
  const c = code.toUpperCase();
  for (const [k, v] of Object.entries(PANTONE)) if (c.includes(k)) return v;
  return "#dddddd";
}

const mix = (hex: string, to: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex),
    b = p(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

/** Same hue, more saturated (ds) and darker/lighter (dl) — a tonal print reads as a deeper shade. */
function tone(hex: string, ds: number, dl: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const S = Math.min(1, s + ds),
    L = Math.min(1, Math.max(0, l + dl));
  const C = (1 - Math.abs(2 * L - 1)) * S,
    X = C * (1 - Math.abs((h % 2) - 1)),
    m = L - C / 2;
  const [R, G, B] = h < 1 ? [C, X, 0] : h < 2 ? [X, C, 0] : h < 3 ? [0, C, X] : h < 4 ? [0, X, C] : h < 5 ? [X, 0, C] : [C, 0, X];
  return `#${[R, G, B].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** The word(s) printed in the repeat: the motif without generic words (WORDMARK, LOGO …). */
export function motifWord(motif: string, fallback: string) {
  const w = motif
    .toUpperCase()
    .replace(/\b(WORDMARK|WORD MARK|LOGO|MONOGRAM|REPEAT|PRINT|ALL ?OVER|TONAL|PATTERN)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return w || fallback.toUpperCase().split(/\s+/)[0] || "LOGO";
}

/** One repeat tile (px) as SVG. Tonal: the base is a light tint of the colour, the motif the colour itself. */
export function repeatTileSvg(opts: { motif: string; brand: string; colour: string; tileW: number; tileH: number; repeat?: string }) {
  const W = 400,
    H = Math.round((400 * (opts.tileH || 1)) / (opts.tileW || 1));
  const base = opts.colour.startsWith("#") ? opts.colour : pantoneHex(opts.colour);
  const bg = mix(base, "#ffffff", 0.42);
  const fg = tone(base, 0.2, -0.05);
  const word = motifWord(opts.motif, opts.brand).replace(/[<&]/g, "");
  // Separate, letter-spaced wordmarks on a diagonal in staggered columns that alternate upright and
  // turned 180° (as PINK013's tonal heat stamp). Copies one tile out on every side make it seamless.
  const cols = 4,
    rows = 3;
  const size = Math.min(W, H) / Math.max(9.5, word.length * 2.4);
  const spacing = size * 0.32;
  const cells: string[] = [];
  for (let c = -1; c <= cols; c++)
    for (let r = -1; r <= rows; r++) {
      const odd = ((c % 2) + 2) % 2;
      const x = (c + 0.5) * (W / cols),
        y = (r + 0.5) * (H / rows) + (odd * H) / (rows * 2);
      cells.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${odd ? 235 : 55} ${x.toFixed(1)} ${y.toFixed(1)})" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${size.toFixed(1)}" letter-spacing="${spacing.toFixed(1)}" fill="${fg}">${word}</text>`);
    }
  return {
    w: W,
    h: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${cells.join("")}</svg>`,
  };
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
