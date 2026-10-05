import { isCommanderAvailable, useGameStore } from '../store/gameStore'
import { commanderInfo, type CommanderId } from '../mechanics/scenario'
import { archiveCount } from '../lore/archive'
import { earnedLore } from '../sim/progress'
import { Ornament } from './Ornament'
import { LockIcon, ScrollIcon } from './icons'
import { LoreArchive } from './LoreArchive'
import { Narrator } from './Narrator'
import { SeferMap } from './SeferMap'
import { SettingsButtons } from './SettingsButtons'

/**
 * Ana menü — savaş seçimi. Arkada seçilen savaşın açılış karesi durur
 * (CameraDirector): menü bir kapı değil, savaşın ilk anı. İki panel sahnenin
 * iki yanında, ortada kahraman ve ufuktaki ordu görünür.
 *
 *  - Solda sefer haritası: üç savaş, bozkırdan Anadolu'ya giden yolun
 *    üstünde. Düğümler ilerlemeyi gösterir (en iyi yıldız, kilit, sancak);
 *    kilitli savaş da seçilir: savaş alanı arkada görünür, açmak istenir.
 *  - Sağda brifing: eksenin sorusu, üç adımda taktik, tek ana düğme.
 *  - Bilgi Hazinesi sol panelin dibinde; sayaç yarım kalan koleksiyonu
 *    hatırlatır.
 *
 * İlk kullanıcı hareketi de burada yakalanır: tarayıcı sesi ancak bir tık ya
 * da dokunmadan sonra açıyor (bkz. store.start).
 */
export function StartScreen({ touch }: { touch: boolean }) {
  const commander = useGameStore((s) => s.commander)
  const archive = useGameStore((s) => s.archive)
  const openArchive = useGameStore((s) => s.openArchive)

  if (archive) return <LoreArchive tab={archive} />

  const earned = earnedLore()
  const total = archiveCount(earned)

  return (
    <div className="hud">
      <div className="menu">
        <section className="menu-panel menu-roster velvet" aria-label="Sefer">
          <header className="menu-brand">
            <h1>HİLAL</h1>
            <Ornament width={132} />
            <span className="menu-tagline">TÜRK KOMUTANLARININ SAVAŞ SANATI</span>
          </header>

          <SeferMap selected={commander} />

          <button className="archive-btn" onClick={() => openArchive(commander)}>
            <ScrollIcon size={16} />
            <span>BİLGİ HAZİNESİ</span>
            <b>
              {total.earned} / {total.total}
            </b>
            <i style={{ width: `${(total.earned / total.total) * 100}%` }} aria-hidden="true" />
          </button>
        </section>

        <Briefing key={commander} id={commander} touch={touch} />

        <div className="menu-settings">
          <SettingsButtons />
        </div>
      </div>
    </div>
  )
}

function Briefing({ id, touch }: { id: CommanderId; touch: boolean }) {
  const start = useGameStore((s) => s.start)
  const best = useGameStore((s) => s.bestScore)
  const c = commanderInfo(id)
  const available = isCommanderAvailable(id)
  const lore = archiveCount(earnedLore(), id)
  const keys = touch
    ? 'Sol: joystick · Sağ: vuruş'
    : `WASD: hareket · Space: vuruş${c.keys ? ` · ${c.keys}` : ''}`

  return (
    <section
      className={available ? 'menu-panel menu-brief velvet' : 'menu-panel menu-brief velvet is-locked'}
      aria-label={`${c.name} brifingi`}
    >
      <span className="brief-axis">{c.axis}</span>
      <h2>{c.question}</h2>
      <span className="brief-sub">
        {c.name} · {c.battle}
      </span>
      <div className="brief-body">
        <p className="brief-context">{c.context}</p>
        <Narrator text={c.narrator} className="brief-narrator" />
        <ol className="brief-steps">
          {c.steps.map((s) => (
            <li key={s.title}>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {available ? (
        <button className="primary-btn" onClick={start} autoFocus>
          SAVAŞA GİR
        </button>
      ) : (
        <div className="brief-locked">
          <LockIcon size={14} />
          <span>{c.unlockedBy && `${commanderInfo(c.unlockedBy).name} ile zafer kazanınca açılır`}</span>
        </div>
      )}

      <div className="brief-foot">
        <span>{keys}</span>
        {available && (
          <span className="brief-record">
            <span title="Tarih notları">
              <ScrollIcon size={11} />
              {lore.earned}/{lore.total}
            </span>
            {best > 0 && (
              <span>
                Rekor <b>{best}</b>
              </span>
            )}
          </span>
        )}
      </div>
    </section>
  )
}
