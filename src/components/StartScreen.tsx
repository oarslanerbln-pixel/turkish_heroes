import { isCommanderAvailable, useGameStore } from '../store/gameStore'
import { COMMANDERS, commanderInfo, type CommanderId } from '../mechanics/scenario'
import { archiveCount } from '../lore/archive'
import type { LoreId } from '../lore/lore'
import { bestStars, earnedLore, hasWon, isFirstBattle } from '../sim/progress'
import { Ornament } from './Ornament'
import { LockIcon, ScrollIcon, SealIcon } from './icons'
import { LoreArchive } from './LoreArchive'

/**
 * Ana menü — savaş seçimi. Arkada seçilen savaşın açılış karesi durur
 * (FollowCamera): menü bir kapı değil, savaşın ilk anı. İki panel sahnenin
 * iki yanında, ortada kahraman ve ufuktaki ordu görünür.
 *
 *  - Solda komutanlar: üç komutan, üç soru — NASIL, NE ZAMAN, NEREDE. Her
 *    satır ilerlemeyi gösterir (yıldız ya da zafer mührü, tarih notları);
 *    kilitli komutan da seçilir: savaş alanı arkada görünür, açmak istenir.
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
        <section className="menu-panel menu-roster" aria-label="Komutanlar">
          <header className="menu-brand">
            <h1>HİLAL</h1>
            <Ornament width={132} />
            <span className="menu-tagline">TÜRK KOMUTANLARININ SAVAŞ SANATI</span>
          </header>

          <div className="roster" role="radiogroup" aria-label="Komutan">
            {COMMANDERS.map((c) => (
              <RosterRow key={c.id} id={c.id} selected={c.id === commander} earned={earned} />
            ))}
          </div>

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
      </div>
    </div>
  )
}

function RosterRow({
  id,
  selected,
  earned,
}: {
  id: CommanderId
  selected: boolean
  earned: readonly LoreId[]
}) {
  const select = useGameStore((s) => s.selectCommander)
  const c = commanderInfo(id)
  const available = isCommanderAvailable(id)
  // Kilidi yeni açılmış, henüz hiç oynanmamış savaş: YENİ.
  const fresh = available && !!c.unlockedBy && isFirstBattle(id)
  const lore = archiveCount(earned, id)
  const className = ['roster-row', selected && 'is-selected', !available && 'is-locked']
    .filter(Boolean)
    .join(' ')

  return (
    <button
      role="radio"
      aria-checked={selected}
      className={className}
      onClick={() => select(id)}
      aria-label={`${c.name}, ${c.battle}${available ? '' : ', kilitli'}`}
    >
      <span className="roster-axis">{c.axis}</span>
      <span className="roster-name">
        {c.name}
        {fresh && <em className="roster-new">YENİ</em>}
      </span>
      <span className="roster-battle">{c.battle}</span>
      <span className="roster-meta">
        {available ? (
          <>
            <Record id={id} />
            <span className="roster-lore" title="Tarih notları">
              <ScrollIcon size={12} />
              {lore.earned}/{lore.total}
            </span>
          </>
        ) : (
          <>
            <span className="roster-lock">
              <LockIcon size={11} />
              KİLİTLİ
            </span>
            {c.unlockedBy && (
              <span className="roster-unlock">{commanderInfo(c.unlockedBy).name} ile kazan</span>
            )}
          </>
        )}
      </span>
    </button>
  )
}

/**
 * Komutanın kaydı: ordu savaşında en iyi yıldız, Metehan'da (yıldızsız
 * dalga savaşı) zafer mührü. Henüz kazanılmamışsa boş yıldızlar hedefi
 * gösterir.
 */
function Record({ id }: { id: CommanderId }) {
  if (!commanderInfo(id).unlockedBy) {
    return hasWon(id) ? (
      <span className="roster-seal">
        <SealIcon size={12} />
        ZAFER
      </span>
    ) : null
  }
  const stars = bestStars(id)
  return (
    <span className="roster-stars" aria-label={`${stars} yıldız`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= stars ? 'on' : undefined}>
          ★
        </span>
      ))}
    </span>
  )
}

function Briefing({ id, touch }: { id: CommanderId; touch: boolean }) {
  const start = useGameStore((s) => s.start)
  const best = useGameStore((s) => s.bestScore)
  const c = commanderInfo(id)
  const available = isCommanderAvailable(id)
  const keys = touch
    ? 'Sol: joystick · Sağ: vuruş'
    : `WASD: hareket · Space: vuruş${c.keys ? ` · ${c.keys}` : ''}`

  return (
    <section
      className={available ? 'menu-panel menu-brief' : 'menu-panel menu-brief is-locked'}
      aria-label={`${c.name} brifingi`}
    >
      <span className="brief-axis">{c.axis}</span>
      <h2>{c.question}</h2>
      <span className="brief-sub">
        {c.name} · {c.battle}
      </span>

      <ol className="brief-steps">
        {c.steps.map((s) => (
          <li key={s.title}>
            <b>{s.title}</b>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>

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
        {available && best > 0 && (
          <span>
            Rekor <b>{best}</b>
          </span>
        )}
      </div>
    </section>
  )
}
