import Link from "next/link";

export function Panel({
  title, href, linkLabel, children, className = "",
}: {
  title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.02rem] font-semibold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-muted hover:text-gold">
            {linkLabel ?? "Tout voir"}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm leading-relaxed text-muted">{children}</p>;
}
