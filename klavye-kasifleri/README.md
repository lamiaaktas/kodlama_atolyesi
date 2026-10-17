# Klavye Kâşifleri

4. sınıflar için Türkçe Q on parmak klavye kursu. Google Apps Script üzerinde çalışır; Kodlama Atölyesi, Dijital Kale ve Siber Adalar'dan ayrı bir Apps Script projesidir.

54 bölüm, 4 ünite:

- **Orta Sıra Ovası** – a s d f g h j k l ş i ve boşluk
- **Üst Sıra Dağları** – q w e r t y u ı o p ğ ü
- **Alt Sıra Kıyısı** – z x c v b n m ö ç .
- **Büyük Harf Kalesi** – sol/sağ Shift, virgül ve cümleler

Bölüm türleri: animasyonlu anlatım (Türkçe sesli ve altyazılı), yeni tuş tanıtımı, tekrar, 1 dakikalık alıştırma, hız testi ve 2-3 bölümde bir oyun (**Balon Yolu**, **Yağmur**). Ekrandaki klavyede sıradaki tuş ve onu basacak parmak gösterilir. Öğrenciler yıldız ve rozet kazanır; bir bölüm bitmeden sonraki açılmaz.

Öğretmen paneli (PIN ile): sınıf sınıf her öğrencinin bitirdiği bölüm, yıldız, en iyi ve son hızı (kelime/dakika), doğruluğu, hız gelişim grafiği ve en çok zorlandığı tuşlar. Her bitirilen bölüm E-Tablodaki "Denemeler" sayfasına da bir satır olarak yazılır.

- `Index.html` – sitenin ekranı. Apps Script bu dosyayı buradan okur; buraya gönderilen her güncelleme en geç 5 dakikada siteye yansır.
- `Code.gs` – Apps Script'teki sunucu kodunun kopyası. İlerlemelerin tutulduğu Google E-Tablo'nun Apps Script'ine yapıştırılır; kurulum adımları dosyanın başında.

Öğrenciler hesap açmadan sınıf kodunu girip listeden adlarını seçer. Sınıf listeleri, öğretmen PIN'i ve öğrenci ilerlemeleri bu depoda değil, öğretmenin Google Drive'ındaki E-Tablo'da tutulur. Sayfa Apps Script dışında açılırsa deneme modunda çalışır (sınıf kodu DEMO, öğretmen PIN'i 1234) ve ilerleme yalnızca o cihazda saklanır.

Tabletlerde klavye dili **Türkçe Q** olmalı; değilse site yazarken uyarır.
