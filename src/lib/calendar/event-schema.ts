import { z } from 'zod';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';

const CATEGORY_KEYS = Object.keys(CATEGORY_STYLES) as [
  keyof typeof CATEGORY_STYLES,
  ...(keyof typeof CATEGORY_STYLES)[],
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' });

const isoTime = z.string().regex(/^\d{2}:\d{2}$/, { message: 'Time must be HH:mm' });

export const RECURRENCE_VALUES = ['none', 'daily', 'weekly', 'monthly'] as const;
export type RecurrenceChoice = (typeof RECURRENCE_VALUES)[number];

export const eventInputSchema = z
  .object({
    title: z
      .string()
      .min(1, { message: 'Title is required' })
      .max(120, { message: 'Title must be at most 120 characters' }),
    category: z.enum(CATEGORY_KEYS),
    allDay: z.boolean(),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    startTime: isoTime.nullable().optional(),
    endTime: isoTime.nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    childIds: z.array(z.string().uuid()).default([]),
    recurrence: z.enum(RECURRENCE_VALUES).default('none'),
    recurringEndDate: isoDate.nullable().optional(),
  })
  .refine((data) => (data.endDate ? data.endDate >= data.startDate : true), {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      if (data.allDay) return true;
      if (!data.startTime || !data.endTime) return true;
      // Same-day timed event with both times → end must be after start.
      if (data.endDate && data.endDate !== data.startDate) return true;
      return data.endTime > data.startTime;
    },
    { message: 'End time must be after start time', path: ['endTime'] },
  )
  .refine((data) => (data.allDay ? !data.startTime && !data.endTime : true), {
    message: 'All-day events cannot have a time',
    path: ['startTime'],
  })
  .refine(
    (data) =>
      !data.recurringEndDate ||
      (data.recurrence !== 'none' && data.recurringEndDate >= data.startDate),
    {
      message: 'Recurring end date must be on or after the start date',
      path: ['recurringEndDate'],
    },
  );

export type EventInput = z.infer<typeof eventInputSchema>;
