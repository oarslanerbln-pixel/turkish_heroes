// Anlatıcı Aydoğdu (HIKAYE.md §3): kurgu bir derviş-ozan, hikâyeyi ocak
// başında anlatır. Satırı brifingde ve sonuç ekranında aynı biçimde görünür.

/** Anlatıcının satırı: etiket ve italik söz; ekran okuyucu "Aydoğdu: …" okur. */
export function Narrator({ text, className }: { text: string; className: string }) {
  return (
    <p className={`narrator ${className}`}>
      <span className="narrator-name">Aydoğdu:</span> <q>{text}</q>
    </p>
  )
}
