/**
 * Klavye Kâşifleri — Google Apps Script sunucu kodu
 * On parmak klavye kursu (Türkçe Q): 54 bölüm, animasyonlu anlatımlar, oyunlar, rozetler,
 * öğretmen paneli (kelime hızı, doğruluk, ilerleme).
 *
 * Kurulum özeti:
 *  1. İlerlemelerin tutulacağı yeni bir Google E-Tablo açın → Uzantılar → Apps Script.
 *  2. Bu dosyanın tamamını Kod.gs içine yapıştırıp kaydedin.
 *  3. Üstteki işlev listesinden "kurulum"u seçip bir kez Çalıştır'a basın (izinleri onaylayın).
 *  4. Dağıt → Yeni dağıtım → Tür: Web uygulaması
 *       Yürütme: Ben   |   Erişim: Herkes
 *     Çıkan adres (…/exec) sitenin adresidir; öğrenci tabletlerinde bunu açın.
 *  5. E-Tablodaki "Ayarlar" sayfasında B1 hücresine öğretmen PIN'inizi yazın.
 *  6. "Sınıflar" sayfasına her öğrenciyi bir satır olarak yazın: Sınıf | Sınıf kodu | Öğrenci
 *     (Siber Adalar ve Dijital Kale'deki Sınıflar sayfasıyla aynı düzende; oradan kopyalayabilirsiniz.)
 *
 * Bu dosyayı sonradan yeniden yapıştırdıysanız: Kaydet → Dağıt → Dağıtımları yönet →
 * kalem simgesi → Sürüm: "Yeni sürüm" → Dağıt. Sitenin adresi değişmez.
 *
 * Güncellemeler: Sitenin ekranı (Index.html) GitHub'daki lamiaaktas/kodlama_atolyesi
 * deposunun klavye-kasifleri klasöründen okunur. Ekran güncellemeleri için bu dosyaya
 * dokunmanız gerekmez; yeni sürüm en geç 5 dakikada kendiliğinden gelir.
 *
 * Bu E-Tablo veritabanıdır:
 *   Ayarlar    → B1 hücresi: öğretmen PIN'i
 *   Sınıflar   → Sınıf | Sınıf kodu | Öğrenci (her satıra bir öğrenci)
 *   İlerleme   → her öğrencinin özet satırı (otomatik dolar, elle düzenlemeyin)
 *   Denemeler  → her bitirilen bölüm bir satır: tarih, bölüm, hız, doğruluk, yıldız
 */

const SAYFA_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/klavye-kasifleri/Index.html';
const IKON_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/klavye-kasifleri/ikon-192.png';
const ON = 'kk:'; // önbellek anahtarı öneki
const BASLIK = ['Sınıf kodu', 'Öğrenci', 'Biten bölüm', 'Toplam yıldız', 'En iyi hız (kelime/dk)',
  'Son hız (kelime/dk)', 'Ort. doğruluk %', 'Rozet', 'Son çalışma', 'Veri (dokunmayın)'];
const DENEME_BASLIK = ['Tarih', 'Saat', 'Sınıf kodu', 'Öğrenci', 'Bölüm', 'Bölüm adı', 'Tür',
  'Hız (kelime/dk)', 'Doğruluk %', 'Yıldız', 'Süre (sn)'];

function doGet() {
  kurulum_();
  const html = sayfaGetir_();
  let out;
  if (html) out = HtmlService.createHtmlOutput(html);
  else {
    try { out = HtmlService.createHtmlOutputFromFile('Index'); }
    catch (e) { out = HtmlService.createHtmlOutput('<p style="font:18px sans-serif;padding:24px">Site şu an yüklenemedi. Birkaç dakika sonra tekrar deneyin.</p>'); }
  }
  return out
    .setTitle('Klavye Kâşifleri')
    .setFaviconUrl(IKON_URL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- Ekranı GitHub'dan okuma ----------
   Sayfa önbellekten verilir (6 saat). Zamanlayıcı her 5 dakikada GitHub'dan yeni sürümü çeker. */
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
      if (html.indexOf('Klavye Kâşifleri') < 0) html = null;
    }
  } catch (e) { html = null; }
  if (!html) return null;
  const obj = {}, parca = 40000, k = Math.ceil(html.length / parca);
  for (let i = 0; i < k; i++) obj[ON + 'sayfa:' + i] = html.substr(i * parca, parca);
  obj[ON + 'sayfa:n'] = String(k);
  try { CacheService.getScriptCache().putAll(obj, 21600); } catch (e) {}
  return html;
}

