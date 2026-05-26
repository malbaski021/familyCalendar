import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

// Routes that require an authenticated user. Paths are checked AFTER the
// locale prefix has been stripped (e.g. `/en/calendar` is matched as
// `/calendar`).
const PROTECTED_PATHS = ['/calendar', '/settings'];

// Routes that should redirect to /calendar when the user is already signed in
// (logged-in users should not see login forms again).
const GUEST_ONLY_PATHS = ['/login', '/signup', '/forgot-password'];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

export default async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session (sets cookies on the response).
  const { user, response: authResponse } = await updateSession(request);

  // 2. Apply auth guards based on the path (locale-agnostic).
  const pathWithoutLocale = stripLocale(request.nextUrl.pathname);
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`),
  );
  const isGuestOnly = GUEST_ONLY_PATHS.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`),
  );

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${routing.defaultLocale}/login`;
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isGuestOnly && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${routing.defaultLocale}/calendar`;
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Let next-intl handle locale routing.
  const intlResponse = intlMiddleware(request);

  // Copy any cookies the Supabase client set onto the intl response so they
  // reach the browser even when intl rewrites/redirects.
  for (const cookie of authResponse.cookies.getAll()) {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
