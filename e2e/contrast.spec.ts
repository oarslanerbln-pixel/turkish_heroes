import { expect, test, type Page } from '@playwright/test'
import { openShot, playToMoment, settle, type Commander } from './shot.ts'

// Kontrast bekçisi (MIMARI.md §8 Adım 2a, U2): savaşta görünen her yazı,
// glif kutusunun arkasındaki zemine karşı ≥4,5:1. Zemin, glifler gizlenip
// alınan ekran görüntüsü: sahne, panel ve şerit birlikte ölçülür. Yazı
// gölgesi sayılmaz; okunurluğu zemin taşır.
//
// Ölçüt zemin piksellerinin en kötü onda biri: kenar yumuşatması ve tek tük
// kıvılcım düşer, yazının bir kısmı açık göğe taşarsa yakalanır.

const MIN_CONTRAST = 4.5

interface Screen {
  name: string
  commander: Commander
  moment: number
  /** Savaş afişi açılışın ilk saniyesinde tam görünür; çekim kipi onu söndürmüş bulur, ölçüm için geri getirilir. */
  banner?: boolean
}

const SCREENS: Screen[] = [
  { name: 'R2 açılış Metehan', commander: 'metehan', moment: 1, banner: true },
  { name: 'R2 açılış Malazgirt', commander: 'alp-arslan', moment: 1, banner: true },
  { name: 'R2 açılış Miryokefalon', commander: 'kilicarslan', moment: 1, banner: true },
  { name: 'R3 taktik Metehan', commander: 'metehan', moment: 6 },
  { name: 'R3 taktik Malazgirt', commander: 'alp-arslan', moment: 6 },
  { name: 'R3 taktik Miryokefalon', commander: 'kilicarslan', moment: 6 },
  { name: 'R5 gün batımı', commander: 'alp-arslan', moment: 104 },
]

interface TextRun {
  name: string
  text: string
  color: string
  opacity: number
  rects: [number, number, number, number][]
}

/** Görünen yazı düğümleri: glif kutuları ve atalardan birikmiş saydamlıkla. */
function collectText(page: Page): Promise<TextRun[]> {
  return page.evaluate(() => {
    const runs: TextRun[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!el || !n.textContent?.trim() || el.closest('[aria-hidden="true"], .dev-stats, .tuning')) continue
      const style = getComputedStyle(el)
      // Gradyan yazı (background-clip: text) gizlenince de görünür kalır; savaş HUD'unda yok.
      if (style.visibility === 'hidden' || style.backgroundClip === 'text') continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1)
      let opacity = 1
      for (let p: Element | null = el; p; p = p.parentElement) opacity *= parseFloat(getComputedStyle(p).opacity)
      if (!rects.length || opacity < 0.05) continue
      const cls = el.getAttribute('class')
      runs.push({
        name: cls ?? `${el.parentElement?.closest('[class]')?.getAttribute('class')} > ${el.tagName.toLowerCase()}`,
        text: n.textContent.trim().slice(0, 24),
        color: style.webkitTextFillColor || style.color,
        opacity,
        rects: rects.map((r) => [r.left, r.top, r.width, r.height] as [number, number, number, number]),
      })
    }
    return runs
  })
}

/** Her yazı için zeminin en kötü onda birine karşı kontrast oranı. */
function measure(page: Page, png: Buffer, runs: TextRun[]): Promise<{ name: string; text: string; ratio: number }[]> {
  return page.evaluate(
    async ({ b64, runs }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      // Her renk biçimini (oklch dahil) 8 bit sRGB'ye çevirir.
      const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      const rgba = (color: string) => {
        probe.clearRect(0, 0, 1, 1)
        probe.fillStyle = color
        probe.fillRect(0, 0, 1, 1)
        const d = probe.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2], d[3] / 255]
      }
      const channel = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

      return runs.map(({ name, text, color, opacity, rects }) => {
        const [tr, tg, tb, ta] = rgba(color)
        const a = ta * opacity
        const ratios: number[] = []
        for (const [x, y, w, h] of rects) {
          const x0 = Math.max(0, Math.floor(x))
          const y0 = Math.max(0, Math.floor(y))
          const x1 = Math.min(canvas.width, Math.ceil(x + w))
          const y1 = Math.min(canvas.height, Math.ceil(y + h))
          if (x1 <= x0 || y1 <= y0) continue
          const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
          for (let i = 0; i < d.length; i += 4) {
            const bg = luminance(d[i], d[i + 1], d[i + 2])
            // Yarı saydam yazı zeminle karışır: karışımı tarayıcı gibi sRGB'de yap.
            const fg = luminance(tr * a + d[i] * (1 - a), tg * a + d[i + 1] * (1 - a), tb * a + d[i + 2] * (1 - a))
            ratios.push((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05))
          }
        }
        ratios.sort((p, q) => p - q)
        return { name, text, ratio: ratios[Math.floor(0.1 * (ratios.length - 1))] ?? Infinity }
      })
    },
    { b64: png.toString('base64'), runs },
  )
}

test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })

for (const quality of ['low', 'high'] as const) {
  for (const screen of SCREENS) {
    test(`${screen.name} ${quality}`, async ({ page }) => {
      await openShot(page, { commander: screen.commander, moment: screen.moment, quality })
      await playToMoment(page)
      await settle(page)
      if (screen.banner) {
        // Afiş animasyonunun %40'ı: giriş bitmiş, çıkış başlamamış.
        const frozen = await page.evaluate(() => {
          const banners = document.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'banner')
          for (const a of banners) {
            a.pause()
            a.currentTime = 960
          }
          return banners.length
        })
        expect(frozen, 'savaş afişi').toBe(1)
      }
      const runs = await collectText(page)
      // Geçiş yok: `transition: all` taşıyan düğmede yazı solarken çekilirdi.
      await page.addStyleTag({
        content: '* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; transition: none !important; }',
      })
      const results = await measure(page, await page.screenshot(), runs)
      await test.info().attach('kontrast', {
        body: JSON.stringify(results.map((r) => ({ ...r, ratio: Math.round(r.ratio * 100) / 100 }))),
        contentType: 'application/json',
      })
      const found = results
        .filter((r) => r.ratio < MIN_CONTRAST)
        .map((r) => `${r.name} "${r.text}": ${r.ratio.toFixed(2)}:1`)
      expect(found, `${MIN_CONTRAST}:1 altı yazı`).toEqual([])
    })
  }
}
