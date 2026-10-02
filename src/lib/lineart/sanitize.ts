/**
 * Flats are stored SVG that we inline into the workspace and the PDF, so only drawing markup is
 * allowed: no scripts, event handlers, foreign content or external references.
 */
const ALLOWED = new Set(["svg", "g", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse", "text", "tspan", "defs", "clipPath"]);

export function sanitizeSvg(svg: string): string {
  let s = svg.replace(/<\?xml[^>]*>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");
  // Drop disallowed elements with their contents (script, style, foreignObject, image, use, a …).
  s = s.replace(/<(script|style|foreignObject|iframe|object|embed|image|use|a|animate\w*|set)\b[\s\S]*?(<\/\1>|\/>)/gi, "");
  // Any remaining tag must be allowed.
  s = s.replace(/<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g, (tag, name: string) => (ALLOWED.has(name) ? tag : ""));
  // No event handlers, no external or javascript: references.
  s = s.replace(/\s(on\w+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
  s = s.replace(/\s(href|xlink:href)\s*=\s*(".*?"|'.*?')/gi, "");
  s = s.replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, "none");
  s = s.replace(/javascript:/gi, "");
  return s.trim();
}
