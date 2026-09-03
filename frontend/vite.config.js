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
  },
})
