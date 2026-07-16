import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HİLAL',
        short_name: 'HİLAL',
        description: 'Türk tarihinin gerçek komutanlarıyla 3D taktik oyunu',
        theme_color: '#1a0a00',
        background_color: '#0d0500',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
