"use server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionState } from "@/components/action-form";
import { isAdmin } from "@/lib/admin";
import { parseCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const n = (f: FormData, k: string) => {
  const v = s(f, k);
  if (v === null) return null;
  const x = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
};
const fail = (message: string): ActionState => ({ ok: false, message });

async function guard() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) throw new Error("Seul l’administrateur peut enregistrer des données.");
  return supabase;
}

/** Retrouve ou crée la source correspondant à l'URL ; impose une URL sauf pour « non vérifié ». */
async function sourceFrom(supabase: SupabaseClient, f: FormData) {
  const url = s(f, "source_url");
  const reliability = s(f, "reliability") ?? "non_verifie";
  if (!url) {
    if (reliability !== "non_verifie") throw new Error("Indique l’adresse de la source, ou choisis la fiabilité « Non vérifié ».");
    return { id: null as string | null, reliability };
  }
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { throw new Error("Adresse de source invalide."); }
  const { data: existing } = await supabase.from("sources").select("id").eq("url", url).maybeSingle();
  if (existing) return { id: existing.id as string, reliability };
  const { data, error } = await supabase.from("sources")
    .insert({ name: host, url, reliability, method: "manuel", game: "dbsdv" }).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, reliability };
}

async function ensureRarity(supabase: SupabaseClient, code: string | null) {
  if (!code) return null;
  const c = code.toUpperCase();
  await supabase.from("rarities").upsert({ game: "dbsdv", code: c, label: c }, { onConflict: "game,code", ignoreDuplicates: true });
  return c;
}

async function run(fn: () => Promise<ActionState>): Promise<ActionState> {
  try { return await fn(); } catch (e) { return fail(e instanceof Error ? e.message : String(e)); }
}

export async function createSet(_: ActionState, f: FormData) {
  return run(async () => {
    const supabase = await guard();
    const src = await sourceFrom(supabase, f);
    const code = s(f, "code")?.toUpperCase();
    const name_ja = s(f, "name_ja");
    if (!code || !name_ja) return fail("Le code et le nom japonais sont obligatoires.");
    const { error } = await supabase.from("card_sets").upsert({
      game: "dbsdv", code, name_ja, name_fr: s(f, "name_fr"), series_number: n(f, "series_number"),
      total_cards: n(f, "total_cards"), image_url: s(f, "image_url"),
      source_id: src.id, reliability: src.reliability, published_at: s(f, "published_at"),
      last_verified_at: new Date().toISOString(),
    }, { onConflict: "game,code" });
    if (error) return fail(error.message);
    revalidatePath("/series");
    return { ok: true, message: `Série ${code} enregistrée.` };
  });
}

export async function createCard(_: ActionState, f: FormData) {
  return run(async () => {
    const supabase = await guard();
    const src = await sourceFrom(supabase, f);
    const card_number = s(f, "card_number")?.toUpperCase();
    const name_ja = s(f, "name_ja");
    if (!card_number || !name_ja) return fail("Le numéro et le nom japonais sont obligatoires.");
    const rarity = await ensureRarity(supabase, s(f, "rarity_code"));
    const { error } = await supabase.from("cards").upsert({
      game: "dbsdv", set_id: s(f, "set_id"), card_number, variant: s(f, "variant") ?? "",
      is_parallel: f.get("is_parallel") === "on", name_ja, name_fr: s(f, "name_fr"),
      character_ja: s(f, "character_ja"), character_fr: s(f, "character_fr"), rarity_code: rarity,
      origin: s(f, "origin") ?? "borne", image_url: s(f, "image_url"),
      source_id: src.id, reliability: src.reliability, last_verified_at: new Date().toISOString(),
    }, { onConflict: "game,card_number,variant" });
    if (error) return fail(error.message);
    revalidatePath("/cartes");
    return { ok: true, message: `Carte ${card_number} enregistrée.` };
  });
}

