# Siber Adalar

3. sınıflar için 2. Ünite dijital vatandaşlık oyunu: karakterini oluşturup dört adayı dolaşan 3B bir platform oyunu. Google Apps Script üzerinde çalışır; Kodlama Atölyesi ve Dijital Kale'den ayrı bir Apps Script projesidir.

- **Sır Vadisi** – kişisel bilgiler: bilgi kartlarını topla, "Paylaşılabilir" ya da "Bana özel" diye ayır, Bilgi Kapanlara kaptırma.
- **Dostluk Adası** – siber zorbalık: zorba bulutlarının mesajlarını görmezden gel, kanıtları sakla, güvendiğin yetişkine söyle, üzgün arkadaşlarını mutlu et.
- **Keşif Kulesi** – internette arama: her katın görevine uygun anahtar kelime basamağına zıpla; gereksiz kelimeler çöker.
- **Olta Koyu** – benimle konuşan kim?: mesaj atan karakterlere doğru aracı seç (soru sor / bir yetişkine danış); bilgini paylaşırsan olta seni yakalar.

Her adada kapı soruları ve sonunda çıkış kartı var; dört ada bitince isimli sertifika açılır.

- `Index.html` – oyunun ekranı. Apps Script bu dosyayı buradan okur; buraya gönderilen her güncelleme en geç 5 dakikada oyuna yansır.
- `Code.gs` – Apps Script'teki sunucu kodunun kopyası. İlerlemelerin tutulduğu Google E-Tablo'nun Apps Script'ine yapıştırılır; kurulum adımları dosyanın başında.

Öğrenciler hesap açmadan sınıf kodunu girip listeden adlarını seçer. Sınıf listeleri, öğretmen PIN'i ve öğrenci ilerlemeleri bu depoda değil, öğretmenin Google Drive'ındaki E-Tablo'da tutulur. Sayfa Apps Script dışında açılırsa deneme modunda çalışır ve ilerleme yalnızca o cihazda saklanır.

3B çizim: [three.js](https://threejs.org) r128 (MIT lisansı).
