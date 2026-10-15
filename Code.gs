/**
 * KODLAMA ATÖLYESİ — sunucu tarafı (Google Apps Script)
 *
 * Kurulum özeti:
 *  1. script.google.com → Yeni proje. Bu dosyayı Code.gs içine yapıştırın.
 *  2. Dosyalar → + → HTML → adı "Index" olsun; Index.html içeriğini yapıştırın.
 *  3. Aşağıdaki OGRETMEN_SIFRESI değerini değiştirin.
 *  4. Dağıt → Yeni dağıtım → Tür: Web uygulaması
 *       Yürütme: Ben   |   Erişim: Herkes  (okul hesabı ile: "alan adınızdaki herkes")
 *  5. Verilen /exec bağlantısını öğrencilerle paylaşın.
 *
 * Güncellemeler: Sitenin ekranı (Index.html) GitHub'daki
 * lamiaaktas/kodlama_atolyesi deposundan okunur. Ekran güncellemeleri için
 * bu dosyaya ya da Index'e dokunmanız gerekmez. Projedeki Index dosyası
 * yalnızca GitHub'a ulaşılamazsa yedek olarak kullanılır.
 *
 * Not: İnternetten resim arama için Google ilk dağıtımda "harici hizmetlere bağlanma"
 * izni ister; bir kez onaylamanız yeterli.
 *
 * İlk çalıştırmada Drive'ınızda "Kodlama Çalışmaları" klasörü ve içinde
 * "Kodlama Çalışmaları - Kayıtlar" tablosu otomatik oluşur. Sınıf listelerini
 * sitenin öğretmen panelinden (ya da tablodaki "Sınıflar" sayfasından) girin.
 */

const OGRETMEN_SIFRESI = 'degistir-beni';
// Çocuklar karakter eklerken internette resim arayabilsin mi? (Wikimedia Commons, çocuk filtresiyle)
const INTERNET_ARAMASI = true;
const KOK_KLASOR_ADI = 'Kodlama Çalışmaları';
const TABLO_ADI = 'Kodlama Çalışmaları - Kayıtlar';
const SAAT_DILIMI = 'Europe/Istanbul';

const BASLIKLAR = ['Tarih', 'Saat', 'Sınıf', 'Öğrenci', 'Proje dosyası', 'Resim', 'Proje ID', 'Küçük resim', 'Uygulamada aç', 'Yıldız'];

// Sitenin ekranı bu adresten okunur. Güncellemeler GitHub'a gönderildiğinde
// site en geç 5 dakika içinde kendiliğinden yenilenir.
const SAYFA_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/Index.html';
const IKON_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/ikon-192.png';

function doGet() {
  const html = sayfaGetir_();
  const cikti = html ? HtmlService.createHtmlOutput(html) : HtmlService.createHtmlOutputFromFile('Index');
  return cikti
    .setTitle('Kodlama Atölyesi')
    .setFaviconUrl(IKON_URL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* GitHub'daki sayfayı getirir; 5 dk önbellekte tutar; GitHub'a ulaşılamazsa Drive'daki son yedeği kullanır. */
function sayfaGetir_() {
  const c = CacheService.getScriptCache();
  const n = parseInt(c.get('sayfa:n') || '0', 10);
  if (n) {
    const anahtar = [];
    for (let i = 0; i < n; i++) anahtar.push('sayfa:' + i);
    const p = c.getAll(anahtar);
    let s = '';
    for (let i = 0; i < n; i++) { if (p['sayfa:' + i] == null) { s = ''; break; } s += p['sayfa:' + i]; }
    if (s) return s;
  }
  let html = null;
  try {
    const r = UrlFetchApp.fetch(SAYFA_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) {
      html = r.getContentText('UTF-8');
      if (html.indexOf('Kodlama Atölyesi') < 0) html = null;
    }
  } catch (e) { html = null; }
  if (html) yedekYaz_(html); else html = yedekOku_();
  if (!html) return null;
  const obj = {}, parca = 40000, k = Math.ceil(html.length / parca);
  for (let i = 0; i < k; i++) obj['sayfa:' + i] = html.substr(i * parca, parca);
  obj['sayfa:n'] = String(k);
  try { c.putAll(obj, 300); } catch (e) {}
  return html;
}

function yedekYaz_(html) {
  try {
    const p = PropertiesService.getScriptProperties();
    const ozet = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, html, Utilities.Charset.UTF_8));
    if (p.getProperty('SAYFA_OZET') === ozet) return;
    const klasor = depo_().klasor;
    const it = klasor.getFilesByName('site-yedek.html');
    if (it.hasNext()) it.next().setContent(html); else klasor.createFile('site-yedek.html', html, 'text/html');
    p.setProperty('SAYFA_OZET', ozet);
  } catch (e) {}
}

