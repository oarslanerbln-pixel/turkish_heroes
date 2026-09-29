import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { TOTAL_WAVES } from '../mechanics/waves'
import type { HilalPhase } from '../mechanics/types'
import { isTouchDevice } from '../hooks/useTouchControls'
import { OutcomeScreen } from './OutcomeScreen'
import { StartScreen } from './StartScreen'
import { Ornament } from './Ornament'
import { PERF_OVERLAY, QUALITY, useQuality } from '../perf/quality'
import type { QualityTier } from '../perf/quality'
import './hud.css'

const PHASE_LABEL: Record<HilalPhase, string> = {
  idle: 'Bekleme',
  retreat: 'Sahte çekilme',
  gather: 'Kuşatma',
  strike: 'Vuruş',
}

const PHASE_COLOR: Record<HilalPhase, string> = {
  idle: '#8b7355',
  retreat: '#ffd700',
  gather: '#ff8c00',
  strike: '#ff5a1a',
}

/** Dalga bannerının alt satırı — oyuncuya neyin değiştiğini söyler. */
const WAVE_HINT = [
  'Düşmanı peşine tak, düzenini boz',
  'Düşman artık daha çabuk toparlanıyor',
  'Son dalga — ordunun tamamı karşında',
]

/**
 * Oyun içi arayüz. Bilinçli olarak az bilgi: skor, dalga, can ve hilal
 * enerjisi. Mekaniğin iç değişkenleri (kümelenme, disiplin…) yalnızca
 * geliştirme modunda sağ üstte görünür.
 */
export function HilalEnergyHUD() {
  const started = useGameStore((s) => s.started)
  const outcome = useGameStore((s) => s.outcome)
  const waveIndex = useGameStore((s) => s.waveIndex)
  const [touch] = useState(isTouchDevice)

  if (!started) return <StartScreen touch={touch} />

  return (
    <div className={touch ? 'hud is-touch' : 'hud'}>
      <StatusCard />
      <Corner />
      <EnergyPanel touch={touch} />
      {touch && <TouchStrikeButton />}
      {/* key ile her yeni dalgada yeniden mount olur, CSS animasyonu baştan oynar. */}
      {outcome === 'playing' && <WaveBanner key={waveIndex} index={waveIndex} />}
      {outcome !== 'playing' && <OutcomeScreen outcome={outcome} />}
    </div>
  )
}

function StatusCard() {
  const waveIndex = useGameStore((s) => s.waveIndex)
  const enemiesAlive = useGameStore((s) => s.enemiesAlive)
  const score = useGameStore((s) => s.score)
  const bestScore = useGameStore((s) => s.bestScore)
  const health = useGameStore((s) => s.playerHealth)
  const attackers = useGameStore((s) => s.attackers)

  return (
    <div className="hud-card">
      <div className="hud-row">
        <span>
          Dalga <b>{waveIndex + 1}/{TOTAL_WAVES}</b>
        </span>
        <span>
          Düşman <b>{enemiesAlive}</b>
        </span>
      </div>
      <div className={score > 0 && score >= bestScore ? 'hud-score is-best' : 'hud-score'}>
        {score}
      </div>
      <div className="hud-row">
        <span>Rekor {bestScore}</span>
      </div>
      <div className="hud-row">
        <span>Metehan</span>
        {attackers > 0 && <span className="contact">{attackers} temasta</span>}
      </div>
      <div className="bar">
        <span
          style={{
            width: `${health}%`,
            backgroundColor: health > 40 ? 'var(--health)' : 'var(--danger)',
          }}
        />
      </div>
    </div>
  )
}

function Corner() {
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)

  return (
    <div className="hud-corner">
      <button
        className="icon-btn"
        onClick={toggleMute}
        aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
        title={muted ? 'Sesi aç' : 'Sesi kapat'}
      >
        <SpeakerIcon muted={muted} />
      </button>
      {PERF_OVERLAY && <PerfBadge />}
      {import.meta.env.DEV && <DevStats />}
    </div>
  )
}

const TIER_LABEL: Record<QualityTier, string> = { low: 'düşük', medium: 'orta', high: 'yüksek' }

