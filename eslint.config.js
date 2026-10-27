// ESLint flat config for XVoid. Encodes the layer rules from refactoring.md
// sections 2 and 4.1. Items deliberately NOT encoded yet:
// - max-lines / max-lines-per-function (4.4): not added; the tree is not yet
//   split to those limits (GameScene/TacticalHud still exceed 300 lines in 7d/7f),
//   so enabling them now would be noise. Add as warnings when splits land.
// Pre-existing scoped exceptions (no behaviour change, see refactoring.md 7a):
// - no-unused-vars is off for *.jsx: core ESLint cannot see identifiers used only
//   in JSX (e.g. <Canvas/>, <Line/>) without eslint-plugin-react, which is out of scope.
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

const RULES_TEST_FILES = ['src/rules/**/*.test.js'];

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { import: importPlugin },
    rules: {
      // Nothing under rules/ may import UI code (layer direction, section 2).
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/rules',
              from: './src/components',
              message: 'rules/ is pure: it must not import UI components.',
            },
            {
              target: './src/rules',
              from: ['./src/App.jsx', './src/main.jsx'],
              message: 'rules/ is pure: it must not import the app shell.',
            },
          ],
        },
      ],
    },
  },
  {
    // UI and selectors read rules only through the public index (refactoring.md 2.1 principle 7, 4.1).
    // import/no-restricted-paths: `target` files may import from `from` only when the path is an
    // allowed `except` entry. Here the target is the importing file and `from` is the rules/ directory,
    // with rules/index.js carved out.
    files: ['src/components/**/*.{js,jsx}', 'src/App.jsx', 'src/main.jsx', 'src/selectors/**/*.js'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/components',
              from: './src/rules',
              except: ['./index.js'],
              message: 'UI imports rules/ only via rules/index.js (public API).',
            },
            {
              target: './src/App.jsx',
              from: './src/rules',
              except: ['./index.js'],
              message: 'UI imports rules/ only via rules/index.js (public API).',
            },
            {
              target: './src/main.jsx',
              from: './src/rules',
              except: ['./index.js'],
              message: 'UI imports rules/ only via rules/index.js (public API).',
            },
            {
              target: './src/selectors',
              from: './src/rules',
              except: ['./index.js'],
              message: 'selectors/ imports rules/ only via rules/index.js (public API).',
            },
          ],
        },
      ],
    },
  },
  {
    // JSX-only identifiers are invisible to core no-unused-vars (see header).
    files: ['**/*.jsx'],
    rules: { 'no-unused-vars': 'off' },
  },
  {
    // Pure rules: no React, Three.js, DOM, wall-clock time or Math.random (sections 2.1, 4.4).
    files: ['src/rules/**/*.js'],
    ignores: RULES_TEST_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'rules/ must not import React.',
            },
            {
              group: ['three', 'three/*', '@react-three/*'],
              message: 'rules/ must not import Three.js.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'rules/ must not use window.' },
        { name: 'document', message: 'rules/ must not use document.' },
        { name: 'Date', message: 'rules/ must not use Date; time is not state.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'rules/ must use rng.js, not Math.random.' },
      ],
    },
  },
];
