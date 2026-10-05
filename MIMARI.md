# HİLAL — Mimari ve Risk Raporu

**Tarih:** 1 Ekim 2026 · **Kapsam:** faz 25 sonu (PR #15, `0fadcaa`; satır numaraları `feeee38` içindir) · **Güncelleme:** 2 Ekim 2026, disiplinler arası değerlendirme (§10) ve birleşik yol haritası (§8)
**Yöntem:** Kod dört alanda bağımsız incelendi: simülasyon, görüntü ve kamera, platform, arayüz akışı. Ölçümler alındı, Google Flow ve Meshy için dış araştırma yapıldı. Yüksek önemli her iddia ayrıca kodda doğrulandı; yanlış çıkan iddia düzeltildi (Ek A).

Bu belge yaşayan bir kayıttır: her faz sonunda risk kaydı güncellenir (§9).

---

## 1. Özet

**Genel hüküm: çekirdek sağlam.** Kurallar katmanı (`src/mechanics`) React'ten ve three'den bağımsız, tohumlu ve testli. Zaman tek bir kapıdan (`simDelta`) geçiyor. Kodda tek bir `any` yok. Bu büyüklükteki oyun projelerinin çoğunda bu disiplin bulunmaz.

**Asıl risk dikişlerde.** Sorunlar tek tek dosyalarda değil, katmanların birleştiği yerlerde:

1. **Simülasyon, çizim bileşenlerinin içinde koşuyor.** Yer tutucu modeller GLB ile değiştirilince, model yüklenirken oyun mantığı da duruyor. Modellerden önce çözülmeli.
2. **Olaylar tipsiz ve tek okuyuculu; kameranın bir yönetmeni yok.** Ok kamerası "hangi ok, nereden, nereye" bilgisine ulaşamıyor. Sinematikten önce çözülmeli.
3. **Zaman ölçeği tek ve sabit; dörtnal duvar saatiyle işliyor.** Ağır çekim yakın planlarda atlar yerinde kayar.
4. **Oyun akışı örtük.** Akış dediğim menü, oyun, mola ve sonuç ekranları arasındaki geçişler. "Sinematik" diye bir durum ifade edilemiyor. Klavye kısayolu odaktaki düğmeyi ele geçiriyor.
5. **Çökme ağı yok.** Tek bir çizim hatası ya da WebGL bağlam kaybı boş ekran demek.

**Bugün düzeltilecek kol hatası:** Simülasyon doğru çalışıyor; sorun görselde ve geri bildirimde. Üstelik kolların tacizi, Metehan'ın okları gibi çiziliyor (§6).

**Önerilen sıra:**
1. ~~Kol düzeltmesi~~ (PR #16)
2. Küçük bir sağlamlık paketi + ölçüm altyapısı
3. Faz 26 Okunabilirlik ve denge
4. Faz 27 Sinematik, önkoşullarıyla
5. Faz 28 Modeller, önkoşullarıyla

Temel işler ayrı, "görünmez" bir faza konmuyor; onlara ihtiyaç duyan faza bağlanıyor. Böylece her faz oyuncunun göreceği bir şeyle kapanıyor.

**Video ve modeller:** Flow videosu mümkün, ama her savaştan önce değil. En iyi yol iki parçalı: her savaşta oyun içi bir açılış çekimi, her bölümde bir kez oynayan stilize bir prolog. Meshy yalnızca ücretli katmanla kullanılabilir; ücretsiz katmanın CC BY lisansı CC0 politikamızla çelişiyor. Kahramanlar ve sahne nesneleri için uygun, kalabalık birlikler için değil (§7).

---

## 2. Mimari harita

### Katmanlar

| Katman | Yer | Görev | React/three? |
|---|---|---|---|
| Kurallar | `src/mechanics` | birlik, kol, dalga, geçit kuralları, botlar | hayır (saf) |
| Dünya | `src/sim` | `world` (tek, değişebilir nesne), senaryolar, ilerleme, skor | hayır |
| Sahne | `src/components` (R3F) | çizim; şimdilik oyuncu ve düşman adımı da burada | evet |
| Arayüz | `src/components` (DOM), `hud.css` | HUD, menü, mola, sonuç, bilgi hazinesi | React |
| Durum | `src/store` | zustand: yalnızca HUD için anlık görüntü | React |
| Yan sistemler | `audio`, `telemetry`, `perf`, `lore`, `debrief`, `hooks` | ses, rızalı telemetri, kalite kademeleri, arşiv, savaş sonrası değerlendirme, girdi | — |

### Kare döngüsü (useFrame öncelikleri)

```
0   MetehanPlaceholder   oyuncu hareketi        ← simülasyon (çizim bileşeninde)
1   EnemySwarm           düşman yapay zekâsı    ← simülasyon (çizim bileşeninde)
2   GameDirector         kurallar ve olaylar → ses, duyuru, ağır çekim, kamera işareti
                         b.events (kural kaydı) burada silinir; world.events'e sunum olayları itilir
                         sonunda stepTime: donma, ağır çekim süresi, hız rampası
3   görseller            AlliedWings, ArrowVolley …
4   StrikeSparks         vuruş ve ok kamerasındaki saplanma olaylarını okur
5   CameraDirector       taktik kadraj + açılış ve alacakaranlık çekimi, çekimler arası geçiş
6   CameraShake          sarsıntı
7   kameraya bakanlar    CorpsBanners, DustTrails (kameranın bu karedeki yönü)
9   EventFlush           world.events boşalır
10  EffectComposer       çizim (bloom, noise)
```

- **Zaman:**
  - `simDelta(delta)` tek kapıdır: adımı 0,1 sn ile sınırlar, mola ve vuruş donmasında 0 verir, yoksa `world.timeScale` ile ölçekler.
  - `timeScale` ağır çekime rampayla girer (~0,19 sn) ve çıkar (~0,6 sn); `stepTime` gerçek zamanla yürütür.
  - `world.animTime` sim zamanıyla işleyen animasyon saati: dörtnal, düşman yürüyüşü, çimen, toz rüzgârı. Molada ve donmada durur.
  - HUD eşitlemesi ve duyurular gerçek zamanla.
- **Olaylar:**
  - Kurallar `b.events`'e çıplak dizeler iter (`'charge'`, `'sunset'`, `'wingShockLeft'` …): telemetri, karne ve botlar için kural kaydı.
  - `scenarios.ts` bunlardan ses, titreşim, duyuru, `world.slowmo` ve `world.cameraCue` üretir.
  - Sunum için ayrıca tipli ve konumlu `world.events` (`events.ts`): `strike` (düşenler kimlikleriyle), `arrowReleased`, `charge` (birlik, konum), `rout`, `sunset`, `waveSpawn`. Öncelik 9'da boşalır; kamera dahil her okuyucu karenin olaylarını görür. Kıvılcımlar buna abone.
- **Durum akışı:**
  - `world.mode` (menu · playing · paused · outcome) tek kaynak; geçişler `flow.ts`'teki tabloyla korumalı (`enterMode`). Kare döngüsü, girdi ve HUD ekranları moddan türer.
  - `world` 0,08 sn'de bir `syncHud` ile zustand'a, oradan DOM'a gider; mod her eşitlemede kopyalanır. Savaşın bittiği kare eşitlemeyi zorlar.
  - HUD düğmeleri store eylemlerini çağırır; eylem önce `world`'ü, sonra `set()` ile store'u değiştirir.
- **Kamera:**
  - Tek gerçek yazıcı CameraDirector; CameraShake onun üstüne yönlü sarsıntı ekler (`shake.ts`, rastgele yok).
  - Taktik kadraj `tacticalCamera.ts`'te saf: 38° eğim, bakış oyuncunun 3 birim önünde, yaya doğru 1,5 birim.
  - fov'u kimse yazmıyor.
  - `cameraShots.ts` saf ve testli eğriler içeriyor.
- **Oklar:**
  - Yalnızca görsel. 64 yuvalı halka havuz `arrowPool.ts`'te; ArrowVolley doldurur ve tek bir InstancedMesh ile çizer.
  - Uçuş, sim zamanıyla işleyen 0,75 sn'lik bir formül (`arrowPose`).
  - Her bırakış `arrowReleased{slot, t0}` olayı iter; bir kamera oku yuvasından izler, yuvanın el değiştirmediğini `t0` ile doğrular.

---

## 3. Kod sağlığı

| Ölçü | Değer | Yorum |
|---|---|---|
| Kaynak / test satırı | 10.966 / 2.412 | 20 test dosyası, 175 test geçiyor |
| Tip kaçağı | 0 `any`, 0 `@ts-ignore`, 0 `!.` | çok iyi |
| `strict` | TS 6 varsayılanıyla açık, `tsconfig`'de yazılı değil | açıkça yazılmalı (P12) |
| Determinizm | mantıkta `Math.random` yalnızca tohum için (`world.ts:122`) | iyi; ama tohum kaydedilmiyor (S6) |
| En büyük dosyalar | `corps.ts` 1026, `debrief.ts` 612, `battleBots.ts` 554, `HilalEnergyHUD.tsx` 426 (13 bileşen), `hud.css` 2158 | `corps.ts` ve HUD bölünmeye aday |
| Paket (sıkıştırmasız) | three 728 KB · render 244 · react 179 · index 122 · CSS 40 | — |
| Önbellek (precache) | ~1,9 MB, bunun 292 KB'ı ikon | GLB/video gelince yetmez (P2) |
| CI | lint + test + build + paket bütçesi; Playwright duman testi, düzen bekçisi, çekimler | görsel fark henüz bloklamıyor (§10.8) |
| Performans testi | kare başına 100 µs bütçe (`corps.test.ts:239`) | nadir ve değerli |

**Korunacak güçlü yanlar**

- **Kurallar ve test:** saf kurallar katmanı, bot denge testleri ve performans bütçe testi.
- **Zaman ve durum:**
  - `simDelta` tek zaman kapısı; mola davranışı testli (`pause.test.ts`).
  - `initialWorld` tek sıfırlama noktası.
  - Simülasyon durumu zustand'ın dışında.
- **Çizim:**
  - Kare döngülerinde vektör ve matris ayırma yok; geçici nesneler bir kez yaratılıp yeniden kullanılıyor.
  - Kalite kademeleri ölçümlü: MSAA oturum boyunca sabit, yeniden kurulumlar anahtarlı.
- **Gizlilik:** rıza varsayılan olarak kapalı ve gönderim anında yeniden kontrol ediliyor. Ortam değişkeni yoksa uzak gönderim hiç çalışmıyor.
- **Dayanıklılık:**
  - Her sesin bir sentez yedeği var.
  - Depolama erişimi try/catch içinde.
  - Dinleyiciler temizleniyor.
- **Mobil:** `--safe-*` boşlukları, `100dvh`, `viewport-fit=cover`.
- **Erişilebilirlik örneği:** `LoreArchive` örnek alınacak bileşen (dialog rolü, ok tuşuyla gezinme, aria-live).

---

## 4. Risk kaydı

Kimliğin harfi alanı gösterir: **S** simülasyon · **G** görüntü/kamera · **P** platform, yayın, veri · **A** arayüz akışı. Her maddenin sonunda önerilen zaman yazar (§8).

| Alan | Yüksek | Orta | Düşük |
|---|---|---|---|
| S Simülasyon | 3 | 3 | 3 |
| G Görüntü/kamera | 1 | 4 | 1 |
| P Platform | 2 | 4 | 5 |
| A Arayüz akışı | 2 | 4 | 3 |
| **Toplam** | **8** | **15** | **12** |

Tablo açık riskleri sayar. Kapananlar maddelerinde işaretli: G2, P6. Disiplinler arası değerlendirmenin bulguları (O, V, K, U, D, M, T) §10'da ayrı tutulur.

### Yüksek

**S1 · Simülasyon çizim bileşenlerinin içinde; tek Suspense sınırı**
- Kanıt: `EnemySwarm.tsx:67,72`, `MetehanPlaceholder.tsx:78`, `Scene.tsx:109`
- Etki:
  - Sahnede bir şey yüklenirken (ör. GLB model) React bütün sahneyi gizler ve `useFrame` aboneliklerini kaldırır. Oyuncu, düşman ve yönetmen mantığı durur.
  - Bu, drei `Environment` ile bir kez yaşandı (`Scene.tsx:102-108`).
  - Yer tutucu bileşen silinirse düşman yapay zekâsı da silinir.
- Öneri:
  - `stepGame(world, input, dt)` adında, Suspense'in dışında duran tek bir sürücü; bileşenler yalnızca okuyup çizer.
  - Her model kendi Suspense'ine sarılsın; yükleme sırasında bugünkü prosedürel mesh görünsün.
- Zaman: **`stepGame`: faz 26 (denge önkoşulu, S4); bölünmüş Suspense: faz 28 önkoşulu**
- Durum: ilk yarı yapıldı (§8 2f.1): `sim/step.ts`, yönetmen Suspense'in dışında. Kalan: model başına Suspense.

**S2 · Olaylar tipsiz, konumsuz, tek okuyuculu**
- Kanıt: `scenarios.ts:300`, `hilalSystem.ts:338`, `ArrowVolley.tsx:40-62`
- Etki:
  - Olay çıplak bir dize; nerede olduğu bilinmiyor.
  - Öncelik 2'de silindiği için kamera (5) olayları göremiyor.
  - Ok yağmuru yalnızca telemetride var; kurbanlar bırakış anında, kimlik bırakmadan ölüyor.
  - Ok havuzu bileşenin içine kapalı.
  - Ok kamerası bu bilgiler olmadan yapılamaz.
- Öneri: `world.events` adında tipli bir kuyruk:
  - Olaylar: `volleyFired{origin, facing, victimIds}`, `arrowReleased{slot, origin, target, t0}`, `charge{corps, pos}`, `rout`, `sunset`, `waveSpawn`.
  - Kare sonunda temizlenir; kamera, ses ve telemetri ona abone olur.
- Zaman: **faz 27 önkoşulu**
- **Durum (3 Ekim 2026): kapandı** (`55ffee4`). Vuruş olayı adını korudu: `volleyFired` yerine `strike{origin, facing, victims}`.

**S3 · Zaman: ağır çekim aç/kapa, dörtnal duvar saatiyle, HUD sim saatiyle**
- Kanıt: `world.ts:225`, `EnemySwarm.tsx:91`, `AlliedWings.tsx:154`, `MetehanPlaceholder.tsx:102`, `GameDirector.tsx:235`
- Etki:
  - Ağır çekimde gövdeler 0,3× hızla giderken dörtnal 1× sürüyor; atlar yerinde kayıyor. İskeletli modellerde bu çok belirgin olur.
  - Ağır çekim yumuşakça girip çıkamıyor.
  - HUD ağır çekimde ~3,75 Hz'e düşüyor; zaman durunca hiç güncellenmiyor.
- Öneri:
  - Yönetmenin sahip olduğu, kademeli değiştirilebilen bir `world.timeScale` (ağır çekim, sinematik, donma katmanları).
  - Sim zamanıyla ilerleyen bir `world.animTime` (dörtnal fazı ve animasyon karıştırıcıları için).
  - HUD senkronu `realDelta` ile.
- Zaman: **faz 27 önkoşulu**. AlliedWings kısmı bugünkü düzeltmede.
- **Durum (3 Ekim 2026): kapandı** (`2aa52d4`). Sinematik katmanı G1 ile gelir.

**G1 · Kamera çekim sistemi bir sinematik yönetmen taşıyamıyor**
- Kanıt: `FollowCamera.tsx:91-92,121`, `world.ts:18`, `CameraShake.tsx:25-27`, `CorpsBanners.tsx:96`
- Etki:
  - Çekim işareti veri taşımayan bir enum. Çekim ortasında yeni bir işaret gelirse eğri baştan başlar ve görüntü sert keser.
  - Hareketli hedef, fov ve odak için bir yol yok.
  - Sarsıntı ve her zaman üstte çizilen sancaklar çekimlerden habersiz.
- Öneri:
  - FollowCamera yalnızca taktik pozu üretsin.
  - Üstünde, öncelik 5'te bir `CameraDirector` olsun:
    - Son çizilen pozdan geçiş yapar.
    - Hedef fonksiyonlu bir çekim yığını tutar.
    - fov, yakın soluklaşma, sarsıntı ve `world.cinematic` ağırlığı onundur.
- Zaman: **faz 27'nin çekirdeği**
- **Durum (4 Ekim 2026): ilk yarı kapandı.** FollowCamera → `CameraDirector`; kesilen çekim son çizilen duruştan 1 sn süzülür (`cameraShots.ts` `applyBlend`). K1–K3 kapandı. Hareketli hedefli ilk çekim ok kamerası (`arrowShot.ts`); fov hâlâ sabit 55, ihtiyaç doğana dek.

**G2 · Kolların tacizi oyuncunun oku olarak çiziliyor**
- Kanıt: `corps.ts:715`, `ArrowVolley.tsx:59,69-70`
- Etki:
  - Oyuncunun ve kolların tacizi tek bir sayıda birleşiyor: `c.harass = byPlayer + wingHarass`. ArrowVolley her oku Metehan'ın konumundan çıkarıyor.
  - Yalnızca bir kolun taciz ettiği ya da hücum ettiği birliğe oklar Metehan'dan uçuyor, onun menzilinin dışından bile.
  - Kolun yaptığı iş oyuncuya yazılıyor.
- Öneri: oyuncunun ve kolların tacizini ayrı tut; her ok akışını gerçek atıcıdan çıkar.
- Zaman: **bugün (§6)**
- Durum: **kapandı**, PR #16 (`e5d7ead`).

**P1 · Çökme ağı yok**
- Kanıt: `App.tsx:3-4`
- Etki:
  - Hata sınırı (ErrorBoundary) ve WebGL bağlam kaybı işleyicisi yok.
  - Şu durumlarda uygulama boş ekrana düşer: telefonda GPU belleği dolunca, sekme uzun süre arka planda kalınca, bir model yüklenemeyince. Oyuncu ne olduğunu anlamaz.
- Öneri: kökte bir ErrorBoundary, `webglcontextlost`/`restored` dinleyicisi ve "Yeniden yükle" ekranı. İlerleme zaten localStorage'da olduğu için kayıp olmaz.
- Zaman: **sağlamlık paketi**
- **Durum (2 Ekim 2026): kapandı.** Ayrıntı §8 Adım 1.4'te.

**P2 · PWA büyük varlıklara hazır değil**
- Kanıt: `vite.config.ts:15`
- Etki:
  - `.glb` önbellek desenlerinde yok. Eklense bile Workbox 2 MiB'ı aşan dosyaları önbelleğe almaz ve bunu yalnızca derleme çıktısında bir uyarıyla bildirir.
  - Önbellek "ya hep ya hiç".
  - Draco ile sıkıştırılmış bir model yüklenirse drei çözücüyü varsayılan olarak gstatic.com'dan indirir. Çevrimdışı oyun bozulur, kullanıcının cihazı Google'a istek atar.
- Öneri:
  - GLB ve video için ayrı adlı bir çalışma anı önbelleği (CacheFirst).
  - `maximumFileSizeToCacheInBytes` ayarı.
  - Çözücüleri kendimiz barındıralım ya da meshopt kullanalım.
  - CI'da boyut bütçesi.
- Zaman: **faz 28 önkoşulu**

**A1 · Enter/Space odaktaki düğmeyi ele geçiriyor**
- Kanıt: `useStrikeInput.ts:48-62` (`preventDefault()` koşulsuz çağrılıyor)
- Etki:
  - Klavyeyle BİLGİ HAZİNESİ'ne Enter'a basınca savaş başlıyor.
  - Mola ve sonuç ekranında odak YENİDEN BAŞLA, KOMUTANLAR ya da rıza EVET/HAYIR'da olsa bile Enter "devam" veya "yeniden"i çalıştırıyor.
  - İleride eklenecek "Atla" düğmesi de yutulur.
- Öneri: aktif oyun dışında, odak bir düğme, bağlantı ya da girdi alanındaysa kısayolu hiç işleme.
- Zaman: **sağlamlık paketi**
- **Durum (2 Ekim 2026): kapandı.** Ayrıntı §8 Adım 1.3'te.

**A2 · Oyun akışı örtük**
- Kanıt: `world.ts:211-213`, `Scene.tsx:58,82`
- Etki:
  - `started`, `paused` ve `outcome` hem `world`'de hem store'da tutuluyor; 13 dosyada 20'den fazla yerde ayrı ayrı kontrol ediliyor.
  - Bunların hiçbir birleşimi "sinematik" durumu ifade edemiyor: çizim açık, sim ölçekli, girdi kilitli, HUD gizli, ama molaya alınabilir.
  - Bitiş çekimi `outcome` değiştiği anda donar.
- Öneri:
  - Store'un sahip olduğu bir `mode`: menu · intro · playing · paused · cinematic · outcome.
  - Durumlar arası geçişler korumalı olsun.
  - frameloop, girdi ve HUD görünürlüğü bu moddan türetilsin.
- Zaman: **faz 27 önkoşulu**
- **Durum (3 Ekim 2026): kapandı** (`c0ba464`): menu · playing · paused · outcome. `intro` ve `cinematic` kendi çekimleriyle eklenecek.

### Orta

**S4 · Botlar oyundan farklı bir döngüde oynuyor**
- Kanıt: `battleBots.ts:181,192` ↔ `GameDirector.tsx:154`
- Etki: vuruştan sonraki 0,9 sn'lik enerji donması botlarda yok; denge, gerçeğinden daha kolay bir oyunda ayarlanıyor.
- Öneri: S1'deki `stepGame`'i botlar da kullansın.
- Zaman: **faz 26, denge ayarından önce** (§10 O1–O3 bu açıkla ölçüldü)
- Durum: yapıldı (§8 2f.1). Botlar `stepGame`'i çağırır; donma botlarda da var.

**S5 · Yapıştırıcı kod testsiz**
- Testsiz parçalar:
  - `scenarios.ts` dalga geçişi
  - olaydan ağır çekime, kameraya ve ipucuna giden yol
  - `victoryBonus`
  - `simDelta`'nın tavanı ve ölçeği
  - duyuru kuyruğu
  - kol emri reddi
  - ilerleme verisi göçü
- Öneri: her faz, dokunduğu yapıştırıcı koda test eklesin.
- Zaman: sürekli

**S6 · Savaşlar yeniden üretilemiyor**
- Etki: tohum kaydedilmiyor, adım (`dt`) değişken. Tekrar oynatma, hata ayıklama ve "o anı yeniden göster" fikirleri buna bağlı.
- Öneri: tohumu savaş özetine yaz; ileride sabit adımlı simülasyon.
- Zaman: tohum parametresi sağlamlık paketinde; sabit adım sürekli
- **Durum (2 Ekim 2026): ilk yarı kapandı** (tohum parametresi ve özette tohum, §8 Adım 1.7). Sabit adım açık.
  - Yalnız çekimler için sabit adım var: `?shot=` kipi (`shot.ts`, `ShotDirector.tsx`) kare döngüsünü elle sürer, 1/60 adımla ilerler, görsel `Math.random`'ı tohumlu akışa bağlar. Oyunun kendi döngüsü hâlâ değişken `dt`.

**G3 · Efekt zinciri prop'larla sürülürse bellek sızdırır**
- Kanıt: `Scene.tsx:158`, `quality.ts:79-80`
- Etki:
  - @react-three/postprocessing, kamera değişince bütün efekt zincirini, odak prop'u değişince DepthOfField'ı yeniden kuruyor ve eskisini temizlemiyor.
  - Çekim başladığı anda bellek sızar ve gölgelendirici derlemesi takılma yaratır.
- Öneri:
  - Tek kamera kullan.
  - Efektler kademe başına bir kez kurulsun ve ref ile canlandırılsın.
  - Çekim sırasında kalite kademesi değişmesin.
  - Letterbox DOM'da çizilsin.
- Zaman: faz 27

**G4 · Örnek sayısı yönetimi `setMorphAt`'i bozar**
- Kanıt: `EnemySwarm.tsx:88-90,113-116`
- Etki:
  - three, morf dokusunu ilk çağrıdaki `count`'a göre boyutlar. Oyun 16 atlıyla başladığı için sonraki 38-41 atlılık dalgalar dokunun dışına taşar.
  - Ölü atlılar ölçek 0 ile hâlâ çiziliyor.
- Öneri: kapasite kadar yer ayır, canlıları başa topla, `count`'u düşür.
- Zaman: faz 28

**G5 · Düşük kademe hâlâ gölge ve efekt zinciri maliyeti ödüyor**
- Kanıt: `Scene.tsx:80,158`, `quality.ts:32`, `DayCycle.tsx:156`
- Etki:
  - Her birim gölge için iki kez çiziliyor; yarım-float efekt zinciri açık.
  - `shadows` bayrağı, three r185'te kullanımdan kaldırılan PCFSoftShadowMap'i seçiyor. Konsoldaki uyarıyla doğrulandı.
- Öneri:
  - Düşük kademede damga (blob) gölge kullan ve efekt zincirini atla.
  - Gölge tipini açıkça seç.
- Zaman: faz 28

**G6 · Sancak ve toz kameradan bir kare geride dönüyor**
- Kanıt: `CorpsBanners.tsx:55`, `DustTrails.tsx:203`
- Etki: öncelik 3'te kameranın (öncelik 5) bir önceki karedeki yönünü kopyalıyorlar. Kamera açısı bugün sabit olduğu için fark edilmiyor; dönen bir çekimde titrer.
- Öneri: öncelik 7'ye taşı ya da köşe gölgelendiricisinde hesapla.
- Zaman: faz 27
- **Durum (3 Ekim 2026): kapandı** (`28a53d8`), öncelik 7.

**P3 · Üretime yayın elle yapılıyor**
- Etki:
  - Production Branch Tracking kapalı.
  - Promote unutulabilir ve CI kapısından geçmiyor.
- Not: ilk iddia "promote edilen önizleme telemetrisiz yayınlanır" idi. Yanlış çıktı: promote, üretim değişkenleriyle yeniden derliyor; canlı pakette doğrulandı.
- Öneri: Vercel panelinde Production Branch Tracking'i aç.
- Zaman: **senin işin**

**P4 · Servis çalışanı güncellemesi**
- Kanıt: `vite.config.ts:9` (`autoUpdate` + `skipWaiting` + `clientsClaim`)
- Etki:
  - Kurulu PWA uykudan dönünce güncelleme olup olmadığına bakmıyor.
  - Tembel yüklenen, adı hash'li GLB'ler servis çalışanı değiştikten sonra 404 verebilir.
- Öneri: `virtual:pwa-register` kullan; sayfa görünür olunca `update()` çağır; güncellemeyi menüdeyken uygula.
- Zaman: faz 28

**P5 · Ses, iOS kesintisinden sonra geri gelmiyor**
- Kanıt: `sfx.ts:76-80,99`, `gameStore.ts:168,238-241`
- Etki:
  - Moladan sonra `ctx.resume()` bir kullanıcı dokunuşunun dışında çağrılıyor.
  - iOS bunu reddederse savaş sessiz kalır, çünkü DEVAM ve YENİDEN düğmeleri `unlockAudio()` çağırmıyor.
  - `new AudioContext()` try/catch'siz; BAŞLA düğmesi hata verebilir.
- Öneri:
  - resume, restart ve playCommander'da `unlockAudio()` çağır.
  - `new AudioContext()` çağrısını try/catch içine al.
- Zaman: sağlamlık paketi
- **Durum (2 Ekim 2026): kapandı** (P8 ve D6 ile birlikte). Ayrıntı §8 Adım 1.5'te. Gerçek iOS cihazda gözlenmedi.

**P6 · Telemetri boşlukları; gizlilik metni kodla uyuşmuyor**
- Kanıt: `GameDirector.tsx:94`, `track.ts:58-61,71`, `public/gizlilik.html`
- Etki:
  - Rıza savaş bittikten sonra soruluyor, bu yüzden ilk savaş hiç gelmiyor.
  - Yarıda bırakılan savaşlar yalnızca yerelde kalıyor.
  - Gizlilik metni iki yerde kodla uyuşmuyor:
    - "Rıza verdiğin savaşın özeti gönderilir" diyor; o savaş gönderilmiyor.
    - "Oturum kodu cihazında saklanmaz" diyor; kod, son 40 savaş özetiyle birlikte yerel günlükte saklanıyor.
- Öneri: önce metni kodla eşitle, çünkü metnin doğru olması KVKK açısından da önemli. Kod değişikliği gerekirse sonra.
- Zaman: **sağlamlık paketi, öncelikli**
- Durum: **kapandı** (1 Ekim 2026).
  - Sonuç ekranında verilen EVET, ekrandaki savaşı da gönderiyor. İlk savaşta EVET denirse attempt=1 artık geliyor.
  - Daha önce cevapsız biten savaşlar bilerek gönderilmiyor, çünkü metin "o savaşın" diyor.
  - Geçen açılışta yarıda kalan savaş, rıza zaten varsa açılışta gidiyor.
  - Gizlilik metninde oturum kodu ve yarıda bırakma cümleleri kodla eşitlendi.
  - Testler: `remote.test.ts`.

**P7 · CI uygulamayı hiç çalıştırmıyor**
- Kanıt: `.github/workflows/ci.yml`
- Etki:
  - Duman testi yok: uygulamayı açıp BAŞLA'ya basan, 5 sn oynayıp konsolda hata olmadığına bakan bir test.
  - Paket boyutu için bir bütçe yok.
  - Ana dalda `cancel-in-progress` açık.
  - `permissions:` bloğu yok.
- Öneri: Playwright ile duman testi ve paket bütçesi. Playwright yeni bir bağımlılık; senin onayınla.
- Zaman: sağlamlık paketi
- **Durum (2 Ekim 2026): kapandı** (§8 Adım 1.8). CI'da `e2e` işi, `npm run budget`, `permissions: contents: read`; `cancel-in-progress` yalnız PR'da.

**A3 · Menüde bayat bir kare kalıyor**
- Kanıt: `Scene.tsx:45`; kodda tek bir `invalidate()` var.
- Etki:
  - KOMUTANLAR'a dönünce arkada bitmiş savaşın son karesi donuk kalıyor.
  - SAVAŞA GİR'e basınca görüntü sert kesiyor; bu, `FollowCamera.tsx:101-103`'teki "kesme yok" niyetine aykırı.
- Doğrulama: kodda doğrulandı, ekranda değil.
- Öneri: her akış geçişinde `invalidate()` çağır; A2 bunu kendiliğinden çözer.
- Zaman: sağlamlık paketi
- **Durum (2 Ekim 2026): kapandı.** Ayrıntı §8 Adım 1.6'da.

**A4 · Kamera ve görseller için sıfırlama sinyali yok**
- Kanıt: `FollowCamera.tsx:65,100-105`
- Etki: çekimler yalnızca savaş başlamadan önce temizleniyor. Alacakaranlık çekimi sürerken YENİDEN'e basılırsa çekim yeni savaşta devam eder.
- Öneri: `resetWorld`'de artan bir `world.generation` sayacı; değeri değişince kamera ve sinematikler sıfırlansın.
- Zaman: faz 27
- **Durum (3 Ekim 2026): kapandı** (`4e1d4d0`). Kamera, oklar, kıvılcımlar ve toz `newBattleWatch` ile sıfırlanır.

**A5 · "Hareketi azalt" tercihi yarım uygulanıyor**
- Kanıt: `hud.css:458,2154-2157`, `CameraShake.tsx:25`
- Etki:
  - 18 CSS animasyonunun 7'si bu tercihin kapsamı dışında.
  - TypeScript tarafı tercihi hiç okumuyor.
  - Afişler molada ve ağır çekimde oynamaya devam ediyor.
- Öneri: store'da bir `reducedMotion` bayrağı; sarsıntı, sinematik ve CSS onu okusun.
- **Durum (3 Ekim 2026): kapandı** (`3410ba1`, `cc2d825`), faz 27'ye çekildi. Bayrak işletim sisteminden okunur. Sarsıntı, titreşim, açılış ve gün batımı çekimi ve `hud.css` animasyonları ona uyar; afiş ve duyuru molada donar. Ağır çekimde gerçek zamanla sürmeleri bilinçli: duyurular gerçek zamanlıdır. Oyun içi ayar (D3) 2b'de.
- Zaman: faz 26 (§8 Adım 2b, ses ve titreşimle birlikte); sinematik kuralı olarak

**A6 · Hata ayıklama anahtarları üretimde açık**
- Kanıt: `Scene.tsx:35`, `scenario.ts:83`, `progress.ts:88`, `remote.ts:81`
- Etki:
  - `?tune` dengeyi değiştiriyor.
  - `?commander=` kilidi atlıyor. O yolla alınan herhangi bir skor komutanı kalıcı olarak açıyor.
  - Gönderilen özetlerde "ayarlı oyun" bayrağı yok.
- Öneri: bu anahtarları DEV ya da oyun-testi derleme bayrağıyla sınırla; ayarlı oyunlarda kayıt ve gönderim yapılmasın.
- Zaman: sağlamlık paketi
- **Durum (2 Ekim 2026): kapandı.** Ayrıntı §8 Adım 1.2'de. Oyun testi paketinde yerel kayıt sürüyor; yalnız test edenin kendi cihazını etkiler.

### Düşük

**Simülasyon**
- **S7 · İlerleme verisi doğrulanmıyor** (`progress.ts:33`). Bozuk bir localStorage değeri (ör. NaN can) kaybedilemeyen bir oyun yaratır.
- **S8 · Gereksiz ayırma ve yeniden çizim**
  - Simülasyonda her karede yeni dizi ayrılıyor (`enemySim.ts:207`, `corps.ts:944`).
  - `wingOrders` her senkronda yeni bir dizi; kol düğmeleri saniyede 12,5 kez yeniden çiziliyor (`GameDirector.tsx:261`, `HilalEnergyHUD.tsx:288`).
  - Öneri: `useShallow` ya da ilkel değerler.
- **S9 · Vuruş basışları kayboluyor** (`GameDirector.tsx:154,221`). Vuruştan sonraki 0,9 sn içindeki basışlar sessizce düşüyor; basışları kısa süre tutan bir tampon daha iyi hissettirir.

**Görüntü**
- **G7 · GPU kaynakları tutarsız temizleniyor** (`ArrowVolley.tsx:37-39`, `ChargeWarnings.tsx:35-46`, `world/Grass.tsx:36-37`). `useMemo` ile yaratılan kaynaklar, komutan ya da kalite kademesi değişince sızıyor. Öneri: ortak bir `useDisposable` kancası.

**Platform**
- **P8 · Sessizde ses bağlamı çalışmaya devam ediyor** (`ambience.ts:102-113`). Sessize alınca bağlam askıya alınmıyor; ambiyans osilatörleri ve zamanlayıcı sürekli çalışıp pil harcıyor. **Kapandı** (2 Ekim 2026, §8 Adım 1.5).
- **P9 · Koruma eksikleri.** Güvenlik başlıkları ve CSP yok (`vercel.json` yok). Anonim kayıt eklemenin hız sınırı yok; tablo istenmeyen kayıtlarla doldurulabilir.
- **P10 · Sürüm aralıkları geniş.** react `^19.2.7` ama fiber `<19.3` istiyor; postprocessing three `<0.186` istiyor. Öneri: react için `~19.2`, three'yi sabitle.
- **P11 · Supabase listeleri istemciyle eşleştirilmiyor.** Supabase'deki komutan ve sonuç listeleriyle istemci kimlikleri arasında bir test yok. Öneri: SQL'i `?raw` ile okuyan bir test (CREDITS testi gibi).
- **P12 · `strict` örtük.** TS 6 varsayılanına dayanıyor; `tsconfig.json`'a açıkça yaz.

**Arayüz**
- **A7 · Diyalog semantiği yok.** Mola ve sonuç katmanlarında `role="dialog"`, `aria-modal` ve arka plan için `inert` yok. ZAFER/YENİLGİ ekran okuyucuya duyurulmuyor.
- ~~**A8 · Dokunma hedefleri 44 px'in altında.**~~ **Yapıldı (Faz 26 2a):** dördü de 44 px. Rıza paneli oyun testi derlemesinde çizilmediği için bekçi onu görmez; ölçüsü yalnız CSS'te.
  - Rıza anahtarı ~16-18 px
  - EVET/HAYIR ~24 px
  - Mola ve ses düğmeleri 40 px
  - Arşivi kapat düğmesi 36 px
- **A9 · Tek dosyada her ekran.** `HilalEnergyHUD.tsx` (13 bileşen) ve `hud.css` (2158 satır, z-index ölçeği yok) bütün ekranları taşıyor. Öneri: ekran başına böl.

---

## 5. Sistem ve mantık analizi

### Bağımlılık haritası: sıradaki işler nelere basıyor

```
Ok kamerası
  ├─ G1 kamera yönetmeni
  ├─ S2 olay kuyruğu (okun bırakılma olayı)
  └─ S3 zaman ölçeği (yumuşak ağır çekim) ─► A2 akış modu ("sinematik")

Savaş açılış çekimi
  └─ G1 + A2 + A5 (atlama, hareketi azalt)

GLB modeller
  ├─ S1 stepGame + bölünmüş Suspense ─► P1 hata sınırı ─► P2 varlık önbelleği ─► P4 güncelleme
  └─ S3 animTime (ayak kayması) ─► G4 morf kapasitesi ─► G5 gölge bütçesi

Flow videosu
  └─ P2 (önbelleğe alınmadan akış) + A2 ("intro" modu) + A1 ("Atla" düğmesi)
```

Bu yüzden önkoşullar ayrı bir fazda değil, onları ilk kullanacak fazın başında.

### Oyun mantığı gözlemleri

- **Kol kuralları tutarlı ama oyuncuya görünmüyor.**
  - Açık alanda gündüz, ilerleyen bir birliğe yapılan hücum yalnızca taciz eder, yani düzenini düşürür. Sabitleme, şok ya da olay yok.
  - Şok yalnızca şu durumlarda var (`shockable`, `corps.ts:705-708`):
    - açık alanda, gün battıktan sonra ilerlemeyen (dönen, çekilen) bir birliğe;
    - geçitte, sıkışmış bir sütuna.
  - Bu iyi bir taktik derinlik, ama oyuncuya hiçbir şey söylenmiyor. Görsel de durağan olunca "hücum çalışmıyor" algısı doğuyor. Bildirdiğin hatanın yarısı bu.
- **Taciz tek bir sayıda birleşiyor** (G2). "Kim ne yaptı" bilgisi sahnede kayboluyor.
- **Denge biraz iyimser olabilir** (S4). Botlar vuruş sonrası donmayı yaşamıyor.
- **Zaman katmanları doğru yerde ama kaba** (S3). Mola, vuruş donması ve ağır çekimin tek fonksiyonda toplanması iyi; ama katsayı sabit ve animasyon saatleri bu kapının dışında.
- **Akış durumu iki yerde** (A2). `world` ve store'da ayrı kopyalar var. Bugün tutarsızlık riski düşük, ama her yeni mod (sinematik) iki yere yazılmak zorunda.

---

## 6. Kol hücumu hatası: kök neden ve düzeltme

**Durum:** düzeltme PR #16 ile birleşti (`e5d7ead`).

**Belirti (senin sözlerinle):** "Ek birlikler hücum deyince sadece yanına gelip bekliyor düşmanın; animasyonda bir hareket yok."

Alp Arslan'da ve diğer bölümlerde aynı görünüyor, çünkü hepsi aynı bileşeni (`AlliedWings.tsx`) kullanıyor.

**Simülasyon doğru çalışıyor:**
1. Hücum emri kolu hedef birliğin yanına götürüyor.
2. Kol varınca taciz uyguluyor; koşul sağlanırsa birliği sabitliyor.
3. İlk temasta, koşul sağlanırsa birliği sarsıyor (şok).
4. Kol yoruldukça gücü düşüyor; en alta inince kendiliğinden pusuya dönüyor.

**Kök neden dört katmanlı:**

1. **Görsel durağan.**
   - Hücum yuvaları hedefe bakan bir hilal. Kol varınca yuvalar sabitleniyor ve atlıların hızı 0'a iniyor.
   - Dörtnal salınımı hıza bağlı olduğu için o da duruyor.
   - Temas boyunca ne hareket var, ne ses, ne efekt.
2. **Oklar yanlış yerden çıkıyor** (G2). Kolun tacizi, Metehan'dan çıkan oklar olarak çiziliyor.
3. **Kural görünmüyor.** Gündüz ilerleyen birliğe hücum yalnızca taciz eder, ama bunu söyleyen bir ipucu yok.
4. **Ağır çekimde kayma var** (S3). İlk hücum emri ağır çekimi açıyor, ama dörtnal duvar saatiyle sürüyor; atlar yerinde koşuyormuş gibi görünüyor.

**Düzeltme planı (simülasyona dokunulmuyor):**

| # | Ne | Nerede | Bugün |
|---|---|---|---|
| 1 | Temas dalgası: atlılar sırayla hedefe dalıp geri çekilir. Hareketin büyüklüğü kolun gücüne ve hedefe ne kadar vardığına bağlı (`presence × strength`): taze kol derin dalar, yorgun kol sığ. | `AlliedWings.tsx` | ✔ |
| 2 | Geri çekilirken atlılar hedefe bakmaya devam eder; 180° dönüp kaçmazlar. | `AlliedWings.tsx` | ✔ |
| 3 | Dörtnal temas boyunca sürer; fazı sim zamanıyla işler, ağır çekime uyar. | `AlliedWings.tsx` | ✔ |
| 4 | Oklar gerçek atıcıdan çıkar: kolun tacizi kolun konumundan. | `ArrowVolley.tsx` | ✔ |
| 5 | Temas sesi: seyrek, kısık çelik şakırtısı. | `sfx.ts` | isteğe bağlı |
| 6 | Gündüz ilerleyen birliğe hücumda tek seferlik bir ipucu. | `scenarios.ts` | isteğe bağlı |

**Ortaya çıkan görsel dil:** dalıp çekilen, ok atarak baskı kuran atlılar. Bu, Türk atlı okçusunun bilinen vur-kaç savaşına uyuyor.

---

## 7. Sinematik yön: profesyonel değerlendirme

### 7.1 Google Flow ile savaş öncesi video

**Bilinenler** (Ekim 2026 araştırması; fiyatlar ve kurallar değişebilir):
- **Klip uzunluğu:** Veo 3.1 Lite/Fast/Quality sırasıyla 4, 6 ve 8 sn; Gemini Omni Flash ile 10 sn'ye kadar. Ses her zaman üretiliyor.
- **Çözünürlük:** doğal 720p. Abonelere 1080p'ye büyütme var; 4K yalnızca Ultra'da.
- **Planlar:**
  - Ücretsiz: günde 50 kredi
  - Pro: ayda ~19,99 $ (1000 kredi)
  - Ultra: 100-200 $
- **Ticari kullanım:** Google yalnızca "sahiplik iddia etmeyiz" diyor; açık bir lisans yok.
- **İçerik politikası:** şiddeti kısıtlıyor, sanatsal istisnalar var. Savaş sahnesi istekleri reddedilebilir.
- **İşaretleme:**
  - Her karede silinemez bir SynthID filigranı ve C2PA üstverisi var.
  - Görünür filigran için bir ayar var; ücretsiz katmandaki varsayılanı doğrulanamadı.
- **Çıktı:** MP4, büyük olasılıkla H.264/AAC ve 24 kare/sn.

**Oyun taşır mı? Evet, şu koşullarla:**
- **Boyut:**
  - 10 sn'lik 720p bir klip, ffmpeg ile yeniden sıkıştırılınca tahminen ~2-4 MB tutar. Bugünkü önbelleğin tamamı 1,9 MB.
  - Bu yüzden video önbelleğe alınmamalı: ağdan akmalı, ilk izlemede çalışma anı önbelleğine girmeli.
- **Mobilde oynatma:** `muted playsinline` ile otomatik oynar. Sesli oynatmak için `play()`, BAŞLA dokunuşunun içinde çağrılmalı; bu bir iOS kuralı.
- **Oynatma kuralları:**
  - Her bölümde yalnızca ilk girişte oynar.
  - Dokununca atlanır.
  - Ağ yoksa sessizce geçilir.
  - İlk kare poster olarak hemen görünür.
- **Yükleme süresini gizler:** video oynarken sahne arkada hazırlanır.

**Profesyonel riskler:**
1. **Kalite uçurumu.** Fotogerçek bir videodan alçak poligonlu sahneye geçiş, oyunu kıyasla ucuz gösterebilir. Çare iki adımlı:
   - Videoyu stilize üret: minyatür, mürekkep, gün batımında silüet.
   - Son kareyi oyun kamerasının ilk karesiyle eşle ve yumuşak geçiş yap.
2. **Tarihsel tutarsızlık.** YZ videoları zırh, sancak ve koşum ayrıntılarını karıştırır (Selçuklu yerine Osmanlı yeniçerisi gibi). Dikkatli istem yazmak ve sonuçları elemek gerekir.
3. **Tutarlılık.** Aynı kahraman farklı kliplerde aynı görünmez.
4. **Lisans belirsizliği.** CC0 politikamızın yanında zayıf bir zemin. Steam gibi mağazalar YZ kullanımının beyan edilmesini istiyor.
5. **Şiddet politikası.** Savaş anı yerine savaştan önceki anı çek: şafakta sırtta bekleyen ordu, rüzgârda sancak, atların nefesi. Hem politikaya uygun, hem daha sinematik.

**Seçenekler:**

| Seçenek | Ek boyut | Tutarlılık | Ne zaman |
|---|---|---|---|
| **A. Oyun içi açılış çekimi** | 0 | tam: gerçek saha, gerçek birlikler | her savaşta (faz 27) |
| **B. Flow prolog videosu** | ~2-4 MB / bölüm | orta: stil uçurumu var | bölüm başına bir kez |
| **C. Minyatür üslubunda prolog** | birkaç yüz KB (katmanlı WebP) | yüksek: bilinçli bir üslup | bölüm başına bir kez |

**Önerim:**
- **Her savaşın başında A.**
  - 4-6 sn'lik bir uçuş sahayı tanıtır.
  - Ekranın üstü ve altı sinema şeridiyle kapanır (letterbox); bir tarih kartı çıkar: "Malazgirt · 26 Ağustos 1071".
  - Dokununca atlanır.
- **Bölüm prologu için C.**
  - Kültürel kimliği en güçlü, en hafif ve stil uçurumu olmayan yol.
  - Anadolu Selçuklu dönemi resimli el yazmaları üslup referansı olabilir; örneğin 13. yüzyıldan *Varka ve Gülşah*.
- **Flow'u seviyorsan, B'yi tek bir bölümle dene.** Telefonda 720p kalitesine, dosya boyutuna ve lisans konusunda içinin rahat olup olmadığına bakıp karar veririz.
- **İş bölümü:** videoyu sen üretirsin; oynatıcıyı, önbellek stratejisini ve atlama katmanını ben kurarım.

### 7.2 Meshy AI ile 3D modeller

**Bilinenler:**
- **Dışa aktarma:** GLB/FBX/USDZ, 2K-8K PBR dokular.
- **Üçgen sayısı:**
  - Yeniden ağlama 100-300k aralığında, varsayılan 30k.
  - Smart Topology 100-15k aralığında.
  - Mobil için önerilen sınır 10k'nın altı.
- **İskelet:**
  - İnsansı iskelet var.
  - Dört ayaklı için yalnızca "köpek" iskeleti ve yürüme döngüsü var, dörtnal yok.
  - API yalnızca insansı iskelet kuruyor.
- **Lisans:**
  - Ücretsiz katman CC BY 4.0: modeller herkese açık ve atıf zorunlu. **CC0 politikamızla çelişiyor.**
  - Ücretli katmanda varlıklar özel ve tamamen senin.
- **Fiyat:**
  - Pro 20 $ = 1000 kredi; dokulu model başına ~0,60 $.
  - API, Pro ve üstünde.

**Oyun taşır mı?**
- **Kahramanlar** (Metehan, Alp Arslan, Kılıçarslan): evet.
  - Sahnede birer tane olduklarından 10-15k üçgen ve 1K doku sorun değil.
  - İnsansı iskelete hazır animasyonlar uygulanabilir.
- **Sahne nesneleri** (otağ, sancak, kaya, kuşatma aracı): evet, en verimli kullanım. Durağanlar ve sayıları az.
- **Kalabalık birlikler** (40'tan fazla atlı): Meshy'den doğrudan olmaz.
  - 10k üçgen × 100 örnek = 1M üçgen; telefon için fazla.
  - Birim başına en çok ~1,5k üçgen ve ortak bir doku atlası gerekir.
  - Animasyon için iki yol var: bugünkü gibi prosedürel gövde salınımı ya da dokuya pişirilmiş dörtnal. three'de iskeletli örnekleme hazır gelmiyor ve pahalı.
- **Doku belleği:**
  - 2K bir doku sıkıştırmasız ~22 MB GPU belleği tutar (mipmap'lerle). Bir PBR seti (renk, normal, ORM) ~67 MB eder.
  - Bu yüzden KTX2/Basis sıkıştırma zorunlu.
  - Doku boyutu: kahramanlarda 1K, kalabalıkta 512 ya da atlas.
- **At animasyonu:** Meshy dörtnal yapmıyor. Üç seçenek var:
  - prosedürel animasyon (bugünkü yol, ucuz);
  - dörtnal animasyonlu bir CC0 at modeli (lisansını ve animasyonunu indirmeden önce doğrulamak gerek);
  - Blender'da elle animasyon.
- **Üslup tutarlılığı:** her model başka bir elden çıkmış gibi görünebilir. Bir üslup rehberi (palet, poligon dili, ışık) ve aynı referans görseller gerekir; yoksa ortaya bir varlık salatası çıkar.

**Üretim hattı:**
1. Meshy (ücretli katman)
2. Blender: poligon azaltma, pivot ve ölçek, malzemeleri birleştirme
3. `gltf-transform`: meshopt + KTX2, gereksiz verinin atılması
4. `public/models/*.glb`
5. Çalışma anı önbelleği (P2)
6. Her model ayrı bir Suspense içinde, yüklenirken prosedürel yedek görünür (S1)

**Bütçe önerisi:**

| Varlık | Üçgen | Dosya |
|---|---|---|
| Kahraman | en çok 15k | en çok 1,5 MB |
| Sahne nesnesi | en çok 3k | — |
| Kalabalık birimi | en çok 1,5k | — |
| Tüm modeller | — | en çok ~6 MB |

CREDITS.md'ye her model için üretim aracı, tarih, katman ve sahiplik yazılmalı.

**Önerim:** Faz 28'de, önkoşullar bittikten sonra tek bir pilotla başla: **atlı Alp Arslan**.
1. Telefonunda FPS'i, dosya boyutunu ve görünümü ölçeriz.
2. Beğenirsen sahne nesnelerine geçeriz.
3. Kalabalık birlikler en sona kalır.

### 7.3 Daha yaratıcı fikirler

| Fikir | Ne yapar | Ne gerekir | Maliyet → etki |
|---|---|---|---|
| **Ok kamerası** (yapıldı, 4 Ekim 2026) | Önemli bir atışta kamera oka atılır, uçarken etrafında döner, vuruşta ağır çekimde biter. | S2 + G1 + S3 | orta → çok yüksek |
| **Ağır çekim ses tasarımı** | Ağır çekime girerken alçak geçiren süzgeç, perde düşüşü, nefes ve kalp atışı. `sfx.ts`'teki `sample(…, lowpassHz)` zaten hazır. | — | çok düşük → yüksek |
| **Karar anı tekrarı** | Sonuç ekranından önce savaşı kazandıran 4 sn, başka bir açıdan ve ağır çekimde. | Tam deterministik simülasyon gerekmez: son ~6 sn'deki birim konumlarını halka bir bellekte tutmak yeter (~48 birim × 30 Hz × 6 sn ≈ 100 KB). | orta → yüksek |
| **Renk derecelendirme** | Savaş başına bir LUT (Malazgirt: sıcak toz; Miryokefalon: soğuk dağ geçidi), hafif vinyet ve film greni. | Yalnızca yüksek kademede; G3'e dikkat. | düşük → orta |
| **Bölüm kartı ve anlatıcı** | Letterbox, hat süslemeli bir tarih kartı ve tek cümlelik Türkçe anlatım. Güçlü bir açılış motifi: kroniklere göre Alp Arslan, Malazgirt'ten önce beyazlar giyip "şehit düşersem kefenim olsun" demiş. | — | düşük → yüksek |
| **Fotoğraf modu** | Molada serbest kamera ve filtre; paylaşılabilir kareler. PAZARLAMA.md ile örtüşüyor. | G1'den sonra ucuz | düşük → orta |

---

## 8. Yol haritası

**0. ~~Şimdi: kol hücumu düzeltmesi~~** (§6). Yapıldı: PR #16.

2 Ekim 2026'da §10'daki değerlendirmeyle birleştirildi. Sıra önkoşula göre; her maddenin kabul ölçütü var. Görsel dokunan her PR §10.8'deki referans çekimlerle önce/sonra gösterir.

**Senin tarafında, hemen:** P9 (dosya public olduğu için önceliği yükseldi), P3.

**1. Sağlamlık paketi + ölçüm altyapısı.**
1. ~~P6 gizlilik metni (öncelikli)~~ Yapıldı.
2. ~~A6 hata ayıklama anahtarları bayrağın arkasına.~~ **Yapıldı:** `src/playtest.ts`, `DEV || MODE === 'playtest'` (`npm run build:playtest`). Ortam değişkeni değil derleme modu: önizlemeye konan bir değişken promote ile üretime taşınırdı. `?tune` ve `?commander=` canlı pakette okunmuyor, oyun testi paketinde okunuyor (paket taramasıyla doğrulandı). Oyun testi paketi uzak kayda göndermez. `?perf`, `?quality` ve `?telemetry` ölçüm için açık kalır.
3. ~~A1 klavye kısayolu (veri onayı ve harita radyoları dahil).~~ **Yapıldı** (`useStrikeInput.ts`), gerçek tuş olaylarıyla ölçüldü:
   - Savaş dışında odaktaki düğme Enter ve Space'i kendisi alır. BİLGİ HAZİNESİ açılır, haritadan komutan seçilir, moladan KOMUTANLAR çalışır; hiçbiri savaşı başlatmaz.
   - Tek istisna: mola ve sonuçta kendiliğinden odaklanan ana düğmede Space yutulur, Enter çalışır.
   - Basılı tutulan Space'in tekrarları da yutulur.
   - Savaşta odak bir HUD düğmesindeyken Space vuruştur, düğmeyi tetiklemez.
   - Rıza düğmeleri düz düğme, aynı yoldan geçer. Geliştirmede rıza gösterilmediği için ayrıca ölçülmedi.
4. ~~P1 hata sınırı ve WebGL bağlam kaybı.~~ **Yapıldı:** `App.tsx` `CrashGuard`, `CrashScreen.tsx`, `Scene.tsx` bağlam dinleyicisi. Ölçüm:
   - `WEBGL_lose_context` ile kayıpta savaş molaya geçer ve opak "GÖRÜNTÜ KESİLDİ" ekranı çıkar. Esc molayı kapatmaz.
   - `restoreContext` ile ekran kalkar, sahne yeniden çizilir, oyuncu DEVAM'a basar.
   - Bozuk veriyle tetiklenen render hatası "BİR HATA OLDU" ekranını gösterir.
   - 844×390'da ekran sığar.
   - Kalan: kare döngüsündeki (`useFrame`) hatalar sınıra gelmez. Çökme ekranında müzik artık susar (Adım 1.5).
5. ~~P5 + P8 + D6 ses yaşam döngüsü (tek kök).~~ **Yapıldı.** `sfx.ts` `syncAudio()` tek karar noktası: bağlam yalnız sessizde değilken, molada değilken ve sekme görünürken çalışır. Mola `gameStore` aboneliğinden (`paused` değişince, düğmenin kullanıcı hareketi içinde), çökme `CrashScreen`'den bildirilir. Her `pointerdown` ve `keydown` yeniden dener (iOS `interrupted`). `new AudioContext()` try/catch içinde. Kös zamanlayıcısı bağlamın `statechange` olayına bağlı. Gerçek tıklama ve tuşlarla ölçüldü (çıkışı sıfır kazançlı bağlam, ses kapalı):
   - BAŞLA → `running`, kös zamanlayıcısı 1.
   - Esc ile mola → `suspended`, zamanlayıcı 0. DEVAM → `running`, 1.
   - Sessiz → `suspended`, 0; sessizdeyken dokunuş bağlamı açmaz. Sesi aç → `running`.
   - Sekme gizlenir → otomatik mola, `suspended`. Geri gelince mola sürdüğü için askıda kalır.
   - Molada YENİDEN BAŞLA → `running`. KOMUTANLAR → menüde `running` (rüzgâr). Başka komutanla SAVAŞA GİR → `running`; bağlam ve zamanlayıcı tek kalır.
   - Konsolda hata yok. Kalan: iOS kesintisi gerçek cihazda gözlenmedi.
6. ~~A3 menüdeki bayat kare.~~ **Yapıldı:** `Scene.tsx` `InvalidateOnFlow`, komutan ve `started` değişince bir kare ister. Ölçüm (savaş 900 sabit adım ilerletildi, kamera (0.09, 20, 31)):
   - Önce: molada KOMUTANLAR sonrası çizilen kare sayısı değişmiyordu; menüde son savaş karesi kalıyordu.
   - Sonra: KOMUTANLAR'da bir kare çizilir, kamera açılış konumuna (6, 5.5, 30) döner. Bu, ilk yüklemedeki menü kamerasıyla aynı; ekran görüntüsünde menünün arkasında yeni savaşın açılış karesi var. SAVAŞA GİR bu kareden kesmesiz başlar.
7. ~~S6'nın ilk yarısı: `?seed=` (playtest) ve tohum savaş özetinde.~~ **Yapıldı:** `random.ts` `parseSeed`, `world.seed` (dalgalı savaşta null), `battle_start` ve `BattleSummary.seed`. Özet `jsonb`'de; tablo şeması değişmedi. Ölçüm:
   - `?seed=1071` ile iki ayrı sayfa yüklemesi, savaş 360 sabit adım (t=6) ilerletildi. 41 düşmanın konumları bit düzeyinde eşit, özette `seed: 1071`.
   - Karşı-olgu: `?seed=7` ile aynı anda konumlar 2,04 birime kadar ayrışıyor.
   - Paket taraması: `get("seed")` oyun testi paketinde var, canlı pakette yok.
   - Ölçüm tuzağı: sanal saat gerçek zamandan başlarsa adım süresi kayan noktada yuvarlanır. Bu yüzden `world.time` 6'yı bir koşuda 360., ötekinde 361. adımda geçer. Sanal saati sabit tabandan (10⁶ ms) başlatıp adım sayısını sabitlemek gerekir.
8. ~~P7 Playwright: duman testi, referans çekimler, düzen bekçisi, PR şablonu (yeni bağımlılık; senin onayınla). Kabul: bugünkü kodda düzen bekçisi kırmızı yanar (Adım 2'nin "önce" kanıtı).~~ **Yapıldı:** `playwright.config.ts` (`checks` bloklayan, `shots` yalnız çıktı), oyun testi derlemesi `dist-e2e`, `npm run e2e`. Ölçüm:
   - Duman testi (`smoke.spec.ts`): SAVAŞA GİR, 5 sn oyun, mola, devam. Konsol temiz, 19 sn.
   - Düzen bekçisi (`layout.spec.ts`): 6 ekran (menü, iki savaş, mola, zafer, yenilgi) × 3 görüş. **Bugünkü kodda 18/18 kırmızı;** bulunan ihlaller `e2e/layout-debt.ts`'de borç listesi. Bekçi tam eşitlik ister, liste yalnız küçülür; 2a'nın kabulü listenin boşalması. Başlıcaları:
     - 44 px altı: menünün komutan satırları ve SAVAŞA GİR (43 px), savaşta Mola ve Sesi aç (40×40), mola ve sonuç düğmeleri.
     - Yatay menüde sefer haritasının komutan satırları üst üste biniyor.
     - 568×320 molada KOMUTANLAR ve YENİDEN BAŞLA, 375×667 yenilgide KOMUTANLAR ve YENİDEN ekrandan taşıyor.
     - Miryokefalon'da KAYA YIĞINI yamaç kanatlarıyla kesişiyor; 568×320'de Sesi aç ile de.
     - Dikey molada kanat düğmeleri molanın düğmeleriyle kesişiyor.
   - Referans çekimler (`shots.spec.ts`): R1, R2, R3 (3 komutan), R5, R7 (zafer + yenilgi); iki kademede 22 çekim. İki koşuda 22/22 tabanla eşleşti (≤%0,1). Taban CI'nin linux çekimleri; yerel win32 çekimleri depoya girmez. Kalan: R4 ve R6 oyuncu girdisi ister. R8 ve R9 (sanat açıları, `?pose=`) Faz 27'de eklendi.
   - Paket bütçesi (`npm run budget`): gzip toplam 348 kB (three 180, render 70, react 54, index 43), bütçe 385 kB.
   - PR şablonu: `.github/pull_request_template.md`.
   - Ölçüm tuzakları: hedef adı `textContent`'ten alınınca ilerleme sayacı ("0 / 14") ada giriyor ve liste boşuna kırılıyordu; ad artık erişilebilir adın ya da görünen metnin ilk parçası. Mola paneli kayarak girerken ölçülen konumlar titriyordu; bekçi sonlu animasyonların bitmesini bekler.
   - Bulgu (2f.1'e): tohum 1071'de hiç dokunmayan oyuncu Malazgirt'i t=160'ta kazanıyor ("Gece çöktü; ordugah korundu"). Faz 17 bot testi "kollar pasif oyuncuyu kurtarmaz" diyor: ya bot ile gerçek döngü ayrışıyor ya da bu tohum istisna; ayrımı 2f.1 yapar. Boşta Miryokefalon t=85'te yenilgi, Metehan'da savaş bitmiyor. **Cevap (2f.1):** döngü değil, ilk savaşın yarı hasarı (assist 0,5).

**2. Faz 26 — Okunabilirlik ve denge.** İki kol paralel yürür.
- **2a Yerleşim ve yazı:** sonuç düğmeleri sarılır, dikeyde "telefonu yatay çevir" örtüsü, sağ başparmak bölgesi (U3), A8 ≥44 px, U1 yazı tabanı ≥12 px, U2 panelsiz metne koyu zemin. Kabul: düzen bekçisi 3 görüşte yeşil; HUD'da en küçük yazı ≥12 px; R3/R5'te metin kontrastı ≥4,5:1.
  - **İlk yarı yapıldı:** `LAYOUT_DEBT` boş, bekçi 7 ekran × 3 görüşte yeşil (yerelde; ölçüt CI'nin Linux koşusu).
    - Bütün dokunma hedefleri ≥44 px, aralar ≥8 px; A8'in dört maddesi dahil.
    - Dikey telefonda savaşın üstünde "telefonu yatay çevir" örtüsü (U6); savaş arkada molada bekler (duman testi).
    - U3, kısmen: dokunmatikte Mola ve ses köşede yan yana. KAYA YIĞINI kolların kutusuna girdi; arası sabit konumdan değil düğme boyundan doğar.
    - Kısa ekranlar: 568×320'de menü başlığının süsü, molada arma ve adım açıklamaları düşer. 375×667'de harita en küçük boyuna iner. Dikey menü `flex-end` yerine otomatik kenar boşluğuyla alta yaslanır, çünkü `flex-end`'de taşan üst kısım kaydırmayla açılmıyordu.
    - Bekçi Hazine'yi de görür. Ekrandan kısa, kaydırılan bir kutudaki hedef (bölüm listesi) taşma sayılmaz; ekran boyu kaydırma sayılır, yoksa menüde SAVAŞA GİR kıvrımın altına saklanabilirdi.
    - 22 referans çekimin hepsi değişti. Linux tabanı 41cc4ed'nin `cekimler` çıktısından yenilendi (014e9f4); sonraki koşu 22/22 eşleşti.
  - **U1 yapıldı:** bekçi görünen her yazı düğümünü de tarar, 12 px altı ihlal sayılır (geliştirici paneli ve `aria-hidden` hariç). Bekçi 23/23 yeşil.
    - `hud.css`'te 12 px altı 43 bildirim 12 px'e çıktı; büyüyen küçük başlıklarda 0,18em+ harf aralığı 0,14em'e indi. Tabana eşitlenen beş medya kuralı silindi.
    - Sefer haritası: mühürler kenarda, etiketler içeri bakar (Bozkır ve Malazgirt doğuda, Miryokefalon batıda). Menü paneli `min(300px, 40vw)`; yatay telefonda harita ~195 px, 12 px'lik etiket ~170 px.
    - Yatay telefonda brifingin yalnız adımları kayar; başlık, SAVAŞA GİR ve alt satır yerinde durur. 568×320'de eksen ve komutan satırı düşer (haritada yazıyor).
    - Hazine sekmeleri iki satır (eksen üstte, ad altta); dikeyde alt alta. 375 px'te komutan adı 4 px'e kırpılıyordu.
    - Dokunmatik VUR düğmesi savaş bitince kalkar; sonuç örtüsünün altında KOMUTANLAR'ın üstüne biniyordu.
    - Yöntem: Linux genişliği yerelde Verdana'yla (DejaVu Sans ölçüsü) taklit edildi; 6 ekran × 3 görüş temiz.
  - **U2 yapıldı:** kontrast bekçisi (`contrast.spec.ts`, bloklayan) R2 açılış (3 komutan, afiş açık), R3 (3 komutan) ve R5'te, iki kademede görünen her yazıyı ölçer. Ölçüt glif kutusundaki zemin piksellerinin en kötü onda birine karşı ≥4,5:1. Yazı gölgesi sayılmaz.
    - Şimdiki R3/R5 kareleri zaten temizdi: taktik kamera yere bakıyor, gök görünmüyor. İhlaller açılıştaydı: kamera alçak, arkada parlak pus. Savaş afişi başlığı ~1,7:1, alt satırı ~2,4:1, gün çizgisi etiketi 2,15:1.
    - Afiş, duyuru gibi %72 koyu şeridin üstünde; üst ve alt kenarı yumuşak solar. Gün etiketi `.phase` gibi hap zemin aldı. Hepsi ≥9:1.
    - Ters deneme: düzeltmesiz CSS'te bekçi R2'nin 6 karesinde de kırmızı.
    - Yöntem tuzağı: zemin, glifler `-webkit-text-fill-color: transparent` ile gizlenip çekilir (`color`'a dokunmaz, `currentColor` kenarlıklar yerinde kalır). `transition: all` taşıyan düğmede yazı solarken çekilmesin diye geçişler kapatılır.
  - **Sonuç başlığı yapıldı:** yatay telefonda otomatik odak ekranı düğmelere kaydırıyor, ZAFER/YENİLGİ görünmüyordu.
    - Kaydırmasız odak (`focus({ preventScroll: true })`) tek başına yetmedi: başlık görünür oldu ama düğmeler kıvrımın altına indi, bekçi 5 ekranda "ekrandan taşıyor" dedi.
    - Düzen menü brifingi gibi kuruldu. Solda (dikeyde üstte) başlık, yıldızlar ve özet yerinde durur; skor, tarih notu ve karne kendi kutusunda kayar. Sağda (altta) tavsiye, kilit kutusu ve düğmeler hep görünür. İki sütun artık 720 px altındaki yatay telefonlarda da.
    - Tavsiye karneden çıktı, düğmelerin hemen üstüne geldi: kayan kutunun dibinde kalırdı.
    - Bekçi başlığın ve ana düğmenin tam göründüğünü, odağın ana düğmede olduğunu da denetler. 6/6 yeşil, kaydırma yok.
    - Bilinen yedek: 568×320'de kilit kutusu ve cevapsız veri sorusu bir aradaysa sağ sütun ekrandan uzun. Ekran aşağı kayar (`align-items: safe center`), EVET/HAYIR için kaydırmak gerekir; başlık ve üç eylem düğmesi görünür kalır. Veri sorusu e2e derlemesinde yok, dev sunucusunda taklitle ölçüldü.
    - R7'nin 8 çekimi değişti.
  - **Kalan:** gerçek cihaz.
  - Bulgular:
    - Linux'ta gövde yazısı (`system-ui` → DejaVu/Liberation) Windows'tan geniş; kol düğmeleri "SAĞ YAMAÇ"a göre boyutlandı.
    - 568×320 Hazine'de uzun not başlıkları ("Dönüş emri bozgun oldu") dar sütunda üç noktayla kesilir; seçilince sağdaki kartta tam yazar.
- **2b Geri bildirim:** D2 hasar (ses + titreşim + kenar flaşı), V2 "hazır" rengi kırmızıdan ayrılır, U7 ikinci sinyal, D4 alçak seslere harmonik, D1 menüde ses düğmesi, D3 titreşim ayarı, D7. (A5 faz 27'nin önkoşulu olarak kapandı.) Kabul: hasar olayında ses ve titreşim ≥1 (test); hazır↔hücum ΔE_OK ≥0,15 (deut/prot dahil); 'dusk' 150 Hz yüksek geçiren sonrası tepe ≥ −30 dBFS; hareketi azaltta sarsıntı ve titreşim 0.
  - **Yapıldı (4 Ekim 2026, `claude/faz-26-geri-bildirim`):**
    - D2: temas hasarı `sim/hurt.ts`'te birikir; 3 puanda bir, en sık 0,45 sn'de bir "yara": `hurt` sesi, 18–32 ms titreşim, `hurt` olayı, kenar flaşı (yalnız solar) ve vuruşunkinden hafif sarsıntı. `hurt.test.ts`: hasarda ses ve titreşim ≥1, hasarsız 0, sürekli temasta sıklık sınırlı.
    - V2: hazır rengi `#ff4400` → `#5ef2e0` (parlak turkuaz, `palette.ts`; HUD'da `--ready`). Hamle kırmızısına ΔE_OK normal 0,43, deut 0,26, prot 0,43, trit 0,48; şarj altınına ≥0,20 (`palette.test.ts`). Kor turuncusu kolların hücumuna kaldı.
    - U7: düşük can (≤40) çubuğu kırmızı ve taralı; çubuk `role="meter"`.
    - D4: kös ve gövde vuruşları (`strike`, `dusk`, `order`, `rockslide`) `drum()` ile 2. ve 3. harmonik + deri şaplağı alır. Ölçüm (dev, gerçek ses grafiği, 150 Hz 48 dB/okt yüksek geçiren, RMS): `dusk` −37,3 → −27,2 dBFS; süzgeçsiz RMS −24,6 → −24,1 (iyi hoparlörde ses yüksekliği değişmedi). Tepe ölçüsü atak tıkıyla şiştiği için RMS kullanıldı.
    - D1: menüde ses düğmesi (yatayda iki panelin arasında, dikeyde başlığın solunda); harita seçimi ve Hazine'de `ui` tıkı. İlk tık bağlamı açar, açılış sürerken sessiz kalabilir.
    - D3: titreşim ayarı (`hilal_haptics`, kalıcı), yalnız titreyebilen dokunmatik cihazda düğme; zaferde boru ritminde titreşim. iOS'ta API yok.
    - D7: hareketi azalt yara sarsıntısını da kapsar (`shake.ts`, `motion.test.ts`).
    - Bekçiler 38/38 yeşil (yerel). Menü (R1) ve savaş çekimleri değişir; Linux tabanı CI'nin `cekimler` çıktısından.
    - Kalan: gerçek telefonda his (titreşim süreleri, flaş şiddeti) ve D5 (limiter, ayrı ses sürgüleri) düşük önemde açık.
- **2c Terim ve tipografi:** tek fiil (VUR), bizim birlikler kanat/yamaç, Bizans'ınki kol; Cinzel metinleri `uppercase` (`lang="tr"` ile i→İ); "→" kaldırılır; U8 `aria-live`. Kabul: Cinzel seçicilerinde karışık harf yok; menü ve HUD aynı fiili kullanır.
- **2d Tarih metinleri:** T1, T2, T4, T6, T7, T10, T12, T3 çerçeve cümlesi, T13 bağlam satırları. Kabul: kaynaklı kartlarda "Manuel … istedi", "kaya", "öncü durdu", "teslim oldu" yok (`lore.test`); her brifing bir bağlam satırıyla açılır.
- **2e Kural ipuçları (O5/O7):** Metehan'a ≥3 kapılı ipucu, harita kartında yıldız hedefi. Kabul: her ipucu `progress.test`'te bir kez tetiklenir.
  - **Yapıldı (5 Ekim 2026, TASARIM Mantık 5, `claude/adim-dongusu`):**
    - Üç enerji ipucu, oyuncunun durumu açınca ve oyuncu başına bir kez (`teachEnergy`, `scenarios.ts`):
      - `'stall'`: 15–60 sn arasında hiç düşüş yok ve hilal 15'in altında. Metin: düşman düzenli, uzaklaş.
      - `'fill'`: hilal 30'u geçince. Metin: kümelendikçe hilal dolar.
      - `'ready'`: vuruş hazır. Metin: VUR.
    - Ölçüm (başlangıç basamağı): boştaki bot `'still'` 5 sn, `'stall'` 15 sn. Uzman bot `'fill'` 9,4 sn, `'ready'` 14,3 sn, ilk vuruş 14,5 sn. Acemi `'fill'` 9,9 sn, `'ready'` 14,9 sn. Kaçan oyuncu `'stall'`ı hiç görmez (`metehan.test`, `stepGame` ile tekrar).
    - Harita kartı sıradaki yıldızın koşulunu gösterir (`CommanderInfo.stars`, `.brief-goal`). Örnek: "Zafer: Dört dalgayı aş". Üç yıldızda satır gizlenir.
- **2f Denge (yalnız simülasyon):**
  1. ~~S1'in ilk yarısı (`stepGame` saf fonksiyonu) ve S4. Kabul: aynı tohum ve girdiyle bot ile oyun döngüsü aynı dünya durumunu verir; 0,9 sn enerji donması botlarda da var. İlk sınama: tohum 1071'de boşta Malazgirt oyun döngüsünde kazanılıyor; pasif bot aynı tohumda aynı sonucu vermeli (Adım 1.8 bulgusu).~~ **Yapıldı (5 Ekim 2026, `claude/adim-dongusu`):**
     - `sim/step.ts` `stepGame(world, input, dt, fx)`: oyuncu → düşmanlar → temas → hilal yönü → vuruş/enerji → savaşın akışı → sonuç. Ses, titreşim, olay kaydı ve ipuçları `StepEffects` ile gelir: oyunda gerçek (`GAME_FX`), botlarda `SILENT_FX`.
     - Yönetmen öncelik −1'de adımı yürütür; oyuncu ve sürü artık yalnız çizer. Yönetmen ve olay boşaltıcı Suspense'in dışında (S1'in ikinci yarısı, model başına Suspense, faz 28'de).
     - `runBattle` ve `runWaves` aynı adımı çağırır; dalgalı savaşın eski kural düğmeleri (bozgun, uzakta doğma) `wavesScenario(rules)` parametresi. Hasar çarpanı `world.assist`'te: yönetmen savaş başında senaryodan yazar, botlar parametreden.
     - Zafer puanı (yıldızlar dahil) adımın içinde; botlar oyunun puanını görür. Bot dosyalarındaki puan kopyası kalktı.
     - `step.test.ts`: kaydedilen bot girdisi oyun döngüsünde aynı sonucu, süreyi, canı, puanı ve düşen sayısını verir. Vuruştan sonra 0,9 sn enerji dolmaz (kuşatmaya açıklık varken de); kuralı silen değişiklikte test kırmızı.
     - Adım 1.8 bulgusunun cevabı: döngü ayrışmıyordu. Tarayıcıdaki ilk savaş yarı hasarla (assist 0,5) koşuyor, testler tam hasarla. Tohum 1071, boşta:

       | Savaş | assist 0,5 | assist 1 |
       |---|---|---|
       | Malazgirt | zafer, t=160 (can 15,7, puan 579) | yenilgi, t=100,9 |
       | Miryokefalon | yenilgi, t=84,6 | yenilgi, t=78,1 |

       Oyun döngüsü ile pasif bot dört durumda da aynı. Metehan'da boşta oyuncu hiç hasar almaz (600 sn'de can 100); savaş bitmez.
     - Donma artık botlarda da var; mevcut 243 denge testi değişmeden geçti. Eşikler yine de 2.'de yeniden ölçülür.
     - Tarayıcıda (`?commander=alp-arslan&seed=1071`): klavye 6 birim/sn yürütür, sürü yürür, VUR 4 düşüş ve 400 puan verir, 2 kare hitstop ve 0,9 sn donma; konsol temiz. Zincir: lint, tsc, 246 test, derleme, bütçe 358,5/385 kB, 38/38 e2e.
  2. Yeniden ölçüm, sonra ayar. O1: kışkırtıcı + sabırsız 30 tohumda 3★ ≤%70, pusu 3★ oranı ≥ sabırsız. O2: önce ilk vuruşun neden hep ~99 sn olduğu ölçülür; sonra ilk vuruş ortancası ≤60 sn, 3★ penceresi ≥3 birim. O3: acemi bot tabanda ≥%20, uzman tam hasarda ≥%90 kazanır. O4 skor basamağa göre ölçeklenir; O6 belge ifadesi.
     - **Ölçüm (5 Ekim 2026, donma botlarda, Mantık 1'den önce):**

       | # | Hedef | Ölçülen | Durum |
       |---|---|---|---|
       | O1 | kışkırtıcı + sabırsız 3★ ≤%70; pusu ≥ sabırsız | sabırsız %100, pusu %83 | açık |
       | O2 | ilk vuruş ortancası ≤60 sn; 3★ penceresi ≥3 birim | ~40 sn; 7 birim | tamam |
       | O3 | acemi tabanda ≥%20; uzman tam hasarda ≥%90 | acemi 0/30 (0,5'te); uzman 28/30 | acemi açık |

       - O2'nin eski ~99 sn'si donmasız botlardandı; donmayla birlikte hedef tuttu.
       - Yan bulgular: kesmeyen bot geçitte yine 1★ kazanıyordu (kol z=19'da kalıyor, çıkış 22). z=−1'de kesen bot 8/8 ölüyor; bu ayrıca incelenecek.
     - **Mantık 1, pasif oyun kazanmasın (TASARIM §6 adım 1; `7c8c65c`):**
       - Malazgirt'te gece hedefi: gece çöktüğünde ordunun dörtte biri düşmüş olmalı (`BATTLE_CONFIG.nightGoal` 0,25 → 41'den 11). Pasif oyuncu 0 düşürür, taciz eden botlar 17 ve üstünü. Hedefsiz gece yenilgidir: `DefeatCause` `'night'`, sonuç ekranında "GERİ ÇEKİLDİN", karnede "Zafer: ordunun dörtte biri" hedefi.
       - Geçitte taciz yavaşlatması düşük: `harassSlow` düzene göre (meydan 0,6, geçit 0,3). Yolu kesmeyen kol geçidi aşar ve oyuncu yenilir (`column.test`).
       - Metehan'da duran atlı hedef olur (`stillPress`): hız 0,5'in altında 5 sn kalınca sürü 3 sn içinde mesafeyi kapatır, düzen bozulmadan. İpucu `'still'`. Boştaki bot 30 sn içinde yenilir (`metehan.test`).
       - Tohum 1071, boşta Malazgirt (assist 0,5): yenilgi, `'night'`, t≈160 (`step.test`).
       - E2E zafer çekimi artık boşta beklemiyor: çekim kipinde `?bot=harass` güvenli taciz botunu sürer (`battleBots` yalnızca bu kipte, ayrı parçada yüklenir).
       - Yerelde lint, tsc, 248 test, derleme, bütçe 360,7/385 kB ve checks 41/41 geçti. `shots` CI'da (R7 ve Metehan 6 sn çekimleri değişir).
     - **Mantık 6, adil zorluk (O3, O4):**
       - Merdiven başlangıcın altına iki basamak iner: 0,35 ve 0,2 (`LADDER_BOTTOM` −2). Başlangıç yine basamak 0 ve yarı hasar, yani kayıttaki eski basamak aynı hasarı verir ve göç gerekmez. Eski sürüm eksi basamağı 0'a kıstırır.
       - 30 tohumda acemi bot 0,25'te 4, 0,2'de 14 zafer alıyor; taban bu yüzden 0,2. Tabanda 60 tohumda 26 zafer (%43, O3 hedefi ≥%20). Merdivenle 20 acemi 3. dalgaya en geç 4., ilk zafere en geç 8. denemede ulaşıyor (`metehan.test`).
       - Alp Arslan, Metehan'da 3. dalgaya ulaşınca da açılır (`CommanderInfo.unlockWave`, ilerlemede `wave`). Kilit metni: "Metehan ile 3. dalgaya ulaşınca açılır".
       - O4: Metehan puanı basamakla ölçeklenir (`waveScore`): yarı hasar ×1, tam hasar ×2, taban ×0,4. Başlangıç ×1 olduğu için eski rekorlar bugünkü ölçekte kalır. Basamak oyuncuya gösterilmiyor.
       - Açık: Baideng'e bir kez ulaşanın oradan başlaması (TASARIM Mantık 6'nın ilk maddesi).
     - Kalan: O1 ayarı, z=−1 bot ölümü.
  3. Senin tarafında: gerçek oyuncuyla ilk 3 denemede kazanma oranı (bot insan değildir).

**3. Faz 27 — Sinematik.**
- Önce önkoşullar. **Hepsi yapıldı** (3 Ekim 2026; 3 Ekim kararıyla faz 26'nın 2b–2f'sinden önce):
  - ~~A4 nesil sayacı~~ `4e1d4d0`
  - ~~G6 sancak sırası~~ `28a53d8`
  - ~~A5 hareketi azalt~~ `3410ba1`, `cc2d825` (faz 26'dan çekildi)
  - ~~S3 zaman ölçeği~~ `2aa52d4`
  - ~~S2 olay kuyruğu~~ `55ffee4`
  - ~~A2 akış modu~~ `c0ba464`
- Paralel: **görsel temel ve stil rehberi** ([STIL.md](STIL.md)): V6 ton eşleme (ölü ACES ayarı kalkar), V1 değer rolleri, V3 tarafa göre at rengi, V4 siluet imzaları, V5 çim yoğunluğu ve otağ, M2 düşük kademe kenar yumuşatma kararı (gerçek cihaz ölçümüyle). Kabul: R3/R5'te birim–zemin parlaklık farkı ΔL ≥0,15 (öğle ve gün batımı); Metehan yüksek kademe ≤55k üçgen; R8/R9 önce/sonra; senin görsel onayın.
  - Durum (3 Ekim 2026): V1, V3, V4, V5, V6 yapıldı. R3/R5'te her grup ortanca |ΔL| 0,16–0,23 (önce 0,08–0,13), iki kademede `art.spec.ts` yeşil; Metehan yüksek 81,6k → 53,5k üçgen. Ölçüt işaretsiz |ΔL|: kahraman bilerek iki tonlu (STIL.md §2).
  - Açık: M2 telefon ölçümü (`?quality=low&perf` ile `&msaa=2`, karar kuralı STIL.md §11) ve senin görsel onayın.
- Sonra sırasıyla:
  1. ~~G1 kamera yönetmeni ve kompozisyon (K1–K3).~~ Kabul: 180° dönüşte oyuncunun ekran kayması ≤%10 yükseklik; R3/R4'te düşman cephesi HUD'un altında kalmaz; kesilen çekim sert kesme yapmaz.
     - Durum (4 Ekim 2026): yapıldı. K1 ~%25 → ~%8 (`tacticalCamera.test.ts`). K2: R3'te HUD altındaki cephe Malazgirt %2,9 → 0, Miryokefalon %8,3 → 0; ordunun HUD altındaki payı %26 → %7 / %20 (`art.spec.ts` kadraj). K3: geçiş testi `cameraShots.test.ts`, yönlü sarsıntı `shake.test.ts`. Eğim 45° → 38°; 36° cepheyi daha açıyordu ama R5'te kahraman |ΔL| 0,12'ye düşüyordu.
  2. ~~Ok kamerası~~
     - Durum (4 Ekim 2026): yapıldı (`arrowShot.ts`). Tetik savaş başına en çok iki: oyuncunun ilk tacizi ve imparatorun açığa çıkışı (merkeze giden ilk ok); ok 2,5 sn içinde kalkmazsa istek düşer. Kamera 0,6 sn'de oka iner, ok ağır çekimde uçarken arkasından yana ~80° döner, saplanınca yükselip vuruş yerine bakar (kıvılcım), 0,7 sn bekler ve 1,1 sn'de taktiğe döner; toplam ~4,5 sn. Süren çekimi kesmez, hareketi azaltta kapalı. Yeni bir dokunuş ya da tuş her çekimi atlar (`skipShot`): açılış ve gün batımı dahil. Referans anlarına (R3 6 sn, R5 104 sn) düşmez: hareketsiz oyuncuda ilk taciz Malazgirt'te 50–70, Miryokefalon'da 20–40 sn arası.
  3. Savaş açılış çekimi, letterbox ve atlama
  4. Ağır çekim sesi
  5. Renk derecelendirme (yüksek kademe; görsel temeldeki ton eşlemeye bağlı)
- Her çekimin kabulü: girdiyi kilitlemez, dokununca atlanır, hareketi azaltta kapalı, sık tekrarlamaz. His ve zamanlamada son söz senin.

**4. Faz 28 — Modeller.**
- Önce önkoşullar:
  - S1'in ikinci yarısı: bölünmüş Suspense (`stepGame` ve S4 faz 26'da kapanır)
  - `STIL.md` stil rehberi
  - P2 varlık önbelleği
  - P4 servis çalışanı güncellemesi
  - G4 morf kapasitesi
  - G5 gölge bütçesi
- Sonra sırasıyla:
  1. Pilot model (atlı Alp Arslan)
  2. Sahne nesneleri
  3. Kalabalık birlikler
- Kabul: pilot R3/R8'de stil rehberine uyar; düşük kademe çizim ve üçgen bütçesi aşılmaz; gerçek telefonda FPS düşmez.

**Sonra (içerik):** T13 sefer finali ve Mete epiloğu; O8 yeniden oynama kancası (günlük tohum, S6'nın üstüne).

**Sürekli:** S5 yapıştırıcı testleri, S6'nın ikinci yarısı (sabit adım) ve fırsat buldukça düşük önemli maddeler.

**Senin tarafında:**
- Vercel'de Production Branch Tracking'i açmak (P3)
- Supabase'de kayıt eklemeye hız sınırı (P9)
- Pazarlamadan önce tarihçi incelemesi: T3, T5, T7, T8, T11 ve §10.7'deki sorular
- Gerçek telefonda düşük ve yüksek kademe FPS ölçümü (M1: GPU süresi tarayıcıdan ölçülemiyor)
- Flow ile tek bir deneme klibi
- Meshy ücretli katman kararı

---

## 9. Faz sonu denetim disiplini

Bir faz kapanmadan önce:

- [ ] `tsc --noEmit` · `oxlint` · `vitest run` · `vite build` — hepsi yeşil
- [ ] Paket ve önbellek boyutu bütçe içinde (P7'den sonra CI denetler)
- [ ] Değişen kod `/simplify` ile gözden geçirildi
- [ ] Bu dosyadaki risk kaydı güncellendi: kapananlar işaretlendi, yeniler eklendi
- [ ] Görsel dokunan PR'larda etkilenen referans çekimlerin önce/sonra tablosu var (§10.8)
- [ ] Düzen bekçisi yeşil: üç görüşte taşan ya da çakışan dokunma hedefi yok
- [ ] Gerçek telefonda 10 dakika oynandı: dokunma, ses, ısınma, FPS
- [ ] Yayın: birleştir → promote → canlı pakette yeni kod doğrulandı
- [ ] PLAN.md'de faz kapatıldı

Bu liste bir proje becerisine (skill) dönüştürülebilir. O zaman aynı denetim her faz sonunda tek komutla çalışır.

---

## 10. Disiplinler arası değerlendirme (2 Ekim 2026)

**Kapsam:** canlıdaki faz 25 + PR #16 (kol hücumu) + PR #17 (P6), `76012a3`.

**Yöntem:**
- Yedi bakış açısı: oyun tasarımı, sanat, kamera, UX, ses ve titreşim, teknik, tarih.
- Ekran görüntüleri:
  - 3 komutan, düşük ve yüksek kademe, 667×375 yatay dokunmatik.
  - Dikey 375×667, savaş ve sonuç ekranı.
  - Malazgirt gün batımı.
- Çizim ölçümü: `gl.info`.
- DOM ölçümü.
- 30 tohumlu bot taramaları.
- Görsel testler: WCAG kontrastı, renk körlüğü simülasyonu, yazı tipindeki harf tablosu.
- Kaynak karşılaştırması: Khoniates, Attaleiates, Shiji.

Yüksek önemli iddialar ayrıca kodda doğrulandı.

**Kodlar:** **O** oyun tasarımı · **V** sanat · **K** kamera · **U** UX · **D** ses ve titreşim · **M** teknik ölçüm · **T** tarih. §4'teki S/G/P/A kodları değişmedi.

### 10.1 Oyun tasarımı ve denge

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| O1 | Yüksek | Malazgirt'te baskın tarif: kışkırtıcı + sabırsız kollar 30/30 tohumda 3★, ~101 sn (gün batımından 2 sn sonra). Brifingin "taciz et, akşamı bekle" önerisi 1–2★. | bot taraması; `wings.test.ts:133-159` bu birleşimi ölçmüyor |
| O2 | Yüksek | Miryokefalon tek karar: R ~1,3 sn'de, ilk vuruş 8/8 tohumda 99–100 sn; 3★ penceresi ~2 birim; hiç kesmeyen bot da kazanıyor. | `blockerBot(z)` taraması |
| O3 | Orta | Metehan merdiveninin tabanı acemiyi kurtarmıyor: acemi bot 0,5'te 0/30, Alp Arslan kilidi buna bağlı. | `waves.ts:129`, `scenario.ts:54` |
| O4 | Düşük | En iyi skor zorluk basamağına göre ölçeklenmiyor. | `score.ts` |
| O5 | Orta | Metehan'da kapılı ipucu yok; "enerji neden dolmuyor" sorusunun oyun içi cevabı yok. | `progress.ts:12` (7 ipucu, hepsi diğer savaşlarda) |
| O6 | Orta | "Kuşatılabilirlik = sıkışıklık × (1−disiplin)" biçim olarak doğru. Ama sıkışıklık ortalama yarıçap, ordu savaşında hesaba giren en zayıf birlik. | `hilalSystem.ts:234-235`, `corps.ts:913-934` |
| O7 | Orta | İlk 60 sn'de enerji dolumu öğretilmiyor. | `StartScreen.tsx:69-71`, tek oyun içi metin `WAVE_HINT` |
| O8 | Orta | Tarifler bulununca yeniden oynama kancası yalnız skor. | tohum farkı ±1,5 / ±0,3 |

S4 doğrulandı: O1–O3 sayıları botlarda enerji donması olmayan, daha kolay bir oyunda ölçüldü. Ayar S4'ten sonra yapılır.

### 10.2 Sanat yönetimi ve kamera

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| V1 | Yüksek | Birimler zeminden parlaklıkla değil tonla ayrılıyor. Gün batımında kırmızımsı düşman kırmızımsı zeminde. | L: Bizans .38 / toprak .353; ekran görüntüleri |
| V2 | Yüksek | Oyuncunun "hazır" hilali ile düşmanın hücum kaması aynı renk (ΔE 0,03). | `CrescentPreview.tsx:43` `0xff4400`, `ChargeWarnings.tsx:39` `#ff2a12` |
| V3 | Orta | At gövdesi her tarafta aynı ve toprakla aynı (ΔE 0,028). | `riderGeometry.ts:57` |
| V4 | Yüksek | Siluet imzaları alt-piksel: atlı ~22 px, mızrak/yay/tuğ <1 px. İmparator yalnız 1,25× ve altın; Romanos ile Manuel aynı. | `riderGeometry.ts`, `EnemySwarm.tsx:25` |
| V5 | Orta | Yüksek kademede çim okunabilirliği düşürüyor; otağ titreşimli koyu leke; menü panelleri yatay genişliğin ~%75'i. | ekran görüntüleri |
| V6 | Orta | Ton eşleme yok: EffectComposer `NoToneMapping` kuruyor, ACES ayarı ölü. Renk derecelendirmenin önkoşulu. | `Scene.tsx:91-96` |
| V7 | Düşük | Gölge çerçevesi orijine sabit (±35); kanyona özgü ışık dizisi yok. | `DayCycle.tsx:100-103, 147-166` |
| V8 | Orta | Cinzel küçük harfleri noktasız küçük büyük harf: karışık harfli metinde i = ı. "→" yedek yazıya düşüyor. 7–10,5 px Cinzel metinler var. | woff harf tablosu, `hud.css` |
| ~~K1~~ | Orta | **Kapandı (G1).** İleriye bakış 180° dönüşte oyuncuyu ekranda ~%25 yükseklik savuruyor. | `FollowCamera.tsx:19`, `hilalSystem.ts:41` |
| ~~K2~~ | Orta | **Kapandı (G1).** 667×375'te düşman cephesi üst kenarda, HUD'un altında. | ekran görüntüsü, Malazgirt t≈6 |
| ~~K3~~ | Orta | **Kapandı (G1); fov açık.** Tek eğim, sabit fov 55. Sarsıntı ±3,7 px yönsüz gürültü. Kesilen çekim sert kesme yapıyor. | `CameraShake.tsx:21-26`, `cameraShots.ts:91-92` |

### 10.3 UX ve erişilebilirlik

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| U1 | Yüksek | HUD'da 31 sabit 10–11 px yazı kuralı; rem/clamp yok. | `hud.css` |
| U2 | Yüksek | Panelsiz metinler gündüz göğünde 1,03–3,64:1; banner alt yazısı ~2:1. | kontrast betiği, ekran görüntüsü |
| U3 | Yüksek | Dikey 375×667'de enerji çubuğu joystick'le 39 px, KUŞAT'la 19 px çakışıyor. Yatayda YOLU KES ile kol düğmeleri arası 0 px. Sonuç düğmeleri 375 px'te kırpılıyor (−3 / 378). | DOM ölçümü; `hud.css:1420` sarılmıyor |
| U4 | Orta | Komutan değişince `autoFocus` odağı çalıyor; harita radyolarında gezinme yok. | `StartScreen.tsx:94`, `SeferMap.tsx:100` |
| U5 | Düşük | HUD düğmeleri yalnız `onPointerDown`; tuş ataması yok. | `HilalEnergyHUD.tsx:272,303,383` |
| U6 | Orta | Tarayıcıda dikey serbest, döndürme istemi yok. | `vite.config.ts:24` yalnız PWA |
| U7 | Orta | Sağlık ve hücum uyarısı yalnız renkle. | `HilalEnergyHUD.tsx:138-139` |
| U8 | Düşük | Duyuru ve ret metninde `aria-live` yok. | `HilalEnergyHUD.tsx:236, 347-355` |

Terim tutarsızlığı: düğme KUŞAT/MENZİL/VUR (`HilalEnergyHUD.tsx:274`), menü "Space: vuruş". "Kol" hem bizim birliklerimiz hem Bizans yürüyüş kolu (T9).

### 10.4 Ses ve titreşim

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| D1 | Orta | Menüde ses düğmesi ve arayüz sesi yok. | `sfx.ts:12-26` |
| D2 | Yüksek | Hasar alınca ses, titreşim ve görsel tepki yok. | `GameDirector.tsx:126` |
| D3 | Orta | Titreşimi kapatma ayarı yok, iOS'ta yok, zafer ve hasarda çağrılmıyor. | `sfx.ts:89-93` |
| D4 | Orta | Gün batımı, vuruş, emir ve kaya sesleri saf alçak sinüs; telefon hoparlörü ~150 Hz altını çalmıyor. | `sfx.ts:109,153,157,169`, `ambience.ts:9` |
| D5 | Düşük | Limiter ve ayrı ses sürgüleri yok. | `sfx.ts:29` |
| D6 | Orta | ~~Molada rüzgâr sürüyor; dönüşte `resume()` jest dışında (P5 ile aynı kök).~~ Kapandı (§8 Adım 1.5). | `sfx.ts:74-77` |
| D7 | Düşük | Hareketi azalt sarsıntıyı ve titreşimi kapsamıyor (A5). | `CameraShake.tsx:21-26` |

### 10.5 Teknik ve mobil performans

| # | Bulgu | Kanıt |
|---|---|---|
| M1 | Çizim/üçgen, yüksek → düşük: Metehan 36/81,5k → 18/22k (çim ~59k, %72); Malazgirt 55/102k → 36/43k; Miryokefalon 51/98k → 33/39k. CPU gönderimi ~1 ms/kare. GPU süresi gerçek cihaz olmadan ölçülemedi. | `gl.info` |
| M2 | Düşük kademede hem DPR 1 hem kenar yumuşatma yok; gölge her kademede açık (G5). | `quality.ts:30-32`, `Scene.tsx:88` |
| M3 | Savaş tohumu `Math.random`; `createBattle` zaten tohum alıyor, dışarı açılmamış. | `world.ts:122` |

### 10.6 Güçlü yanlar (korunacak)

- Savaş sonu karnesi: net cümle, tarih kartı, tek öneri.
- Kaynaklı kartların çoğu: Baideng, akşam dönüşü, esir, sıkışma.
- Panelli metinler ≥7:1.
- `focus-visible` kuralları.
- Tohumlu bot düzeneği.

### 10.7 Tarih ve anlatı

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| T1 | Yüksek | "Barışı Manuel istedi" Khoniates'e atfediliyor; Khoniates'te barışı sultan öneriyor. | `lore.ts:184-185`, OutcomeScreen, debrief, scenarios |
| T2 | Yüksek | "Kolun başı durunca" ve "öncü kaya yığınını temizledi": Khoniates'te öncü geçer, darbe artçıya iner; kaya kurgu. | `lore.ts:167`, `debrief.ts:532` |
| T3 | Orta | Mete = Modu olgu gibi; Xiongnu kimliği tartışmalı. | `scenario.ts:37`, `lore.ts:75` |
| T4 | Orta | "MÖ 209" savaş tarihi değil, tahta çıkış yılı. | `scenario.ts:38` |
| T5 | Orta | "Alp Arslan akşamı bekledi" kaynakta plan olarak yok. | PAZARLAMA.md, `scenario.ts:58` |
| T6 | Orta | "Ordu teslim oldu": ordu dağıldı. | `debrief.ts:328` |
| T7 | Orta | "Kalıcı olarak Türk yurdu oldu" teleolojik. | `lore.ts:194`, OutcomeScreen |
| T8 | Orta | Kefen sözü bir rivayet (topos). | §7.3 |
| T9 | Orta | "Kol" terimi iki anlamda. | `scenarios.ts:158-186`, `HilalEnergyHUD.tsx:30-36` |
| T10 | Düşük | Küçük kaynak düzeltmeleri (yirmi dört bey, kataphrakt, körleme sırası). | `lore.ts:84,130,157` |
| T11 | Düşük | Hilal amblem olarak Hunlar ve büyük olasılıkla Selçuklular için anakronik. | `SeferMap.tsx:112` |
| T12 | Orta | "Gerçek taktikleriyle" iddiası T1/T2 düzelmeden savunulamaz. | `index.html:6,14` |
| T13 | Orta | Anlatı yayı yok: bağlam satırı, Mete epiloğu ve sefer finali yok. | `scenario.ts:37-72`, OutcomeScreen |

**Tarihçiye sorular:**
1. "Manuel barış istedi" yorumu hangi kaynağa dayanıyor?
2. Tzivritze'de yolun taşla kapatıldığını anlatan bir kaynak var mı?
3. Kefen sahnesinin en erken kaynağı hangisi?
4. Selçuklular hilali hanedan ya da sancak işareti olarak kullandı mı?
5. Xiongnu yaylarının boyu "kısa" sayılır mı?
6. Mete ile Modu ifadesi MEB müfredatıyla nasıl uzlaştırılmalı?

### 10.8 Görsel disiplin

**Referans çekimler.** Her çekim tohum, komutan, kademe, görüş ve simülasyon anıyla sabitlenir. Playtest bayrağı arkasındaki `?shot=` tohumu kurar, simülasyonu sabit 1/60 adımla o ana götürür, duyuruları gizler, sesi kapalı tutar.

| # | Sahne | An | Görüş |
|---|---|---|---|
| R1 | Menü | — | yatay + dikey |
| R2 | Açılış | t=1 | yatay |
| R3 | Taktik görünüm, 3 komutan | t=6 | yatay |
| R4 | İlk vuruş | vuruş karesi | yatay |
| R5 | Malazgirt gün batımı | t=104 | yatay |
| R6 | Miryokefalon yığılma | kesişten 5 sn sonra | yatay |
| R7 | Sonuç: zafer + yenilgi | — | yatay + dikey |
| R8 | Sanat açısı: yer seviyesi | t=6, sabit poz | yatay |
| R9 | Sanat açısı: geniş plan | t=6, sabit poz | yatay |

Her çekim düşük ve yüksek kademede alınır. Görüşler 667×375 yatay ve 375×667 dikey. R8 ve R9 oyun kamerası değil; model ve renk kararları bu iki sabit açıyla yargılanır.

**Kurallar:**
- **Düzen bekçisi (bloklayan):** 667×375, 568×320 ve 375×667'de hiçbir dokunma hedefi ekrandan taşmaz ve başka bir hedefle kesişmez. Hedef ≥44 px, komşu aralığı ≥8 px. Görünen yazı ≥12 px.
- **Kontrast bekçisi (bloklayan):** R2, R3 ve R5'te iki kademede görünen her yazı zeminine karşı ≥4,5:1 (zemin piksellerinin en kötü onda biri).
- **Görsel fark:** Playwright `toHaveScreenshot`, toleranslı. Başta CI çıktısı olarak sunulur, birleştirmeyi durdurmaz. Arayüz çekimleri (R1, R7) iki hafta kararlı kalırsa bloklayana geçer.
- **PR şablonu:** görsele dokunan PR'da etkilenen R çekimlerinin önce/sonra tablosu olur. Renk değişiminde kontrast ya da ΔE sayısı yazılır.
- **Determinizm:** aynı commit'te aynı çekim iki koşuda en fazla %0,1 piksel farkıyla tekrarlanır.

---

## Ek A — Doğrulama notları

- **İnceleme:** dört bağımsız alan incelemesi ve Flow/Meshy araştırması yapıldı. Ölçümler ve yüksek önemli iddialar ayrıca kodda doğrulandı.
- **Düzeltilen iddia:** platform incelemesinin "promote edilen önizleme telemetrisiz yayınlanır" iddiası (yüksek önem) yanlış çıktı.
  - Canlı pakette `battle_summaries` ve `supabase.co` bulunuyor; promote, üretim değişkenleriyle yeniden derliyor.
  - Bu yüzden orta önemli bir süreç riskine indirildi (P3).
- **Yalnızca kodla doğrulananlar:**
  - A3 (bayat kare) ekran görüntüsüyle doğrulanmadı.
  - P5 (iOS sesi) gerçek cihazda gözlenmedi.
- **Ölçülmeyenler:** gerçek cihazda FPS, GPU belleği, ısınma.
- **Araştırma rakamları:** fiyat, kredi ve süreler Ekim 2026 itibarıyla. Satın almadan önce yeniden bakılmalı.
