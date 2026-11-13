/******************************************************
 *  OKUMA GÜNLÜĞÜM — Google Apps Script sunucu kodu
 *  Veriler, ilk çalıştırmada otomatik oluşturulan
 *  "Okuma Günlüğü — Veriler" adlı Google E-Tablo'da tutulur.
 *  Öğretmen şifresi ilk kurulumda 1234'tür; panelden değiştirin.
 *
 *  Hız için sınıf listeleri ve öğrencilerin okumaları önbellekte tutulur.
 *  E-Tablo'da elle değişiklik yaparsanız "onbellegiTemizle" işlevini bir kez çalıştırın.
 ******************************************************/

const TZ = 'Europe/Istanbul';
const SH_OGR = 'Öğrenciler';
const SH_OKU = 'Okumalar';
const BASLIK_OGR = ['Kimlik', 'Sınıf', 'Ad Soyad', 'Şifre', 'Eklenme'];
const BASLIK_OKU = ['Tarih', 'Sınıf', 'Öğrenci kimliği', 'Ad Soyad', 'Kitap', 'Sayfa', 'Ne anladı', 'Kayıt zamanı', 'Kitabı bitirdi'];
const MEYVELER = ['Elma', 'Muz', 'Çilek', 'Üzüm', 'Portakal', 'Karpuz', 'Armut', 'Kiraz',
  'Havuç', 'Domates', 'Salatalık', 'Mısır', 'Brokoli', 'Patlıcan', 'Biber', 'Patates'];

/** Bir gün bu kadar ya da daha fazla sayfa okuyan öğrenci, ertesi gün girişte mesaj alır. */
const TEBRIK_ESIGI = 15;
const TEBRIKLER = ['Harika gidiyorsun!', 'Gayet güzel!', 'Müthiş!', 'Çabanı takdir ediyorum.',
  'Seninle gurur duyuyorum!', 'Bravo, emeğine sağlık!', 'Böyle devam et, süpersin!',
  'Okuma yıldızı oldun!', 'Kitap kurdun çok mutlu!', 'Harika bir okuma günüydü!'];

/* Ekran GitHub'dan okunur; GitHub'a gönderilen güncellemeler en geç 5 dakikada siteye yansır. */
const SAYFA_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/okuma-gunlugu/Index.html';
const ON = 'og:';            // önbellek anahtarı öneki
const SURE = 21600;          // önbellek süresi (6 saat, en fazlası)
const GECMIS_METIN = 14;     // öğrenci ekranında yazısıyla gösterilen son kayıt sayısı
const PANEL_METIN_GUN = 92;  // öğretmen paneline yazısıyla gönderilen gün sayısı

/* ================= sayfa ================= */

function doGet() {
  let html = sayfaGetir_();
  if (!html) {
    try { html = HtmlService.createHtmlOutputFromFile('Index').getContent(); }
    catch (e) { html = '<p style="font:18px sans-serif;padding:24px">Site şu an yüklenemedi. Birkaç dakika sonra tekrar deneyin.</p>'; }
  }
  // Sınıf ve isim listelerini sayfanın içine koy: öğrenci ekranları sunucuyu beklemeden açılır.
  let veri = '';
  try { veri = JSON.stringify(sinifListesi_()).replace(/</g, '\\u003c'); } catch (e) { veri = ''; }
  if (veri) html = html.replace('/*ON_VERI*/', 'window.ON_VERI=' + veri + ';');
  return HtmlService.createHtmlOutput(html)
    .setTitle('Okuma Günlüğüm')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Editörde bir kez çalıştırın: veri tablosunu hazırlar, 5 dakikalık zamanlayıcıyı kurar, ekranı GitHub'dan alır. */
function kurulum() {
  const ss = ss_();
  basliklariDuzelt_(ss);
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sayfaTazele') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sayfaTazele').timeBased().everyMinutes(5).create();
  onbellegiTemizle();
  const ok = sayfaTazele();
  Logger.log('Veri tablosu: ' + ss.getUrl());
  Logger.log(ok ? 'Hazır: ekran GitHub\'dan yüklendi.' : 'Uyarı: GitHub\'dan ekran alınamadı, Apps Script\'teki Index dosyası kullanılacak.');
}

