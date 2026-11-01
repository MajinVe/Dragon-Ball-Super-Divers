import { notFound } from "next/navigation";
import { PENDING_MODULES } from "@/lib/nav";

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const info = PENDING_MODULES[module];
  if (!info) notFound();
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{info.title}</h1>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-gold">Pas encore développé, prévu à l’{info.step.toLowerCase()}</p>
        <p className="mt-2 leading-relaxed text-muted">{info.what}</p>
      </div>
    </div>
  );
}
