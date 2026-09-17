import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import NotificationDropdown from "@/components/NotificationDropdown";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "WorkPlan — Deliverables & Revenue Tracker",
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('workplan_theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col bg-surface text-ink antialiased selection:bg-accent selection:text-white"
        suppressHydrationWarning
      >
        {/* Navigation */}
        <header className="bg-white border-b border-border sticky top-0 z-40 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
            {/* Wordmark */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2.5 text-ink hover:opacity-80 transition-opacity"
              >
                <span className="font-semibold text-base tracking-tight">
                  WorkPlan
                </span>
              </Link>

              {/* Navigation links */}
              {session && (
                <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-border">
                  <Link
                    href="/"
                    className="px-3 py-1.5 rounded-md text-[13px] font-medium text-gray-600 hover:text-accent hover:bg-gray-50 transition-colors"
                  >
                    {isSuperAdmin ? "Dashboard" : "My Tasks"}
                  </Link>

                  <Link
                    href="/issues"
                    className="px-3 py-1.5 rounded-md text-[13px] font-medium text-gray-600 hover:text-accent hover:bg-gray-50 transition-colors"
                  >
                    Issues
                  </Link>

                  <Link
                    href="/meetings"
                    className="px-3 py-1.5 rounded-md text-[13px] font-medium text-gray-600 hover:text-accent hover:bg-gray-50 transition-colors"
                  >
                    Meetings
                  </Link>

                  {isSuperAdmin && (
                    <>
                      <Link
                        href="/team"
                        className="px-3 py-1.5 rounded-md text-[13px] font-medium text-gray-600 hover:text-accent hover:bg-gray-50 transition-colors"
                      >
                        Team
                      </Link>
                      <Link
                        href="/accounts"
                        className="px-3 py-1.5 rounded-md text-[13px] font-medium text-gray-600 hover:text-accent hover:bg-gray-50 transition-colors"
                      >
                        Accounts
                      </Link>
                      <Link
                        href="/commissions"
                        className="px-3 py-1.5 rounded-md text-[13px] font-medium text-gray-600 hover:text-accent hover:bg-gray-50 transition-colors"
                      >
                        Commissions
                      </Link>
                      <Link
                        href="/objections"
                        className="px-3 py-1.5 rounded-md text-[13px] font-medium text-gray-600 hover:text-accent hover:bg-gray-50 transition-colors"
                      >
                        Objections
                      </Link>
                      <Link
                        href="/projects/new"
                        className="ml-2 px-3 py-1.5 rounded-md text-[13px] font-medium text-white bg-accent hover:bg-blue-700 transition-colors"
                      >
                        + New Project
                      </Link>
                    </>
                  )}
                </nav>
              )}
            </div>

            {/* Theme Toggle & User Info */}
            <div className="flex items-center gap-3 sm:gap-4">
              <ThemeToggle />

              {session && (
                <>
                  <NotificationDropdown userRole={session.role} />

                  <div className="h-4 w-px bg-border hidden sm:block" />

                  <div className="flex items-center gap-2 text-[13px] text-gray-600">
                    <span className="font-medium text-ink">
                      {session.name || session.email}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-[12px] text-gray-400 font-medium">
                      {isSuperAdmin ? "Admin" : "Member"}
                    </span>
                  </div>

                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="text-[13px] font-medium text-gray-500 hover:text-signal-red transition-colors cursor-pointer"
                    >
                      Log out
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-5 text-center text-[12px] text-gray-400 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p>&copy; WorkPlan</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
