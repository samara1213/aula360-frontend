import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/api/schema.d.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Las rutas exportan loaders y componentes juntos; los componentes de shadcn, variantes.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Seguridad: nada de HTML crudo en React.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'No se permite dangerouslySetInnerHTML.',
        },
      ],
      // zod siempre desde @/lib/zod (sin eval, por la CSP).
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'zod', message: 'Importa z desde @/lib/zod (jitless, por la CSP).' }],
          patterns: [
            { group: ['zod/*'], message: 'Importa z desde @/lib/zod (jitless, por la CSP).' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/zod.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
);
