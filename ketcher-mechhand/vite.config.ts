import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// MECHAND_BASE is set by the GitHub Pages workflow (e.g. /MecHand/app/).
export default defineConfig({
  base: process.env.MECHAND_BASE ?? '/',
  plugins: [react()],
  define: {
    // ketcher-react reads a few process.env values at runtime.
    'process.env': {},
  },
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
