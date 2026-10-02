"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button, Label, TextInput } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">Email</Label>
        <TextInput id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <TextInput id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="text-signal text-[12px] tracking-wide" role="alert">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Enter the studio"}
      </Button>
    </form>
  );
}
