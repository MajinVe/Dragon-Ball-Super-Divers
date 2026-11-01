export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[60ch]">
        <h1 className="text-[1.8rem] font-semibold leading-tight sm:text-[2.2rem]">{title}</h1>
        {intro && <p className="mt-2 leading-relaxed text-muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}
