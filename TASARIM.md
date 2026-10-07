# HİLAL: Tasarım Araştırması

Bu belge oyunu daha mantıklı, daha eğlenceli ve daha klas yapmak için önerilen maddeleri tutar. Dayanakları kod, bot ölçümleri (MIMARI.md §8, §10), sunum envanteri ve birincil tarih kaynaklarıdır (§9). Seçilen maddeler MIMARI.md §8'e faz olarak girer. Bu belge MIMARI.md ile çelişirse MIMARI.md kazanır. Tarih iddiaları için HIKAYE.md'deki üç onay kuralı burada da geçerlidir.

**Durum:** öneri (5 Ekim 2026). Kullanıcı belgeyi onayladı; maddeler tek tek seçilecek. Belge `claude/hikaye-anlatici` üzerinde yazıldı. Açık PR #26 (açılış çekimi, sinema şeritleri) ve #27 (karakalem giriş ekranı) bu dalda yok.

Her maddede **etki** (yüksek, orta, düşük), **iş** (düşük, orta, yüksek) ve gerekiyorsa **kaynak** hükmü (§9) var.

## 1. Teşhis

- **Çekirdek döngü sağlam ve özgün:** çekil → topla → kuşat. Hilal enerjisi düşmanın kümelenmesi ve düzensizliğiyle dolar. Sorun, kararların yer yer incelmesi:
  - Metehan'da tek tuş var (Space = hilal). Kaçınma hareketi ve toplanacak nesne yok.
  - Miryokefalon tek karar (O2). R ~1,3 sn'de basılıyor, ilk vuruş 99–100 sn'de geliyor, 3★ penceresi ~2 birim.
  - Malazgirt'te baskın bir tarif var (O1). Kışkırtıcı + sabırsız kollar 30 tohumun 30'unda 3★ alıyor (~101 sn). Brifingin tarifi ise 1–2★ veriyor.
- **Mantık delikleri:**
  - Tohum 1071'de hiç dokunmayan oyuncu Malazgirt'i gece kazanıyor (MIMARI.md §8, 2f.1).
  - Hiç yol kesmeyen bot Miryokefalon'u kazanıyor.
  - Metehan'da boşta durulursa savaş bitmiyor.
- **Giriş kapısı dar:**
  - Acemi bot en kolay basamakta (0,5) Metehan'ı 30 denemede hiç kazanamıyor (O3). Alp Arslan'ın kilidi bu zafere bağlı.
  - Enerjinin nasıl dolduğu ilk 60 sn'de öğretilmiyor (O5, O7).
- **Sunumun en büyük boşluğu ses:**
  - Müzik dosyası yok; yalnız kodla üretilen uğultu ve kös var.
  - Anlatıcı sesi yok.
  - Yıldız, kilit açılışı, tarih kartı, mola ve açılış sessiz.
- **Görselde temel sağlam:** STIL.md, ACES, gün döngüsü, kamera yönetmeni ve kalite kademeleri yerinde. Ama:
  - Birimler yer tutucu: kutu ilkellerinden yapılmış, iskeletsiz.
  - Savaş dışında sahne donuk.
  - İmza an olan hilal vuruşu zayıf.
- **İnsanla ölçüm yok:** denge sayılarının hepsi botlardan (2f.3).

## 2. Daha mantıklı

1. **Pasif oyun kazanmasın.**
   - Gece zaferi yalnız bir hedef tutturulduysa gelsin; yoksa sonuç "geri çekildin" olsun.
   - Yol kesilmezse kol geçidi geçsin.
   - Metehan'da bekleyen oyuncunun üstüne düşman sonunda yüklensin.
   - Önce 2f.1 yapılmalı: S4, yani botlarda da enerji donması. Ayar ondan sonra yapılır.
   - *Etki yüksek · iş düşük.*
