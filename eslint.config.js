import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['ts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['node_modules/', 'docs/', '**/*.test.ts'],
  },
)
