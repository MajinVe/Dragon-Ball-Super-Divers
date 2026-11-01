"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { createClient } from "@/lib/supabase/server";

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; }
};

export async function saveBranding(_: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, message: "Session expirée, reconnecte-toi." };
  const { error } = await supabase.from("user_settings").upsert({
    user_id: uid, logo_url: clean(f.get("logo_url")), hero_image_url: clean(f.get("hero_image_url")),
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Habillage enregistré." };
}
