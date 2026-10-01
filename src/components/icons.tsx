import type { ReactNode } from 'react'

// Menü ikonları — satır içi SVG, `currentColor` ile boyanır.
//
// Emoji (🔒, 📜) her platformda başka çizilir ve paletten kopar; SVG
// her cihazda aynı ve metnin rengini alır.

interface IconProps {
  size?: number
  className?: string
}

function Svg({ size = 14, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

/** Tomar: tarih notları. */
export function ScrollIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4Z" />
      <path d="M6 4a2 2 0 0 0-2 2v2h2" />
      <path d="M9.5 9h6M9.5 12.5h6M9.5 16h4" />
    </Svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  )
}

/**
 * Hilal ve yıldız, 24×24 çizim alanında; başka bir SVG'nin içine de konur
 * (bkz. Ornament). Hilal iki çemberin kesişiminden çizilmiş tek yol: maske
 * kimliği gerektirmez, sayfada çok kez kullanılabilir.
 */
export function CrescentMark() {
  return (
    <g fill="currentColor" stroke="none">
      <path d="M15.42 2.6A10 10 0 1 0 21.57 14.9A7.6 7.6 0 1 1 15.42 2.6Z" />
      <polygon transform="translate(17.4 7.6) scale(0.22) translate(-12 -12)" points={STAR_POINTS} />
    </g>
  )
}

/** Mola levhasının mührü. */
export function CrescentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <CrescentMark />
    </Svg>
  )
}

/** Çatallı sancak: sefer haritasında sıradaki hedef. */
export function SancakIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 22V3" />
      <path d="M6 4h13l-3.5 4.5L19 13H6Z" fill="currentColor" />
    </Svg>
  )
}

const STAR_POINTS =
  '12,1 13.91,7.38 19.78,4.22 16.62,10.09 23,12 16.62,13.91 19.78,19.78 13.91,16.62 12,23 10.09,16.62 4.22,19.78 7.38,13.91 1,12 7.38,10.09 4.22,4.22 10.09,7.38'

/**
 * Sekiz köşeli yıldız ({8/3}): yıldız puanı. Dolu çizilir; ★ karakteri
 * yazı tipine göre değişiyor, küçük boyda da dişli çarka benzemesin diye
 * uçlar sivri.
 */
export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <polygon points={STAR_POINTS} fill="currentColor" stroke="none" />
    </Svg>
  )
}
