"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { isAdmin } from "@/lib/admin";
import { scanAll } from "@/lib/scanner";
import { createClient } from "@/lib/supabase/server";

async function guard() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) throw new Error("Réservé à l’administrateur.");
  return supabase;
}
const done = () => { revalidatePath("/veille"); revalidatePath("/", "layout"); };

export async function scanNow(): Promise<ActionState> {
  try {
    const supabase = await guard();
    const r = await scanAll(supabase);
    done();
    const created = r.reduce((n, x) => n + ("created" in x ? (x.created ?? 0) : 0), 0);
    const errors = r.filter((x) => "error" in x).map((x) => `${x.source} : ${"error" in x ? x.error : ""}`);
    return { ok: errors.length === 0, message: `${created} nouveauté(s) détectée(s)${errors.length ? `. Erreurs : ${errors.join(" ; ")}` : "."}` };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
}

export async function rejectDetection(f: FormData) {
  const supabase = await guard();
  await supabase.from("detections").update({ status: "rejetee", reviewed_at: new Date().toISOString(), note: "Fausse information ou sans intérêt" }).eq("id", String(f.get("id")));
  done();
}

export async function rejectAll() {
  const supabase = await guard();
  await supabase.from("detections").update({ status: "rejetee", reviewed_at: new Date().toISOString(), note: "Ignoré en masse" }).eq("status", "en_attente");
  done();
}

const KIND_TO_ANNOUNCEMENT: Record<string, string> = {
  nouvelle_serie: "nouvelle_serie", visuels: "cartes", advance_pack: "advance_pack", produit: "produit", evenement: "evenement", annonce: "autre",
};

/** Valide une détection : l'enregistre comme annonce (ou comme offre si une boutique et une cible sont fournies). */
export async function acceptDetection(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await guard();
    const id = String(f.get("id"));
    const { data: d } = await supabase.from("detections").select("*, source:watch_sources(store_id, reliability, url)").eq("id", id).single();
    if (!d) return { ok: false, message: "Détection introuvable." };
    const src = d.source as { store_id: string | null; reliability: string; url: string } | null;
    const titleFr = String(f.get("title_fr") ?? "").trim() || null;

    if (d.price != null && src?.store_id) {
      const productId = String(f.get("product_id") ?? "") || null;
      const num = String(f.get("card_number") ?? "").trim().toUpperCase();
      let cardId: string | null = null;
      if (num) {
        const { data: c } = await supabase.from("cards").select("id").eq("card_number", num).limit(1).maybeSingle();
        if (!c) return { ok: false, message: `La carte ${num} n’est pas dans le catalogue.` };
        cardId = c.id;
      }
      const { error } = await supabase.from("product_listings").upsert({
        store_id: src.store_id, external_id: d.url, product_id: cardId ? null : productId, card_id: cardId,
        title: d.title, url: d.url, image_url: d.image_url, price: d.price, currency: d.currency ?? "EUR",
        availability: d.available === false ? "rupture" : "en_stock", last_checked_at: new Date().toISOString(), is_active: true,
      }, { onConflict: "store_id,external_id" });
      if (error) return { ok: false, message: error.message };
    } else {
      let sourceId: string | null = null;
      const { data: s } = await supabase.from("sources").select("id").eq("url", src?.url ?? "").maybeSingle();
      if (s) sourceId = s.id;
      else if (src?.url) {
        const { data: ns } = await supabase.from("sources").insert({ name: new URL(src.url).hostname, url: src.url, reliability: d.reliability, method: "collecte_autorisee", game: "dbsdv" }).select("id").single();
        sourceId = ns?.id ?? null;
      }
      const { error } = await supabase.from("announcements").upsert({
        game: "dbsdv", kind: KIND_TO_ANNOUNCEMENT[d.kind] ?? "autre", title_ja: d.title, title_fr: titleFr, url: d.url,
        image_url: d.image_url, published_at: d.published_at, reliability: d.reliability, source_id: sourceId,
        content_hash: d.url, last_verified_at: new Date().toISOString(),
      }, { onConflict: "content_hash" });
      if (error) return { ok: false, message: error.message };
    }
    await supabase.from("detections").update({ status: "validee", reviewed_at: new Date().toISOString() }).eq("id", id);
    done();
    return { ok: true, message: "Validé et enregistré." };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
}

export async function addWatchSource(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await guard();
    const url = String(f.get("url") ?? "").trim();
    try { new URL(url); } catch { return { ok: false, message: "Adresse invalide." }; }
    const { error } = await supabase.from("watch_sources").insert({
      name: String(f.get("name") ?? "").trim() || new URL(url).hostname, url, parser: String(f.get("parser") ?? "page"),
      keywords: String(f.get("keywords") ?? "").trim() || null, currency: String(f.get("currency") ?? "EUR"),
      reliability: String(f.get("reliability") ?? "boutique"), store_id: String(f.get("store_id") ?? "") || null,
    });
    if (error) return { ok: false, message: error.code === "23505" ? "Cette source est déjà surveillée." : error.message };
    done();
    return { ok: true, message: "Source ajoutée. Elle sera lue au prochain scan." };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
}
