import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // Varsayılan desen yazı tipi dosyalarını önbelleğe almıyor; çevrimdışı
      // açılışta başlıklar sistem yazı tipine düşerdi. İkonlar zaten
      // includeAssets ve manifest üzerinden geliyor, desene eklenmez.
      workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
      manifest: {
        name: 'HİLAL',
        short_name: 'HİLAL',
        description: "Metehan, Alp Arslan ve II. Kılıçarslan'ın taktikleriyle 3D taktik oyunu",
        lang: 'tr',
        theme_color: '#1a0a00',
        background_color: '#0d0500',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Kütüphaneler oyun kodundan ayrı parçalarda: oyunda yapılan her
        // değişiklik yalnızca küçük uygulama parçasını geçersiz kılar, three.js
        // ve render yığını tarayıcı/service worker önbelleğinde kalır.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            {
              name: 'render',
              test: /node_modules[\\/](@react-three|postprocessing|three-stdlib)/,
            },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/ },
          ],
        },
      },
    },
    // three.js tek başına ~700 kB; bölünemez, uyarı bu parça için anlamsız.
    chunkSizeWarningLimit: 800,
  },
})
