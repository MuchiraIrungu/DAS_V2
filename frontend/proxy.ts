import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const roleRoutes: Record<string, string[]> = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userRole = request.cookies.get("user_role")?.value;

  // 1. Skip static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    /\.\w+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Allow auth and unauthorized pages
  if (pathname.startsWith("/auth") || pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // 3. Root redirect
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(userRole ? "/dashboard" : "/auth/login", request.url)
    );
  }

  // 4. No role = not logged in
  if (!userRole) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // 5. Role-based access
  const allowed = roleRoutes[userRole] || [];
  const isAllowed = allowed.some((route) => pathname.startsWith(route));

  if (!isAllowed) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
  ],
};