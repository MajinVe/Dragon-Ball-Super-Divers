"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Grid } from "@/components/fields";
import { analyzeUrl, saveObservation, type AnalyzeState } from "./actions";

type Opt = { id: string; label: string };

export function AssistedEntry({ stores, products, initialCard }: { stores: Opt[]; products: Opt[]; initialCard?: string }) {
  const [state, action, pending] = useActionState<AnalyzeState, FormData>(analyzeUrl, null);
  const d = state?.data;
  const first = d?.prices[0];

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <Field label="Adresse de l’annonce ou de la page produit" hint="Mercari, Yahoo! Auctions, Buyee, boutique… La page est lue une seule fois, à ta demande.">
          <input name="url" type="url" required className="field" placeholder="https://" />
        </Field>
        <div className="flex items-center gap-3">
          <button disabled={pending} className="rounded-lg border border-gold/60 px-4 py-2.5 font-semibold text-gold disabled:opacity-60">
            {pending ? "Analyse…" : "Analyser la page"}
          </button>
          {state && <p className={`text-sm ${state.ok ? "text-muted" : "text-down"}`}>{state.message}</p>}
        </div>
      </form>

      {d && (
        <div key={d.url} className="rounded-2xl border border-line bg-surface-2/40 p-5">
          <div className="mb-4 flex gap-4">
            {d.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.image} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 text-sm">
              <p className="font-medium">{d.title ?? "Titre non détecté"}</p>
              <p className="text-muted">
                {d.storeName ? `Boutique reconnue : ${d.storeName}` : "Boutique non reconnue"}
                {d.cardNumbers.length > 0 && `, numéros détectés : ${d.cardNumbers.join(", ")}`}
                {d.rarities.length > 0 && `, raretés : ${d.rarities.join(", ")}`}
                {d.parallel && ", mention parallèle"}
              </p>
              {d.prices.length > 1 && <p className="text-muted">Autres prix lus sur la page : {d.prices.slice(1).map((p) => `${p.amount} ${p.currency}`).join(", ")}</p>}
              {d.note && <p className="mt-1 text-orange">{d.note}</p>}
            </div>
          </div>

          <ActionForm action={saveObservation} submitLabel="Enregistrer l’observation">
            <input type="hidden" name="url" value={d.url} />
            <input type="hidden" name="image_url" value={d.image ?? ""} />
            <Grid>
              <Field label="Titre"><input name="title" defaultValue={d.title ?? ""} className="field" /></Field>
              <Field label="Type de prix">
                <select name="kind" defaultValue="annonce" className="field">
                  <option value="annonce">Prix affiché (annonce en ligne)</option>
                  <option value="vente_conclue">Vente conclue</option>
                  <option value="prix_officiel">Prix officiel</option>
                </select>
              </Field>
              <Field label="Numéro de carte" hint="Laisse vide si c’est un produit scellé.">
                <input name="card_number" defaultValue={d.cardNumbers[0] ?? initialCard ?? ""} className="field" placeholder="SDV8-035" />
              </Field>
              <Field label="ou Produit">
                <select name="product_id" className="field" defaultValue="">
                  <option value="">Aucun</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Prix"><input name="price" inputMode="decimal" defaultValue={first?.amount ?? ""} className="field" required /></Field>
              <Field label="Devise">
                <select name="currency" defaultValue={first?.currency ?? "JPY"} className="field">
                  <option value="JPY">Yen (JPY)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar (USD)</option>
                </select>
              </Field>
              <Field label="Boutique ou plateforme">
                <select name="store_id" defaultValue={d.storeId ?? ""} className="field">
                  <option value="">Non précisée</option>
                  {stores.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                </select>
              </Field>
              <Field label="Disponibilité">
                <select name="availability" defaultValue="en_stock" className="field">
                  <option value="en_stock">En stock</option><option value="precommande">Précommande</option>
                  <option value="rupture">Rupture / vendu</option><option value="inconnu">Inconnue</option>
                </select>
              </Field>
              <Field label="Frais de port (même devise)"><input name="shipping_cost" inputMode="decimal" className="field" /></Field>
              <Field label="Date de l’observation"><input name="observed_at" type="date" className="field" /></Field>
              <Field label="Gradation (si carte gradée)">
                <select name="grade_company" defaultValue="" className="field">
                  <option value="">Non gradée</option><option value="PSA">PSA</option><option value="BGS">BGS</option><option value="CGC">CGC</option>
                </select>
              </Field>
              <Field label="Note de gradation"><input name="grade" inputMode="decimal" className="field" placeholder="10" /></Field>
            </Grid>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
