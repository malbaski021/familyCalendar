import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const replaceMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/calendar',
}));

import { LanguageToggle } from './language-toggle';

describe('LanguageToggle', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it('renders trigger with Globe icon and accessible label', () => {
    renderWithProviders(<LanguageToggle />);
    expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument();
    expect(screen.getByTestId('nav-language-toggle')).toBeInTheDocument();
  });

  it('switches locale when a non-active item is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByTestId('nav-language-toggle'));
    await user.click(await screen.findByTestId('nav-language-toggle-option-sr-Latn'));

    expect(replaceMock).toHaveBeenCalledWith('/calendar', { locale: 'sr-Latn' });
  });

  it('does not switch when the active locale is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByTestId('nav-language-toggle'));
    await user.click(await screen.findByTestId('nav-language-toggle-option-en'));

    expect(replaceMock).not.toHaveBeenCalled();
  });
});
