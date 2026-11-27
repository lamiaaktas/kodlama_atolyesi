/******************************************************
 *  OKUMA GÜNLÜĞÜM — Firebase yönetim köprüsü
 *
 *  Yeni sistemde öğrenci ve öğretmen ekranları Firebase'de çalışır (kısa adres, hızlı
 *  veritabanı, güvenlik kuralları). Bu dosya, sizin Google hesabınızın yetkisiyle yalnızca
 *  yönetim işlerini yapar:
 *   - öğrenci hesaplarını açar, şifrelerini değiştirir, siler
 *   - sınıf ve öğretmen ekler, siler, devreder
 *   - sitenin ekranını ve güvenlik kurallarını GitHub'dan alıp Firebase'e yayınlar
 *   - eski e-tablodaki verileri yeni sisteme taşır
 *
 *  Kurulum: aşağıya Firebase proje kimliğinizi yazın, sonra "firebaseKurulum" işlevini çalıştırın.
 ******************************************************/

/** Firebase konsolundaki proje kimliği (Proje ayarları → Proje kimliği). Örn: 'okuma-gunlugum' */
const FIREBASE_PROJE = '';

/** Bu Apps Script projesinin web uygulaması adresi (Dağıt → Dağıtımları yönet → Web uygulaması URL'si, /exec ile biter). */
const KOPRU_ADRESI = '';

/** Okulun alan adı altındaki adres hazır olunca yazın (bilgi işlem ayarladıktan sonra). Örn: 'okuma.okulunuz.k12.tr' */
const OZEL_ALAN_ADI = '';

const FB_GITHUB = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/okuma-gunlugu/web/';
const OGR_EPOSTA_SONU = '@ogrenci.example.com';  // öğrenci hesapları için iç adres; e-posta gönderilmez
/** Şifreler: kolay okunan bir kelime + iki rakam (örn. kedi47). Türkçe harf yok, her klavyede yazılır. */
const KELIMELER = ['elma', 'armut', 'kiraz', 'karpuz', 'limon', 'kivi', 'mango', 'ayva', 'erik', 'incir',
  'kedi', 'balina', 'zebra', 'panda', 'aslan', 'kaplan', 'tilki', 'kartal', 'yunus', 'penguen',
  'bulut', 'deniz', 'orman', 'nehir', 'kitap', 'kalem', 'defter', 'roket', 'gemi', 'tren', 'araba', 'fener'];
const KULLANICI_KALIBI = /^[a-z0-9._-]{3,20}$/;

/* ================= kurulum ve yayın ================= */

/** Bir kez çalıştırın. Firebase'i hazırlar, sizi yönetici yapar, siteyi yayınlar. */
function firebaseKurulum() {
  fbProjeKontrol_();
  const props = PropertiesService.getScriptProperties();

  authKontrol_();
  const ayar = fbWebAyari_();
  props.setProperty('FB_AYAR', JSON.stringify(ayar));
  Logger.log('Firebase uygulama ayarı alındı.');

  const site = fbSite_();
  props.setProperty('FB_SITE', site);

  let kopru = KOPRU_ADRESI.trim();
  if (!kopru) { try { kopru = ScriptApp.getService().getUrl() || ''; } catch (e) { kopru = ''; } }
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(kopru)) {
    throw new Error('Firebase.gs dosyasının başındaki KOPRU_ADRESI satırına bu projenin web uygulaması adresini (/exec ile biten) yapıştırın.');
  }
  props.setProperty('KOPRU_URL', kopru);

  const ben = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!fsAl_('yoneticiler/' + ben)) fsYaz_([fsKoy_('yoneticiler/' + ben, { eklenme: new Date() })]);
  if (!fsAl_('ogretmenler/' + ben)) fsYaz_([fsKoy_('ogretmenler/' + ben, { ad: '', imza: '', eklenme: new Date() })]);
  Logger.log('Yönetici: ' + ben);

  props.deleteProperty('FB_KURAL_OZET');
  props.deleteProperty('FB_SAYFA_OZET');
  firebaseYayinKontrol();

  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'firebaseYayinKontrol') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('firebaseYayinKontrol').timeBased().everyMinutes(5).create();

  Logger.log('Hazır! Yeni adres: ' + fbAdres_());
  Logger.log('Sıradaki adım: eski verileri taşımak için "eskiVerileriTasi" işlevini çalıştırın.');
}

