import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/{eslint,vitest}.config.*',
        '**/node_modules/**',
        '**/[.]**',
        '**/*.d.ts',
        '**/virtual:*',
        'coverage/**',
        'dist/**',
        'scripts/**',
        'types/**/*.ts',
        'test/**'
      ]
    }
  }
})
