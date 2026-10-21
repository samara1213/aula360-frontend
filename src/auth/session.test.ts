import { safeNext } from './session';

describe('safeNext', () => {
  it.each([
    ['/academic/periods?x=1', '/academic/periods?x=1'],
    ['/', '/'],
    [null, '/'],
    ['', '/'],
    ['https://malicioso.example', '/'],
    ['//malicioso.example', '/'],
    ['/\\malicioso.example', '/'],
    ['javascript:alert(1)', '/'],
    // El analizador de URL quita tabs y saltos: quedaría //malicioso.example (B2).
    ['/\t/malicioso.example', '/'],
    ['/\n/malicioso.example', '/'],
    ['/a/../b?x=1#y', '/b?x=1#y'],
  ])('%j → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
