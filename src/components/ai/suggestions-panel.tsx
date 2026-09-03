'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangleIcon, SparklesIcon } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  processAiTaskAction,
  readQueuedSuggestionsAction,
  requestSuggestionsAction,
} from '@/lib/ai/actions';
import {
  applyCategoryAction,
  applyChildrenAction,
  dismissSuggestionAction,
  saveRemindersAction,
} from '@/lib/ai/suggestion-actions';
import type { AiSuggestions } from '@/lib/ai/schemas';

interface Props {
  eventId: string;
  /** Current values, so a suggestion that matches what is already set is not
   *  shown at all — repeating the user's own choice back at them is noise. */
  currentCategory: string;
  currentChildIds: string[];
  /** The family's children, so an accepted tag can be recorded in the notes by
   *  name. The suggestion itself only carries ids. */
  familyChildren: { id: string; name: string }[];
}

type Section = 'duplicate' | 'category' | 'children' | 'reminders';

type State =
  | { kind: 'loading' }
  | { kind: 'queued' }
  | { kind: 'ready'; suggestions: AiSuggestions }
  /** No key, or a request the API refused — nothing to wait for, so the panel
   *  renders nothing rather than explaining an outage to a family. */
  | { kind: 'hidden' };

export function SuggestionsPanel({
  eventId,
  currentCategory,
  currentChildIds,
  familyChildren,
}: Props) {
  const t = useTranslations('ai');
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [dismissed, setDismissed] = useState<Set<Section>>(new Set());
  const [checkedReminders, setCheckedReminders] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  // The request costs a Groq call against a daily quota, so it must fire once
  // per mount even though effects run twice in development.
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    void (async () => {
      const result = await requestSuggestionsAction({ eventId });

      if (result.status === 'ready') {
        setState({ kind: 'ready', suggestions: result.suggestions });
        setCheckedReminders(
          new Set(result.suggestions.reminders.suggestions.map((r) => r.minutesBefore)),
        );
        return;
      }

      if (result.status === 'unavailable' || !result.taskId) {
        setState({ kind: 'hidden' });
        return;
      }

      // Queued: drive it now rather than waiting for the cron. The claim is
      // atomic, so racing another tab is harmless — one of them does the work.
      setState({ kind: 'queued' });
      const taskId = result.taskId;
      await processAiTaskAction({ taskId });
      const settled = await readQueuedSuggestionsAction({ taskId });

      if (settled.status === 'ready') {
        setState({ kind: 'ready', suggestions: settled.suggestions });
        setCheckedReminders(
          new Set(settled.suggestions.reminders.suggestions.map((r) => r.minutesBefore)),
        );
      } else if (settled.status === 'unavailable') {
        setState({ kind: 'hidden' });
      }
      // Still queued: the push notification will announce it when it lands.
    })();
  }, [eventId]);

  const dismiss = useCallback(
    (section: Section) => {
      setDismissed((prev) => new Set(prev).add(section));
      void dismissSuggestionAction({ eventId, kind: section });
    },
    [eventId],
  );

  function run(section: Section, action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      // Defensive: a server action that throws — or a deploy mid-transition
      // that resolves it to nothing — must surface as a toast, not as an
      // uncaught exception inside the transition that takes the panel down.
      try {
        const result = await action();
        if (result?.ok) {
          setDismissed((prev) => new Set(prev).add(section));
          toast.success(t('applied'));
          router.refresh();
          return;
        }
        toast.error(result?.error ?? t('failed'));
      } catch {
        toast.error(t('failed'));
      }
    });
  }

  if (state.kind === 'hidden') return null;

  if (state.kind === 'loading' || state.kind === 'queued') {
    return (
      <section
        className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm"
        data-testid="ai-suggestions-pending"
      >
        <SparklesIcon className="size-4 animate-pulse" />
        {state.kind === 'loading' ? t('thinking') : t('queued')}
      </section>
    );
  }

  const { duplicates, categorization, reminders, userMessage } = state.suggestions;

  const showDuplicate =
    !dismissed.has('duplicate') && duplicates.isDuplicate && !!duplicates.matchEventId;
  const showCategory = !dismissed.has('category') && categorization.category !== currentCategory;
  const untaggedChildIds = categorization.childIds.filter((id) => !currentChildIds.includes(id));
  const showChildren = !dismissed.has('children') && untaggedChildIds.length > 0;
  const showReminders = !dismissed.has('reminders') && reminders.suggestions.length > 0;

  const namesFor = (ids: string[]) =>
    ids.map((id) => familyChildren.find((c) => c.id === id)?.name ?? id).join(', ');

  // Everything either applied or waved away — no empty shell.
  if (!showDuplicate && !showCategory && !showChildren && !showReminders) {
    return null;
  }

  return (
    <section className="grid gap-3 rounded-lg border p-3" data-testid="ai-suggestions">
      <header className="flex items-center gap-2 text-sm font-medium">
        <SparklesIcon className="size-4" />
        {t('heading')}
      </header>

      {userMessage && <p className="text-muted-foreground text-xs">{userMessage}</p>}

      {showDuplicate && (
        <div
          className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm dark:border-amber-900 dark:bg-amber-950"
          data-testid="ai-suggestion-duplicate"
        >
          <p className="flex items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              {t('duplicate.title')}
              {duplicates.reason && (
                <span className="text-muted-foreground block text-xs">{duplicates.reason}</span>
              )}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/calendar/${duplicates.matchEventId}`}
                data-testid="ai-suggestion-duplicate-open-link"
              >
                {t('duplicate.open')}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismiss('duplicate')}
              data-testid="ai-suggestion-duplicate-dismiss-button"
            >
              {t('dismiss')}
            </Button>
          </div>
        </div>
      )}

      {showCategory && (
        <SuggestionRow
          label={t('category.label', { category: t(`categories.${categorization.category}`) })}
          testId="ai-suggestion-category"
          onAccept={() =>
            run('category', () =>
              applyCategoryAction({
                eventId,
                category: categorization.category,
                // Recorded in the event's notes so the family can see what was
                // added and that it came from a suggestion.
                note: t('note.category', {
                  category: t(`categories.${categorization.category}`),
                }),
              }),
            )
          }
          onDismiss={() => dismiss('category')}
          disabled={isPending}
          acceptLabel={t('accept')}
          dismissLabel={t('dismiss')}
        />
      )}

      {showChildren && (
        <SuggestionRow
          label={t('children.label', { count: untaggedChildIds.length })}
          testId="ai-suggestion-children"
          onAccept={() =>
            run('children', () =>
              applyChildrenAction({
                eventId,
                childIds: untaggedChildIds,
                note: t('note.children', { names: namesFor(untaggedChildIds) }),
              }),
            )
          }
          onDismiss={() => dismiss('children')}
          disabled={isPending}
          acceptLabel={t('accept')}
          dismissLabel={t('dismiss')}
        />
      )}

      {showReminders && (
        <div className="grid gap-2 text-sm" data-testid="ai-suggestion-reminders">
          <p>{t('reminders.label')}</p>
          <ul className="grid gap-1">
            {reminders.suggestions.map((r) => {
              const id = `ai-reminder-${r.minutesBefore}`;
              return (
                <li key={r.minutesBefore}>
                  <label htmlFor={id} className="flex items-center gap-2 text-xs">
                    <input
                      id={id}
                      type="checkbox"
                      className="size-4"
                      checked={checkedReminders.has(r.minutesBefore)}
                      onChange={(e) =>
                        setCheckedReminders((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.minutesBefore);
                          else next.delete(r.minutesBefore);
                          return next;
                        })
                      }
                      data-testid={`ai-suggestion-reminder-${r.minutesBefore}-checkbox`}
                    />
                    <span>{r.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={isPending || checkedReminders.size === 0}
              onClick={() =>
                run('reminders', () =>
                  saveRemindersAction({
                    eventId,
                    minutesBefore: [...checkedReminders],
                    note: t('note.reminders', {
                      reminders: reminders.suggestions
                        .filter((r) => checkedReminders.has(r.minutesBefore))
                        .map((r) => r.label)
                        .join(', '),
                    }),
                  }),
                )
              }
              data-testid="ai-suggestion-reminders-save-button"
            >
              {t('reminders.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismiss('reminders')}
              data-testid="ai-suggestion-reminders-dismiss-button"
            >
              {t('dismiss')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SuggestionRow({
  label,
  testId,
  onAccept,
  onDismiss,
  disabled,
  acceptLabel,
  dismissLabel,
}: {
  label: string;
  testId: string;
  onAccept: () => void;
  onDismiss: () => void;
  disabled: boolean;
  acceptLabel: string;
  dismissLabel: string;
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-2 text-sm')}
      data-testid={testId}
    >
      <span>{label}</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={disabled}
          onClick={onAccept}
          data-testid={`${testId}-accept-button`}
        >
          {acceptLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={onDismiss}
          data-testid={`${testId}-dismiss-button`}
        >
          {dismissLabel}
        </Button>
      </div>
    </div>
  );
}
