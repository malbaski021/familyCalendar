import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

vi.mock('@/lib/auth/actions', () => ({
  loginAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}));

import { LoginForm } from './login-form';
import { loginAction } from '@/lib/auth/actions';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, password and submit', () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('does not call loginAction when fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /log in/i }));

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loginAction).not.toHaveBeenCalled();
  });

  it('shows server error from loginAction', async () => {
    vi.mocked(loginAction).mockResolvedValue({ ok: false, error: 'Invalid login credentials' });
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid login credentials/i);
  });
});
