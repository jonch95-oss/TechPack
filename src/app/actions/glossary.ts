"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { glossary, translations } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Adds or updates a glossary term. Cached machine translations are cleared so the term applies. */
export async function saveTerm(input: { id?: string; en: string; zh: string }): Promise<Result> {
  const user = await requireRole("admin");
  const en = clean(input.en).toUpperCase();
  const zh = clean(input.zh);
  if (!en || !zh) return { ok: false, error: "Enter the English term and its Chinese." };
  if (!/[㐀-鿿]/.test(zh)) return { ok: false, error: "The Chinese column needs Chinese characters." };
  if (input.id) await db.update(glossary).set({ en, zh, updatedBy: user.id, updatedAt: new Date() }).where(eq(glossary.id, input.id));
  else await db.insert(glossary).values({ en, zh, updatedBy: user.id }).onConflictDoUpdate({ target: glossary.en, set: { zh, updatedBy: user.id, updatedAt: new Date() } });
  await db.delete(translations);
  await audit({ userId: user.id, entity: "glossary", entityId: en, action: input.id ? "update" : "create", after: { en, zh } });
  revalidatePath("/admin/glossary");
  return { ok: true, message: `${en} = ${zh}` };
}

export async function deleteTerm(id: string): Promise<Result> {
  const user = await requireRole("admin");
  const [row] = await db.delete(glossary).where(eq(glossary.id, id)).returning();
  if (row) {
    await db.delete(translations);
    await audit({ userId: user.id, entity: "glossary", entityId: row.en, action: "delete" });
  }
  revalidatePath("/admin/glossary");
  return { ok: true };
}

/** Paste many lines at once: "EDGE PAINT = 边油" or tab-separated (from a spreadsheet). */
export async function importTerms(text: string): Promise<Result> {
  await requireRole("admin");
  let n = 0;
  const bad: string[] = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = /^(.+?)\s*(?:=|\t|,)\s*(.+)$/.exec(line);
    if (!m) {
      bad.push(line);
      continue;
    }
    const r = await saveTerm({ en: m[1], zh: m[2] });
    if (r.ok) n++;
    else bad.push(line);
  }
  return bad.length ? { ok: false, error: `${n} saved; couldn't read: ${bad.slice(0, 5).join(" · ")}` } : { ok: true, message: `${n} terms saved.` };
}
