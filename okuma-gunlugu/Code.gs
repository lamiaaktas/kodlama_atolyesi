/******************************************************
 *  OKUMA GÜNLÜĞÜM — Google Apps Script sunucu kodu
 *  Veriler, ilk çalıştırmada otomatik oluşturulan
 *  "Okuma Günlüğü — Veriler" adlı Google E-Tablo'da tutulur.
 *  Öğretmen şifresi ilk kurulumda 1234'tür; panelden değiştirin.
 ******************************************************/

const TZ = 'Europe/Istanbul';
const SH_OGR = 'Öğrenciler';
const SH_OKU = 'Okumalar';
const MEYVELER = ['Elma', 'Muz', 'Çilek', 'Üzüm', 'Portakal', 'Karpuz', 'Armut', 'Kiraz',
  'Havuç', 'Domates', 'Salatalık', 'Mısır', 'Brokoli', 'Patlıcan', 'Biber', 'Patates'];

/** Bir gün bu kadar ya da daha fazla sayfa okuyan öğrenci, ertesi gün girişte mesaj alır. */
const TEBRIK_ESIGI = 15;
const TEBRIKLER = ['Harika gidiyorsun!', 'Gayet güzel!', 'Müthiş!', 'Çabanı takdir ediyorum.',
  'Seninle gurur duyuyorum!', 'Bravo, emeğine sağlık!', 'Böyle devam et, süpersin!',
  'Okuma yıldızı oldun!', 'Kitap kurdun çok mutlu!', 'Harika bir okuma günüydü!'];

/* Ekran GitHub'dan okunur; GitHub'a gönderilen güncellemeler en geç 5 dakikada siteye yansır. */
const SAYFA_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/okuma-gunlugu/Index.html';
const ON = 'og:'; // önbellek anahtarı öneki

function doGet() {
  const html = sayfaGetir_();
  let out;
  if (html) out = HtmlService.createHtmlOutput(html);
  else {
    try { out = HtmlService.createHtmlOutputFromFile('Index'); }
    catch (e) { out = HtmlService.createHtmlOutput('<p style="font:18px sans-serif;padding:24px">Site şu an yüklenemedi. Birkaç dakika sonra tekrar deneyin.</p>'); }
  }
  return out
    .setTitle('Okuma Günlüğüm')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Editörde bir kez çalıştırın: veri tablosunu oluşturur, 5 dakikalık zamanlayıcıyı kurar, ekranı GitHub'dan alır. */
function kurulum() {
  const ss = ss_();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sayfaTazele') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sayfaTazele').timeBased().everyMinutes(5).create();
  const ok = sayfaTazele();
  Logger.log('Veri tablosu: ' + ss.getUrl());
  Logger.log(ok ? 'Hazır: ekran GitHub\'dan yüklendi.' : 'Uyarı: GitHub\'dan ekran alınamadı, Apps Script\'teki Index dosyası kullanılacak.');
}

/** Yeni sürümü 5 dakika beklemeden görmek isterseniz bir kez çalıştırın. */
function siteyiYenile() { sayfaTazele(); }

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
  try { CacheService.getScriptCache().putAll(obj, 21600); } catch (e) {}
  return html;
}

/* ---------------- yardımcılar ---------------- */

function ss_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* yeniden oluştur */ } }
  const ss = SpreadsheetApp.create('Okuma Günlüğü — Veriler');
  const o = ss.getSheets()[0];
  o.setName(SH_OGR);
  o.getRange('A:E').setNumberFormat('@');
  o.getRange(1, 1, 1, 5).setValues([['id', 'sinif', 'ad', 'sifre', 'eklenme']]).setFontWeight('bold');
  o.setFrozenRows(1);
  const k = ss.insertSheet(SH_OKU);
  k.getRange('A:E').setNumberFormat('@');
  k.getRange('G:H').setNumberFormat('@');
  k.getRange(1, 1, 1, 8).setValues([['tarih', 'sinif', 'ogrenciId', 'ad', 'kitap', 'sayfa', 'anladiklarim', 'kayit']]).setFontWeight('bold');
  k.setFrozenRows(1);
  props.setProperty('SHEET_ID', ss.getId());
  if (!props.getProperty('TEACHER_PIN')) props.setProperty('TEACHER_PIN', '1234');
  return ss;
}

function bugun_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function dun_() { return Utilities.formatDate(new Date(Date.now() - 864e5), TZ, 'yyyy-MM-dd'); }
function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}
function guvenli_(t) { t = String(t || '').trim(); return /^[=+\-@]/.test(t) ? "'" + t : t; }
function trSirala_(a, b) { return String(a).localeCompare(String(b), 'tr'); }

function ogrenciler_() {
  const sh = ss_().getSheetByName(SH_OGR);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 4).getValues()
    .map((r, i) => ({ row: i + 2, id: str_(r[0]), sinif: str_(r[1]), ad: str_(r[2]), sifre: str_(r[3]) }))
    .filter(s => s.id);
}