2. **Kışkırtmanın bir amacı olsun.** Bryennios'a göre ordugâhın önünde görünüp kaçan küçük Türk bölükleri Basilakes'i peşine çekti; Basilakes'in yolu kesildi ve esir alındı.
   - Oyunda karşılığı: yemle bir birliği kopar, kollarla pusuya düşür, komutanını esir al.
   - Baskın tarif (O1) ya riskli hâle gelsin ya da brifingde öğretilsin.
   - *Etki yüksek · iş orta · kaynak: doğrulandı.*
3. **NE ZAMAN eksenini beceriye çevir: sancak dönüşü.** Attaleiates'e göre akşam Romanos geri dönmek için sancağı çevirdi. Uzaktaki birlikler bunu bozgun sandı ve artçı çekildi. Tepedeki gözcüler de sultanı geri getirdi.
   - Oyunda sancağın dönüşü gün batımında görünür bir olay olsun ve kısa bir fırsat penceresi açsın.
   - Erken salan, düzeni bozulmamış hatta çarpsın; geç kalan, artçının toparlandığını görsün.
   - Bugün baskın tarifle 3★ gün batımından ~2 sn sonra geliyor; zamanlama hiç beceri istemiyor.
   - Andronikos Doukas'ın suçu yalnız düşman kaynaklarda geçiyor; oyunda hain ilan edilmesin.
   - *Etki yüksek · iş orta · kaynak: doğrulandı.*
4. **Miryokefalon'a kaynaklı iki karar (O2).** Choniates ve Manuel'in mektubuna göre:
   - Geçidi ordunun kendi araba ve kuşatma treni tıkadı.
   - Türkler tepeden ok attı ve kolun arkasını vurdu.
   - Rüzgârla kalkan toz savaş alanını geceye çevirdi.
   - Baldwin, Türklerin üstüne hücum ederken öldü.

   Oyundaki karşılıkları:
   - Arabalar darboğazda vurulursa tıkanma büyüsün.
   - Yamaçlardan arkayı vurmak ayrı bir karar olsun.
   - Toz kısa bir körlük penceresi açsın.
   - Baldwin hücumu önceden kırmızıyla bildirilen bir tehdit olsun.
   - YOLU KES oyun kuralı olarak kalır (T2).
   - *Etki yüksek · iş orta-yüksek · kaynak: çoğu doğrulandı.*
5. **Kurallar görünür olsun.**
   - Metehan'ın ilk 60 sn'sinde, sırası gelince açılan üç ipucu olsun (2e).
   - "Enerji neden dolmuyor?" sorusu sahnede okunsun: düşman düzeni gevşedikçe saflar gözle görülür biçimde açılsın.
   - *Etki yüksek · iş düşük.*
6. **Adil zorluk.**
   - Baideng'e bir kez ulaşan oradan başlayabilsin. Bugün yeniden başlamak oyuncuyu 1. dalgaya atıyor.
   - Alp Arslan'ın kilidi acemi için yumuşasın; örneğin 3. dalgaya ulaşmak yetsin.
   - Gizli zorluk basamağı skorları karşılaştırılamaz yapıyor. Günlük sefer ve paylaşımdan önce O4 kapanmalı.
   - *Etki yüksek · iş düşük.*
7. **Tarihle dürüstlük.**
   - "Hilal" düzeni adı okunan birincil kaynaklarda geçmiyor. Kaynaklar uzaktan ok, pusu, kuşatma ve sahte ricattan söz ediyor. "Hilal adı nereden?" başlıklı bir tarih notu kartı güven kazandırır.
   - Tarchaneiotes'in büyük bir birlikle Ahlat'a ayrılması olgu; niyeti tartışmalı. Brifing "sahadaki ordu neden eksik?" sorusunu niyet iddiası olmadan cevaplasın.
   - Yedek at ve ok ikmali Selçuklular için belgesiz. Mekanik olarak eklenirse "bozkır atlıları" diye anlatılsın.
   - *Etki orta · iş düşük.*

## 3. Daha eğlenceli

