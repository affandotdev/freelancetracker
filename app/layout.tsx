import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Project Tracker - Freelance Workspace",
  description: "Track freelance deliverables, client contacts, and project revenue.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-blue-500 selection:text-white"
        suppressHydrationWarning
      >
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 font-extrabold text-base sm:text-lg text-slate-900 hover:text-blue-600 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20">
                PT
              </div>
              <span>Project Tracker</span>
            </Link>

            {/* User Info & Actions */}
            {session && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{session.username}</span>
                </div>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="text-xs font-bold px-3 py-1.5 text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 bg-white/50">
          <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>Project Tracker • Personal Freelance Suite</p>
            <p className="text-slate-400">PostgreSQL (Neon) • Next.js 14</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
