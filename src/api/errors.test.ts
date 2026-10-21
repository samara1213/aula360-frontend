import { errorSentence, toApiError } from './errors';

describe('toApiError', () => {
  it('usa el mensaje del backend en los 4xx', () => {
    expect(toApiError(404, { statusCode: 404, message: 'Sede no encontrada' }).message).toBe(
      'Sede no encontrada',
    );
  });

  it('conserva la lista de errores de validación', () => {
    const error = toApiError(400, { statusCode: 400, message: ['a inválido', 'b inválido'] });
    expect(error.messages).toEqual(['a inválido', 'b inválido']);
  });

  it('nunca muestra el texto del servidor en los 5xx', () => {
    const error = toApiError(500, { statusCode: 500, message: 'QueryFailedError: relation x' });
    expect(error.message).not.toContain('QueryFailedError');
    expect(error.message).toContain('servidor');
  });

  it('da un mensaje en español cuando no hay cuerpo', () => {
    expect(toApiError(429, undefined).message).toContain('demasiados intentos');
  });

  it('errorSentence agrega el punto final solo si falta', () => {
    expect(errorSentence(toApiError(400, { statusCode: 400, message: 'Token inválido' }))).toBe(
      'Token inválido.',
    );
    expect(errorSentence(toApiError(404, undefined))).toBe('No encontramos lo que buscabas.');
  });
});
