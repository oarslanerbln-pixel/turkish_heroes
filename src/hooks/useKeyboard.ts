import { useEffect, useRef } from 'react'

/**
 * Basılı tutulan tuşları bir ref'te toplar.
 * State yerine ref: tuş değişimi re-render tetiklemez, useFrame doğrudan okur.
 */
export function useKeyboard() {
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => keys.current.add(e.code)
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.code)
    // Sekme değişince tuş "basılı kalmasın".
    const onBlur = () => keys.current.clear()

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return keys
}
