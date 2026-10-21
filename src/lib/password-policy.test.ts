import { strongPassword } from './password-policy';

describe('política de contraseñas (igual que el backend)', () => {
  it.each(['Aula360*Segura', 'Nueva*Clave2026'])('acepta %s', (value) => {
    expect(strongPassword.safeParse(value).success).toBe(true);
  });

  it.each([
    ['corta', 'Ab1*'],
    ['sin mayúscula', 'aula360*segura'],
    ['sin minúscula', 'AULA360*SEGURA'],
    ['sin número', 'Aula*Segura!'],
    ['sin símbolo', 'Aula360Segura'],
    ['más de 72 bytes', 'Aa1*' + 'ñ'.repeat(35)],
  ])('rechaza: %s', (_, value) => {
    expect(strongPassword.safeParse(value).success).toBe(false);
  });
});
