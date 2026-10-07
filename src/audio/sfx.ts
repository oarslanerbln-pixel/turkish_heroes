// Ses efektleri: WebAudio sentezi, gerçek kayıtlarla katmanlı.
//
// Boru, kös ve arayüz sesleri sentezleniyor; kısa, kuru ve dosyasız. Nal,
// zırh, yay ve kaya sesleri örnekten gelir (samples.ts). Örnek yüklenemezse
// aynı yerde eski sentez tarifi çalar.
//
// Tarayıcılar AudioContext'i ancak bir kullanıcı hareketinden sonra açar.
// unlockAudio() bu yüzden BAŞLA düğmesinin tıklamasında çağrılır.

import { loadSamples, playSample, type SampleId } from './samples'

export type Sfx =
  | 'strike'
  | 'refuse'
  | 'ready'
  | 'wave'
  | 'victory'
  | 'defeat'
  | 'charge'
  | 'dusk'
  | 'horn'
  | 'volley'
  | 'volleyHit'
  | 'order'
  | 'wingCharge'
  | 'rout'
  | 'rockslide'
  | 'hurt'
  | 'ui'
  | 'whistle'
  | 'whistleRain'

const MUTE_KEY = 'hilal_muted'
const HAPTICS_KEY = 'hilal_haptics'
const MASTER_VOLUME = 0.5
/** Ok vınlaması: kılıç savrulması örneği hızlı çalınır, tiz ve kısa duyulur. */
const ARROW_RATE = 1.6
/** Bölük nalında adımlar arası (sn): adımlar üst üste biner, bölük gürler. */
const HERD_STEP = 0.2

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = loadMuted()
/** Molada bağlam askıda tutulur (bkz. holdAudio). */
let held = false
/** Oyuncunun ayarı (kalıcı) ve "hareketi azalt"; titreşim ikisi de izin verirse. */
let hapticsPref = loadHapticsPref()
let motionAllows = true

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function loadHapticsPref(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== '0'
  } catch {
    return true
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Gizli sekmede localStorage atabilir; tercih bu oturumla sınırlı kalır.
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02)
  syncAudio()
}

/** Kullanıcı hareketi içinde çağrılmalı (tık, dokunma, tuş). */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      // Tarayıcı bağlamı reddedebilir (donanım yok, gizlilik ayarı): oyun sessiz sürer.
      return
    }
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_VOLUME
    master.connect(ctx.destination)
    noiseBuffer = makeNoise(ctx, 0.5)
    loadSamples(ctx)
    // Ortam sesleri (ambience.ts) sürekli çalıyor: arka planda susmalı.
    document.addEventListener('visibilitychange', syncAudio)
    // iOS bağlamı kullanıcı hareketi dışında açmayı reddedebilir (arka plandan
    // dönüş, telefon görüşmesi); her dokunuş ve tuş yeniden dener.
    window.addEventListener('pointerdown', syncAudio, true)
    window.addEventListener('keydown', syncAudio, true)
  }
  syncAudio()
}

/**
 * Molada bağlam askıya alınır: rüzgâr, müzik ve kös zamanlayıcısı durur, pil
 * harcanmaz. Bırakılınca her şey kaldığı yerden sürer. Bırakma bir kullanıcı
 * hareketinin içinden gelmeli (DEVAM, YENİDEN, KOMUTANLAR).
 */
export function holdAudio(on: boolean): void {
  held = on
  syncAudio()
}

/**
 * Bağlamı olması gereken duruma getirir. Çalmalı: kilit açılmış, sessizde
 * değil, molada değil, sekme görünür. Değilse askıya alınır.
 */
function syncAudio(): void {
  if (!ctx || ctx.state === 'closed') return
  const shouldRun = !muted && !held && !document.hidden
  // iOS'ta bağlam tiplerde olmayan 'interrupted' durumunda da kalabilir.
  if (shouldRun && ctx.state !== 'running') ctx.resume().catch(() => {})
  else if (!shouldRun && ctx.state === 'running') ctx.suspend().catch(() => {})
}

/** Açılmış ses bağlamı ve ana kanal; kilit açılmadıysa null. Ortam sesleri için. */
export function audioGraph(): { ctx: AudioContext; master: GainNode } | null {
  return ctx && master ? { ctx, master } : null
}

/**
 * Cihaz titreyebiliyor mu. iOS Safari'de API yok; masaüstü Chrome'da var ama
 * titreyecek motor yok, ayar düğmesi yalnız dokunmatikte gösterilir.
 */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/** Oyuncunun titreşim ayarı (hareketi azalttan bağımsız). */
export function hapticsEnabled(): boolean {
  return hapticsPref
}

export function setHapticsEnabled(enabled: boolean): void {
  hapticsPref = enabled
  try {
    localStorage.setItem(HAPTICS_KEY, enabled ? '1' : '0')
  } catch {
    // Gizli sekme: tercih bu oturumla sınırlı.
  }
}

