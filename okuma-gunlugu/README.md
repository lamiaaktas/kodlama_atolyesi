# Okuma Günlüğüm

Öğrencilerin bireysel kitap okumalarını takip eden uygulama.

- Öğrenci sınıf kodunu yazar (tablet hatırlar), adını seçer, iki meyve-sebze resminden oluşan şifresiyle girer.
- Her gün kitap adını, kaç sayfa okuduğunu ve ne anladığını yazar. Daha önce girdiği kitaplar dokunarak seçilir; biten kitap işaretlenir ve süslü tek bir boğuma dönüşür. Okudukça kitap kurdu uzar, okumadığı günlerde enerjisi azalır.
- Bir gün 15 sayfa ve üzeri okuyan öğrenci ertesi gün öğretmeninden tebrik mesajı ve konfetiyle karşılanır.
- Öğretmen paneli (okul Google hesabıyla giriş): günlük ve haftalık görünüm, öğrenci bazlı grafik, sınıf listeleri, sınıf kodları ve şifre kartları.
- Yönetici paneli: öğretmen ekleme/çıkarma, sınıfları öğretmene devretme, okul geneli 7 günlük özet.

## Yapı (yeni sistem)

| Parça | Nerede |
|---|---|
| Site (öğrenci ve öğretmen ekranları) | Firebase Hosting — `web/index.html` |
| Veritabanı | Cloud Firestore — erişim `web/firestore.rules` ile sınırlı |
| Giriş | Firebase Authentication — öğrenciler meyve şifresi, öğretmenler Google |
| Yönetim köprüsü | Google Apps Script — `Firebase.gs` (öğrenci hesabı açma, yayınlama, taşıma) |

`web/` klasörüne gönderilen her değişiklik, Apps Script köprüsü tarafından en geç 5 dakikada Firebase'e yayınlanır.

## Eski sistem

`Index.html` ve `Code.gs` eski (yalnızca Apps Script + Google E-Tablo) sürümdür. `eskiVerileriTasi` ile veriler yeni sisteme taşınır; `eskiAdresiYonlendir` çalıştırıldıktan sonra eski adres yeni adrese yönlendirir.

Öğrenci adları, şifreleri ve okuma kayıtları bu depoda değil, okulun Firebase projesindeki veritabanında tutulur.
