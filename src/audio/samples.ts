// Ses örnekleri: sentezin taklit edemediği gerçek kayıtlar.
//
// Nal, zırh, yay kirişi, kaya: birkaç osilatörle inandırıcı olmuyorlar. Boru,
// kös ve arayüz sesleri sentezde kalıyor; orada sentez zaten iyi. Dosyalar
// public/audio'da (~220 KB; kaynak ve lisanslar CREDITS.md'de), service worker
// önbelleğe alıyor, savaş çevrimdışı da duyuluyor.
//
// Her örnek isteğe bağlı: yüklenmediyse (iOS 18.4 öncesi OGG çözemez, ağ yok,
// dosya bozuk) playSample false döner ve çağıran eski sentez tarifini çalar.
// Oyun hiçbir koşulda sessiz kalmaz, dosyalar yalnızca üstüne ekler.

export type SampleId = 'swish' | 'plate' | 'bow' | 'gallop' | 'rocks'

/** public/audio altındaki çeşitler: aynı ses arka arkaya aynı duyulmasın. */
export const SAMPLE_FILES: Readonly<Record<SampleId, readonly string[]>> = {
  swish: ['swish-1.wav', 'swish-2.wav', 'swish-3.wav'],
  plate: ['plate-1.ogg', 'plate-2.ogg', 'plate-3.ogg', 'plate-4.ogg', 'plate-5.ogg'],
  bow: ['bow.wav'],
  gallop: ['gallop-grass.mp3', 'gallop-ground.mp3'],
  rocks: ['rocks-1.ogg', 'rocks-2.ogg', 'rocks-3.ogg'],
}

/** Her çalışta perdeye eklenen rastgele sapma (±%4 ≈ ±0,7 yarım ses). */
const RATE_JITTER = 0.04

const banks = new Map<SampleId, AudioBuffer[]>()
const lastPlayed = new Map<SampleId, number>()
let loading = false

/**
 * Ses kilidi açılınca bir kez çağrılır. Her ses kendi çeşitleri çözülür
 * çözülmez çalınabilir; çözülemeyen çeşit atlanır, hiçbiri çözülemezse o ses
 * sentezde kalır.
 */
export function loadSamples(ctx: BaseAudioContext): void {
  if (loading) return
  loading = true
  for (const id of Object.keys(SAMPLE_FILES) as SampleId[]) {
    void Promise.allSettled(SAMPLE_FILES[id].map((file) => decode(ctx, file))).then((results) => {
      const decoded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      if (decoded.length > 0) banks.set(id, decoded)
    })
  }
}

async function decode(ctx: BaseAudioContext, file: string): Promise<AudioBuffer> {
  const res = await fetch(`${import.meta.env.BASE_URL}audio/${file}`)
  if (!res.ok) throw new Error(`${file}: ${res.status}`)
  return ctx.decodeAudioData(await res.arrayBuffer())
}

export interface SampleOptions {
  /** Başlangıç, ctx.currentTime cinsinden. */
  at: number
  gain: number
  /** Çalma hızı; 1 özgün perde. Üstüne her çalışta küçük bir sapma eklenir. */
  rate?: number
  /** Alçak geçiren süzgeç (Hz): uzaklaşan ses. */
  lowpassHz?: number
}

/** @returns false ise örnek yok: çağıran sentezle çalsın. */
export function playSample(
  ctx: AudioContext,
  dest: AudioNode,
  id: SampleId,
  opts: SampleOptions,
): boolean {
  const bank = banks.get(id)
  if (!bank) return false
  const index = pickVariant(bank.length, lastPlayed.get(id) ?? -1, Math.random)
  lastPlayed.set(id, index)

  const src = ctx.createBufferSource()
  src.buffer = bank[index]
  src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * RATE_JITTER)
  const gain = ctx.createGain()
  gain.gain.value = opts.gain
  let out: AudioNode = gain
  if (opts.lowpassHz) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = opts.lowpassHz
    gain.connect(filter)
    out = filter
  }
  src.connect(gain)
  out.connect(dest)
  src.start(opts.at)
  return true
}

/**
 * Bu çalışta bankanın hangi çeşidi çalsın.
 *
 * @param count Bankadaki çeşit sayısı (≥ 1).
 * @param last Aynı sesin bir önceki çeşidi; ilk çalışta -1.
 * @param rand [0, 1) üretir; testte sabitlenir.
 * @returns 0..count-1
 */
export function pickVariant(count: number, last: number, rand: () => number): number {
  // TODO(human)
  return 0
}