/** Yeni sürümü 5 dakika beklemeden görmek isterseniz bir kez çalıştırın. */
function siteyiYenile() { sayfaTazele(); }

/** E-Tablo'yu elle düzenlediyseniz bir kez çalıştırın. */
function onbellegiTemizle() {
  const c = CacheService.getScriptCache();
  c.remove(ON + 'roster');
  const ids = ogrenciler_().map(s => ON + 'k:' + s.id);
  for (let i = 0; i < ids.length; i += 200) c.removeAll(ids.slice(i, i + 200));
}

function sayfaGetir_() { return onbellektenSayfa_() || sayfaTazele(); }

function onbellektenSayfa_() {
  const c = CacheService.getScriptCache();
  const n = parseInt(c.get(ON + 'sayfa:n') || '0', 10);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(ON + 'sayfa:' + i);
  const p = c.getAll(keys);
  let s = '';
  for (let i = 0; i < n; i++) { if (p[ON + 'sayfa:' + i] == null) return null; s += p[ON + 'sayfa:' + i]; }
  return s;
}

function sayfaTazele() {
  let html = null;
  try {
    const r = UrlFetchApp.fetch(SAYFA_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) {
      html = r.getContentText('UTF-8');
      if (html.indexOf('Okuma Günlüğüm') < 0) html = null;
    }
  } catch (e) { html = null; }
  if (!html) return null;
  const obj = {}, parca = 40000, k = Math.ceil(html.length / parca);
  for (let i = 0; i < k; i++) obj[ON + 'sayfa:' + i] = html.substr(i * parca, parca);
  obj[ON + 'sayfa:n'] = String(k);
  try { CacheService.getScriptCache().putAll(obj, SURE); } catch (e) {}
  return html;
}

/* ================= tablo ve önbellek ================= */

let SS_ = null, OGR_ = null, OKU_ = null;

function ss_() {
  if (SS_) return SS_;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { SS_ = SpreadsheetApp.openById(id); return SS_; } catch (e) { /* yeniden oluştur */ } }
  const ss = SpreadsheetApp.create('Okuma Günlüğü — Veriler');
  const o = ss.getSheets()[0];
  o.setName(SH_OGR);
  o.getRange('A:E').setNumberFormat('@');
  o.setFrozenRows(1);
  const k = ss.insertSheet(SH_OKU);
  k.getRange('A:E').setNumberFormat('@');
  k.getRange('G:I').setNumberFormat('@');
  k.setFrozenRows(1);
  basliklariDuzelt_(ss);
  props.setProperty('SHEET_ID', ss.getId());
  if (!props.getProperty('TEACHER_PIN')) props.setProperty('TEACHER_PIN', '1234');
  SS_ = ss;
  return ss;
}

function basliklariDuzelt_(ss) {
  ss.getSheetByName(SH_OGR).getRange(1, 1, 1, BASLIK_OGR.length).setValues([BASLIK_OGR]).setFontWeight('bold');
  const k = ss.getSheetByName(SH_OKU);
  k.getRange('I:I').setNumberFormat('@');
  k.getRange(1, 1, 1, BASLIK_OKU.length).setValues([BASLIK_OKU]).setFontWeight('bold');
}

function bugun_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function dun_() { return Utilities.formatDate(new Date(Date.now() - 864e5), TZ, 'yyyy-MM-dd'); }
function gunOnce_(t, n) { const [y, m, d] = t.split('-').map(Number); return Utilities.formatDate(new Date(Date.UTC(y, m - 1, d - n, 12)), 'UTC', 'yyyy-MM-dd'); }
/** Mac'ten yapıştırılan ayrık harfleri (ş = s + ̧ gibi) tek harfe çevirir, fazla boşlukları siler. */
function nfc_(v) { return String(v == null ? '' : v).normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim(); }
function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return nfc_(v);
}
function metin_(v) { return String(v == null ? '' : v).normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim(); }
function guvenli_(t) { t = String(t || ''); return /^[=+\-@]/.test(t) ? "'" + t : t; }
function trSirala_(a, b) { return String(a).localeCompare(String(b), 'tr'); }

