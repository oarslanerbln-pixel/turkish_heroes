import { expect, test, type Page } from '@playwright/test'
import { LAYOUT_DEBT } from './layout-debt.ts'
import { openShot, playToMoment } from './shot.ts'

// Düzen bekçisi (MIMARI.md §10.8): üç telefon görüşünde hiçbir dokunma hedefi
// ekrandan taşmaz, başka bir hedefle kesişmez; hedef ≥44 px, komşu aralığı ≥8 px.
// Görünen yazı ≥12 px (U1). Ekranlar çekim kipiyle kurulur: her koşuda aynı an,
// aynı HUD.

const MIN_TARGET = 44
const MIN_GAP = 8
const MIN_FONT = 12

const VIEWS = [
  { name: '667×375', width: 667, height: 375 },
  { name: '568×320', width: 568, height: 320 },
  { name: '375×667', width: 375, height: 667 },
]

const SCREENS: Record<string, (page: Page) => Promise<void>> = {
  menü: (page) => openShot(page, { commander: 'alp-arslan', moment: 0, quality: 'low' }),
  hazine: async (page) => {
    await openShot(page, { commander: 'alp-arslan', moment: 0, quality: 'low' })
    await page.getByRole('button', { name: /BİLGİ HAZİNESİ/ }).click()
    await page.getByRole('tablist').waitFor()
  },
  'savaş Malazgirt': async (page) => {
    await openShot(page, { commander: 'alp-arslan', moment: 6, quality: 'low' })
    await playToMoment(page)
  },
  'savaş Miryokefalon': async (page) => {
    await openShot(page, { commander: 'kilicarslan', moment: 6, quality: 'low' })
    await playToMoment(page)
  },
  mola: async (page) => {
    await openShot(page, { commander: 'alp-arslan', moment: 6, quality: 'low' })
    await playToMoment(page)
    // Esc: dikeyde Mola düğmesinin üstünde döndürme örtüsü var.
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'DEVAM' }).waitFor()
  },
  // Tohum 1071'de boşta kalan oyuncu Malazgirt'i kazanır (t=160), Miryokefalon'u
  // kaybeder (t=85). Metehan'da boşta savaş bitmez.
  'sonuç zafer': async (page) => {
    await openShot(page, { commander: 'alp-arslan', moment: 'end', quality: 'low' })
    await playToMoment(page)
    await page.getByText('ZAFER', { exact: true }).waitFor()
  },
  'sonuç yenilgi': async (page) => {
    await openShot(page, { commander: 'kilicarslan', moment: 'end', quality: 'low' })
    await playToMoment(page)
    await page.getByText('YENİLGİ', { exact: true }).waitFor()
  },
}

/** Giriş animasyonları bitsin: kayan bir panel ölçümü titretir. Sonsuz olanlar (nabız) beklenmez. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  )
}

/**
 * Yazı tabanının altındaki metinler, öğenin sınıfıyla. Süs (aria-hidden) ve
 * geliştirici panelleri sayılmaz; kaydırılıp görülecek metin sayılır.
 */
function auditFonts(page: Page): Promise<string[]> {
  return page.evaluate((minFont) => {
    const found = new Set<string>()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!el || !n.textContent?.trim() || el.closest('[aria-hidden="true"], .dev-stats, .tuning')) continue
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') continue
      if (parseFloat(style.fontSize) < minFont - 0.01) {
        // Sınıfsız öğe (b, span) en yakın sınıflı atasıyla adlanır.
        const owner = el.getAttribute('class') ? '' : `${el.parentElement?.closest('[class]')?.getAttribute('class')} `
        found.add(`${owner}${el.getAttribute('class') ?? el.tagName.toLowerCase()}: ${minFont} px'ten küçük yazı`)
      }
    }
    return [...found]
  }, MIN_FONT)
}

