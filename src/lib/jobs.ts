import "server-only";
import { after } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs, type FlatView, type Job } from "@/db/schema";
import { audit } from "@/lib/audit";
import { loadPack } from "@/lib/data";
import { prefillPack } from "@/lib/prefill";
import { generateFlat } from "@/lib/lineart/service";

/** A job still RUNNING this long after its last progress update has died with its function. */
const STALE_MS = 6 * 60 * 1000;

export type JobView = { id: string; kind: Job["kind"]; status: Job["status"]; step: string; result: Record<string, unknown> | null; error: string | null; view: FlatView | null };

const viewOf = (j: Job): JobView => ({ id: j.id, kind: j.kind, status: j.status, step: j.step, result: j.result ?? null, error: j.error, view: j.params?.view ?? null });

/**
 * Queues a job and runs it after the response is sent (Vercel keeps the function alive for the
 * route's maxDuration). One live job per pack and kind/view: starting again returns the running one.
 */
export async function startJob(packId: string, kind: Job["kind"], params: { view?: FlatView }, userId: string): Promise<JobView> {
  const live = await activeJobs(packId);
  const same = live.find((j) => j.kind === kind && (kind !== "FLAT" || j.view === (params.view ?? null)));
  if (same) return same;
  const [job] = await db.insert(jobs).values({ packId, kind, params, createdBy: userId }).returning();
  after(() => runJob(job.id));
  return viewOf(job);
}

async function update(id: string, set: Partial<typeof jobs.$inferInsert>) {
  await db.update(jobs).set({ ...set, updatedAt: new Date() }).where(eq(jobs.id, id));
}

export async function runJob(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job || job.status !== "QUEUED") return;
  await update(id, { status: "RUNNING", step: "Starting" });
  const user = { id: job.createdBy ?? "" };
  const progress = (step: string) => update(id, { step });
  try {
    if (job.kind === "PREFILL") {
      const res = await prefillPack(job.packId, user, progress);
      if (!res.ok) await update(id, { status: "ERROR", error: res.error, step: "" });
      else await update(id, { status: "DONE", step: "", result: { filled: res.filled, skippedConfirmed: res.skippedConfirmed, dropped: res.dropped, fixture: res.fixture } });
    } else {
      const p = await loadPack(job.packId);
      if (!p) throw new Error("Pack not found.");
      const view = job.params.view ?? "FRONT";
      await progress(`Drawing the ${view.toLowerCase()} view`);
      const { flat, note } = await generateFlat(p, view, user.id);
      await audit({ userId: user.id || null, entity: "flat", entityId: flat.id, action: "ai", field: view, after: { source: flat.source } });
      await update(id, { status: "DONE", step: "", result: { flatId: flat.id, view: flat.view, status: flat.status, source: flat.source, note } });
    }
  } catch (e) {
    // Messages from the AI / image layers are already plain English (see lib/ai/errors).
    await update(id, { status: "ERROR", step: "", error: (e as Error).message || "Something went wrong — try again." });
  }
}

export async function getJob(packId: string, id: string): Promise<JobView | null> {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.packId, packId)));
  if (!job) return null;
  return viewOf(await expireIfStale(job));
}

/** Queued / running jobs for a pack (the studio resumes polling them after a reload). */
export async function activeJobs(packId: string): Promise<JobView[]> {
  const rows = await db.select().from(jobs).where(and(eq(jobs.packId, packId), inArray(jobs.status, ["QUEUED", "RUNNING"]))).orderBy(desc(jobs.createdAt));
  const out: JobView[] = [];
  for (const r of rows) {
    const j = await expireIfStale(r);
    if (j.status === "QUEUED" || j.status === "RUNNING") out.push(viewOf(j));
  }
  return out;
}

async function expireIfStale(job: Job): Promise<Job> {
  if ((job.status === "RUNNING" || job.status === "QUEUED") && Date.now() - job.updatedAt.getTime() > STALE_MS) {
    const error = "This run stopped before it finished. Start it again.";
    await update(job.id, { status: "ERROR", error, step: "" });
    return { ...job, status: "ERROR", error, step: "" };
  }
  return job;
}
