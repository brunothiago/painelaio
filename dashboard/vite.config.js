import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: repositório "painelaio" → https://usuario.github.io/painelaio/
// Para publicar na raiz do domínio, use: base: '/'
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/painelaio/',
});
