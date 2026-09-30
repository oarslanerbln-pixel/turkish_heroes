import { useState } from 'react'
import { BATTLE_CONFIG } from '../mechanics/corps'
import { world } from '../sim/world'

// Canlı ayar paneli — yalnızca ?tune ile. Prototipin işi "oynaması keyifli
// mi" sorusuna cevap bulmak; denge sabitlerini oyun sürerken oynatabilmek bu
// yüzden şart. Değerler BATTLE_CONFIG'e doğrudan yazılır ve bir sonraki
// karede geçerli olur; sayfa yenilenince tasarım değerlerine döner. Kalıcı
// hale getirilen her değer corps.test.ts'teki bot ölçütlerinden geçmeli.

type Key = keyof typeof BATTLE_CONFIG

const SLIDERS: { key: Key; label: string; min: number; max: number; step: number }[] = [
  { key: 'dayLength', label: 'Gün (sn)', min: 40, max: 160, step: 5 },
  { key: 'advanceSpeed', label: 'İlerleme', min: 0.1, max: 0.6, step: 0.01 },
  { key: 'harassDecay', label: 'Taciz düşüşü', min: 0.005, max: 0.06, step: 0.001 },
  { key: 'harassSlow', label: 'Taciz yavaşlatma', min: 0, max: 1, step: 0.05 },
  { key: 'dayFloor', label: 'Gündüz tabanı', min: 0.3, max: 0.9, step: 0.05 },
  { key: 'chargeDwell', label: 'Hamle tetiği (sn)', min: 0.5, max: 4, step: 0.1 },
  { key: 'chargeSpeed', label: 'Hamle hızı', min: 5, max: 9, step: 0.1 },
  { key: 'contactDamage', label: 'Temas hasarı', min: 4, max: 20, step: 1 },
  { key: 'turnPerDisorder', label: 'Dönüş uzaması', min: 0, max: 12, step: 0.5 },
  { key: 'rearguardThreshold', label: 'Artçı eşiği', min: 0.5, max: 1, step: 0.01 },
  { key: 'emperorThreshold', label: 'İmparator eşiği', min: 0.5, max: 1, step: 0.01 },
]

export function TuningPanel() {
  // Kaydırıcıların kendisi yeniden çizilsin diye; asıl değer BATTLE_CONFIG'te.
  const [, setVersion] = useState(0)
  const [open, setOpen] = useState(true)

  const skipToDusk = () => {
    if (world.battle) world.battle.time = Math.max(world.battle.time, BATTLE_CONFIG.dayLength - 3)
  }

  return (
    <div className="tuning">
      <button className="tuning-head" onClick={() => setOpen(!open)}>
        Ayar {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          {SLIDERS.map((s) => (
            <label key={s.key}>
              <span>
                {s.label} <b>{BATTLE_CONFIG[s.key]}</b>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={BATTLE_CONFIG[s.key]}
                onChange={(e) => {
                  BATTLE_CONFIG[s.key] = Number(e.target.value)
                  setVersion((v) => v + 1)
                }}
              />
            </label>
          ))}
          <button onClick={skipToDusk}>Gün batımına atla</button>
        </>
      )}
    </div>
  )
}