function kilit_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Öğrenci listesi (şifreler dahil) — önbellekten. */
function ogrenciler_() {
  if (OGR_) return OGR_;
  const c = CacheService.getScriptCache();
  const hit = c.get(ON + 'roster');
  if (hit) { OGR_ = JSON.parse(hit); return OGR_; }
  const sh = ss_().getSheetByName(SH_OGR);
  const n = sh.getLastRow() - 1;
  OGR_ = n < 1 ? [] : sh.getRange(2, 1, n, 4).getValues()
    .map(r => ({ id: str_(r[0]), sinif: str_(r[1]), ad: str_(r[2]), sifre: str_(r[3]) }))
    .filter(s => s.id);
  try { c.put(ON + 'roster', JSON.stringify(OGR_), SURE); } catch (e) {}
  return OGR_;
}

function rosterDegisti_() { OGR_ = null; CacheService.getScriptCache().remove(ON + 'roster'); }

function satirBul_(id) {
  const sh = ss_().getSheetByName(SH_OGR);
  const n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (str_(ids[i][0]) === id) return i + 2;
  return -1;
}

/** Tüm okumalar (tek okuma, aynı istek içinde tekrar kullanılır). */
function okumalar_() {
  if (OKU_) return OKU_;
  const sh = ss_().getSheetByName(SH_OKU);
  const n = sh.getLastRow() - 1;
  OKU_ = n < 1 ? [] : sh.getRange(2, 1, n, 9).getValues()
    .map(r => ({
      tarih: str_(r[0]), sinif: str_(r[1]), ogrenciId: str_(r[2]), ad: str_(r[3]),
      kitap: str_(r[4]), sayfa: Number(r[5]) || 0, anl: metin_(r[6]), bitti: str_(r[8]) ? 1 : 0
    }))
    .filter(r => r.ogrenciId && r.tarih);
  return OKU_;
}

/* Öğrenci önbelleği: [tarih, sayfa, kitap, bitti, (son kayıtlarda) yazı], eskiden yeniye. */
function kompakt_(liste) {
  liste.sort((a, b) => a.tarih.localeCompare(b.tarih));
  const sinir = liste.length - GECMIS_METIN;
  return liste.map((r, i) => i >= sinir ? [r.tarih, r.sayfa, r.kitap, r.bitti, r.anl] : [r.tarih, r.sayfa, r.kitap, r.bitti]);
}

function ogrenciKayitlari_(id) {
  const c = CacheService.getScriptCache();
  const hit = c.get(ON + 'k:' + id);
  if (hit) return JSON.parse(hit);
  // Önbellek boş: tabloyu bir kez oku, herkesin önbelleğini doldur.
  const grup = {};
  ogrenciler_().forEach(s => grup[s.id] = []);
  okumalar_().forEach(r => { if (grup[r.ogrenciId]) grup[r.ogrenciId].push(r); });
  const obj = {};
  Object.keys(grup).forEach(k => obj[ON + 'k:' + k] = JSON.stringify(kompakt_(grup[k])));
  const anahtar = Object.keys(obj);
  for (let i = 0; i < anahtar.length; i += 100) {
    const parca = {};
    anahtar.slice(i, i + 100).forEach(k => parca[k] = obj[k]);
    try { c.putAll(parca, SURE); } catch (e) {}
  }
  return grup[id] ? kompakt_(grup[id]) : [];
}

function kayitlariYaz_(id, liste) {
  try { CacheService.getScriptCache().put(ON + 'k:' + id, JSON.stringify(liste), SURE); } catch (e) {}
}

/* ================= öğrenci tarafı ================= */

function sinifListesi_() {
  const map = {};
  ogrenciler_().forEach(s => (map[s.sinif] = map[s.sinif] || []).push({ id: s.id, ad: s.ad }));
  return Object.keys(map).sort(trSirala_).map(k => ({
    sinif: k, ogrenciler: map[k].sort((a, b) => trSirala_(a.ad, b.ad))
  }));
}

