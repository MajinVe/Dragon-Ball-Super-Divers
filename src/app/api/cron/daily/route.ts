import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export const dynamic = "force-dynamic";

/**
 * Tâche quotidienne (Vercel Cron) :
 *  1. récupère le taux de référence BCE EUR/JPY et EUR/USD ;
 *  2. calcule l'instantané quotidien des portefeuilles.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const report: Record<string, unknown> = {};

  const { data: source } = await supabase
    .from("sources").select("id").eq("url", ECB_URL).maybeSingle();
  const { data: run } = await supabase
    .from("collector_runs").insert({ source_id: source?.id ?? null }).select("id").single();

  try {
    const res = await fetch(ECB_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`BCE : HTTP ${res.status}`);
    const xml = await res.text();
    const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
    const jpy = xml.match(/currency=['"]JPY['"]\s+rate=['"]([\d.]+)['"]/)?.[1];
    const usd = xml.match(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/)?.[1];
    if (!date || !jpy) throw new Error("BCE : format de réponse inattendu");

    const { error } = await supabase.from("fx_rates").upsert({
      rate_date: date, jpy_per_eur: Number(jpy), usd_per_eur: usd ? Number(usd) : null, fetched_at: new Date().toISOString(),
    });
    if (error) throw error;
    report.fx = { date, jpy_per_eur: Number(jpy) };

    if (run) {
      await supabase.from("collector_runs").update({
        status: "succes", finished_at: new Date().toISOString(), items_found: 1,
      }).eq("id", run.id);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    report.fx_error = message;
    if (run) {
      await supabase.from("collector_runs").update({
        status: "echec", finished_at: new Date().toISOString(), error: message,
      }).eq("id", run.id);
    }
  }

  const { data: snapshots, error: snapErr } = await supabase.rpc("snapshot_portfolios");
  report.snapshots = snapErr ? `erreur : ${snapErr.message}` : snapshots;

  const failed = "fx_error" in report || snapErr;
  return NextResponse.json(report, { status: failed ? 500 : 200 });
}
