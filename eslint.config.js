import js from '@eslint/js';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 12,
      sourceType: 'module'
    },
    env: {
      browser: true,
      es2021: true
    },
    rules: {}
  }
];
