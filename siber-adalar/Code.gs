/**
 * Siber Adalar — Google Apps Script sunucu kodu
 * 3. Sınıf · 2. Ünite · Dijital Vatandaşlık (4 ada: Sır Vadisi, Dostluk Adası, Keşif Kulesi, Olta Koyu)
 *
 * Kurulum özeti:
 *  1. İlerlemelerin tutulacağı yeni bir Google E-Tablo açın → Uzantılar → Apps Script.
 *  2. Bu dosyanın tamamını Kod.gs içine yapıştırıp kaydedin.
 *  3. Üstteki işlev listesinden "kurulum"u seçip bir kez Çalıştır'a basın (izinleri onaylayın).
 *  4. Dağıt → Yeni dağıtım → Tür: Web uygulaması
 *       Yürütme: Ben   |   Erişim: Herkes
 *     Çıkan adres (…/exec) oyunun adresidir; öğrenci tabletlerinde bunu açın.
 *  5. E-Tablodaki "Ayarlar" sayfasında B1 hücresine öğretmen PIN'inizi yazın.
 *  6. "Sınıflar" sayfasına her öğrenciyi bir satır olarak yazın: Sınıf | Sınıf kodu | Öğrenci
 *     (Dijital Kale'deki Sınıflar sayfasıyla aynı düzende; oradan kopyalayabilirsiniz.)
 *
 * Bu dosyayı sonradan yeniden yapıştırdıysanız: Kaydet → Dağıt → Dağıtımları yönet →
 * kalem simgesi → Sürüm: "Yeni sürüm" → Dağıt. Oyunun adresi değişmez.
 *
 * Güncellemeler: Oyunun ekranı (Index.html) GitHub'daki lamiaaktas/kodlama_atolyesi
 * deposunun siber-adalar klasöründen okunur. Ekran güncellemeleri için bu dosyaya
 * dokunmanız gerekmez; yeni sürüm en geç 5 dakikada kendiliğinden gelir. Projeye ayrıca
 * "Index" adlı bir HTML dosyası eklerseniz, GitHub'a ulaşılamadığında yedek olarak kullanılır.
 *
 * Bu E-Tablo veritabanıdır:
 *   Ayarlar   → B1 hücresi: öğretmen PIN'i
 *   Sınıflar  → Sınıf | Sınıf kodu | Öğrenci (her satıra bir öğrenci)
 *   İlerleme  → her öğrencinin ada puanları ve çıkış kartları (otomatik dolar, elle düzenlemeyin)
 */

const SAYFA_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/siber-adalar/Index.html';
const IKON_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/siber-adalar/ikon-192.png';
const DUNYA_IDLER = ['sir', 'dost', 'arama', 'olta'];
const DUNYA_ADLARI = ['Sır Vadisi', 'Dostluk Adası', 'Keşif Kulesi', 'Olta Koyu'];
const BASLIK = ['Sınıf kodu', 'Öğrenci'].concat(DUNYA_ADLARI, ['Toplam puan', 'Sertifika'],
  DUNYA_ADLARI.map(a => 'Çıkış kartı: ' + a), ['Son güncelleme', 'Veri (dokunmayın)']);

function doGet() {
  kurulum_();
  const html = sayfaGetir_();
  let out;
  if (html) out = HtmlService.createHtmlOutput(html);
  else {
    try { out = HtmlService.createHtmlOutputFromFile('Index'); }
    catch (e) { out = HtmlService.createHtmlOutput('<p style="font:18px sans-serif;padding:24px">Oyun şu an yüklenemedi. Birkaç dakika sonra tekrar deneyin.</p>'); }
  }
  return out
    .setTitle('Siber Adalar')
    .setFaviconUrl(IKON_URL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- Ekranı GitHub'dan okuma ----------
   Sayfa önbellekten verilir (6 saat). Zamanlayıcı her 5 dakikada GitHub'dan yeni sürümü çeker. */
function sayfaGetir_() { return onbellektenSayfa_() || sayfaTazele(); }

function onbellektenSayfa_() {
  const c = CacheService.getScriptCache();
  const n = parseInt(c.get('sa:sayfa:n') || '0', 10);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push('sa:sayfa:' + i);
  const p = c.getAll(keys);
  let s = '';
  for (let i = 0; i < n; i++) { if (p['sa:sayfa:' + i] == null) return null; s += p['sa:sayfa:' + i]; }
  return s;
}

function sayfaTazele() {
  let html = null;
  try {
    const r = UrlFetchApp.fetch(SAYFA_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) {
      html = r.getContentText('UTF-8');
      if (html.indexOf('Siber Adalar') < 0) html = null;
    }
  } catch (e) { html = null; }
  if (!html) return null;
  const obj = {}, parca = 40000, k = Math.ceil(html.length / parca);
  for (let i = 0; i < k; i++) obj['sa:sayfa:' + i] = html.substr(i * parca, parca);
  obj['sa:sayfa:n'] = String(k);
  try { CacheService.getScriptCache().putAll(obj, 21600); } catch (e) {}
  return html;
}

/* Bir kez çalıştırın: E-Tablo sayfalarını hazırlar, 5 dakikalık zamanlayıcıyı kurar, ekranı önbelleğe alır. */
function kurulum() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sayfaTazele') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sayfaTazele').timeBased().everyMinutes(5).create();
  CacheService.getScriptCache().remove('sa:hazir');
  kurulum_();
  const ok = sayfaTazele();
  Logger.log(ok ? 'Hazır: oyun GitHub\'dan yüklendi (' + ok.length + ' karakter).' : 'Uyarı: GitHub\'dan oyun alınamadı.');
}