function yedekOku_() {
  try {
    const it = depo_().klasor.getFilesByName('site-yedek.html');
    return it.hasNext() ? it.next().getBlob().getDataAsString('UTF-8') : null;
  } catch (e) { return null; }
}

/* Yeni sürümü 5 dakika beklemeden görmek isterseniz bu işlevi bir kez çalıştırın. */
function siteyiYenile() {
  CacheService.getScriptCache().remove('sayfa:n');
}

/* ---------- depolama ---------- */

function depo_() {
  const p = PropertiesService.getScriptProperties();
  let klasor = null, tablo = null;
  try { klasor = DriveApp.getFolderById(p.getProperty('KLASOR')); } catch (e) { klasor = null; }
  if (!klasor) {
    klasor = DriveApp.createFolder(KOK_KLASOR_ADI);
    p.setProperty('KLASOR', klasor.getId());
  }
  try { tablo = SpreadsheetApp.openById(p.getProperty('TABLO')); } catch (e) { tablo = null; }
  if (!tablo) {
    tablo = SpreadsheetApp.create(TABLO_ADI);
    DriveApp.getFileById(tablo.getId()).moveTo(klasor);
    p.setProperty('TABLO', tablo.getId());
    const g = tablo.getSheets()[0];
    g.setName('Gönderimler');
    g.appendRow(BASLIKLAR);
    g.setFrozenRows(1);
    g.getRange('A:B').setNumberFormat('@');
    const s = tablo.insertSheet('Sınıflar');
    s.appendRow(['Sınıf', 'Öğrenci']);
    s.setFrozenRows(1);
    g.hideColumns(8);
  }
  const g2 = tablo.getSheetByName('Gönderimler');
  if (g2 && !g2.getRange(1, 9).getValue()) g2.getRange(1, 9).setValue('Uygulamada aç');
  if (g2 && !g2.getRange(1, 10).getValue()) g2.getRange(1, 10).setValue('Yıldız');
  if (!tablo.getSheetByName('Profiller')) {
    const pr = tablo.insertSheet('Profiller');
    pr.appendRow(['Sınıf', 'Öğrenci', 'Takma ad', 'Yüz']);
    pr.setFrozenRows(1);
  }
  return { klasor: klasor, tablo: tablo };
}

function altKlasor_(ust, ad) {
  const it = ust.getFoldersByName(ad);
  return it.hasNext() ? it.next() : ust.createFolder(ad);
}

function sifreKontrol_(sifre) {
  if (String(sifre || '') !== OGRETMEN_SIFRESI) throw new Error('Şifre yanlış.');
}

function metinTarih_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SAAT_DILIMI, 'yyyy-MM-dd');
  return String(v || '');
}
function metinSaat_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SAAT_DILIMI, 'HH:mm');
  return String(v || '');
}