export async function importCards(_: ActionState, f: FormData) {
  return run(async () => {
    const supabase = await guard();
    const src = await sourceFrom(supabase, f);
    const rows = parseCsv(String(f.get("csv") ?? ""));
    if (!rows.length) return fail("Aucune ligne lue. Vérifie que la première ligne contient les en-têtes.");
    const set_id = s(f, "set_id");
    const errors: string[] = [];
    const created = new Set<string>();
    const payload = [];
    for (const [i, r] of rows.entries()) {
      const num = (r["numero"] || r["numéro"] || "").toUpperCase();
      const name_ja = r["nom_ja"];
      if (!num || !name_ja) { errors.push(`ligne ${i + 2} : numéro ou nom japonais manquant`); continue; }
      const rar = r["rarete"] || r["rareté"] || "";
      if (rar) { await ensureRarity(supabase, rar); created.add(rar.toUpperCase()); }
      payload.push({
        game: "dbsdv", set_id, card_number: num, variant: r["variante"] || "",
        is_parallel: /^(1|oui|true|x)$/i.test(r["parallele"] || r["parallèle"] || ""),
        name_ja, name_fr: r["nom_fr"] || null, character_ja: r["personnage_ja"] || null,
        character_fr: r["personnage_fr"] || null, rarity_code: rar ? rar.toUpperCase() : null,
        origin: r["origine"] || "borne", image_url: r["image"] || null,
        source_id: src.id, reliability: src.reliability, last_verified_at: new Date().toISOString(),
      });
    }
    if (payload.length) {
      const { error } = await supabase.from("cards").upsert(payload, { onConflict: "game,card_number,variant" });
      if (error) return fail(error.message);
    }
    revalidatePath("/cartes");
    return {
      ok: errors.length === 0,
      message: `${payload.length} carte(s) importée(s)${created.size ? `, raretés : ${[...created].join(", ")}` : ""}${errors.length ? `. Ignorées : ${errors.slice(0, 5).join(" ; ")}` : "."}`,
    };
  });
}

export async function createProduct(_: ActionState, f: FormData) {
  return run(async () => {
    const supabase = await guard();
    const src = await sourceFrom(supabase, f);
    const name_ja = s(f, "name_ja");
    const type = s(f, "type");
    if (!name_ja || !type) return fail("Le type et le nom japonais sont obligatoires.");
    const { data, error } = await supabase.from("products").insert({
      game: "dbsdv", type, set_id: s(f, "set_id"), name_ja, name_fr: s(f, "name_fr"), jan_code: s(f, "jan_code"),
      official_price_jpy: n(f, "official_price_jpy"), cards_per_unit: n(f, "cards_per_unit"),
      contents: s(f, "contents"), status: s(f, "status") ?? "annonce", image_url: s(f, "image_url"),
      source_id: src.id, reliability: src.reliability, published_at: s(f, "published_at"),
      last_verified_at: new Date().toISOString(),
    }).select("id").single();
    if (error) return fail(error.message);
    const numbers = (s(f, "exclusive_cards") ?? "").split(/[\s,;]+/).filter(Boolean).map((x) => x.toUpperCase());
    let linked = 0;
    if (numbers.length) {
      const { data: cards } = await supabase.from("cards").select("id, card_number").in("card_number", numbers);
      if (cards?.length) {
        await supabase.from("product_cards").insert(cards.map((c) => ({
          product_id: data.id, card_id: c.id, is_exclusive: true, reliability: src.reliability, source_id: src.id,
        })));
        linked = cards.length;
      }
    }
    revalidatePath("/advance-packs");
    const missing = numbers.length - linked;
    return { ok: true, message: `Produit enregistré${linked ? `, ${linked} carte(s) exclusive(s) liée(s)` : ""}${missing > 0 ? `, ${missing} numéro(s) introuvable(s) dans le catalogue` : ""}.` };
  });
}

export async function createRelease(_: ActionState, f: FormData) {
  return run(async () => {
    const supabase = await guard();
    const src = await sourceFrom(supabase, f);
    const set_id = s(f, "set_id");
    const product_id = s(f, "product_id");
    const event_date = s(f, "event_date");
    if (!set_id && !product_id) return fail("Choisis une série ou un produit.");
    if (!event_date) return fail("Indique la date.");
    const is_estimate = f.get("is_estimate") === "on";
    if (is_estimate && src.reliability === "officiel") return fail("Une estimation ne peut pas être marquée « Officiel ».");
    const { error } = await supabase.from("release_calendar").insert({
      game: "dbsdv", event_type: s(f, "event_type") ?? (product_id ? "sortie_produit" : "sortie_set"),
      set_id, product_id, region: s(f, "region") ?? "JP", event_date, precision: s(f, "precision") ?? "jour",
      is_estimate, reliability: src.reliability, source_id: src.id, notes: s(f, "notes"),
      last_verified_at: new Date().toISOString(),
    });
    if (error) return fail(error.message);
    revalidatePath("/sorties");
    revalidatePath("/");
    return { ok: true, message: "Date ajoutée au calendrier." };
  });
}

