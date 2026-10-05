"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { Button, Label, TextInput } from "@/components/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-8">
      <div>
        <Label htmlFor="current">Current password</Label>
        <TextInput id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="next">New password</Label>
        <TextInput id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <TextInput id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      {state?.error && <p className="text-signal text-[12px]" role="alert">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
    </form>
  );
}
