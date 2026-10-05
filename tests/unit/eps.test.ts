import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parsePath, parseTransform, svgToEps } from "@/lib/exports/eps";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <g id="outline" fill="#111111" fill-rule="evenodd"><path d="M 50 50 L 350 50 L 350 250 L 50 250 Z M 60 60 L 60 240 L 340 240 L 340 60 Z"/></g>
  <g id="stitching" fill="none" stroke="#111" stroke-width="2" stroke-dasharray="6 4"><path d="M70 70 h260 v160 h-260 z"/></g>
  <g id="dimensions" stroke="#e2231a"><path d="M50 280L350 280"/><text x="200" y="275" fill="#e2231a" stroke="none" font-size="16" text-anchor="middle" transform="rotate(0 200 275)">20 CM</text></g>
  <g id="callouts"><circle cx="370" cy="40" r="12" fill="#f7e400" stroke="#111"/><text x="370" y="45" text-anchor="middle" font-size="14">1</text></g>
</svg>`;

describe("SVG → EPS", () => {
  it("parses path commands and transforms", () => {
    expect(parsePath("M10 10 h5 v5 q5 5 10 0 z").map((s) => s.op)).toEqual(["M", "L", "L", "C", "Z"]);
    expect(parseTransform("translate(10 20) scale(2)")).toEqual([2, 0, 0, 2, 10, 20]);
  });

  it("writes a valid EPS with even-odd fills, dashes and text", () => {
    const eps = svgToEps(SVG, "TEST FRONT VIEW");
    expect(eps).toMatch(/^%!PS-Adobe-3\.0 EPSF-3\.0/);
    expect(eps).toContain("%%BoundingBox: 0 0 400 300");
    expect(eps).toContain("eofill");
    expect(eps).toMatch(/\[6 4\] 0 setdash/);
    expect(eps).toContain("(20 CM) show");
  });

  it.skipIf(!hasGs())("renders in Ghostscript", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "eps-"));
    const file = path.join(dir, "flat.eps");
    writeFileSync(file, svgToEps(SVG));
    const out = execFileSync("gs", ["-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-dEPSCrop", "-sDEVICE=bbox", file], { stdio: ["ignore", "pipe", "pipe"] }).toString();
    void out;
    // bbox device prints to stderr; any PostScript error would have thrown.
    expect(true).toBe(true);
  });
});

function hasGs() {
  try {
    execFileSync("gs", ["--version"]);
    return true;
  } catch {
    return false;
  }
}
