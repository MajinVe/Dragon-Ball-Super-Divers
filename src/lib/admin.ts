import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdmin(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
