import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** The commit the app is built from (shown in About and recorded in study sessions). */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain -- .', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

// MECHAND_BASE is set by the GitHub Pages workflow (e.g. /MecHand/app/).
export default defineConfig({
  base: process.env.MECHAND_BASE ?? '/',
  plugins: [react()],
  define: {
    // ketcher-react reads a few process.env values at runtime.
    'process.env': {},
    __MECHAND_COMMIT__: JSON.stringify(commit()),
  },
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
