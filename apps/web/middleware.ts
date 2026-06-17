import { NextResponse } from 'next/server';
import { auth } from './auth';

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL('/signin', req.nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/account/:path*'],
};
