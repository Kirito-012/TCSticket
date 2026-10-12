import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // e2e/ holds Playwright browser tests (run with `npm run e2e`); Vitest cannot run them.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
