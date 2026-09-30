// Sürekli sesler: bozkır rüzgârı ve savaş müziği (bordun + kös).
//
// Efektler (sfx.ts) tek seferlik; buradakiler ses açıldığı andan itibaren
// hep çalar ve tek bir ortam kanalından geçer. Vuruşta bu kanal kısılır
// (duck): kuşatmanın kapandığı an efekt ortamın üstünde net duyulsun.
// Müzik de dosyasız: iki bordun notası ve hilal enerjisiyle hızlanan bir kös.
// Telefon hoparlörü ~150 Hz altını çalamıyor; bu yüzden bordun testere dişi
// (üst harmonikleri duyulur), kösün de deri sesi var.

import { audioGraph, isMuted, makeNoise, noise, tone } from './sfx'

/** Rüzgârın durgun ve tam esintideki seviyesi. */
const WIND_BASE = 0.035
const WIND_GUST = 0.1
/** Sert esintide duyulan ıslık; eşiğin altında sessiz. */
const WHISTLE_VOLUME = 0.025
const WHISTLE_FROM_GUST = 0.55

/** Bordun: La (A2) ve Mi (E3), hafif akortsuz çiftler yavaş dalgalanır. */
const DRONE_HZ = [110, 110 * 1.0017, 164.81, 164.81 * 0.9983]
const DRONE_VOLUME = 0.03
/** Gerilim arttıkça bordun parlaklaşır (alçak geçiren filtre açılır). */
const DRONE_CUTOFF_CALM = 380
const DRONE_CUTOFF_TENSE = 900

/** Kös aralığı (sn): enerji boşken ağır, hilal kurulduğunda iki kat hızlı. */
const BEAT_CALM = 1.5
const BEAT_TENSE = 0.75
/** Bu gerilimin üstünde vuruşların arasına hafif bir ara vuruş girer. */
const GHOST_TENSION = 0.45
const KOS_VOLUME = 0.28
/** Zamanlayıcı her tikte bu kadar ilerisini planlar (sn). */
const LOOKAHEAD = 0.3
const SCHEDULER_MS = 100

/** Vuruşta ortam kanalının kısılması: derinlik, bekleme ve toparlanma (τ). */
const DUCK_DEPTH = 0.85
const DUCK_HOLD = 0.3
const DUCK_RELEASE = 0.5

interface Graph {
  ctx: AudioContext
  bus: GainNode
  windGain: GainNode
  windFilter: BiquadFilterNode
  whistleGain: GainNode
  whistleFilter: BiquadFilterNode
  music: GainNode
  droneFilter: BiquadFilterNode
}

let graph: Graph | null = null
let musicOn = false
let tension = 0
let sentTension = -1
let nextBeat = 0

/** Ses kilidi açıldıktan hemen sonra (BAŞLA) çağrılır; ikinci çağrı etkisiz. */
export function startAmbience(): void {
  const audio = audioGraph()
  if (graph || !audio) return
  const { ctx, master } = audio

  const bus = ctx.createGain()
  bus.connect(master)

  // Rüzgâr: 4 sn'lik döngüde gürültü. Kısa tampon (0,5 sn) döngüde tekrarı
  // kulağa ritim gibi geliyordu.
  const windSrc = ctx.createBufferSource()
  windSrc.buffer = makeNoise(ctx, 4)
  windSrc.loop = true
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'bandpass'
  windFilter.Q.value = 0.7
  windFilter.frequency.value = 400
  const windGain = ctx.createGain()
  windGain.gain.value = WIND_BASE
  windSrc.connect(windFilter).connect(windGain).connect(bus)

  const whistleFilter = ctx.createBiquadFilter()
  whistleFilter.type = 'bandpass'
  whistleFilter.Q.value = 12
  whistleFilter.frequency.value = 900
  const whistleGain = ctx.createGain()
  whistleGain.gain.value = 0
  windSrc.connect(whistleFilter).connect(whistleGain).connect(bus)
  windSrc.start()

  const music = ctx.createGain()
  music.gain.value = 0
  music.connect(bus)
  const droneFilter = ctx.createBiquadFilter()
  droneFilter.type = 'lowpass'
  droneFilter.frequency.value = DRONE_CUTOFF_CALM
  const droneGain = ctx.createGain()
  droneGain.gain.value = DRONE_VOLUME
  droneFilter.connect(droneGain).connect(music)
  for (const hz of DRONE_HZ) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = hz
    osc.connect(droneFilter)
    osc.start()
  }

  graph = { ctx, bus, windGain, windFilter, whistleGain, whistleFilter, music, droneFilter }
  // Başlamadan önce istenmiş durum varsa uygula.
  if (musicOn) music.gain.setTargetAtTime(1, ctx.currentTime, 1.5)
  setInterval(scheduleBeats, SCHEDULER_MS)
}

