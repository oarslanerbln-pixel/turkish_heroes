// Çekim kipi yardımcıları (bkz. src/shot.ts, src/components/ShotDirector.tsx).
import type { Page } from '@playwright/test'

export type Commander = 'metehan' | 'alp-arslan' | 'kilicarslan'

export interface Shot {
  commander: Commander
  /** Savaş saatinin saniyesi ya da 'end' (savaş bitene kadar). Menüde yalnız kipi açar. */
  moment: number | 'end'
  quality: 'low' | 'high'
}

/** Sabit tohum: ordunun dizilişi ve görsel rastgelelik her koşuda aynı. */
export const SEED = 1071

/** Çekim kipinde açar, ses kapalı (§10.8); menü karesi çizilince döner. */
export async function openShot(page: Page, { commander, moment, quality }: Shot): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('hilal_muted', '1'))
  const params = new URLSearchParams({ commander, seed: String(SEED), shot: String(moment), quality })
  await page.goto(`/?${params}`)
  await page.locator('html[data-shot="menu"]').waitFor({ state: 'attached' })
}

/** SAVAŞA GİR; simülasyon ana varıp son kare çizilince döner. */
export async function playToMoment(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'SAVAŞA GİR' }).click()
  await page.locator('html[data-shot="battle"]').waitFor({ state: 'attached', timeout: 90_000 })
}

/**
 * Giriş animasyonları bitsin: kayan bir panel ölçümü titretir. Sonsuz olanlar
 * (nabız) ve molada donanlar (afiş, duyuru) beklenmez; donan hiç bitmez.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.playState !== 'paused' && a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  )
}
