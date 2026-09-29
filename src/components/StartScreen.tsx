import { useGameStore } from '../store/gameStore'

/**
 * Oyunun kapısı. İki işi var:
 *  1. Taktiği üç adımda anlatmak — mekanik sezgisel değil, anlatılmadan
 *     oyuncu "neden enerji dolmuyor" diye takılıyor.
 *  2. İlk kullanıcı hareketini yakalamak: tarayıcı sesi ancak bir tık ya da
 *     dokunmadan sonra açıyor.
 */
export function StartScreen({ touch }: { touch: boolean }) {
  const start = useGameStore((s) => s.start)
  const bestScore = useGameStore((s) => s.bestScore)

  return (
    <div className="hud">
      <div className="screen">
        <h1>HİLAL</h1>
        <div className="subtitle">Metehan'ın kuşatma taktiği · MÖ 209</div>

        <div className="steps">
          <div className="step">
            <b>1 · Çekil</b>
            <span>Kaçıyormuş gibi yap. Düşman peşine düştükçe düzeni bozulur.</span>
          </div>
          <div className="step">
            <b>2 · Topla</b>
            <span>Düzeni bozulan düşman kümelenir. Hilal enerjisi böyle dolar.</span>
          </div>
          <div className="step">
            <b>3 · Kuşat</b>
            <span>Enerji dolunca yayı kapat. Yaydaki herkes düşer.</span>
          </div>
        </div>

        <div className="controls-hint">
          {touch
            ? 'Sol parmak: joystick · Sağ parmak: vuruş düğmesi'
            : 'WASD / oklar: hareket · Space: vuruş'}
        </div>

        <button className="primary-btn" onClick={start} autoFocus>
          BAŞLA
        </button>

        {bestScore > 0 && <div className="controls-hint">Rekor {bestScore}</div>}
      </div>
    </div>
  )
}
