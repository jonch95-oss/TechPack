"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type JobState = {
  id: string;
  kind: "PREFILL" | "FLAT";
  status: "QUEUED" | "RUNNING" | "DONE" | "ERROR";
  step: string;
  result: Record<string, unknown> | null;
  error: string | null;
  view: string | null;
};

const POLL_MS = 1500;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  // Resume a job that is still running (page reloaded, or started from another tab).
  useEffect(() => {
    alive.current = true;
    fetch(`/api/packs/${packId}/jobs`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d: { jobs: JobState[] }) => {
        const j = d.jobs.find((x) => matchRef.current(x));
        if (j && alive.current) void poll(j);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, [packId, poll]);

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
  return { job, running, start, startError };
}
