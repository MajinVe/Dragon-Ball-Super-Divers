import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedItem } from "@/components/official-feed";
import { isAdmin } from "./admin";
import { scanSource, translatePending } from "./scanner";

/** Relit le site officiel si la dernière lecture date de plus de 6 heures (une seule requête). */
export async function refreshOfficialIfStale(supabase: SupabaseClient) {
  try {
    const { data: src } = await supabase.from("watch_sources").select("*").eq("parser", "dbsdv_news").eq("active", true).maybeSingle();
    if (!src) return;
    const age = src.last_scan_at ? Date.now() - new Date(src.last_scan_at).getTime() : Infinity;
    if (!(await isAdmin(supabase))) return;
    if (age > 6 * 3600 * 1000) await scanSource(supabase, src);
    await translatePending(supabase, 12);
  } catch {
    // la page s'affiche même si la lecture échoue
  }
}

export async function getOfficialFeed(supabase: SupabaseClient, limit = 12, kind?: string): Promise<FeedItem[]> {
  let q = supabase.from("detections").select("id, kind, title, title_fr, url, image_url, published_at, tags")
    .eq("reliability", "officiel").neq("status", "rejetee")
    .order("published_at", { ascending: false, nullsFirst: false }).order("detected_at", { ascending: false }).limit(limit);
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;
  return (data ?? []) as FeedItem[];
}