1. **Metehan'a ikinci fiil: ıslıklı ok.** Shiji 110'a göre Mete adamlarını ıslıklı okla eğitti: ok nereye giderse herkes oraya atacaktı.
   - Oyunda bölük, işaretlenen yere ok yağdırsın. Tek tuşluk savaşa "nereye" kararı eklenir.
   - Talimin karanlık sonu (baba) anlatılmasın; tema disiplin olsun.
   - *Etki yüksek · iş orta · kaynak: kısmen doğrulandı (tek ve üsluplu bir Han kaynağı).*
   - **Yapıldı (7 Ekim 2026):** yere dokun/tıkla → ok 0,6 sn uçar, 5 birimlik yağmur düşmanı 2 sn durdurur ve disiplinini 0,3 düşürür. Sayaç yok: her hilal vuruşu oku yeniler. Kural ve ayar tablosu `src/mechanics/whistle.ts`; orta bot 30 tohumda 8 → 17 zafer (peşindekilere atınca), hattın ortasına atınca fark yok.
2. **Baideng'in tarihî sonu bir seçim olsun: köşeyi aç.** Shiji 110 ve 56'ya göre:
   - Kuşatma yedi gün sürdü; atlar yöne göre renkliydi.
   - Han tarafı hatuna rüşvet verdi. Gecikmeli müttefiklerinden kuşkulanan Mete bir köşeyi açtı; Han askerleri yaylarını dışa gererek çıktı.

   Bugün savaş muhafızlar ölünce bitiyor. Doruğa "aç ya da sık" kararı konsun.
   - *Etki yüksek · iş orta · kaynak: doğrulandı (400 bin abartı; renkler kozmolojik olabilir).*
3. **Üç komutanın ortak sonu: durmayı bilmek.**
   - Mete köşeyi açtı.
   - Alp Arslan esir imparatora iyi davrandı.
   - Kılıçarslan üstünken barış önerdi. Choniates'e göre elçi Gabras şafakta antlaşmayı getirdi; Dorylaion ve Soublaion yıkılacaktı.

   Hikmet kartları (HIKAYE.md §7 adım 3–4) bunu zaferin ödülü yapsın.
   - *Etki yüksek · iş orta.*
4. **Savaş meclisi:** savaştan önce tek seçim, her seçenek kaynaklı. Malazgirt için üç seçenek:
   - Gece tacizi: ordu bozuk düzenle başlar.
   - Suyu tut: düşman çabuk yorulur.
   - Yem bölük: ilk kışkırtma bir komutanı esir alır.

   Kaynaklar Attaleiates ve Bryennios. Her deneme farklı başlar.
   - *Etki yüksek · iş orta · kaynak: doğrulandı.*
