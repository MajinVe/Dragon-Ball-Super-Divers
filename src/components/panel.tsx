import Link from "next/link";

export function Panel({
  title, href, linkLabel, children, className = "",
}: {
  title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.05rem]"><span className="mr-2 inline-block h-3 w-3 -skew-x-12 bg-orange align-middle" aria-hidden />{title}</h2>
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
  return <p className="bubble my-1 text-sm leading-relaxed text-muted">{children}</p>;
}
