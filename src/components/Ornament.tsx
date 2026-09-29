/**
 * Selçuklu yıldızı ile iki yanında incelen altın çizgi — başlıkların altındaki
 * süsleme. Sekiz köşeli yıldız, iç içe dönmüş iki kareden: Selçuklu çini ve
 * taş işçiliğinin en tanıdık motifi. Tek satır SVG, dosya yok.
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
      <rect x="0" y="8.5" width={mid - 16} height="1" fill="url(#ornament-fade-l)" />
      <rect x={mid + 16} y="8.5" width={mid - 16} height="1" fill="url(#ornament-fade-r)" />
      <g transform={`translate(${mid} 9)`} fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="-6" y="-6" width="12" height="12" />
        <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" />
        <circle r="1.8" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}
