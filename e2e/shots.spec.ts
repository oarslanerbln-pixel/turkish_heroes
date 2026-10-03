import { expect, test } from '@playwright/test'
import { openShot, playToMoment, type Shot } from './shot.ts'

// Referans çekimler (MIMARI.md §10.8). Her çekim tohum, komutan, kademe, görüş
// ve simülasyon anıyla sabit; iki koşuda en fazla %0,1 piksel farkıyla tekrarlanır.
// Görsel fark şimdilik yalnız CI çıktısı, birleştirmeyi durdurmaz. Her çekim
// rapora ayrıca eklenir: PR şablonundaki önce/sonra tablosu buradan doldurulur.
//
// Henüz yok: R4 ilk vuruş ve R6 yığılma (oyuncu girdisi ister).

const VIEWS = {
  yatay: { width: 667, height: 375 },
  dikey: { width: 375, height: 667 },
}

interface RefShot {
  id: string
  commander: Shot['commander']
  /** Yoksa menü çekimi: SAVAŞA GİR'e basılmaz. */
  moment?: Shot['moment']
  pose?: Shot['pose']
  views: (keyof typeof VIEWS)[]
}

const SHOTS: RefShot[] = [
  { id: 'R1-menu', commander: 'alp-arslan', views: ['yatay', 'dikey'] },
  { id: 'R2-acilis', commander: 'alp-arslan', moment: 1, views: ['yatay'] },
  { id: 'R3-taktik-metehan', commander: 'metehan', moment: 6, views: ['yatay'] },
  { id: 'R3-taktik-malazgirt', commander: 'alp-arslan', moment: 6, views: ['yatay'] },
  { id: 'R3-taktik-miryokefalon', commander: 'kilicarslan', moment: 6, views: ['yatay'] },
  { id: 'R5-gun-batimi', commander: 'alp-arslan', moment: 104, views: ['yatay'] },
  // Tohum 1071'de boşta kalan oyuncu Malazgirt'i kazanır, Miryokefalon'u kaybeder.
  { id: 'R7-zafer', commander: 'alp-arslan', moment: 'end', views: ['yatay', 'dikey'] },
  { id: 'R7-yenilgi', commander: 'kilicarslan', moment: 'end', views: ['yatay', 'dikey'] },
  // Sanat açıları: oyun kamerası değil; model ve renk kararları bunlarla yargılanır.
  { id: 'R8-yer-metehan', commander: 'metehan', moment: 6, pose: 'ground', views: ['yatay'] },
  { id: 'R8-yer-malazgirt', commander: 'alp-arslan', moment: 6, pose: 'ground', views: ['yatay'] },
  { id: 'R8-yer-miryokefalon', commander: 'kilicarslan', moment: 6, pose: 'ground', views: ['yatay'] },
  { id: 'R9-genis-metehan', commander: 'metehan', moment: 6, pose: 'wide', views: ['yatay'] },
  { id: 'R9-genis-malazgirt', commander: 'alp-arslan', moment: 6, pose: 'wide', views: ['yatay'] },
  { id: 'R9-genis-miryokefalon', commander: 'kilicarslan', moment: 6, pose: 'wide', views: ['yatay'] },
]

test.use({ hasTouch: true, isMobile: true, deviceScaleFactor: 1 })

for (const shot of SHOTS) {
  for (const view of shot.views) {
    for (const quality of ['low', 'high'] as const) {
      const name = `${shot.id}-${view}-${quality}`
      test(name, async ({ page }) => {
        await page.setViewportSize(VIEWS[view])
        await openShot(page, { commander: shot.commander, moment: shot.moment ?? 0, quality, pose: shot.pose })
        if (shot.moment !== undefined) await playToMoment(page)
        await test.info().attach(name, { body: await page.screenshot(), contentType: 'image/png' })
        await expect(page).toHaveScreenshot(`${name}.png`)
      })
    }
  }
}
