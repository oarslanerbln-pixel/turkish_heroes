import { useGameStore } from '../store/gameStore'
import { TOTAL_WAVES } from '../mechanics/waves'
import { Ornament } from './Ornament'

export function OutcomeScreen({ outcome }: { outcome: 'victory' | 'defeat' }) {
  const restart = useGameStore((s) => s.restart)
  const kills = useGameStore((s) => s.totalKills)
  const waveIndex = useGameStore((s) => s.waveIndex)
  const score = useGameStore((s) => s.score)
  const bestScore = useGameStore((s) => s.bestScore)
  const isVictory = outcome === 'victory'
  const isNewBest = score > 0 && score >= bestScore

  return (
    <div className="screen">
      <div className={isVictory ? 'result-title is-victory' : 'result-title is-defeat'}>
        {isVictory ? 'ZAFER' : 'YENİLGİ'}
      </div>
      <Ornament width={240} />
      <div className="subtitle">
        {isVictory
          ? `${TOTAL_WAVES} dalganın hepsi kuşatıldı.`
          : `${waveIndex + 1}. dalgada düştün. Düşmanı daha uzun peşinde sürükle.`}
      </div>

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

      <button className="primary-btn" onClick={restart} autoFocus>
        YENİDEN
      </button>
    </div>
  )
}
