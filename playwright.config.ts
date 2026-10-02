// Tarayıcı testleri (MIMARI.md §10.8, risk P7). Oyun testi derlemesine karşı
// koşar: ?commander=, ?seed= ve ?shot= yalnız orada okunur. Derleme ayrı adım
// (`npm run build:e2e`); `npm run e2e` ikisini birlikte yapar.
//
// İki proje:
// - checks: duman testi ve düzen bekçisi. Bloklayan.
// - shots: referans çekimler ve görsel fark. Şimdilik yalnız CI çıktısı.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const CI = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  // Çekim tabanı platform adıyla tutulur: yazı ve WebGL çıktısı işletim sistemine göre değişir.
  snapshotPathTemplate: '{testDir}/__shots__/{arg}-{platform}{ext}',
  fullyParallel: true,
  // Tabanı olmayan çekim yazılır, test düşmez: yeni çekim ilk koşuda taban olur.
  updateSnapshots: 'missing',
  forbidOnly: CI,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    // PWA'nın servis çalışanı testler arasında eski derlemeyi sunmasın.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: {
    // §10.8 determinizm ölçütü: aynı çekim iki koşuda en fazla %0,1 piksel farkı.
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },
  projects: [
    { name: 'checks', testMatch: ['smoke.spec.ts', 'layout.spec.ts'] },
    { name: 'shots', testMatch: 'shots.spec.ts', timeout: 120_000 },
  ],
  webServer: {
    command: `npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
  },
})
