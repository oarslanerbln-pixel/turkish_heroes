import { useEffect, type CSSProperties } from 'react'
import { mulberry32 } from '../mechanics/random'
import { useGameStore } from '../store/gameStore'
import './title.css'

/**
 * Giriş ekranı: kâğıda kömürle çizilmiş bir gece. Kömür göğe sürülür, sırtlar
 * çizilir, ay sırtın ardından doğar; atlılar sırtta yürür, ocak başında
 * Aydoğdu anlatmaya başlar. Bir dokunuş ya da tuş menüyü açar: menü altta
 * kurulur, bu ekran üstünde solar.
 *
 * Katmanlar ayrı SVG'ler: dokulu, süzgeçli olanlar (gök, sırtlar) bir kez
 * çizilip durur; kare kare değişenler (ay, yıldızlar, atlılar, ateş) süzgeçsiz
 * ya da küçük alanlı katmanlarda. Son kare temel stildir, animasyonlar ondan
 * geriye doğru oynar: hareketi azaltta ekran doğrudan son hâliyle gelir.
 */
export function TitleScreen({ touch }: { touch: boolean }) {
  const leaving = useGameStore((s) => s.title === 'leaving')
  const closeTitle = useGameStore((s) => s.closeTitle)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || PASSIVE_KEYS.has(e.key)) return
      // Solarken altta menünün SAVAŞA GİR'i odakta: basılı tutulan Enter ya da
      // Space onu tetikleyip doğrudan savaşa sokmasın. Yakalama evresinde.
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault()
      if (!e.repeat) leave()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div
      className={leaving ? 'title is-leaving' : 'title'}
      aria-hidden={leaving || undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'title-out') closeTitle()
      }}
    >
      <Sky />
      <Stars />
      <Moon />
      <Land />
      <Lines />
      <Riders />
      <div className="title-paper" />

      <div className="title-text">
        <h1 className="title-name">
          {[...'HİLAL'].map((ch, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties}>
              {ch}
            </span>
          ))}
        </h1>
        <svg className="title-rule" viewBox="0 0 240 14" aria-hidden="true">
          <path pathLength={1} d="M4 7.5C40 6.4 78 7.6 108 7" />
          <path pathLength={1} d="M132 7C162 7.6 200 6.5 236 7.4" />
          <path className="title-rule-moon" d="M123 2.2a5 5 0 1 0 0 9.6a6 6 0 0 1 0-9.6z" />
        </svg>
        <p className="title-story">
          {STORY.map((line, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties}>
              {line}
            </span>
          ))}
        </p>
        <span className="title-credit">AYDOĞDU · KURGU BİR DERVİŞ-OZAN, HORASAN, 1180&apos;LER</span>
      </div>

      <button className="title-start" tabIndex={leaving ? -1 : 0} onClick={leave} autoFocus>
        <span>{touch ? 'Başlamak için dokun' : 'Başlamak için bir tuşa bas'}</span>
      </button>
    </div>
  )
}

/** Anlatıcının sözü: alıntı değil (HIKAYE.md §2). Son satır seferin finalini önceler. */
const STORY = [
  'Ay doğdu, kervan konakladı.',
  'Ocak başında size üç hikâye anlatayım:',
  'biri bekleyenin, biri bırakanın, biri durmayı bilenin.',
]

/** Tek başına basılınca giriş ekranını geçmeyen tuşlar (kısayol, odak gezinmesi). */
const PASSIVE_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'])

function leave(): void {
  const s = useGameStore.getState()
  if (s.title !== 'open') return
  // Odak solan (aria-hidden) ekranda kalmasın; menü kendi düğmesini odaklar.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  s.leaveTitle()
}

// ── Çizim ───────────────────────────────────────────────────────────────────
// Tuval 1600×900; ekranı kırparak doldurur (slice). Kalem izleri tohumlu
// rastgeleyle bir kez üretilir: her açılışta aynı resim.

