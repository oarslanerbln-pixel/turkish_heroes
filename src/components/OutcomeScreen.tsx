import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { TOTAL_WAVES } from '../mechanics/waves'
import { Ornament } from './Ornament'
import { exportTelemetry, loggedBattles, TELEMETRY_DEBUG } from '../telemetry/track'

export function OutcomeScreen({ outcome }: { outcome: 'victory' | 'defeat' }) {
  const restart = useGameStore((s) => s.restart)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const kills = useGameStore((s) => s.totalKills)
  const score = useGameStore((s) => s.score)
  const bestScore = useGameStore((s) => s.bestScore)
  const battle = useGameStore((s) => s.commander === 'alp-arslan')
  const isVictory = outcome === 'victory'
  const isNewBest = score > 0 && score >= bestScore

  return (
    <div className="screen">
      <div className={isVictory ? 'result-title is-victory' : 'result-title is-defeat'}>
        {isVictory ? 'ZAFER' : 'YENİLGİ'}
      </div>
      <Ornament width={240} />
      {battle ? <BattleSummary isVictory={isVictory} /> : <WaveSummary isVictory={isVictory} />}

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

      <div className="result-actions">
        <button className="primary-btn" onClick={restart} autoFocus>
          YENİDEN
        </button>
        <button className="secondary-btn" onClick={backToMenu}>
          KOMUTANLAR
        </button>
      </div>

      {TELEMETRY_DEBUG && <TelemetryExport />}
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

function WaveSummary({ isVictory }: { isVictory: boolean }) {
  const waveIndex = useGameStore((s) => s.waveIndex)
  return (
    <div className="subtitle">
      {isVictory
        ? `${TOTAL_WAVES} dalganın hepsi kuşatıldı.`
        : `${waveIndex + 1}. dalgada düştün. Düşmanı daha uzun peşinde sürükle.`}
    </div>
  )
}

/**
 * Malazgirt sonucu: yıldızlar ve neden. Yenilginin iki sebebi farklı ders
 * veriyor — ordugaha varış "daha erken yıprat", can "hamleden kaç".
 */
function BattleSummary({ isVictory }: { isVictory: boolean }) {
  const stars = useGameStore((s) => s.stars)
  const captured = useGameStore((s) => s.emperorCaptured)
  const cause = useGameStore((s) => s.defeatCause)

  if (!isVictory) {
    return (
      <div className="subtitle">
        {cause === 'camp'
          ? 'Bizans ordusu ordugaha ulaştı. Birlikleri daha erken taciz et.'
          : 'Ağır süvari seni çiğnedi. Kırmızıyı görünce menzilden çık.'}
      </div>
    )
  }

  return (
    <>
      <div className="stars" aria-label={`${stars} yıldız`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= stars ? 'is-earned' : undefined}>
            ★
          </span>
        ))}
      </div>
      <div className="subtitle">
        {captured
          ? 'İmparator Romanos Diogenes esir alındı; ordu teslim oldu.'
          : stars >= 2
            ? 'Gece çöktü. Bizans ordusunun yarısından fazlası düştü.'
            : 'Gece çöktü; ordu ordugaha ulaşamadı. Akşam dönüşünü kolla.'}
      </div>
      {captured && (
        <div className="epilogue">
          Alp Arslan esir imparatora iyi davrandı ve bir antlaşmayla onu serbest bıraktı.
        </div>
      )}
    </>
  )
}