/* Bir kez çalıştırın: E-Tablo sayfalarını hazırlar, 5 dakikalık zamanlayıcıyı kurar, ekranı önbelleğe alır. */
function kurulum() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sayfaTazele') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sayfaTazele').timeBased().everyMinutes(5).create();
  CacheService.getScriptCache().remove(ON + 'hazir');
  kurulum_();
  const ok = sayfaTazele();
  Logger.log(ok ? 'Hazır: site GitHub\'dan yüklendi (' + ok.length + ' karakter).' : 'Uyarı: GitHub\'dan site alınamadı.');
}

/* Yeni sürümü 5 dakika beklemeden görmek isterseniz bu işlevi bir kez çalıştırın. */
function siteyiYenile() { sayfaTazele(); }

/* ---------- E-Tablo sayfaları ---------- */
function kurulum_() {
  if (CacheService.getScriptCache().get(ON + 'hazir')) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Ayarlar')) {
    const s = ss.insertSheet('Ayarlar', 0);
    s.getRange('A1:B1').setValues([['Öğretmen PIN\'i', '']]);
    s.getRange('A3').setValue('B1 hücresine en az 4 haneli bir PIN yazın. Sitedeki öğretmen paneline bu PIN ile girilir.');
    s.getRange('B1').setNumberFormat('@');
    s.getRange('A1').setFontWeight('bold');
    s.setColumnWidth(1, 160);
  }
  if (!ss.getSheetByName('Sınıflar')) {
    const s = ss.insertSheet('Sınıflar', 1);
    s.getRange('A1:C1').setValues([['Sınıf', 'Sınıf kodu', 'Öğrenci']]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName('İlerleme')) {
    const p = ss.insertSheet('İlerleme', 2);
    p.getRange(1, 1, 1, BASLIK.length).setValues([BASLIK]).setFontWeight('bold');
    p.setFrozenRows(1);
    p.hideColumns(BASLIK.length);
  }
  if (!ss.getSheetByName('Denemeler')) {
    const d = ss.insertSheet('Denemeler', 3);
    d.getRange(1, 1, 1, DENEME_BASLIK.length).setValues([DENEME_BASLIK]).setFontWeight('bold');
    d.setFrozenRows(1);
  }
  const def = ss.getSheetByName('Sayfa1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 4 && def.getLastRow() === 0) ss.deleteSheet(def);
  CacheService.getScriptCache().put(ON + 'hazir', '1', 21600);
}

/* ---------- Yardımcılar ---------- */
const kodNorm_ = k => String(k || '').trim().toLocaleUpperCase('tr').replace(/\s+/g, '');
const isimNorm_ = n => String(n || '').trim().replace(/\s+/g, ' ');
const sayi_ = (v, a, b) => { const n = Number(v); return isFinite(n) ? Math.max(a, Math.min(b, n)) : ''; };

function siniflariOku_() {
  const c = CacheService.getScriptCache(), hit = c.get(ON + 'siniflar');
  if (hit) return JSON.parse(hit);
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sınıflar');
  const siniflar = {};
  if (s && s.getLastRow() > 1) {
    s.getRange(2, 1, s.getLastRow() - 1, 3).getValues().forEach(r => {
      const ad = String(r[0] || '').trim(), kod = kodNorm_(r[1]), ogr = isimNorm_(r[2]);
      if (!kod) return;
      if (!siniflar[kod]) siniflar[kod] = { name: ad || kod, students: [] };
      if (ogr && siniflar[kod].students.indexOf(ogr) < 0) siniflar[kod].students.push(ogr);
    });
  }
  Object.keys(siniflar).forEach(k => siniflar[k].students.sort((a, b) => a.localeCompare(b, 'tr')));
  try { c.put(ON + 'siniflar', JSON.stringify(siniflar), 120); } catch (e) {}
  return siniflar;
}

function satirBul_(sh, kod, isim) {
  if (sh.getLastRow() < 2) return null;
  const n = BASLIK.length, v = sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues();
  for (let i = 0; i < v.length; i++) if (kodNorm_(v[i][0]) === kod && isimNorm_(v[i][1]) === isim) return { satir: i + 2, veri: v[i][n - 1] };
  return null;
}

/* ---------- Sitenin çağırdığı işlevler (google.script.run) ---------- */
function sinifGetir(kod) {
  const s = siniflariOku_()[kodNorm_(kod)];
  if (!s) return { ok: false, error: 'sinif' };
  return { ok: true, className: s.name, students: s.students };
}

function ilerlemeGetir(kod, isim) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('İlerleme');
  const r = satirBul_(sh, kodNorm_(kod), isimNorm_(isim));
  let d = null; if (r) { try { d = JSON.parse(r.veri || 'null'); } catch (e) {} }
  return { ok: true, data: d };
}

