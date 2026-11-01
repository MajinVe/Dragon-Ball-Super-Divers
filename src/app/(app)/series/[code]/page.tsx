import Link from "next/link";
import { notFound } from "next/navigation";
import { CardTile, type CardRow } from "@/components/card-tile";
import { PageHeader } from "@/components/page-header";
import { RarityBadge } from "@/components/rarity-badge";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { EVENT_LABEL, PRODUCT_TYPE_LABEL } from "@/lib/catalogue";
import { formatDate, type Reliability } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SerieDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ rarete?: string }> }) {
  const { code } = await params;
  const { rarete } = await searchParams;
  const supabase = await createClient();
  const { data: st } = await supabase.from("card_sets")
    .select("id, code, name_ja, name_fr, total_cards, image_url, reliability, source:sources(name, url)")
    .eq("code", decodeURIComponent(code)).maybeSingle();
  if (!st) notFound();

  const [{ data: cards }, { data: products }, { data: releases }] = await Promise.all([
    supabase.from("cards").select("id, card_number, variant, is_parallel, name_ja, name_fr, rarity_code, image_url").eq("set_id", st.id).order("card_number"),
    supabase.from("products").select("id, type, name_ja, name_fr, status").eq("set_id", st.id),
    supabase.from("release_calendar").select("id, event_type, event_date, precision, is_estimate, region, reliability").eq("set_id", st.id).order("event_date"),
  ]);
  const all = (cards ?? []) as CardRow[];
  const ids = all.map((c) => c.id);
  const { data: vals } = ids.length ? await supabase.from("card_valuation").select("card_id, valeur_estimee_eur").in("card_id", ids) : { data: [] };
  const value = new Map((vals ?? []).map((v) => [v.card_id, v.valeur_estimee_eur as number | null]));

  const byRarity = new Map<string, number>();
  for (const c of all) byRarity.set(c.rarity_code ?? "?", (byRarity.get(c.rarity_code ?? "?") ?? 0) + 1);
  const shown = rarete ? all.filter((c) => (c.rarity_code ?? "?") === rarete) : all;
  const src = st.source as unknown as { name: string; url: string | null } | null;

  return (
    <div>
      <PageHeader title={`${st.code} · ${st.name_fr ?? st.name_ja}`} intro={st.name_fr ? st.name_ja : undefined}>
        <ReliabilityBadge level={st.reliability as Reliability} />
      </PageHeader>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-muted">Catalogue</p>
          <p className="font-display tabular mt-1 text-3xl">{all.length}<span className="text-lg text-muted"> / {st.total_cards ?? "?"}</span></p>
          {src?.url && <a href={src.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-muted hover:text-gold">Source : {src.name}</a>}
        </div>
        <div className="panel p-5">
          <p className="mb-2 text-sm text-muted">Sorties</p>
          {releases?.length ? releases.map((r) => (
            <p key={r.id} className="text-sm">{formatDate(r.event_date, r.precision)} · {r.region === "JP" ? "Japon" : "France"} · {EVENT_LABEL[r.event_type]}{r.is_estimate ? " (estimation)" : ""}</p>
          )) : <p className="text-sm text-muted">Aucune date renseignée.</p>}
        </div>
        <div className="panel p-5">
          <p className="mb-2 text-sm text-muted">Produits associés</p>
          {products?.length ? products.map((p) => (
            <Link key={p.id} href={`/produits/${p.id}`} className="block text-sm hover:text-gold">{PRODUCT_TYPE_LABEL[p.type]} · {p.name_fr ?? p.name_ja}</Link>
          )) : <p className="text-sm text-muted">Aucun produit lié.</p>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/series/${encodeURIComponent(st.code)}`} className={`rounded-full border px-3 py-1 text-sm ${!rarete ? "border-gold text-gold" : "border-line text-muted"}`}>Toutes ({all.length})</Link>
        {[...byRarity.entries()].map(([r, nb]) => (
          <Link key={r} href={`/series/${encodeURIComponent(st.code)}?rarete=${encodeURIComponent(r)}`}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${rarete === r ? "border-gold" : "border-line"}`}>
            {r === "?" ? <span className="text-muted">Sans rareté</span> : <RarityBadge code={r} />} <span className="text-muted">{nb}</span>
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted">Aucune carte cataloguée pour cette série. Importe la liste officielle depuis la saisie (onglet Import CSV).</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((c) => <CardTile key={c.id} card={c} value={value.get(c.id)} />)}
        </div>
      )}
    </div>
  );
}
