import type { SupabaseClient } from "@supabase/supabase-js";
import type { FxRate } from "./format";

export async function getLatestFx(supabase: SupabaseClient): Promise<FxRate> {
  const { data } = await supabase
    .from("fx_rates").select("rate_date, jpy_per_eur").order("rate_date", { ascending: false }).limit(1).maybeSingle();
  return data ? { rate_date: data.rate_date, jpy_per_eur: Number(data.jpy_per_eur) } : null;
}
