 // proxy.ts  (in project root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const roleRoutes: Record<string, string[]> = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

export function proxy(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [k, v] = c.split("=");
      return [k, v];
    })
  );

  const sessionid = cookies["sessionid"];
  const userRole = cookies["user_role"] || "";

  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (
    pathname.startsWith("/auth") ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||   // usually allow API routes too
    pathname.includes(".")           // static assets
  ) {
    return NextResponse.next();
  }

  // Root redirect
  if (pathname === "/") {
    if (!sessionid) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Auth guard
  if (!sessionid) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Role-based guard
  const allowed = roleRoutes[userRole] || [];
  const isAllowed = allowed.some((route) => pathname.startsWith(route));

  if (!isAllowed) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

// Optional: Limit which paths the proxy runs on (highly recommended to avoid running on every asset)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};