/** 5 dakikada bir çalışır: GitHub'daki ekran ya da kurallar değiştiyse Firebase'e yayınlar. */
function firebaseYayinKontrol() {
  if (!FIREBASE_PROJE) return;
  const props = PropertiesService.getScriptProperties();
  const kural = hamDosya_('firestore.rules');
  if (kural) {
    const ozet = ozet_(kural);
    if (props.getProperty('FB_KURAL_OZET') !== ozet) {
      kurallariYayinla_(kural);
      props.setProperty('FB_KURAL_OZET', ozet);
      Logger.log('Güvenlik kuralları yayınlandı.');
    }
  }
  const sayfa = hamDosya_('index.html');
  if (sayfa && sayfa.indexOf('Okuma Günlüğüm') >= 0) {
    const ayar = JSON.stringify({ firebase: JSON.parse(props.getProperty('FB_AYAR')), kopru: props.getProperty('KOPRU_URL') });
    const ozet = ozet_(sayfa + ayar);
    if (props.getProperty('FB_SAYFA_OZET') !== ozet) {
      const html = sayfa.replace('/*ON_AYAR*/', 'window.ON_AYAR=' + ayar.replace(/</g, '\\u003c') + ';');
      siteyiYayinla_(html);
      props.setProperty('FB_SAYFA_OZET', ozet);
      Logger.log('Site yayınlandı: ' + fbAdres_());
    }
  }
}

/** Yeni sürümü 5 dakika beklemeden yayınlamak için çalıştırın. */
function firebaseSimdiYayinla() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('FB_KURAL_OZET');
  props.deleteProperty('FB_SAYFA_OZET');
  firebaseYayinKontrol();
}

/** Taşıma bittikten ve yeni site denendikten sonra çalıştırın: eski adres yeni adrese yönlendirir. */
function eskiAdresiYonlendir() {
  PropertiesService.getScriptProperties().setProperty('YENI_ADRES', fbAdres_());
  Logger.log('Eski adres artık şuraya yönlendiriyor: ' + fbAdres_());
}

/** Yönlendirmeyi geri almak için. */
function eskiAdresiGeriAc() {
  PropertiesService.getScriptProperties().deleteProperty('YENI_ADRES');
}

function fbAdres_() {
  if (OZEL_ALAN_ADI) return 'https://' + OZEL_ALAN_ADI.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const site = PropertiesService.getScriptProperties().getProperty('FB_SITE') || FIREBASE_PROJE;
  return 'https://' + site + '.web.app';
}

