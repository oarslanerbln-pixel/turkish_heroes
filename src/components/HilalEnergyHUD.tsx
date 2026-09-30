import { useState, type CSSProperties } from 'react'
import { useGameStore } from '../store/gameStore'
import { TOTAL_WAVES } from '../mechanics/waves'
import { BATTLE_CONFIG, COLUMN_CONFIG } from '../mechanics/corps'
import { WING_CONFIG, type WingOrder } from '../mechanics/wings'
import { commanderInfo } from '../mechanics/scenario'
import type { HilalPhase } from '../mechanics/types'
import { isTouchDevice } from '../hooks/useTouchControls'
import { OutcomeScreen } from './OutcomeScreen'
import { PauseScreen } from './PauseScreen'
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

const ORDER_LABEL: Record<WingOrder, string> = {
  ambush: 'PUSU',
  harass: 'TACİZ',
  charge: 'HÜCUM',
}

const WINGS = [
  { name: 'SOL KOL', key: 'Q' },
  { name: 'SAĞ KOL', key: 'E' },
]
/** Geçitte kollar yamaçları tutar. */
const PASS_WINGS = [
  { name: 'SOL YAMAÇ', key: 'Q' },
  { name: 'SAĞ YAMAÇ', key: 'E' },
]

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
  const paused = useGameStore((s) => s.paused)
  const waveIndex = useGameStore((s) => s.waveIndex)
  const battle = useGameStore((s) => s.commander !== 'metehan')
  const pass = useGameStore((s) => s.commander === 'kilicarslan')
  const [touch] = useState(isTouchDevice)

  if (!started) return <StartScreen touch={touch} />

  return (
    <div className={touch ? 'hud is-touch' : 'hud'}>
      <StatusCard />
      <Corner />
      <EnergyPanel touch={touch} />
      {touch && <TouchStrikeButton />}
      {battle && outcome === 'playing' && <DayLine pass={pass} />}
      {battle && outcome === 'playing' && <WingButtons touch={touch} pass={pass} />}
      {pass && outcome === 'playing' && <BlockadeButton touch={touch} />}
      {outcome === 'playing' && <Announcement />}
      {/* key ile her yeni dalgada yeniden mount olur, CSS animasyonu baştan oynar. */}
      {outcome === 'playing' &&
        (battle ? <BattleBanner pass={pass} /> : <WaveBanner key={waveIndex} index={waveIndex} />)}
      {outcome === 'playing' && paused && <PauseScreen touch={touch} />}
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
  const commander = useGameStore((s) => s.commander)
  const battleTime = useGameStore((s) => s.battleTime)
  const campDistance = useGameStore((s) => s.campDistance)
  const battle = commander !== 'metehan'
  const pass = commander === 'kilicarslan'
  const isDay = pass || battleTime < BATTLE_CONFIG.dayLength

  return (
    <div className="hud-card">
      <div className="hud-row">
        {battle ? (
          // Gündüz asıl tehdit ordunun hedefe (ordugah / geçidin çıkışı) varması.
          <span className={isDay && campDistance < 6 ? 'contact' : undefined}>
            {isDay ? (
              <>
                {pass ? 'Çıkışa' : 'Ordugaha'} <b>{Math.ceil(campDistance)}</b>
              </>
            ) : (
              'Ordu dönüyor'
            )}
          </span>
        ) : (
          <span>
            Dalga <b>{waveIndex + 1}/{TOTAL_WAVES}</b>
          </span>
        )}
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
        <span>{commanderInfo(commander).name}</span>
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
  const pause = useGameStore((s) => s.pause)
  const playing = useGameStore((s) => s.outcome === 'playing')

  return (
    <div className="hud-corner">
      {playing && (
        <button className="icon-btn" onClick={() => pause(false)} aria-label="Mola" title="Mola (Esc)">
          <PauseIcon />
        </button>
      )}
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
        {refusal === 'steady' && '✕ Düzenleri sağlam — önce taciz et'}
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

/**
 * Selçuklu kollarının emir düğmeleri. Her basış sıradaki emri verir
 * (pusu → taciz → hücum). Gücü azalan kol pusuda dinlenirken düğme bunu
 * söyler: oyuncu neden emir alınmadığını görsün. Masaüstünde kollar ekranın
 * kendi yanında; dokunmatikte sol alt joystick'in, ikisi de vuruş düğmesinin
 * üstünde sağ başparmağın erişiminde.
 */
function WingButtons({ touch, pass }: { touch: boolean; pass: boolean }) {
  const names = pass ? PASS_WINGS : WINGS
  const orders = useGameStore((s) => s.wingOrders)
  const strength = useGameStore((s) => s.wingStrength)
  const cycleWing = useGameStore((s) => s.cycleWing)
  if (orders.length === 0) return null

  return (
    <div className="wings">
      {orders.map((order, i) => {
        const power = strength[i] ?? 0
        const resting = order === 'ambush' && power < WING_CONFIG.readyStrength
        return (
          <button
            key={i}
            className={`wing-btn is-${resting ? 'resting' : order}`}
            // pointerdown: vuruş düğmesi gibi gecikmesiz.
            onPointerDown={() => cycleWing(i)}
          >
            <span className="wing-name">
              {names[i].name}
              {!touch && <kbd>{names[i].key}</kbd>}
            </span>
            <b>{resting ? 'DİNLENİYOR' : ORDER_LABEL[order]}</b>
            <span className="wing-bar">
              <span style={{ width: `${Math.round(power * 100)}%` }} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Gün çizgisi: güneş öğleden gün batımına, oradan geceye kayar. Savaşın
 * saati oyuncunun asıl kararını belirliyor (şimdi mi vurmalı, akşamı mı
 * beklemeli), o yüzden her an görünür.
 */
function DayLine({ pass }: { pass: boolean }) {
  const time = useGameStore((s) => s.battleTime)
  // Geçitte gün batımı dönüşü yok: çizgi doğrudan geceye akar.
  const nightAt = pass ? COLUMN_CONFIG.nightAt : BATTLE_CONFIG.nightAt
  const dayLength = pass ? nightAt : BATTLE_CONFIG.dayLength
  const isDay = time < dayLength
  const left = Math.max(0, Math.ceil((isDay ? dayLength : nightAt) - time))
  const pct = (Math.min(time, nightAt) / nightAt) * 100

  return (
    <div className="day-line">
      <div className="day-track" style={{ '--dusk': `${(dayLength / nightAt) * 100}%` } as CSSProperties}>
        <span className={isDay ? 'sun' : 'sun is-moon'} style={{ left: `${pct}%` }} />
      </div>
      <div className="day-label">
        {pass ? `Geceye ${left}` : isDay ? `Gün batımına ${left}` : `Gece çökmesine ${left}`}
      </div>
    </div>
  )
}

/** Tek satırlık duyuru ("Güneş batıyor"); key ile her yeni metinde yeniden canlanır. */
function Announcement() {
  const text = useGameStore((s) => s.announcement)
  if (!text) return null
  return (
    <div className="announce" key={text}>
      {text}
    </div>
  )
}

function BattleBanner({ pass }: { pass: boolean }) {
  return (
    <div className="wave-banner">
      <h2>{pass ? 'MİRYOKEFALON' : 'MALAZGİRT'}</h2>
      <Ornament width={200} />
      <p>
        {pass
          ? '17 Eylül 1176 — Bizans ordusu Tzivritze geçidinde'
          : '26 Ağustos 1071 — Bizans ordusu ufukta'}
      </p>
    </div>
  )
}

/**
 * YOLU KES: geçidin tek kararı. Savaş başına bir kez; düştükten sonra düğme
 * yığının kalan sağlamlığını gösterir — öncü temizlerken oyuncu görsün,
 * tacizle yavaşlatsın. Hiçbir zaman disabled değil: tekrar basış gerekçe söyler.
 */
function BlockadeButton({ touch }: { touch: boolean }) {
  const canBlock = useGameStore((s) => s.canBlock)
  const strength = useGameStore((s) => s.blockade)
  const dropBlockade = useGameStore((s) => s.dropBlockade)
  const state = canBlock ? 'is-ready' : strength > 0 ? 'is-up' : 'is-spent'

  return (
    <button className={`wing-btn block-btn ${state}`} onPointerDown={dropBlockade}>
      <span className="wing-name">
        KAYA YIĞINI
        {!touch && <kbd>R</kbd>}
      </span>
      <b>{canBlock ? 'YOLU KES' : strength > 0 ? 'YOL KESİK' : 'YOL AÇIK'}</b>
      <span className="wing-bar">
        <span style={{ width: `${Math.round((canBlock ? 1 : strength) * 100)}%` }} />
      </span>
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

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="4" width="5" height="16" rx="1.5" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" />
    </svg>
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
