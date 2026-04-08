// proxy.ts   (must be at the same level as app/ folder)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const roleRoutes: Record<string, string[]> = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Always allow static assets, API routes, and _next files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")   // covers .png, .jpg, .css, etc.
  ) {
    return NextResponse.next();
  }

  // 2. Public routes (no protection)
  if (pathname.startsWith("/auth") || pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // 3. Get cookies safely
  const sessionid = request.cookies.get("sessionid")?.value;
  const userRole = request.cookies.get("user_role")?.value || "";

  // 4. Root path special handling
  if (pathname === "/") {
    if (!sessionid) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 5. Auth guard
  if (!sessionid) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // 6. Role-based guard
  const allowed = roleRoutes[userRole] || [];
  const isAllowed = allowed.some((route) => pathname.startsWith(route));

  if (!isAllowed) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  // 7. If everything is fine, continue
  return NextResponse.next();
}

// This is very important on Vercel
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};