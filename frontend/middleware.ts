import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionid = request.cookies.get("sessionid")?.value;
  const pathName = request.nextUrl.pathname;

  if (pathName === "/") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (pathName.startsWith("/auth") || pathName === "/unauthorized") {
    return NextResponse.next();
  }

  if (!sessionid) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/attendance/:path*", "/reports/:path*", "/students/:path*"],
};