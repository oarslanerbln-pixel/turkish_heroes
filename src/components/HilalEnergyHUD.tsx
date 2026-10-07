import { useState, type CSSProperties } from 'react'
import { useGameStore, type Cinematic } from '../store/gameStore'
import { TOTAL_WAVES } from '../mechanics/waves'
import { BATTLE_CONFIG, COLUMN_CONFIG } from '../mechanics/corps'
import { WING_CONFIG, type WingOrder } from '../mechanics/wings'
import type { HilalPhase } from '../mechanics/types'
import { isTouchDevice } from '../hooks/useTouchControls'
import { usePortraitPhone } from '../hooks/usePortraitPhone'
import { OutcomeScreen } from './OutcomeScreen'
import { PauseScreen } from './PauseScreen'
import { RotateOverlay } from './RotateOverlay'
import { StartScreen } from './StartScreen'
import { TitleScreen } from './TitleScreen'
import { Ornament } from './Ornament'
import { SettingsButtons } from './SettingsButtons'
import { PERF_OVERLAY, QUALITY, SESSION_MULTISAMPLING, useQuality } from '../perf/quality'
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

/** Bu canın altında çubuk kırmızı ve taralı. */
const LOW_HEALTH = 40

const PHASE_COLOR: Record<HilalPhase, string> = {
  idle: '#cda9a0',
  retreat: '#ffd700',
  gather: '#ff8c00',
  strike: '#ff5a1a',
}

/**
 * Dalga başlığının alt satırı: Mete'nin seferleri Shiji 110'daki sırayla
 * (doğuda Donghu, batıda Yüeçi, güneyde Loufan ve Baiyang, sonra Baideng)
 * ve o dalganın yeni kuralı.
 */
const WAVE_HINT = [
  'Doğu Hu — düşmanı peşine tak, düzenini boz',
  'Yüeçi — bir kol yandan dolanıp kaçış yolunu kesiyor',
  'Loufan ve Baiyang — düşman daha çabuk toparlanıyor',
  "Baideng, MÖ 200 — Gaozu'nun arbaletleri: kırmızı halkadan çık",
]

/**
 * Oyun içi arayüz. Bilinçli olarak az bilgi: skor, dalga, can ve hilal
 * enerjisi. Mekaniğin iç değişkenleri (kümelenme, disiplin…) yalnızca
 * geliştirme modunda sağ üstte görünür.
 */
