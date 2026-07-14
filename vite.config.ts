/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/workout-log/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt', // new SW waits; activates on next full launch, never mid-workout
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Workout Log',
        short_name: 'Workouts',
        description: 'Workout tracker — offline first, your data stays yours.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0e1116',
        background_color: '#0e1116',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/workout-log/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'], // e2e/ belongs to Playwright, not vitest
  },
})