function yonlendirmeSayfasi_(adres) {
  const a = String(adres).replace(/[<>"']/g, '');
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font:20px/1.5 system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:24px;text-align:center">' +
    '<h1 style="font-size:28px">Okuma Günlüğüm taşındı</h1>' +
    '<p>Yeni adresimiz:</p><p style="font-size:24px;font-weight:800">' + a.replace('https://', '') + '</p>' +
    '<p><a href="' + a + '" target="_top" style="display:inline-block;background:#f27a24;color:#fff;padding:14px 28px;border-radius:16px;text-decoration:none;font-weight:800">Yeni adrese git</a></p>' +
    '<p style="font-size:15px;color:#666">Tabletinizdeki kısayolu yeni adresle değiştirmeyi unutmayın.</p></div>' +
    '<script>try{window.top.location.href=' + JSON.stringify(a) + '}catch(e){}</script>';
  return HtmlService.createHtmlOutput(html).setTitle('Okuma Günlüğüm taşındı')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ================= öğretmen ekranından gelen istekler ================= */

function doPost(e) {
  let cevap;
  try {
    const g = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const islem = ISLEMLER[g.islem];
    if (!islem) throw new Error('Bilinmeyen işlem.');
    const kim = kimlikDogrula_(g.idToken);
    cevap = Object.assign({ ok: true }, kilit_(() => islem(kim, g)) || {});
  } catch (err) {
    cevap = { ok: false, hata: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(cevap)).setMimeType(ContentService.MimeType.JSON);
}

const ISLEMLER = {
  ogrenciEkle: (kim, g) => {
    const ad = nfc_(g.sinif).slice(0, 30);
    if (!ad) throw new Error('Sınıf adı boş olamaz.');
    const adlar = String(g.adlar || '').split(/\r?\n/).map(x => nfc_(x).replace(/^\d+[.)-]?\s*/, '')).filter(Boolean);
    if (!adlar.length) throw new Error('En az bir öğrenci adı yazın.');
    if (adlar.length > 60) throw new Error('Bir seferde en fazla 60 öğrenci eklenebilir.');
    let sinif = sinifBul_(ad);
    if (sinif) yetki_(kim, sinif);
    else sinif = sinifOlustur_(ad, kim.eposta);
    const eklenen = ogrencileriEkle_(sinif, adlar);
    return { eklenen: eklenen.length };
  },

  ogrenciCikar: (kim, g) => {
    const o = fsAl_('ogrenciler/' + kimlikTemizle_(g.id));
    if (!o) throw new Error('Öğrenci bulunamadı.');
    const sinif = fsAl_('siniflar/' + o.sinifId);
    if (sinif) yetki_(kim, sinif); else if (!kim.yonetici) throw new Error('Bu işlem için yetkiniz yok.');
    authSil_([o._id]);
    const yazilar = [fsSil_('ogrenciler/' + o._id)];
    if (sinif) {
      sinif.ogrenciler = (sinif.ogrenciler || []).filter(x => x.id !== o._id);
      yazilar.push.apply(yazilar, sinifListesiYaz_(sinif));
    }
    fsYaz_(yazilar);
  },

  sifreYenile: (kim, g) => {
    const o = fsAl_('ogrenciler/' + kimlikTemizle_(g.id));
    if (!o) throw new Error('Öğrenci bulunamadı.');
    const sinif = fsAl_('siniflar/' + o.sinifId);
    if (!sinif) throw new Error('Sınıf bulunamadı.');
    yetki_(kim, sinif);
    const sifre = sifreUret_();
    authGuncelle_(o._id, sifre);
    sinif.ogrenciler.forEach(x => { if (x.id === o._id) x.sifre = sifre; });
    fsYaz_(sinifListesiYaz_(sinif));
  },

  sinifAdDegistir: (kim, g) => {
    const sinif = sinifBul_(nfc_(g.eski));
    if (!sinif) throw new Error('Sınıf bulunamadı.');
    yetki_(kim, sinif);
    const yeni = nfc_(g.yeni).slice(0, 30);
    if (!yeni) throw new Error('Yeni sınıf adı boş olamaz.');
    if (yeni !== sinif.ad && sinifBul_(yeni)) throw new Error('"' + yeni + '" adında bir sınıf zaten var.');
    sinif.ad = yeni;
    const yazilar = sinifListesiYaz_(sinif);
    (sinif.ogrenciler || []).forEach(x => yazilar.push(fsGuncelle_('ogrenciler/' + x.id, { sinif: yeni })));
    fsYaz_(yazilar);
  },

  sinifSil: (kim, g) => {
    const sinif = sinifBul_(nfc_(g.sinif));
    if (!sinif) throw new Error('Sınıf bulunamadı.');
    yetki_(kim, sinif);
    const ids = (sinif.ogrenciler || []).map(x => x.id);
    if (ids.length) authSil_(ids);
    const yazilar = ids.map(id => fsSil_('ogrenciler/' + id));
    if (sinif.kod) yazilar.push(fsSil_('kodlar/' + sinif.kod));  // eski sürümden kalan kod belgesi
    yazilar.push(fsSil_('siniflar/' + sinif._id));
    fsYaz_(yazilar);
  },

  kullaniciDegistir: (kim, g) => {
    const o = fsAl_('ogrenciler/' + kimlikTemizle_(g.id));
    if (!o) throw new Error('Öğrenci bulunamadı.');
    const sinif = fsAl_('siniflar/' + o.sinifId);
    if (!sinif) throw new Error('Sınıf bulunamadı.');
    yetki_(kim, sinif);
    const yeni = girisMetni_(g.kullanici);
    if (!KULLANICI_KALIBI.test(yeni)) throw new Error('Kullanıcı adı 3-20 karakter olmalı; yalnızca harf, rakam, nokta, tire kullanın.');
    if (yeni === o.kullanici) return { kullanici: yeni };
    if (tumKullanicilar_().has(yeni)) throw new Error('"' + yeni + '" kullanıcı adı okulda başka bir öğrencide var.');
    authGuncelle_(o._id, null, yeni);
    sinif.ogrenciler.forEach(x => { if (x.id === o._id) x.kullanici = yeni; });
    const yazilar = sinifListesiYaz_(sinif);
    yazilar.push(fsGuncelle_('ogrenciler/' + o._id, { kullanici: yeni }));
    fsYaz_(yazilar);
    return { kullanici: yeni };
  },

  imzaKaydet: (kim, g) => {
    const imza = nfc_(g.imza).slice(0, 40);
    const og = fsAl_('ogretmenler/' + kim.eposta) || {};
    const yazilar = [fsKoy_('ogretmenler/' + kim.eposta, { ad: og.ad || '', imza: imza, eklenme: og.eklenme || new Date() })];
    fsSorgu_('siniflar', 'ogretmen', kim.eposta).forEach(s => {
      yazilar.push(fsGuncelle_('siniflar/' + s._id, { imza: imza }));
      (s.ogrenciler || []).forEach(x => yazilar.push(fsGuncelle_('ogrenciler/' + x.id, { imza: imza })));
    });
    fsYaz_(yazilar);
  },

  // ---- yalnızca yönetici ----
  ogretmenEkle: (kim, g) => {
    yoneticiMi_(kim);
    const ep = String(g.eposta || '').trim().toLowerCase();
    if (!/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(ep)) throw new Error('Geçerli bir e-posta adresi yazın.');
    if (ep.endsWith(OGR_EPOSTA_SONU)) throw new Error('Bu adres kullanılamaz.');
    const var_ = fsAl_('ogretmenler/' + ep);
    fsYaz_([fsKoy_('ogretmenler/' + ep, { ad: nfc_(g.ad).slice(0, 60), imza: var_ ? var_.imza || '' : '', eklenme: var_ ? var_.eklenme || new Date() : new Date() })]);
  },

  ogretmenSil: (kim, g) => {
    yoneticiMi_(kim);
    const ep = String(g.eposta || '').trim().toLowerCase();
    if (ep === kim.eposta) throw new Error('Kendinizi silemezsiniz.');
    if (fsSorgu_('siniflar', 'ogretmen', ep).length) throw new Error('Bu öğretmenin sınıfları var. Önce sınıfları başka bir öğretmene devredin.');
    fsYaz_([fsSil_('ogretmenler/' + ep)]);
  },

  sinifDevret: (kim, g) => {
    yoneticiMi_(kim);
    const sinif = sinifBul_(nfc_(g.sinif));
    if (!sinif) throw new Error('Sınıf bulunamadı.');
    const ep = String(g.eposta || '').trim().toLowerCase();
    const og = fsAl_('ogretmenler/' + ep);
    if (!og) throw new Error('Bu öğretmen kayıtlı değil.');
    sinif.ogretmen = ep;
    sinif.imza = og.imza || '';
    const yazilar = sinifListesiYaz_(sinif);
    (sinif.ogrenciler || []).forEach(x => yazilar.push(fsGuncelle_('ogrenciler/' + x.id, { ogretmen: ep, imza: sinif.imza })));
    fsYaz_(yazilar);
  }
};

function kimlikDogrula_(idToken) {
  if (!idToken) throw new Error('Oturum bulunamadı. Yeniden giriş yapın.');
  const ayar = JSON.parse(PropertiesService.getScriptProperties().getProperty('FB_AYAR') || '{}');
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(ayar.apiKey), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  const j = JSON.parse(r.getContentText() || '{}');
  const u = j.users && j.users[0];
  if (r.getResponseCode() !== 200 || !u) throw new Error('Oturumun süresi dolmuş. Çıkış yapıp yeniden giriş yapın.');
  const eposta = String(u.email || '').toLowerCase();
  if (!eposta || !u.emailVerified || eposta.endsWith(OGR_EPOSTA_SONU)) throw new Error('Bu işlem için yetkiniz yok.');
  const yonetici = !!fsAl_('yoneticiler/' + eposta);
  const ogretmen = !!fsAl_('ogretmenler/' + eposta);
  if (!yonetici && !ogretmen) throw new Error('Bu hesap öğretmen olarak kayıtlı değil.');
  return { eposta: eposta, yonetici: yonetici, ogretmen: ogretmen };
}

function yetki_(kim, sinif) {
  if (!kim.yonetici && sinif.ogretmen !== kim.eposta) throw new Error('Bu sınıf için yetkiniz yok.');
}
function yoneticiMi_(kim) {
  if (!kim.yonetici) throw new Error('Bu işlemi yalnızca yönetici yapabilir.');
}
function kimlikTemizle_(id) {
  const s = String(id || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(s)) throw new Error('Geçersiz öğrenci.');
  return s;
}

/* ================= sınıf ve öğrenci yardımcıları ================= */

function sinifBul_(ad) {
  const s = fsSorgu_('siniflar', 'ad', ad);
  return s.length ? s[0] : null;
}

/** Bir koleksiyondaki tüm belgeler (sayfa sayfa). */
function fsListe_(koleksiyon) {
  const sonuc = [];
  let jeton = '';
  do {
    const r = gIstek_('get', fsTaban_() + '/' + koleksiyon + '?pageSize=300' + (jeton ? '&pageToken=' + encodeURIComponent(jeton) : '')) || {};
    (r.documents || []).forEach(d => { const o = fsNesne_(d.fields || {}); o._id = d.name.split('/').pop(); sonuc.push(o); });
    jeton = r.nextPageToken || '';
  } while (jeton);
  return sonuc;
}

/** Okuldaki tüm kullanıcı adları. */
function tumKullanicilar_() {
  const set = new Set();
  fsListe_('siniflar').forEach(s => (s.ogrenciler || []).forEach(x => { if (x.kullanici) set.add(x.kullanici); }));
  return set;
}

/** Türkçe harfleri sadeleştirir, küçültür; yalnızca a-z 0-9 . _ - bırakır. */
function girisMetni_(v) {
  const tr = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'Ö': 'o', 'Ş': 's', 'Ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  return String(v || '').normalize('NFC').replace(/[çğıİöşüÇĞÖŞÜâîû]/g, c => tr[c]).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]/g, '');
}

/** Ad + soyadın ilk harfi (örn. "Defne Kaya" → defnek). Kullanılmışsa sonuna rakam ekler. */
function kullaniciUret_(ad, kullanilan) {
  const parca = String(ad || '').trim().split(/\s+/).map(girisMetni_).filter(Boolean);
  let kok = (parca[0] || 'ogrenci').slice(0, 14);
  if (parca.length > 1) kok += parca[parca.length - 1].charAt(0);
  while (kok.length < 3) kok += 'x';
  let aday = kok;
  for (let i = 2; kullanilan.has(aday); i++) aday = kok + i;
  kullanilan.add(aday);
  return aday;
}

function sifreUret_() {
  return KELIMELER[Math.floor(Math.random() * KELIMELER.length)] + (10 + Math.floor(Math.random() * 90));
}

function yeniKimlik_() {
  const h = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += h.charAt(Math.floor(Math.random() * h.length));
  return s;
}

function sinifOlustur_(ad, ogretmenEposta) {
  const og = fsAl_('ogretmenler/' + ogretmenEposta) || {};
  return { _id: yeniKimlik_(), ad: ad, ogretmen: ogretmenEposta, imza: og.imza || '', ogrenciler: [], olusturma: new Date() };
}

/** Sınıf belgesini (öğrenci listesi, kullanıcı adları ve şifrelerle) yazar. */
function sinifListesiYaz_(sinif) {
  const liste = (sinif.ogrenciler || []).slice().sort((a, b) => trSirala_(a.ad, b.ad))
    .map(x => ({ id: x.id, ad: x.ad, kullanici: x.kullanici || '', sifre: x.sifre || '' }));
  sinif.ogrenciler = liste;
  return [
    fsKoy_('siniflar/' + sinif._id, { ad: sinif.ad, ogretmen: sinif.ogretmen, imza: sinif.imza || '', ogrenciler: liste, olusturma: sinif.olusturma || new Date() })
  ];
}

/** Yeni adları sınıfa ekler; aynı adlı öğrenci varsa atlar. Eklenenleri döndürür. */
function ogrencileriEkle_(sinif, adlar, eskiKayitlar) {
  sinif.ogrenciler = sinif.ogrenciler || [];
  const adSet = new Set(sinif.ogrenciler.map(x => x.ad.toLocaleLowerCase('tr')));
  const kullanilan = tumKullanicilar_();
  const eklenen = [];
  adlar.forEach(ad => {
    ad = ad.slice(0, 60);
    const k = ad.toLocaleLowerCase('tr');
    if (adSet.has(k)) return;
    adSet.add(k);
    eklenen.push({ id: yeniKimlik_(), ad: ad, kullanici: kullaniciUret_(ad, kullanilan), sifre: sifreUret_() });
  });
  eklenen.forEach(o => authOlustur_(o.id, o.kullanici, o.sifre, o.ad));
  sinif.ogrenciler = sinif.ogrenciler.concat(eklenen);
  const yazilar = sinifListesiYaz_(sinif);
  eklenen.forEach(o => yazilar.push(fsKoy_('ogrenciler/' + o.id,
    { ad: o.ad, kullanici: o.kullanici, sinifId: sinif._id, sinif: sinif.ad, ogretmen: sinif.ogretmen, imza: sinif.imza || '', okumalar: {}, tebrik: '' })));
  fsYaz_(yazilar);
  return eklenen;
}

/* ================= eski verileri taşıma ================= */

/**
 * Eski e-tablodaki sınıfları, öğrencileri ve tüm okuma kayıtlarını yeni sisteme taşır.
 * Her öğrenciye kullanıcı adı ve yeni şifre verilir (öğretmen panelindeki "Giriş kartları"ndan yazdırılır).
 * Tekrar çalıştırılırsa zaten taşınmış öğrencileri atlar. Taşınan sınıflar sizin adınıza açılır;
 * sonra yönetici panelinden öğretmenlere devredebilirsiniz.
 */
function eskiVerileriTasi() {
  fbProjeKontrol_();
  authKontrol_();
  const ben = Session.getEffectiveUser().getEmail().toLowerCase();
  const eskiOgr = ogrenciler_();
  const eskiOku = okumalar_();
  const props = PropertiesService.getScriptProperties();
  const tasinan = new Set(JSON.parse(props.getProperty('FB_TASINAN') || '[]')); // taşınmış eski kimlikler
  const kullanilan = tumKullanicilar_();
  const sinifAdlari = [...new Set(eskiOgr.map(s => s.sinif))].sort(trSirala_);
  let toplamOgr = 0, toplamOku = 0;
  sinifAdlari.forEach(sinifAd => {
    let sinif = sinifBul_(sinifAd) || sinifOlustur_(sinifAd, ben);
    sinif.ogrenciler = sinif.ogrenciler || [];
    const yazilar = [];
    eskiOgr.filter(s => s.sinif === sinifAd).forEach(s => {
      if (tasinan.has(s.id)) return;
      const id = kimlikTemizle_(s.id.replace(/[^A-Za-z0-9_-]/g, '') || yeniKimlik_());
      const kullanici = kullaniciUret_(s.ad, kullanilan);
      const sifre = sifreUret_();
      authOlustur_(id, kullanici, sifre, s.ad);
      const okumalar = {};
      eskiOku.filter(r => r.ogrenciId === s.id && r.sayfa > 0).forEach(r => {
        okumalar[r.tarih] = { s: Math.min(1000, Math.max(1, Math.round(r.sayfa))), k: (r.kitap || '?').slice(0, 120),
          a: (r.anl || '').slice(0, 2000), b: !!r.bitti };
        toplamOku++;
      });
      sinif.ogrenciler.push({ id: id, ad: s.ad, kullanici: kullanici, sifre: sifre });
      yazilar.push(fsKoy_('ogrenciler/' + id, { ad: s.ad, kullanici: kullanici, sinifId: sinif._id, sinif: sinif.ad, ogretmen: sinif.ogretmen,
        imza: sinif.imza || '', okumalar: okumalar, tebrik: '' }));
      tasinan.add(s.id);
      toplamOgr++;
    });
    yazilar.push.apply(yazilar, sinifListesiYaz_(sinif));
    for (let i = 0; i < yazilar.length; i += 200) fsYaz_(yazilar.slice(i, i + 200));
    props.setProperty('FB_TASINAN', JSON.stringify([...tasinan]));
    Logger.log(sinif.ad + ' sınıfı taşındı (' + sinif.ogrenciler.length + ' öğrenci).');
  });
  Logger.log('Bitti: ' + toplamOgr + ' öğrenci ve ' + toplamOku + ' okuma kaydı taşındı.');
  Logger.log('Kullanıcı adları ve şifreler öğretmen panelinde, her sınıfın "Giriş kartları" düğmesinde.');
  Logger.log('Yeni siteyi deneyin: ' + fbAdres_() + ' — her şey yolundaysa "eskiAdresiYonlendir" işlevini çalıştırın.');
}

/**
 * Daha önce meyve şifresi + sınıf koduyla taşınmış öğrencileri kullanıcı adı + şifre girişine çevirir.
 * Okuma kayıtları aynen kalır. Kullanıcı adı olan öğrencilere dokunmaz; tekrar çalıştırmak güvenlidir.
 */
function girisBilgileriniYenile() {
  fbProjeKontrol_();
  authKontrol_();
  const siniflar = fsListe_('siniflar');
  const kullanilan = new Set();
  siniflar.forEach(s => (s.ogrenciler || []).forEach(x => { if (x.kullanici) kullanilan.add(x.kullanici); }));
  let cevrilen = 0;
  siniflar.forEach(sinif => {
    const yazilar = [];
    let degisti = false;
    (sinif.ogrenciler || []).forEach(x => {
      if (x.kullanici) return;
      x.kullanici = kullaniciUret_(x.ad, kullanilan);
      x.sifre = sifreUret_();
      authGuncelle_(x.id, x.sifre, x.kullanici);
      yazilar.push(fsGuncelle_('ogrenciler/' + x.id, { kullanici: x.kullanici, imza: sinif.imza || '' }));
      degisti = true;
      cevrilen++;
    });
    if (sinif.kod) { yazilar.push(fsSil_('kodlar/' + sinif.kod)); delete sinif.kod; degisti = true; }
    if (!degisti) return;
    yazilar.push.apply(yazilar, sinifListesiYaz_(sinif));
    fsYaz_(yazilar);
    Logger.log(sinif.ad + ': ' + (sinif.ogrenciler || []).length + ' öğrenci hazır.');
  });
  kurallariYayinla_(hamDosya_('firestore.rules') || (() => { throw new Error('Kurallar GitHub\'dan alınamadı.'); })());
  Logger.log('Bitti: ' + cevrilen + ' öğrenciye kullanıcı adı ve şifre verildi. Öğretmen panelindeki "Giriş kartları"ndan yazdırabilirsiniz.');
}

/* ================= Firebase Authentication (yönetici yetkisiyle) ================= */

function ogrEposta_(kullanici) { return kullanici + OGR_EPOSTA_SONU; }

const AUTH_KAPALI = 'Firebase Authentication henüz başlatılmamış. Firebase konsolunda Derleme → Authentication → Başlayın\'a tıklayın, ' +
  'Oturum açma yöntemi sekmesinde E-posta/Şifre ve Google\'ı etkinleştirin, sonra bu işlevi tekrar çalıştırın.';

/** Öğrenci hesabı açmadan önce Authentication'ın hazır olduğunu kontrol eder. */
function authKontrol_() {
  const r = gIstek_('get', 'https://identitytoolkit.googleapis.com/admin/v2/projects/' + FIREBASE_PROJE + '/config', null, true);
  if (/CONFIGURATION_NOT_FOUND/.test(r.hata || '')) throw new Error(AUTH_KAPALI);
  if (r.kod === 200) {
    const ep = r.veri && r.veri.signIn && r.veri.signIn.email;
    if (ep && ep.enabled === false) throw new Error('Firebase Authentication\'da E-posta/Şifre giriş yöntemi kapalı. Oturum açma yöntemi sekmesinden açın ve tekrar çalıştırın.');
  }
}

function authOlustur_(id, kullanici, sifre, ad) {
  const r = gIstek_('post', 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJE + '/accounts',
    { localId: id, email: ogrEposta_(kullanici), password: sifre, displayName: ad }, true);
  if (r.kod === 200) return;
  const mesaj = r.hata || '';
  if (/DUPLICATE_LOCAL_ID/.test(mesaj)) { authGuncelle_(id, sifre, kullanici); return; }
  if (/EMAIL_EXISTS/.test(mesaj)) throw new Error('"' + kullanici + '" kullanıcı adı başka bir hesapta var (' + ad + ').');
  if (/CONFIGURATION_NOT_FOUND/.test(mesaj)) throw new Error(AUTH_KAPALI);
  if (/OPERATION_NOT_ALLOWED|PASSWORD_LOGIN_DISABLED/.test(mesaj)) throw new Error('Firebase Authentication\'da E-posta/Şifre giriş yöntemi kapalı. Oturum açma yöntemi sekmesinden açın ve tekrar çalıştırın.');
  throw new Error('Öğrenci hesabı açılamadı (' + ad + '): ' + mesaj);
}

function authGuncelle_(id, sifre, kullanici) {
  const govde = { localId: id };
  if (sifre) govde.password = sifre;
  if (kullanici) govde.email = ogrEposta_(kullanici);
  const r = gIstek_('post', 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJE + '/accounts:update', govde, true);
  if (r.kod === 200) return;
  if (/EMAIL_EXISTS/.test(r.hata || '')) throw new Error('"' + kullanici + '" kullanıcı adı başka bir hesapta var.');
  throw new Error('Öğrenci hesabı güncellenemedi: ' + r.hata);
}

function authSil_(ids) {
  for (let i = 0; i < ids.length; i += 1000) {
    gIstek_('post', 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJE + '/accounts:batchDelete',
      { localIds: ids.slice(i, i + 1000), force: true });
  }
}

/* ================= Firestore (REST, yönetici yetkisiyle) ================= */

function fsTaban_() { return 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJE + '/databases/(default)/documents'; }
function fsAd_(yol) { return 'projects/' + FIREBASE_PROJE + '/databases/(default)/documents/' + yol; }
function fsYolKodla_(yol) { return yol.split('/').map(encodeURIComponent).join('/'); }

/** Belgeyi okur; yoksa null. Dönen nesnede _id alanı belge kimliğidir. */
function fsAl_(yol) {
  const r = gIstek_('get', fsTaban_() + '/' + fsYolKodla_(yol), null, true);
  if (r.kod === 404) return null;
  if (r.kod !== 200) throw new Error('Veritabanı okunamadı: ' + r.hata);
  const o = fsNesne_(r.veri.fields || {});
  o._id = yol.split('/').pop();
  return o;
}

/** Bir koleksiyonda alan == değer olan belgeleri getirir. */
function fsSorgu_(koleksiyon, alan, deger) {
  const r = gIstek_('post', fsTaban_() + ':runQuery', {
    structuredQuery: { from: [{ collectionId: koleksiyon }], where: { fieldFilter: { field: { fieldPath: alan }, op: 'EQUAL', value: fsDeger_(deger) } } }
  });
  return (r || []).filter(x => x.document).map(x => {
    const o = fsNesne_(x.document.fields || {});
    o._id = x.document.name.split('/').pop();
    return o;
  });
}

function fsKoy_(yol, veri) { return { update: { name: fsAd_(yol), fields: fsAlanlar_(veri) } }; }
function fsGuncelle_(yol, veri) {
  return { update: { name: fsAd_(yol), fields: fsAlanlar_(veri) }, updateMask: { fieldPaths: Object.keys(veri) }, currentDocument: { exists: true } };
}
function fsSil_(yol) { return { delete: fsAd_(yol) }; }

function fsYaz_(yazilar) {
  for (let i = 0; i < yazilar.length; i += 400) {
    gIstek_('post', fsTaban_() + ':commit', { writes: yazilar.slice(i, i + 400) });
  }
}

function fsDeger_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsDeger_) } };
  return { mapValue: { fields: fsAlanlar_(v) } };
}
function fsAlanlar_(o) {
  const f = {};
  Object.keys(o).forEach(k => { if (k !== '_id') f[k] = fsDeger_(o[k]); });
  return f;
}
function fsCoz_(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsCoz_);
  if ('mapValue' in v) return fsNesne_(v.mapValue.fields || {});
  return null;
}
function fsNesne_(f) {
  const o = {};
  Object.keys(f || {}).forEach(k => { o[k] = fsCoz_(f[k]); });
  return o;
}

