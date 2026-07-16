import { useGameStore } from '../store/gameStore'
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
  const hilalEnergy = useGameStore((s) => s.hilalEnergy)
  const density = useGameStore((s) => s.enemyClusterDensity)
  const discipline = useGameStore((s) => s.enemyDiscipline)
  const vulnerability = useGameStore((s) => s.vulnerability)
  const enemiesAlive = useGameStore((s) => s.enemiesAlive)
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
        <div style={hintStyle}>WASD — çekil, düşmanı peşinden sürükle</div>
        <div style={hintStyle}>Küme sıkıştıkça enerji dolar</div>
        <div style={hintStyle}>SPACE — hilali kapat</div>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#8b7355' }}>{label}</span>
      <span style={{ color: '#ffd700' }}>{value}</span>
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
