import { useGameStore } from '../store/gameStore'
import { ENEMY_CONFIG } from '../mechanics/enemySim'
import type { HilalPhase } from '../mechanics/types'

const PHASE_LABEL: Record<HilalPhase, string> = {
  idle: 'BEKLEME',
  retreat: 'SAHTE ÇEKİLME',
  gather: 'KUŞATMA',
  strike: 'VURUŞ',
}

const PHASE_COLOR: Record<HilalPhase, string> = {
  idle: '#8b7355',
  retreat: '#ffd700',
  gather: '#ff8c00',
  strike: '#ff4400',
}

export function HilalEnergyHUD() {
  // Alan bazlı seçiciler: sync her seferinde tüm HUD'u yeniden çizmesin.
  const phase = useGameStore((s) => s.phase)
  const outcome = useGameStore((s) => s.outcome)
  const hilalEnergy = useGameStore((s) => s.hilalEnergy)
  const playerHealth = useGameStore((s) => s.playerHealth)
  const attackers = useGameStore((s) => s.attackers)
  const density = useGameStore((s) => s.enemyClusterDensity)
  const discipline = useGameStore((s) => s.enemyDiscipline)
  const vulnerability = useGameStore((s) => s.vulnerability)
  const enemiesAlive = useGameStore((s) => s.enemiesAlive)
  const inCrescent = useGameStore((s) => s.inCrescent)
  const strikeReady = useGameStore((s) => s.strikeReady)
  const totalKills = useGameStore((s) => s.totalKills)
  const requestStrike = useGameStore((s) => s.requestStrike)

  return (
    <>
      {/* Sol üst — saha durumu */}
      <div style={{ ...panelStyle, top: 24, left: 24 }}>
        <Stat label="Düşman" value={String(enemiesAlive)} />
        <Stat label="Düşürülen" value={String(totalKills)} />
        <Stat label="Kümelenme" value={`%${Math.round(density * 100)}`} />
        <Stat label="Disiplin" value={`%${Math.round(discipline * 100)}`} />
        <Stat label="Kuşatılabilirlik" value={`%${Math.round(vulnerability * 100)}`} />
        <Stat label="Yayda" value={`${inCrescent} düşman`} highlight={inCrescent > 0} />
      </div>

      {/* Sol alt — Metehan'ın canı */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 2, color: '#8b7355' }}>
          METEHAN
          {attackers > 0 && (
            <span style={{ color: '#ff4400', marginLeft: 8 }}>
              ✳ {attackers} DÜŞMAN TEMASTA
            </span>
          )}
        </div>
        <div
          style={{
            width: 180,
            height: 10,
            background: '#1a0a00',
            border: '1px solid #4a3520',
            borderRadius: 5,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${playerHealth}%`,
              background: playerHealth > 40 ? '#4a8b3a' : '#c53030',
              transition: 'width 0.12s linear, background 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Alt orta — hilal enerjisi */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            color: PHASE_COLOR[phase],
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            transition: 'color 0.3s ease',
          }}
        >
          Hilal Enerjisi — {PHASE_LABEL[phase]}
        </div>

        <div
          style={{
            width: 240,
            height: 12,
            background: '#1a0a00',
            border: `1px solid ${strikeReady ? '#ff4400' : '#8b4a00'}`,
            borderRadius: 6,
            overflow: 'hidden',
            transition: 'border-color 0.3s ease',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${hilalEnergy}%`,
              background: strikeReady
                ? '#ff4400'
                : 'linear-gradient(90deg, #8b4a00, #ffd700)',
              transition: 'width 0.12s linear, background 0.3s ease',
            }}
          />
        </div>

        <button
          onClick={requestStrike}
          disabled={!strikeReady}
          style={{
            marginTop: 4,
            padding: '8px 20px',
            fontSize: 11,
            letterSpacing: 2,
            fontFamily: 'inherit',
            color: strikeReady ? '#1a0a00' : '#5c4a35',
            background: strikeReady ? '#ff4400' : 'transparent',
            border: `1px solid ${strikeReady ? '#ff4400' : '#4a3520'}`,
            borderRadius: 4,
            cursor: strikeReady ? 'pointer' : 'default',
            pointerEvents: 'auto',
            transition: 'all 0.2s ease',
          }}
        >
          {strikeReady ? 'VUR — SPACE' : 'KUŞAT'}
        </button>
      </div>

      {/* Sağ üst — kontroller */}
      <div style={{ ...panelStyle, top: 24, right: 24, textAlign: 'right' }}>
        <div style={hintStyle}>WASD — kaç, düşmanı peşinden sürükle</div>
        <div style={hintStyle}>Durursan düşman düzenini toparlar</div>
        <div style={hintStyle}>Hilal yayı menzilini gösterir —</div>
        <div style={hintStyle}>fazla uzaklaşırsan vuruş ıskalar</div>
        <div style={hintStyle}>SPACE — hilali kapat</div>
      </div>

      {outcome !== 'playing' && <OutcomeOverlay outcome={outcome} kills={totalKills} />}
    </>
  )
}

function OutcomeOverlay({ outcome, kills }: { outcome: 'victory' | 'defeat'; kills: number }) {
  const restart = useGameStore((s) => s.restart)
  const isVictory = outcome === 'victory'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'rgba(13, 5, 0, 0.82)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 40,
          letterSpacing: 8,
          color: isVictory ? '#ffd700' : '#c53030',
        }}
      >
        {isVictory ? 'ZAFER' : 'YENİLGİ'}
      </div>
      <div style={{ fontSize: 13, color: '#8b7355', letterSpacing: 1 }}>
        {isVictory
          ? `Hilal kapandı — ${kills} düşman düşürüldü.`
          : `Kuşatma tamamlanamadı — ${kills}/${ENEMY_CONFIG.count} düşman düşürüldü.`}
      </div>
      <button
        onClick={restart}
        style={{
          marginTop: 8,
          padding: '10px 28px',
          fontSize: 12,
          letterSpacing: 2,
          fontFamily: 'inherit',
          color: '#1a0a00',
          background: '#ffd700',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        YENİDEN
      </button>
    </div>
  )
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#8b7355' }}>{label}</span>
      <span style={{ color: highlight ? '#ff6a00' : '#ffd700' }}>{value}</span>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  letterSpacing: 1,
  pointerEvents: 'none',
  minWidth: 140,
}

const hintStyle: React.CSSProperties = {
  color: '#5c4a35',
  fontSize: 11,
}
