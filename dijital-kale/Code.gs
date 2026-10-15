/**
 * Dijital Kale Macerası — Google Apps Script sunucu kodu
 * 4. Sınıf · 2. Ünite · Dijital Vatandaşlık
 *
 * Kurulum özeti:
 *  1. Cevapların tutulacağı Google E-Tablo'yu açın → Uzantılar → Apps Script.
 *  2. Bu dosyanın tamamını Kod.gs içine yapıştırıp kaydedin.
 *  3. Üstteki işlev listesinden "kurulum"u seçip bir kez Çalıştır'a basın (izinleri onaylayın).
 *  4. Dağıt → Yeni dağıtım → Tür: Web uygulaması
 *       Yürütme: Ben   |   Erişim: Herkes
 *  5. E-Tablodaki "Ayarlar" sayfasında B1 hücresine öğretmen PIN'inizi yazın.
 *
 * Güncellemeler: Uygulamanın ekranı (Index.html) GitHub'daki
 * lamiaaktas/kodlama_atolyesi deposunun dijital-kale klasöründen okunur.
 * Ekran güncellemeleri için bu dosyaya dokunmanız gerekmez; yeni sürüm
 * en geç 5 dakikada kendiliğinden gelir. Projeye ayrıca "Index" adlı bir
 * HTML dosyası eklerseniz, GitHub'a ulaşılamadığında yedek olarak kullanılır.
 *
 * Bu E-Tablo veritabanıdır:
 *   Ayarlar   → B1 hücresi: öğretmen PIN'i
 *   Sınıflar  → Sınıf | Sınıf kodu | Öğrenci (her satıra bir öğrenci)
 *   Kayıtlar  → öğrencilerin her kaydı (otomatik dolar, elle düzenlemeyin)
 *   "4-A · Ders 1" gibi sayfalar → portaldaki "E-Tabloya aktar" düğmesiyle oluşur
 */

const LESSON_COUNT = 5;
const SAYFA_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/dijital-kale/Index.html';

function doGet() {
  kurulum_();
  let html = sayfaGetir_();
  let out;
  if (html) out = HtmlService.createHtmlOutput(html);
  else {
    try { out = HtmlService.createHtmlOutputFromFile('Index'); }
    catch (e) { out = HtmlService.createHtmlOutput('<p style="font:18px sans-serif;padding:24px">Sayfa şu an yüklenemedi. Birkaç dakika sonra tekrar deneyin.</p>'); }
  }
  return out
    .setTitle('Dijital Kale Macerası')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- Ekranı GitHub'dan okuma ----------
   Sayfa önbellekten verilir (6 saat). Zamanlayıcı her 5 dakikada GitHub'dan yeni sürümü çeker. */
function sayfaGetir_() {
  return onbellektenSayfa_() || sayfaTazele();
}

function onbellektenSayfa_() {
  const c = CacheService.getScriptCache();
  const n = parseInt(c.get('dk:sayfa:n') || '0', 10);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push('dk:sayfa:' + i);
  const p = c.getAll(keys);
  let s = '';
  for (let i = 0; i < n; i++) { if (p['dk:sayfa:' + i] == null) return null; s += p['dk:sayfa:' + i]; }
  return s;
}

function sayfaTazele() {
  let html = null;
  try {
    const r = UrlFetchApp.fetch(SAYFA_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) {
      html = r.getContentText('UTF-8');
      if (html.indexOf('Dijital Kale') < 0) html = null;
    }
  } catch (e) { html = null; }
  if (!html) return null;
  const obj = {}, parca = 40000, k = Math.ceil(html.length / parca);
  for (let i = 0; i < k; i++) obj['dk:sayfa:' + i] = html.substr(i * parca, parca);
  obj['dk:sayfa:n'] = String(k);
  try { CacheService.getScriptCache().putAll(obj, 21600); } catch (e) {}
  return html;
}

/* Bir kez çalıştırın: E-Tablo sayfalarını hazırlar, 5 dakikalık zamanlayıcıyı kurar, ekranı önbelleğe alır. */
function kurulum() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sayfaTazele') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sayfaTazele').timeBased().everyMinutes(5).create();
  kurulum_();
  const ok = sayfaTazele();
  Logger.log(ok ? 'Hazır: ekran GitHub\'dan yüklendi (' + ok.length + ' karakter).' : 'Uyarı: GitHub\'dan ekran alınamadı.');
}

