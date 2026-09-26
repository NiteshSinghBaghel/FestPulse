import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiServerPlugin } from './src/server/apiPlugin';

export default defineConfig({
  plugins: [react(), apiServerPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
