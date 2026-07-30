import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // Le build va dans backend/frontend_dist pour que Django le serve en production
    outDir: '../backend/frontend_dist',
    emptyOutDir: true,
  },
  server: {
    // Le front appelle /api/… en relatif : pas de CORS en dev, et rien à
    // changer en production où Django sert les deux derrière le même domaine.
    proxy: {
      '/api': 'http://127.0.0.1:8050',
      '/media': 'http://127.0.0.1:8050',
    },
  },
})
