import { NextResponse } from "next/server";

const roleRoutes = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

export default function middleware(request) {
  const sessionid = request.cookies.get("sessionid")?.value;
  const userRole = request.cookies.get("user_role")?.value;
  const { pathname } = request.nextUrl;

  // 1. Static/Auth Passthrough (Prevents infinite redirect loops)
  if (
    pathname.startsWith("/auth") || 
    pathname === "/unauthorized" || 
    pathname.startsWith("/_next") ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Root path handling
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = sessionid ? "/dashboard" : "/auth/login";
    return NextResponse.redirect(url);
  }

  // 3. Authentication Guard
  if (!sessionid) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // 4. Role-Based Access Control (RBAC)
  const allowed = roleRoutes[userRole] || [];
  const hasAccess = allowed.some(route => pathname.startsWith(route));

  if (!hasAccess) {
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