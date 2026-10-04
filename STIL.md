# Stil rehberi

Oyunun görsel kararlarını yargılayan kurallar. Her yeni görsel (Faz 28 modelleri
dahil) önce buna uyar, sonra beğeniye sunulur. Sayılar ölçüldü; ölçüm düzeneği
§12'de.

Kaynak: MIMARI.md §10.2 (V1–V6), §10.5 (M1–M2), §10.8 (referans çekimler).
Sanat açıları R8 (yer seviyesi) ve R9 (geniş plan) oyun kamerası değildir;
model ve renk kararları bu iki sabit açıyla yargılanır. Oyunun okunabilirliği
ise R3 (taktik) ve R5 (gün batımı) ile.

---

## 1. İlke: önce değer, sonra renk

Oyuncu telefonda, güneşte, 667×375'te oynuyor. Ton (hue) farkı orada kaybolur;
parlaklık farkı kalır. Bu yüzden her şey önce **değer** (OKLab L) rolüyle
tasarlanır, renk sonra gelir. Gri tonlamaya çevrilmiş bir karede de taraflar,
kahraman ve tehlike ayrı okunmalı.

## 2. Değer rolleri (V1)

Açıktan koyuya. "Ölçülen" sütunu R3/R5 yüksek kademe, ekrandaki ortanca L.

| Rol | Hedef L | Ölçülen | Not |
|---|---|---|---|
| Efektler (vuruş, ok izi, hilal) | en açık, >0,8 | — | Bloom yalnız bunlara (§7) |
| Gök ve ufuk pusu | 0,70–0,80 | öğle 0,76, gün batımı 0,70 | Ordu ufka karşı siluet olur |
| **Kahraman** | birimler arasında tek açık leke | 0,43–0,69 (iki tonlu) | Ak at + koyu tuğ (§4) |
| Zemin (arazi + çim) | 0,40–0,55 öğle; 0,30–0,48 gün batımı | 0,41–0,52 / 0,31–0,48 | Orta-açık, birimlerin fonu |
| Selçuklu birlikleri | zeminden ≥0,15 koyu | 0,16–0,20 | Doru at |
| Bizans ve düşmanlar | en koyu | 0,14–0,20 | Yağız at |

**Kural:** her birim grubu, ardındaki zeminden ortanca |ΔL| ≥ 0,15 ayrılır
(öğle ve gün batımı, iki kademe). Ölçüt işaretsiz: kahraman bilerek iki tonlu,
açık ve koyu yarıları işaretli ortancayı sıfıra çeker ama göz onu zeminden
ayırır. İşaret de raporlanır: ordu eksi (zeminden koyu) kalmalı.

**Önce/sonra** (aynı tohum, t=6 ve t=104, yüksek kademe, ortanca |ΔL|):

| Ekran | Düşman | Selçuklu | Kahraman |
|---|---|---|---|
| R3 Malazgirt | 0,126 → **0,228** | 0,112 → **0,192** | 0,105 → **0,167** |
| R3 Metehan | 0,077 → **0,196** | — | 0,090 → **0,218** |
| R3 Miryokefalon | 0,075 → **0,170** | 0,096 → **0,180** | 0,110 → **0,192** |
| R5 gün batımı | 0,082 → **0,196** | 0,075 → **0,156** | 0,105 → **0,184** |

R9'da (geniş plan) uzak ordu pusa karışır (|ΔL| ~0,05–0,14). Bu hava
perspektifi, kusur değil: geniş planda ordu zeminle değil gökle ayrılır —
kamera yönetmeni (G1) geniş çekimi ufku kadraja alarak kurar (§9).

## 3. Palet

Hex değerleri kodda tek yerde; buradaki tablo özet. L = OKLab L.

**Selçuklu** (`riderGeometry.ts`)

| Öğe | Renk | L |
|---|---|---|
| Kahraman kaftanı | `#2a9d8f` turkuaz | 0,63 |
| Kahraman süsü, tuğ tepeliği | `#e9c46a` altın | 0,83 |
| Birlik kaftanı | `#1f6f66` koyu turkuaz | 0,49 |
| Birlik süsü | `#b8862b` | — |
| Yay | `#a8773f` boynuz | 0,61 |

**Bizans** (`EnemySwarm.tsx`, binicide instanceColor)

