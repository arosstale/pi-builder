import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Tauri dev server — don't open browser
  server: { port: 5173, strictPort: true },
  // Make WASM imports work for ghostty-web
  optimizeDeps: { exclude: ['ghostty-web'] },
  build: { target: ['es2021', 'chrome105', 'safari15'] },
  // Assets can be served via Tauri protocol
  base: './',
})
