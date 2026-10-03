// Grafik kalite kademeleri.
//
// Sahne hafif (~29 çizim çağrısı); kare maliyetini piksel doldurma belirliyor:
// çözünürlük (DPR), MSAA örnek sayısı ve tam ekran efekt pasoları. Kademeler
// yalnızca bu düğmeleri çeviriyor — oyun mantığına ve görünen içeriğe dokunmuyor.
//
// Başlangıç kademesi cihaz sınıfından tahmin edilir; oyun sürerken
// PerformanceMonitor (bkz. Scene) FPS'e göre kademeyi bir basamak indirip
// kaldırır. Gerçek cihaz testi için URL parametreleri:
//   ?quality=low|medium|high  → kademeyi sabitler (uyarlama kapalı)
//   ?perf                      → FPS paneli + kademe göstergesi (üretimde de)
//   ?msaa=0|2|4                → efekt zincirinin MSAA örnek sayısını sabitler

import { create } from 'zustand'
import { isTouchDevice } from '../hooks/useTouchControls'

export type QualityTier = 'low' | 'medium' | 'high'

export interface QualityPreset {
  /** Canvas piksel oranı üst sınırı. Doldurma maliyeti bununla karesel artar. */
  maxDpr: number
  /** Efekt zincirinin MSAA örnek sayısı; 0 = kapalı. Bkz. SESSION_MULTISAMPLING. */
  multisampling: number
  shadowMapSize: number
  bloom: boolean
  /** Film greni — neredeyse görünmez, ama tam ekran bir iş daha. */
  noise: boolean
}

export const QUALITY: Record<QualityTier, QualityPreset> = {
  high: { maxDpr: 2, multisampling: 4, shadowMapSize: 2048, bloom: true, noise: true },
  medium: { maxDpr: 1.5, multisampling: 2, shadowMapSize: 1024, bloom: true, noise: false },
  low: { maxDpr: 1, multisampling: 0, shadowMapSize: 1024, bloom: false, noise: false },
}

const ORDER: readonly QualityTier[] = ['low', 'medium', 'high']

export function shiftTier(tier: QualityTier, dir: 1 | -1): QualityTier {
  const i = ORDER.indexOf(tier) + dir
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, i))]
}

/** URL'de ?quality=... varsa o kademe; yoksa null. */
export function parseForcedTier(search: string): QualityTier | null {
  const value = new URLSearchParams(search).get('quality')
  return value === 'low' || value === 'medium' || value === 'high' ? value : null
}

/**
 * URL'de ?msaa=0|2|4 varsa o örnek sayısı; yoksa null. Düşük kademede kenar
 * yumuşatmanın bedeli gerçek telefonda ölçülsün diye (STIL.md §Kenar yumuşatma):
 * ?quality=low&perf ile ?quality=low&perf&msaa=2 yan yana.
 */
export function parseForcedMultisampling(search: string): number | null {
  const value = new URLSearchParams(search).get('msaa')
  return value === '0' || value === '2' || value === '4' ? Number(value) : null
}

/**
 * Dokunmatik cihaz (telefon/tablet) ortadan başlar: ilk izlenim takılmasın.
 * Cihaz rahatsa monitör birkaç saniyede yükseltir. Masaüstü yüksekten başlar.
 */
export function startTier(forced: QualityTier | null, touch: boolean): QualityTier {
  return forced ?? (touch ? 'medium' : 'high')
}

/**
 * Bu sayıda kademe değişiminden sonra uyarlama durur. Her geçiş efekt
 * shader'larını yeniden derletip kısa bir takılma yaratıyor; iki kademe
 * arasında gidip gelen bir cihaz bu takılmayı sürekli yaşardı.
 */
export const MAX_TIER_CHANGES = 4

interface QualityState {
  tier: QualityTier
  /** URL ile sabitlendiyse ya da salınım yüzünden durduysa uyarlama kapalı. */
  locked: boolean
  changes: number
  /** Monitörün "FPS yetiyor / yetmiyor" sinyali: bir basamak yukarı/aşağı. */
  step: (dir: 1 | -1) => void
}

const browser = typeof window !== 'undefined'
const FORCED = browser ? parseForcedTier(window.location.search) : null

export const START_TIER = startTier(FORCED, isTouchDevice())

/**
 * MSAA oturum boyunca sabit, başlangıç kademesinden gelir. Değiştirmek
 * EffectComposer'ı yeniden kurduruyor ve @react-three/postprocessing eskisini
 * dispose etmiyor — her kademe değişiminde GPU belleği sızardı. Asıl kazanç
 * zaten DPR'de.
 */
export const SESSION_MULTISAMPLING =
  (browser ? parseForcedMultisampling(window.location.search) : null) ?? QUALITY[START_TIER].multisampling

export const useQuality = create<QualityState>((set, get) => ({
  tier: START_TIER,
  locked: FORCED !== null,
  changes: 0,

  step: (dir) => {
    const { tier, locked, changes } = get()
    if (locked) return
    const next = shiftTier(tier, dir)
    // Zaten en uçtaki kademede: değişim yok, sayılmaz. (Rahat bir masaüstü
    // her ölçümde "yükselt" der; bunu salınım saymamalıyız.)
    if (next === tier) return

    const count = changes + 1
    if (count >= MAX_TIER_CHANGES) {
      // Salınım: iki kademeden düşük olanda kal.
      set({ tier: dir < 0 ? next : tier, changes: count, locked: true })
    } else {
      set({ tier: next, changes: count })
    }
  },
}))

/** FPS paneli ve kademe göstergesi: geliştirmede her zaman, üretimde ?perf ile. */
export const PERF_OVERLAY =
  import.meta.env.DEV || (browser && new URLSearchParams(window.location.search).has('perf'))
