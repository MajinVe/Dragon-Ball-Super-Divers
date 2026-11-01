import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Moteur de veille : lit les sources configurées une fois, n'enregistre que le titre,
 * la date, le lien (et le prix pour les boutiques), et propose chaque nouveauté à la
 * validation. Respecte robots.txt et ne contourne aucune protection.
 */

type Source = {
  id: string; name: string; url: string; parser: "dbsdv_news" | "rss" | "shopify" | "page";
  keywords: string | null; currency: "JPY" | "EUR" | "USD"; reliability: string; last_scan_at: string | null;
};
type Found = {
  kind: string; title: string; url: string; image_url?: string | null; published_at?: string | null;
  tags?: string[]; price?: number | null; currency?: string | null; available?: boolean | null; hash: string;
};

const UA = "SuperDiversWatch/1.0 (veille personnelle, 1 lecture par jour)";
const decode = (t: string) =>
  t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

async function allowedByRobots(url: URL) {
  try {
    const res = await fetch(new URL("/robots.txt", url), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return true;
    const lines = (await res.text()).split(/\r?\n/);
    let applies = false;
    const disallow: string[] = [];
    for (const raw of lines) {
      const line = raw.split("#")[0].trim();
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*" || /superdiverswatch/i.test(v);
      else if (applies && /^disallow$/i.test(k) && v) disallow.push(v);
    }
    return !disallow.some((p) => url.pathname.startsWith(p));
  } catch {
    return true;
  }
}

function classify(title: string, tags: string[] = []) {
  if (/アドバンスパック|advance\s*pack/i.test(title)) return "advance_pack";
  if (/ファーストパック|first\s*pack/i.test(title)) return "produit";
  if (/\d+弾(の)?(稼働|最新ゲーム情報|カードリスト|ラインナップ)|新弾/.test(title)) return "nouvelle_serie";
  if (tags.includes("event") || /大会|イベント|カップ/.test(title)) return "evenement";
  if (/受注|予約|発売|セット|グッズ|スリーブ/.test(title)) return "produit";
  return "annonce";
}

function parseDbsdvNews(html: string, base: URL): Found[] {
  const out: Found[] = [];
  for (const m of html.matchAll(/<li class="newsBoxCol([^"]*)"[^>]*data-tags="([^"]*)"[\s\S]*?<\/li>/g)) {
    const block = m[0];
    const href = block.match(/href="([^"]+)"/)?.[1];
    const title = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1];
    if (!href || !title) continue;
    const url = new URL(href, base).toString();
    const tags = m[2].split(",").map((t) => t.trim()).filter(Boolean);
    const t = decode(title.replace(/<[^>]+>/g, ""));
    out.push({
      kind: classify(t, tags), title: t, url, tags,
      published_at: block.match(/datetime="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null,
      image_url: (() => { const s = block.match(/<img[^>]+src="([^"]+)"/)?.[1]; return s ? new URL(s, base).toString() : null; })(),
      hash: url,
    });
  }
  return out;
}

function parseRss(xml: string): Found[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const g = (tag: string) => m[1].match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1];
    const title = decode(g("title") ?? "");
    const url = decode(g("link") ?? "");
    const date = g("pubDate");
    return { kind: classify(title), title, url, published_at: date ? new Date(date).toISOString().slice(0, 10) : null, hash: url };
  }).filter((f) => f.title && f.url);
}

function parsePage(html: string, base: URL): Found[] {
  const out: Found[] = [];
  for (const m of html.matchAll(/<a[^>]+href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = decode(m[2].replace(/<[^>]+>/g, " "));
    if (title.length < 6) continue;
    const url = new URL(m[1], base).toString();
    out.push({ kind: classify(title), title, url, hash: url });
  }
  return out;
}

async function scanShopify(base: URL, src: Source): Promise<Found[]> {
  const res = await fetch(new URL("/products.json?limit=250", base), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Flux produits indisponible (HTTP ${res.status})`);
  const json = (await res.json()) as { products: { handle: string; title: string; images?: { src: string }[]; variants: { price: string; available: boolean }[]; published_at?: string }[] };
  return json.products.map((p) => {
    const v = p.variants[0];
    const url = new URL(`/products/${p.handle}`, base).toString();
    const price = v ? Number(v.price) : null;
    return {
      kind: classify(p.title) === "advance_pack" ? "advance_pack" : "produit", title: p.title, url,
      image_url: p.images?.[0]?.src ?? null, price, currency: src.currency, available: v?.available ?? null,
      published_at: p.published_at?.slice(0, 10) ?? null,
      hash: `${url}|${price}|${v?.available ? 1 : 0}`,
    };
  });
}

export async function scanSource(supabase: SupabaseClient, src: Source) {
  const base = new URL(src.url);
  try {
    if (!(await allowedByRobots(base))) throw new Error("Lecture interdite par le robots.txt du site");
    let found: Found[];
    if (src.parser === "shopify") {
      found = await scanShopify(base, src);
    } else {
      const res = await fetch(base, { headers: { "user-agent": UA, "accept-language": "ja,fr;q=0.8" }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      found = src.parser === "dbsdv_news" ? parseDbsdvNews(body, base) : src.parser === "rss" ? parseRss(body) : parsePage(body, base);
    }
    const kws = (src.keywords ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (kws.length) found = found.filter((f) => kws.some((k) => f.title.toLowerCase().includes(k)));
    if (!src.last_scan_at) {
      // Premier passage : on ne propose que les nouveautés récentes, pas tout l'historique
      const limit = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
      found = found.filter((f) => !f.published_at || f.published_at >= limit);
    }
    found = found.slice(0, 120);

    let created = 0;
    if (found.length) {
      const { data, error } = await supabase.from("detections").upsert(
        found.map((f) => ({
          watch_source_id: src.id, kind: f.kind, title: f.title.slice(0, 500), url: f.url, image_url: f.image_url ?? null,
          published_at: f.published_at ?? null, tags: f.tags ?? [], price: f.price ?? null, currency: f.currency ?? null,
          available: f.available ?? null, reliability: src.reliability, content_hash: f.hash,
        })),
        { onConflict: "content_hash", ignoreDuplicates: true },
      ).select("id");
      if (error) throw new Error(error.message);
      created = data?.length ?? 0;
    }
    await supabase.from("watch_sources").update({ last_scan_at: new Date().toISOString(), last_error: null }).eq("id", src.id);
    return { source: src.name, found: found.length, created };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("watch_sources").update({ last_scan_at: new Date().toISOString(), last_error: message }).eq("id", src.id);
    return { source: src.name, error: message };
  }
}

export async function scanAll(supabase: SupabaseClient) {
  const { data: sources } = await supabase.from("watch_sources").select("*").eq("active", true);
  const results = [];
  for (const s of (sources ?? []) as Source[]) results.push(await scanSource(supabase, s));
  return results;
}
