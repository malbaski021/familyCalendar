import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('@/lib/notifications/actions', () => ({
  subscribeToPushAction: vi.fn(),
  unsubscribeFromPushAction: vi.fn(),
  sendTestPushAction: vi.fn(),
}));

import { PushToggle } from './push-toggle';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
}

/** iOS Safari only exposes PushManager once the site runs as an installed PWA. */
function withoutPushManager() {
  delete (window as unknown as Record<string, unknown>).PushManager;
}

function withPushManager() {
  (window as unknown as Record<string, unknown>).PushManager = class {};
}

function setStandalone(value: boolean) {
  Object.defineProperty(window.navigator, 'standalone', { value, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: value && query.includes('standalone'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const originalUa = navigator.userAgent;

describe('PushToggle — platform detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (navigator as unknown as Record<string, unknown>).serviceWorker = {
      getRegistration: vi.fn().mockResolvedValue(undefined),
      register: vi.fn(),
    };
  });

  afterEach(() => {
    setUserAgent(originalUa);
  });

  it('tells an iPhone in the browser how to install, not that push is unsupported', async () => {
    // The regression this guards: the capability probe used to run first, and
    // iOS Safari hides PushManager until the site is installed — so an iPhone
    // was told its browser cannot do push, which is both wrong and a dead end,
    // because installing is precisely what enables it.
    setUserAgent(IPHONE_UA);
    setStandalone(false);
    withoutPushManager();

    renderWithProviders(<PushToggle />);

    expect(await screen.findByTestId('push-status-ios-install')).toBeInTheDocument();
    expect(screen.queryByTestId('push-status-unsupported')).not.toBeInTheDocument();
  });

  it('still shows the install hint on an iPhone that does expose PushManager', async () => {
    setUserAgent(IPHONE_UA);
    setStandalone(false);
    withPushManager();

    renderWithProviders(<PushToggle />);
    expect(await screen.findByTestId('push-status-ios-install')).toBeInTheDocument();
  });

  it('reports unsupported on a desktop browser with no push API', async () => {
    setUserAgent(DESKTOP_UA);
    setStandalone(false);
    withoutPushManager();

    renderWithProviders(<PushToggle />);
    expect(await screen.findByTestId('push-status-unsupported')).toBeInTheDocument();
  });

  it('reports unsupported for an installed iOS PWA too old to have push', async () => {
    // Standalone, so past the install hint, but still no push API — iOS < 16.4.
    setUserAgent(IPHONE_UA);
    setStandalone(true);
    withoutPushManager();

    renderWithProviders(<PushToggle />);
    expect(await screen.findByTestId('push-status-unsupported')).toBeInTheDocument();
  });

  it('moves past platform checks for an installed iOS PWA with push', async () => {
    setUserAgent(IPHONE_UA);
    setStandalone(true);
    withPushManager();
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn() },
      configurable: true,
    });

    renderWithProviders(<PushToggle />);

    expect(await screen.findByTestId('push-subscribe-button')).toBeInTheDocument();
    expect(screen.queryByTestId('push-status-ios-install')).not.toBeInTheDocument();
    expect(screen.queryByTestId('push-status-unsupported')).not.toBeInTheDocument();
  });
});
