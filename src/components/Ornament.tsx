import { CrescentMark } from './icons'

/**
 * Ortada hilal, iki yanında baklava ve incelen çizgi — başlıkların altındaki
 * süsleme. Eskiden iç içe dönmüş iki kareden Selçuklu yıldızıydı; 12 piksel
 * boyda dişli çarka benziyordu. Hilal hem oyunun adı hem küçükte okunuyor.
 */
export function Ornament({ width = 220 }: { width?: number }) {
  const mid = width / 2
  return (
    <svg
      className="ornament"
      width={width}
      height="18"
      viewBox={`0 0 ${width} 18`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ornament-fade-l" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="ornament-fade-r" x1="1" x2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="0" y="8.5" width={mid - 21} height="1" fill="url(#ornament-fade-l)" />
      <rect x={mid + 21} y="8.5" width={mid - 21} height="1" fill="url(#ornament-fade-r)" />
      <g fill="currentColor">
        <polygon points={`${mid - 18},9 ${mid - 14},5 ${mid - 10},9 ${mid - 14},13`} />
        <polygon points={`${mid + 10},9 ${mid + 14},5 ${mid + 18},9 ${mid + 14},13`} />
      </g>
      <g transform={`translate(${mid - 7} 2) scale(0.58)`}>
        <CrescentMark />
      </g>
    </svg>
  )
}