/* ================= Firebase proje ayarları, Hosting ve kurallar ================= */

function fbProjeKontrol_() {
  if (!FIREBASE_PROJE) throw new Error('Firebase.gs dosyasının başındaki FIREBASE_PROJE satırına proje kimliğinizi yazın.');
}

function fbWebAyari_() {
  const taban = 'https://firebase.googleapis.com/v1beta1/projects/' + FIREBASE_PROJE + '/webApps';
  let uygulamalar = (gIstek_('get', taban) || {}).apps || [];
  if (!uygulamalar.length) {
    let op = gIstek_('post', taban, { displayName: 'Okuma Günlüğüm' });
    for (let i = 0; i < 20 && op && !op.done; i++) {
      Utilities.sleep(1500);
      op = gIstek_('get', 'https://firebase.googleapis.com/v1beta1/' + op.name);
    }
    uygulamalar = (gIstek_('get', taban) || {}).apps || [];
    if (!uygulamalar.length) throw new Error('Firebase web uygulaması oluşturulamadı. Birkaç dakika sonra tekrar deneyin.');
  }
  const a = gIstek_('get', taban + '/' + uygulamalar[0].appId + '/config');
  return { apiKey: a.apiKey, authDomain: a.authDomain, projectId: a.projectId, appId: a.appId, messagingSenderId: a.messagingSenderId };
}

