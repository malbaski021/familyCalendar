import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';

vi.mock('@/lib/ai/actions', () => ({
  requestSuggestionsAction: vi.fn(),
  processAiTaskAction: vi.fn(),
  readQueuedSuggestionsAction: vi.fn(),
}));

vi.mock('@/lib/ai/suggestion-actions', () => ({
  applyCategoryAction: vi.fn(),
  applyChildrenAction: vi.fn(),
  addSuggestedChildAction: vi.fn(),
  saveRemindersAction: vi.fn(),
  dismissSuggestionAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: unknown }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { SuggestionsPanel } from './suggestions-panel';
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

function suggestions(overrides: Partial<AiSuggestions> = {}): AiSuggestions {
  return {
    duplicates: { isDuplicate: false, matchEventId: null, confidence: 0.1, reason: 'none' },
    categorization: { category: 'match', confidence: 0.9, childIds: [], newChildNames: [] },
    reminders: { suggestions: [] },
    userMessage: 'Looks like a football match.',
    ...overrides,
  } as AiSuggestions;
}

const PROPS = { eventId: 'evt-1', currentCategory: 'other', currentChildIds: [] as string[] };

function ready(s: AiSuggestions) {
  vi.mocked(requestSuggestionsAction).mockResolvedValue({ status: 'ready', suggestions: s });
}

describe('SuggestionsPanel — request lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks for suggestions exactly once per mount', async () => {
    // Each request spends a call against a daily free-tier quota, so a double
    // fire is a real cost, not just noise.
    ready(suggestions());
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    await waitFor(() => expect(screen.getByTestId('ai-suggestions')).toBeInTheDocument());
    expect(requestSuggestionsAction).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when suggestions are unavailable', async () => {
    vi.mocked(requestSuggestionsAction).mockResolvedValue({
      status: 'unavailable',
      reason: 'GROQ_API_KEY is not set',
    });
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    // A family should not be shown an outage notice for a hint they never asked for.
    await waitFor(() => {
      expect(screen.queryByTestId('ai-suggestions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ai-suggestions-pending')).not.toBeInTheDocument();
    });
  });

  it('drives a queued task and shows the result it produced', async () => {
    vi.mocked(requestSuggestionsAction).mockResolvedValue({
      status: 'queued',
      reason: 'no response within 3000ms',
      taskId: 'task-1',
    });
    vi.mocked(processAiTaskAction).mockResolvedValue({ status: 'done' });
    vi.mocked(readQueuedSuggestionsAction).mockResolvedValue({
      status: 'ready',
      suggestions: suggestions(),
    });

    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    await waitFor(() => expect(screen.getByTestId('ai-suggestions')).toBeInTheDocument());
    expect(processAiTaskAction).toHaveBeenCalledWith({ taskId: 'task-1' });
    // Reads the stored result rather than paying for a second Groq call.
    expect(readQueuedSuggestionsAction).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(requestSuggestionsAction).toHaveBeenCalledTimes(1);
  });

  it('stays in the waiting state when the task has not settled', async () => {
    vi.mocked(requestSuggestionsAction).mockResolvedValue({
      status: 'queued',
      reason: 'rate limited',
      taskId: 'task-1',
    });
    vi.mocked(processAiTaskAction).mockResolvedValue({ status: 'skipped' });
    vi.mocked(readQueuedSuggestionsAction).mockResolvedValue({
      status: 'queued',
      reason: 'status processing',
      taskId: 'task-1',
    });

    renderWithProviders(<SuggestionsPanel {...PROPS} />);
    await waitFor(() => expect(screen.getByTestId('ai-suggestions-pending')).toBeInTheDocument());
  });
});

