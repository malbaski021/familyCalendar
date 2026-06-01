import { describe, it, expect } from 'vitest';
import { eventInputSchema } from './event-schema';

const baseValid = {
  title: 'Test',
  category: 'other' as const,
  allDay: false,
  startDate: '2026-07-01',
  endDate: null,
  startTime: '09:00',
  endTime: '10:00',
  location: null,
  notes: null,
  childIds: [],
};

describe('eventInputSchema', () => {
  it('accepts a minimal single-day timed event', () => {
    const result = eventInputSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = eventInputSchema.safeParse({ ...baseValid, title: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/title/i);
  });

  it('rejects a bad ISO date', () => {
    const result = eventInputSchema.safeParse({ ...baseValid, startDate: '2026-13-01' });
    expect(result.success).toBe(false);
  });

  it('rejects end date before start date', () => {
    const result = eventInputSchema.safeParse({
      ...baseValid,
      startDate: '2026-07-10',
      endDate: '2026-07-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/end date/i);
  });

  it('rejects end time before start time on the same day', () => {
    const result = eventInputSchema.safeParse({
      ...baseValid,
      startTime: '14:00',
      endTime: '10:00',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/end time/i);
  });

  it('allows end time before start time when on different days', () => {
    const result = eventInputSchema.safeParse({
      ...baseValid,
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      startTime: '22:00',
      endTime: '02:00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects all-day event that also has a time', () => {
    const result = eventInputSchema.safeParse({
      ...baseValid,
      allDay: true,
      startTime: '09:00',
      endTime: '10:00',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an all-day event with no times', () => {
    const result = eventInputSchema.safeParse({
      ...baseValid,
      allDay: true,
      startTime: null,
      endTime: null,
    });
    expect(result.success).toBe(true);
  });
});
