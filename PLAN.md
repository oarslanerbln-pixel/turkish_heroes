# HİLAL — Türk Kahramanları 3D Oyunu
### Proje Planı v2 — Gerçek Duruma Göre Güncellendi

> Bu dosya oyunun tek doğruluk kaynağıdır (source of truth). Claude Code'da
> her session'ın başında bunu okut. v1 hiç commit edilmemişti; bu dosya
> gerçekte yapılmış işi ve bundan sonraki öncelikleri belgeliyor.

---

## 1. Vizyon

Türk askeri tarihinin komutanlarını, gerçek tarihi taktiklerini oyun
mekaniğine dönüştürerek oynatan, mobilde çalışan 3D PWA. MVP: Metehan'ın
hilal (kuşatma) taktiği — sahte ricat → disiplin çöküşü → kümelenme → vuruş.

## 2. Durum (1 Ekim 2026 itibarıyla)

**Tamamlanan (commit geçmişinden doğrulanmış):**

| Faz | İş | Durum |
|---|---|---|
| 0 | Scaffold: Vite + R3F + Zustand + vite-plugin-pwa (React 19, Three r185) | ✅ |
| 2 | Hilal çekirdek mekaniği: `enemySim.ts` (disiplin tabanlı sürü AI), `hilalSystem.ts` (kuşatılabilirlik = sıkışıklık × (1-disiplin)) | ✅ |
| 3 | Kayıp koşulu, temas hasarı, denge (headless simülasyonla ölçülmüş: chaseSpeed, energyFillRate) | ✅ |
| 4 | Vuruş artık daire değil hilal şeklinde yay; FollowCamera (OrbitControls kaldırıldı); otomatik nişan; hayatta kalanların disiplini sıfırlanıyor | ✅ |
| — | Bug fix'ler: SPACE'in sessizce iptali, kamera sert geçişi, vuruş reddinde geri bildirim yokluğu, son düşman softlock'u, siyah ekran (R3F priority render) | ✅ |
| 5 | Dalga sistemi (3 dalga: 16→26→38 düşman, can devrediliyor), skor + localStorage rekor | ✅ |
| 6 | Dokunmatik kontrol: sol alt analog joystick (`useTouchControls.tsx`, `useKeyboard` ile simetrik arayüz), sağ altta büyük VUR düğmesi. Nişan zaten otomatikmiş (`calcFacing`), bu yüzden ayrı bir nişan kontrolüne gerek çıkmadı — kapsam buna göre daraltıldı. | ✅ |
| 7 | Post-processing / atmosfer: ~~ACES filmic tone mapping (native `gl.toneMapping`)~~ (faz 9'da ölçüldü: EffectComposer renderer ton eşlemesini kapatıyor, ayar hiç etki etmiyordu — kaldırıldı, görünüm aynı), Bloom (mipmapBlur, threshold 0.55/intensity 0.7), sis + arkaplan aynı ton (#3a2211), Vignette, hafif Noise. `Renderer.tsx` kaldırıldı — `EffectComposer` aynı `renderPriority` yuvasına oturup çizimi devraldı. | ✅ |
| 8 | Cila + sağlamlaştırma: başlangıç ekranı (3 adımda taktik + BAŞLA; simülasyon `world.started` ile donuk bekliyor), HUD sadeleştirme (debug istatistikleri yalnızca dev'de, dokunmatikte can çubuğu/joystick çakışması giderildi, safe-area), dalga bannerı, WebAudio ile sentezlenmiş ses (dosya yok) + sessize alma + titreşim, hilal ikonu ve eksik PWA PNG'leri (192/512/maskable/apple-touch), vendor chunk bölme, vitest (29 test: mekanik + headless denge), şablon artıkları ve lint uyarıları temizlendi. | ✅ |
| 9 | Performans: 3 grafik kademesi (`src/perf/quality.ts`: DPR üst sınırı, MSAA, gölge haritası, bloom, noise) + drei `PerformanceMonitor` ile FPS'e göre otomatik kademe (salınımda 4 değişimden sonra düşükte kilit); dokunmatik ortadan, masaüstü yüksekten başlar. Menü ve sonuç ekranında çizim durur (`frameloop="demand"`). EffectComposer MSAA varsayılanı 8 → kademeye göre 4/2/0; Canvas'ın boşa çalışan MSAA'sı kapatıldı. `calcFacing` 24× hızlandı (300 → 12,5 µs; simülasyon karesi 288 → 34 µs). Gerçek cihaz testi için `?perf` (FPS + kademe) ve `?quality=low\|medium\|high`. | ✅ |
| 10 | Görsel temel ("10 bin €'luk oyun" hissi; tasarım belgesindeki Faz A): low-poly bozkır arazisi (arena düz, dışı tepeler; gürültüyle köşe renkleri), sınırda balbal taşları, rüzgârda salınan çimen (kademeye bağlı, düşükte kapalı), kapsüller yerine at üstünde süvari (dörtnal sallanması, ölünce devrilip gömülme), Metehan'a turkuaz binici + tuğ + zemin halkası, vuruşta 40–70 ms hitstop ve altın kıvılcımlar, dalga arasında 1,5 sn mola (son düşenlerin devrilişi yarıda kalmasın), Cinzel başlık yazı tipi (paketle, çevrimdışı) + Selçuklu yıldızı süslemesi, HUD kontrastı. Hiç harici model/doku yok. | ✅ |
| 11 | İkinci komutan prototipi — Alp Arslan, Malazgirt 1071 (tasarım belgesindeki Faz B). Senaryo katmanı: yönetmen artık komutandan bağımsız, Metehan'ın dalgaları ve Malazgirt aynı arayüzü (`sim/scenarios.ts`) uyguluyor. Ordu dört birlik + imparator (`mechanics/corps.ts`, saf ve testli): taciz birliğin düzenini düşürür ve ilerleyişini yavaşlatır (gündüz tabanı 0,6), dibinde oyalanmak 0,6 sn uyarılı hamleye kışkırtır, gün batımında ordu döner (dönüşün ortasında disiplin 0), yıpranmış artçı çekilir, merkez de yıprandıysa imparator korumasız kalır. Vuruş birliğin yalnızca düzeni bozulmuş kısmını düşürür (bütçe = alive × (1 − disiplin)) ve gündüz tüm orduyu toparlar: hilali akşama saklamak ödüllenir. İmparator esir → ordu teslim, 3 yıldız. Başlangıçta komutan seçimi, gün çizgisi, duyurular, birlik düzen çubukları, ordugah, gün ışığı döngüsü (`DayCycle`), yıldızlı sonuç ekranı, `?tune` canlı ayar paneli, `?commander=alp-arslan`. Bot ölçütleri (`corps.test.ts`): pasif kaybeder; güvenli tacizci 1 yıldız + can %100; kışkırtıcı 8 tohumun 6'sında 3 yıldız; açgözlü < kışkırtıcı; simülasyon karesi < 100 µs. | ✅ prototip |
| 12 | Malazgirt dikey kesiti (belgedeki Faz C, ilk dilim): oyuncu başına bir kez gösterilen bağlamsal ipuçları (ilk taciz, ilk hamle, ilk gün batımı; `sim/progress.ts`), ilk savaşta hamle hasarı yarıya, ilk hamlede ve her gün batımında kısa ağır çekim (`world.slowmo`, `simDelta` üzerinden), duyuru kuyruğu (gün batımında üç duyuru üst üste yazılıyordu), hamle kaması (uyarıdaki askerden oyuncuya kırmızı zemin kaması), ok yağmuru (taciz şiddetiyle orantılı, kademeye bağlı), yeni sesler (ok vızıltısı, imparator borusu), komutan kilidi (Alp Arslan, Metehan zaferiyle açılır; prototipte oynamış olanın kilidi kapanmaz; `?commander` atlar). | ✅ |
| 13 | Faz C, ikinci dilim — bozkır havası: dörtnal süvarilerin ardında toz bulutu (hızla orantılı, oyuncu ve tüm düşmanlar; kademeye bağlı, düşükte kapalı), bozkır rüzgârı (tek esinti fonksiyonu `world/wind.ts` çimeni, tozu ve sesi birlikte sürer: esinti cephesi rüzgâr yönünde ilerler, çimen eğilir, sert esintide yerde toz perdesi kalkar), ambiyans (rüzgâr uğultusu + ıslık, savaşla başlayan drone + kös; kös hilal enerjisiyle 1,5 → 0,75 sn'ye hızlanır, gerilimde ara vuruş), vuruşta müzik ve rüzgâr kısılır (düşen payıyla daha derin) ve ~0,5 sn'de geri gelir, sekme gizlenince ses askıya alınır. Node 25'te kırılan `progress.test.ts` düzeldi: rekor okuma/yazma erişilemeyen `localStorage`'a (gizli sekme) dayanıklı. | ✅ |
| 14 | Olay takibi (yerel, bağımlılıksız): savaş başına tek özet — sonuç ve yenilgi nedeni (can / ordugah), oyun süresi, vuruş başına düşen (ve o an sahadaki), ret sayıları (neden başına), dalga temizlenme anları, Malazgirt olayları (taciz, hamle, gün batımı…), komutan başına kaçıncı deneme (Kapı B'nin "ikinci kez oynadı mı" sorusu). Özetler localStorage'da (son 40); savaş sürerken sayfa kapanırsa sonraki açılışta "yarıda bırakıldı" sayılır. `?telemetry` ayıklamayı kalıcı açar: olaylar konsola, sonuç ekranında VERİYİ KOPYALA düğmesi (telefondaki testin verisi panoya). Uzak servis `addSink` ile bağlanır. Aynı gün: production adresi faz 0'daydı (Vercel production dalı eski; tüm deploy'lar giriş korumalı Preview'a gidiyordu) — son sürüm production'a alındı. | ✅ |
| 15 | Mola ve CI: savaş Esc / P ya da sağ üstteki düğmeyle durur; uygulamadan çıkılınca (sekme gizlenir, pencere odağı kaybolur) kendiliğinden durur — telefona dönüldüğünde düşman saldırmış olmasın. Mola ekranı: DEVAM (Enter / Esc), YENİDEN BAŞLA, KOMUTANLAR. Molada simülasyon, müzik ve sahne döngüsü durur; basılan vuruş birikmez, joystick sıfırlanır. Olay takibine `pause` (elle / kendiliğinden) ve moladan çıkış için `quit` sonucu eklendi. GitHub Actions: her PR'da ve ana dala push'ta lint + test + build. | ✅ |
| 16 | Savaş alanı görselliği: gökyüzü kubbesi (ufuk→tepe geçişi, güneş/ay diski ve parıltısı; gün saatine bağlı, ufuk rengi sisle aynı — uzak arazi gökyüzüne karışır, sis artık açık toz rengi). Sinematik çekimler: menüden savaşa girerken ordugahın ardından ufka bakış (ordu gökyüzüne karşı), sonra taktik duruşa yükseliş; gün batımında kamera alçalır, güneş Bizans ordusunun ardında batar. Oyuncu çekim sırasında da oynar; YENİDEN'de açılış çekimi yok. Taktik kamerada ekranın altını kaplayan ordugah noktalı inceltmeyle (dither) kaybolur. | ✅ |
| 17 | Selçuklu kolları (Malazgirt): hilalin iki boynuzu oyuncunun emrinde (`mechanics/wings.ts`, saf ve testli). Her kol PUSU (ordugahın yanında dinlenir), TACİZ (karşısındaki kanadı ok menzilinden yıpratır ve yavaşlatır) ya da HÜCUM (birliğin yanına yüklenir); düğmeye / Q–E'ye her basış sıradaki emri verir. Kol yorulur — taciz yavaş, düzenli birliğe hücum hızlı tüketir; gücü biten kol pusuya döner, dinlenmeden çıkmaz. Gündüz hücum ilerleyen birliği durdurmaz; akşam dönen birliğe taze kolun ilk darbesi düzeni bir anda sarsar, birlik tutulur, dönüşü uzar. Kollar merkezi tutarsa (kanatlar düşmüşse) imparatorun arkası artçı kaçmadan da açılır. Asıl karar: kolları gündüz harcamak mı, akşama saklamak mı. Sahada atlı okçular: pusuda iki sıra, tacizde dönen halka, hücumda hilal düzeni. Duyurular, yeni sesler (emir, kol hücumu), bir kez gösterilen iki ipucu, olay takibine `wing_order`, `?tune`'a kol ayarları. Bot ölçütleri (`wings.test.ts`): pusudaki kol savaşı değiştirmez; kolları akşama saklayan güvenli tacizci ~4 asker daha fazla düşürür; kolları gündüz tüketen akşamı yorgun (güç < 0,5) karşılar; kollar pasif oyuncuyu kurtarmaz. | ✅ |
| 18 | Adil savaş + savaş karnesi (oyuncu psikolojisi, olasılıksal Ar-Ge). Metehan için ilk kez tam 3 dalgalı headless döngü ve insan gibi kusurlu botlar (`mechanics/waveBots.ts`: tepki gecikmesi, direksiyon hatası, kötü hamle, erken basma; 4 beceri seviyesi, tohumlu) → üç bulgu, üç düzeltme: **(1) Son düşman tuzağı:** disiplinsiz son düşman oyuncudan hızlı (6,5 > 6), dibine yapışıp yayın iç yarıçapında (2,5) kalıyor, vurulamıyor ve oyuncuyu yavaşça öldürüyordu — yenilgilerin ~%20'si, bir koşuda tek düşmanla 465 sn. Çözüm **bozgun**: vuruştan sonra dalganın ≤ %15'i kaldıysa kalanlar kaçar (hedef değil, tehdit değil; sınırda sahadan çıkar), duyuru + ses. Takılma 15/40 → 0/40. **(2) Doğuş şansı:** dalga hep −z'de doğuyor, sonucu doğuş anında oyuncunun kaçış çemberinin neresinde olduğu belirliyordu (aynı uzman: 10/30). Yön tarandı — sezginin tersine karşı yaka en kötüsü (düşman merkezden kestiriyor, uzman %0); oyuncunun yakası en iyisi (düşman arkada, önde tüm arena). Yeni dalga oyuncunun yakasında, hiçbir asker düzen mesafesinden (9) yakın değil: 29/30. **(3) Kapıdaki duvar:** tam hasarda iyi bot %14, orta %2 kazanıyor, acemi %77 ilk dalgada ölüyordu. "İlk zafere kadar yarı hasar" uçurum yaratırdı (iyi: %70 → %14). Çözüm psikofizikteki **1-yukarı-1-aşağı merdiven**: hasar çarpanı ×0,5 / 0,6 / 0,7 / 0,85 / 1; zafer bir basamak zorlaştırır, yenilgi kolaylaştırır; her oyuncu kendi ~%50'sine yakınsar. 12 denemede: uzman %97 ve ×1'e yerleşir, iyi %55, orta %22 ve **hepsi en az bir kez kazanır** (ilk zafer ort. 3,8. deneme). Önceden Metehan'ı kazanmış oyuncu ×1'den başlar. **Savaş karnesi** (`debrief/debrief.ts`, saf; olay özetinden): tek cümlelik sonuç + yakın kaçış ("gün batımına 9 sn kala" → AZ KALDI rozeti), en iyi an (zirve-son kuralı), bir sonraki hedefin ilerleme çubuğu (hedef gradyanı: "2. yıldız 19/21", "Zafere 42/80", "3. yıldız: imparator 1/3 adım"), zaman şeridi (vuruşlar, hamleler, dalga sonları, bozgun, gün batımında geceye dönen şerit) ve **tek** tavsiye (atıf kuramı: kontrol edilebilir neden; seçim yükü yok), düğmelerin hemen üstünde. Tavsiye matrisi botlarla doğrulandı (`debrief.bots.test.ts`): pasif → hamleden kaç (gün batımı canıyla atıf), kolsuz → kolları kullan, sabırsız kollar → kolları sakla, 2★'da kalan → artçıyı kır, kışkırtıcı+pusu → ustalık, erken basan acemi → hilalin nasıl dolduğu; her tavsiyenin nedenselliği (uyan bot daha iyi oynuyor) corps/wings testlerinde ölçülü. Metehan zaferinde ustalık hedefi: bozgunsuz kuşat (kaçan puan getirmez) ya da temiz ricat. İlk Metehan zaferinde **YENİ KOMUTAN** kartı ve tek tıkla Malazgirt (Enter da). Olay takibine: `assist` (hasar çarpanı — zafer oranı buna göre okunmalı), `rout`, `dusk` (birlik düzeni, kol gücü, can), `remaining`, `simTime`, gösterilen `advice`. Tarayıcıda doğrulandı (telefon yatay/dikey, masaüstü). | ✅ |
| 19 | Üçüncü komutan prototipi — II. Kılıçarslan, Miryokefalon 1176. Yeni eksen **NEREDE** (Metehan: nasıl, Alp Arslan: ne zaman). Bizans ordusu dar Tzivritze geçidinde dört birlikten bir kol (öncü, merkez + Manuel, ağırlıklar, artçı); kuzeydeki çıkışı aşarsa yenilgi, gece (150 sn) çökerse zafer. Yeni fiil **YOLU KES** (R / düğme): bulunduğun yere bir kez kaya yığını; kolun başı durur, arkası üst üste biner. **Sıkışma** yalnızca sert duruştan birikir (yığın, yamaç kollarının tutması, duran birliğin arkası), darda hızlı ve tam, genişte yavaş ve sınırlı (≤ 0,35); disiplin × (1 − sıkışma) — geçidin hasat anı (Malazgirt'teki dönüş gibi), ilk sıkışmada ağır çekim. Öncü yığını ~40 sn'de temizler, taciz üç kat yavaşlatır. Manuel ancak merkez boğazda sıkışıp (≥ 0,8) düzeni kırılınca (< 0,7) açıkta: yay onu alırsa barış, 3 yıldız. Kollar yamaç birliği (pusu sırtta, hücum kolu olduğu yerde tutar). **Ordu motoru savaş alanı düzenine göre parametrelendi** (`corps.ts` BattleLayout: MALAZGIRT / MIRYOKEFALON; Malazgirt'in 90 testi değişmeden geçti), geçit geometrisi `mechanics/pass.ts`. Bot taraması iki tasarım hatası yakaladı: (1) tacizle yavaşlayan baş da kolu sıkıştırıyordu, yığının yeri hiçbir şeyi değiştirmiyordu → sıkışma yalnızca sert duruştan; (2) geçit baştan sona dar olduğu için her yerde aynı sonuç → kısa huni (boğazın iki yanında 10/8 birim). Sonuç eğrisi (`column.test.ts`): tacizci yığınsız 1★, genişte (z=2) kesen 1★, boğazın ötesinde (z=4–10) kesen 3★, 11–12'de 2★, çıkışa yakın (14) 1★; pasif kaybeder; kare < 100 µs. Kanyon arazisi (duvarlar kaya rengi, taban düz), kaya yığını (örneklenmiş, sağlamlıkla küçülür), yamaçta süvariler, ışık geceye göre kararır, birlik çubukları sıkışmayı gösterir. Kilit zinciri Metehan → Alp Arslan → II. Kılıçarslan; ilk savaş yarı hasarı komutan başına. Karne geçide göre: yığının yeri (kesilmedi / genişte / çıkışa yakın → "boğazın hemen ötesinde kes"), tutulamadı, sıkıştı ama vurulmadı, Manuel'e üç adım; bot türüyle doğrulandı. Olay takibine `blockade` (yığının z'si — "nerede" sorusunun verisi). Tarayıcıda doğrulandı (telefon yatay). Açık: 3★ bot için kolay (doğru yerde kesen hep alıyor) — insan verisiyle sıkılaştırılacak; gerçek cihazda kanyon kamerası. | ✅ prototip |
| 20a | **Tarih notları (hap bilgi)** — `src/lore/lore.ts`. Oyuncunun o savaşta yaptığı hamlenin tarihteki karşılığı, sonuç ekranında tek kart: ilk hilal → Hun sahte ricatı, bozgun → du Picq, gün batımı → Romanos'un dönüş emri, YOLU KES → Tzivritze geçidi, Manuel → barış şartları… 14 kart (Metehan 5, Alp Arslan 5, II. Kılıçarslan 4), her biri ≤ 220 harf ve kaynağıyla (Shiji, Attaleiates, Psellos, Khoniates). Kurallar: önce eylem sonra bilgi (yaşanmış an hafıza kancası), savaş sürerken kart yok, savaş başına en fazla bir kart, aynı savaşta birden çok kazanılırsa en nadiri (zirve-son), koleksiyon sayacı ("3 / 14"). Kazanılan kartlar `progress.lore`'da, savaş biter bitmez kaydedilir. `lore.test.ts`: kurallar + **erişilebilirlik** — iyi oynayan botlar 14 kartın hepsini açıyor (kazanılamayan kart koleksiyonda sonsuza dek boşluk olurdu), ilk savaşını kaybeden acemi de bir kart kazanıyor. Tarayıcıda doğrulandı (telefon yatay + masaüstü). Sıradaki: ana menü yeniden tasarımı + Bilgi Hazinesi arşivi (kilitli kartın başlığı ve onu ne açacağı görünür, metni görünmez) — 20b; pazarlama/gelir belgesi. Açık: tarihsel metinlerin bir tarihçiye okutulması (yayın öncesi şart); görülen kartları aralıklı tekrarla soru olarak sormak (geri çağırma pratiği). | ✅ |
| 20b | **Ana menü + Bilgi Hazinesi** — menü bir kapı değil, savaşın ilk anı: arkada seçilen savaşın açılış karesi, SAVAŞA GİR çekimi aynı kareden başlatır (kesme yok). Solda üç komutan, üç soru (NASIL · NE ZAMAN · NEREDE): en iyi yıldız, tarih notu sayacı, YENİ rozeti; kilitli komutan da seçilir (savaş alanı ve brifing görünür, girilemez). Sağda brifing: eksenin sorusu, üç adım, tek ana düğme. Bilgi Hazinesi (`lore/archive.ts`, saf ve testli): komutan sekmeleri, kilitli notun başlığı ve açma koşulu görünür, metni ve kaynağı yapı gereği kopyalanmaz. Klavyeyle gezinme; yatay telefon / masaüstü / dikey düzenler. Komutan başına en iyi yıldız kaydı (`recordStars`). | ✅ |
| 20c | **Dikey ekranda sade durum kartı** — savaşta kartta rekor ve komutan adı yok (rekor sonuç ekranında, komutan menüde), "temasta" uyarısı skorun yanında; dikeyde kart 156 px, duyuru kartın altında satır kırabiliyor. Düşmanın geldiği yön açık kalır. | ✅ |
| 20d | **Metehan yıldızları** — yıldız merdiven basamağından bağımsız: 100 − (100 − can) / çarpan ("tam hasarda ayakta kalır mıydın"). 2★ ≥ 0, 3★ ≥ 35; eşikler bot taramasından (4 beceri × 5 basamak × 40 tohum). Karne bir sonraki yıldızın bu basamaktaki can hedefini gösterir; menüde mühür yerine yıldız. | ✅ |
| 20e | **Kadife tema** — paneller (menü, mola, sonuç, Bilgi Hazinesi, savaş kartı) ortak `.velvet` malzemesinde: koyu kırmızı kadife + tüy + girih, gümüş kenar, köşe süsleri; menüde kilim şeridi. Düğmeler kartuş (birincil lacivert mine, ikincil kadife), emoji yıldızlar SVG `StarIcon`. Opak kartlarda `backdrop-filter` yok: WebGL tuvalinin üstünde her kare yeniden bulanıklaştırma olmasın. | ✅ |
| 21 | **Anonim savaş özetleri (uzak kayıt)** — `src/telemetry/remote.ts`, `addSink` ile. Sonuç ekranında tek soru (`DataConsent.tsx`), varsayılan kapalı; cevaptan sonra AÇIK/KAPALI düğmesi. EVET diyenin her savaş sonu özeti Supabase `hilal-oyun` (Frankfurt) `battle_summaries` tablosuna tek satır (`supabase/battle_summaries.sql`): yayımlanabilir anahtarla yalnızca ekleme (RLS; okuma, düzeltme, silme yok), özet ≤ 32 KB. Cihaz saati (`startedAt`) gitmez; `session` sayfa yüklemesi başına rastgele, saklanmaz — yalnızca aynı oturumdaki denemeleri bağlar. Oyuncunun büyütebildiği listeler (vuruş, mola, emir) 120 kayıtla sınırlı: en kötü özet 23 KB. `VITE_TELEMETRY_URL` / `VITE_TELEMETRY_KEY` yalnızca production derlemesinde (yerelde `.env.production.local`, Vercel'de production ortamı): dev ve önizleme veri göndermez, soru da çıkmaz. Uçtan uca doğrulandı (test satırı silindi). 160 test. Açık: canlıya çıkış (bkz. P0 Vercel). | ✅ |
| 22 | **Gizlilik sayfası** — `public/gizlilik.html` (oyundan bağımsız, PWA önbelleğinde): ne gider / ne gitmez, oturum kodu, Supabase Frankfurt, IP'nin altyapı günlüklerinde kalması, iznin geri alınması, iletişim GitHub Issues. Sonuç ekranındaki sorudan "Ne gönderiliyor?" bağlantısı. `toPayload` alanları değişirse sayfa da güncellenmeli. Açık: "en fazla iki yıl" saklama sözü için temizlik işi (pg_cron) henüz yok; metin hukukçu gözünden geçmedi. | ✅ |
| 23 | **Paylaşım kartı** — `public/og.jpg` (1200×630, 50 KB; kadife zemin, gümüş çerçeve, hilal, üç komutan) ve `index.html`'de Open Graph / Twitter etiketleri. Açıklama ve manifest metni üç komutanı anar. Adresler mutlak (`turkish-heroes.vercel.app`): alan adı değişirse `og:url` ve `og:image` da değişmeli. | ✅ |
| 24 | **Sefer haritası** — menüdeki komutan listesi yerine bozkırdan Anadolu'ya inen yol: Metehan → Malazgirt → Miryokefalon. Yol kilit zincirini izler (açık yol kesik, kapalı yol noktalı); mühürde hilal (kazanıldı) ya da kilit, adın yanında yıldız ya da YENİ. Sancak sıradaki hedefte durur: önce kazanılmamış ilk açık savaş, hepsi kazanılınca yıldızı en az olan, hepsi tam yıldızsa sancak yok. Yol SVG'de, düğümler HTML radyo düğmeleri (odak, ekran okuyucu, ↑/↓). Kurallar saf `mechanics/campaign.ts`'te. Komutan başına tarih notu sayısı brifingin altına taşındı. | ✅ |
| 25 | **Gerçek sesler** — sentezin taklit edemediği sesler artık kayıttan: vuruşta kılıç savrulması + zırh darbesi, ok yağmurunda yay kirişi + okların vınlaması (aynı savrulma 1,6× hızlı), hamle/kol hücumu/bozgunda üst üste binen dörtnal adımlarıyla bölük nalı (bozgunda kısılarak uzaklaşır), kaya yığınında taş çatırtısı. Metehan'ın atı her dörtnal döngüsünde bir adım çalar; görünen sekmeyle aynı ritim, ortam kanalından geçer (vuruşta kısılır). 14 dosya, ~220 KB, yalnız CC0 (Kenney, OpenGameArt); service worker önbelleğe alır. Örnek yüklenemezse (iOS 18.4 öncesi OGG) eski sentez çalar. Çeşitler arka arkaya tekrarlamaz, perde her çalışta ±%4 kayar. Kalan: gerçek hoparlörde seviye ayarı; kös ve boru için CC0 kayıt bulunamadı, sentezde. Modeller faz 28'de (sıra `MIMARI.md` §8: faz 26 okunabilirlik ve denge, faz 27 sinematik); adaylar iki CC0 Quaternius atı (poly.pizza `D3hAeqeDBE` animasyonlu 232 KB, `F8HAAcLeBL` 690 üçgen 288 KB). | ✅ |

**Kanıt disiplini:** Her denge kararı headless simülasyon taramasıyla
(iyi/orta/kötü bot) ölçülmüş, her görsel/etkileşim hatası gerçek tarayıcıda
ekran görüntüsüyle doğrulanmış. Faz 6-7'de de aynı disiplinle devam edildi
(CDP touch event'leriyle joystick sürüklenip oyuncunun hareketi doğrulandı;
bloom önce aşırı değerle teşhis edilip sonra dengeli değere çekildi). Bu
disipline devam edin.

## 3. Sonraki öncelikler

| Öncelik | İş | Not |
|---|---|---|
| P0 | Yol haritası | 2 Ekim'den itibaren tek kaynak `MIMARI.md` §8: sağlamlık paketi + ölçüm altyapısı → faz 26 okunabilirlik ve denge → faz 27 sinematik → faz 28 modeller. Her adımın kabul ölçütü orada; bulgular ve kanıtları §10'da. |
| P0 | Vercel production dalı | turkish-heroes.vercel.app 30 Eylül'e kadar faz 0'ı sunuyordu; `vercel promote` ile 04eed60'a alındı ama kalıcı çözüm değil. Vercel → Settings → Environments → Production → Branch Tracking: `claude/hilal-game-mvp-hp0ge5`. Yapılmazsa her merge'den sonra `vercel promote <preview-url>` gerekir. **1 Ekim:** hâlâ ayarlı değil — PR #9 (faz 18–19) ve #10 (faz 20–21) merge edildi, canlı faz 17'de. Ayar API'den değiştirilemiyor, panelden yapılmalı. Telemetri için önizlemeyi promote etmek yetmeyebilir: `VITE_` değişkenleri derlemeye gömülür ve yalnızca production ortamında tanımlı; ayardan sonra production derlemesi yeniden alınmalı. |
| P0 | PWA gerçek cihaz doğrulaması | Manifest ikonları faz 8'de eklendi (önceden manifest var olmayan PNG'lere işaret ediyordu). Ana ekrana ekleme ve sesin iOS'ta açılması hâlâ gerçek cihazda test edilmedi. |
| P1 | Gerçek telefonda performans ölçümü | Faz 9'da uyarlamalı kalite ve ölçüm araçları geldi; ölçümler SwiftShader (yazılım GPU) vekiliyle yapıldı — sıralama güvenilir, mutlak değerler değil. Orta seviye bir Android'de `?perf` ile FPS'e ve yerleşilen kademeye bakın; gerekirse `QUALITY` eşiklerini ayarlayın. 120 Hz ekranlarda 60 FPS sınırı ancak ısınma görülürse eklenmeli (90 Hz'de takılma yaratır). |
| P0 | Alp Arslan oyun testi (Kapı B) | Tasarım belgesi: https://claude.ai/code/artifact/3cfcab6d-1bf9-4b66-819f-82c771cbb291. Kapı: prototipi gönüllü olarak ikinci kez oynamak istiyor musun? "Metehan'ın aynısı" deniyorsa hamle ve akşam dönüşü güçlendirilir ya da II. Kılıçarslan'a geçilir. Dengeyi `?tune` ile oynarken ayarlayın; kalıcı değer `corps.test.ts`'ten geçmeli. Faz C'nin görsel/işitsel dilimleri faz 12–13'te geldi; kalan: gerçek cihazda oyun testi (ambiyansın gerçek hoparlörde dinlenmesi ve iOS'ta arka plandan dönünce sesin sürmesi dahil). |
| P2 | Gerçek Metehan modeli | Faz 10'da ilkel şekillerden süvari geldi (`src/characters/riderGeometry.ts`); gerçek model hâlâ dışarıdan gelmeli (Meshy/Tripo + Mixamo; ya da Hugging Face connector'ı üzerinden Hunyuan3D/TRELLIS gibi Space'ler — iskelet/animasyon için yine Mixamo). |
| P1 | Oyuncu verisiyle karne ve merdiven (faz 18'in kapanışı) | Karne ve merdiven botlarla ölçüldü; insan davranışı farklı olabilir. `?telemetry` verisinde bakılacaklar: (a) `advice` → aynı komutanla sonraki denemede sonuç iyileşiyor mu (tavsiye başına iyileşme oranı); (b) `assist` başına zafer oranı — merdiven insanları da ~%50'ye yakınsatıyor mu, alt basamakta takılan çok mu; (c) sonuç ekranından sonra YENİDEN oranı (aynı `session`'da ardışık `attempt`) — Kapı B'nin doğrudan ölçüsü; (d) `close` olan yenilgilerden sonra tekrar oynama oranı ötekilerden yüksek mi. Metehan'a yıldız eklemek düşünüldü ama ölçüt bulunamadı (en büyük hilal her kazananda ~30, ayırt etmiyor; can ×1'de uzmanın bile %1'inde ≥ 50): insan verisi gelmeden eklenmedi. |
| P2 | Oyuncu verisiyle denge | Olay takibi faz 14'te yerel olarak, uzak kayıt ve oyuncu izni faz 21'de geldi (PostHog yerine Supabase: tek tablo, SDK'sız `fetch`). Gizlilik sayfası faz 22'de geldi; kalan: iki yıllık saklama işi (pg_cron + `created_at` indeksi; SQL `supabase/battle_summaries.sql` sonunda hazır, canlı veritabanına henüz uygulanmadı) ve metnin hukuki gözden geçirmesi. Veri gelince bakılacaklar: Miryokefalon'da yığının z'si ↔ yıldız (3★ botlar için kolay), `assist` başına zafer oranı, tavsiye → sonraki deneme. Canlıya çıkana kadar oyun testinin verisi `?telemetry` → VERİYİ KOPYALA ile alınır. |

**Önerilen araçlar (araştırıldı, faz 9):** Hugging Face (3D/görsel üretim
Space'leri), Splice (telifsiz ses/müzik örnekleri), PostHog (oynanış
analitiği), Sentry (gerçek cihaz hataları, WebGL bağlam kaybı), Figma (kurulu,
yeniden bağlanmalı — HUD/menü tasarımı). Skill'ler: `mobile-game-dev`,
`psikoloji-bilimleri` (akış/motivasyon), Anthropic `design` eklentisi.

## 4. Teknoloji Yığını (gerçek, package.json'dan)

```
Vite 8 + React 19 + TypeScript
@react-three/fiber 9 + @react-three/drei 10
@react-three/postprocessing 3 + postprocessing
three r185
zustand 5
vite-plugin-pwa 1
oxlint (lint)
```

## 5. Mimari Notlar

- Simülasyon Zustand dışında tutuluyor (`src/sim/world.ts`) — 60Hz React
  re-render'ı önlemek için. HUD'a ~12Hz throttle ile özet aktarılıyor.
- `src/mechanics/` — oyun mantığı (enemySim, hilalSystem, combat, waves, corps, scenario, types)
- `src/sim/` — dünya durumu + skor kalıcılığı
- `src/components/` — R3F sahne bileşenleri. Çizim `EffectComposer`
  (`renderPriority`) üzerinden; `Renderer.tsx` kaldırıldı, aynı önceliğe
  EffectComposer oturdu. Öncelik sırası: oyuncu 0 → düşman 1 → yönetmen 2 →
  görseller 3 → kamera 5 → sarsıntı 6 → EffectComposer/çizim 10.
- `src/hooks/` — girdi: `useKeyboard` (masaüstü), `useTouchControls.ts`
  (dokunmatik, aynı ref-tabanlı arayüz; bileşeni `components/TouchJoystick.tsx`),
  `useStrikeInput` (Space vuruş, menülerde Space/Enter)
- `src/audio/sfx.ts` — sentezlenmiş efektler. AudioContext BAŞLA tıklamasında
  açılır (tarayıcı kuralı); efektler GameDirector'dan tetiklenir. Sekme
  gizlenince context askıya alınır.
- `src/audio/samples.ts` — gerçek kayıtlar (faz 25): nal, zırh, yay, kaya.
  Dosyalar `public/audio`'da (~220 KB, yalnız CC0; kaynaklar `CREDITS.md`'de,
  test her dosyanın orada geçtiğini sınar). Kilit açılınca çözülür; örnek
  yoksa `playSample` false döner ve `play()` eski sentez tarifini çalar.
  Boru, kös ve arayüz sesleri bilerek sentezde.
- `src/audio/ambience.ts` — rüzgâr + müzik ayrı bir veriyolunda (bus → duck →
  master); `duck()` yalnızca onu kısar, vuruş efekti tam duyulur. Kös ses
  saatine göre planlanır (100 ms'lik zamanlayıcı, 0,3 sn ileri bakış), kare
  hızından bağımsız. `setBattleMusic` her kare yönetmenden; müziği savaş
  durumu açar/kapatır.
- Rüzgâr (`world/wind.ts`): `windGust(t, x, z)` JS'te, `GUST_GLSL` aynı
  sabitlerden üretilen GLSL eşi — çimen shader'ı, `DustTrails` ve `SteppeWind`
  (sesi ~10 Hz'de besler) aynı esintiyi görür. Sabit değişirse ikisi birlikte
  değişir; testli.
- `DustTrails`: tek örneklenmiş mesh (+1 draw call), 512'lik havuz, yumuşak
  alfa dokulu düzlemler; bulutlar kameraya, perdeler yere bakar. Düşük
  kademede bileşen hiç kurulmaz.
- HUD: `HilalEnergyHUD` + `StartScreen` + `OutcomeScreen`, stil `hud.css`.
- Testler: `src/mechanics/*.test.ts`, `src/perf/*.test.ts` (`npm test`).
  `balance.test.ts` mekaniğin iki sözünü sabitler: durmak enerji vermez,
  kiting kuşatmayı kurar.
- Performans (`src/perf/quality.ts`): sahne hafif (~29 draw call); maliyet
  piksel doldurmada. Kademeler yalnızca DPR/MSAA/gölge/bloom/noise çevirir.
  MSAA oturum boyunca sabit (EffectComposer'ı yeniden kurdurmak eskisini
  dispose etmiyor). DPR değişince composer tamponları kendiliğinden küçülüyor
  (Canvas yeniden render → R3F boyutu yeniden yazıyor; ölçüldü). Ton eşlemesi
  yok (renderer'dakini EffectComposer kapatıyor); gerçek ACES istenirse efekt
  zincirine `<ToneMapping>` eklenmeli — görünümü değiştirir, sanat kararı.
- Kare ölçümü: `?perf` ile üretimde FPS paneli; `__world`/`__gl`/`__scene` yalnızca dev.
- Dünya (`src/components/world/`): `terrainShape.ts` saf fonksiyonlar (yükseklik,
  renk, gürültü; testli — arena r ≤ 34'te yükseklik tam sıfır, birimler y = 0'da
  yürür). Arazi ızgarası ve çimen sayısı kademeye bağlı. Gökyüzü kubbesi
  (`SkyDome`) taktik kamerada görünmez; açılış ve gün batımı çekimlerinde
  kamera alçalınca görünür. Taktik derinliği sis veriyor.
- Süvari (`src/characters/riderGeometry.ts`): ilkel şekiller köşe rengiyle
  boyanıp birleştiriliyor. Düşmanda at ve binici iki örneklenmiş mesh (aynı
  matris); binicinin beyaz parçaları disiplin rengini `instanceColor` ile alır.
- Hitstop: `world.hitstop` > 0 iken `simDelta()` sıfır döner; oyuncu, düşman,
  yönetmen ve kıvılcımlar aynı kuralı kullanır. Düşenlerin konumu
  `world.fxKills` ile efekte aktarılır (`executeStrike`'ın isteğe bağlı parametresi).
- Faz 10 maliyeti (SwiftShader vekili, telefon 844×390): yüksek 683 → 960 ms,
  orta 417 → 513 ms, düşük 63 → 77 ms/kare. Gerçek GPU'da köşe maliyeti çok daha
  düşük olmalı; `?perf` ile doğrulanmalı.
- Senaryolar (faz 11): `mechanics/scenario.ts` komutan tanımları ve örnekleme
  kapasitesi (tüm senaryoların en kalabalığı); `sim/scenarios.ts` `Scenario`
  arayüzü (düşman hareketi, kuşatılabilirlik, düşme filtresi, vuruş sonrası,
  akış, sonuç, zafer bonusu). Yönetmen ortak döngüyü yürütür, senaryo
  kurallarını sorar. `world.commander` + `world.battle` (Malazgirt durumu).
  Rekor komutan başına (`hilal_best_score` Metehan için korundu).
- Malazgirt (`mechanics/corps.ts`): `stepBattle` saf; olaylar `battle.events`
  ile yönetmene (duyuru + ses). Asker görevi (düzen / uyarı / hamle)
  `battle.mode` dizisinde. Kuşatılabilirlik en savunmasız birlikten
  (`calcSiegeState`'in birlik alt kümesi). `executeStrike`/`countInCrescent`
  isteğe bağlı `FallFilter` alır (Malazgirt'te birlik bütçesi); korunan
  (`guarded`) asker yaya kapılmaz ve nişanı çekmez. Arena geometrisi
  değişmedi (r 29): ordu 28 birim yürür (−14 → ordugah 14).
- Selçuklu kolları (`mechanics/wings.ts`): kolun kendi durumu (emir, konum,
  güç, varma ölçüsü) orada; birliklerle ilişkisi (hedef seçimi, taciz ve
  tutmanın birliğe işlenmesi) `corps.ts`'teki `stepWings`'te. Kolun tacizi
  oyuncununkine eklenir; tutma (`pinned`) yalnızca ilerlemeyen birliğe işler
  — ilerlemeyi, dönüşü ve çekilmeyi yavaşlatır. Emir `gameStore.cycleWing`'ten
  doğrudan simülasyona yazılır. Süvariler (`AlliedWings`) kolun noktası
  çevresinde emre göre dizilir; çizim durumu yalnızca bileşende.
- Bot döngüsü `mechanics/battleBots.ts` (yönetmenin savaş kolunu izler;
  oyun kodu içe aktarmaz). Botların hareketi hedefe çekim + başka
  birliklerden itilme; hamleden kaçış tehditlerin tam tersine.
- Faz 11 maliyeti (SwiftShader, telefon): Malazgirt orta 471 ms (Metehan
  411), düşük 78 ms (70); draw call 34 → 48 (düzen çubukları + ordugah).
- Metehan dalga döngüsü (`mechanics/waveBots.ts`): yönetmenin dalga kolunu birebir izler; kaçış algısı artık saf `isRetreatingFrom` (hilalSystem) — yönetmen ve botlar aynı kuralı kullanır. `runWaves(bot, record?, rout?, spawnAway?, damageScale?)`: son üçü önce/sonra ölçümleri için (testler kuralların neden var olduğunu bu parametrelerle belgeler, `metehan.test.ts`). `kiter(skill, seed)` insan gibi kusurlu atlı okçu; `SKILLS` uzman/iyi/orta/acemi.
- Bozgun (`Enemy.routed`, `waves.routSurvivors`): yalnızca Metehan. Kaçan asker `alive` kalır (çizilsin, uzaklaşsın) ama kuşatılabilirlik, yön, yay, vuruş ve temasta sayılmaz; sınırda `fled` olur. Dalga, kaçanlar sahadan çıkınca temizlenir.
- Zorluk merdiveni: `waves.DAMAGE_LADDER` + `progress.ladder`; senaryonun `assist()`'i çarpanı verir (Malazgirt'te ilk savaşın 0,5'i). Yalnızca zafer/yenilgi basamak değiştirir; moladan çıkış ve yarıda bırakma değiştirmez.
- Savaş karnesi (`src/debrief/`): savaş bitince yönetmen `projectEnd` ile özetin kapanmış halini alır (kaydetmeden), `debrief()` karneyi yazar, tavsiye `battle_end`'in içinde kayda geçer; karne `world.debrief` → HUD. Botlar (`runBattle`/`runWaves` `record`) aynı olayları üretir: karne testleri oyuncuyla aynı hattan geçer.
- Ordu savaşları (`corps.ts`): kurallar ortak, savaş alanı `BattleLayout`'ta (dizilim, hedef çizgisi, gün batımı/gece, taban, irkilme, kol hedefleri/pusu yeri, oyuncunun başlangıcı, `pass`). `MALAZGIRT` değerlerini getter'larla `BATTLE_CONFIG`'ten okur (?tune canlı çalışsın). Geçitte ek adım `stepColumn` (kuyruk sınırı `limit`, sıkışma `jam`, yığının aşınması); disiplin her yerde `corpsDiscipline` = düzen × dönüş × (1 − sıkışma). CENTER ve REARGUARD indeksleri iki düzende aynı. İki komutan aynı `battle` senaryosunu kullanır; metinler `PASS_TEXT` ile geçide uyarlanır.
- Geçit (`mechanics/pass.ts`): `passHalfWidth(z)`, `narrowness(z)`, `confineToPass` — oyuncu, askerler, botlar ve arazi (`terrainShape.passWallHeight`) aynı sınırı kullanır. Taban tam düz (y = 0); yalnızca yamaçtaki kollar arazi yüksekliğinde çizilir.
- Olay takibi (`src/telemetry/`): `summary.ts` saf (olay türleri + özete işleme, testli), `track.ts` çalışma zamanı. Olaylar yönetmenden (savaş başı/sonu, vuruş, ret) ve senaryolardan (dalga temizlendi, savaş olayları) gelir. Savaş başlangıcı ayrı bir çağrı değil: yönetmen oyun sürerken etkin savaş yoksa açar. Saat gerçek zamanlı ve yönetmenin 0,1 sn'lik kare sınırını kullanır (hitstop/ağır çekimden etkilenmez, sekme gizliyken işlemez). Veri cihazdan çıkmaz.
- Mola (`world.paused`): `isPlaying()` false, `simDelta()` 0 döner; Scene `frameloop`'u 'demand'a alır. Yönetmen o yüzden çalışmaz — savaş müziğini `pause()` kendisi kısar, DEVAM'da yönetmen geri açar. Otomatik mola `useAutoPause` (visibilitychange + blur); telemetrinin sayfa kapanışı kaydı (pending) bundan bağımsız sürer.
- Kamera çekimleri: taktik kamera 45°/55° FOV — ~63 birimden ötesi kadraja giremez, ufuk ancak çekimlerde görünür. Simülasyon `world.cameraCue` ('intro' | 'dusk') bırakır, FollowCamera tüketir (fxKills gibi); ağırlık eğrisi saf ve testli (`cameraShots.ts`). Gökyüzü opaklardan sonra, uzak düzlemde çizilir: arazinin örttüğü pikseller derinlik testinde elenir. Ton eşleme bilinçli olarak eklenmedi (tüm renkleri kaydırır; sanat kararı).
- Karakter mesh'i geldiğinde: `src/characters/metehan/`

## 6. Token Stratejisi / Model Yönlendirme

- Rutin iş (UI, hook'lar, scaffold) → Sonnet 5
- Karmaşık oyun mantığı / denge / gerçek blocker → Opus 4.8
- Her fazdan sonra headless doğrulama + gerçek tarayıcı ekran görüntüsü
  şart — bu proje bu disiplinle kazandı, gevşetmeyin.
- Her faz sonunda commit + push. PLAN.md'yi güncel tutun — v1 unutulup
  gitti, bir daha olmasın.

---

*30 Eylül 2026: faz 18 (adil savaş + savaş karnesi) ve faz 19 (Miryokefalon prototipi) eklendi.*

*Bu dosya 20 Temmuz 2026'da, repoda hiç PLAN.md olmadığı fark edilince
gerçek commit geçmişinden yeniden oluşturuldu. Faz 6-7 (dokunmatik kontrol,
post-processing) tamamlandıktan sonra aynı gün içinde güncellendi.*
