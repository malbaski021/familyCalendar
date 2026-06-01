'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import { eventInputSchema, type EventInput } from '@/lib/calendar/event-schema';
import { createEventAction, updateEventAction } from '@/lib/calendar/event-actions';
import type { EventCategory } from '@/lib/calendar/query';

interface Child {
  id: string;
  name: string;
}

interface Props {
  mode: 'create' | 'edit';
  eventId?: string;
  initial?: Partial<EventInput>;
  // Renamed to avoid clashing with React's reserved `children` prop.
  familyChildren: Child[];
}

const CATEGORY_KEYS = Object.keys(CATEGORY_STYLES) as EventCategory[];

function defaultValues(initial: Partial<EventInput> | undefined): EventInput {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: initial?.title ?? '',
    category: initial?.category ?? 'other',
    allDay: initial?.allDay ?? false,
    startDate: initial?.startDate ?? today,
    endDate: initial?.endDate ?? null,
    startTime: initial?.startTime ?? '09:00',
    endTime: initial?.endTime ?? '10:00',
    location: initial?.location ?? '',
    notes: initial?.notes ?? '',
    childIds: initial?.childIds ?? [],
    recurrence: initial?.recurrence ?? 'none',
    recurringEndDate: initial?.recurringEndDate ?? null,
  };
}

export function EventForm({ mode, eventId, initial, familyChildren }: Props) {
  const t = useTranslations('events.form');
  const tCat = useTranslations('events.categories');
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<EventInput>({
    // Cast bridges a typing mismatch between Zod's refined-schema output
    // and react-hook-form's Resolver generic when nullable.optional fields
    // are involved. Runtime behaviour is unaffected.
    resolver: zodResolver(eventInputSchema) as unknown as Resolver<EventInput>,
    defaultValues: defaultValues(initial),
  });

  const allDay = form.watch('allDay');
  const recurrence = form.watch('recurrence');

  // Broadcast the current form values so the (optional) `EditLockShell`
  // wrapping us in edit mode can save them as a draft when the lock
  // expires. The shell listens via `window.addEventListener`.
  const allValues = form.watch();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('event-form:values', { detail: allValues }));
  }, [allValues]);

  function onSubmit(values: EventInput) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createEventAction(values)
          : await updateEventAction({ id: eventId!, input: values });
      if (result.ok) {
        toast.success(mode === 'create' ? t('created') : t('updated'));
        if (mode === 'edit' && eventId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('event-form:submitted', { detail: { eventId } }));
        }
        router.replace(mode === 'create' ? '/calendar' : `/calendar/${result.data.id}`);
        router.refresh();
      } else {
        setServerError(result.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" data-testid="event-form">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('title')}</FormLabel>
              <FormControl>
                <Input autoComplete="off" data-testid="event-form-title-input" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('category')}</FormLabel>
              <FormControl>
                <select
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  data-testid="event-form-category-select"
                >
                  {CATEGORY_KEYS.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_STYLES[cat].emoji} {tCat(cat)}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                form.setValue('allDay', e.target.checked);
                if (e.target.checked) {
                  form.setValue('startTime', null);
                  form.setValue('endTime', null);
                } else {
                  form.setValue('startTime', '09:00');
                  form.setValue('endTime', '10:00');
                }
              }}
              data-testid="event-form-all-day-checkbox"
            />
            {t('allDay')}
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('startDate')}</FormLabel>
                <FormControl>
                  <Input type="date" data-testid="event-form-start-date-input" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Controller
            control={form.control}
            name="endDate"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('endDate')}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    data-testid="event-form-end-date-input"
                  />
                </FormControl>
                {fieldState.error?.message && (
                  <p className="text-destructive text-sm">{fieldState.error.message}</p>
                )}
              </FormItem>
            )}
          />
        </div>

        {!allDay && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="startTime"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('startTime')}</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      data-testid="event-form-start-time-input"
                    />
                  </FormControl>
                  {fieldState.error?.message && (
                    <p className="text-destructive text-sm">{fieldState.error.message}</p>
                  )}
                </FormItem>
              )}
            />
            <Controller
              control={form.control}
              name="endTime"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('endTime')}</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      data-testid="event-form-end-time-input"
                    />
                  </FormControl>
                  {fieldState.error?.message && (
                    <p className="text-destructive text-sm">{fieldState.error.message}</p>
                  )}
                </FormItem>
              )}
            />
          </div>
        )}

        <Controller
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('location')}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  data-testid="event-form-location-input"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Controller
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notes')}</FormLabel>
              <FormControl>
                <textarea
                  className="border-input bg-background min-h-[80px] rounded-md border px-3 py-2 text-sm"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  data-testid="event-form-notes-input"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {familyChildren.length > 0 && (
          <Controller
            control={form.control}
            name="childIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('children')}</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {familyChildren.map((c) => {
                    const checked = field.value.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...field.value, c.id]
                              : field.value.filter((id) => id !== c.id);
                            field.onChange(next);
                          }}
                          data-testid={`event-form-child-${c.id}-checkbox`}
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </FormItem>
            )}
          />
        )}

        <Controller
          control={form.control}
          name="recurrence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('recurrence')}</FormLabel>
              <FormControl>
                <select
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  data-testid="event-form-recurrence-select"
                >
                  <option value="none">{t('recurrenceNone')}</option>
                  <option value="daily">{t('recurrenceDaily')}</option>
                  <option value="weekly">{t('recurrenceWeekly')}</option>
                  <option value="monthly">{t('recurrenceMonthly')}</option>
                </select>
              </FormControl>
            </FormItem>
          )}
        />

        {recurrence !== 'none' && (
          <Controller
            control={form.control}
            name="recurringEndDate"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('recurringEndDate')}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    data-testid="event-form-recurring-end-date-input"
                  />
                </FormControl>
                {fieldState.error?.message && (
                  <p className="text-destructive text-sm">{fieldState.error.message}</p>
                )}
                <p className="text-muted-foreground text-xs">{t('recurringEndDateHint')}</p>
              </FormItem>
            )}
          />
        )}

        {serverError && (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
            data-testid="event-form-cancel-button"
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isPending} data-testid="event-form-submit-button">
            {isPending ? t('submitting') : mode === 'create' ? t('create') : t('save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