export function HilalEnergyHUD() {
  const mode = useGameStore((s) => s.mode)
  const outcome = useGameStore((s) => s.outcome)
  const waveIndex = useGameStore((s) => s.waveIndex)
  const battle = useGameStore((s) => s.commander !== 'metehan')
  const pass = useGameStore((s) => s.commander === 'kilicarslan')
  const cinematic = useGameStore((s) => s.cinematic)
  const title = useGameStore((s) => s.title)
  const [touch] = useState(isTouchDevice)
  const portrait = usePortraitPhone()

  // Giriş ekranı solarken menü altında kurulmuş olsun.
  if (mode === 'menu')
    return (
      <>
        {title !== 'open' && <StartScreen touch={touch} />}
        {title !== 'closed' && <TitleScreen touch={touch} />}
      </>
    )
  // Savaş sürüyor (molada da): sonuç gelene kadar savaş arayüzü yerinde.
  const live = mode !== 'outcome'
  const paused = mode === 'paused'

  return (
    <div className={`hud${touch ? ' is-touch' : ''}${paused ? ' is-paused' : ''}${cinematic ? ' is-cinematic' : ''}`}>
      {live && <HurtFlash />}
      {/* Açılış çekiminde savaş arayüzü şeritlerin ardında bekler, çekim bitince belirir. */}
      <div className="hud-controls">
        <StatusCard />
        <Corner />
        <EnergyPanel touch={touch} />
        {touch && live && <TouchStrikeButton />}
        {battle && live && <DayLine pass={pass} />}
        {battle && live && <WingButtons touch={touch} pass={pass} />}
      </div>
      {live && <Letterbox touch={touch} kind={cinematic} />}
      {live && <Announcement />}
      {/* key ile her yeni dalgada yeniden mount olur, CSS animasyonu baştan oynar. */}
      {live &&
        (battle ? (
          <BattleBanner pass={pass} opening={cinematic === 'opening'} />
        ) : (
          <WaveBanner key={waveIndex} index={waveIndex} opening={cinematic === 'opening'} />
        ))}
      {paused && <PauseScreen touch={touch} />}
      {!live && outcome !== 'playing' && <OutcomeScreen outcome={outcome} />}
      {touch && portrait && live && <RotateOverlay />}
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
    <div className="hud-card velvet">
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
      {/*
        Rekor ve komutan adı savaşta yer tutmuyor: rekor sonuç ekranında,
        komutan menüde. Dikey ekranda kart düşmanın geldiği yönü kapatıyordu.
      */}
      <div className="hud-row">
        <span className={score > 0 && score >= bestScore ? 'hud-score is-best' : 'hud-score'}>
          {score}
        </span>
        {attackers > 0 && <span className="contact">{attackers} temasta</span>}
      </div>
      {/* Düşük can yalnız renkle söylenmez: çubuk taranır (renk körlüğü, güneşte ekran). */}
      <div
        className={health > LOW_HEALTH ? 'bar' : 'bar is-low'}
        role="meter"
        aria-label="Can"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(health)}
      >
        <span
          style={{
            width: `${health}%`,
            backgroundColor: health > LOW_HEALTH ? 'var(--health)' : 'var(--danger)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * Yara anında ekran kenarı kızarır ve söner. Sayaç değişince yeniden oynar;
 * bağlandığı andaki değer sayılmaz (yeni savaşa eski yara taşınmasın).
 * Yalnız solar, kaymaz: hareketi azaltta da kalır.
 */
function HurtFlash() {
  const pulse = useGameStore((s) => s.hurtPulse)
  const [mounted] = useState(pulse)
  if (pulse === mounted) return null
  return <div key={pulse} className="hurt-flash" aria-hidden="true" />
}

function Corner() {
  const pause = useGameStore((s) => s.pause)
  const playing = useGameStore((s) => s.mode !== 'outcome')

  return (
    <div className="hud-corner">
      {playing && (
        <button className="icon-btn" onClick={() => pause(false)} aria-label="Mola" title="Mola (Esc)">
          <PauseIcon />
        </button>
      )}
      <SettingsButtons />
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
      dpr {dpr.toFixed(2)} · msaa {SESSION_MULTISAMPLING}
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
  const whistleReady = useGameStore((s) => s.whistleReady)

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
      {/* Islıklı ok (Metehan): hazırsa yere dokunmak yeter; değilse ne beklediği söylenir. */}
      {whistleReady !== null && (
        <div className={whistleReady ? 'whistle-pill is-ready' : 'whistle-pill'}>
          {whistleReady
            ? touch
              ? 'Islıklı ok hazır — yere dokun'
              : 'Islıklı ok hazır — yere tıkla'
            : 'Islıklı ok — hilalden sonra'}
        </div>
      )}
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
      {/* Kolların kutusunda: aradaki boşluk kol düğmesinin yüksekliğinden doğar, sabit konumdan değil. */}
      {pass && <BlockadeButton touch={touch} />}
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
            <b>{resting ? 'YORGUN' : ORDER_LABEL[order]}</b>
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

/**
 * Sinema şeritleri: savaş açılışında ve hilal yaylımında üstten ve alttan
 * kayarak iner (MIMARI.md §8). DOM'da çizilir, sahnenin efekt zincirine
 * dokunmaz (G3). Alt şeritte atlama ipucu: herhangi bir dokunuş ya da tuş
 * çekimi geçer, girdi kilitlenmez. Yaylım kısa ve sık: ipucu yazılmaz.
 */
function Letterbox({ touch, kind }: { touch: boolean; kind: Cinematic | null }) {
  // Şeritler çekilirken de son çekimin ipucu durur: yaylımın ardından yazı belirmesin.
  const [last, setLast] = useState(kind)
  if (kind !== null && kind !== last) setLast(kind)
  return (
    <div className={`letterbox${kind ? ' is-on' : ''}`} aria-hidden="true">
      <div className="letterbox-bar" />
      <div className="letterbox-bar">
        {last !== 'volley' && <span className="letterbox-skip">{touch ? 'Geçmek için dokun' : 'Geçmek için bir tuşa bas'}</span>}
      </div>
    </div>
  )
}

/**
 * Açılış çekiminde afiş tarih kartı olur: alt üçte birde, çekim boyunca durur.
 * Sınıf takıldığı anda sabitlenir: çekim atlanınca kart yerinden sıçramaz, söner.
 */
function useBannerClass(opening: boolean): string {
  const [card] = useState(opening)
  return card ? 'wave-banner is-opening' : 'wave-banner'
}

function BattleBanner({ pass, opening }: { pass: boolean; opening: boolean }) {
  const className = useBannerClass(opening)
  return (
    <div className={className}>
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

function WaveBanner({ index, opening }: { index: number; opening: boolean }) {
  const className = useBannerClass(opening)
  return (
    <div className={className}>
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
