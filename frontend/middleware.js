import { NextResponse } from 'next/server';

export function middleware(request) {
  // If this fails, the problem is your Project Environment/Dependencies, 
  // not your code logic.
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};