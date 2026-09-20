import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    // Binds to every interface (not just localhost) - without this, phones on the same
    // network/hotspot get "site can't be reached" no matter how correct the QR code's IP is,
    // since the dev server never accepts connections from outside the machine at all.
    host: true,
    // The app talks to /api and /media on its own origin (see src/lib/api.js). In development those are
    // forwarded to the backend over plain HTTP on this computer, which the backend serves without a certificate.
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:5000', changeOrigin: false },
    },
  },
})
