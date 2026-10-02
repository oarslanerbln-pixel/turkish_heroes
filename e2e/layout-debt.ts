/**
 * Bilinen düzen borcu: bekçinin bugünkü kodda bulduğu ihlaller ("önce" kanıtı,
 * 2 Ekim 2026). Faz 26 Adım 2a bu listeyi boşaltır. Bekçi tam eşitlik ister:
 * yeni bir ihlal de, giderilip burada kalan bir ihlal de testi kırar; liste
 * yalnız küçülür. Güncel ihlaller her koşuda rapora "ihlaller" eki olarak düşer.
 */
export const LAYOUT_DEBT: Record<string, string[]> = {
  'menü @ 375×667': [
    "Alp Arslan: 44 px'ten küçük",
    "BİLGİ HAZİNESİ: 44 px'ten küçük",
    "II. Kılıçarslan: 44 px'ten küçük",
    "Metehan: 44 px'ten küçük",
    "SAVAŞA GİR: 44 px'ten küçük",
  ],
  'menü @ 568×320': [
    "Alp Arslan × II. Kılıçarslan: kesişiyor",
    "Alp Arslan: 44 px'ten küçük",
    "BİLGİ HAZİNESİ: 44 px'ten küçük",
    "II. Kılıçarslan: 44 px'ten küçük",
    "Metehan × Alp Arslan: kesişiyor",
    "Metehan: 44 px'ten küçük",
    "SAVAŞA GİR: 44 px'ten küçük",
  ],
  'menü @ 667×375': [
    "Alp Arslan × II. Kılıçarslan: kesişiyor",
    "Alp Arslan: 44 px'ten küçük",
    "BİLGİ HAZİNESİ: 44 px'ten küçük",
    "II. Kılıçarslan: 44 px'ten küçük",
    "Metehan × Alp Arslan: kesişiyor",
    "Metehan: 44 px'ten küçük",
    "SAVAŞA GİR: 44 px'ten küçük",
  ],
  'mola @ 375×667': [
    "KOMUTANLAR: 44 px'ten küçük",
    "KUŞAT × KOMUTANLAR: kesişiyor",
    "SOL KOL × DEVAM: kesişiyor",
  ],
  'mola @ 568×320': [
    "KOMUTANLAR: 44 px'ten küçük",
    "KOMUTANLAR: ekrandan taşıyor",
    "YENİDEN BAŞLA: 44 px'ten küçük",
    "YENİDEN BAŞLA: ekrandan taşıyor",
  ],
  'mola @ 667×375': [
    "KOMUTANLAR: 44 px'ten küçük",
    "YENİDEN BAŞLA: 44 px'ten küçük",
  ],
  'savaş Malazgirt @ 375×667': [
    "Mola: 44 px'ten küçük",
    "Sesi aç: 44 px'ten küçük",
  ],
  'savaş Malazgirt @ 568×320': [
    "Mola: 44 px'ten küçük",
    "Sesi aç: 44 px'ten küçük",
  ],
  'savaş Malazgirt @ 667×375': [
    "Mola: 44 px'ten küçük",
    "Sesi aç: 44 px'ten küçük",
  ],
  'savaş Miryokefalon @ 375×667': [
    "Mola: 44 px'ten küçük",
    "SAĞ YAMAÇ × KAYA YIĞINI: kesişiyor",
    "SOL YAMAÇ × KAYA YIĞINI: kesişiyor",
    "Sesi aç: 44 px'ten küçük",
  ],
  'savaş Miryokefalon @ 568×320': [
    "Mola × KAYA YIĞINI: 8 px'ten yakın",
    "Mola: 44 px'ten küçük",
    "SAĞ YAMAÇ × KAYA YIĞINI: kesişiyor",
    "SOL YAMAÇ × KAYA YIĞINI: kesişiyor",
    "Sesi aç × KAYA YIĞINI: kesişiyor",
    "Sesi aç: 44 px'ten küçük",
  ],
  'savaş Miryokefalon @ 667×375': [
    "Mola: 44 px'ten küçük",
    "SAĞ YAMAÇ × KAYA YIĞINI: kesişiyor",
    "SOL YAMAÇ × KAYA YIĞINI: kesişiyor",
    "Sesi aç × KAYA YIĞINI: 8 px'ten yakın",
    "Sesi aç: 44 px'ten küçük",
  ],
  'sonuç yenilgi @ 375×667': [
    "KOMUTANLAR: 44 px'ten küçük",
    "KOMUTANLAR: ekrandan taşıyor",
    "YENİDEN: ekrandan taşıyor",
  ],
  'sonuç yenilgi @ 568×320': [
    "KOMUTANLAR: 44 px'ten küçük",
  ],
  'sonuç yenilgi @ 667×375': [
    "KOMUTANLAR: 44 px'ten küçük",
  ],
  'sonuç zafer @ 375×667': [
    "KOMUTANLAR: 44 px'ten küçük",
    "SAVAŞA GİR: 44 px'ten küçük",
    "YENİDEN: 44 px'ten küçük",
  ],
  'sonuç zafer @ 568×320': [
    "KOMUTANLAR: 44 px'ten küçük",
    "SAVAŞA GİR: 44 px'ten küçük",
    "YENİDEN: 44 px'ten küçük",
  ],
  'sonuç zafer @ 667×375': [
    "KOMUTANLAR: 44 px'ten küçük",
    "SAVAŞA GİR: 44 px'ten küçük",
    "YENİDEN: 44 px'ten küçük",
  ],
}
