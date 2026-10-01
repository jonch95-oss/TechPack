import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth/dal";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav";

export default async function StudioLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/account");
  const items = [
    { href: "/", label: "Tech Packs" },
    { href: "/library/materials", label: "Materials" },
    { href: "/library/hardware", label: "Hardware" },
    { href: "/library/prints", label: "Artwork" },
    ...(can(user, "admin") ? [{ href: "/admin/brands", label: "Brands" }, { href: "/admin/users", label: "Team" }] : []),
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-ivory/90 backdrop-blur border-b border-hairline">
        <div className="max-w-[1480px] mx-auto px-10 h-[72px] flex items-center justify-between gap-8">
          <Link href="/" className="flex flex-col leading-none group" aria-label="Icon Tech Pack Studio — home">
            <span className="display text-[26px] tracking-[0.32em] text-ink group-hover:text-gold transition-colors">ICON</span>
            <span className="text-[8.5px] tracking-[0.42em] text-taupe mt-1">TECH PACK STUDIO</span>
          </Link>
          <NavLinks items={items} />
          <div className="flex items-center gap-5">
            <div className="text-right leading-tight">
              <Link href="/account" className="text-[11px] tracking-[0.14em] text-ink hover:text-gold">{user.name}</Link>
              <div className="text-[9.5px] tracking-[0.22em] uppercase text-taupe">{user.role}</div>
            </div>
            <form action={logout}>
              <button className="text-[10px] tracking-[0.22em] uppercase text-taupe hover:text-ink transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1480px] mx-auto px-10 py-12">{children}</main>
      <footer className="border-t border-hairline">
        <div className="max-w-[1480px] mx-auto px-10 py-6 flex justify-between text-[9.5px] tracking-[0.28em] uppercase text-mist">
          <span>Icon Luxury Group</span>
          <span>Internal — files only, never sent to factories</span>
        </div>
      </footer>
    </div>
  );
}
