import { renderHook } from '@testing-library/react';
import { useHashToken } from './hash-token';

const TOKEN = 'a'.repeat(96);

describe('useHashToken', () => {
  it('lee el token del fragmento y lo quita de la barra de direcciones', () => {
    window.history.replaceState(null, '', `/reset-password#token=${TOKEN}`);
    const { result } = renderHook(() => useHashToken());
    expect(result.current).toBe(TOKEN);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/reset-password');
  });

  it('ignora tokens con formato inválido', () => {
    window.history.replaceState(null, '', '/reset-password#token=<script>');
    const { result } = renderHook(() => useHashToken());
    expect(result.current).toBeNull();
  });
});
