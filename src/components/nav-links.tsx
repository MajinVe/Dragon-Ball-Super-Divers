"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavLinks({ onNavigate, pending = 0 }: { onNavigate?: () => void; pending?: number }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-[4px] px-3 py-2 text-[0.94rem] transition-colors ${
                active ? "bg-surface-2 text-ink shadow-[inset_4px_0_0_var(--orange)]" : "text-muted hover:bg-surface-2/60 hover:text-ink"
              }`}
            >
              <Icon size={18} aria-hidden className={active ? "text-gold" : undefined} />
              <span className="flex-1">{label}</span>
              {href === "/veille" && pending > 0 && (
                <span className="font-display rounded-[3px] bg-orange px-1.5 text-xs leading-5 text-[#141414]">{pending}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
