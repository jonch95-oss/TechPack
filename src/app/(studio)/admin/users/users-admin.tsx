"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "@/app/actions/admin";
import { Badge, Button, Label, TextInput, cx } from "@/components/ui";
import { ChipRow } from "@/components/chips";
import type { Role } from "@/db/schema";

type U = { id: string; email: string; name: string; role: Role; active: boolean };

export function UsersAdmin({ users, meId }: { users: U[]; meId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [role, setRole] = useState<Role>("designer");
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const act = (p: Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await p;
      setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error ?? "Failed." });
      router.refresh();
    });

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-16">
      <table className="w-full text-[13px] self-start">
        <thead>
          <tr className="border-b border-ink text-left">
            {["Name", "Email", "Role", "Status", ""].map((h) => (
              <th key={h} className="eyebrow py-3 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={cx("border-b border-hairline", !u.active && "opacity-50")}>
              <td className="py-4 pr-4 display text-[19px]">{u.name}</td>
              <td className="py-4 pr-4 text-ink-soft">{u.email}</td>
              <td className="py-4 pr-4">
                <select
                  value={u.role}
                  disabled={u.id === meId}
                  onChange={(e) => act(updateUser(u.id, { role: e.target.value as Role }))}
                  className="bg-transparent uppercase text-[11px] tracking-[0.16em]"
                  aria-label={`Role for ${u.name}`}
                >
                  <option value="admin">Admin</option>
                  <option value="designer">Designer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </td>
              <td className="py-4 pr-4">{u.active ? <Badge tone="ok">Active</Badge> : <Badge>Disabled</Badge>}</td>
              <td className="py-4 text-right space-x-4 whitespace-nowrap">
                {u.id !== meId && (
                  <button className="eyebrow hover:text-ink" onClick={() => act(updateUser(u.id, { active: !u.active }))}>
                    {u.active ? "Disable" : "Enable"}
                  </button>
                )}
                <button
                  className="eyebrow hover:text-ink"
                  onClick={() => {
                    const pw = window.prompt(`New temporary password for ${u.name} (10+ characters)`);
                    if (pw) act(updateUser(u.id, { password: pw }));
                  }}
                >
                  Reset password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        ref={form}
        className="border border-hairline bg-paper p-8 space-y-7 self-start"
        action={(fd) => {
          fd.set("role", role);
          start(async () => {
            const r = await createUser(fd);
            setMsg(r.ok ? { ok: true, text: r.message ?? "Added." } : { ok: false, text: r.error });
            if (r.ok) form.current?.reset();
            router.refresh();
          });
        }}
      >
        <div className="display text-2xl">Invite a colleague</div>
        <div>
          <Label htmlFor="u-name" required>Name</Label>
          <TextInput id="u-name" name="name" placeholder="BLAIR" />
        </div>
        <div>
          <Label htmlFor="u-email" required>Email</Label>
          <TextInput id="u-email" name="email" type="email" />
        </div>
        <div>
          <Label required>Role</Label>
          <ChipRow options={["admin", "designer", "viewer"]} value={role} onChange={(v) => v && setRole(v as Role)} allowOther={false} />
        </div>
        <div>
          <Label htmlFor="u-pw" required>Temporary password</Label>
          <TextInput id="u-pw" name="password" type="text" minLength={10} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>Add to the team</Button>
        {msg && <p className={cx("text-[12px]", msg.ok ? "text-ok" : "text-signal")} role="status">{msg.text}</p>}
      </form>
    </div>
  );
}
