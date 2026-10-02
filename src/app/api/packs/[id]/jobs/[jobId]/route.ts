import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getJob } from "@/lib/jobs";

/** GET /api/packs/:id/jobs/:jobId — progress of one background job (polled by the studio). */
export async function GET(_req: Request, ctx: RouteContext<"/api/packs/[id]/jobs/[jobId]">) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id, jobId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(jobId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await getJob(id, jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job }, { headers: { "cache-control": "no-store" } });
}
