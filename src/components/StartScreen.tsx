import { useGameStore } from '../store/gameStore'
import { COMMANDERS, commanderInfo } from '../mechanics/scenario'
import { Ornament } from './Ornament'

/**
 * Oyunun kapısı. Üç işi var:
 *  1. Komutanı seçtirmek — her komutan kendi savaşını getiriyor.
 *  2. Seçilen savaşın taktiğini üç adımda anlatmak — mekanik sezgisel değil,
 *     anlatılmadan oyuncu "neden enerji dolmuyor" diye takılıyor.
 *  3. İlk kullanıcı hareketini yakalamak: tarayıcı sesi ancak bir tık ya da
 *     dokunmadan sonra açıyor.
 */
export function StartScreen({ touch }: { touch: boolean }) {
  const start = useGameStore((s) => s.start)
  const bestScore = useGameStore((s) => s.bestScore)
  const commander = useGameStore((s) => s.commander)
  const selectCommander = useGameStore((s) => s.selectCommander)
  const info = commanderInfo(commander)

  return (
    <div className="hud">
      <div className="screen">
        <h1>HİLAL</h1>
        <Ornament width={260} />

        <div className="commanders" role="radiogroup" aria-label="Komutan">
          {COMMANDERS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={c.id === commander}
              className={c.id === commander ? 'commander is-selected' : 'commander'}
              onClick={() => selectCommander(c.id)}
            >
              <b>{c.name}</b>
              <span>
                {c.battle}
                {c.prototype && <em>prototip</em>}
              </span>
            </button>
          ))}
        </div>

        <div className="steps">
          {info.steps.map((s) => (
            <div className="step" key={s.title}>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </div>
          ))}
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
