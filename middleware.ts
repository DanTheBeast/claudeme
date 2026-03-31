import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect /friends, /schedule, /profile to / so the app can handle routing
  // This allows Universal Links to work properly
  if (pathname === '/friends' || pathname === '/friends/' ||
      pathname === '/schedule' || pathname === '/schedule/' ||
      pathname === '/profile' || pathname === '/profile/') {
    return NextResponse.rewrite(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/friends', '/friends/', '/schedule', '/schedule/', '/profile', '/profile/'],
};
