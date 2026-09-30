// Ses efektleri — tamamen WebAudio ile sentezleniyor.
//
// Bilinçli tercih: ses dosyası yok. Offline çalışması gereken bir PWA'da her
// varlık önbellek ve indirme maliyeti demek; birkaç osilatör ve gürültü
// tamponu bu oyunun ihtiyacı olan kısa, kuru efektleri karşılıyor.
//
// Tarayıcılar AudioContext'i ancak bir kullanıcı hareketinden sonra açar.
// unlockAudio() bu yüzden BAŞLA düğmesinin tıklamasında çağrılır.

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

const MUTE_KEY = 'hilal_muted'
const MASTER_VOLUME = 0.5

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = loadMuted()

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
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
}

/** Kullanıcı hareketi içinde çağrılmalı (tık, dokunma, tuş). */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_VOLUME
    master.connect(ctx.destination)
    noiseBuffer = makeNoise(ctx)
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

/** Kısa titreşim — yalnızca destekleyen mobil cihazlarda, ses kapalıysa da. */
export function haptic(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

/**
 * @param intensity 0–1; vuruşta düşen düşman oranına göre efekt güçlenir.
 */
export function play(sfx: Sfx, intensity = 1): void {
  if (!ctx || !master || muted || ctx.state !== 'running') return
  const t = ctx.currentTime

  switch (sfx) {
    case 'strike':
      // Kılıç savrulması (filtreli gürültü) + yere inen darbe (düşen ton).
      noise(t, 0.35, 1800, 400, 0.5 + 0.4 * intensity)
      tone(t, 'sine', 140, 45, 0.45, 0.8 * (0.6 + 0.4 * intensity))
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
      noise(t, 0.5, 300, 120, 0.35)
      break
    case 'horn':
      // Selçuklu borusu: yükselen üç nota — "imparator korumasız".
      horn(t, 196, 0.22)
      horn(t + 0.2, 262, 0.22)
      horn(t + 0.4, 392, 0.7)
      break
    case 'volley':
      // Ok yağmuru: kısa, yüksek frekanslı vızıltı; intensity ok sayısını izler.
      noise(t, 0.28, 5200, 2400, 0.12 + 0.12 * intensity)
      break
    case 'dusk':
      // Gün batımı: üç ağır kös vuruşu.
      for (let i = 0; i < 3; i++) tone(t + i * 0.42, 'sine', 90, 40, 0.5, 0.7)
      break
  }
}

function tone(
  start: number,
  type: OscillatorType,
  fromHz: number,
  toHz: number,
  duration: number,
  volume: number,
  lowpassHz?: number,
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
  out.connect(master)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

function horn(start: number, hz: number, duration: number): void {
  tone(start, 'sawtooth', hz, hz, duration, 0.18, 900)
}

function noise(start: number, duration: number, fromHz: number, toHz: number, volume: number): void {
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
  src.connect(filter).connect(gain).connect(master)
  src.start(start)
  src.stop(start + duration + 0.05)
}

/** Tık sesi olmasın diye hızlı atak, üstel sönüm. */
function envelope(gain: GainNode, start: number, duration: number, volume: number): void {
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
}

function makeNoise(audio: AudioContext): AudioBuffer {
  const buffer = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
