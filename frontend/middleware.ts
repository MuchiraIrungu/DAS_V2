import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const roleRoutes: Record<string, string[]> = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

export function middleware(request: NextRequest) {
  const sessionid = request.cookies.get("sessionid")?.value;
  const userRole = request.cookies.get("user_role")?.value;
  const { pathname } = request.nextUrl;

  // 1. Always allow access to login and unauthorized pages to avoid loops
  if (pathname.startsWith("/auth") || pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // 2. Redirect root to login (or dashboard if session exists)
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = sessionid ? "/dashboard" : "/auth/login";
    return NextResponse.redirect(url);
  }

  // 3. Protect all other routes
  if (!sessionid) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // 4. Role-based Access Control (RBAC)
  const allowedRoutes = roleRoutes[userRole || ""] || [];
  const isAllowed = allowedRoutes.some((route) => pathname.startsWith(route));

  if (!isAllowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on pages, not static assets or icons
  matcher: [
    "/",
    "/dashboard/:path*",
    "/attendance/:path*",
    "/reports/:path*",
    "/students/:path*",
    "/unauthorized",
  ],
};