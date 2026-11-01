"use client";
import { useActionState } from "react";
import { Wordmark } from "@/components/wordmark";
import { signIn } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <form action={action} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-surface p-7">
        <Wordmark />
        <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Email</span>
          <input name="email" type="email" autoComplete="email" required
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-gold" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Mot de passe</span>
          <input name="password" type="password" autoComplete="current-password" required
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-gold" />
        </label>
        {error && <p role="alert" className="text-sm text-down">{error}</p>}
        <button disabled={pending}
          className="w-full rounded-lg bg-gold py-2.5 font-semibold text-[#16171a] transition-opacity disabled:opacity-60">
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
