import { useState, type CSSProperties } from 'react'
import { useGameStore } from '../store/gameStore'
import { commanderInfo } from '../mechanics/scenario'
import type { Debrief, TimelineMark } from '../debrief/debrief'
import { LORE, type LoreCard } from '../lore/lore'
import { earnedLore, reachedBaideng } from '../sim/progress'
import { BAIDENG_WAVE, retryWave } from '../mechanics/waves'
import { Ornament } from './Ornament'
import { StarIcon } from './icons'
import { exportTelemetry, loggedBattles, TELEMETRY_DEBUG } from '../telemetry/track'
import { DataConsent } from './DataConsent'

/**
 * autoFocus yerine: odak ana düğmede (klavyede Enter) ama ekran ona kaymaz.
 * Kısa ekranda düğmeler kıvrımın altındaydı; kayınca ZAFER görünmüyordu.
 */
function focusInPlace(el: HTMLButtonElement | null) {
  el?.focus({ preventScroll: true })
}

/**
 * Sonuç ekranı: oyuncunun "bir daha" kararını verdiği yer (Kapı B). Solda
 * (dikeyde üstte) sonuç ve savaş karnesi (bkz. debrief/debrief.ts), sağda
 * (altta) eylem. Başlık ve düğmeler her ekranda birlikte görünür; arası
 * kendi kutusunda kayar. Tavsiye bilerek eylem düğmelerinin hemen üstünde:
 * "bir dahakine şunu yapacağım" niyeti YENİDEN'e basmadan hemen önce kurulsun.
 */
export function OutcomeScreen({ outcome }: { outcome: 'victory' | 'defeat' }) {
  const restart = useGameStore((s) => s.restart)
  const restartAt = useGameStore((s) => s.restartAt)
  const waveIndex = useGameStore((s) => s.waveIndex)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const playCommander = useGameStore((s) => s.playCommander)
  const kills = useGameStore((s) => s.totalKills)
  const score = useGameStore((s) => s.score)
  const bestScore = useGameStore((s) => s.bestScore)
  const commander = useGameStore((s) => s.commander)
  const battle = commander !== 'metehan'
  const stars = useGameStore((s) => s.stars)
  const captured = useGameStore((s) => s.emperorCaptured)
  const cause = useGameStore((s) => s.defeatCause)
  const report = useGameStore((s) => s.debrief)
  const unlocked = useGameStore((s) => s.unlocked)
  const lore = useGameStore((s) => s.lore)
  const isVictory = outcome === 'victory'
  // Gece hedefi tutmadan çöktü: ordu ayakta, oyuncu sahadan çekildi (bkz. corps.ts nightGoal).
  const withdrew = !isVictory && cause === 'night'
  const isNewBest = score > 0 && score >= bestScore
  // Metehan zaferinde "kıl payı" başlıkta söyleniyor; rozet yenilginin ve
  // bir sonraki yıldızın "az kaldı"sı için.
  const showClose = report?.close && (battle || !isVictory)
  // Metehan'da Baideng'e bir kez varan oradan da başlar. YENİDEN Baideng'de
  // biten savaşı oradan başlatır; öteki seçenek (BAŞTAN ya da BAİDENG'DEN) yanında.
  const checkpoint = !battle && reachedBaideng()
  const fromBaideng = !battle && retryWave(waveIndex) === BAIDENG_WAVE

  return (
    <div className="screen outcome">
      <div className="outcome-main">
        <div
          className={
            isVictory ? 'result-title is-victory' : `result-title is-defeat${withdrew ? ' is-long' : ''}`
          }
        >
          {isVictory ? 'ZAFER' : withdrew ? 'GERİ ÇEKİLDİN' : 'YENİLGİ'}
        </div>
        <Ornament width={240} />
        {isVictory && <Stars count={stars} />}
        <div className="subtitle">
          {showClose && <span className="close-chip">AZ KALDI</span>}
          {report?.headline ?? (isVictory ? 'Zafer.' : 'Yenilgi.')}
        </div>
        {captured && <div className="epilogue">{EPILOGUE[commander]}</div>}

        <div className="outcome-scroll">
          <div className="result-stats">
            <div>
              Skor <b>{score}</b>
            </div>
            <div>
              Düşürülen <b>{kills}</b>
            </div>
            <div>
              Rekor <b>{bestScore}</b>
            </div>
          </div>
          {isNewBest && <div className="badge">YENİ REKOR</div>}
          {lore && <LoreNote card={lore} />}
          {report && <Karne report={report} battle={battle} />}
        </div>
      </div>

      <div className="outcome-side">
        {/* Kilit açıldıysa tek çağrı yeni komutan: tavsiye onu gölgelemesin. */}
        {report && !unlocked && (
          <div className="karne-advice">
            <span>SONRAKİ HAMLE</span>
            {report.advice.text}
          </div>
        )}

        {unlocked ? (
          <div className="unlock">
            <span className="unlock-label">YENİ KOMUTAN</span>
            <b>{commanderInfo(unlocked).name}</b>
            <span>{commanderInfo(unlocked).battle}</span>
            <button className="primary-btn" onClick={() => playCommander(unlocked)} ref={focusInPlace}>
              SAVAŞA GİR
            </button>
          </div>
        ) : null}

        <div className="result-actions">
          <button
            className={unlocked ? 'secondary-btn' : 'primary-btn'}
            onClick={restart}
            ref={unlocked ? undefined : focusInPlace}
          >
            {fromBaideng ? "BAİDENG'DEN" : 'YENİDEN'}
          </button>
          {checkpoint && (
            <button className="secondary-btn" onClick={() => restartAt(fromBaideng ? 0 : BAIDENG_WAVE)}>
              {fromBaideng ? 'BAŞTAN' : "BAİDENG'DEN"}
            </button>
          )}
          <button className="secondary-btn" onClick={backToMenu}>
            KOMUTANLAR
          </button>
        </div>

        <DataConsent />
        {TELEMETRY_DEBUG && <TelemetryExport />}
      </div>
    </div>
  )
}

