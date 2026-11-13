# Okuma Günlüğüm

Öğrencilerin bireysel kitap okumalarını takip eden uygulama. Google Apps Script üzerinde çalışır; Kodlama Atölyesi ve diğer uygulamalardan ayrı bir Apps Script projesidir.

- Öğrenci sınıfını ve adını seçer, iki meyve-sebze resminden oluşan şifresiyle girer.
- Her gün kitap adını, kaç sayfa okuduğunu ve ne anladığını yazar. Daha önce girdiği kitaplar dokunarak seçilir; biten kitap "bitirdim" diye işaretlenir ve bir daha seçenek olarak çıkmaz. Okudukça kitap kurdu uzar.
- Bir gün 15 sayfa ve üzeri okuyan öğrenci ertesi gün ilk girişinde öğretmeninden tebrik mesajı ve konfetiyle karşılanır.
- Öğretmen paneli: günlük ve haftalık görünüm, öğrenci bazlı grafik, sınıf listeleri ve şifre kartları.

## Dosyalar

- `Index.html` – uygulamanın ekranı. Apps Script bu dosyayı buradan okur; buraya gönderilen her güncelleme en geç 5 dakikada siteye yansır.
- `Code.gs` – Apps Script'teki sunucu kodunun kopyası.

Öğrenci listeleri ve okuma kayıtları bu depoda değil, öğretmenin Google Drive'ındaki "Okuma Günlüğü — Veriler" e-tablosunda tutulur. Öğretmen şifresi yalnızca Apps Script ayarlarında saklanır.

Hız için sınıf listeleri ve okumalar Apps Script önbelleğinde tutulur. E-tabloda elle değişiklik yaparsanız Apps Script'te `onbellegiTemizle` işlevini bir kez çalıştırın.
