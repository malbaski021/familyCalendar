import type { EventCategory } from '@/lib/calendar/query';

interface CategoryStyle {
  emoji: string;
  // Tailwind class fragments. Background is muted; border is the accent.
  chipClass: string;
  dotClass: string;
}

export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  birthday: {
    emoji: '🎂',
    chipClass: 'bg-pink-50 text-pink-900 border-pink-300 dark:bg-pink-950 dark:text-pink-100',
    dotClass: 'bg-pink-500',
  },
  performance: {
    emoji: '🎭',
    chipClass:
      'bg-purple-50 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-100',
    dotClass: 'bg-purple-500',
  },
  match: {
    emoji: '⚽',
    chipClass: 'bg-green-50 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-100',
    dotClass: 'bg-green-500',
  },
  school: {
    emoji: '🎒',
    chipClass: 'bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-100',
    dotClass: 'bg-blue-500',
  },
  doctor: {
    emoji: '🩺',
    chipClass: 'bg-red-50 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100',
    dotClass: 'bg-red-500',
  },
  other: {
    emoji: '📌',
    chipClass: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100',
    dotClass: 'bg-slate-500',
  },
};