const rand = mulberry32(1176)
const between = (a: number, b: number) => a + (b - a) * rand()
const n = (v: number) => Math.round(v * 10) / 10

type Pt = [number, number]

/** Atlıların yürüdüğü sırtın tepesi: soldan sağa hafif yokuş. */
const RIDGE_Y = 650
const RIDGE_SLOPE = -0.032
const crest = (x: number) => RIDGE_Y + RIDGE_SLOPE * x

function polyline(p: Pt[]): string {
  return p.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('')
}

/** Noktalardan geçen yumuşak çizgi: orta noktalara ikinci derece eğri. */
function smooth(p: Pt[]): string {
  let d = `M${n(p[0][0])} ${n(p[0][1])}`
  for (let i = 1; i < p.length - 1; i++) {
    d += `Q${n(p[i][0])} ${n(p[i][1])} ${n((p[i][0] + p[i + 1][0]) / 2)} ${n((p[i][1] + p[i + 1][1]) / 2)}`
  }
  const last = p[p.length - 1]
  return `${d}L${n(last[0])} ${n(last[1])}`
}

/** Elin titremesi: aynı çizginin bir kez daha, biraz kayarak çekilişi. */
const wobble = (p: Pt[], amount: number): Pt[] => p.map(([x, y]) => [x + between(-amount, amount), y + between(-amount, amount)])

const toBottom = 'L1620 900L-20 900Z'

/** Uzak sırtlar: ay bunların ardından doğar. */
const HILLS: Pt[] = [
  [-20, 600], [90, 575], [200, 586], [320, 552], [430, 571], [540, 548], [640, 566], [760, 540],
  [880, 561], [990, 532], [1100, 557], [1210, 537], [1320, 561], [1420, 544], [1520, 566], [1620, 552],
]
const RIDGE: Pt[] = Array.from({ length: 42 }, (_, i) => {
  const x = -20 + i * 40
  return [x, crest(x) + between(-2, 2)]
})
const NEAR: Pt[] = [
  [-20, 770], [160, 752], [320, 770], [520, 800], [760, 822], [1000, 812], [1240, 790], [1420, 768], [1620, 778],
]

/**
 * El taraması: birbirine koşut kısa çizgilerden bir öbek. Çizgiler sırayla
 * çekilir; öbekler soldan sağa.
 */
function hatch(x: number, y: number, angle: number, len: number, count: number, gap: number, start: number) {
  return Array.from({ length: count }, (_, k) => {
    const l = len * between(0.7, 1.1)
    const sx = x + k * gap * Math.sin(-angle) + between(-0.6, 0.6)
    const sy = y + k * gap * Math.cos(angle) * 0.2 + between(-1.5, 1.5)
    return {
      d: `M${n(sx)} ${n(sy)}l${n(Math.cos(angle) * l)} ${n(Math.sin(angle) * l)}`,
      delay: start + k * 0.05,
    }
  })
}

/** Sırtın kömür taraması. */
const HATCH = Array.from({ length: 30 }, () => {
  const x = between(-10, 1590)
  const y = between(crest(x) + 20, crest(x) + 92)
  return hatch(x, y, between(-1.2, -0.95), between(11, 20), 4 + Math.floor(rand() * 4), 3.6, 1 + (x / 1600) * 1.4)
}).flat()

/** Ay tarafına (sağa) inen yamaçlarda ay ışığı: kenarın altında silgi taraması. */
const RIM = HILLS.slice(0, -1).flatMap(([x0, y0], i) => {
  const [x1, y1] = HILLS[i + 1]
  if (y1 <= y0) return []
  const slope = Math.atan2(y1 - y0, x1 - x0)
  const t = between(0.2, 0.45)
  const x = x0 + (x1 - x0) * t
  const y = y0 + (y1 - y0) * t + 5
  return hatch(x, y, slope + 0.55, between(9, 15), 3 + Math.floor(rand() * 3), 4.5, 0.9 + (x0 / 1600) * 1.2)
})

