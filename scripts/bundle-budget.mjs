// Paket bütçesi (risk P7): üretim derlemesindeki JS'in gzip toplamı. Telefonda
// ilk açılışın bedeli bu; yeni bir bağımlılık paketi sessizce şişirmesin.
// Bütçeyi yükseltmek PR'da gerekçe ister.
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

/** 2 Ekim 2026'da toplam ~348 kB (three ~180 kB); ~%10 pay. */
const BUDGET_KB = 385
const DIR = 'dist/assets'

const sizes = readdirSync(DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ f, kb: gzipSync(readFileSync(`${DIR}/${f}`)).length / 1024 }))
  .sort((a, b) => b.kb - a.kb)
const total = sizes.reduce((n, s) => n + s.kb, 0)

for (const { f, kb } of sizes) console.log(`${kb.toFixed(1).padStart(7)} kB  ${f}`)
console.log(`${total.toFixed(1).padStart(7)} kB  toplam (bütçe ${BUDGET_KB} kB)`)
if (total > BUDGET_KB) {
  console.error(`Paket bütçesi ${(total - BUDGET_KB).toFixed(1)} kB aşıldı.`)
  process.exit(1)
}
