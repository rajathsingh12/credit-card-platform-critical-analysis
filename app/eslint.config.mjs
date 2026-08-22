import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import next from '@next/eslint-plugin-next'

export default tseslint.config(
  {
    ignores: ['.next/', 'node_modules/', 'next-env.d.ts', '*.tsbuildinfo'],
  },
  ...tseslint.configs.recommended,
  {
    // Registered unscoped so `next build` detects the plugin — it resolves the
    // config for eslint.config.mjs itself, not for a source file.
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': next,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  }
)
