/**
 * Supplier swatch cards can carry bank-account details, phone / fax numbers, e-mail and street
 * addresses (V2.1 §10). The card reader must never store or print them: every text read from a card
 * goes through `scrubContact` before it is saved, and printed card photos are cropped to the chips.
 */

/** Lines that are contact or payment details, by their label (English and Chinese). */
const CONTACT_LINE =
  /(\b(TEL|PHONE|MOBILE|MOB|CELL|FAX|WHATSAPP|WECHAT|E-?MAIL|ADDRESS|ADDR|BANK|ACCOUNT|A\/C|ACCT|IBAN|SWIFT|BIC|BENEFICIARY|ROUTING|SORT CODE)\b|\bADD\s*[:：]|电话|手机|传真|邮箱|地址|开户|账号|帐号|银行|户名|微信)/i;

/** A phone, fax or account number: 7+ digits, optionally split by spaces, dots, dashes or brackets. */
const LONG_NUMBER = /(\+?\d[\d\s().-]{6,}\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

/**
 * The text with contact / payment lines dropped and e-mails masked. Free text (`numbers: true`, e.g. the
 * raw card text) also has any run of 7+ digits masked; a field such as an article number keeps its digits.
 */
export function scrubContact(text: string, opts: { numbers?: boolean } = { numbers: true }): string {
  if (!text) return text;
  return text
    .split(/\r?\n/)
    .filter((line) => !CONTACT_LINE.test(line))
    .map((line) =>
      line.replace(EMAIL, "[REDACTED]").replace(LONG_NUMBER, (m) => {
        const digits = m.replace(/\D/g, "");
        // Keep measurements and codes: only runs of 7+ digits are treated as numbers to hide.
        return opts.numbers && digits.length >= 7 ? "[REDACTED]" : m;
      }),
    )
    .join("\n")
    .trim();
}

/** Every string field of a card read, scrubbed; the free-text fields named in `free` also lose long numbers. */
export function scrubRecord<T extends Record<string, unknown>>(o: T, free: string[] = ["raw_text", "agent_notes"]): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k] = typeof v === "string" ? scrubContact(v, { numbers: free.includes(k) }) : v;
  return out as T;
}

/** Free-text keys: their long digit runs are masked too. */
const FREE_TEXT = new Set(["raw_text", "agent_notes", "notes", "note", "text"]);

/** Every string in a read (objects and arrays, any depth), scrubbed. */
export function scrubDeep(v: unknown, key = ""): unknown {
  if (typeof v === "string") return scrubContact(v, { numbers: FREE_TEXT.has(key) });
  if (Array.isArray(v)) return v.map((x) => scrubDeep(x, key));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubDeep(x, k)]));
  return v;
}

/**
 * The part of a card photo that may print: full width, from just above the highest chip to the
 * bottom (supplier headers sit above the chips). Without a chip box, the top band is dropped.
 * Fractions of the image (0..1).
 */
export function printableCardRegion(chips: ({ x: number; y: number; w: number; h: number } | null | undefined)[]) {
  const boxes = chips.filter((b): b is { x: number; y: number; w: number; h: number } => !!b);
  const top = boxes.length ? Math.max(0, Math.min(...boxes.map((b) => b.y)) - 0.06) : 0.2;
  return { x: 0, y: top, w: 1, h: 1 - top };
}
