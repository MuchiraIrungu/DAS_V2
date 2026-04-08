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

  // Allow unauthorized page
  if (pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // Root redirect
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = sessionid ? "/dashboard" : "/auth/login";
    return NextResponse.redirect(url);
  }

  // Protect matched routes only
  if (!sessionid) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const allowedPaths = roleRoutes[userRole || ""] || [];
  const isAllowed = allowedPaths.some((path) => pathname.startsWith(path));

  if (!isAllowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/attendance/:path*",
    "/reports/:path*",
    "/students/:path*",
    "/unauthorized",
  ],
};