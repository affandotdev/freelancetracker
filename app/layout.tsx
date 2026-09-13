import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";

export const metadata: Metadata = {
  title: "WorkPlan • Freelance Team Deliverables & Revenue Tracker",
  description:
    "Track freelance client projects, team task assignments, blockers, and cashflow in real-time.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isSuperAdmin = session?.role === "SUPER_ADMIN";

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white"
        suppressHydrationWarning
      >
        {/* Modern Sticky Navigation */}
        <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            {/* Logo & Brand */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-3 font-extrabold text-base sm:text-lg text-slate-900 hover:opacity-90 transition-opacity"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-indigo-500/20 ring-1 ring-white/30">
                  WP
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-extrabold tracking-tight text-slate-900 text-sm sm:text-base">
                    WorkPlan
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest -mt-0.5">
                    {isSuperAdmin ? "Team Lead Suite" : "Worker Workspace"}
                  </span>
                </div>
              </Link>

              {/* Navigation links */}
              {session && (
                <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200">
                  <Link
                    href="/"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-100/80 transition-colors"
                  >
                    {isSuperAdmin ? "Dashboard" : "My Tasks"}
                  </Link>

                  {isSuperAdmin && (
                    <>
                      <Link
                        href="/team"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100/80 transition-colors"
                      >
                        Team
                      </Link>
                      <Link
                        href="/accounts"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/80 transition-colors"
                      >
                        Accounts
                      </Link>
                      <Link
                        href="/commissions"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-amber-600 hover:bg-amber-50/80 transition-colors"
                      >
                        Commissions
                      </Link>
                      <Link
                        href="/objections"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 transition-colors"
                      >
                        Objections
                      </Link>
                      <Link
                        href="/projects/new"
                        className="ml-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-2xs"
                      >
                        + New Project
                      </Link>
                    </>
                  )}
                </nav>
              )}
            </div>

            {/* User Info & Actions */}
            {session && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100/80 rounded-full text-xs font-semibold text-slate-700 border border-slate-200/60 shadow-2xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSuperAdmin ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-slate-800 font-bold truncate max-w-[140px] sm:max-w-[200px]">
                    {session.name || session.email}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                      isSuperAdmin
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {isSuperAdmin ? "Admin" : "Member"}
                  </span>
                </div>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="text-xs font-bold px-3 py-1.5 text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    Logout
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {children}
        </main>

        {/* Modern Clean Footer */}
        <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-400 bg-white/60 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="flex items-center gap-2">
              <span className="font-bold text-slate-600">WorkPlan</span>
              <span>• Team Deliverables, Task Assignment & Revenue Tracker</span>
            </p>
            <p className="text-slate-400">
              Role-Based Freelance Management • All data private & secure
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
