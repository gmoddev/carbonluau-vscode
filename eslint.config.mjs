import Js from '@eslint/js';
import Ts from 'typescript-eslint';

export default Ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'tooling/**', 'build/**'] },
  Js.configs.recommended,
  ...Ts.configs.recommended,
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { globals: { require: 'readonly', exports: 'readonly', __dirname: 'readonly', Buffer: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  {
    files: ['extension/**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['PascalCase'] },
        { selector: 'import', format: null },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'objectLiteralMethod', format: null },
        // LSP wire fields retain the upstream protocol spelling.
        { selector: 'typeProperty', filter: { regex: '^(message|line|character|start|end|range|severity|code|label|detail|documentation|insertText|textEdit|newText|parameters|contents|items|signatures|activeSignature|activeParameter|uri)$', match: true }, format: null },
        { selector: 'classMethod', filter: { regex: '^dispose$', match: true }, format: null },
        { selector: 'function', filter: { regex: '^(activate|deactivate)$', match: true }, format: ['camelCase'] }
      ],
      'no-restricted-imports': ['error', {
        patterns: ['http', 'node:http', 'https', 'node:https', 'net', 'node:net']
      }]
    }
  }
);
