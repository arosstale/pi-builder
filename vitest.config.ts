import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure @mariozechner/pi-coding-agent resolves from packages/core where it's installed
    alias: {
      '@mariozechner/pi-coding-agent': path.resolve(
        __dirname,
        'packages/core/node_modules/@mariozechner/pi-coding-agent'
      ),
      '@mariozechner/pi-ai': path.resolve(
        __dirname,
        'packages/core/node_modules/@mariozechner/pi-coding-agent/node_modules/@mariozechner/pi-ai'
      ),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    hookTimeout: 30_000,
    testTimeout: 30_000,
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
    testMatch: ['packages/**/__tests__/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', '**/node_modules/**'],
  },
})