export async function createAnnouncement(_: ActionState, f: FormData) {
  return run(async () => {
    const supabase = await guard();
    const src = await sourceFrom(supabase, f);
    const url = s(f, "url") ?? s(f, "source_url");
    if (!url) return fail("Indique l’adresse de l’annonce.");
    if (!s(f, "title_ja") && !s(f, "title_fr")) return fail("Indique un titre.");
    const { error } = await supabase.from("announcements").insert({
      game: "dbsdv", kind: s(f, "kind") ?? "autre", title_ja: s(f, "title_ja"), title_fr: s(f, "title_fr"),
      summary: s(f, "summary"), url, published_at: s(f, "published_at"), reliability: src.reliability,
      source_id: src.id, set_id: s(f, "set_id"), product_id: s(f, "product_id"), content_hash: url,
      last_verified_at: new Date().toISOString(),
    });
    if (error) return fail(error.code === "23505" ? "Cette annonce est déjà enregistrée." : error.message);
    revalidatePath("/");
    return { ok: true, message: "Annonce enregistrée." };
  });
}

/* ---------------- Saisie assistée par URL ---------------- */

export type Extracted = {
  url: string; title: string | null; image: string | null;
  prices: { amount: number; currency: "JPY" | "EUR" | "USD" }[];
  cardNumbers: string[]; rarities: string[]; parallel: boolean;
  storeId: string | null; storeName: string | null; note: string | null;
};
export type AnalyzeState = { ok: boolean; message: string; data?: Extracted } | null;

function blockedHost(h: string) {
  return h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":");
}

const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1]
  ?? null;