/** "Hareketi azalt" titreşimi de kapatır (store yazar). */
export function setHaptics(enabled: boolean): void {
  motionAllows = enabled
}

/** Kısa titreşim: destekleyen mobil cihazlarda, ses kapalıysa da. */
export function haptic(pattern: number | number[]): void {
  if (hapticsPref && motionAllows && canVibrate()) navigator.vibrate(pattern)
}

/**
 * @param intensity 0–1; vuruşta düşen düşman oranına göre efekt güçlenir.
 */
export function play(sfx: Sfx, intensity = 1): void {
  if (!ctx || !master || muted || ctx.state !== 'running') return
  const t = ctx.currentTime

  switch (sfx) {
    case 'strike':
      // Kılıç savrulması, zırha inen darbe ve yere inen gövde (düşen ton).
      if (!sample('swish', t, 0.45 + 0.3 * intensity)) {
        noise(t, 0.35, 1800, 400, 0.5 + 0.4 * intensity)
      }
      sample('plate', t + 0.06, 0.2 + 0.5 * intensity)
      drum(t, 140, 45, 0.45, 0.8 * (0.6 + 0.4 * intensity))
      break
    case 'refuse':
      tone(t, 'square', 150, 120, 0.12, 0.12)
      break
    case 'ready':
      // Hilal kuruldu: iki notalı parlak çağrı.
      tone(t, 'triangle', 660, 660, 0.12, 0.25)
      tone(t + 0.1, 'triangle', 990, 990, 0.22, 0.25)
      break
    case 'wave':
      // Boru sesi: beşli aralık, testere dişi + alçak geçiren filtre.
      horn(t, 220, 0.35)
      horn(t + 0.28, 330, 0.6)
      break
    case 'victory':
      horn(t, 262, 0.25)
      horn(t + 0.22, 330, 0.25)
      horn(t + 0.44, 392, 0.9)
      break
    case 'defeat':
      tone(t, 'sawtooth', 196, 98, 1.2, 0.25, 600)
      break
    case 'charge':
      // Hamle uyarısı: sert, alçak Bizans borusu + nal gürültüsü.
      tone(t, 'sawtooth', 147, 139, 0.45, 0.22, 700)
      if (!herd(t, 3, 0.3)) noise(t, 0.5, 300, 120, 0.35)
      break
    case 'horn':
      // Selçuklu borusu: yükselen üç nota — "imparator korumasız".
      horn(t, 196, 0.22)
      horn(t + 0.2, 262, 0.22)
      horn(t + 0.4, 392, 0.7)
      break
    case 'volley':
      // Ok yağmuru: yay kirişi + okların vınlaması; intensity ok sayısını izler.
      if (sample('bow', t, 0.2 + 0.2 * intensity)) {
        sample('swish', t + 0.04, 0.1 + 0.15 * intensity, ARROW_RATE)
      } else {
        noise(t, 0.28, 5200, 2400, 0.12 + 0.12 * intensity)
      }
      break
    case 'whistle':
      // Islıklı ok: kemik başlıkta yükselip alçalan, uçuş boyu süren ıslık.
      tone(t, 'sine', 1300, 2300, 0.32, 0.12, 4000)
      tone(t + 0.3, 'sine', 2300, 1700, 0.3, 0.09, 4000)
      sample('swish', t, 0.12, ARROW_RATE)
      break
    case 'whistleRain':
      // Bölük ıslığın düştüğü yere boşaltır: kirişler ve yağan oklar.
      sample('bow', t, 0.18 + 0.12 * intensity)
      for (let i = 0; i < 3; i++) {
        if (!sample('swish', t + 0.05 + i * 0.07, 0.08 + 0.1 * intensity, ARROW_RATE)) {
          noise(t + i * 0.07, 0.22, 5200, 2400, 0.08 + 0.08 * intensity)
        }
      }
      break
    case 'volleyHit':
      // Yaylım saplandı: zırha inen oklar ve devrilen gövdeler.
      sample('plate', t, 0.2 + 0.4 * intensity)
      drum(t + 0.03, 120, 48, 0.4, 0.5 + 0.3 * intensity)
      break
    case 'dusk':
      // Gün batımı: üç ağır kös vuruşu.
      for (let i = 0; i < 3; i++) drum(t + i * 0.42, 90, 40, 0.5, 0.7)
      break
    case 'order':
      // Kola emir: tek kös + kısa boru — "emir alındı".
      drum(t, 110, 55, 0.25, 0.45)
      horn(t + 0.05, 294, 0.2)
      break
    case 'wingCharge':
      // Kol dönen orduya yüklendi: yükselen boru + nal gürültüsü.
      horn(t, 262, 0.2)
      horn(t + 0.16, 392, 0.5)
      if (!herd(t, 5, 0.4)) noise(t, 0.9, 380, 140, 0.45)
      break
    case 'rockslide':
      // Kaya yığını: alçak gürleme, ardışık darbeler ve taş çatırtısı.
      noise(t, 1.1, 260, 60, 0.55)
      for (let i = 0; i < 4; i++) drum(t + 0.08 + i * 0.13, 80 - i * 8, 35, 0.3, 0.5)
      for (let i = 0; i < 3; i++) sample('rocks', t + 0.05 + i * 0.18, 0.6 - i * 0.15, 1 - i * 0.12)
      break
    case 'rout':
      // Bozgun: düşmanın borusu düşerek susar, nal sesi uzaklaşır.
      tone(t, 'sawtooth', 220, 147, 0.7, 0.16, 800)
      if (!herd(t + 0.1, 5, 0.35, true)) noise(t + 0.1, 1.3, 420, 110, 0.3)
      break
    case 'hurt':
      // Oyuncu yara aldı: zırha inen darbe ve kısa, boğuk inilti. Vuruştan
      // (kılıç + kös) ayrı duyulsun diye kösü yok, perdesi orta.
      if (!sample('plate', t, 0.25 + 0.3 * intensity, 0.75, 2200)) {
        noise(t, 0.12, 900, 400, 0.3 + 0.25 * intensity)
      }
      tone(t, 'triangle', 240, 150, 0.16, 0.16 + 0.12 * intensity, 1200)
      break
    case 'ui':
      // Arayüz: kısa, yumuşak tık.
      tone(t, 'triangle', 1180, 880, 0.05, 0.07)
      break
  }
}

