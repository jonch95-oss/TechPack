import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { flatViewEnum, packFiles, packs, type FlatView } from "@/db/schema";
import { SOURCE_KINDS } from "@/lib/sources";
import { can, getCurrentUser } from "@/lib/auth/dal";
import { activeJobs, startJob } from "@/lib/jobs";

/** The job itself runs after this response, within this route's limit. */
export const maxDuration = 300;

/** POST /api/packs/:id/jobs  { kind: "prefill" } | { kind: "flat", view } | { kind: "source", fileId } | { kind: "pdf", draft?: "1" } — starts a background job. */
export async function POST(req: Request, ctx: RouteContext<"/api/packs/[id]/jobs">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "designer")) return NextResponse.json({ error: "Designers only." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [p] = await db.select({ archivedAt: packs.archivedAt }).from(packs).where(eq(packs.id, id));
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.archivedAt) return NextResponse.json({ error: "This pack is archived and read-only." }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { kind?: string; view?: string; fileId?: string; draft?: string };
  if (body.kind === "pdf") return NextResponse.json({ job: await startJob(id, "PDF", { draft: body.draft === "1" }, user.id) });
  if (body.kind === "prefill") return NextResponse.json({ job: await startJob(id, "PREFILL", {}, user.id) });
  if (body.kind === "flat" && flatViewEnum.enumValues.includes(body.view as FlatView)) return NextResponse.json({ job: await startJob(id, "FLAT", { view: body.view as FlatView }, user.id) });
  if (body.kind === "source" && /^[0-9a-f-]{36}$/i.test(body.fileId ?? "")) {
    const [f] = await db.select({ kind: packFiles.kind }).from(packFiles).where(and(eq(packFiles.id, body.fileId!), eq(packFiles.packId, id)));
    if (!f || !(SOURCE_KINDS as readonly string[]).includes(f.kind)) return NextResponse.json({ error: "Not an upload the AI reads." }, { status: 400 });
    return NextResponse.json({ job: await startJob(id, "SOURCE", { fileId: body.fileId }, user.id) });
  }
  return NextResponse.json({ error: "Unknown job" }, { status: 400 });
}

/** GET /api/packs/:id/jobs — jobs still running for this pack. */
export async function GET(_req: Request, ctx: RouteContext<"/api/packs/[id]/jobs">) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ jobs: await activeJobs(id) });
}
