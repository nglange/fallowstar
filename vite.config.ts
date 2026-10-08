import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /<repo>/, so production builds (and
// `vite preview`) use that base path. Override with VITE_BASE=/ for a root
// deployment. The dev server stays at /.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? (process.env.VITE_BASE ?? '/fallowstar/') : '/',
  build: { target: 'es2022', sourcemap: false },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
