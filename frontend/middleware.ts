import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define roles and their allowed starting paths
const roleRoutes: Record<string, string[]> = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

export function middleware(request: NextRequest) {
  const sessionid = request.cookies.get("sessionid")?.value;
  const userRole = request.cookies.get("user_role")?.value;
  const { pathname } = request.nextUrl;

  // 1. PUBLIC PATHS: Allow these to skip middleware logic to prevent loops
  if (pathname.startsWith("/auth") || pathname === "/unauthorized" || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // 2. ROOT REDIRECT: Send home page users to login or dashboard
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = sessionid ? "/dashboard" : "/auth/login";
    return NextResponse.redirect(url);
  }

  // 3. AUTH GUARD: If no session, force login
  if (!sessionid) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // 4. ROLE GUARD (RBAC): Check if the user has permission for this path
  const allowedPaths = roleRoutes[userRole || ""] || [];
  const isAllowed = allowedPaths.some((path) => pathname.startsWith(path));

  if (!isAllowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// 5. MATCHER: Explicitly exclude static assets to save execution costs
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};