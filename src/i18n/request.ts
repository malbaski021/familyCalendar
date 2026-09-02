import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Reference point for `format.relativeTime()`. Without it next-intl falls
    // back to the current time at each call site and warns, because server and
    // client would each pick their own "now" and disagree on hydration.
    // Fixed per request, so every relative timestamp on a page is measured
    // from the same instant. `<NextIntlClientProvider>` inherits it, so client
    // components get the same value.
    now: new Date(),
  };
});
