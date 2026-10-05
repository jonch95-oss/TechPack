"use client";

import { useState } from "react";

/** Text that saves on blur / Enter (not on every keystroke). */
export function CommitText({
  value,
  onCommit,
  disabled,
  placeholder,
  multiline,
  testId,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  testId?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    const t = draft.trim().toUpperCase();
    if (t !== (value ?? "")) onCommit(t);
  };
  const cls = "w-full bg-transparent border-0 border-b border-hairline-strong focus:outline-none focus:border-ink text-[14px] uppercase placeholder:normal-case placeholder:text-mist";
  return multiline ? (
    <textarea
      value={draft}
      rows={2}
      disabled={disabled}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // Enter saves; Shift+Enter starts a new line.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLTextAreaElement).blur();
        }
      }}
      className={cls + " py-2 resize-y leading-relaxed"}
    />
  ) : (
    <input
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className={cls + " h-10"}
    />
  );
}
