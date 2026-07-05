import { defineConfig, devices } from '@playwright/test';

// E2E covers browser-behavior flows: rapid-tap defense, rotate card,
// gesture-on-touch, resume-after-reload. The 7 success criteria (offline,
// wake lock) stay a manual on-device checklist.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173/flashcards/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173/flashcards/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      // Landscape iPhone, parent-held.
      name: 'mobile-landscape',
      use: { ...devices['iPhone 13 landscape'] },
    },
  ],
});
