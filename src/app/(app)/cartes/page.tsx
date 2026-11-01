import Link from "next/link";
import { CardTile, type CardRow } from "@/components/card-tile";
import { PageHeader } from "@/components/page-header";
import { ORIGIN_LABEL, marketSearchLinks } from "@/lib/catalogue";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SP = { q?: string; serie?: string; rarete?: string; origine?: string; parallele?: string; prixmin?: string; prixmax?: string; tri?: string };

export default async function CartesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: sets }, { data: rarities }] = await Promise.all([
    supabase.from("card_sets").select("id, code").order("series_number", { ascending: false, nullsFirst: false }),
    supabase.from("rarities").select("code").order("sort_order", { ascending: false }),
  ]);

  let query = supabase.from("cards")
    .select("id, card_number, variant, is_parallel, name_ja, name_fr, character_ja, character_fr, rarity_code, image_url, origin, set:card_sets(code)")
    .limit(240);
  const q = (sp.q ?? "").replace(/[,()"\\%]/g, " ").trim();
  if (q) {
    const p = `%${q}%`;
    query = query.or(`name_ja.ilike.${p},name_fr.ilike.${p},character_ja.ilike.${p},character_fr.ilike.${p},card_number.ilike.${p}`);
  }
  const setId = sets?.find((x) => x.code === sp.serie)?.id;
  if (setId) query = query.eq("set_id", setId);
  if (sp.rarete) query = query.eq("rarity_code", sp.rarete);
  if (sp.origine) query = query.eq("origin", sp.origine);
  if (sp.parallele === "1") query = query.eq("is_parallel", true);
  query = query.order("card_number");

  const { data, error } = await query;
  let cards = (data ?? []) as unknown as CardRow[];
  const ids = cards.map((c) => c.id);
  const { data: vals } = ids.length ? await supabase.from("card_valuation").select("card_id, valeur_estimee_eur").in("card_id", ids) : { data: [] };
  const value = new Map((vals ?? []).map((v) => [v.card_id as string, v.valeur_estimee_eur === null ? null : Number(v.valeur_estimee_eur)]));

  const min = sp.prixmin ? Number(sp.prixmin) : null;
  const max = sp.prixmax ? Number(sp.prixmax) : null;
  if (min !== null || max !== null) {
    cards = cards.filter((c) => {
      const v = value.get(c.id);
      return v != null && (min === null || v >= min) && (max === null || v <= max);
    });
  }
  if (sp.tri === "valeur") cards.sort((a, b) => (value.get(b.id) ?? -1) - (value.get(a.id) ?? -1));

  const filtered = Boolean(q || sp.serie || sp.rarete || sp.origine || sp.parallele || min !== null || max !== null);
  const jpTerms = `スーパーダイバーズ ${q || ""} ${sp.rarete ?? ""}`.trim();

  return (
    <div>
      <PageHeader title="Cartes de borne" intro="Recherche par personnage, numéro, série, rareté, mot-clé japonais ou cote. Les cartes de borne sont distinguées des produits scellés.">
        <Link href="/saisie?onglet=carte" className="rounded-lg border border-line px-3 py-2 text-sm hover:border-gold">Ajouter une carte</Link>
      </PageHeader>

      <form className="mb-6 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted">Nom, personnage, numéro (français ou japonais)</span>
          <input name="q" defaultValue={sp.q} className="field" placeholder="孫悟空, Vegeta, SDV8-035…" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Série</span>
          <select name="serie" defaultValue={sp.serie ?? ""} className="field">
            <option value="">Toutes</option>
            {(sets ?? []).map((x) => <option key={x.id} value={x.code}>{x.code}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Rareté</span>
          <select name="rarete" defaultValue={sp.rarete ?? ""} className="field">
            <option value="">Toutes</option>
            {(rarities ?? []).map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Origine</span>
          <select name="origine" defaultValue={sp.origine ?? ""} className="field">
            <option value="">Toutes</option>
            {Object.entries(ORIGIN_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Cote min (€)</span>
          <input name="prixmin" inputMode="decimal" defaultValue={sp.prixmin} className="field" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Cote max (€)</span>
          <input name="prixmax" inputMode="decimal" defaultValue={sp.prixmax} className="field" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Tri</span>
          <select name="tri" defaultValue={sp.tri ?? ""} className="field">
            <option value="">Numéro</option><option value="valeur">Cote décroissante</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="parallele" value="1" defaultChecked={sp.parallele === "1"} /> Parallèles uniquement</label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
          {filtered && <Link href="/cartes" className="rounded-lg px-3 py-2.5 text-sm text-muted hover:text-ink">Effacer</Link>}
          <button className="rounded-lg bg-gold px-4 py-2.5 font-semibold text-[#11121a]">Rechercher</button>
        </div>
      </form>

      <details className="mb-6 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer text-muted">Chercher sur les places de marché japonaises ({jpTerms})</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {marketSearchLinks(jpTerms).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 hover:border-gold">{l.label}</a>)}
          {marketSearchLinks(`スーパーダイバーズ 排出 ${sp.rarete ?? "SEC"}`).slice(0, 1).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 hover:border-gold">Mercari « 排出 »</a>)}
          {marketSearchLinks(`スーパーダイバーズ パラレル`).slice(2, 3).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 hover:border-gold">Yahoo « パラレル »</a>)}
        </div>
        <p className="mt-2 text-xs text-muted">Ces liens ouvrent les recherches dans ton navigateur. Pour enregistrer un prix trouvé, colle l’annonce dans la saisie assistée.</p>
      </details>

      {error && <p className="text-down">Lecture impossible : {error.message}</p>}
      <p className="mb-3 text-sm text-muted">{cards.length} carte{cards.length > 1 ? "s" : ""}{cards.length === 240 ? " (limite d’affichage atteinte, affine la recherche)" : ""}</p>
      {cards.length === 0 && !error ? (
        <p className="text-muted">{filtered ? "Aucune carte ne correspond. Élargis les filtres." : "Le catalogue est vide. Ajoute des cartes ou importe une liste officielle depuis la saisie."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => <CardTile key={c.id} card={c} value={value.get(c.id)} />)}
        </div>
      )}
    </div>
  );
}