/* ---------- E-Tablo sayfaları ---------- */
function kurulum_() {
  if (CacheService.getScriptCache().get('sa:hazir')) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Ayarlar')) {
    const s = ss.insertSheet('Ayarlar', 0);
    s.getRange('A1:B1').setValues([['Öğretmen PIN\'i', '']]);
    s.getRange('A3').setValue('B1 hücresine en az 4 haneli bir PIN yazın. Oyundaki öğretmen paneline bu PIN ile girilir.');
    s.getRange('B1').setNumberFormat('@');
    s.getRange('A1').setFontWeight('bold');
    s.setColumnWidth(1, 160);
  }
  if (!ss.getSheetByName('Sınıflar')) {
    const s = ss.insertSheet('Sınıflar', 1);
    s.getRange('A1:C1').setValues([['Sınıf', 'Sınıf kodu', 'Öğrenci']]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  let p = ss.getSheetByName('İlerleme');
  if (!p) {
    p = ss.insertSheet('İlerleme', 2);
    p.getRange(1, 1, 1, BASLIK.length).setValues([BASLIK]).setFontWeight('bold');
    p.setFrozenRows(1);
    p.hideColumns(BASLIK.length);
  }
  const def = ss.getSheetByName('Sayfa1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 3 && def.getLastRow() === 0) ss.deleteSheet(def);
  CacheService.getScriptCache().put('sa:hazir', '1', 21600);
}

/* ---------- Yardımcılar ---------- */
const kodNorm_ = k => String(k || '').trim().toLocaleUpperCase('tr').replace(/\s+/g, '');
const isimNorm_ = n => String(n || '').trim().replace(/\s+/g, ' ');

function siniflariOku_() {
  const c = CacheService.getScriptCache(), hit = c.get('sa:siniflar');
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
  try { c.put('sa:siniflar', JSON.stringify(siniflar), 120); } catch (e) {}
  return siniflar;
}

function satirBul_(sh, kod, isim) {
  if (sh.getLastRow() < 2) return null;
  const n = BASLIK.length, v = sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues();
  for (let i = 0; i < v.length; i++) if (kodNorm_(v[i][0]) === kod && isimNorm_(v[i][1]) === isim) return { satir: i + 2, veri: v[i][n - 1] };
  return null;
}

/* ---------- Oyunun çağırdığı işlevler (google.script.run) ---------- */
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

function ilerlemeKaydet(kod, isim, d) {
  const kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(15000);
    kod = kodNorm_(kod); isim = isimNorm_(isim); d = d || {};
    const sinif = siniflariOku_()[kod];
    if (!sinif || sinif.students.indexOf(isim) < 0) return { ok: false, error: 'ogrenci' };
    const w = d.dunyalar || {};
    const puan = id => (w[id] && w[id].tamam) ? w[id].puan : '';
    const toplam = DUNYA_IDLER.reduce((t, id) => t + ((w[id] && w[id].puan) || 0), 0);
    const hepsi = DUNYA_IDLER.every(id => w[id] && w[id].tamam);
    const deger = [kod, isim].concat(DUNYA_IDLER.map(puan), [toplam, hepsi ? 'Kazandı' : ''],
      DUNYA_IDLER.map(id => (w[id] && w[id].cikis) || ''), [new Date(), JSON.stringify(d)]);
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('İlerleme');
    const r = satirBul_(sh, kod, isim);
    if (r) sh.getRange(r.satir, 1, 1, deger.length).setValues([deger]); else sh.appendRow(deger);
    CacheService.getScriptCache().remove('sa:lider:' + kod);
    return { ok: true };
  } finally {
    try { kilit.releaseLock(); } catch (e) {}
  }
}

/* En iyi 5: sınıfın en yüksek toplam puanlı öğrencileri. Bütün sınıf aynı anda bassa da
   E-Tablo bir kez okunsun diye liste 60 saniye önbellekte tutulur; yeni kayıt gelince silinir. */
function enIyiler(kod, isim) {
  kod = kodNorm_(kod); isim = isimNorm_(isim);
  if (!siniflariOku_()[kod]) return { ok: false, error: 'sinif' };
  const c = CacheService.getScriptCache(), key = 'sa:lider:' + kod;
  let liste = null;
  const hit = c.get(key); if (hit) { try { liste = JSON.parse(hit); } catch (e) {} }
  if (!liste) {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('İlerleme'), n = BASLIK.length;
    const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues() : [];
    liste = [];
    rows.forEach(r => {
      if (kodNorm_(r[0]) !== kod) return;
      let d = null; try { d = JSON.parse(r[n - 1] || 'null'); } catch (e) {}
      const w = (d && d.dunyalar) || {};
      const toplam = DUNYA_IDLER.reduce((t, id) => t + ((w[id] && w[id].puan) || 0), 0);
      if (!toplam) return;
      liste.push({ name: isimNorm_(r[1]), toplam: toplam, ada: DUNYA_IDLER.filter(id => w[id] && w[id].tamam), avatar: (d && d.avatar) || null, t: (d && d.guncelleme) || 0 });
    });
    liste.sort((a, b) => b.toplam - a.toplam || b.ada.length - a.ada.length || a.t - b.t);
    try { c.put(key, JSON.stringify(liste), 60); } catch (e) {}
  }
  const i = liste.findIndex(r => r.name === isim);
  return { ok: true, liste: liste.slice(0, 5), sira: i + 1, benim: i >= 0 ? liste[i] : null };
}

function ogretmenVerisi(pin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dogru = String(ss.getSheetByName('Ayarlar').getRange('B1').getValue() || '').trim();
  if (!dogru) return { ok: false, error: 'pin-yok' };
  if (String(pin || '').trim() !== dogru) { Utilities.sleep(800); return { ok: false, error: 'pin' }; }
  CacheService.getScriptCache().remove('sa:siniflar');
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
