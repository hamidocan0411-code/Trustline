import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': '.',
    },
  },

  server: {
    hmr:
      process.env.DISABLE_HMR !== 'true',

    watch:
      process.env.DISABLE_HMR === 'true'
        ? null
        : {},
  },
});