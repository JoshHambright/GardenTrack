import js from '@eslint/js';
import ts from 'typescript-eslint';

export default [
  { ignores: ['**/dist/**', '**/dist-types/**', '**/node_modules/**', '**/*.d.ts', 'spikes/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    // The service worker runs in a different global scope than the app, and
    // declaring that is cheaper than pulling in the `globals` package.
    files: ['**/public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        clients: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
