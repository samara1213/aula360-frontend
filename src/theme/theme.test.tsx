import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './theme-provider';
import { ThemeSwitcher } from './theme-switcher';
import { THEME_STORAGE_KEY } from './theme';

describe('tema claro y oscuro', () => {
  it('Sistema por defecto; elegir Oscuro aplica la clase y se recuerda', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    expect(screen.getByRole('radio', { name: 'Usar el tema del sistema' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(screen.getByRole('radio', { name: 'Tema oscuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'Usar el tema del sistema' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
