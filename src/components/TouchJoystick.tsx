import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { isTouchDevice, touchMove } from '../hooks/useTouchControls'
import { useGameStore } from '../store/gameStore'

const JOYSTICK_RADIUS = 52 // px — kolun gidebileceği en uzak mesafe
const DEAD_ZONE = 6 // px — ufak titremeyi/yanlışlıkla dokunmayı yok say

/**
 * Sol altta sabit, sadece dokunmatik cihazda ve oyun sürerken görünen sanal
 * joystick. Basılı tutulduğu sürece touchMove'u günceller, bırakılınca sıfırlar.
 */
export function TouchJoystick() {
  const [show] = useState(isTouchDevice)
  const started = useGameStore((s) => s.started)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  if (!show || !started) return null

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerIdRef.current = e.pointerId
    originRef.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId || !originRef.current) return

    let dx = e.clientX - originRef.current.x
    let dy = e.clientY - originRef.current.y
    const len = Math.hypot(dx, dy)

    if (len < DEAD_ZONE) {
      touchMove.x = 0
      touchMove.z = 0
      setKnob({ x: 0, y: 0 })
      return
    }

    const clampedLen = Math.min(len, JOYSTICK_RADIUS)
    dx = (dx / len) * clampedLen
    dy = (dy / len) * clampedLen
    setKnob({ x: dx, y: dy })

    // Ekranda yukarı sürüklemek "ileri" (W ile aynı yön, dz -= 1) olsun diye
    // dy işareti değiştirilmeden bırakılıyor: dy negatifse (yukarı) z de
    // negatif olur — MetehanPlaceholder'daki WASD eşlemesiyle tutarlı.
    touchMove.x = dx / JOYSTICK_RADIUS
    touchMove.z = dy / JOYSTICK_RADIUS
  }

  const release = () => {
    pointerIdRef.current = null
    originRef.current = null
    touchMove.x = 0
    touchMove.z = 0
    setKnob({ x: 0, y: 0 })
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      style={{
        position: 'absolute',
        left: 'calc(28px + env(safe-area-inset-left))',
        bottom: 'calc(28px + env(safe-area-inset-bottom))',
        width: 112,
        height: 112,
        borderRadius: '50%',
        background: 'rgba(139, 74, 0, 0.18)',
        border: '1px solid rgba(255, 215, 0, 0.35)',
        touchAction: 'none',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(255, 215, 0, 0.55)',
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          transition: pointerIdRef.current === null ? 'transform 0.15s ease' : 'none',
        }}
      />
    </div>
  )
}