describe('SuggestionsPanel — only surfaces what is actually new', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides the category suggestion when it already matches the event', async () => {
    ready(suggestions());
    renderWithProviders(<SuggestionsPanel {...PROPS} currentCategory="match" />);

    await waitFor(() => expect(requestSuggestionsAction).toHaveBeenCalled());
    // Echoing the user's own choice back at them is noise.
    expect(screen.queryByTestId('ai-suggestion-category')).not.toBeInTheDocument();
  });

  it('shows the category suggestion when it differs', async () => {
    ready(suggestions());
    renderWithProviders(<SuggestionsPanel {...PROPS} currentCategory="other" />);
    expect(await screen.findByTestId('ai-suggestion-category')).toBeInTheDocument();
  });

  it('offers only the children that are not tagged yet', async () => {
    ready(
      suggestions({
        categorization: {
          category: 'other',
          confidence: 0.9,
          childIds: ['c-luka', 'c-mila'],
          newChildNames: [],
        },
      }),
    );
    vi.mocked(applyChildrenAction).mockResolvedValue({ ok: true, data: null });
    renderWithProviders(<SuggestionsPanel {...PROPS} currentChildIds={['c-luka']} />);

    await userEvent.click(await screen.findByTestId('ai-suggestion-children-accept-button'));
    await waitFor(() =>
      expect(applyChildrenAction).toHaveBeenCalledWith({ eventId: 'evt-1', childIds: ['c-mila'] }),
    );
  });

  it('renders nothing when every suggestion is already satisfied', async () => {
    ready(suggestions());
    renderWithProviders(<SuggestionsPanel {...PROPS} currentCategory="match" />);

    await waitFor(() => expect(requestSuggestionsAction).toHaveBeenCalled());
    expect(screen.queryByTestId('ai-suggestions')).not.toBeInTheDocument();
  });

  it('warns about a duplicate and links to the other event', async () => {
    ready(
      suggestions({
        duplicates: {
          isDuplicate: true,
          matchEventId: 'evt-other',
          confidence: 0.95,
          reason: 'same training',
        },
      }),
    );
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    expect(await screen.findByTestId('ai-suggestion-duplicate')).toBeInTheDocument();
    expect(screen.getByTestId('ai-suggestion-duplicate-open-link')).toHaveAttribute(
      'href',
      '/calendar/evt-other',
    );
  });

  it('does not warn when the model flagged a duplicate with no id', async () => {
    ready(
      suggestions({
        duplicates: { isDuplicate: true, matchEventId: null, confidence: 0.5, reason: 'unsure' },
      }),
    );
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    await waitFor(() => expect(requestSuggestionsAction).toHaveBeenCalled());
    expect(screen.queryByTestId('ai-suggestion-duplicate')).not.toBeInTheDocument();
  });
});

describe('SuggestionsPanel — applying and rejecting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the category and then stops offering it', async () => {
    ready(suggestions());
    vi.mocked(applyCategoryAction).mockResolvedValue({ ok: true, data: null });
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    await userEvent.click(await screen.findByTestId('ai-suggestion-category-accept-button'));

    await waitFor(() =>
      expect(applyCategoryAction).toHaveBeenCalledWith({ eventId: 'evt-1', category: 'match' }),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('ai-suggestion-category')).not.toBeInTheDocument(),
    );
  });

  it('records a rejection so a repeatedly-refused suggestion is visible', async () => {
    ready(suggestions());
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    await userEvent.click(await screen.findByTestId('ai-suggestion-category-dismiss-button'));

    expect(dismissSuggestionAction).toHaveBeenCalledWith({ eventId: 'evt-1', kind: 'category' });
    expect(screen.queryByTestId('ai-suggestion-category')).not.toBeInTheDocument();
  });

  it('pre-ticks the suggested reminders and saves the ticked set', async () => {
    ready(
      suggestions({
        reminders: {
          suggestions: [
            { minutesBefore: 1440, label: 'Day before' },
            { minutesBefore: 120, label: '2 hours before' },
          ],
        },
      }),
    );
    vi.mocked(saveRemindersAction).mockResolvedValue({ ok: true, data: { saved: 1 } });
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    const box = await screen.findByTestId('ai-suggestion-reminder-120-checkbox');
    expect(box).toBeChecked();

    // Unticking one must actually drop it from what gets saved.
    await userEvent.click(box);
    await userEvent.click(screen.getByTestId('ai-suggestion-reminders-save-button'));

    await waitFor(() =>
      expect(saveRemindersAction).toHaveBeenCalledWith({
        eventId: 'evt-1',
        minutesBefore: [1440],
      }),
    );
  });

  it('keeps the suggestion on screen when applying it fails', async () => {
    ready(suggestions());
    vi.mocked(applyCategoryAction).mockResolvedValue({ ok: false, error: 'Event not found' });
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    await userEvent.click(await screen.findByTestId('ai-suggestion-category-accept-button'));

    await waitFor(() => expect(applyCategoryAction).toHaveBeenCalled());
    expect(screen.getByTestId('ai-suggestion-category')).toBeInTheDocument();
  });

  it('reports a failure instead of crashing when an action returns nothing', async () => {
    // A thrown or aborted server action used to reject inside the transition
    // and take the whole panel down with it.
    ready(suggestions());
    vi.mocked(applyCategoryAction).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof applyCategoryAction>>,
    );
    renderWithProviders(<SuggestionsPanel {...PROPS} />);

    await userEvent.click(await screen.findByTestId('ai-suggestion-category-accept-button'));

    await waitFor(() => expect(applyCategoryAction).toHaveBeenCalled());
    expect(screen.getByTestId('ai-suggestion-category')).toBeInTheDocument();
  });
});
