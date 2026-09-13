import { redirect } from "next/navigation";
import { getSession, SessionPayload } from "@/lib/session";

/**
 * Ensures a user is authenticated, redirecting to /login if not.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect("/login");
  }
  return session;
}

/**
 * Ensures the authenticated user has a specific role (e.g. "SUPER_ADMIN").
 * Redirects to / if the user is authenticated but does not possess the required role.
 */
export async function requireRole(
  requiredRole: "SUPER_ADMIN" | "MEMBER" | string
): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== requiredRole) {
    redirect("/");
  }
  return session;
}

/**
 * Checks if the current session belongs to a Super Admin.
 */
export function isSuperAdmin(session?: SessionPayload | null): boolean {
  return session?.role === "SUPER_ADMIN";
}
