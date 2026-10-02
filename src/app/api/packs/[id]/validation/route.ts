import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { buildPackDoc } from "@/lib/pdf/doc";
import { gatePasses } from "@/lib/validation";
import { changeLine, revisionState } from "@/lib/revisions";

/** The Part 5 gate for a pack: every rule with pass / fail / warn and the fix. `?stage=PRODUCTION` previews the other stage. */
export async function GET(req: Request, ctx: RouteContext<"/api/packs/[id]/validation">) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const p = await loadPack(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = new URL(req.url).searchParams.get("stage");
  const doc = await buildPackDoc(p, { images: false, stage: s === "PRODUCTION" || s === "PROTO" ? s : undefined });
  const rev = await revisionState(p);
  return NextResponse.json({
    revisions: {
      list: rev.list.map((r) => ({ label: r.label, date: r.date, by: r.by, pdfUrl: r.pdfUrl, changes: r.changes.map(changeLine) })),
      pending: rev.latest ? rev.pending.map(changeLine) : [],
      next: rev.latest ? `R${rev.latest.number + 1}` : "ORIGINAL",
    },
    passes: gatePasses(doc.validation),
    rules: doc.validation,
    spelling: doc.spelling,
    pages: doc.plan.pages.map((pg) => ({ n: pg.n, section: pg.section })),
  });
}
