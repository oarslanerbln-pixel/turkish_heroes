import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Uygulamadan çıkılınca (telefonda başka uygulamaya geçiş, ekran kilidi;
 * masaüstünde pencere değişimi) savaş molaya girer. Dönüşte oyuncu DEVAM
 * diyene kadar donuk kalır: geri döndüğü an düşmanın ortasında bulmasın.
 */
export function useAutoPause() {
  useEffect(() => {
    const pause = () => useGameStore.getState().pause(true)
    const onVisibility = () => {
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', pause)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', pause)
    }
  }, [])
}
