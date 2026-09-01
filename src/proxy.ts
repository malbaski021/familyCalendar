import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

// Routes that require an authenticated user. Paths are checked AFTER the
// locale prefix has been stripped (e.g. `/en/calendar` is matched as
// `/calendar`).
const PROTECTED_PATHS = ['/calendar', '/settings', '/admin', '/onboarding', '/profile', '/audit'];

// Routes that should redirect to /calendar when the user is already signed in
// (logged-in users should not see login forms again).
// `/signup` is absent on purpose — registration is invite-only, so the route
// no longer exists. Invite acceptance lives under `/invite/[role]/[token]`,
// which must stay reachable while signed out and is therefore not listed here.
const GUEST_ONLY_PATHS = ['/login', '/forgot-password'];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/** The locale prefix already present in the URL, or the default when there is none. */
function localeFromPath(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return locale;
  }
  return routing.defaultLocale;
}

export default async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session (sets cookies on the response).
  const { user, response: authResponse } = await updateSession(request);

  // 2. Apply auth guards based on the path (locale-agnostic).
  const pathWithoutLocale = stripLocale(request.nextUrl.pathname);
  // Keep the visitor in the locale they were already browsing — redirecting a
  // `/sr-Latn/...` request to `/en/login` would silently switch their language.
  const locale = localeFromPath(request.nextUrl.pathname);
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`),
  );
  const isGuestOnly = GUEST_ONLY_PATHS.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`),
  );

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}/login`;
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isGuestOnly && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}/calendar`;
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