/** Ön yamacın üst kenarı (doğrusal ara değer; tutamlar kenarın biraz altından çıkar). */
function nearTop(x: number): number {
  const i = NEAR.findIndex(([px]) => px >= x)
  if (i <= 0) return NEAR[0][1]
  const [x0, y0] = NEAR[i - 1]
  const [x1, y1] = NEAR[i]
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

/** Ot tutamları: ön yamacın kenarında ve önünde. */
const GRASS = Array.from({ length: 46 }, () => {
  const x = between(-10, 1610)
  const y = nearTop(x) + between(4, 70)
  const blades = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => {
    const bx = x + between(-5, 5)
    const tx = bx + between(-12, 12)
    const ty = y - between(12, 30)
    return `M${n(bx)} ${n(y)}Q${n((bx + tx) / 2 + between(-4, 4))} ${n((y + ty) / 2)} ${n(tx)} ${n(ty)}`
  })
  return { d: blades.join(''), delay: 1.4 + (x / 1600) * 1.2 }
})

/** Sırtın tepesindeki otlar: toynakların gezdiği kenarı yumuşatır. */
const CREST_GRASS = Array.from({ length: 70 }, () => {
  const x = between(-10, 1610)
  const y = crest(x) + 2.5
  return `M${n(x)} ${n(y)}l${n(between(-3, 3))} ${n(-between(3, 8))}`
}).join('')

function Sky() {
  return (
    <svg className="title-layer title-sky" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="t-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141110" />
          <stop offset="0.42" stopColor="#262019" />
          <stop offset="0.6" stopColor="#5d5347" />
          <stop offset="0.7" stopColor="#71665a" />
        </linearGradient>
        <radialGradient id="t-haze">
          <stop offset="0" stopColor="#e8dcc6" stopOpacity="0.3" />
          <stop offset="1" stopColor="#e8dcc6" stopOpacity="0" />
        </radialGradient>
        {/* Kömür sürtmesi: yatık çizgiler, bir yerde koyu, bir yerde kâğıt görünür. */}
        <filter id="t-rub" x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.0018 0.035" numOctaves="3" seed="7" />
          <feColorMatrix
            result="light"
            values="0 0 0 0 0.9  0 0 0 0 0.86  0 0 0 0 0.78  0.55 0 0 0 -0.27"
          />
          <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.06" numOctaves="2" seed="19" />
          <feColorMatrix result="dark" values="0 0 0 0 0.04  0 0 0 0 0.03  0 0 0 0 0.02  0 0.8 0 0 -0.32" />
          <feMerge>
            <feMergeNode in="dark" />
            <feMergeNode in="light" />
          </feMerge>
        </filter>
      </defs>
      <rect width="1600" height="900" fill="url(#t-sky)" />
      <ellipse cx="1240" cy="610" rx="760" ry="200" fill="url(#t-haze)" />
      <rect x="-300" y="-300" width="2200" height="1500" fill="#000" fillOpacity="0" filter="url(#t-rub)" transform="rotate(-9 800 450)" />
    </svg>
  )
}

const STAR_SPOTS: [number, number, number][] = [
  [92, 70, 1.6], [214, 158, 1.1], [355, 52, 2], [470, 214, 1.2], [612, 96, 1.5], [705, 300, 1.1], [790, 46, 1.3],
  [884, 182, 1.8], [968, 88, 1.1], [1060, 312, 1.3], [1122, 40, 1.6], [1366, 120, 1.2], [1452, 58, 2.1],
  [1530, 210, 1.1], [1404, 330, 1.4], [268, 340, 1.2], [140, 262, 1.3], [560, 380, 1],
]
const GLINTS: Pt[] = [[355, 52], [884, 182], [1452, 58]]

