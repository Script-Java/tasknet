import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png', 'icons.svg', 'robots.txt', 'apple-touch-icon.png'],
      workbox: {
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      manifest: {
        name: 'Fides — Smart Habit Tracker & Task Scheduler',
        short_name: 'Fides',
        description: 'A modern, lightweight, mobile-first Progressive Web App habit tracker and todo app that automatically schedules tasks into a calendar.',
        theme_color: '#0D0B1E',
        background_color: '#06040F',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        id: '/',
        categories: ['productivity', 'utilities', 'lifestyle'],
        lang: 'en',
        dir: 'ltr',
        prefer_related_applications: false,
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Home',
            description: 'View your dashboard',
            url: '/',
            icons: [{ src: 'logo.png', sizes: '192x192' }],
          },
          {
            name: 'Tasks',
            short_name: 'Tasks',
            description: 'Manage your tasks',
            url: '/tasks',
            icons: [{ src: 'logo.png', sizes: '192x192' }],
          },
          {
            name: 'Habits',
            short_name: 'Habits',
            description: 'Track your habits',
            url: '/habits',
            icons: [{ src: 'logo.png', sizes: '192x192' }],
          },
          {
            name: 'Calendar',
            short_name: 'Calendar',
            description: 'View your schedule',
            url: '/calendar',
            icons: [{ src: 'logo.png', sizes: '192x192' }],
          },
        ],
        screenshots: [],
      },
    }),
  ],
})