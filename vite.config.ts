import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png', 'robots.txt', 'apple-touch-icon.png'],
      workbox: {
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tasknet-app\.vercel\.app\/$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'start-url',
            },
          },
        ],
      },
      manifest: {
        name: 'Fides',
        short_name: 'Fides',
        description: 'A modern, lightweight, mobile-first Progressive Web App habit tracker and todo app that automatically schedules tasks into a calendar.',
        theme_color: '#0D0B1E',
        background_color: '#06040F',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
