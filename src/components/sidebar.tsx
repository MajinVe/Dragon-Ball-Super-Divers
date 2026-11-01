import { LogOut } from "lucide-react";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

export function Sidebar({ email, logoUrl, pending = 0 }: { email: string; logoUrl?: string | null; pending?: number }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r-2 border-[var(--ink-line)] bg-surface px-3 py-5 lg:flex">
      <div className="px-2 pb-6">
        <Wordmark logoUrl={logoUrl} large />
      </div>
      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto">
        <NavLinks pending={pending} />
      </nav>
      <div className="space-y-1 border-t border-line pt-3">
        <ThemeToggle />
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">
            <LogOut size={17} aria-hidden />
            Se déconnecter
          </button>
        </form>
        <p className="truncate px-3 pt-2 text-xs text-muted" title={email}>{email}</p>
      </div>
    </aside>
  );
}
