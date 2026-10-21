import { useEffect, useState } from 'react';

/**
 * Lee el token del enlace del correo (`#token=...`: el fragmento no viaja al
 * servidor ni queda en los logs) y lo quita de la barra de direcciones y del
 * historial apenas se lee.
 */
export function useHashToken(): string | null {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    return value && /^[a-f0-9]{96}$/.test(value) ? value : null;
  });
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  return token;
}
