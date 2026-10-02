/**
 * Bilinen düzen borcu: bekçinin bulduğu ama henüz giderilmemiş ihlaller.
 * Faz 26 Adım 2a listeyi boşalttı (ilk hali 2 Ekim 2026, 18 ekranın 18'i).
 * Ölçüt CI'nin Linux koşusu: Windows'ta yazı tipi farkıyla sınırdaki satırlar
 * ayrışabilir. Bekçi tam eşitlik ister: yeni bir ihlal de, giderilip burada
 * kalan bir ihlal de testi kırar; liste yalnız küçülür. Güncel ihlaller her
 * koşuda rapora "ihlaller" eki olarak düşer.
 */
export const LAYOUT_DEBT: Record<string, string[]> = {}
