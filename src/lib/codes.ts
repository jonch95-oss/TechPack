/**
 * Component / style code assignment.
 *
 * A brand's code format is a literal pattern with one run of `#` digit
 * placeholders, e.g. "PINK###" -> PINK003, PINK004 … The next code is one past
 * the highest number already used by EITHER a hardware component or a style
 * number of that brand, so components and styles never collide.
 */

export function defaultCodeFormat(prefix: string) {
  return `${prefix.toUpperCase()}###`;
}

type ParsedFormat = { before: string; digits: number; after: string };

export function parseCodeFormat(format: string): ParsedFormat {
  const m = /^([^#]*)(#+)([^#]*)$/.exec(format);
  if (!m) throw new Error(`Code format "${format}" must contain exactly one run of # placeholders`);
  return { before: m[1], digits: m[2].length, after: m[3] };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns the numeric part if `code` matches the format, else null. Case-insensitive. */
export function codeNumber(format: string, code: string): number | null {
  const f = parseCodeFormat(format);
  const re = new RegExp(`^${escapeRe(f.before)}(\\d{${f.digits},})${escapeRe(f.after)}$`, "i");
  const m = re.exec(code.trim());
  return m ? Number(m[1]) : null;
}

export function formatCode(format: string, n: number) {
  const f = parseCodeFormat(format);
  return `${f.before}${String(n).padStart(f.digits, "0")}${f.after}`;
}

/**
 * Style numbers may carry a colorway suffix (PINK013-A) or be stored bare (PINK013);
 * strip a trailing "-X" suffix before matching.
 */
export function stripColorwaySuffix(styleNo: string) {
  return styleNo.trim().replace(/-[A-Z]{1,2}$/i, "");
}

export function nextCode(format: string, usedCodes: string[]): string {
  let max = 0;
  for (const c of usedCodes) {
    const n = codeNumber(format, stripColorwaySuffix(c));
    if (n !== null && n > max) max = n;
  }
  return formatCode(format, max + 1);
}

/** Colorway suffixes: -A, -B, -C … */
export function suffixesFor(n: number) {
  return Array.from({ length: Math.max(1, Math.min(26, n)) }, (_, i) => `-${String.fromCharCode(65 + i)}`);
}

export type CodeCheck = { errors: string[]; warnings: string[]; suggestion: string };

/**
 * Checks a designer-entered component code. Errors block saving (blank, already used by another
 * component, same as a style number); warnings are called out but allowed (format, skipped numbers).
 */
export function checkCode(opts: {
  code: string;
  format: string;
  brandName: string;
  /** Codes of other components (exclude the one being edited). */
  componentCodes: string[];
  styleNos: string[];
}): CodeCheck {
  const code = opts.code.trim().toUpperCase();
  const suggestion = nextCode(opts.format, [...opts.componentCodes, ...opts.styleNos]);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!code) {
    errors.push(`Enter a code — the next free ${opts.brandName} code is ${suggestion}.`);
    return { errors, warnings, suggestion };
  }
  if (opts.componentCodes.some((c) => c.toUpperCase() === code)) errors.push(`${code} is already used by another component. Next free: ${suggestion}.`);
  if (opts.styleNos.some((s) => stripColorwaySuffix(s).toUpperCase() === code)) errors.push(`${code} is a style number — components and styles can't share a code. Next free: ${suggestion}.`);
  const n = codeNumber(opts.format, code);
  if (n === null) warnings.push(`${code} doesn't follow the ${opts.brandName} format (${opts.format.replace(/#/g, "0")}). Check it's right.`);
  else if (!errors.length) {
    const next = codeNumber(opts.format, suggestion)!;
    if (n > next) warnings.push(`${code} skips ahead — the next free number is ${suggestion}.`);
  }
  return { errors, warnings, suggestion };
}
