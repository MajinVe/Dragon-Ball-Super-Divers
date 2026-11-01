export function Wordmark({ logoUrl }: { logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Accueil" className="h-9 w-auto max-w-[170px] object-contain" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <circle cx="16" cy="16" r="13" fill="none" stroke="var(--gold)" strokeWidth="1.8" />
        <circle cx="16" cy="16" r="7" fill="none" stroke="var(--gold)" strokeOpacity=".45" strokeWidth="1.4" />
        <circle cx="20.5" cy="11.5" r="2.6" fill="var(--orange)" />
      </svg>
      <span className="font-display text-[1.1rem] font-semibold uppercase tracking-[0.06em]">Divers Watch</span>
    </div>
  );
}