/** Ekrandaki dokunma hedeflerinin kural ihlalleri; sıralı, piksel değeri içermez (platformlar arası kararlı). */
function auditTargets(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ minTarget, minGap }) => {
      const SELECTOR = 'button, a[href], input, select, textarea, [role="button"]'
      const W = innerWidth
      const H = innerHeight
      // Ad: erişilebilir adın ilk parçası ya da görünen metnin ilk satırı. Yıldız,
      // sayaç ("0 / 14") ve emir durumu sonra gelir; ada girerse ilerlemeyle borç
      // listesi boşuna kırılır.
      const name = (el: HTMLElement) =>
        (el.getAttribute('aria-label')?.split(',')[0] || el.innerText.split('\n')[0]).replace(/\s+/g, ' ').trim() ||
        el.className.toString()

      const targets = [...document.querySelectorAll<HTMLElement>(SELECTOR)].filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') return false
        const x = r.left + r.width / 2
        const y = r.top + r.height / 2
        if (x < 0 || y < 0 || x > W || y > H) return true
        // Ortası hedef olmayan bir katmanın altındaysa dokunulamaz (ör. molada HUD).
        // Başka bir hedefin altındaysa sayılır: o kesişme zaten bir ihlal.
        const hit = document.elementFromPoint(x, y)
        return !!hit && (el.contains(hit) || !!hit.closest(SELECTOR))
      })

      // Ekrandan kısa, dikey kaydırılan bir kutudaki hedefe (Hazine'nin bölüm
      // listesi) kaydırarak ulaşılır; yalnız yanlara taşması ihlal. Ekran boyu
      // kaydırma sayılmaz: menüde SAVAŞA GİR'i kıvrımın altına saklar.
      const scrolls = (el: HTMLElement) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const box = /auto|scroll/.test(getComputedStyle(p).overflowY) && p.clientHeight < H - 1
          if (box && p.scrollHeight > p.clientHeight) return true
        }
        return false
      }

      const problems: string[] = []
      const rects = targets.map((el) => el.getBoundingClientRect())
      targets.forEach((el, i) => {
        const r = rects[i]
        const outY = r.top < -0.5 || r.bottom > H + 0.5
        if (r.left < -0.5 || r.right > W + 0.5 || (outY && !scrolls(el))) {
          problems.push(`${name(el)}: ekrandan taşıyor`)
        }
        if (Math.min(r.width, r.height) < minTarget) problems.push(`${name(el)}: ${minTarget} px'ten küçük`)
        for (let j = i + 1; j < targets.length; j++) {
          if (el.contains(targets[j]) || targets[j].contains(el)) continue
          const o = rects[j]
          const dx = Math.max(o.left - r.right, r.left - o.right)
          const dy = Math.max(o.top - r.bottom, r.top - o.bottom)
          const gap = dx >= 0 && dy >= 0 ? Math.hypot(dx, dy) : Math.max(dx, dy)
          if (gap < 0) problems.push(`${name(el)} × ${name(targets[j])}: kesişiyor`)
          else if (gap < minGap) problems.push(`${name(el)} × ${name(targets[j])}: ${minGap} px'ten yakın`)
        }
      })
      return problems.sort()
    },
    { minTarget: MIN_TARGET, minGap: MIN_GAP },
  )
}

for (const view of VIEWS) {
  test.describe(view.name, () => {
    test.use({
      viewport: { width: view.width, height: view.height },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    })

    for (const [screen, open] of Object.entries(SCREENS)) {
      const key = `${screen} @ ${view.name}`
      test(screen, async ({ page }) => {
        await open(page)
        await settle(page)
        const found = [...(await auditTargets(page)), ...(await auditFonts(page))].sort()
        await test.info().attach('ihlaller', { body: JSON.stringify({ [key]: found }), contentType: 'application/json' })
        // Tam eşitlik: yeni bir ihlal de, giderilip listede kalan bir ihlal de kırmızı.
        expect(found, `düzen borcu: ${key}`).toEqual(LAYOUT_DEBT[key] ?? [])
      })
    }
  })
}