function Stars() {
  return (
    <svg className="title-layer title-stars" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {STAR_SPOTS.map(([x, y, r], i) => (
        <circle key={i} className={i % 3 === 0 ? 'tw' : undefined} cx={x} cy={y} r={r} style={{ '--i': i } as CSSProperties} />
      ))}
      {GLINTS.map(([x, y], i) => (
        <path key={i} className="glint" d={`M${x - 7} ${y}h14M${x} ${y - 7}v14`} />
      ))}
    </svg>
  )
}

/** Ay: sağa bakan hilal; sırtın ardından yükselir. Dar ekranda sağa yaslanır. */
function Moon() {
  return (
    <svg className="title-layer title-moon-layer" viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="t-halo">
          <stop offset="0" stopColor="#efe5d2" stopOpacity="0.36" />
          <stop offset="0.3" stopColor="#efe5d2" stopOpacity="0.12" />
          <stop offset="1" stopColor="#efe5d2" stopOpacity="0" />
        </radialGradient>
        <mask id="t-crescent" x="-100" y="-100" width="200" height="200" maskUnits="userSpaceOnUse">
          <circle r="86" fill="#fff" />
          <circle cx="34" cy="-24" r="76" fill="#000" />
        </mask>
        <filter id="t-moon-rough" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="5" />
          <feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g className="title-moon">
        <g transform="translate(1220 250)">
          <circle className="title-halo" r="380" fill="url(#t-halo)" />
          <circle r="86" fill="#efe5d2" opacity="0.07" />
          <g filter="url(#t-moon-rough)">
            <circle r="86" fill="#f1e9da" mask="url(#t-crescent)" />
          </g>
        </g>
      </g>
    </svg>
  )
}

function Land() {
  return (
    <svg className="title-layer title-land" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {/* Kenarı elle çekilmiş gibi: düz dolgunun sınırı hafifçe titrer. */}
        <filter id="t-rough" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#t-rough)">
        <path d={smooth(HILLS) + toBottom} fill="#4c443b" />
        <path d={polyline(RIDGE) + toBottom} fill="#1b1714" />
        <path d={smooth(NEAR) + toBottom} fill="#100d0b" />
      </g>
    </svg>
  )
}

const HILL_LINE = smooth(HILLS)
const HILL_LINE_2 = smooth(wobble(HILLS, 2.5))
const CREST_LINE = polyline(RIDGE.map(([x, y]) => [x, y - 0.5]))
const CREST_LINE_2 = polyline(wobble(RIDGE, 1.6))
const RIDGE_RIM = polyline(RIDGE.filter(([x]) => x > 640).map(([x, y]) => [x, y - 2]))
const NEAR_LINE = smooth(wobble(NEAR, 2))

function Lines() {
  return (
    <svg className="title-layer title-lines" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path pathLength={1} className="ln" d={HILL_LINE} stroke="#91846f" strokeWidth="1.8" style={draw(0.5, 1.6)} />
      <path pathLength={1} className="ln" d={HILL_LINE_2} stroke="#91846f" strokeWidth="0.9" opacity="0.5" style={draw(0.7, 1.6)} />
      {RIM.map((s, i) => (
        <path key={i} pathLength={1} className="ln" d={s.d} stroke="#b3a590" strokeWidth="1.2" opacity="0.45" style={draw(s.delay, 0.25)} />
      ))}
      <path pathLength={1} className="ln" d={CREST_LINE} stroke="#0b0907" strokeWidth="2.6" style={draw(0.8, 1.5)} />
      <path pathLength={1} className="ln" d={CREST_LINE_2} stroke="#0b0907" strokeWidth="1.2" opacity="0.6" style={draw(1, 1.5)} />
      <path pathLength={1} className="ln" d={RIDGE_RIM} stroke="#a19380" strokeWidth="1.2" opacity="0.5" style={draw(1.6, 1.2)} />
      {HATCH.map((h, i) => (
        <path key={i} pathLength={1} className="ln" d={h.d} stroke="#4d4238" strokeWidth="1.3" opacity="0.7" style={draw(h.delay, 0.22)} />
      ))}
      <path pathLength={1} className="ln" d={NEAR_LINE} stroke="#2c2520" strokeWidth="2" style={draw(1.3, 1.4)} />
      {GRASS.map((g, i) => (
        <path key={i} pathLength={1} className="ln" d={g.d} stroke="#3d352d" strokeWidth="1.3" opacity="0.8" style={draw(g.delay, 0.6)} />
      ))}
    </svg>
  )
}

