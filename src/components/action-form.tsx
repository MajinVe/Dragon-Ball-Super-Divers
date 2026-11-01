"use client";
import { useActionState } from "react";

export type ActionState = { ok: boolean; message: string } | null;

export function ActionForm({
  action, submitLabel, children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      {children}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button disabled={pending} className="btn-main px-4 py-2.5 text-sm disabled:opacity-60">
          {pending ? "Enregistrement…" : submitLabel}
        </button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-up" : "text-down"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
