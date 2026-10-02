import { expect, test } from '@playwright/test'

// Duman testi (risk P7): uygulama açılır, savaşa girilir, birkaç saniye
// oynanır, molaya girilip çıkılır. Konsolda hata, sayfada yakalanmamış
// istisna olmamalı. Çekim kipi yok: gerçek kare döngüsü ve ses yolu çalışır.
test('savaşa girilir, oynanır, konsol temiz', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await page.getByRole('button', { name: 'SAVAŞA GİR' }).click()
  await expect(page.getByRole('button', { name: 'Mola' })).toBeVisible()

  // Sahne akıyor: iki an arasında görüntü değişir.
  const canvas = page.locator('canvas').first()
  await page.waitForTimeout(1_000)
  const before = await canvas.screenshot()
  await page.keyboard.press('Space')
  await page.waitForTimeout(4_000)
  expect((await canvas.screenshot()).equals(before)).toBe(false)

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'DEVAM' }).click()
  await expect(page.getByRole('button', { name: 'Mola' })).toBeVisible()

  await expect(page.getByText('BİR HATA OLDU')).toHaveCount(0)
  expect(errors).toEqual([])
})
