import { describe, it, expect } from 'vitest';
import { formatDateParam, parseDate, parseView, rangeForView, stepAnchor } from './view';

describe('parseView', () => {
  it('returns month by default when missing or invalid', () => {
    expect(parseView(undefined)).toBe('month');
    expect(parseView('quarterly')).toBe('month');
  });

  it.each(['month', 'week', 'day'] as const)('accepts %s', (v) => {
    expect(parseView(v)).toBe(v);
  });

  it('rejects arrays (only single values are valid query params here)', () => {
    expect(parseView(['week'])).toBe('month');
  });
});

describe('parseDate', () => {
  const reference = new Date(2026, 4, 29); // 2026-05-29 local

  it('falls back to today when missing', () => {
    const d = parseDate(undefined, reference);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(0);
  });

  it('parses ISO yyyy-MM-dd', () => {
    const d = parseDate('2026-03-15', reference);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });

  it('falls back to today on garbage', () => {
    const d = parseDate('not-a-date', reference);
    expect(d.getDate()).toBe(29);
  });
});

describe('formatDateParam', () => {
  it('emits ISO date-only', () => {
    expect(formatDateParam(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('rangeForView', () => {
  it('month range covers the surrounding Mon..Sun grid', () => {
    // 2026-05-29 → month range should be Mon Apr 27..Sun May 31
    const range = rangeForView('month', new Date(2026, 4, 29));
    expect(range.start.getMonth()).toBe(3); // April
    expect(range.start.getDate()).toBe(27);
    expect(range.start.getDay()).toBe(1); // Monday
    expect(range.end.getMonth()).toBe(4); // May
    expect(range.end.getDate()).toBe(31);
    expect(range.end.getDay()).toBe(0); // Sunday
  });

  it('week range is Mon..Sun of the anchor week', () => {
    // 2026-05-29 is a Friday; week range is Mon May 25..Sun May 31
    const range = rangeForView('week', new Date(2026, 4, 29));
    expect(range.start.getDate()).toBe(25);
    expect(range.start.getDay()).toBe(1);
    expect(range.end.getDate()).toBe(31);
    expect(range.end.getDay()).toBe(0);
  });

  it('day range is the same day, midnight to 23:59', () => {
    const range = rangeForView('day', new Date(2026, 4, 29, 12, 0));
    expect(range.start.getDate()).toBe(29);
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getDate()).toBe(29);
    expect(range.end.getHours()).toBe(23);
  });
});

describe('stepAnchor', () => {
  const anchor = new Date(2026, 4, 29);

  it('month +1 / -1 jumps a month', () => {
    expect(stepAnchor('month', anchor, 1).getMonth()).toBe(5);
    expect(stepAnchor('month', anchor, -1).getMonth()).toBe(3);
  });

  it('week +1 / -1 jumps 7 days', () => {
    expect(stepAnchor('week', anchor, 1).getDate()).toBe(5); // June 5
    expect(stepAnchor('week', anchor, -1).getDate()).toBe(22);
  });

  it('day +1 / -1 jumps one day', () => {
    expect(stepAnchor('day', anchor, 1).getDate()).toBe(30);
    expect(stepAnchor('day', anchor, -1).getDate()).toBe(28);
  });
});