/** Sayfa açıkken listeyi arka planda tazelemek için. */
function getRoster() { return sinifListesi_(); }
function getClasses() { return sinifListesi_().map(c => c.sinif); }
function getStudents(sinif) { const c = sinifListesi_().find(x => x.sinif === sinif); return c ? c.ogrenciler : []; }

function ogrenciDogrula_(id, sifre) {
  const cache = CacheService.getScriptCache();
  const key = ON + 'hata:' + id;
  const hata = Number(cache.get(key) || 0);
  if (hata >= 5) throw new Error('Çok fazla yanlış deneme yapıldı. 5 dakika sonra tekrar dene.');
  const s = ogrenciler_().find(x => x.id === id);
  if (!s) throw new Error('Öğrenci bulunamadı. Öğretmenine söyle.');
  if (s.sifre.normalize('NFC') !== nfc_(sifre)) {
    cache.put(key, String(hata + 1), 300);
    throw new Error('Şifre yanlış, tekrar dene.');
  }
  if (hata) cache.remove(key);
  return s;
}

/** Öğrenciye kayıt listesini gönderir; seri, toplam, kitaplar ve kurt tablette hesaplanır. */
function ozet_(s, liste) {
  return { ogrenci: { id: s.id, ad: s.ad, sinif: s.sinif }, bugun: bugun_(), dun: dun_(), liste: liste };
}

function studentLogin(id, sifre) {
  try {
    const s = ogrenciDogrula_(id, sifre);
    const liste = ogrenciKayitlari_(id);
    return Object.assign({ ok: true, tebrik: tebrik_(s, liste) }, ozet_(s, liste));
  } catch (e) { return { ok: false, msg: e.message }; }
}

/** Dün eşiğin üstünde okuduysa ve bugün henüz gösterilmediyse öğretmen mesajını döndürür. */
function tebrik_(s, liste) {
  const dun = dun_();
  const r = liste.find(x => x[0] === dun);
  if (!r || r[1] < TEBRIK_ESIGI) return null;
  const props = PropertiesService.getScriptProperties();
  const key = 'tebrik_' + s.id;
  if (props.getProperty(key) === dun) return null;
  props.setProperty(key, dun);
  let h = 0;
  for (const c of s.id + dun) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { mesaj: TEBRIKLER[h % TEBRIKLER.length], sayfa: r[1], kitap: r[2],
    imza: props.getProperty('OGRETMEN_ADI') || 'Öğretmenin' };
}

function saveReading(id, sifre, veri) {
  const s = ogrenciDogrula_(id, sifre);
  const tarih = String(veri.tarih);
  if (tarih !== bugun_() && tarih !== dun_()) throw new Error('Sadece bugün ya da dün için kayıt girebilirsin.');
  const sayfa = Math.round(Number(veri.sayfa));
  if (!(sayfa >= 1 && sayfa <= 1000)) throw new Error('Sayfa sayısı 1 ile 1000 arasında olmalı.');
  const kitap = nfc_(veri.kitap).slice(0, 120);
  if (!kitap) throw new Error('Kitabının adını yazmalısın.');
  const anl = metin_(veri.anladiklarim).slice(0, 2000);
  if (anl.length < 15) throw new Error('Ne anladığını biraz daha anlatır mısın?');
  const bitti = veri.bitti ? 1 : 0;

  return kilit_(() => {
    const sh = ss_().getSheetByName(SH_OKU);
    const satir = [tarih, s.sinif, s.id, s.ad, guvenli_(kitap), sayfa, guvenli_(anl),
      Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), bitti ? 'Evet' : ''];
    // Aynı gün için kayıt var mı? Yalnızca o günün satırlarına bakılır.
    let row = -1;
    const son = sh.getLastRow();
    if (son > 1) {
      const bul = sh.getRange(2, 1, son - 1, 1).createTextFinder(tarih).matchEntireCell(true).findAll();
      if (bul.length) {
        const ilk = bul[0].getRow(), sonR = bul[bul.length - 1].getRow();
        const blok = sh.getRange(ilk, 1, sonR - ilk + 1, 3).getValues();
        for (let i = 0; i < blok.length; i++) {
          if (str_(blok[i][0]) === tarih && str_(blok[i][2]) === s.id) { row = ilk + i; break; }
        }
      }
    }
    if (row > 0) sh.getRange(row, 1, 1, 9).setValues([satir]);
    else sh.appendRow(satir);

    // önbelleği güncelle
    const liste = ogrenciKayitlari_(s.id).filter(r => r[0] !== tarih);
    liste.push([tarih, sayfa, kitap, bitti, anl]);
    liste.sort((a, b) => a[0].localeCompare(b[0]));
    const sinir = liste.length - GECMIS_METIN;
    const yeni = liste.map((r, i) => i >= sinir ? r : r.slice(0, 4));
    kayitlariYaz_(s.id, yeni);
    return ozet_(s, yeni);
  });
}

