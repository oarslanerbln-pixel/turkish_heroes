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
// Ortanca |ΔL|, işaretli ΔL değil: kahraman bilerek iki tonlu (ak at, koyu tuğ
// ve kaftan) — açık ve koyu yarıları birbirini götürür, işaretli ortanca sıfıra
// düşer ama göz onu zeminden ayırır. İşaretli ortanca da raporlanır: ordu
// zeminden koyu (eksi), kahraman açık kalmalı (STIL.md §Değer).
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
  /** Ortanca |L(birim) − L(zemin)|: ölçüt bu. */
  contrast: number
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
    const groups: Record<string, { pixels: number; median: number; contrast: number }> = {}
    for (const group of ['enemy', 'ally', 'player']) {
      frames[group] = probe(group).png
      const mask = await decode(frames[group])
      const deltas: number[] = []
      for (let i = 0; i < mask.length; i += 4) {
        // Macenta: kırmızı ya da mavi yeşilden belirgin yüksek (kenar yumuşatmalı kenar dahil).
        if (Math.max(mask[i], mask[i + 2]) - mask[i + 1] > 40) deltas.push(lightness(shown, i) - lightness(ground, i))
      }
      const median = (values: number[]) => values.sort((p, q) => p - q)[values.length >> 1] ?? 0
      groups[group] = { pixels: deltas.length, median: median(deltas), contrast: median(deltas.map(Math.abs)) }
    }
    probe('normal')
    return { triangles: normal.triangles, calls: normal.calls, groups, frames }
  })
}

test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })

// Kadraj bekçisi (MIMARI.md K2, STIL.md §9): taktik kadrajda düşman cephesi HUD'un
// altında kalmaz. Cephe, her 8 px'lik şeritte düşman maskesinin en alttaki
// pikseli: ordu oyuncuya üstten gelir, oyuncuya en yakın saf odur. Şerit, arka
// saflardan tek başına uzanan bir mızrak ucunun cephe sayılmasını önler. Ordunun gövdesi de büyük
// ölçüde açıkta kalır; geçitteki kolun kuyruğu ufka uzandığı için sıfır değil.
// Geçici duyurular (afiş, dalga başlığı, yara flaşı) sayılmaz: sönerler.
const MAX_FRONT_UNDER_HUD = 0.02
const MAX_BODY_UNDER_HUD = 0.23
const FRONT_STRIP = 8

interface Framing {
  pixels: number
  covered: number
  columns: number
  frontCovered: number
  /** HUD altındaki cephe şeritleri [x, y], ilk birkaçı: rapor için. */
  frontSample: [number, number][]
}

function enemyUnderHud(page: Page): Promise<Framing> {
  return page.evaluate(async (strip) => {
    type Frame = { png: string }
    const probe = (window as unknown as { __artProbe: (mode: string) => Frame }).__artProbe
    const transient = '.announce, .wave-banner, .hurt-flash'
    // Saydam kapsayıcı (köşe, satır) kendisi örtmez; içindekiler örter.
    const rects: DOMRect[] = []
    const collect = (el: Element) => {
      if (el.matches(transient)) return
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return
      const clear = /rgba\(.*,\s*0\)|transparent/.test(style.backgroundColor) && style.backgroundImage === 'none'
      if (clear && el.children.length) for (const child of el.children) collect(child)
      else rects.push(el.getBoundingClientRect())
    }
    for (const child of document.querySelector('.hud')?.children ?? []) collect(child)

    const img = new Image()
    img.src = probe('enemy').png
    await img.decode()
    probe('normal')
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, img.width, img.height).data
    const underHud = (x: number, y: number) => rects.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)
    const front = new Int32Array(Math.ceil(img.width / strip)).fill(-1)
    let pixels = 0
    let covered = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4
        if (Math.max(d[i], d[i + 2]) - d[i + 1] <= 40) continue
        pixels++
        front[Math.floor(x / strip)] = y
        if (underHud(x, y)) covered++
      }
    }
    let columns = 0
    const frontSample: [number, number][] = []
    front.forEach((y, i) => {
      if (y < 0) return
      columns++
      // En alttaki piksel şeridin neresinde olursa olsun: şeridin ortası yeterli değil.
      for (let x = i * strip; x < (i + 1) * strip; x++) {
        const j = (y * img.width + x) * 4
        if (Math.max(d[j], d[j + 2]) - d[j + 1] > 40 && underHud(x, y)) {
          frontSample.push([x, y])
          break
        }
      }
    })
    return { pixels, covered, columns, frontCovered: frontSample.length, frontSample: frontSample.slice(0, 12) }
  }, FRONT_STRIP)
}

for (const screen of SCREENS.filter((s) => s.name.startsWith('R3'))) {
  test(`${screen.name} kadraj`, async ({ page }) => {
    await openShot(page, { commander: screen.commander, moment: screen.moment, quality: 'low' })
    await playToMoment(page)
    const framing = await enemyUnderHud(page)
    const front = framing.frontCovered / framing.columns
    const body = framing.covered / framing.pixels
    await test.info().attach('kadraj', { body: JSON.stringify({ ...framing, front, body }), contentType: 'application/json' })
    expect(framing.pixels, 'düşman maskesi boş').toBeGreaterThan(MIN_PIXELS)
    expect(front, `HUD altındaki cephe payı ≤ ${MAX_FRONT_UNDER_HUD}`).toBeLessThanOrEqual(MAX_FRONT_UNDER_HUD)
    expect(body, `HUD altındaki ordu payı ≤ ${MAX_BODY_UNDER_HUD}`).toBeLessThanOrEqual(MAX_BODY_UNDER_HUD)
  })
}

for (const quality of ['low', 'high'] as const) {
  for (const screen of SCREENS) {
    test(`${screen.name} ${quality}`, async ({ page }) => {
      await openShot(page, { commander: screen.commander, moment: screen.moment, quality })
      await playToMoment(page)
      const { frames, ...result } = await measure(page)
      await test.info().attach('gorsel-temel', { body: JSON.stringify(result), contentType: 'application/json' })

      const weak = Object.entries(result.groups)
        .filter(([, g]) => g.pixels >= MIN_PIXELS && g.contrast < MIN_DELTA_L)
        .map(([name, g]) => `${name}: |ΔL| ${g.contrast.toFixed(3)}, ΔL ${g.median.toFixed(3)} (${g.pixels} px)`)
      // Oyuncu her kadrajda: maskesi boşsa ölçüm değil sonda bozuktur.
      const probeBroken = result.groups.player.pixels < MIN_PIXELS
      if (weak.length || probeBroken) {
        for (const [name, png] of Object.entries(frames)) {
          await test.info().attach(name, { body: Buffer.from(png.split(',')[1], 'base64'), contentType: 'image/png' })
        }
      }
      expect(probeBroken, 'oyuncu maskesi boş').toBe(false)
      expect(weak, `birim–zemin |ΔL| ≥ ${MIN_DELTA_L}`).toEqual([])
      if (screen.commander === 'metehan' && quality === 'high') {
        expect(result.triangles, 'Metehan yüksek kademe üçgen').toBeLessThanOrEqual(TRIANGLE_BUDGET)
      }
    })
  }
}
