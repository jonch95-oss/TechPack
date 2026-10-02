import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack } from "@/lib/data";
import { generateFlat } from "@/lib/lineart/service";
import { flatViewEnum, type FlatView } from "@/db/schema";

// Image generation can take a minute or two.
export const maxDuration = 300;

/**
 * POST /api/packs/:id/flats — generate a view from the render (JSON `{ view }`), or trace the
 * designer's own drawing (multipart `view` + `file`).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/packs/[id]/flats">) {
  const user = await getCurrentUser();
  if (!user || !can(user, "designer")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  const p = await loadPack(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let view: string;
  let upload: Buffer | undefined;
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/")) {
    const form = await req.formData();
    view = String(form.get("view") ?? "");
    const file = form.get("file");
    if (file instanceof File) upload = Buffer.from(await file.arrayBuffer());
  } else view = String(((await req.json().catch(() => ({}))) as { view?: string }).view ?? "");
  if (!flatViewEnum.enumValues.includes(view as FlatView)) return NextResponse.json({ error: "Unknown view" }, { status: 400 });
  try {
    const { flat, note } = await generateFlat(p, view as FlatView, user.id, upload);
    await audit({ userId: user.id, entity: "flat", entityId: flat.id, action: upload ? "create" : "ai", field: view, after: { source: flat.source } });
    return NextResponse.json({ flat: { id: flat.id, view: flat.view, status: flat.status, source: flat.source, svg: flat.svg, updatedAt: flat.updatedAt.toISOString() }, note });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
