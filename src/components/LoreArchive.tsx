import { useState, type KeyboardEvent } from 'react'
import { isCommanderAvailable, useGameStore } from '../store/gameStore'
import { COMMANDERS, commanderInfo, type CommanderId } from '../mechanics/scenario'
import { archiveCount, archiveOf, defaultEntry, roman } from '../lore/archive'
import type { LoreId } from '../lore/lore'
import { earnedLore } from '../sim/progress'
import { CloseIcon, LockIcon, ScrollIcon } from './icons'

/**
 * Bilgi Hazinesi: kazanılan tarih notlarının arşivi.
 *
 * Kazanılan not sonuç ekranında bir kez, savaşın ardından görülür; burada
 * istenince yeniden okunur. Kazanılmamış notun başlığı ve onu neyin açacağı
 * görünür, metni görünmez (bkz. lore/archive.ts) — boş yer bir hedeftir, ve
 * komutan açıksa hedefe giden yol tek dokunuş: SAVAŞA GİR.
 *
 * Klavye: ← → komutan, ↑ ↓ not, Esc kapatır.
 */
export function LoreArchive({ tab }: { tab: CommanderId }) {
  const openArchive = useGameStore((s) => s.openArchive)
  const close = useGameStore((s) => s.closeArchive)
  const earned = earnedLore()
  const total = archiveCount(earned)

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = COMMANDERS.findIndex((c) => c.id === tab)
    const dir = e.key === 'ArrowLeft' ? -1 : 1
    openArchive(COMMANDERS[(i + dir + COMMANDERS.length) % COMMANDERS.length].id)
  }

  return (
    <div className="hud">
      <div
        className="archive"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-title"
        onKeyDown={onKeyDown}
      >
        <header className="archive-head">
          <ScrollIcon size={20} />
          <h2 id="archive-title">BİLGİ HAZİNESİ</h2>
          <span className="archive-total">
            {total.earned} / {total.total} not
          </span>
          <button className="icon-btn archive-close" onClick={close} aria-label="Kapat (Esc)">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="archive-tabs" role="tablist" aria-label="Komutanlar">
          {COMMANDERS.map((c) => {
            const count = archiveCount(earned, c.id)
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={c.id === tab}
                className="archive-tab"
                onClick={() => openArchive(c.id)}
              >
                <span className="archive-tab-axis">{c.axis}</span>
                <span className="archive-tab-name">{c.name}</span>
                {!isCommanderAvailable(c.id) && <LockIcon size={11} />}
                <b>
                  {count.earned}/{count.total}
                </b>
              </button>
            )
          })}
        </div>

        {/* key: sekme değişince seçili not o komutanın varsayılanına döner. */}
        <ArchiveBody key={tab} tab={tab} earned={earned} />
      </div>
    </div>
  )
}

function ArchiveBody({ tab, earned }: { tab: CommanderId; earned: readonly LoreId[] }) {
  const enterBattle = useGameStore((s) => s.enterBattle)
  const [picked, setPicked] = useState<LoreId>(() => defaultEntry(tab, earned))
  const entries = archiveOf(tab, earned)
  const index = Math.max(0, entries.findIndex((e) => e.id === picked))
  const current = entries[index]
  const c = commanderInfo(tab)
  const available = isCommanderAvailable(tab)

  const onListKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const next = entries[(index + (e.key === 'ArrowUp' ? -1 : 1) + entries.length) % entries.length]
    setPicked(next.id)
    // Odak seçimle yürüsün: ekran okuyucu ve bir sonraki ok aynı yerden devam etsin.
    document.getElementById(`lore-${next.id}`)?.focus()
  }

  return (
    <div className="archive-body">
      <ol className="archive-list" role="listbox" aria-label={`${c.name} notları`} onKeyDown={onListKey}>
        {entries.map((e) => {
          const selected = e.id === current.id
          const className = [
            'archive-item',
            e.earned ? 'is-earned' : 'is-locked',
            selected && 'is-selected',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li key={e.id}>
              <button
                id={`lore-${e.id}`}
                role="option"
                aria-selected={selected}
                className={className}
                onClick={() => setPicked(e.id)}
                autoFocus={selected}
              >
                <span className="archive-no">{roman(e.no)}</span>
                <span className="archive-item-title">{e.title}</span>
                {!e.earned && <LockIcon size={12} />}
              </button>
            </li>
          )
        })}
      </ol>

      <article className="archive-card velvet" key={current.id} aria-live="polite">
        <span className="archive-card-label">
          NOT {roman(current.no)} · {c.name.toLocaleUpperCase('tr')}
        </span>
        <h3>{current.title}</h3>
        {current.earned ? (
          <>
            <p>{current.text}</p>
            <cite>{current.source}</cite>
          </>
        ) : (
          <>
            {/* Metin yerine kapalı satırlar: bir şey var, ama önce oynanmalı. */}
            <div className="archive-redacted" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="archive-unlock">
              <span>AÇMAK İÇİN</span>
              <b>
                {available
                  ? current.hint
                  : c.unlockedBy &&
                    `Önce ${commanderInfo(c.unlockedBy).name} ile ${c.unlockWave ? `${c.unlockWave}. dalgaya ulaş` : 'zafer kazan'}`}
              </b>
            </div>
            {available && (
              <button className="secondary-btn archive-go" onClick={() => enterBattle(tab)}>
                SAVAŞA GİR
              </button>
            )}
          </>
        )}
      </article>
    </div>
  )
}
