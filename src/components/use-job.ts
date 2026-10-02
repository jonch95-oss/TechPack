"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type JobState = {
  id: string;
  kind: "PREFILL" | "FLAT" | "SOURCE" | "BOARD";
  status: "QUEUED" | "RUNNING" | "DONE" | "ERROR";
  step: string;
  result: Record<string, unknown> | null;
  error: string | null;
  view: string | null;
  fileId?: string | null;
};

const POLL_MS = 1500;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls one job until it finishes (several can run at once, e.g. one per uploaded source). */
export async function pollJob(packId: string, job: JobState, onUpdate: (j: JobState) => void, alive: () => boolean = () => true): Promise<JobState> {
  let cur = job;
  let misses = 0;
  while (alive() && (cur.status === "QUEUED" || cur.status === "RUNNING")) {
    await wait(POLL_MS);
    try {
      const res = await fetch(`/api/packs/${packId}/jobs/${cur.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      cur = ((await res.json()) as { job: JobState }).job;
      misses = 0;
      onUpdate(cur);
    } catch {
      if (++misses > 400) break;
      await wait(POLL_MS * 2);
    }
  }
  return cur;
}

/** Starts a job; resolves to it (or an error message). */
export async function startJobRequest(packId: string, body: Record<string, string>): Promise<JobState | string> {
  try {
    const res = await fetch(`/api/packs/${packId}/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { job?: JobState; error?: string };
    return res.ok && json.job ? json.job : (json.error ?? "Couldn't start — try again.");
  } catch {
    return "Couldn't reach the studio — check your connection and try again.";
  }
}

/**
 * Starts a background job and polls it until it finishes. A dropped request or a page reload never
 * loses the work: polling retries quietly, and on load the studio picks up any job still running.
 */
export function useJob(packId: string, match: (j: JobState) => boolean, onFinish: (j: JobState) => void) {
  const [job, setJob] = useState<JobState | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const alive = useRef(true);
  const finish = useRef(onFinish);
  const matchRef = useRef(match);
  useEffect(() => {
    finish.current = onFinish;
    matchRef.current = match;
  });

  const poll = useCallback(
    async (j: JobState) => {
      let cur = j;
      setJob(cur);
      let misses = 0;
      while (alive.current && (cur.status === "QUEUED" || cur.status === "RUNNING")) {
        await wait(POLL_MS);
        try {
          const res = await fetch(`/api/packs/${packId}/jobs/${cur.id}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          cur = ((await res.json()) as { job: JobState }).job;
          misses = 0;
          if (alive.current) setJob(cur);
        } catch {
          // Offline or a dropped connection: keep the job, try again a little later.
          if (++misses > 400) break;
          await wait(POLL_MS * 2);
        }
      }
      if (alive.current && (cur.status === "DONE" || cur.status === "ERROR")) finish.current(cur);
    },
    [packId],
  );

  // Picks up a job that is running without this page having started it (reload, another tab, or a
  // job the server started itself, e.g. reading the board after a render upload).
  const resume = useCallback(() => {
    fetch(`/api/packs/${packId}/jobs`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d: { jobs: JobState[] }) => {
        const j = d.jobs.find((x) => matchRef.current(x));
        if (j && alive.current) void poll(j);
      })
      .catch(() => {});
  }, [packId, poll]);
  useEffect(() => {
    alive.current = true;
    resume();
    return () => {
      alive.current = false;
    };
  }, [resume]);

  const start = useCallback(
    async (body: { kind: "prefill" } | { kind: "flat"; view: string }) => {
      setStartError(null);
      try {
        const res = await fetch(`/api/packs/${packId}/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const json = (await res.json().catch(() => ({}))) as { job?: JobState; error?: string };
        if (!res.ok || !json.job) throw new Error(json.error ?? "Couldn't start — try again.");
        await poll(json.job);
      } catch (e) {
        setStartError((e as Error).message === "Failed to fetch" ? "Couldn't reach the studio — check your connection and try again." : (e as Error).message);
      }
    },
    [packId, poll],
  );

  const running = !!job && (job.status === "QUEUED" || job.status === "RUNNING");
  return { job, running, start, startError, resume };
}
