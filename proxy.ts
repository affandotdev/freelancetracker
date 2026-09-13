import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  const isLoginPage = pathname === "/login";

  // If user is not authenticated and attempts to access any route other than /login
  if (!session && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is already authenticated and visits /login, redirect to /
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Role-based Access Control:
  // If user is a MEMBER, restrict access to Super Admin routes:
  // /team, /objections, /projects (project management is Super Admin only)
  if (session && session.role !== "SUPER_ADMIN") {
    if (
      pathname.startsWith("/team") ||
      pathname.startsWith("/objections") ||
      pathname.startsWith("/projects")
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (e.g. .svg, .png)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