/* ---------- E-Tablo sayfaları ---------- */
function kurulum_() {
  if (CacheService.getScriptCache().get('dk:hazir')) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Ayarlar')) {
    const s = ss.insertSheet('Ayarlar', 0);
    s.getRange('A1:B1').setValues([['Öğretmen PIN\'i', '']]);
    s.getRange('A3').setValue('B1 hücresine en az 4 haneli bir PIN yazın. Öğretmen portalına bu PIN ile girilir.');
    s.getRange('B1').setNumberFormat('@');
    s.getRange('A1').setFontWeight('bold');
    s.setColumnWidth(1, 160);
  }
  if (!ss.getSheetByName('Sınıflar')) {
    const s = ss.insertSheet('Sınıflar', 1);
    s.getRange('A1:C1').setValues([['Sınıf', 'Sınıf kodu', 'Öğrenci']]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName('Kayıtlar')) {
    const s = ss.insertSheet('Kayıtlar', 2);
    s.getRange('A1:E1').setValues([['Zaman', 'Sınıf', 'Ders', 'Öğrenci', 'Durum']]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  const def = ss.getSheetByName('Sayfa1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 3 && def.getLastRow() === 0) ss.deleteSheet(def);
  CacheService.getScriptCache().put('dk:hazir', '1', 21600);
}

/* ---------- Yardımcılar ---------- */
const cache_ = () => CacheService.getScriptCache();
const props_ = () => PropertiesService.getScriptProperties();
const key_ = s => encodeURIComponent(String(s)).slice(0, 200);
const norm_ = s => String(s || '').trim().toLocaleUpperCase('tr').replace(/\s+/g, '');

function readClasses_() {
  const hit = cache_().get('classes');
  if (hit) return JSON.parse(hit);
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sınıflar');
  const out = [];
  if (s && s.getLastRow() > 1) {
    const rows = s.getRange(2, 1, s.getLastRow() - 1, 3).getDisplayValues();
    let cur = null;
    rows.forEach(r => {
      const name = String(r[0]).trim(), code = String(r[1]).trim(), stu = String(r[2]).trim();
      if (name && (!cur || cur.name !== name)) {
        cur = out.find(c => c.name === name);
        if (!cur) { cur = { name: name, code: code, students: [] }; out.push(cur); }
      }
      if (!cur) return;
      if (code && !cur.code) cur.code = code;
      if (stu && cur.students.indexOf(stu) < 0) cur.students.push(stu);
    });
  }
  cache_().put('classes', JSON.stringify(out), 120);
  return out;
}

function pinOk_(pin) {
  let real = cache_().get('pin');
  if (real === null) {
    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ayarlar');
    real = s ? String(s.getRange('B1').getDisplayValue()).trim() : '';
    cache_().put('pin', real, 60);
  }
  return real.length >= 4 && String(pin || '').trim() === real;
}
function needPin_(pin) { if (!pinOk_(pin)) throw new Error('PIN yanlış'); }

/* ---------- Öğrenci ---------- */
function getClass(code) {
  const c = readClasses_().find(x => x.code && norm_(x.code) === norm_(code));
  return c ? { name: c.name, students: c.students } : null;
}

function getLive(cls) {
  const k = 'live_' + key_(cls);
  let v = cache_().get(k);
  if (v === null) { v = props_().getProperty(k) || ''; cache_().put(k, v, 21600); }
  return v ? JSON.parse(v) : null;
}

function getMine(cls, student) {
  const out = {};
  for (let l = 1; l <= LESSON_COUNT; l++) {
    const a = agg_(cls, l);
    if (a[student]) out[l] = a[student];
  }
  return out;
}

function saveState(cls, lesson, student, state) {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kayıtlar')) kurulum_();
  const c = readClasses_().find(x => x.name === cls);
  if (!c || c.students.indexOf(student) < 0) throw new Error('Öğrenci listede yok');
  lesson = Number(lesson);
  if (!(lesson >= 1 && lesson <= LESSON_COUNT)) throw new Error('Ders yok');
  const clean = { ans: state && state.ans || {}, first: state && state.first || {}, done: !!(state && state.done) };
  const json = JSON.stringify(clean);
  if (json.length > 40000) throw new Error('Cevap çok uzun');
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kayıtlar').appendRow([new Date(), cls, lesson, student, json]);
  const lock = LockService.getScriptLock();
  if (lock.tryLock(8000)) {
    try {
      const k = 'agg_' + key_(cls) + '_' + lesson;
      const hit = cache_().get(k);
      if (hit) { const m = JSON.parse(hit); m[student] = clean; cache_().put(k, JSON.stringify(m), 21600); }
    } finally { lock.releaseLock(); }
  } else {
    cache_().remove('agg_' + key_(cls) + '_' + lesson);
  }
  return true;
}

function agg_(cls, lesson) {
  const k = 'agg_' + key_(cls) + '_' + lesson;
  const hit = cache_().get(k);
  if (hit) return JSON.parse(hit);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const again = cache_().get(k);
    if (again) return JSON.parse(again);
    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kayıtlar');
    const m = {};
    if (s && s.getLastRow() > 1) {
      const rows = s.getRange(2, 2, s.getLastRow() - 1, 4).getValues();
      rows.forEach(r => {
        if (String(r[0]) === cls && Number(r[1]) === lesson) {
          try { m[String(r[2])] = JSON.parse(r[3]); } catch (e) {}
        }
      });
    }
    const txt = JSON.stringify(m);
    if (txt.length < 95000) cache_().put(k, txt, 21600);
    return m;
  } finally { lock.releaseLock(); }
}

/* ---------- Öğretmen ---------- */
function tLogin(pin) {
  kurulum_();
  if (!pinOk_(pin)) return { ok: false };
  return { ok: true, classes: readClasses_(), sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
}

function tSetLive(pin, cls, live) {
  needPin_(pin);
  const v = JSON.stringify({ open: !!live.open, lesson: Number(live.lesson) || 1, step: Number(live.step) || 0, at: Date.now() });
  const k = 'live_' + key_(cls);
  props_().setProperty(k, v);
  cache_().put(k, v, 21600);
  return JSON.parse(v);
}

function tGetLive(pin, cls) { needPin_(pin); return getLive(cls); }

function tAgg(pin, cls, lesson) { needPin_(pin); return agg_(cls, Number(lesson)); }

function tSaveClasses(pin, classes) {
  needPin_(pin);
  const words = ['KALE', 'BLOK', 'ELMA', 'BULUT', 'KARTAL', 'ORMAN', 'DENIZ', 'YILDIZ', 'PUSULA', 'FENER'];
  const used = {};
  const rows = [];
  (classes || []).forEach(c => {
    const name = String(c.name || '').trim();
    if (!name) return;
    let code = norm_(c.code);
    while (!code || used[code]) code = words[Math.floor(Math.random() * words.length)] + Math.floor(10 + Math.random() * 90);
    used[code] = true;
    const st = (c.students || []).map(x => String(x).trim()).filter(Boolean);
    if (!st.length) rows.push([name, code, '']);
    st.forEach((x, i) => rows.push([name, i === 0 ? code : '', x]));
  });
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sınıflar');
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 3).clearContent();
  if (rows.length) s.getRange(2, 1, rows.length, 3).setNumberFormat('@').setValues(rows);
  cache_().remove('classes');
  return readClasses_();
}

function tExport(pin, cls, lesson, header, rows) {
  needPin_(pin);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = (String(cls).replace(/[:\\\/?*\[\]]/g, '-') + ' · Ders ' + lesson).slice(0, 90);
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name); else s.clear();
  const data = [header].concat(rows || []);
  s.getRange(1, 1, data.length, header.length).setNumberFormat('@').setValues(data);
  s.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#d9ead3');
  s.setFrozenRows(1); s.setFrozenColumns(1);
  s.autoResizeColumns(1, header.length);
  return ss.getUrl() + '#gid=' + s.getSheetId();
}
