// Exists so ESLint's config search stops here instead of walking up to ~/eslint.config.mts.
// app/ owns its own ruleset and is linted with `npm run lint` from inside app/.
export default [
  {
    ignores: ['app/', 'node_modules/'],
  },
]
