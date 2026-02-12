import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
  },
})
