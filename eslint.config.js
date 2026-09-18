'use strict';

const js = require('@eslint/js');
const nextConfig = require('eslint-config-next');

const commonGlobals = {
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
};

const commonRules = {
  'no-unused-vars': 'warn',
  'no-console': 'off',
  eqeqeq: 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-undef': 'error',
};

module.exports = [
  {
    ignores: [
      'eslint.config.js',
      'jest.config.js',
      'playwright.config.js',
      '.claude/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.next/**',
      'out/**',
      'docs/**',
      'supabase/functions/**',
      'supabase/.branches/**',
      'supabase/.temp/**',
    ],
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...js.configs.recommended,
  },
  ...nextConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // TypeScript's compiler already catches undefined refs and unused
      // vars; the base JS rules produce false positives on type-only
      // identifiers (e.g. `React.ReactNode` with no runtime import).
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      // Newly-enabled React Compiler rules (eslint-plugin-react-hooks v7,
      // pulled in by the eslint-config-next 16 upgrade) flag several
      // pre-existing idioms (mount-time fetch, ref-during-render tracking,
      // clearing state synchronously before a debounce fires). Real fixes
      // are behavioral changes, not lint-tooling ones — downgraded to warn
      // pending BUG-0012 follow-up.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    files: ['tools/**/*.js', 'orchestrator/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: commonGlobals },
    rules: commonRules,
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...commonGlobals,
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
    rules: commonRules,
  },
];
