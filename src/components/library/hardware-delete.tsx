"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteHardware } from "@/app/actions/library";

/** Admin only: delete a component from the library. Refused while a pack still uses it. */
export function HardwareDelete({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={pending}
        data-testid="delete-hardware"
        className="eyebrow text-signal hover:text-ink disabled:opacity-40"
        onClick={() => {
          if (!confirm(`Delete ${code} from the hardware library? This can't be undone.`)) return;
          setError(null);
          start(async () => {
            const res = await deleteHardware(id);
            if (!res.ok) return setError(res.error);
            router.push("/library/hardware");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="text-signal text-[12px] max-w-sm text-right" role="alert">{error}</p>}
    </div>
  );
}
