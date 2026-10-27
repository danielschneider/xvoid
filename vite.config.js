import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Split the Three.js layer out of the app entry so the app chunk loads without it.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return 'three';
          if (/[\\/]node_modules[\\/]@react-three[\\/]/.test(id)) return 'react-three';
          return undefined;
        },
      },
    },
  },
});
