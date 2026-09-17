"use client";

import React, { useActionState } from "react";
import { loginAction } from "@/lib/actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm bg-white p-7 sm:p-8 border border-border rounded-lg shadow-xs space-y-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-ink text-white flex items-center justify-center font-bold text-sm mx-auto shadow-xs">
            WP
          </div>
          <h1 className="text-xl font-bold text-ink tracking-tight">
            Sign In to WorkPlan
          </h1>
          <p className="text-xs text-slate-500">
            Access your deliverables, team management & accounts ledger
          </p>
        </div>

        {state?.error && (
          <div className="p-3 bg-red-50 border border-red-200 text-signal-red text-xs font-medium rounded-lg">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Work Email / Username
            </label>
            <input
              type="text"
              name="email"
              required
              autoFocus
              placeholder="admin@workplan.dev or worker@example.com"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Authenticating..." : "Sign In to Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
