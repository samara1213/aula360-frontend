import { render } from '@testing-library/react';
import { MenuIcon } from './menu-icon';

describe('MenuIcon', () => {
  it.each(['constructor', 'toString', '__proto__', 'no-existe', null])(
    'con %s muestra el ícono por defecto sin fallar (B5)',
    (name) => {
      const { container } = render(<MenuIcon name={name} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    },
  );
});
