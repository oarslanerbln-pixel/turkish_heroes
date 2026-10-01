import { isCommanderAvailable, useGameStore } from '../store/gameStore'
import {
  CAMPAIGN_NODES,
  campaignFrontier,
  MAP_HEIGHT,
  MAP_WIDTH,
  segmentPath,
  type CampaignNode,
  type NodeProgress,
} from '../mechanics/campaign'
import { commanderInfo, type CommanderId } from '../mechanics/scenario'
import { bestStars, hasWon, isFirstBattle } from '../sim/progress'
import { CrescentIcon, LockIcon, SancakIcon, StarIcon } from './icons'

function readProgress(id: CommanderId): NodeProgress {
  const available = isCommanderAvailable(id)
  return {
    id,
    available,
    won: hasWon(id),
    stars: bestStars(id),
    fresh: available && !!commanderInfo(id).unlockedBy && isFirstBattle(id),
  }
}

/**
 * Sefer haritası (bkz. mechanics/campaign): komutan seçimi bozkırdan
 * Anadolu'ya giden yolun üstünde yapılır. Yol SVG'de, düğümler onun üstünde
 * HTML düğmeleri; böylece odak, ekran okuyucu ve ↑/↓ sırası liste gibi
 * çalışır.
 *
 *  - Kilidi açık savaşa giden yol kesik çizgi (kervan yolu), kapalısı
 *    seyrek nokta.
 *  - Mühür: kazanılmış savaşta hilal, kilitlide kilit.
 *  - Sancak sıradaki hedefte durur; ona giden yol yürür.
 */
export function SeferMap({ selected }: { selected: CommanderId }) {
  const progress = CAMPAIGN_NODES.map((n) => readProgress(n.id))
  const frontier = campaignFrontier(progress)

  return (
    <div className="sefer" role="radiogroup" aria-label="Sefer haritası">
      <svg className="sefer-route" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-hidden="true">
        {CAMPAIGN_NODES.slice(1).map((to, i) => {
          const open = progress[i + 1].available
          const className = [open ? 'is-open' : 'is-closed', open && to.id === frontier && 'is-march']
            .filter(Boolean)
            .join(' ')
          return <path key={to.id} d={segmentPath(CAMPAIGN_NODES[i], to)} className={className} />
        })}
        {/* Pusula: kuzey yukarıda, yol batıya iner. */}
        <g className="sefer-compass" transform={`translate(${MAP_WIDTH - 16} ${MAP_HEIGHT - 22})`}>
          <path d="M0 -8 L2.6 0 H-2.6 Z" />
          <path d="M0 8 L2.6 0 H-2.6 Z" className="is-south" />
          <text y="-11" textAnchor="middle">
            K
          </text>
        </g>
      </svg>

      {CAMPAIGN_NODES.map((n, i) => (
        <MapNode
          key={n.id}
          node={n}
          progress={progress[i]}
          selected={n.id === selected}
          frontier={n.id === frontier}
        />
      ))}
    </div>
  )
}

function MapNode({
  node,
  progress,
  selected,
  frontier,
}: {
  node: CampaignNode
  progress: NodeProgress
  selected: boolean
  frontier: boolean
}) {
  const select = useGameStore((s) => s.selectCommander)
  const c = commanderInfo(node.id)
  const className = [
    'sefer-node',
    `is-${node.label}`,
    selected && 'is-selected',
    !progress.available && 'is-locked',
    progress.won && 'is-won',
  ]
    .filter(Boolean)
    .join(' ')
  const status = progress.available ? `${progress.stars} yıldız` : 'kilitli'

  return (
    <button
      role="radio"
      aria-checked={selected}
      className={className}
      style={{ left: `${(node.x / MAP_WIDTH) * 100}%`, top: `${(node.y / MAP_HEIGHT) * 100}%` }}
      onClick={() => select(node.id)}
      aria-label={`${c.name}, ${c.battle}, ${status}${frontier ? ', sıradaki hedef' : ''}`}
    >
      <span className="sefer-seal">
        {frontier && <SancakIcon size={16} className="sefer-sancak" />}
        {!progress.available ? (
          <LockIcon size={11} />
        ) : progress.won ? (
          <CrescentIcon size={13} />
        ) : (
          <i />
        )}
      </span>
      <span className="sefer-label">
        <span className="sefer-name">
          {c.name}
          {/* Hiç oynanmamış savaşın yıldızı yok: yerinde YENİ durur. */}
          {progress.fresh ? (
            <em className="sefer-new">YENİ</em>
          ) : (
            progress.available && <Stars n={progress.stars} />
          )}
        </span>
        <span className="sefer-battle">{c.battle}</span>
      </span>
    </button>
  )
}

/** En iyi yıldız; kazanılmamışsa boş yıldızlar hedefi gösterir. */
function Stars({ n }: { n: number }) {
  return (
    <span className="sefer-stars">
      {[1, 2, 3].map((k) => (
        <StarIcon key={k} size={9} className={k <= n ? 'on' : undefined} />
      ))}
    </span>
  )
}