/** Üç yıldızın (imparator / Manuel) tarihteki sonucu. */
const EPILOGUE: Partial<Record<string, string>> = {
  'alp-arslan': 'Alp Arslan esir imparatora iyi davrandı ve bir antlaşmayla onu serbest bıraktı.',
  kilicarslan:
    "Manuel barış istedi ve sınır kalelerini yıkmayı kabul etti. Miryokefalon'la Anadolu'nun Türk yurdu olduğu kesinleşti.",
}

/**
 * Bu savaşta kazanılan tarih notu: oyuncunun az önce yaptığı hamlenin
 * tarihteki karşılığı (bkz. lore/lore.ts). Sayaç koleksiyonu hatırlatır.
 */
function LoreNote({ card }: { card: LoreCard }) {
  return (
    <aside className="lore-note" aria-label="Tarih notu">
      <span className="lore-label">
        TARİH NOTU · YENİ
        <em>
          {earnedLore().length} / {LORE.length}
        </em>
      </span>
      <b>{card.title}</b>
      <p>{card.text}</p>
      <cite>{card.source}</cite>
    </aside>
  )
}

function Stars({ count }: { count: number }) {
  return (
    <div className="stars" aria-label={`${count} yıldız`}>
      {[1, 2, 3].map((n) => (
        <StarIcon key={n} size={30} className={n <= count ? 'is-earned' : undefined} />
      ))}
    </div>
  )
}

/**
 * Savaş karnesi: savaşın zaman çizelgesi, en iyi an ve bir sonraki hedef. Sıra
 * bilinçli: önce ne oldu (çizelge), sonra en iyi an (zirve), sonra ne kadar
 * yaklaştın (hedef). Ne yapmalı (tavsiye) karnede değil, düğmelerin üstünde.
 */
function Karne({ report, battle }: { report: Debrief; battle: boolean }) {
  const { goal, peak, timeline } = report
  const progress = goal ? Math.min(1, goal.value / Math.max(1, goal.target)) : 0

  return (
    <section className="karne" aria-label="Savaş karnesi">
      {/* Boş şerit bir şey anlatmaz: hiç vuruş ya da olay yoksa gösterilmez. */}
      {timeline.marks.length > 0 && (
        <Timeline marks={timeline.marks} dusk={timeline.dusk} battle={battle} />
      )}
      {peak && <div className="karne-peak">{peak}</div>}
      {goal && (
        <div className="karne-goal">
          <div className="karne-goal-row">
            <span>{goal.label}</span>
            <b>
              {goal.value} / {goal.target} {goal.unit}
            </b>
          </div>
          <div className="bar">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
    </section>
  )
}

/** Vuruş noktasının çapı (px): düşen sayısıyla büyür, üst sınırlı. */
function strikeSize(kills: number): number {
  return Math.round(6 + Math.min(12, kills * 0.5))
}

/**
 * Savaşın şeridi: altın noktalar vuruşlar (büyüklüğü düşen sayısı), kırmızı
 * çentikler hamleler, dikey çizgiler dalga sonları. Malazgirt'te şerit gün
 * batımında geceye döner — hilali nerede harcadığın bir bakışta görünsün.
 */
function Timeline({
  marks,
  dusk,
  battle,
}: {
  marks: TimelineMark[]
  dusk: number | null
  battle: boolean
}) {
  const best = marks.reduce((m, x) => (x.kind === 'strike' && (x.size ?? 0) > (m?.size ?? 0) ? x : m), null as TimelineMark | null)
  return (
    <div className="timeline">
      <div
        className={dusk === null ? 'tl-track' : 'tl-track has-dusk'}
        style={dusk === null ? undefined : ({ '--dusk': `${dusk * 100}%` } as CSSProperties)}
      >
        {marks.map((m, i) => (
          <i
            key={i}
            className={`tl-${m.kind}`}
            style={
              {
                left: `${m.at * 100}%`,
                '--size': m.kind === 'strike' ? `${strikeSize(m.size ?? 0)}px` : undefined,
              } as CSSProperties
            }
          >
            {m === best && <em>{m.size}</em>}
          </i>
        ))}
      </div>
      <div className="tl-legend">
        <span className="tl-key-strike">vuruş</span>
        {battle ? (
          <>
            <span className="tl-key-charge">hamle</span>
            {dusk !== null && <span className="tl-key-dusk">gün batımı</span>}
            {marks.some((m) => m.kind === 'block') && <span className="tl-key-block">yol kesildi</span>}
            {marks.some((m) => m.kind === 'ambush') && <span className="tl-key-ambush">pusu</span>}
          </>
        ) : (
          <span className="tl-key-wave">dalga sonu</span>
        )}
      </div>
    </div>
  )
}

/** ?telemetry: telefonda oynanan testin savaş özetlerini panoya alır. */
function TelemetryExport() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = () => {
    // Pano yalnızca güvenli bağlamda (https / localhost) var.
    if (!navigator.clipboard) return setStatus('failed')
    navigator.clipboard.writeText(exportTelemetry()).then(
      () => setStatus('copied'),
      () => setStatus('failed'),
    )
  }
  return (
    <button className="secondary-btn" onClick={copy}>
      {status === 'copied'
        ? 'KOPYALANDI'
        : status === 'failed'
          ? 'KOPYALANAMADI'
          : `VERİYİ KOPYALA · ${loggedBattles()} SAVAŞ`}
    </button>
  )
}
