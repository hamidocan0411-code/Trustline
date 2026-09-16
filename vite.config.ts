import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
          if (id.includes('/firebase/')) return 'firebase-vendor';
          if (id.includes('/leaflet/')) return 'map-vendor';
          if (id.includes('/lucide-react/')) return 'icons-vendor';
          return undefined;
        },
      },
    },
  },

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