| Öğe | Renk | L |
|---|---|---|
| Düzen | `#6a3a96` imparatorluk moru | 0,45 |
| Dağılmış | `#b0605a` soluk kızıl | — |
| Hamle | `#ff2a12` doygun kırmızı | 0,64 |
| İmparator | `#e8b923` altın | 0,81 |

**Durum** (`palette.ts`; HUD'da `--ready`)

| Öğe | Renk |
|---|---|
| Hilal şarj | `#ffd700` altın |
| Hilal hazır | `#5ef2e0` parlak turkuaz |
| Düşman hamlesi | `#ff2a12` (yukarıda) |

Metehan'ın düşmanı (savaş dışı dalgalar): düzen `#6b7d99` çelik mavisi,
dağılmış `#d04a3a`.

**Kurallar:**
- Turkuaz ve altın Selçuklu'nundur; Bizans'ta kullanılmaz (imparator altını
  tek istisna: o bir hedef, taraf değil).
- Kırmızı tehlike demektir: hamle kaması ve hamle eden binici. Düz dekorda
  doygun kırmızı yok.
- Durum rengi (düzen → dağılma → hamle) binicinin giysisi, kalkanı ve
  flamasıyla taşınır; at donu durumla değişmez.

## 4. At donları (V3)

At tarafı söyler; toprakla aynı ton olmaz (önceden üç taraf da aynı, toprakla
ΔE 0,028'di).

| Taraf | Don | Gövde | Yele/kuyruk | L (gövde) |
|---|---|---|---|---|
| Kahraman | ak | `#e6dfd2` | `#8c8478` | 0,91 |
| Selçuklu | doru | `#4e2a17` | `#1e120a` | 0,33 |
| Bizans | yağız | `#262019` | `#0f0c0a` | 0,25 |

Yele ve kuyruk her donda gövdeden ayrı tonda: at, kutu değil at gibi okunur.
Ak at kahramanı sürü içinde ilk bakışta buldurur — kroniklerdeki "beyazlar
giyen Alp Arslan" motifine de yakışır.

## 5. Siluet (V4)

**Ölçek:** taktik kamerada (R3) 1 birim ≈ 13 px; atlı ≈ 25–30 px. Bir
ayrıntı en az 1 px olmalı: **en ince parça 0,09 birim**. Daha incesi kenar
yumuşatmada kaybolur ya da titrer.

Her tarafın tek bakışta okunan bir imzası var. İmza, kameranın gördüğü
düzlemde durur (kameraya yüzü dönük): yandan bakınca bıçak gibi ince kalan
bir flama yukarıdan görünmez.

| Kim | İmza | Neden |
|---|---|---|
| Kahraman | Sırtta büyük tuğ (koyu at kılı, altın tepelik), öne yatık mızrak | Sürünün üstünde ilk görülen şey; kahramanın koyu yarısı |
| Selçuklu | Sol elde büyük, açık renkli yay; mızrak yok | Atlı okçu; doru at üstünde açık yay |
| Bizans | Dik mızrak + ucunun altında boyanabilir flama | Yukarıdan "mızrak ormanı"; flama durum rengini taşır |
| İmparator | 1,25× ölçek, altın binici, yanında sancak | Ordunun üstüne çıkan tek büyük düz yüzey |
| Romanos (Malazgirt) | Mor kare sancak, altın haç | İki imparator ayrı okunur |
| Manuel (Miryokefalon) | Kızıl çatal kuyruklu sancak, altın kuşak | |

Sancaklar ayırt etme imzasıdır; tarihî arma iddiası taşımaz.

## 6. Işık ve gün saati

`DayCycle.tsx`. Üç anahtar an, aralar yumuşak geçiş:

| An | Güneş | Şiddet | Konum | Gök/yer (hemi) | Pus |
|---|---|---|---|---|---|
| Öğle | `#ffd9a0` | 2,2 | (18, 22, 12) | 0,6 | `#c9ab80` |
| Gün batımı | `#ff7a3d` | 2,8 | (22, 12, −20) | 0,8 | `#d98553` |
| Gece | `#8fa3d0` | 0,9 | (−12, 20, 10) | 0,4 | `#252c44` |

- Gün batımında güneş Bizans ordusunun ardında batar: gölgeler oyuncuya doğru
  uzar, ordu kızıl ufka karşı siluet olur. Bu, değer yapısının (§2) gün
  batımındaki hâli: ordu koyu, ufuk açık.
- Gün batımı ışığı ton eşlemeyle (§7) birlikte ayarlandı: ACES orta tonları
  koyulttuğu için şiddet 2,0 → 2,8, güneş y 9 → 12 (gölge boyu oynanabilir
  kalsın), hemi 0,5 → 0,8 (gölgedeki birlikler simsiyah olmasın).
- Ortam ışığı düşük (0,2–0,25): siluet ve gölge ondan gelir.
- Karşı yönden soğuk dolgu (`#6a7fa8`, 0,5): siluetin içi tamamen kararmaz.

## 7. Ton eşleme ve efekt zinciri (V6)

Işık yüksek dinamik aralıkta birikir, ekrana **ACES Filmic** eğrisiyle iner.
Zincir (`Scene.tsx`): Bloom → ToneMapping (ACES) → Vignette → Noise.
EffectComposer renderer'ın ton eşlemesini kapatıyor; bu yüzden eğri efekt
olarak zincirde, renderer ayarında değil (oradaki eski ACES ayarı ölüydü).

Neden ACES: dört aday aynı karelerde denendi (yok, ACES, AgX, Neutral). ACES
orta tonlarda en güçlü kontrastı verdi — değer ayrımının (§2) aradığı şey bu.
AgX gün batımını soldurup pembeleştirdi; Neutral tonu korudu ama kareyi
çamurlu bir sarıya kaldırdı, kontrast düştü.

- **Bloom** efektler içindir: vuruş, ok izi, hilal. Eşik 0,55 (ışık
  birikiminde, ton eşlemeden önce). Yeni açık bir yüzey (ak at, keçe) R8'de
  parlıyorsa eşik değil o malzeme koyulaştırılır.
- **Vinyet** hafif: gözü merkeze, kahramana toplar.
- **Gren** yalnız yüksek kademede, neredeyse görünmez.
- **Renk derecelendirme** (Faz 27, 5. adım) bu eğrinin üstüne kurulur: savaş
  başına LUT, yüksek kademe.

## 8. Ortam

**Çim (V5).** Çim dokudur, nesne değil: zemini canlandırır, birimin önüne
geçmez. Yüksek kademede 4000, ortada 3500 öbek (önceden yüksekte 8000; karenin
üçgenlerinin %72'si çimdi ve birimleri örtüyordu). Düşükte çim yok.

**Arazi.** Yüksekte 2,5 birimlik hücreler (~29 bin üçgen; önceden 2 birim,
45 bin, çoğu kameranın bakmadığı uzak tepelerde). Doku dosyası yok: renk
gürültüden (`terrainShape.ts`). Arazi albedoları L 0,32 (iz) – 0,59 (saman),
çim 0,51 → uçta 0,82; ışıkla ekranda zemin 0,40–0,52 okunur (§2). Yeni zemin
rengi bu bandın dışına çıkmaz.

**Ordugah ve yakın inceltme.** Taktik kamerada ordugah ekranın alt kenarına,
HUD'un arkasına düşüyor. Kameraya yakın yapılar noktalı (dither) incelir:
- Mesafe pikselin değil **yapının**: çadır, otağ, tuğ bütün olarak kaybolur;
  yarı noktalı kalıntı bırakmaz (`fadeAnchor`).
- Bant dar (24,5–25,5 birim): yapı ya tam görünür ya yoktur.
- Gölge de aynı ölçütle incelir (`customDepthMaterial`): görünmeyen otağın
  gölgesi zeminde koyu leke bırakmaz.
- Kazık hattı kalır: kaybetme sınırı hep görünür.
- Sinematik çekimde ve sanat açılarında inceltme kapalı: ordugah ön planı
  çerçeveler.

## 9. Kamera dili (Faz 27 G1 için ilkeler)

- **Taktik kadraj okunabilirlik içindir.** Düşman cephesi HUD'un altında
  kalmaz (K2); oyuncu 180° dönüşte ekranda ≤%10 yükseklik kayar (K1).
  Eğim 38°, bakış oyuncunun 3 birim önünde (`tacticalCamera.ts`); bekçisi
  `art.spec.ts` kadraj.
- **Sinematik kadraj değer yapısını kullanır.** Ordu ufka karşı (koyu üstüne
  açık); geniş planda ufuk kadrajda olur, yoksa ordu pusa karışır (§2, R9).
- **Ön plan çerçeveler.** Ordugah, kayalar, kanyon duvarı sinematik çekimde
  kadrajın kenarını tutar; taktikte incelir.
- **Kahraman tek açık leke** olduğu için her kadrajda gözün ilk durağıdır;
  sinematik kompozisyon onu üçte bir çizgilerine koyar, ortalamaz.
- Sarsıntı vuruş yönünde olur: hilal vuruşu yay yönünde ileri-geri, yara
  dikey (`shake.ts`). Rastgele gürültü yok.
- Kesilen çekim sert kesmez; son çizilen duruştan 1 sn süzülür.
- Her çekim: girdiyi kilitlemez, dokununca atlanır, hareketi azaltta kapalı.

## 10. Bütçe

**Kare bütçesi** (gölge pasosu dahil, `gl.info`):

| Ekran | Yüksek önce → şimdi | Düşük şimdi | Sınır |
|---|---|---|---|
| R3 Metehan | 81,6k → **53,5k** | 22,3k | yüksekte ≤55k |
| R3 Malazgirt | 102,5k → **73,7k** | 43,3k | — |
| R3 Miryokefalon | 98,3k → **69,6k** | 39,1k | — |

**Faz 28 modelleri** (MIMARI.md §7.2'deki bütçe, kare bütçesine uydurulmuş):

| Varlık | LOD0 (R8 yakın) | LOD1 (R3 taktik) | Not |
|---|---|---|---|
| Kahraman (atlı) | ≤15k | ≤3k | Tek örnek |
| Kalabalık birimi (atlı) | ≤1,5k | **≤300** | Malazgirt'te ~60 atlı × 2 paso: 300 üçgenle ~36k |
| Sahne nesnesi | ≤3k | ≤1k | Otağ, çadır, kaya |

Kalabalık için taktik LOD şart: 60 atlı × 1,5k × 2 paso = 180k, kare
bütçesinin üç katı. Taktik kamerada atlı ~25 px; 300 üçgen o boyda yeter.

**Modelden beklenen:**
- Değer rolüne uyar (§2): Bizans atlısı zeminden koyu, kahraman açık.
- Don ve palet bu rehberden (§3, §4); doku yerine köşe rengi ya da küçük atlas.
- İmza parçaları (tuğ, yay, mızrak, sancak) ≥0,09 birim ve kameraya dönük (§5).
- +z'ye bakar, ayakları y = 0'da (bugünkü prosedürel modelle aynı yön).
- R3 ve R8'de önce/sonra; art.spec yeşil.

## 11. Kenar yumuşatma (M2)

Bugün: yüksek MSAA 4 + DPR ≤2; orta MSAA 2 + DPR ≤1,5; **düşük hiçbiri yok**
(MSAA 0, DPR 1). Siluet imzaları 1 px civarında olduğu için düşük kademede
mızrak ve yay titreyebilir.

**Karar gerçek telefonda ölçülecek** (masaüstünde GPU süresi ölçülemiyor, M1).
Üretimde çalışan URL anahtarları:

1. `?quality=low&perf` — bugünkü düşük kademe; FPS paneli + `msaa 0`.
2. `?quality=low&perf&msaa=2` — aynı kademe, MSAA 2.

Aynı savaşta ~30 sn oynanır, FPS paneli ve mızrak/yay titremesi karşılaştırılır.

**Karar kuralı:** MSAA 2 düşük kademede ortanca FPS'i %10'dan az düşürüyorsa
düşük kademe MSAA 2'ye geçer; daha çok düşürüyorsa kalır, titreme için
imza parçaları kalınlaştırılır.

## 12. Bekçi ve ölçüm

`e2e/art.spec.ts` (Playwright, `shots` projesi): R3 (3 komutan) ve R5'i iki
kademede çizer, her birim grubu için ortanca |ΔL| ≥ 0,15 ve Metehan yüksek
kademe ≤55k üçgen ister.

Ölçüm `window.__artProbe` (`ArtProbe.tsx`, yalnız çekim kipi): aynı karenin
üç hâli — normal, birimler gizli (birimin ardındaki zemin) ve birim grubu
maskesi (grup macenta, gerisi siyah). Maske birimin rengine bakmaz, yalnız
nerede olduğuna; saydam katmanlar (hilal önizlemesi, toz) maskede gizlenir.

Görsele dokunan her PR'da: etkilenen R çekimlerinin önce/sonra tablosu ve
değişen renklerin L ya da ΔE sayısı (MIMARI.md §10.8).