function fbSite_() {
  const taban = 'https://firebasehosting.googleapis.com/v1beta1/projects/' + FIREBASE_PROJE + '/sites';
  const siteler = (gIstek_('get', taban) || {}).sites || [];
  const s = siteler.find(x => x.type === 'DEFAULT_SITE') || siteler[0];
  if (s) return s.name.split('/').pop();
  const yeni = gIstek_('post', taban + '?siteId=' + encodeURIComponent(FIREBASE_PROJE), {});
  return yeni.name.split('/').pop();
}

function siteyiYayinla_(html) {
  const site = PropertiesService.getScriptProperties().getProperty('FB_SITE') || fbSite_();
  const H = 'https://firebasehosting.googleapis.com/v1beta1/';
  const surum = gIstek_('post', H + 'sites/' + site + '/versions', {
    config: {
      headers: [{ glob: '**', headers: {
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      } }],
      rewrites: [{ glob: '**', path: '/index.html' }]
    }
  });
  const gz = Utilities.gzip(Utilities.newBlob(html, 'text/html', 'index.html'));
  const baytlar = gz.getBytes();
  const ozet = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, baytlar)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  const dosyalar = gIstek_('post', H + surum.name + ':populateFiles', { files: { '/index.html': ozet } });
  if ((dosyalar.uploadRequiredHashes || []).indexOf(ozet) >= 0) {
    const r = UrlFetchApp.fetch(dosyalar.uploadUrl + '/' + ozet, {
      method: 'post', contentType: 'application/octet-stream', payload: baytlar, muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': FIREBASE_PROJE }
    });
    if (r.getResponseCode() >= 300) throw new Error('Sayfa yüklenemedi: ' + r.getContentText().slice(0, 300));
  }
  gIstek_('patch', H + surum.name + '?update_mask=status', { status: 'FINALIZED' });
  gIstek_('post', H + 'sites/' + site + '/releases?versionName=' + encodeURIComponent(surum.name), { message: 'Okuma Günlüğüm güncellemesi' });
}

