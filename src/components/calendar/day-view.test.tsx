import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

// The event chips render next-intl `Link`s, which pull in the App Router
// navigation internals. The rows under test are plain markup, so a bare anchor
// stands in.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: unknown }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/calendar',
}));

import { DayView } from './day-view';
import type { CalendarEvent } from '@/lib/calendar/query';

// Guards a bug that only appeared in production: Vercel renders in UTC while
// the visitor's browser re-runs the same filter in its own zone. Comparing
// Date objects made a UTC+2 phone compute `parseISO('2026-09-03')` as
// 2026-09-02T22:00Z, so `anchor <= end` was false and a same-day event
// rendered on the server then vanished on hydration. Locally it never
// reproduced, because dev server and browser share a timezone.

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    occurrenceDate: '2026-09-03',
    title: 'Taša',
    category: 'other',
    startDate: '2026-09-03',
    endDate: null,
    startTime: '18:00',
    endTime: null,
    location: null,
    notes: null,
    recurring: false,
    lockedByOther: false,
    children: [],
    ...overrides,
  };
}

// The day is handed down as a plain `yyyy-MM-dd` string, so there is no
// instant to reinterpret and every timezone behaves identically.

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe('DayView — day matching is timezone-independent', () => {
  for (const tz of ['UTC', 'Europe/Belgrade', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    it(`shows a same-day timed event in ${tz}`, () => {
      process.env.TZ = tz;
      renderWithProviders(<DayView dayKey="2026-09-03" events={[event()]} />);

      expect(screen.queryByTestId('calendar-day-empty')).not.toBeInTheDocument();
      expect(screen.getByText('Taša')).toBeInTheDocument();
    });
  }

  it('shows an all-day event on its own day', () => {
    renderWithProviders(
      <DayView dayKey="2026-09-03" events={[event({ startTime: null, endTime: null })]} />,
    );
    expect(screen.getByText('Taša')).toBeInTheDocument();
  });

  it('does not show an event from the previous or next day', () => {
    const dayKey = '2026-09-03';
    for (const day of ['2026-09-02', '2026-09-04']) {
      const { unmount } = renderWithProviders(
        <DayView dayKey={dayKey} events={[event({ startDate: day, occurrenceDate: day })]} />,
      );
      expect(screen.getByTestId('calendar-day-empty')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('DayView — multi-day and recurring', () => {
  it('shows a multi-day event on every day it spans, including the middle', () => {
    const spanning = event({ startDate: '2026-09-01', endDate: '2026-09-05' });
    for (const day of ['2026-09-01', '2026-09-03', '2026-09-05']) {
      const { unmount } = renderWithProviders(<DayView dayKey={day} events={[spanning]} />);
      expect(screen.getByText('Taša')).toBeInTheDocument();
      unmount();
    }
  });

  it('excludes the day after a multi-day event ends', () => {
    renderWithProviders(
      <DayView
        dayKey="2026-09-06"
        events={[event({ startDate: '2026-09-01', endDate: '2026-09-05' })]}
      />,
    );
    expect(screen.getByTestId('calendar-day-empty')).toBeInTheDocument();
  });

  it('matches a recurring occurrence on its own date only', () => {
    const occurrence = event({
      recurring: true,
      startDate: '2026-06-01',
      occurrenceDate: '2026-09-03',
    });

    renderWithProviders(<DayView dayKey="2026-09-03" events={[occurrence]} />);
    expect(screen.getByText('Taša')).toBeInTheDocument();
  });

  it('does not match a recurring occurrence on a different date', () => {
    const occurrence = event({
      recurring: true,
      startDate: '2026-06-01',
      occurrenceDate: '2026-09-10',
    });

    renderWithProviders(<DayView dayKey="2026-09-03" events={[occurrence]} />);
    expect(screen.getByTestId('calendar-day-empty')).toBeInTheDocument();
  });
});
