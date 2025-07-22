import js from '@eslint/js';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        Intl: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        DOMParser: 'readonly',
        fetch: 'readonly',
        Event: 'readonly',
        URL: 'readonly',
        localStorage: 'readonly',
        alert: 'readonly',
        pdfMake: 'readonly',
        htmlToPdfmake: 'readonly',
        Image: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestAnimationFrame: 'readonly',
        getComputedStyle: 'readonly'
      }
    },
    rules: {}
  }
];
