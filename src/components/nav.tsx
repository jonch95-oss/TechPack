"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-7">
      {items.map((i) => {
        const active = i.href === "/" ? path === "/" || path.startsWith("/packs") : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cx(
              "relative text-[10.5px] tracking-[0.24em] uppercase py-2 transition-colors",
              active ? "text-ink" : "text-taupe hover:text-ink",
            )}
          >
            {i.label}
            <span className={cx("absolute left-0 right-0 -bottom-[1px] h-px bg-ink transition-transform origin-left duration-300", active ? "scale-x-100" : "scale-x-0")} />
          </Link>
        );
      })}
    </nav>
  );
}
