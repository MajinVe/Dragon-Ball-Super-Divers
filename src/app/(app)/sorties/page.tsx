import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { FEED_KIND, OfficialFeed } from "@/components/official-feed";
import { getOfficialFeed, refreshOfficialIfStale } from "@/lib/feed";
import { EVENT_LABEL } from "@/lib/catalogue";
import { formatDate, type Reliability } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string; event_type: string; event_date: string; precision: string; is_estimate: boolean;
  reliability: Reliability; region: string; notes: string | null;
  set: { code: string; name_ja: string; name_fr: string | null } | null;
  product: { id: string; name_ja: string; name_fr: string | null } | null;
  source: { name: string; url: string | null } | null;
};

export default async function SortiesPage({ searchParams }: { searchParams: Promise<{ region?: string; periode?: string; actu?: string }> }) {
  const { region = "tout", periode = "avenir", actu } = await searchParams;
  const supabase = await createClient();
  await refreshOfficialIfStale(supabase);
  const feed = await getOfficialFeed(supabase, 24, actu);
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase.from("release_calendar")
    .select("id, event_type, event_date, precision, is_estimate, reliability, region, notes, set:card_sets(code, name_ja, name_fr), product:products(id, name_ja, name_fr), source:sources(name, url)");
  if (region === "JP" || region === "FR") q = q.eq("region", region);
  q = periode === "passees" ? q.lt("event_date", today).order("event_date", { ascending: false }) : q.gte("event_date", today).order("event_date");
  const { data, error } = await q.limit(200);
  const rows = (data ?? []) as unknown as Row[];

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.event_date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const chip = (href: string, active: boolean, label: string) => (
    <Link href={href} className={`rounded-full border px-3 py-1 text-sm ${active ? "border-gold text-gold" : "border-line text-muted hover:text-ink"}`}>{label}</Link>
  );
  const qs = (p: Record<string, string>) => `/sorties?${new URLSearchParams({ region, periode, ...p })}`;

  return (
    <div>
      <PageHeader title="Sorties" intro="Calendrier des sorties japonaises et françaises. Les dates officielles et les estimations sont toujours distinguées." >
        <Link href="/saisie?onglet=sortie" className="rounded-lg border border-line px-3 py-2 text-sm hover:border-gold">Ajouter une date</Link>
      </PageHeader>

      <section className="mb-10">
        <h2 className="mb-3 text-xl">Actus officielles</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/sorties" className={`rounded-full border px-3 py-1 text-sm ${!actu ? "border-gold text-gold" : "border-line text-muted hover:text-ink"}`}>Toutes</Link>
          {Object.entries(FEED_KIND).map(([k, l]) => (
            <Link key={k} href={`/sorties?actu=${k}`} className={`rounded-full border px-3 py-1 text-sm ${actu === k ? "border-gold text-gold" : "border-line text-muted hover:text-ink"}`}>{l}</Link>
          ))}
        </div>
        <OfficialFeed items={feed} />
        <p className="mt-3 text-xs text-muted">Vignettes affichées depuis le site officiel ; chaque carte ouvre l’article d’origine. Lecture automatique toutes les 6 heures au plus.</p>
      </section>

      <h2 className="mb-3 text-xl">Calendrier</h2>
      <div className="mb-6 flex flex-wrap gap-2">
        {chip(qs({ periode: "avenir" }), periode !== "passees", "À venir")}
        {chip(qs({ periode: "passees" }), periode === "passees", "Passées")}
        <span className="mx-1 w-px bg-line" />
        {chip(qs({ region: "tout" }), region === "tout", "Toutes régions")}
        {chip(qs({ region: "JP" }), region === "JP", "Japon")}
        {chip(qs({ region: "FR" }), region === "FR", "France")}
      </div>

      {error && <p className="text-down">Lecture impossible : {error.message}</p>}
      {!error && rows.length === 0 && (
        <p className="text-muted">Aucune date enregistrée pour ce filtre. Ajoute la première depuis l’onglet « Date de sortie » de la saisie, avec sa source.</p>
      )}

      <div className="space-y-8">
        {[...groups.entries()].map(([month, items]) => (
          <section key={month}>
            <h2 className="mb-3 text-sm uppercase tracking-[0.12em] text-muted">{formatDate(`${month}-01`, "mois")}</h2>
            <ol className="relative space-y-3 border-l border-line pl-5">
              {items.map((r) => {
                const name = r.set ? `${r.set.code} · ${r.set.name_fr ?? r.set.name_ja}` : r.product ? (r.product.name_fr ?? r.product.name_ja) : "Sans nom";
                const href = r.set ? `/series/${encodeURIComponent(r.set.code)}` : r.product ? `/produits/${r.product.id}` : null;
                return (
                  <li key={r.id} className="relative panel panel-sm p-4">
                    <span className={`absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-bg ${r.is_estimate ? "bg-orange" : "bg-gold"}`} aria-hidden />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display tabular text-sm text-gold">{formatDate(r.event_date, r.precision)} · {r.region === "JP" ? "Japon" : "France"}</p>
                        {href ? <Link href={href} className="font-medium hover:text-gold">{name}</Link> : <p className="font-medium">{name}</p>}
                        <p className="text-sm text-muted">{EVENT_LABEL[r.event_type]}{r.notes ? ` · ${r.notes}` : ""}</p>
                      </div>
                      <ReliabilityBadge level={r.is_estimate ? "estimation" : r.reliability} />
                    </div>
                    {r.source?.url && (
                      <a href={r.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-muted underline-offset-4 hover:text-gold hover:underline">Source : {r.source.name}</a>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