function temizAd_(s) {
  return String(s || '').replace(/[\\\/:*?"<>|]/g, '').trim().slice(0, 60);
}

/* ---------- herkese açık ---------- */

function bugun() {
  return Utilities.formatDate(new Date(), SAAT_DILIMI, 'yyyy-MM-dd');
}

function siniflariGetir() {
  const s = depo_().tablo.getSheetByName('Sınıflar');
  const son = s.getLastRow();
  if (son < 2) return [];
  const satirlar = s.getRange(2, 1, son - 1, 2).getValues();
  const sira = [], harita = {};
  satirlar.forEach(function (r) {
    const sinif = String(r[0]).trim(), ogr = String(r[1]).trim();
    if (!sinif) return;
    if (!harita[sinif]) { harita[sinif] = []; sira.push(sinif); }
    if (ogr) harita[sinif].push(ogr);
  });
  const prof = profiller_(s.getParent());
  return sira.map(function (ad) {
    const p = {};
    harita[ad].forEach(function (o) { if (prof[ad + '|' + o]) p[o] = prof[ad + '|' + o]; });
    return { ad: ad, ogrenciler: harita[ad], profiller: p };
  });
}

function profiller_(tablo) {
  const pr = tablo.getSheetByName('Profiller');
  const sonuc = {};
  if (!pr || pr.getLastRow() < 2) return sonuc;
  pr.getRange(2, 1, pr.getLastRow() - 1, 4).getValues().forEach(function (r) {
    let yuz = null;
    try { yuz = r[3] ? JSON.parse(r[3]) : null; } catch (e) { yuz = null; }
    sonuc[String(r[0]) + '|' + String(r[1])] = { lakap: String(r[2] || ''), yuz: yuz };
  });
  return sonuc;
}

function profilKaydet(sinif, ogrenci, lakap, yuz) {
  sinif = String(sinif || '').trim(); ogrenci = String(ogrenci || '').trim();
  const c = siniflariGetir().filter(function (x) { return x.ad === sinif; })[0];
  if (!c || c.ogrenciler.indexOf(ogrenci) < 0) throw new Error('Öğrenci listede yok.');
  lakap = String(lakap || '').replace(/[<>]/g, '').trim().slice(0, 20);
  const yuzMetin = JSON.stringify(yuz || {});
  if (yuzMetin.length > 1500) throw new Error('Profil kaydedilemedi.');
  const pr = depo_().tablo.getSheetByName('Profiller');
  const kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    const son = pr.getLastRow();
    const v = son > 1 ? pr.getRange(2, 1, son - 1, 2).getValues() : [];
    let satir = -1;
    for (let i = 0; i < v.length; i++) if (String(v[i][0]) === sinif && String(v[i][1]) === ogrenci) { satir = i + 2; break; }
    if (satir < 0) pr.appendRow([sinif, ogrenci, lakap, yuzMetin]);
    else pr.getRange(satir, 3, 1, 2).setValues([[lakap, yuzMetin]]);
  } finally {
    kilit.releaseLock();
  }
  return { lakap: lakap, yuz: JSON.parse(yuzMetin) };
}

function calismaGonder(veri) {
  const sinif = String(veri && veri.sinif || '').trim();
  const ogrenci = String(veri && veri.ogrenci || '').trim();
  const proje = String(veri && veri.proje || '');
  const resim = String(veri && veri.resim || '');
  const kucuk = String(veri && veri.kucuk || '');
  const puan = Math.max(0, Math.min(3, parseInt(veri && veri.puan, 10) || 0));

  const sinifObj = siniflariGetir().filter(function (c) { return c.ad === sinif; })[0];
  if (!sinifObj || sinifObj.ogrenciler.indexOf(ogrenci) < 0) {
    throw new Error('Sınıf ya da öğrenci listede yok. Öğretmenine haber ver.');
  }
  if (proje.length > 4000000) throw new Error('Çalışma çok büyük.');

  const d = depo_();
  const simdi = new Date();
  const tarih = Utilities.formatDate(simdi, SAAT_DILIMI, 'yyyy-MM-dd');
  const saat = Utilities.formatDate(simdi, SAAT_DILIMI, 'HH:mm');
  const hedef = altKlasor_(altKlasor_(d.klasor, temizAd_(sinif)), tarih);
  const dosyaAdi = temizAd_(ogrenci) + ' - ' + saat.replace(':', '.');

  const projeDosya = hedef.createFile(Utilities.newBlob(proje, 'application/json', dosyaAdi + '.kodlama.json'));
  let resimUrl = '';
  if (resim.indexOf('base64,') > 0) {
    const b = Utilities.newBlob(Utilities.base64Decode(resim.split('base64,')[1]), 'image/png', dosyaAdi + '.png');
    resimUrl = hedef.createFile(b).getUrl();
  }

  const kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    const g = d.tablo.getSheetByName('Gönderimler');
    g.appendRow([
      tarih, saat, sinif, ogrenci, projeDosya.getUrl(), resimUrl, projeDosya.getId(),
      kucuk.length < 45000 ? kucuk : '', '', puan || ''
    ]);
    const link = acLinki_(projeDosya.getId());
    if (link) g.getRange(g.getLastRow(), 9).setFormula(link);
  } finally {
    kilit.releaseLock();
  }
  return { tamam: true, saat: saat, tarih: tarih, puan: puan };
}