/** @param gust 0–1, oyuncunun bulunduğu yerdeki esinti (bkz. world/wind.ts). */
export function setWind(gust: number): void {
  if (!graph) return
  const t = graph.ctx.currentTime
  graph.windGain.gain.setTargetAtTime(WIND_BASE + WIND_GUST * gust, t, 0.25)
  graph.windFilter.frequency.setTargetAtTime(300 + 500 * gust, t, 0.25)
  const whistle = Math.max(0, (gust - WHISTLE_FROM_GUST) / (1 - WHISTLE_FROM_GUST))
  graph.whistleGain.gain.setTargetAtTime(WHISTLE_VOLUME * whistle, t, 0.3)
  graph.whistleFilter.frequency.setTargetAtTime(750 + 550 * gust, t, 0.3)
}

/**
 * Her karede çağrılabilir; yalnızca değişimde ses motoruna yazar.
 * @param on Savaş sürüyor mu (menüde ve sonuç ekranında müzik susar).
 * @param level 0–1 gerilim: hilal enerjisinin doluluğu.
 */
export function setBattleMusic(on: boolean, level: number): void {
  tension = Math.min(1, Math.max(0, level))
  const changed = on !== musicOn
  musicOn = on
  if (!graph) return
  const t = graph.ctx.currentTime
  if (changed) graph.music.gain.setTargetAtTime(on ? 1 : 0, t, on ? 1.5 : 0.6)
  if (Math.abs(tension - sentTension) > 0.05) {
    sentTension = tension
    const cutoff = DRONE_CUTOFF_CALM + (DRONE_CUTOFF_TENSE - DRONE_CUTOFF_CALM) * tension
    graph.droneFilter.frequency.setTargetAtTime(cutoff, t, 0.5)
  }
}

/** Vuruş anı: ortam kanalı hızla kısılır, bir nefes sonra geri gelir. */
export function duck(share: number): void {
  if (!graph) return
  const gain = graph.bus.gain
  const t = graph.ctx.currentTime
  const depth = DUCK_DEPTH * (0.6 + 0.4 * Math.min(1, share))
  gain.cancelScheduledValues(t)
  gain.setValueAtTime(gain.value, t)
  gain.setTargetAtTime(1 - depth, t, 0.02)
  gain.setTargetAtTime(1, t + DUCK_HOLD, DUCK_RELEASE)
}

/** Kös vuruşlarını ses saatinde önceden planlar: kare hızından bağımsız, titremesiz. */
function scheduleBeats(): void {
  if (!graph || !musicOn || isMuted() || graph.ctx.state !== 'running') return
  const now = graph.ctx.currentTime
  // Uzun aradan sonra (menü, arka plan) kaçan vuruşları telafi etme.
  if (nextBeat < now) nextBeat = now + 0.05
  while (nextBeat < now + LOOKAHEAD) {
    const interval = BEAT_CALM + (BEAT_TENSE - BEAT_CALM) * tension
    kos(nextBeat, 1)
    if (tension > GHOST_TENSION) kos(nextBeat + interval / 2, 0.4)
    nextBeat += interval
  }
}

function kos(start: number, volume: number): void {
  if (!graph) return
  // Gövde: düşen sinüs. Deri: kısa, bant geçiren gürültü — küçük hoparlörde
  // vuruşu duyuran kısım.
  tone(start, 'sine', 120, 55, 0.45, KOS_VOLUME * volume, undefined, graph.music)
  noise(start, 0.09, 520, 220, 0.14 * volume, graph.music)
}