/* veri: öğrencinin bütün ilerlemesi (JSON). ozet: öğretmenin tabloda göreceği sayılar.
   denemeler: bu kayıtla birlikte gelen bitmiş bölümler (çevrimdışı kalanlar dahil). */
function ilerlemeKaydet(kod, isim, veri, ozet, denemeler) {
  const kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(15000);
    kod = kodNorm_(kod); isim = isimNorm_(isim); ozet = ozet || {};
    const sinif = siniflariOku_()[kod];
    if (!sinif || sinif.students.indexOf(isim) < 0) return { ok: false, error: 'ogrenci' };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const deger = [kod, isim, sayi_(ozet.biten, 0, 999), sayi_(ozet.yildiz, 0, 9999), sayi_(ozet.enIyiHiz, 0, 300),
      sayi_(ozet.sonHiz, 0, 300), sayi_(ozet.dogruluk, 0, 100), sayi_(ozet.rozet, 0, 999), new Date(), JSON.stringify(veri || {})];
    const sh = ss.getSheetByName('İlerleme');
    const r = satirBul_(sh, kod, isim);
    if (r) sh.getRange(r.satir, 1, 1, deger.length).setValues([deger]); else sh.appendRow(deger);

    const satirlar = (denemeler || []).slice(0, 50).map(d => {
      const t = new Date(Number(d.t) || Date.now());
      return [Utilities.formatDate(t, 'Europe/Istanbul', 'dd.MM.yyyy'), Utilities.formatDate(t, 'Europe/Istanbul', 'HH:mm'),
        kod, isim, sayi_(d.ders, 0, 999), String(d.ad || '').slice(0, 60), String(d.tur || '').slice(0, 20),
        sayi_(d.hiz, 0, 300), sayi_(d.dogruluk, 0, 100), sayi_(d.yildiz, 0, 5), sayi_(d.sure, 0, 3600)];
    });
    if (satirlar.length) {
      const dsh = ss.getSheetByName('Denemeler');
      dsh.getRange(dsh.getLastRow() + 1, 1, satirlar.length, DENEME_BASLIK.length).setValues(satirlar);
    }
    return { ok: true };
  } finally {
    try { kilit.releaseLock(); } catch (e) {}
  }
}

function ogretmenVerisi(pin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dogru = String(ss.getSheetByName('Ayarlar').getRange('B1').getValue() || '').trim();
  if (!dogru) return { ok: false, error: 'pin-yok' };
  if (String(pin || '').trim() !== dogru) { Utilities.sleep(800); return { ok: false, error: 'pin' }; }
  CacheService.getScriptCache().remove(ON + 'siniflar');
  const sh = ss.getSheetByName('İlerleme'), n = BASLIK.length;
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues() : [];
  return {
    ok: true,
    classes: siniflariOku_(),
    rows: rows.filter(r => r[0]).map(r => {
      let d = null; try { d = JSON.parse(r[n - 1] || 'null'); } catch (e) {}
      return { code: kodNorm_(r[0]), name: isimNorm_(r[1]), data: d };
    })
  };
}

/* Öğretmen panelindeki "İlerlemeyi sıfırla" düğmesi: bir öğrencinin bütün ilerlemesini siler. */
function ogrenciSifirla(pin, kod, isim) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dogru = String(ss.getSheetByName('Ayarlar').getRange('B1').getValue() || '').trim();
  if (!dogru || String(pin || '').trim() !== dogru) { Utilities.sleep(800); return { ok: false, error: 'pin' }; }
  const kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(15000);
    const sh = ss.getSheetByName('İlerleme');
    kod = kodNorm_(kod); isim = isimNorm_(isim);
    const r = satirBul_(sh, kod, isim);
    // Satır boş bir ilerlemeyle yazılır; "g" zamanı tabletteki eski kopyadan yeni olduğu için o kopya geri gelmez.
    const bos = { dersler: {}, rozet: {}, kayit: [], hatalar: {}, gunler: [], g: Date.now() };
    const deger = [kod, isim, 0, 0, '', '', '', 0, new Date(), JSON.stringify(bos)];
    if (r) sh.getRange(r.satir, 1, 1, deger.length).setValues([deger]);
    return { ok: true };
  } finally {
    try { kilit.releaseLock(); } catch (e) {}
  }
}
