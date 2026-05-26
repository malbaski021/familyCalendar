import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

vi.mock('@/lib/auth/actions', () => ({
  signUpAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { SignUpForm } from './signup-form';
import { signUpAction } from '@/lib/auth/actions';

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, username, password and submit', () => {
    renderWithProviders(<SignUpForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('does not call signUpAction when fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignUpForm />);

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    // Server action must not fire when required fields are blank.
    // (Detailed UI-level validation error rendering is covered by the schema
    // unit tests and Playwright E2E in F18.)
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(signUpAction).not.toHaveBeenCalled();
  });

  it('calls signUpAction with valid input', async () => {
    vi.mocked(signUpAction).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderWithProviders(<SignUpForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await vi.waitFor(() => {
      expect(signUpAction).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });
    });
  });

  it('shows server error message when signup fails', async () => {
    vi.mocked(signUpAction).mockResolvedValue({ ok: false, error: 'Username is already taken' });
    const user = userEvent.setup();
    renderWithProviders(<SignUpForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/username is already taken/i);
  });
});