function sonCalismam(sinif, ogrenci) {
  const g = depo_().tablo.getSheetByName('Gönderimler');
  const son = g.getLastRow();
  if (son < 2) return null;
  const v = g.getRange(2, 1, son - 1, 7).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (String(v[i][2]) === sinif && String(v[i][3]) === ogrenci) {
      return DriveApp.getFileById(String(v[i][6])).getBlob().getDataAsString();
    }
  }
  return null;
}

function ayarlar() {
  return { internet: INTERNET_ARAMASI };
}

/* ---------- internetten resim (Wikimedia Commons) ---------- */

const YASAK_ = ['nude','naked','nudity','sex','sexy','porn','erotic','penis','vagina','breast','nipple','genital','xxx','fetish',
  'bdsm','blood','gore','corpse','kill','murder','gun','rifle','pistol','weapon','nazi','swastika','drug','cocaine','cannabis',
  'marijuana','cigarette','tobacco','alcohol','beer','wine','vodka','suicide','torture','execution','war','bomb','terror',
  'çıplak','ciplak','seks','porno','cinsel','meme','silah','tabanca','kan','ölü','olu','uyuşturucu','sigara','içki','bira','şarap','bomba'];

function temizMi_(metin) {
  const t = ' ' + String(metin || '').toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, ' ') + ' ';
  return !YASAK_.some(function (k) { return t.indexOf(' ' + k + ' ') >= 0 || t.indexOf(' ' + k + 's ') >= 0; });
}

function commons_(arama) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6' +
    '&gsrlimit=40&prop=imageinfo&iiprop=url%7Cmime&iiurlwidth=256&gsrsearch=' + encodeURIComponent(arama);
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'Api-User-Agent': 'KodlamaAtolyesi/1.0 (okul projesi)' } });
  if (r.getResponseCode() !== 200) return [];
  const sayfalar = (JSON.parse(r.getContentText()).query || {}).pages || {};
  return Object.keys(sayfalar).map(function (k) { return sayfalar[k]; })
    .sort(function (a, b) { return (a.index || 0) - (b.index || 0); })
    .filter(function (p) {
      const ii = p.imageinfo && p.imageinfo[0];
      return ii && ii.thumburl && /^image\/(png|jpeg|gif|svg\+xml|webp)$/.test(ii.mime) && temizMi_(p.title);
    })
    .map(function (p) { return { url: p.imageinfo[0].thumburl, ad: String(p.title).replace(/^File:/, '').replace(/\.[a-z]+$/i, '') }; });
}

function gorselAra(soru) {
  if (!INTERNET_ARAMASI) throw new Error('İnternet araması kapalı.');
  soru = String(soru || '').trim().slice(0, 40);
  if (!soru) return [];
  if (!temizMi_(soru)) throw new Error('Bunu arayamayız. Başka bir şey dene.');
  const cache = CacheService.getScriptCache();
  const anahtar = 'ara:' + Utilities.base64EncodeWebSafe(soru.toLowerCase()).slice(0, 200);
  const c = cache.get(anahtar);
  if (c) return JSON.parse(c);
  let en = soru;
  try { en = LanguageApp.translate(soru, 'tr', 'en') || soru; } catch (e) {}
  if (!temizMi_(en)) throw new Error('Bunu arayamayız. Başka bir şey dene.');
  const eksi = ' -nude -naked -sex -erotic -blood -weapon';
  let sonuc = commons_(en + ' filetype:drawing' + eksi);
  if (sonuc.length < 12) sonuc = sonuc.concat(commons_(en + ' cartoon filetype:bitmap' + eksi));
  const gor = {};
  sonuc = sonuc.filter(function (x) { if (gor[x.url]) return false; gor[x.url] = 1; return true; }).slice(0, 30);
  try { cache.put(anahtar, JSON.stringify(sonuc), 21600); } catch (e) {}
  return sonuc;
}

/* Tarayıcı resmi doğrudan okuyamazsa sunucu getirir. */
function gorselGetir(url) {
  url = String(url || '');
  if (!/^https:\/\/upload\.wikimedia\.org\//.test(url)) throw new Error('Bu resim alınamadı.');
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'Api-User-Agent': 'KodlamaAtolyesi/1.0 (okul projesi)' } });
  if (r.getResponseCode() !== 200) throw new Error('Bu resim alınamadı.');
  const b = r.getBlob();
  if (b.getBytes().length > 3000000) throw new Error('Resim çok büyük.');
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}

