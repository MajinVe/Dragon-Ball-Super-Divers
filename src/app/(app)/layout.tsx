import { redirect } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const email = String(data.claims.email ?? "");
  const { data: settings } = await supabase.from("user_settings").select("logo_url").maybeSingle();
  const logoUrl = settings?.logo_url ?? null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar email={email} logoUrl={logoUrl} />
      <div className="min-w-0 flex-1">
        <MobileNav logoUrl={logoUrl} />
        <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
