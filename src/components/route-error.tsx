"use client";

import { useEffect } from "react";

/**
 * Shared fallback for route error boundaries (V2 brief §7.7 / §8): a failed render or a dropped
 * connection shows a plain message and a retry — never "This page couldn't load". Saved answers and
 * running background jobs are unaffected; retrying re-renders the page from the server.
 */
export function RouteError({ error, retry, where }: { error: Error & { digest?: string }; retry: () => void; where: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="max-w-xl mx-auto py-24 text-center" role="alert" data-testid="route-error">
      <div className="display italic text-3xl">{offline ? "You're offline" : `The ${where} didn't load`}</div>
      <p className="text-taupe text-[13px] mt-4 leading-relaxed">
        {offline
          ? "Nothing is lost — answers you saved are on the server, and AI jobs keep running. Reconnect and try again."
          : "Nothing is lost — answers you saved are on the server, and AI jobs keep running. Try again; if it keeps happening, tell Jon the reference below."}
      </p>
      <button type="button" onClick={() => retry()} className="mt-8 inline-flex h-10 px-6 items-center border border-ink text-[11px] tracking-[0.2em] uppercase hover:bg-ink hover:text-ivory transition-colors">
        Try again
      </button>
      {error.digest && <div className="mt-6 text-[10px] tracking-[0.14em] uppercase text-mist">Ref {error.digest}</div>}
    </div>
  );
}
