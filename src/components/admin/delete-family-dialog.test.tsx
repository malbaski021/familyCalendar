import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';

vi.mock('@/lib/family/actions', () => ({
  deleteFamilyAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { DeleteFamilyDialog } from './delete-family-dialog';
import { deleteFamilyAction } from '@/lib/family/actions';

const PROPS = {
  familyId: 'fam-1',
  familyName: 'Jovic Family',
  memberCount: 3,
  testIdPrefix: 'admin-family-jovic',
};

async function openDialog() {
  const user = userEvent.setup();
  renderWithProviders(<DeleteFamilyDialog {...PROPS} />);
  await user.click(screen.getByTestId('admin-family-jovic-delete-button'));
  return user;
}

const confirmCheckbox = () => screen.getByTestId('admin-family-jovic-delete-confirm-checkbox');
const submitButton = () => screen.getByTestId('admin-family-jovic-delete-submit-button');

describe('DeleteFamilyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show the dialog until the trigger is clicked', () => {
    renderWithProviders(<DeleteFamilyDialog {...PROPS} />);
    expect(screen.queryByTestId('admin-family-jovic-delete-dialog')).not.toBeInTheDocument();
  });

  it('names the family being deleted, in the title and on the checkbox', async () => {
    await openDialog();
    expect(screen.getByTestId('admin-family-jovic-delete-dialog')).toBeInTheDocument();
    // Named twice on purpose: the heading and the confirmation label. Deleting
    // the wrong family should be hard to do by accident.
    expect(screen.getByRole('heading', { name: /Jovic Family/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Jovic Family/).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps Delete disabled until the checkbox is ticked', async () => {
    const user = await openDialog();

    // This is the whole point of the extra step — an accidental click on a
    // freshly opened dialog must not delete a family.
    expect(submitButton()).toBeDisabled();

    await user.click(confirmCheckbox());
    expect(submitButton()).toBeEnabled();
  });

  it('does not call the action while the checkbox is unticked', async () => {
    const user = await openDialog();
    await user.click(submitButton());
    expect(deleteFamilyAction).not.toHaveBeenCalled();
  });

  it('calls the action with the family id once confirmed', async () => {
    vi.mocked(deleteFamilyAction).mockResolvedValue({ ok: true, data: { id: 'fam-1' } });
    const user = await openDialog();

    await user.click(confirmCheckbox());
    await user.click(submitButton());

    await waitFor(() => expect(deleteFamilyAction).toHaveBeenCalledWith({ familyId: 'fam-1' }));
  });

  it('surfaces a server error and leaves the dialog open', async () => {
    vi.mocked(deleteFamilyAction).mockResolvedValue({ ok: false, error: 'Forbidden' });
    const user = await openDialog();

    await user.click(confirmCheckbox());
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.getByTestId('admin-family-jovic-delete-dialog')).toBeInTheDocument();
  });

  it('resets the checkbox when the dialog is closed and reopened', async () => {
    const user = await openDialog();
    await user.click(confirmCheckbox());
    expect(submitButton()).toBeEnabled();

    await user.click(screen.getByTestId('admin-family-jovic-delete-cancel-button'));
    await waitFor(() =>
      expect(screen.queryByTestId('admin-family-jovic-delete-dialog')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('admin-family-jovic-delete-button'));

    // A stale tick would mean the second delete needs only one click.
    expect(confirmCheckbox()).not.toBeChecked();
    expect(submitButton()).toBeDisabled();
  });
});
