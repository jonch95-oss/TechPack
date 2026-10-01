"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { brands, sessions, users, type Role } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { defaultCodeFormat, parseCodeFormat } from "@/lib/codes";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const ROLES: Role[] = ["admin", "designer", "viewer"];

export async function createUser(form: FormData): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const role = String(form.get("role") ?? "designer") as Role;
  const password = String(form.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (!name) return { ok: false, error: "Enter a name — it prints as SENT BY." };
  if (!ROLES.includes(role)) return { ok: false, error: "Pick a role." };
  if (password.length < 10) return { ok: false, error: "Temporary password must be at least 10 characters." };
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length) return { ok: false, error: "A user with that email already exists." };
  const [u] = await db
    .insert(users)
    .values({ email, name: name.toUpperCase(), role, passwordHash: await bcrypt.hash(password, 10) })
    .returning({ id: users.id });
  await audit({ userId: admin.id, entity: "user", entityId: u.id, action: "create", after: { email, name, role } });
  revalidatePath("/admin/users");
  return { ok: true, message: `${name} added.` };
}

export async function updateUser(id: string, patch: { role?: Role; active?: boolean; name?: string; password?: string }): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const [before] = await db.select().from(users).where(eq(users.id, id));
  if (!before) return { ok: false, error: "User not found." };
  if (id === admin.id && (patch.role && patch.role !== "admin" || patch.active === false))
    return { ok: false, error: "You can't remove your own admin access." };
  const set: Partial<typeof users.$inferInsert> = {};
  if (patch.role && ROLES.includes(patch.role)) set.role = patch.role;
  if (typeof patch.active === "boolean") set.active = patch.active;
  if (patch.name?.trim()) set.name = patch.name.trim().toUpperCase();
  if (patch.password) {
    if (patch.password.length < 10) return { ok: false, error: "Password must be at least 10 characters." };
    set.passwordHash = await bcrypt.hash(patch.password, 10);
  }
  await db.update(users).set(set).where(eq(users.id, id));
  if (set.active === false || set.passwordHash) await db.delete(sessions).where(eq(sessions.userId, id));
  await audit({
    userId: admin.id,
    entity: "user",
    entityId: id,
    action: "update",
    before: { role: before.role, active: before.active, name: before.name },
    after: { ...set, passwordHash: set.passwordHash ? "(changed)" : undefined },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function saveBrand(input: {
  id?: string;
  name: string;
  codePrefix: string;
  codeFormat?: string;
  logoUrl?: string | null;
  licensorRequired?: boolean;
}): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const name = input.name.trim();
  const prefix = input.codePrefix.trim().toUpperCase();
  if (!name) return { ok: false, error: "Brand name is required." };
  if (!/^[A-Z0-9_-]{1,10}$/.test(prefix)) return { ok: false, error: "Prefix: 1–10 letters/digits, e.g. PINK or TB." };
  const format = (input.codeFormat?.trim() || defaultCodeFormat(prefix)).toUpperCase();
  try {
    parseCodeFormat(format);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const values = {
    name,
    codePrefix: prefix,
    codeFormat: format,
    logoUrl: input.logoUrl ?? null,
    licensorRequired: Boolean(input.licensorRequired),
    updatedBy: admin.id,
    updatedAt: new Date(),
  };
  if (input.id) {
    const [before] = await db.select().from(brands).where(eq(brands.id, input.id));
    await db.update(brands).set(values).where(eq(brands.id, input.id));
    await audit({ userId: admin.id, entity: "brand", entityId: input.id, action: "update", before, after: values });
  } else {
    const [b] = await db.insert(brands).values(values).returning({ id: brands.id });
    await audit({ userId: admin.id, entity: "brand", entityId: b.id, action: "create", after: values });
  }
  revalidatePath("/admin/brands");
  return { ok: true, message: "Brand saved." };
}
