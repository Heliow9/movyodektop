// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // ✅ garante caminhos relativos
  plugins: [react()],
  build: {
    outDir: 'renderer', // ✅ precisa criar essa pasta no build
    emptyOutDir: true,  // limpa antes
  },
});
