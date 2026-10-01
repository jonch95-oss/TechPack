import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { buildPackDoc } from "@/lib/pdf/doc";
import { gatePasses } from "@/lib/validation";

/** The Part 5 gate for a pack: every rule with pass / fail / warn and the fix. */
export async function GET(_req: Request, ctx: RouteContext<"/api/packs/[id]/validation">) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const p = await loadPack(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await buildPackDoc(p, { images: false });
  return NextResponse.json({
    passes: gatePasses(doc.validation),
    rules: doc.validation,
    spelling: doc.spelling,
    pages: doc.plan.pages.map((pg) => ({ n: pg.n, section: pg.section })),
  });
}
