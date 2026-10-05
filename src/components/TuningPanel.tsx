import { useState } from 'react'
import { BATTLE_CONFIG } from '../mechanics/corps'
import { WING_CONFIG } from '../mechanics/wings'
import { world } from '../sim/world'

// Canlı ayar paneli — yalnızca ?tune ile. Prototipin işi "oynaması keyifli
// mi" sorusuna cevap bulmak; denge sabitlerini oyun sürerken oynatabilmek bu
// yüzden şart. Değerler BATTLE_CONFIG'e ve WING_CONFIG'e doğrudan yazılır ve
// bir sonraki karede geçerli olur; sayfa yenilenince tasarım değerlerine
// döner. Kalıcı hale getirilen her değer corps.test.ts ve wings.test.ts'teki
// bot ölçütlerinden geçmeli.

interface Slider {
  label: string
  min: number
  max: number
  step: number
  get: () => number
  set: (value: number) => void
}

/** Ayar nesnesinin sayısal bir alanına bağlı kaydırıcı; anahtar derlemede denetlenir. */
function slider<C extends Record<K, number>, K extends keyof C>(
  config: C,
  key: K,
  label: string,
  min: number,
  max: number,
  step: number,
): Slider {
  return {
    label,
    min,
    max,
    step,
    get: () => config[key],
    set: (value) => {
      config[key] = value as C[K]
    },
  }
}

const SLIDERS: Slider[] = [
  slider(BATTLE_CONFIG, 'dayLength', 'Gün (sn)', 40, 160, 5),
  slider(BATTLE_CONFIG, 'advanceSpeed', 'İlerleme', 0.1, 0.6, 0.01),
  slider(BATTLE_CONFIG, 'harassDecay', 'Taciz düşüşü', 0.005, 0.06, 0.001),
  slider(BATTLE_CONFIG, 'harassSlow', 'Taciz yavaşlatma', 0, 1, 0.05),
  slider(BATTLE_CONFIG, 'dayFloor', 'Gündüz tabanı', 0.3, 0.9, 0.05),
  slider(BATTLE_CONFIG, 'chargeDwell', 'Hamle tetiği (sn)', 0.5, 4, 0.1),
  slider(BATTLE_CONFIG, 'chargeSpeed', 'Hamle hızı', 5, 9, 0.1),
  slider(BATTLE_CONFIG, 'contactDamage', 'Temas hasarı', 4, 20, 1),
  slider(BATTLE_CONFIG, 'turnPerDisorder', 'Dönüş uzaması', 0, 12, 0.5),
  slider(BATTLE_CONFIG, 'rearguardThreshold', 'Artçı eşiği', 0.5, 1, 0.01),
  slider(BATTLE_CONFIG, 'emperorThreshold', 'İmparator eşiği', 0.5, 1, 0.01),
  slider(BATTLE_CONFIG, 'emperorPin', 'Merkez tutma eşiği', 0.2, 1, 0.05),
  slider(BATTLE_CONFIG, 'emperorWindow', 'İmparator penceresi (sn)', 5, 40, 1),
  slider(WING_CONFIG, 'harass', 'Kol tacizi', 0, 1, 0.05),
  slider(WING_CONFIG, 'shock', 'Kol ilk darbesi', 0, 0.6, 0.02),
  slider(WING_CONFIG, 'turnSlow', 'Kol dönüş yavaşlatma', 0, 1, 0.05),
  slider(WING_CONFIG, 'harassFatigue', 'Taciz yorgunluğu', 0, 0.04, 0.002),
  slider(WING_CONFIG, 'chargeFatigue', 'Hücum yorgunluğu', 0, 0.15, 0.005),
  slider(WING_CONFIG, 'recovery', 'Kol dinlenmesi', 0, 0.06, 0.002),
]

export function TuningPanel() {
  // Kaydırıcıların kendisi yeniden çizilsin diye; asıl değer ayar nesnelerinde.
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
            <label key={s.label}>
              <span>
                {s.label} <b>{s.get()}</b>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.get()}
                onChange={(e) => {
                  s.set(Number(e.target.value))
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
