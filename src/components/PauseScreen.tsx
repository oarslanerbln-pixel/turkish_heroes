import { useGameStore } from '../store/gameStore'
import { commanderInfo } from '../mechanics/scenario'
import { BAIDENG_WAVE, retryWave } from '../mechanics/waves'
import { Ornament } from './Ornament'
import { CrescentIcon } from './icons'

/**
 * Mola: savaş donuk, sahne arkada. Taktiğin üç adımı hatırlatılır — uzun bir
 * aradan dönen oyuncu neyi kovaladığını unutmuş olabilir.
 */
export function PauseScreen({ touch }: { touch: boolean }) {
  const resume = useGameStore((s) => s.resume)
  const restart = useGameStore((s) => s.restart)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const commander = useGameStore((s) => s.commander)
  const info = commanderInfo(commander)
  // Baideng'de yeniden başlamak üç dalgayı geri getirmez: düğme nereye döndüğünü söylesin.
  const fromBaideng = useGameStore((s) => commander === 'metehan' && retryWave(s.waveIndex) === BAIDENG_WAVE)

  return (
    <div className="screen is-pause">
      <section className="pause-panel velvet" aria-label="Mola">
        <div className="crest" aria-hidden="true">
          <CrescentIcon size={30} />
        </div>
        <div className="result-title is-pause">MOLA</div>
        <Ornament width={220} />

        <div className="steps">
          {info.steps.map((s) => (
            <div className="step" key={s.title}>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </div>
          ))}
        </div>

        <button className="primary-btn" onClick={resume} autoFocus>
          DEVAM
        </button>
        <div className="result-actions">
          <button className="secondary-btn" onClick={restart}>
            {fromBaideng ? "BAİDENG'DEN BAŞLA" : 'YENİDEN BAŞLA'}
          </button>
          <button className="secondary-btn" onClick={backToMenu}>
            KOMUTANLAR
          </button>
        </div>
        {!touch && <div className="controls-hint">Esc: devam</div>}
      </section>
    </div>
  )
}
