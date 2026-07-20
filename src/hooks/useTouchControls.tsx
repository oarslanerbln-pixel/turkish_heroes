import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Sol alt sanal joystick için normalize hareket vektörü.
 *
 * useKeyboard'ın ref'iyle aynı rolü oynar: modül seviyesinde tek örnek,
 * useFrame doğrudan okur, React re-render tetiklemez. Klavyeden farkı —
 * dijital değil analog: kısmi itiş kısmi hız versin diye uzunluk 0–1
 * arasında (joystick yarıçapına göre normalize), asla tam 1'e sabitlenmez.
 */
export const touchMove = { x: 0, z: 0 }

/** useKeyboard() ile simetrik: MetehanPlaceholder aynı şekilde tüketir. */
export function useTouchControls() {
  return touchMove
}

/** Cihaz dokunmatik mi? Bir kere hesaplanır — çalışma anında değişmez varsayılır. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

const JOYSTICK_RADIUS = 52 // px — kolun gidebileceği en uzak mesafe
const DEAD_ZONE = 6 // px — ufak titremeyi/yanlışlıkla dokunmayı yok say

/**
 * Sol altta sabit, sadece dokunmatik cihazda görünen sanal joystick.
 * Basılı tutulduğu sürece touchMove'u günceller, bırakılınca sıfırlar.
 */
export function TouchJoystick() {
  const [show] = useState(isTouchDevice)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  if (!show) return null

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
        left: 28,
        bottom: 28,
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
