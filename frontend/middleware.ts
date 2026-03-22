import { NextResponse } from "next/server";
import { NextRequest } from "next/server";


const roleRoutes: Record<string, string[]> ={
    admin: ["/dashboard", "/attendance", "/reports", "/students"],
    teacher: ["/dashboard","/attendance", "/students"],
}
export function middleware(request:NextRequest){

    const sessionid = request.cookies.get('sessionid')?.value;
    const userRole = request.cookies.get('user_role')?.value;
    const pathName = request.nextUrl.pathname;

    if (pathName === "/") {
        return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    if (!sessionid){
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const allowedRoutes = roleRoutes[userRole || ""] || [];
    const isAllowed = allowedRoutes.some((route) => pathName.startsWith(route));

    if (!isAllowed){
        return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher:['/','/dashboard','/attendance','/reports','/students'],
}