/** Gerçek cihaz testinde hangi kademede olunduğunu gösterir (?perf). */
function PerfBadge() {
  const tier = useQuality((s) => s.tier)
  const locked = useQuality((s) => s.locked)
  // R3F'in kullandığı değerle aynı hesap: [1, maxDpr] aralığına sıkıştırılmış.
  const dpr = Math.min(Math.max(1, window.devicePixelRatio), QUALITY[tier].maxDpr)

  return (
    <div className="dev-stats">
      kalite {TIER_LABEL[tier]}
      {locked && ' (sabit)'}
      <br />
      dpr {dpr.toFixed(2)}
    </div>
  )
}

/** Denge ayarı yaparken bakılan iç değişkenler — oyuncuya gösterilmez. */
function DevStats() {
  const density = useGameStore((s) => s.enemyClusterDensity)
  const discipline = useGameStore((s) => s.enemyDiscipline)
  const vulnerability = useGameStore((s) => s.vulnerability)
  const inCrescent = useGameStore((s) => s.inCrescent)
  const pct = (v: number) => `%${Math.round(v * 100)}`

  return (
    <div className="dev-stats">
      kümelenme {pct(density)}
      <br />
      disiplin {pct(discipline)}
      <br />
      kuşatılabilirlik {pct(vulnerability)}
      <br />
      yayda {inCrescent}
    </div>
  )
}

function EnergyPanel({ touch }: { touch: boolean }) {
  const phase = useGameStore((s) => s.phase)
  const energy = useGameStore((s) => s.hilalEnergy)
  const refusal = useGameStore((s) => s.refusal)
  const strikeReady = useGameStore((s) => s.strikeReady)
  const inCrescent = useGameStore((s) => s.inCrescent)
  const requestStrike = useGameStore((s) => s.requestStrike)

  // Oyuncu basmadan önce durumu bilsin: şarj mı, menzil mi, yoksa hazır mı.
  const canStrike = strikeReady && inCrescent > 0
  const label = !strikeReady
    ? 'Kuşat — şarj oluyor'
    : inCrescent === 0
      ? 'Menzile al'
      : `Vur — Space (${inCrescent})`

  return (
    <div className={strikeReady ? 'energy is-ready' : 'energy'}>
      {/*
        Tuşa basıldığında ekranda hiçbir şey olmaması kabul edilemez: oyuncu
        tuşun bozuk olduğunu sanıyor. Ret her zaman gerekçesiyle söylenir.
      */}
      <div className="refusal" key={refusal}>
        {refusal === 'notReady' && '✕ Hilal hazır değil — kaçmaya devam et'}
        {refusal === 'noTargets' && '✕ Menzilde düşman yok — yayın içine al'}
      </div>
      <div className="phase" style={{ color: PHASE_COLOR[phase] }}>
        Hilal — {PHASE_LABEL[phase]}
      </div>
      <div className="bar">
        <span style={{ width: `${energy}%` }} />
      </div>
      {/*
        Buton hiçbir zaman disabled değil: devre dışı buton tıklanınca hiçbir
        şey söylemez, oyuncu da bozuk sanır. Her tık ya vurur ya gerekçe verir.
        Dokunmatikte sağ alttaki büyük düğme bu işi görüyor.
      */}
      {!touch && (
        <button className={canStrike ? 'strike-btn is-live' : 'strike-btn'} onClick={requestStrike}>
          {label.toUpperCase()}
        </button>
      )}
    </div>
  )
}

/** Sağ başparmağın rahat erişeceği büyük vuruş düğmesi. */
function TouchStrikeButton() {
  const strikeReady = useGameStore((s) => s.strikeReady)
  const inCrescent = useGameStore((s) => s.inCrescent)
  const requestStrike = useGameStore((s) => s.requestStrike)
  const canStrike = strikeReady && inCrescent > 0

  return (
    <button
      className={canStrike ? 'strike-touch is-live' : 'strike-touch'}
      // pointerdown: click'in ~100 ms'lik gecikmesi vuruş hissini öldürüyor.
      onPointerDown={requestStrike}
    >
      {canStrike ? `VUR (${inCrescent})` : strikeReady ? 'MENZİL' : 'KUŞAT'}
    </button>
  )
}

function WaveBanner({ index }: { index: number }) {
  return (
    <div className="wave-banner">
      <h2>{index + 1}. DALGA</h2>
      <Ornament width={200} />
      <p>{WAVE_HINT[index] ?? ''}</p>
    </div>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
      {muted ? (
        <path d="m23 9-6 6M17 9l6 6" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
      )}
    </svg>
  )
}
