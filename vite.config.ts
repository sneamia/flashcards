import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this project from /flashcards/. Everything that must
// agree (or install/offline breaks silently): Vite `base`, manifest
// `start_url`, manifest `scope`, the service-worker scope, PLUS these
// hardcodes that Vite cannot rebase and that must be edited by hand if the
// path ever changes:
//   - src/styles.css        @font-face url('/flashcards/fonts/...') x2
//   - index.html            apple-touch-icon href
//   - playwright.config.ts  baseURL + webServer.url
const BASE = '/flashcards/';

export default defineConfig({
  base: BASE,
  test: {
    // vitest: pure-logic unit tests run in jsdom; Playwright E2E lives in tests/e2e.
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
  },
  plugins: [
    VitePWA({
      // Never skipWaiting(): a new SW installs and WAITS, activating on the next
      // launch so an update can never take over mid-session.
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        // Precache ALL assets so a home-screen launch works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,txt}'],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      manifest: {
        name: 'Flashcards',
        short_name: 'Flashcards',
        description: 'A calm, parent-operated phonics teleprompter.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#f7f1e3',
        theme_color: '#f7f1e3',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
