/**
 * Sol alt sanal joystick için normalize hareket vektörü.
 *
 * useKeyboard'ın ref'iyle aynı rolü oynar: modül seviyesinde tek örnek,
 * useFrame doğrudan okur, React re-render tetiklemez. Klavyeden farkı —
 * dijital değil analog: kısmi itiş kısmi hız versin diye uzunluk 0–1
 * arasında (joystick yarıçapına göre normalize), asla tam 1'e sabitlenmez.
 * Yazan taraf: components/TouchJoystick.tsx.
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
