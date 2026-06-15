import { defineConfig } from 'vite';

const base = process.env.GITHUB_PAGES === 'true' ? '/sneak-game/' : '/';

export default defineConfig({
  base,
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
