import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { formatDate, type Reliability } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SeriesPage() {
  const supabase = await createClient();
  const [{ data: sets, error }, { data: releases }] = await Promise.all([
    supabase.from("card_sets").select("id, code, series_number, name_ja, name_fr, total_cards, image_url, reliability, cards(count)")
      .order("series_number", { ascending: false, nullsFirst: false }),
    supabase.from("release_calendar").select("set_id, event_date, precision, is_estimate").eq("event_type", "sortie_set").eq("region", "JP"),
  ]);

  return (
    <div>
      <PageHeader title="Séries" intro="Toutes les séries Super Divers enregistrées, avec leur progression de catalogage.">
        <Link href="/saisie?onglet=serie" className="rounded-lg border border-line px-3 py-2 text-sm hover:border-gold">Ajouter une série</Link>
      </PageHeader>
      {error && <p className="text-down">Lecture impossible : {error.message}</p>}
      {!error && !sets?.length && <p className="text-muted">Aucune série enregistrée. Commence par la saisie d’une série avec sa source officielle.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(sets ?? []).map((st) => {
          const count = (st.cards as unknown as { count: number }[])?.[0]?.count ?? 0;
          const rel = releases?.find((r) => r.set_id === st.id);
          const pct = st.total_cards ? Math.min(100, Math.round((count / st.total_cards) * 100)) : null;
          return (
            <Link key={st.id} href={`/series/${encodeURIComponent(st.code)}`} className="group panel p-5 panel-hover">
              <div className="flex items-start justify-between gap-3">
                <span className="font-display text-3xl font-semibold text-gold">{st.code}</span>
                <ReliabilityBadge level={st.reliability as Reliability} />
              </div>
              <p className="mt-2 font-medium group-hover:text-gold">{st.name_fr ?? st.name_ja}</p>
              {st.name_fr && <p className="text-sm text-muted">{st.name_ja}</p>}
              <p className="mt-3 text-sm text-muted">
                {rel ? `Sortie Japon : ${formatDate(rel.event_date, rel.precision)}${rel.is_estimate ? " (estimation)" : ""}` : "Date de sortie non renseignée"}
              </p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted">
                  <span>{count} carte{count > 1 ? "s" : ""} cataloguée{count > 1 ? "s" : ""}</span>
                  <span>{st.total_cards ? `sur ${st.total_cards}` : "total inconnu"}</span>
                </div>
                {pct !== null && <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