function kurallariYayinla_(kural) {
  const R = 'https://firebaserules.googleapis.com/v1/projects/' + FIREBASE_PROJE;
  const rs = gIstek_('post', R + '/rulesets', { source: { files: [{ name: 'firestore.rules', content: kural }] } });
  const ad = 'projects/' + FIREBASE_PROJE + '/releases/cloud.firestore';
  const r = gIstek_('patch', 'https://firebaserules.googleapis.com/v1/' + ad, { release: { name: ad, rulesetName: rs.name } }, true);
  if (r.kod === 404) gIstek_('post', R + '/releases', { name: ad, rulesetName: rs.name });
  else if (r.kod !== 200) throw new Error('Kurallar yayınlanamadı: ' + r.hata);
}

function hamDosya_(ad) {
  try {
    const r = UrlFetchApp.fetch(FB_GITHUB + ad + '?t=' + Date.now(), { muteHttpExceptions: true });
    return r.getResponseCode() === 200 ? r.getContentText('UTF-8') : null;
  } catch (e) { return null; }
}

function ozet_(metin) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, metin, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/**
 * Google API isteği (sizin hesabınızın yetkisiyle).
 * hamDon=true ise hata fırlatmaz; {kod, veri, hata} döndürür.
 */
function gIstek_(yontem, url, govde, hamDon) {
  const secenek = {
    method: yontem, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': FIREBASE_PROJE }
  };
  if (govde !== null && govde !== undefined) { secenek.contentType = 'application/json'; secenek.payload = JSON.stringify(govde); }
  const r = UrlFetchApp.fetch(url, secenek);
  const kod = r.getResponseCode(), metin = r.getContentText();
  let veri = null;
  try { veri = metin ? JSON.parse(metin) : {}; } catch (e) { veri = null; }
  const hata = kod >= 300 ? ((veri && veri.error && veri.error.message) || metin.slice(0, 300)) : '';
  if (hamDon) return { kod: kod, veri: veri, hata: hata };
  if (kod >= 300) {
    if (kod === 403 && /has not been used|is disabled/.test(hata)) throw new Error('Firebase projesinde gerekli bir hizmet kapalı: ' + hata);
    if (kod === 404 && /database/.test(hata)) throw new Error('Firestore veritabanı bulunamadı. Firebase konsolunda Firestore Database → Veritabanı oluştur adımını yapın.');
    throw new Error('Firebase hatası (' + kod + '): ' + hata);
  }
  return veri;
}
