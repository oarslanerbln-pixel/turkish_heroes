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
  | 'order'
  | 'wingCharge'
  | 'rout'
  | 'rockslide'

const MUTE_KEY = 'hilal_muted'
const MASTER_VOLUME = 0.5
/** Ok vınlaması: kılıç savrulması örneği hızlı çalınır, tiz ve kısa duyulur. */
const ARROW_RATE = 1.6
/** Bölük nalında adımlar arası (sn): adımlar üst üste biner, bölük gürler. */
const HERD_STEP = 0.2

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
    noiseBuffer = makeNoise(ctx, 0.5)
    loadSamples(ctx)
    // Ortam sesleri (ambience.ts) sürekli çalıyor: uygulama arka plana
    // geçince susmalı, dönünce devam etmeli.
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return
      if (document.hidden) void ctx.suspend()
      else void ctx.resume()
    })
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

/** Açılmış ses bağlamı ve ana kanal; kilit açılmadıysa null. Ortam sesleri için. */
export function audioGraph(): { ctx: AudioContext; master: GainNode } | null {
  return ctx && master ? { ctx, master } : null
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
      // Kılıç savrulması, zırha inen darbe ve yere inen gövde (düşen ton).
      if (!sample('swish', t, 0.45 + 0.3 * intensity)) {
        noise(t, 0.35, 1800, 400, 0.5 + 0.4 * intensity)
      }
      sample('plate', t + 0.06, 0.2 + 0.5 * intensity)
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
    case 'dusk':
      // Gün batımı: üç ağır kös vuruşu.
      for (let i = 0; i < 3; i++) tone(t + i * 0.42, 'sine', 90, 40, 0.5, 0.7)
      break
    case 'order':
      // Kola emir: tek kös + kısa boru — "emir alındı".
      tone(t, 'sine', 110, 55, 0.25, 0.45)
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
      for (let i = 0; i < 4; i++) tone(t + 0.08 + i * 0.13, 'sine', 80 - i * 8, 35, 0.3, 0.5)
      for (let i = 0; i < 3; i++) sample('rocks', t + 0.05 + i * 0.18, 0.6 - i * 0.15, 1 - i * 0.12)
      break
    case 'rout':
      // Bozgun: düşmanın borusu düşerek susar, nal sesi uzaklaşır.
      tone(t, 'sawtooth', 220, 147, 0.7, 0.16, 800)
      if (!herd(t + 0.1, 5, 0.35, true)) noise(t + 0.1, 1.3, 420, 110, 0.3)
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