function okumalar_() {
  const sh = ss_().getSheetByName(SH_OKU);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 8).getValues()
    .map((r, i) => ({
      row: i + 2, tarih: str_(r[0]), sinif: str_(r[1]), ogrenciId: str_(r[2]), ad: str_(r[3]),
      kitap: str_(r[4]), sayfa: Number(r[5]) || 0, anladiklarim: str_(r[6]), kayit: str_(r[7])
    }))
    .filter(r => r.ogrenciId);
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

function kilit_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------------- öğrenci tarafı ---------------- */

function getClasses() {
  return [...new Set(ogrenciler_().map(s => s.sinif))].sort(trSirala_);
}

function getStudents(sinif) {
  return ogrenciler_().filter(s => s.sinif === sinif)
    .map(s => ({ id: s.id, ad: s.ad })).sort((a, b) => trSirala_(a.ad, b.ad));
}

function ogrenciDogrula_(id, sifre) {
  const cache = CacheService.getScriptCache();
  const key = 'hata_' + id;
  const hata = Number(cache.get(key) || 0);
  if (hata >= 5) throw new Error('Çok fazla yanlış deneme yapıldı. 5 dakika sonra tekrar dene.');
  const s = ogrenciler_().find(x => x.id === id);
  if (!s) throw new Error('Öğrenci bulunamadı.');
  if (s.sifre !== String(sifre)) {
    cache.put(key, String(hata + 1), 300);
    throw new Error('Şifre yanlış, tekrar dene.');
  }
  cache.remove(key);
  return s;
}

function ozet_(s) {
  const kayitlar = okumalar_().filter(r => r.ogrenciId === s.id)
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
  const gunler = new Set(kayitlar.filter(r => r.sayfa > 0).map(r => r.tarih));
  let seri = 0;
  let t = new Date();
  if (!gunler.has(Utilities.formatDate(t, TZ, 'yyyy-MM-dd'))) t = new Date(t.getTime() - 864e5);
  while (gunler.has(Utilities.formatDate(t, TZ, 'yyyy-MM-dd'))) { seri++; t = new Date(t.getTime() - 864e5); }
  return {
    ogrenci: { id: s.id, ad: s.ad, sinif: s.sinif },
    bugun: bugun_(), dun: dun_(),
    seri: seri,
    toplamSayfa: kayitlar.reduce((t, r) => t + r.sayfa, 0),
    sonKitap: kayitlar.length ? kayitlar[0].kitap : '',
    gecmis: kayitlar.slice(0, 30).map(r => ({ tarih: r.tarih, kitap: r.kitap, sayfa: r.sayfa, anladiklarim: r.anladiklarim })),
    kurt: kayitlar.slice().reverse().map(r => [r.tarih, r.sayfa, r.kitap])
  };
}

function studentLogin(id, sifre) {
  try {
    const s = ogrenciDogrula_(id, sifre);
    return Object.assign({ ok: true, tebrik: tebrik_(s) }, ozet_(s));
  } catch (e) { return { ok: false, msg: e.message }; }
}

/** Dün eşiğin üstünde okuduysa ve bugün henüz gösterilmediyse öğretmen mesajını döndürür. */
function tebrik_(s) {
  const dun = dun_();
  const props = PropertiesService.getScriptProperties();
  const key = 'tebrik_' + s.id;
  if (props.getProperty(key) === dun) return null;
  const r = okumalar_().find(x => x.ogrenciId === s.id && x.tarih === dun);
  if (!r || r.sayfa < TEBRIK_ESIGI) return null;
  props.setProperty(key, dun);
  let h = 0;
  for (const c of s.id + dun) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { mesaj: TEBRIKLER[h % TEBRIKLER.length], sayfa: r.sayfa, kitap: r.kitap,
    imza: props.getProperty('OGRETMEN_ADI') || 'Öğretmenin' };
}

