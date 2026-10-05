import { expect, test, type Page } from '@playwright/test'

/**
 * Savaş açılışı (MIMARI.md §8): şeritler iner, savaş arayüzü bekler; bir tuş
 * çekimi atlar. İlk karenin derlemesi uzarsa erken basış düşebilir: yinele.
 */
async function skipOpening(page: Page, hint: string) {
  await expect(page.getByText(hint)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mola' })).toBeHidden()
  await expect(async () => {
    await page.keyboard.press('Shift')
    await expect(page.getByRole('button', { name: 'Mola' })).toBeVisible({ timeout: 1_000 })
  }).toPass()
}

/**
 * Giriş ekranı (title.css): bir tuş ya da dokunuş onu soldurur, menü altında
 * açılır. Basış, dinleyici bağlanmadan düşerse yinelenir; solan ya da kalkmış
 * ekranda yinelenmez, yoksa tuş menüdeki SAVAŞA GİR'e gider.
 */
async function passTitle(page: Page, hint: string, by: 'key' | 'tap') {
  await expect(page.getByRole('button', { name: hint })).toBeVisible()
  await expect(async () => {
    if (by === 'key') await page.keyboard.press('Enter')
    else await page.getByRole('button', { name: hint }).tap()
    await expect(page.locator('.title:not(.is-leaving)')).toHaveCount(0, { timeout: 1_000 })
  }).toPass()
  await expect(page.locator('.title')).toHaveCount(0)
}

// Duman testi (risk P7): uygulama açılır, savaşa girilir, birkaç saniye
// oynanır, molaya girilip çıkılır. Konsolda hata, sayfada yakalanmamış
// istisna olmamalı. Çekim kipi yok: gerçek kare döngüsü ve ses yolu çalışır.
test('savaşa girilir, oynanır, konsol temiz', async ({ page }) => {
  // CI'da WebGL yazılımla çizilir; kareler yavaş, ekran görüntüsü pahalı.
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await passTitle(page, 'Başlamak için bir tuşa bas', 'key')
  await page.getByRole('button', { name: 'SAVAŞA GİR' }).click()
  await skipOpening(page, 'Geçmek için bir tuşa bas')

  // Sahne akıyor: iki an arasında görüntü değişir. Sayfa görüntüsü canvas'a
  // kırpılır: eleman görüntüsü iki kare boyunca kararlılık bekler, CI'da bu
  // bekleme süreyi aşıyordu.
  const clip = await page.locator('canvas').first().boundingBox()
  if (!clip) throw new Error('canvas yok')
  await page.waitForTimeout(1_000)
  const before = await page.screenshot({ clip })
  await page.keyboard.press('Space')
  await page.waitForTimeout(4_000)
  expect((await page.screenshot({ clip })).equals(before)).toBe(false)

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'DEVAM' }).click()
  await expect(page.getByRole('button', { name: 'Mola' })).toBeVisible()

  await expect(page.getByText('BİR HATA OLDU')).toHaveCount(0)
  expect(errors).toEqual([])
})

// Menü giriş ekranı solarken altında kurulur ve SAVAŞA GİR odak alır: o
// sırada basılan tuşlar savaşı başlatmamalı.
test('giriş ekranı solarken basılan tuşlar savaşı başlatmaz', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hilal_muted', '1'))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Başlamak için bir tuşa bas' })).toBeVisible()
  await expect(async () => {
    await page.keyboard.press('Space')
    await expect(page.locator('.title:not(.is-leaving)')).toHaveCount(0, { timeout: 1_000 })
  }).toPass()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Space')
  await expect(page.locator('.title')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'SAVAŞA GİR' })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByRole('button', { name: 'SAVAŞA GİR' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mola' })).toHaveCount(0)
})

test.describe('dikey telefon', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true })

  test('savaşta dikeye dönünce örtü çıkar, savaş molada bekler', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hilal_muted', '1'))
    await page.goto('/')
    await passTitle(page, 'Başlamak için dokun', 'tap')
    await page.getByRole('button', { name: 'SAVAŞA GİR' }).click()
    await skipOpening(page, 'Geçmek için dokun')

    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.getByRole('alert').filter({ hasText: 'TELEFONU YATAY ÇEVİR' })).toBeVisible()

    await page.setViewportSize({ width: 667, height: 375 })
    await expect(page.getByRole('alert').filter({ hasText: 'TELEFONU YATAY ÇEVİR' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'DEVAM' })).toBeVisible()
  })
})

// A5: işletim sisteminin tercihi kökte bayrak olur; arayüz onu okur.
test.describe('hareketi azalt', () => {
  test.use({ reducedMotion: 'reduce' })

  test('afiş kaymadan solar; tercih değişince bayrak izler', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hilal_muted', '1'))
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', '')
    await passTitle(page, 'Başlamak için bir tuşa bas', 'key')
    await page.getByRole('button', { name: 'SAVAŞA GİR' }).click()
    await expect(page.locator('.wave-banner')).toHaveCSS('animation-name', 'banner-fade')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(page.locator('html')).not.toHaveAttribute('data-reduced-motion')
    await expect(page.locator('.wave-banner')).toHaveCSS('animation-name', 'banner')
  })
})