function draw(delay: number, duration: number): CSSProperties {
  return { '--d': `${n(delay * 100) / 100}s`, '--t': `${duration}s` } as CSSProperties
}

// ── Atlılar ─────────────────────────────────────────────────────────────────
// Sağa bakan at ve binici; toynaklar y=0'da. Bacaklar omuzdan/kalçadan
// sallanır (dört vuruşlu yürüyüş: arka sol, ön sol, arka sağ, ön sağ).

const LEG = 'M-2.8 0L2.8 0L1.9 11L1.3 19L2.6 22L-1.7 22L-1.5 19L-2.1 11Z'
const NECK =
  'M10 -33C15 -41 20 -49 24 -53L26 -57L28 -52C31 -50 35 -46 38 -42C39 -40 37 -38 35 -38.5C31 -40 28 -41 26 -40C23 -35 20 -30 18 -23Z'
const STRIDE = 1.1

type Gear = 'bow' | 'tug' | 'quiver'
const COLUMN: { x: number; scale: number; gear: Gear }[] = [
  { x: 880, scale: 1.18, gear: 'bow' },
  { x: 792, scale: 1.12, gear: 'tug' },
  { x: 700, scale: 1.16, gear: 'bow' },
  { x: 614, scale: 1.1, gear: 'quiver' },
  { x: 524, scale: 1.14, gear: 'bow' },
]

/** Adımın `phase` kadar ilerisi (adım kesri), negatif gecikme olarak. */
const stride = (phase: number) => `${n(-phase * STRIDE * 100) / 100}s`

function Leg({ x, phase, far }: { x: number; phase: number; far?: boolean }) {
  return (
    <g transform={`translate(${x} -22)`}>
      <path className={far ? 'leg is-far' : 'leg'} d={LEG} style={{ animationDelay: stride(phase) }} />
    </g>
  )
}

/** `lag`: atlının adımının kolondaki öncekine göre kayması (adım kesri). */
function Rider({ x, scale, gear, lag }: { x: number; scale: number; gear: Gear; lag: number }) {
  return (
    <g transform={`translate(${x} ${n(crest(x))}) scale(${scale})`}>
      <Leg x={-14} phase={lag} far />
      <Leg x={13} phase={lag + 0.25} far />
      <g className="mount" style={{ animationDelay: stride(lag) }}>
        <path className="tail" d="M-20 -31C-28 -31 -31 -22 -31 -12C-28 -19 -26 -24 -19 -26Z" />
        <ellipse cx="0" cy="-27" rx="21" ry="8.5" />
        <ellipse cx="13" cy="-28" rx="9" ry="9" />
        <path d={NECK} />
        {/* Binici: börk, kaftan, çizme. */}
        <path d="M-5 -35L5 -35C6 -41 4 -47 2 -51L-2 -51C-5 -46 -6 -40 -5 -35Z" />
        <path d="M-5 -36L-12 -30L-3 -33Z" />
        <path d="M-1 -36L5 -36L6 -27L3 -24L1 -28Z" />
        <circle cx="0.5" cy="-54.5" r="3.6" />
        <path d="M-3.5 -56L-1 -64C0 -65 1.5 -64.5 2 -63L4.2 -56Z" />
        {gear === 'bow' && (
          <>
            <path className="stroke" d="M2 -48L9 -50" strokeWidth="2.4" />
            <path className="stroke" d="M8 -61C15 -57 15 -43 8 -39" strokeWidth="1.7" />
            <path className="stroke" d="M8 -61L8 -39" strokeWidth="0.5" />
          </>
        )}
        {gear === 'tug' && (
          <>
            <path className="stroke" d="M2 -47L6 -44M5 -38L1 -102" strokeWidth="1.5" />
            <circle cx="1" cy="-103" r="1.9" />
            <path className="tug" d="M1 -99C-5 -94 -8 -85 -7 -76C-5 -83 -3 -88 1 -93C-1 -87 -1 -81 1 -75C2 -83 3 -91 2 -98Z" />
          </>
        )}
        {gear === 'quiver' && (
          <path className="stroke" d="M-6 -45L-10 -32M-6.5 -45L-8 -53M-5.5 -45L-5 -54M-7 -45L-10 -52.5" strokeWidth="1.4" />
        )}
      </g>
      <Leg x={-14} phase={lag + 0.5} />
      <Leg x={13} phase={lag + 0.75} />
    </g>
  )
}