/** @returns false: örnek yok, çağıran sentezle çalsın. */
function sample(id: SampleId, at: number, volume: number, rate?: number, lowpassHz?: number): boolean {
  if (!ctx || !master) return false
  return playSample(ctx, master, id, { at, gain: volume, rate, lowpassHz })
}

/**
 * Bir bölük atın nalı: dörtnal adımları birbirinden biraz kayık başlar, her
 * biri ayrı çeşit ve perde. fading ise bölük uzaklaşır (kısılır, tizi gider).
 * @returns false: örnek yok, çağıran sentezle çalsın.
 */
function herd(start: number, strides: number, volume: number, fading = false): boolean {
  for (let i = 0; i < strides; i++) {
    const far = fading ? i / strides : 0
    const at = start + i * HERD_STEP + Math.random() * 0.06
    const lowpass = fading ? 2400 - 1800 * far : undefined
    if (!sample('gallop', at, volume * (1 - 0.8 * far), 1, lowpass)) return false
  }
  return true
}

/** @param dest Verilmezse ana kanal; ortam sesleri kendi kanallarını verir. */
export function tone(
  start: number,
  type: OscillatorType,
  fromHz: number,
  toHz: number,
  duration: number,
  volume: number,
  lowpassHz?: number,
  dest?: AudioNode,
): void {
  if (!ctx || !master) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(fromHz, start)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), start + duration)
  envelope(gain, start, duration, volume)

  let out: AudioNode = gain
  if (lowpassHz) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = lowpassHz
    gain.connect(filter)
    out = filter
  }
  osc.connect(gain)
  out.connect(dest ?? master)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

/**
 * Kös ve gövde vuruşu. Alçak sinüs gövdeyi taşır ama telefon hoparlörü ~150 Hz
 * altını çalmıyor: orada vuruşu deri şaplağı (bant gürültü) ile 2. ve 3.
 * harmonik duyurur. Ortam müziğinin kösü de aynı yoldan (ambience.ts).
 */
function drum(start: number, fromHz: number, toHz: number, duration: number, volume: number): void {
  tone(start, 'sine', fromHz, toHz, duration, volume)
  tone(start, 'triangle', fromHz * 2, toHz * 2, duration * 0.6, volume * 0.35)
  tone(start, 'sine', fromHz * 3, toHz * 3, duration * 0.35, volume * 0.2)
  noise(start, 0.08, 1400, 700, volume * 0.4)
}

function horn(start: number, hz: number, duration: number): void {
  tone(start, 'sawtooth', hz, hz, duration, 0.18, 900)
}

/** @param dest Verilmezse ana kanal. */
export function noise(
  start: number,
  duration: number,
  fromHz: number,
  toHz: number,
  volume: number,
  dest?: AudioNode,
): void {
  if (!ctx || !master || !noiseBuffer) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(fromHz, start)
  filter.frequency.exponentialRampToValueAtTime(toHz, start + duration)
  const gain = ctx.createGain()
  envelope(gain, start, duration, volume)
  src.connect(filter).connect(gain).connect(dest ?? master)
  src.start(start)
  src.stop(start + duration + 0.05)
}

/** Tık sesi olmasın diye hızlı atak, üstel sönüm. */
function envelope(gain: GainNode, start: number, duration: number, volume: number): void {
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
}

export function makeNoise(audio: AudioContext, seconds: number): AudioBuffer {
  const buffer = audio.createBuffer(1, audio.sampleRate * seconds, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