5. **Dönüm noktası tekrarı.**
   - Karnede savaşı belirleyen 5 sn sinematik açıyla ve ağır çekimde tekrar oynasın (MIMARI.md §7'deki karar tekrarı fikri).
   - Paylaşım kartı buradan çıksın.
   - *Etki yüksek · iş orta.*
6. **Günlük sefer (O8):** herkese aynı tohum.
   - Önkoşulları: sabit zaman adımı (S6) ve O4.
   - *Etki yüksek · iş orta.*
7. **Rütbe yolu:** on başı → yüz başı → bin başı → tümen başı.
   - Toplam yıldızla yükselinsin; tuğ ve sancak gibi görünüm ödülleri açılsın.
   - *Etki orta · iş orta · kaynak: Hun onluk düzeni ayrıca doğrulanmalı.*
8. **Her savaşın bir doruğu olsun:** müzik yükselir, bir an sessizlik olur, hilal kapanır.
   - Miryokefalon'un doruğu zayıf; toz fırtınası ile Manuel'in açığa çıkışı doruk olabilir.
   - *Etki orta · iş düşük-orta.*

## 4. Daha klas

1. **Ses ve müzik.**
   - Her komutana bir müzik motifi:
     - Metehan: bozkır tınısı (davul ve gırtlak sesi; tarih iddiası değil, atmosfer).
     - Selçuklular: kös ve boru.
   - Enerji yükseldikçe müziğe katman eklensin; hilal kapanmadan önce bir an sessizlik olsun.
   - Şu anlara kısa ses gelsin: tek tek yıldızlar, tarih kartı, kilit açılışı, mola, açılış.
   - Faz 27 adım 4: ağır çekim sesi.
   - Anlatıcı sesi HIKAYE.md §6a'daki planla gelsin.
   - D5: ses sürgüleri.
   - *Etki yüksek · iş orta.*
2. **Sahneleme.**
   - Açılışta bölüm kartı: "Malazgirt · 26 Ağustos 1071" (sinema şeritleri PR #26'da).
   - Kilit açılınca haritada yürüyüş ve sancak dikme.
   - Sonuç ekranı parça parça gelsin: başlık → tek tek yıldızlar → Aydoğdu → karne. Dokununca atlansın.
   - *Etki yüksek · iş orta.*
3. **Sade arayüz.**
   - Skor ikinci planda kalsın; ekrandaki büyük "0" gitsin.
   - Çubuklar ince ve fildişi-altın olsun.
   - Düzen ve enerji mümkün olduğunca sahnede okunsun.
   - 2c: tek fiil VUR, büyük harf Cinzel.
   - *Etki orta · iş düşük.*
4. **"Aynı savaş, iki anlatı" kartı.** Manuel'in mektubu Miryokefalon'u zafer diye, Choniates çaresizlik diye anlatıyor. Kart oyunu öğretmenler ve diaspora aileleri için ders malzemesine çevirir.
   - *Etki orta · iş düşük.*
5. **İnce ayar.**
   - Oyun içinde "hareketi azalt" anahtarı.
   - Ses sürgüleri (D5).
   - Mola ve sonuç ekranları diyalog olarak (A7, U8).
   - *Etki orta · iş düşük.*

## 5. Grafik

**Temel sağlam:** STIL.md'nin "önce değer" ilkesi, ACES, gün döngüsü, kamera yönetmeni, kalite kademeleri ve `art.spec` bekçisi yerinde.

**Kaliteyi düşüren üç şey:**
- Birimler kutu ilkellerinden yapılmış ve iskeletsiz. Dörtnal yalnız zıplama ve eğilme, ölüm de devrilip batma. Gerçek modeller Faz 28'de.
- Sahne savaş dışında donuk:
  - Açılışta JS ve shader'lar hazırlanana kadar ekran boş.
  - Menü, mola ve sonuç arka planı pil için donduruluyor.
  - Geçişler yalnız beliriş.
- Hilal vuruşu düz bir parlama dalgası ve kıvılcımdan ibaret.

**Hemen yapılabilir, ucuz:**
1. **Anında açılış ekranı.**
   - `index.html` içine satır içi hilal ve yazı konsun; arkada shader'lar önceden derlensin, böylece ilk vuruşta takılma olmaz.
   - #27'deki giriş ekranı JS yüklendikten sonra geliyor; bu madde ondan önceki boş saniyeleri kapatır.
   - *Etki yüksek · iş düşük.*
2. **Temas gölgesi ve kenar ışığı.**
   - Her birimin altında yumuşak koyu bir leke olsun; düşük kademede gerçek gölgenin yerini tutar.
   - Güneş yönünden kenar ışığı gelsin; gün batımında siluet parlar.
   - *Etki yüksek · iş düşük.*
3. **İsabet parlaması.** Vurulan birim 80 ms beyaza yanar. Kan yok ve öyle kalır.
   - *Etki orta · iş düşük.*
4. **Keskin gölge (V7, G5).** Gölge çerçevesi bugün orijine sabit ve ±35 birim (`DayCycle.tsx`). Kameraya bağlanan ±15'lik bir çerçeve aynı haritada ~2× keskin gölge verir; texel'e kenetlenirse titremez.
   - *Etki orta · iş düşük.*

**Orta iş:**

5. **Hilal vuruşunu sahne anına çevir.**
   - Yay boyunca zemine yanıp sönen altın bir hilal izi kalsın.
   - Toz ve çim içe savrulsun.
   - Düşenler devrilmek yerine geriye savrulsun.
   - Vuruş anındaki kısa duraklama ve yönlü sarsıntı zaten var; eksik olan görsel iz.
   - *Etki yüksek · iş orta.*
6. **Savaşa göre renk tonu (Faz 27 adım 5).** Doku dosyası olmadan, shader'da:
   - Metehan: kuru bozkır öğlesi.
   - Malazgirt: bakır akşam.
   - Miryokefalon: tozlu gri kanyon.
   - *Etki orta · iş düşük.*
7. **Sancak ve tuğ dalgalansın;** bozgunda sancak düşsün.
   - *Etki orta · iş düşük.*

**Büyük iş (Faz 28):**

8. **Önce hedef kare (paintover).**
   - R3 ve R5 karelerinin üstüne hedef görünüm boyansın; bu, model işinden önce gelir.
   - Bir konsept sanatçısıyla çalışılırsa sözleşmede kullanım hakları (Nutzungsrechte) net olsun.
   - *Etki yüksek · iş düşük-orta.*
9. **Gerçek atlı modeli.**
   - Oranlar abartılı olsun: 25–30 px'te ayrıntı değil, oran okunur.
   - Dörtnal, köşe animasyon dokusuna pişirilsin. Kalabalık tek bir instancedMesh içinde koşsun, her birim ayrı fazda.
   - Kalabalık birimi en fazla 300 üçgen olsun ve elle yapılsın. Yapay zekâ 3B üreticileri bu üçgen sayısında okunur siluet vermiyor; en fazla kahramanın LOD0'ı için başlangıç olabilirler.
   - *Etki yüksek · iş yüksek.*
10. **Ufukta 2–3 katman dağ silueti,** hava perspektifiyle.
    - *Etki orta · iş orta.*

**Cila:**

11. **Savaş izi.** Birimlerin geçtiği yerde çiğnenmiş çim kalsın (küçük, boyanan bir doku). Sonuç ekranında alan savaşın hikâyesini anlatır.
    - *Etki orta · iş orta.*
12. **Menüde hafif hareket.** Rüzgâr ve sancak düşük kare hızında ~20 sn oynasın, sonra dursun; pil kararı korunur.
    - *Etki orta · iş düşük.*
13. **Döneme göre süs.**
    - Ortak girih deseni (`hud.css`, `--girih`) MÖ 209 Hun brifinginde dönem dışı kalıyor. Hun için Noin-Ula keçelerinin hayvan üslubu, Selçuklu için yıldız-girih ve firuze çini daha uygun.
    - V8 (Cinzel'de i = ı) 2c ile kapanır.
    - *Etki orta · iş düşük.*

**Kısıtlar:**
- Üçgen bütçesi dolu: Metehan yüksek kademede 53,5k / 55k (STIL.md §10). Yeni geometri ancak LOD'la ya da başka yerden keserek gelir.
- JS bütçesinde ~37 kB pay var (348 / 385 kB, 2 Ekim). Çoğu madde mevcut efekt zincirine ve shader'lara eklenir; yeni kütüphane gerekmez.
- Gerçek telefonda kare hızı hiç ölçülmedi. Efekt eklemeden önce iki cihazda (orta sınıf Android ve eski bir iPhone) kare süresi tabanı alınmalı.

## 6. Önerilen sıra

1. Mantık 1, 5 ve 6. Çoğu zaten 2e ve 2f'de planlı; ucuz ve ilk oyun testinden önce şart.
2. Klas 1 (ses) ve Grafik 1–4.
3. Mantık 2–3: Malazgirt'te sancak dönüşü ve amaçlı kışkırtma.
4. Mantık 4: Miryokefalon'a iki karar.
5. Eğlence 1–3: ıslıklı ok, Baideng'de "köşeyi aç" ve hikmet kartları.
6. Eğlence 5–6: dönüm noktası tekrarı ve paylaşım kartı, ardından günlük sefer.
7. Eğlence 4 ve 7, Grafik 8–10: savaş meclisi, rütbe yolu, Faz 28 modelleri.

## 7. Ölçüm

Her adımdan önce ve sonra 5 kişiyle sesli düşünme testi yapılsın, iki telefonda. Savaş özeti telemetrisi hazır. Bakılacak beş sayı:
- Acemilerin ilk savaşı kazanma oranı. O3 hedefi en az %20.
- Yenilgiden sonra YENİDEN'e basma oranı.
- Üç savaşı da bitirme oranı.
- 3★ oranı. O1 hedefi en çok %70.
- Oyunun bırakıldığı dalga ya da saniye.

## 8. Yapmayalım

- Kaynakta olmayanı tarih diye yazmak:
  - "Boş Selçuklu ordugâhı" yalnız popüler anlatılarda geçiyor.
  - Andronikos Doukas kesin hain ilan edilmesin.
  - "Hilal" birincil kaynak terimi gibi sunulmasın.
- Kan, vahşet ya da Bizans'ı karikatürleştirmek. Merhamet çizgisi korunsun.
- Enerji sayacı, bekleme süresi, şans kutusu. Almanya'da USK bunları yaş sınırında hesaba katıyor.
- Fiil enflasyonu: her komutana en fazla bir yeni fiil, o da tek başına öğretilerek.

## 9. Kaynak hükümleri (5 Ekim 2026)

**Okunan birincil kaynaklar:**
- Shiji 110 ve 56.
- Attaleiates ve Bryennios (Bonn baskıları; sayfalar yaklaşık).
- Choniates (Yunanca).
- Manuel'in mektubu.

Strategikon XI.2 ikincil özetten alındı (Kardaras 2015). İkincil kaynaklar: Di Cosmo 2002, Vratimos 2020, Theotokis 2024, Hillenbrand 2007. Bazıları yalnız özet düzeyinde okundu.

| İddia | Hüküm | Kaynak | Not |
|---|---|---|---|
| Mete ıslıklı okla talim yaptırdı | Kısmen | Shiji 110 | Tek ve üsluplu bir Han kaynağı. Talim sırası: kendi atı, eşi, babasının atı, Touman |
| Hun atlıları utanmadan çekilir | Doğrulandı | Shiji 110 | Ölüyü geri getiren onun malını alır |
| Baideng: yedi gün, renkli atlar, açılan köşe | Doğrulandı | Shiji 110, 56 | 400 bin abartı; renkler kozmolojik olabilir |
| Malazgirt sabahı barış önerisi reddedildi | Doğrulandı | Attaleiates | Şubat 1071 elçiliğiyle karıştırılmasın |
| Tarchaneiotes Ahlat'a ayrıldı | Olgu doğru, niyet tartışmalı | Bryennios I.14, Attaleiates | Roussel yalnız Attaleiates'te geçer |
| Akşam sancak dönüşü yanlış okundu, artçı çekildi | Doğrulandı | Attaleiates, Bryennios | Doukas'ın suçu düşman kaynaklarda. "Boş Selçuklu ordugâhı" kaynakta yok |
| Miryokefalon: araba treni, tepeden ok, toz, Baldwin, Gabras | Çoğu doğrulandı | Choniates, Manuel'in mektubu | Kaçma düşüncesi yalnız Choniates'te; mektup zafer diyor |
| "Hilal" düzeni | Okunan kaynaklarda yok | — | Modern anlatılar (Norwich, Nicolle). Kanatla kuşatma daha çok Moğol tulughma'sı |
| Yem bölük, sahte ricat, kuşatma, gece tacizi | Doğrulandı | Bryennios I.14 ve I.17, Attaleiates, Strategikon XI.2 | |
| Yedek at, ok ikmali | Selçuklu için belgesiz | Strategikon XI.2 (at sürüleri), Carpini (Moğollar) | Genel bozkır pratiği olarak anlatılsın |
| Hun onluk düzeni (on başı → tümen başı) | Doğrulanmadı | — | Rütbe yolundan önce doğrulanmalı |