/** Ocak: atlıların öyküsünü anlatan dervişin ateşi. Aydoğdu arkadan görünür. */
function Hearth() {
  return (
    <g transform="translate(330 846)">
      <circle className="title-fire-glow" r="190" fill="url(#t-fire-glow)" />
      <g className="title-fire">
        <path className="flame" d="M-14 0C-16 -14 -6 -22 -2 -44C4 -30 16 -18 12 0Z" />
        <path className="flame is-left" d="M-17 0C-21 -10 -15 -16 -12 -29C-8 -18 -4 -10 -6 0Z" />
        <path className="flame is-right" d="M3 0C1 -12 9 -18 14 -31C18 -18 20 -8 16 0Z" />
        {[-8, -2, 4, 9, 14].map((x, i) => (
          <circle key={i} className="spark" cx={x} cy={-18} r="1.3" style={{ '--i': i } as CSSProperties} />
        ))}
      </g>
      <path d="M-24 4L22 -2M-22 -2L20 6" stroke="#0d0a08" strokeWidth="5" strokeLinecap="round" />
      <g transform="translate(-72 6)" fill="#0b0907">
        <path d="M-30 0C-32 -20 -24 -44 -12 -56C-8 -60 -2 -61 2 -58C14 -50 22 -26 26 0Z" />
        <circle cx="-3" cy="-66" r="9" />
        <path d="M-11 -70C-10 -84 -6 -94 -1 -96C3 -92 5 -82 6 -70Z" />
        <path d="M24 4L40 -92" stroke="#0b0907" strokeWidth="2.6" strokeLinecap="round" />
        <path
          d="M2 -58C14 -50 22 -26 26 0M5 -70C6 -78 4 -88 -1 -96"
          fill="none"
          stroke="#e9d9bd"
          strokeOpacity="0.4"
          strokeWidth="1.4"
        />
      </g>
    </g>
  )
}

function Riders() {
  return (
    <svg className="title-layer title-riders" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="t-rider-rough" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="1" seed="11" />
          <feDisplacementMap in="SourceGraphic" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="t-fire-glow">
          <stop offset="0" stopColor="#f2dfbd" stopOpacity="0.34" />
          <stop offset="0.4" stopColor="#f2dfbd" stopOpacity="0.1" />
          <stop offset="1" stopColor="#f2dfbd" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="title-column">
        <g className="title-march" filter="url(#t-rider-rough)">
          {COLUMN.map((r, i) => (
            <Rider key={i} {...r} lag={i * 0.31} />
          ))}
        </g>
      </g>
      <path d={CREST_GRASS} stroke="#1b1714" strokeWidth="1.5" strokeLinecap="round" />
      <Hearth />
    </svg>
  )
}
