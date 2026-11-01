"use client";
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/nav";
import { isActive, NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

export function MobileNav({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Wordmark logoUrl={logoUrl} />
      </header>

      <nav
        aria-label="Navigation rapide"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => "mobile" in n && n.mobile).map(({ href, short, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2 text-[0.68rem] ${active ? "text-gold" : "text-muted"}`}
                >
                  <Icon size={20} aria-hidden />
                  {short}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className="flex w-full flex-col items-center gap-1 py-2 text-[0.68rem] text-muted"
            >
              <Menu size={20} aria-hidden />
              Plus
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/50" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface p-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mb-3 flex items-center justify-between px-3">
              <span className="font-semibold">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-1 text-muted">
                <X size={20} />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-2 border-t border-line pt-2">
              <ThemeToggle />
              <form action="/auth/signout" method="post">
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted">
                  <LogOut size={17} aria-hidden />
                  Se déconnecter
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
