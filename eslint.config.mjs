import Js from '@eslint/js';
import Ts from 'typescript-eslint';

export default Ts.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  Js.configs.recommended,
  ...Ts.configs.recommended,
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { globals: { require: 'readonly', __dirname: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  {
    files: ['extension/**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['PascalCase'] },
        { selector: 'function', filter: { regex: '^(activate|deactivate)$', match: true }, format: ['camelCase'] }
      ],
      'no-restricted-imports': ['error', {
        patterns: ['child_process', 'node:child_process', 'http', 'node:http', 'https', 'node:https', 'net', 'node:net', 'fs', 'node:fs']
      }]
    }
  }
);