function saveReading(id, sifre, veri) {
  const s = ogrenciDogrula_(id, sifre);
  const tarih = String(veri.tarih);
  if (tarih !== bugun_() && tarih !== dun_()) throw new Error('Sadece bugün ya da dün için kayıt girebilirsin.');
  const sayfa = Math.round(Number(veri.sayfa));
  if (!(sayfa >= 1 && sayfa <= 1000)) throw new Error('Sayfa sayısı 1 ile 1000 arasında olmalı.');
  const kitap = String(veri.kitap || '').trim().slice(0, 120);
  if (!kitap) throw new Error('Kitabının adını yazmalısın.');
  const anl = String(veri.anladiklarim || '').trim().slice(0, 2000);
  if (anl.length < 15) throw new Error('Ne anladığını biraz daha anlatır mısın?');

  return kilit_(() => {
    const sh = ss_().getSheetByName(SH_OKU);
    const satir = [tarih, s.sinif, s.id, s.ad, guvenli_(kitap), sayfa, guvenli_(anl),
      Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')];
    const var_ = okumalar_().find(r => r.ogrenciId === s.id && r.tarih === tarih);
    if (var_) sh.getRange(var_.row, 1, 1, 8).setValues([satir]);
    else sh.appendRow(satir);
    return ozet_(s);
  });
}

/* ---------------- öğretmen tarafı ---------------- */

function pin_(pin) {
  ss_();
  const cache = CacheService.getScriptCache();
  const hata = Number(cache.get('ogretmen_hata') || 0);
  if (hata >= 8) throw new Error('Çok fazla yanlış deneme. 5 dakika bekleyin.');
  if (String(pin) !== PropertiesService.getScriptProperties().getProperty('TEACHER_PIN')) {
    cache.put('ogretmen_hata', String(hata + 1), 300);
    throw new Error('Öğretmen şifresi yanlış.');
  }
}

function teacherLogin(pin) {
  try {
    pin_(pin);
    return { ok: true, bugun: bugun_(), ogretmenAdi: PropertiesService.getScriptProperties().getProperty('OGRETMEN_ADI') || '' };
  }
  catch (e) { return { ok: false, msg: e.message }; }
}

function tGetClasses(pin) {
  pin_(pin);
  const map = {};
  ogrenciler_().forEach(s => {
    (map[s.sinif] = map[s.sinif] || []).push({ id: s.id, ad: s.ad, sifre: s.sifre });
  });
  return Object.keys(map).sort(trSirala_).map(k => ({
    sinif: k, ogrenciler: map[k].sort((a, b) => trSirala_(a.ad, b.ad))
  }));
}

function tAddStudents(pin, sinif, metin) {
  pin_(pin);
  sinif = String(sinif || '').trim().slice(0, 30);
  if (!sinif) throw new Error('Sınıf adı boş olamaz.');
  const adlar = String(metin || '').split(/\r?\n/).map(x => x.replace(/^\s*\d+[.)-]?\s*/, '').trim()).filter(Boolean);
  if (!adlar.length) throw new Error('En az bir öğrenci adı yazın.');
  return kilit_(() => {
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
    }
    return tGetClasses(pin);
  });
}

function tRemoveStudent(pin, id) {
  pin_(pin);
  return kilit_(() => {
    const s = ogrenciler_().find(x => x.id === id);
    if (s) ss_().getSheetByName(SH_OGR).deleteRow(s.row);
    return tGetClasses(pin);
  });
}

function tResetPassword(pin, id) {
  pin_(pin);
  return kilit_(() => {
    const hepsi = ogrenciler_();
    const s = hepsi.find(x => x.id === id);
    if (!s) throw new Error('Öğrenci bulunamadı.');
    const kul = new Set(hepsi.filter(x => x.sinif === s.sinif).map(x => x.sifre));
    ss_().getSheetByName(SH_OGR).getRange(s.row, 4).setValue(rastgeleSifre_(kul));
    return tGetClasses(pin);
  });
}

function tRenameClass(pin, eski, yeni) {
  pin_(pin);
  yeni = String(yeni || '').trim().slice(0, 30);
  if (!yeni) throw new Error('Yeni sınıf adı boş olamaz.');
  return kilit_(() => {
    const ss = ss_();
    const o = ss.getSheetByName(SH_OGR);
    ogrenciler_().filter(s => s.sinif === eski).forEach(s => o.getRange(s.row, 2).setValue(yeni));
    const k = ss.getSheetByName(SH_OKU);
    okumalar_().filter(r => r.sinif === eski).forEach(r => k.getRange(r.row, 2).setValue(yeni));
    return tGetClasses(pin);
  });
}

function tDeleteClass(pin, sinif) {
  pin_(pin);
  return kilit_(() => {
    const o = ss_().getSheetByName(SH_OGR);
    ogrenciler_().filter(s => s.sinif === sinif).map(s => s.row)
      .sort((a, b) => b - a).forEach(r => o.deleteRow(r));
    return tGetClasses(pin);
  });
}

function tGetReadings(pin, sinif, bas, son) {
  pin_(pin);
  return {
    bugun: bugun_(),
    ogrenciler: getStudents(sinif),
    okumalar: okumalar_().filter(r => r.sinif === sinif && r.tarih >= bas && r.tarih <= son)
      .map(r => ({ tarih: r.tarih, ogrenciId: r.ogrenciId, ad: r.ad, kitap: r.kitap, sayfa: r.sayfa, anladiklarim: r.anladiklarim, kayit: r.kayit }))
  };
}

function tStudentReadings(pin, id) {
  pin_(pin);
  const s = ogrenciler_().find(x => x.id === id);
  if (!s) throw new Error('Öğrenci bulunamadı.');
  return {
    bugun: bugun_(),
    ogrenci: { id: s.id, ad: s.ad, sinif: s.sinif },
    okumalar: okumalar_().filter(r => r.ogrenciId === id).sort((a, b) => a.tarih.localeCompare(b.tarih))
      .map(r => ({ tarih: r.tarih, kitap: r.kitap, sayfa: r.sayfa, anladiklarim: r.anladiklarim }))
  };
}

function tSetTeacherName(pin, ad) {
  pin_(pin);
  ad = String(ad || '').trim().slice(0, 40);
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
