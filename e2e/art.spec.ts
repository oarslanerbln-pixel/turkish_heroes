import { expect, test, type Page } from '@playwright/test'
import { openShot, playToMoment, type Commander } from './shot.ts'

// Görsel temel bekçisi (STIL.md; MIMARI.md §8 Faz 27, V1 ve V5).
//
// Birimler zeminden tonla değil parlaklıkla ayrılsın: her birim grubunun
// piksellerinde, birimli kare ile birimsiz karenin (aynı piksel, birimin
// ardındaki zemin) OKLab L farkı. Ölçüt ortanca |ΔL|. Maske ayrı bir karede
// çizilir (birim macenta, gerisi siyah): birimin kendi rengine bakmaz,
// zemine yakın renkli pikseller ölçümden düşmez. Bkz. src/components/ArtProbe.tsx.
//
// Üçgen sayısı gölge pasosu dahil karedeki tüm çizimler.

const MIN_DELTA_L = 0.15
/** Metehan yüksek kademe (M1'de 81,5k; çimen %72). */
const TRIANGLE_BUDGET = 55_000
/** Bundan az pikseli olan grup kadrajda sayılmaz. */
const MIN_PIXELS = 50

interface ArtScreen {
  name: string
  commander: Commander
  moment: number
}

const SCREENS: ArtScreen[] = [
  { name: 'R3 taktik Metehan', commander: 'metehan', moment: 6 },
  { name: 'R3 taktik Malazgirt', commander: 'alp-arslan', moment: 6 },
  { name: 'R3 taktik Miryokefalon', commander: 'kilicarslan', moment: 6 },
  { name: 'R5 gün batımı', commander: 'alp-arslan', moment: 104 },
]

interface GroupResult {
  pixels: number
  /** Ortanca L(birim) − L(zemin); eksi: birim zeminden koyu. */
  median: number
}

interface ArtResult {
  triangles: number
  calls: number
  groups: Record<string, GroupResult>
  /** Kareler (PNG veri adresi): ölçüt tutmazsa rapora eklenir. */
  frames: Record<string, string>
}

function measure(page: Page): Promise<ArtResult> {
  return page.evaluate(async () => {
    type Frame = { png: string; calls: number; triangles: number }
    const probe = (window as unknown as { __artProbe: (mode: string) => Frame }).__artProbe
    const decode = async (png: string) => {
      const img = new Image()
      img.src = png
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      return ctx.getImageData(0, 0, img.width, img.height).data
    }
    const channel = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    // OKLab L (Björn Ottosson).
    const lightness = (d: Uint8ClampedArray, i: number) => {
      const r = channel(d[i])
      const g = channel(d[i + 1])
      const b = channel(d[i + 2])
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
    }

    const normal = probe('normal')
    const frames: Record<string, string> = { normal: normal.png, hide: probe('hide').png }
    const shown = await decode(frames.normal)
    const ground = await decode(frames.hide)
    const groups: Record<string, { pixels: number; median: number }> = {}
    for (const group of ['enemy', 'ally', 'player']) {
      frames[group] = probe(group).png
      const mask = await decode(frames[group])
      const deltas: number[] = []
      for (let i = 0; i < mask.length; i += 4) {
        // Macenta: kırmızı ya da mavi yeşilden belirgin yüksek (kenar yumuşatmalı kenar dahil).
        if (Math.max(mask[i], mask[i + 2]) - mask[i + 1] > 40) deltas.push(lightness(shown, i) - lightness(ground, i))
      }
      deltas.sort((p, q) => p - q)
      groups[group] = { pixels: deltas.length, median: deltas[deltas.length >> 1] ?? 0 }
    }
    probe('normal')
    return { triangles: normal.triangles, calls: normal.calls, groups, frames }
  })
}

test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })

for (const quality of ['low', 'high'] as const) {
  for (const screen of SCREENS) {
    test(`${screen.name} ${quality}`, async ({ page }) => {
      await openShot(page, { commander: screen.commander, moment: screen.moment, quality })
      await playToMoment(page)
      const { frames, ...result } = await measure(page)
      await test.info().attach('gorsel-temel', { body: JSON.stringify(result), contentType: 'application/json' })

      const weak = Object.entries(result.groups)
        .filter(([, g]) => g.pixels >= MIN_PIXELS && Math.abs(g.median) < MIN_DELTA_L)
        .map(([name, g]) => `${name}: ΔL ${g.median.toFixed(3)} (${g.pixels} px)`)
      // Oyuncu her kadrajda: maskesi boşsa ölçüm değil sonda bozuktur.
      const probeBroken = result.groups.player.pixels < MIN_PIXELS
      if (weak.length || probeBroken) {
        for (const [name, png] of Object.entries(frames)) {
          await test.info().attach(name, { body: Buffer.from(png.split(',')[1], 'base64'), contentType: 'image/png' })
        }
      }
      expect(probeBroken, 'oyuncu maskesi boş').toBe(false)
      expect(weak, `birim–zemin ΔL ≥ ${MIN_DELTA_L}`).toEqual([])
      if (screen.commander === 'metehan' && quality === 'high') {
        expect(result.triangles, 'Metehan yüksek kademe üçgen').toBeLessThanOrEqual(TRIANGLE_BUDGET)
      }
    })
  }
}
