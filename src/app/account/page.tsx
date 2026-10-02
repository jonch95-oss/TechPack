import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="min-h-screen flex items-center justify-center p-10">
      <div className="w-full max-w-sm fade-up">
        <div className="display text-[30px] tracking-[0.36em] mb-10">ICON</div>
        <div className="eyebrow mb-3">{user.email}</div>
        <h1 className="display text-[40px] leading-tight mb-3">{user.mustChangePassword ? "Choose your password" : "Change password"}</h1>
        {user.mustChangePassword && <p className="text-taupe text-[12px] mb-8 leading-relaxed">You signed in with a temporary password. Set your own to continue.</p>}
        <PasswordForm />
        {!user.mustChangePassword && <Link href="/" className="eyebrow hover:text-ink inline-block mt-8">← Back to the studio</Link>}
      </div>
    </main>
  );
}
