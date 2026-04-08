import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const roleRoutes: Record<string, string[]> = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

// Use a standard export default if the named export 'proxy' is failing
export default function proxy(request: NextRequest) {
  const sessionid = request.cookies.get("sessionid")?.value;
  const userRole = request.cookies.get("user_role")?.value;
  const { pathname } = request.nextUrl;

  // 1. Static/Auth Passthrough
  if (
    pathname.startsWith("/auth") || 
    pathname === "/unauthorized" || 
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  // 2. The "Fix" for your 404: Explicitly handle the root
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = sessionid ? "/dashboard" : "/auth/login";
    return NextResponse.redirect(url);
  }

  // 3. Auth Guard
  if (!sessionid) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // 4. RBAC
  const allowed = roleRoutes[userRole || ""] || [];
  if (!allowed.some(route => pathname.startsWith(route))) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

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