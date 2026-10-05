import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { buildTechPackJson } from "@/lib/techpack";

/** The TechPack JSON (BRIEF Part 2.1) for a pack, built from the captured answers. */
export async function GET(_req: Request, ctx: RouteContext<"/api/packs/[id]/techpack">) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const p = await loadPack(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await buildTechPackJson(p));
}
