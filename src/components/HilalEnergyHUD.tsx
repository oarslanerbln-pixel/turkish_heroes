import { useGameStore } from '../store/gameStore'

export function HilalEnergyHUD() {
  const { hilalEnergy, phase } = useGameStore()

  return (
    <div style={{
      position: 'absolute',
      bottom: 32,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none',
    }}>
      <div style={{ color: '#ffd700', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
        Hilal Enerjisi — {phase.toUpperCase()}
      </div>
      <div style={{
        width: 240,
        height: 12,
        background: '#1a0a00',
        border: '1px solid #8b4a00',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${hilalEnergy}%`,
          background: hilalEnergy >= 100
            ? '#ff4400'
            : 'linear-gradient(90deg, #8b4a00, #ffd700)',
          transition: 'width 0.1s ease, background 0.3s ease',
        }} />
      </div>
    </div>
  )
}