/* ================= öğretmen tarafı ================= */

function pin_(pin) {
  const cache = CacheService.getScriptCache();
  const hata = Number(cache.get(ON + 'ogretmen_hata') || 0);
  if (hata >= 8) throw new Error('Çok fazla yanlış deneme. 5 dakika bekleyin.');
  const props = PropertiesService.getScriptProperties();
  let dogru = props.getProperty('TEACHER_PIN');
  if (!dogru) { ss_(); dogru = props.getProperty('TEACHER_PIN'); }
  if (String(pin) !== dogru) {
    cache.put(ON + 'ogretmen_hata', String(hata + 1), 300);
    throw new Error('Öğretmen şifresi yanlış.');
  }
}

function teacherLogin(pin) {
  try {
    pin_(pin);
    return { ok: true, bugun: bugun_(), ogretmenAdi: PropertiesService.getScriptProperties().getProperty('OGRETMEN_ADI') || '', siniflar: tGetClasses(pin) };
  } catch (e) { return { ok: false, msg: e.message }; }
}

function rastgeleSifre_(kullanilan) {
  for (let i = 0; i < 200; i++) {
    const a = Math.floor(Math.random() * MEYVELER.length);
    let b = Math.floor(Math.random() * (MEYVELER.length - 1));
    if (b >= a) b++;
    const s = MEYVELER[a] + '-' + MEYVELER[b];
    if (!kullanilan || !kullanilan.has(s)) return s;
  }
  return MEYVELER[0] + '-' + MEYVELER[1];
}

function tGetClasses(pin) {
  pin_(pin);
  const map = {};
  ogrenciler_().forEach(s => (map[s.sinif] = map[s.sinif] || []).push({ id: s.id, ad: s.ad, sifre: s.sifre }));
  return Object.keys(map).sort(trSirala_).map(k => ({
    sinif: k, ogrenciler: map[k].sort((a, b) => trSirala_(a.ad, b.ad))
  }));
}

function tAddStudents(pin, sinif, metin) {
  pin_(pin);
  sinif = nfc_(sinif).slice(0, 30);
  if (!sinif) throw new Error('Sınıf adı boş olamaz.');
  const adlar = String(metin || '').split(/\r?\n/).map(x => nfc_(x).replace(/^\d+[.)-]?\s*/, '')).filter(Boolean);
  if (!adlar.length) throw new Error('En az bir öğrenci adı yazın.');
  return kilit_(() => {
    rosterDegisti_();
    const mevcut = ogrenciler_().filter(s => s.sinif === sinif);
    const adSet = new Set(mevcut.map(s => s.ad.toLocaleLowerCase('tr')));
    const sifreSet = new Set(mevcut.map(s => s.sifre));
    const simdi = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    const yeni = [];
    adlar.forEach(ad => {
      ad = ad.slice(0, 60);
      const k = ad.toLocaleLowerCase('tr');
      if (adSet.has(k)) return;
      adSet.add(k);
      const sifre = rastgeleSifre_(sifreSet);
      sifreSet.add(sifre);
      yeni.push([Utilities.getUuid().slice(0, 8), sinif, guvenli_(ad), sifre, simdi]);
    });
    if (yeni.length) {
      const sh = ss_().getSheetByName(SH_OGR);
      sh.getRange(sh.getLastRow() + 1, 1, yeni.length, 5).setValues(yeni);
      yeni.forEach(r => kayitlariYaz_(r[0], []));
    }
    rosterDegisti_();
    return tGetClasses(pin);
  });
}