/* Tablodaki "▶ Aç" bağlantısı: çalışmayı sitede inceleme modunda açar. */
function acLinki_(id) {
  const url = ScriptApp.getService().getUrl();
  if (!url) return '';
  return '=HYPERLINK("' + url + '?calisma=' + id + '","▶ Aç")';
}

function calismaGoruntule(id) {
  id = String(id || '');
  if (!/^[\w-]{20,}$/.test(id)) throw new Error('Bağlantı hatalı.');
  const g = depo_().tablo.getSheetByName('Gönderimler');
  const son = g.getLastRow();
  if (son < 2) throw new Error('Çalışma bulunamadı.');
  const v = g.getRange(2, 1, son - 1, 10).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (String(v[i][6]) === id) {
      return {
        proje: DriveApp.getFileById(id).getBlob().getDataAsString(),
        tarih: metinTarih_(v[i][0]), saat: metinSaat_(v[i][1]), sinif: String(v[i][2]), ogrenci: String(v[i][3]),
        puan: parseInt(v[i][9], 10) || 0
      };
    }
  }
  throw new Error('Çalışma bulunamadı.');
}

/* Eski satırlara "▶ Aç" bağlantısı ekler. Öğretmen paneline girişte kendiliğinden çalışır. */
function linkleriEkle() {
  const g = depo_().tablo.getSheetByName('Gönderimler');
  const son = g.getLastRow();
  if (son < 2) return 0;
  const ids = g.getRange(2, 7, son - 1, 1).getValues();
  const linkler = g.getRange(2, 9, son - 1, 1).getFormulas();
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] && !linkler[i][0]) {
      const f = acLinki_(String(ids[i][0]));
      if (f) { g.getRange(i + 2, 9).setFormula(f); n++; }
    }
  }
  return n;
}

/* ---------- öğretmen ---------- */

function ogretmenGiris(sifre) {
  sifreKontrol_(sifre);
  const d = depo_();
  try { linkleriEkle(); } catch (e) {}
  return { klasorUrl: d.klasor.getUrl(), tabloUrl: d.tablo.getUrl() };
}

function calismalariListele(sifre, sinif, tarih, ogrenci) {
  sifreKontrol_(sifre);
  const g = depo_().tablo.getSheetByName('Gönderimler');
  const son = g.getLastRow();
  if (son < 2) return [];
  const v = g.getRange(2, 1, son - 1, 10).getValues();
  const sonuc = [];
  for (let i = v.length - 1; i >= 0; i--) {
    const r = v[i];
    const t = metinTarih_(r[0]);
    if (sinif && String(r[2]) !== sinif) continue;
    if (tarih && t !== tarih) continue;
    if (ogrenci && String(r[3]) !== ogrenci) continue;
    sonuc.push({
      tarih: t, saat: metinSaat_(r[1]), sinif: String(r[2]), ogrenci: String(r[3]),
      projeUrl: String(r[4]), resimUrl: String(r[5]), id: String(r[6]), kucuk: String(r[7] || ''),
      puan: parseInt(r[9], 10) || 0
    });
    if (sonuc.length >= 300) break;
  }
  return sonuc;
}

function calismaAc(sifre, id) {
  sifreKontrol_(sifre);
  return DriveApp.getFileById(id).getBlob().getDataAsString();
}

function siniflariKaydet(sifre, liste) {
  sifreKontrol_(sifre);
  const s = depo_().tablo.getSheetByName('Sınıflar');
  const son = s.getLastRow();
  if (son > 1) s.getRange(2, 1, son - 1, 2).clearContent();
  const satirlar = [];
  (liste || []).forEach(function (c) {
    const ad = String(c.ad || '').trim();
    if (!ad) return;
    const ogr = (c.ogrenciler || []).map(function (x) { return String(x).trim(); }).filter(String);
    if (!ogr.length) satirlar.push([ad, '']);
    ogr.forEach(function (o) { satirlar.push([ad, o]); });
  });
  if (satirlar.length) s.getRange(2, 1, satirlar.length, 2).setValues(satirlar);
  return siniflariGetir();
}
