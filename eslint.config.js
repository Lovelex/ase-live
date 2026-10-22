import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['tools/**/*.mjs'], languageOptions: { globals: { URL: 'readonly' } } },
  {
    files: ['example/**/*.js'],
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', Image: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly' },
    },
  },
);