const decode = (t: string) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function analyzeUrl(_: AnalyzeState, f: FormData): Promise<AnalyzeState> {
  try {
    const supabase = await guard();
    const raw = s(f, "url");
    if (!raw) return { ok: false, message: "Colle l’adresse d’une annonce ou d’une page produit." };
    let u: URL;
    try { u = new URL(raw); } catch { return { ok: false, message: "Adresse invalide." }; }
    if (!/^https?:$/.test(u.protocol) || blockedHost(u.hostname)) return { ok: false, message: "Adresse non autorisée." };

    const host = u.hostname.replace(/^www\./, "");
    const { data: stores } = await supabase.from("stores").select("id, name, base_url");
    const store = stores?.find((st) => st.base_url && host.endsWith(new URL(st.base_url).hostname.replace(/^www\./, ""))) ?? null;

    const base: Extracted = {
      url: u.toString(), title: null, image: null, prices: [], cardNumbers: [], rarities: [], parallel: false,
      storeId: store?.id ?? null, storeName: store?.name ?? null, note: null,
    };

    let html = "";
    try {
      const res = await fetch(u, {
        headers: { "user-agent": "SuperDiversWatch/1.0 (outil personnel, consultation ponctuelle)", "accept-language": "ja,fr;q=0.8" },
        signal: AbortSignal.timeout(10000), redirect: "follow",
      });
      if (!res.ok) {
        return { ok: true, message: `La page a répondu ${res.status}. Complète les champs à la main.`, data: { ...base, note: "Lecture refusée par le site." } };
      }
      html = (await res.text()).slice(0, 1_500_000);
    } catch {
      return { ok: true, message: "La page n’a pas pu être lue. Complète les champs à la main.", data: { ...base, note: "Lecture impossible." } };
    }

    const title = meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null;
    const image = meta(html, "og:image");
    const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
    const scan = `${title ?? ""} ${text}`;

    const prices: Extracted["prices"] = [];
    const metaPrice = meta(html, "product:price:amount") ?? html.match(/"price"\s*:\s*"?([\d.]+)"?/)?.[1];
    const metaCur = (meta(html, "product:price:currency") ?? html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/)?.[1] ?? "").toUpperCase();
    if (metaPrice && ["JPY", "EUR", "USD"].includes(metaCur)) prices.push({ amount: Number(metaPrice), currency: metaCur as "JPY" | "EUR" | "USD" });
    for (const m of scan.matchAll(/(?:¥|￥)\s?([\d,]{2,9})|([\d,]{2,9})\s?円/g)) {
      const v = Number((m[1] ?? m[2]).replace(/,/g, ""));
      if (v > 0 && !prices.some((p) => p.amount === v && p.currency === "JPY")) prices.push({ amount: v, currency: "JPY" });
      if (prices.length >= 6) break;
    }
    for (const m of scan.matchAll(/(\d{1,5}(?:[.,]\d{2})?)\s?€/g)) {
      const v = Number(m[1].replace(",", "."));
      if (v > 0 && !prices.some((p) => p.amount === v && p.currency === "EUR")) prices.push({ amount: v, currency: "EUR" });
      if (prices.length >= 8) break;
    }

    const cardNumbers = [...new Set([...scan.matchAll(/\b(SDV(?:P[A-Z])?\d{0,2}-(?:SEC)?\d{1,3})\b/gi)].map((m) => m[1].toUpperCase()))].slice(0, 5);
    const rarities = [...new Set([...scan.matchAll(/\b(GDR|SEC|EXR|PUR)\b/g)].map((m) => m[1]))];
    const parallel = /パラレル|parall[eè]le|parallel|(GDR|SEC|UR)★/i.test(scan);

    const data: Extracted = {
      ...base, title: title ? decode(title).trim() : null, image, prices, cardNumbers, rarities, parallel,
      note: !title && prices.length === 0 ? "La page n’expose presque rien sans JavaScript (fréquent sur Mercari). Complète à la main." : null,
    };
    return { ok: true, message: "Page analysée. Vérifie et corrige avant d’enregistrer.", data };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveObservation(_: ActionState, f: FormData) {
  return run(async () => {
    const supabase = await guard();
    const url = s(f, "url");
    const price = n(f, "price");
    const currency = s(f, "currency") ?? "JPY";
    const kind = s(f, "kind") ?? "annonce";
    if (!url) return fail("Adresse manquante.");
    if (price === null) return fail("Indique le prix.");

    let card_id: string | null = null;
    let product_id = s(f, "product_id");
    const num = s(f, "card_number")?.toUpperCase();
    if (num) {
      const { data: c } = await supabase.from("cards").select("id").eq("card_number", num).order("variant").limit(1).maybeSingle();
      if (!c) return fail(`La carte ${num} n’est pas encore dans le catalogue. Ajoute-la d’abord (onglet Carte).`);
      card_id = c.id;
      product_id = null;
    }
    if (!card_id && !product_id) return fail("Rattache l’observation à une carte (numéro) ou à un produit.");

    const store_id = s(f, "store_id");
    const observed_at = s(f, "observed_at") ? new Date(String(s(f, "observed_at"))).toISOString() : new Date().toISOString();
    const grade_company = s(f, "grade_company");
    const grade = grade_company ? n(f, "grade") : null;

    if (kind === "annonce" && store_id && !grade_company) {
      const { error } = await supabase.from("product_listings").upsert({
        store_id, external_id: url, card_id, product_id, title: s(f, "title") ?? url, url, image_url: s(f, "image_url"),
        price, currency, shipping_cost: n(f, "shipping_cost"), availability: s(f, "availability") ?? "en_stock",
        entered_manually: true, last_checked_at: new Date().toISOString(), is_active: true,
      }, { onConflict: "store_id,external_id" });
      if (error) return fail(error.message);
    } else {
      const { data: srcRow } = await supabase.from("sources").select("id").eq("url", url).maybeSingle();
      const { error } = await supabase.from("price_history").insert({
        card_id, product_id, store_id, source_id: srcRow?.id ?? null, observed_at, kind, price, currency,
        shipping_cost: n(f, "shipping_cost"), availability: s(f, "availability"),
        grade_company, grade, condition_note: s(f, "condition_note"), url, entered_manually: true, note: s(f, "title"),
      });
      if (error) return fail(error.message);
    }
    revalidatePath("/cartes");
    revalidatePath("/advance-packs");
    return { ok: true, message: kind === "vente_conclue" ? "Vente conclue enregistrée." : "Prix enregistré." };
  });
}