function tRemoveStudent(pin, id) {
  pin_(pin);
  return kilit_(() => {
    const row = satirBul_(id);
    if (row > 0) ss_().getSheetByName(SH_OGR).deleteRow(row);
    rosterDegisti_();
    return tGetClasses(pin);
  });
}

function tResetPassword(pin, id) {
  pin_(pin);
  return kilit_(() => {
    const s = ogrenciler_().find(x => x.id === id);
    const row = satirBul_(id);
    if (!s || row < 0) throw new Error('Öğrenci bulunamadı.');
    const kul = new Set(ogrenciler_().filter(x => x.sinif === s.sinif).map(x => x.sifre));
    ss_().getSheetByName(SH_OGR).getRange(row, 4).setValue(rastgeleSifre_(kul));
    rosterDegisti_();
    return tGetClasses(pin);
  });
}

function sutunuDegistir_(sh, eski, yeni) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const r = sh.getRange(2, 2, n, 1);
  const v = r.getValues();
  let degisti = false;
  v.forEach(x => { if (str_(x[0]) === eski) { x[0] = yeni; degisti = true; } });
  if (degisti) r.setValues(v);
}

function tRenameClass(pin, eski, yeni) {
  pin_(pin);
  yeni = nfc_(yeni).slice(0, 30);
  if (!yeni) throw new Error('Yeni sınıf adı boş olamaz.');
  return kilit_(() => {
    const ss = ss_();
    sutunuDegistir_(ss.getSheetByName(SH_OGR), eski, yeni);
    sutunuDegistir_(ss.getSheetByName(SH_OKU), eski, yeni);
    rosterDegisti_();
    return tGetClasses(pin);
  });
}

function tDeleteClass(pin, sinif) {
  pin_(pin);
  return kilit_(() => {
    const sh = ss_().getSheetByName(SH_OGR);
    const n = sh.getLastRow() - 1;
    if (n > 0) {
      const v = sh.getRange(2, 1, n, 5).getValues();
      const kalan = v.filter(r => str_(r[1]) !== sinif);
      if (kalan.length !== v.length) {
        sh.getRange(2, 1, n, 5).clearContent();
        if (kalan.length) sh.getRange(2, 1, kalan.length, 5).setValues(kalan);
      }
    }
    rosterDegisti_();
    return tGetClasses(pin);
  });
}

/** Bir sınıfın bütün okumaları tek seferde: [tarih, öğrenciId, sayfa, kitap, bitti, yazı]. Son 92 günün yazıları dahil. */
function tClassData(pin, sinif) {
  pin_(pin);
  const bugun = bugun_(), sinir = gunOnce_(bugun, PANEL_METIN_GUN);
  const ogr = tGetClasses(pin).find(c => c.sinif === sinif);
  const ids = new Set((ogr ? ogr.ogrenciler : []).map(o => o.id));
  const okumalar = okumalar_().filter(r => r.sinif === sinif || ids.has(r.ogrenciId))
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .map(r => [r.tarih, r.ogrenciId, r.sayfa, r.kitap, r.bitti, r.tarih >= sinir ? r.anl : '']);
  return { bugun: bugun, ogrenciler: (ogr ? ogr.ogrenciler : []).map(o => ({ id: o.id, ad: o.ad })), okumalar: okumalar };
}

function tSetTeacherName(pin, ad) {
  pin_(pin);
  ad = nfc_(ad).slice(0, 40);
  const props = PropertiesService.getScriptProperties();
  if (ad) props.setProperty('OGRETMEN_ADI', ad); else props.deleteProperty('OGRETMEN_ADI');
  return { ok: true };
}

function tChangePin(pin, yeniPin) {
  pin_(pin);
  yeniPin = String(yeniPin || '').trim();
  if (!/^\d{4,8}$/.test(yeniPin)) throw new Error('Yeni şifre 4-8 haneli bir sayı olmalı.');
  PropertiesService.getScriptProperties().setProperty('TEACHER_PIN', yeniPin);
  return { ok: true };
}
