/**
 * CANLI DERS — Kodlama Atölyesi'nin canlı ders etkinliği (sunucu tarafı)
 *
 * Kurulum (bir kez):
 *  1. Apps Script'te Kodlama Atölyesi projesini açın. Dosyalar → + → Komut dosyası → adı "CanliDers" olsun,
 *     bu dosyanın içeriğini yapıştırın. (Code.gs'e dokunmayın; şifreniz orada.)
 *  2. Üstteki işlev listesinden "canliDersKurulum"u seçip Çalıştır'a basın. Google yeni izin isteyebilir
 *     (PowerPoint'i PDF'e çevirmek için); onaylayın.
 *  3. Dağıt → Dağıtımları yönet → kalem → Sürüm: Yeni sürüm → Dağıt.
 *
 * Sınıf listeleri ve öğretmen şifresi sitenin kendisininkilerdir. Slaytlar Drive'daki
 * "Kodlama Çalışmaları/Canlı Ders" klasöründe, cevaplar kayıt tablosundaki "Canlı Ders" sayfasında durur.
 * Öğrenciler yalnızca kendi cevaplarını görür; sınıfın cevaplarını yalnızca öğretmen görür.
 */

const CD_SURE = 21600;   // önbellek süresi: 6 saat (üst sınır)
const CD_PARCA = 90000;  // önbellek parça boyutu (karakter)
const CD_BASLIK = ['Zaman', 'Oturum', 'Sınıf', 'Ders', 'Soru no', 'Soru', 'Tür', 'Öğrenci', 'Cevap', 'Doğru mu'];

/* ===================== Öğrenci uçları ===================== */

/** Öğrenci ekranı birkaç saniyede bir sorar: o an tahtada ne var? */
function cdDurum(sinif, ogrenci) {
  const s = cdSinif_(sinif);
  const ad = cdOgrenciKontrol_(s, ogrenci);
  const c = CacheService.getScriptCache();
  c.put('cd:hb:' + cdKisi_(s.ad, ad), String(Date.now()), 600);
  const canli = cdCanliOku_(s.ad);
  if (!canli) return { live: false };
  const ders = cdDersOku_(canli.lessonId);
  const it = ders.items[canli.idx];
  const cevap = (it && it.type === 'question') ? c.get(cdCevapAnahtar_(canli, it.id, s.ad, ad)) : null;
  return {
    live: true,
    sessId: canli.sessId,
    title: ders.title,
    idx: canli.idx,
    total: ders.items.length,
    item: cdOgrenciOgesi_(it, canli.reveal),
    reveal: !!canli.reveal,
    myAnswer: cevap ? JSON.parse(cevap).v : null
  };
}

function cdGorsel(sinif, dosyaId) {
  const s = cdSinif_(sinif);
  const canli = cdCanliOku_(s.ad);
  if (!canli) throw new Error('Şu an canlı ders yok.');
  const ders = cdDersOku_(canli.lessonId);
  const izinli = ders.items.some(function (it) { return it.img === dosyaId || it.bgImg === dosyaId; });
  if (!izinli) throw new Error('Bu görsele erişim yok.');
  return cdGorselOku_(dosyaId);
}

function cdCevap(sinif, ogrenci, sessId, qid, deger) {
  const s = cdSinif_(sinif);
  const ad = cdOgrenciKontrol_(s, ogrenci);
  const canli = cdCanliOku_(s.ad);
  if (!canli || canli.sessId !== sessId) throw new Error('Bu ders bitti.');
  const it = cdDersOku_(canli.lessonId).items[canli.idx];
  if (!it || it.type !== 'question' || it.id !== qid) throw new Error('Öğretmen başka bir sayfaya geçti.');
  if (canli.reveal) throw new Error('Cevaplar kapandı.');
  let v = deger;
  if (it.kind === 'mc' || it.kind === 'poll') v = Number(v);
  if (it.kind === 'tf') v = (v === true || v === 'true');
  if (it.kind === 'short') v = String(v || '').substr(0, 300);
  if (it.kind === 'draw') {
    v = String(v || '');
    if (!/^data:image\//.test(v) || v.length > 95000) throw new Error('Çizim çok büyük.');
  }
  CacheService.getScriptCache().put(cdCevapAnahtar_(canli, it.id, s.ad, ad),
    JSON.stringify({ v: v, t: Date.now() }), CD_SURE);
  return true;
}

/* ===================== Öğretmen ucu ===================== */

function cdOgretmen(sifre, islem, r) {
  sifreKontrol_(sifre);
  r = r || {};
  switch (islem) {
    case 'hepsi': return { lessons: cdDersListesi_(), lives: cdTumCanlilar_() };
    case 'donustur': return cdPptxDonustur_(r.b64, r.name || 'sunum.pptx', r.mime);
    case 'gorselKaydet': return cdGorselKaydet_(r.lessonId, r.data);
    case 'dersKaydet': return cdDersKaydet_(r.lesson);
    case 'dersGetir': return cdDersOku_(r.id);
    case 'dersSil': return cdDersSil_(r.id);
    case 'gorsel': return cdGorselOku_(r.fileId);
    case 'canli': return cdCanliAyarla_(r);
    case 'cevaplar': return cdOgretmenCevaplar_(r.sinif);
    case 'oturumlar': return { sessions: cdJsonOku_('oturumlar.json', []), sheetUrl: depo_().tablo.getUrl() };
    case 'rapor': return cdRapor_(r.sessId);
  }
  throw new Error('Bilinmeyen işlem: ' + islem);
}

/* ===================== Yardımcılar ===================== */

function cdKlasor_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('CD_KLASOR');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const k = altKlasor_(depo_().klasor, 'Canlı Ders');
  p.setProperty('CD_KLASOR', k.getId());
  return k;
}

function cdOzet_(metin) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, metin, Utilities.Charset.UTF_8);
  return d.slice(0, 8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function cdKisi_(sinif, ogrenci) { return cdOzet_(sinif + '|' + ogrenci); }
function cdCevapAnahtar_(canli, qid, sinif, ogrenci) {
  return 'cd:a:' + canli.sessId + ':' + qid + ':' + cdKisi_(sinif, ogrenci);
}

function cdKimlik_() { return Utilities.getUuid().replace(/-/g, '').substr(0, 10); }

function cdSinif_(ad) {
  ad = String(ad || '').trim();
  const s = siniflariGetir().filter(function (x) { return x.ad === ad; })[0];
  if (!s) throw new Error('Sınıf bulunamadı.');
  return s;
}

function cdOgrenciKontrol_(s, ogrenci) {
  const ad = String(ogrenci || '').trim();
  if (s.ogrenciler.indexOf(ad) < 0) throw new Error('Öğrenci listede yok.');
  return ad;
}

function cdDosya_(ad) {
  const id = PropertiesService.getScriptProperties().getProperty('CD_DOSYA_' + ad);
  if (id) {
    try { const f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (e) { }
  }
  return null;
}

function cdJsonOku_(ad, varsayilan) {
  const c = CacheService.getScriptCache();
  const hit = c.get('cd:j:' + ad);
  if (hit) return JSON.parse(hit);
  const f = cdDosya_(ad);
  if (!f) return varsayilan;
  const metin = f.getBlob().getDataAsString('UTF-8');
  if (metin.length < CD_PARCA) { try { c.put('cd:j:' + ad, metin, CD_SURE); } catch (e) { } }
  return JSON.parse(metin);
}

function cdJsonYaz_(ad, nesne) {
  const metin = JSON.stringify(nesne);
  let f = cdDosya_(ad);
  if (f) f.setContent(metin);
  else {
    f = cdKlasor_().createFile(ad, metin, MimeType.PLAIN_TEXT);
    PropertiesService.getScriptProperties().setProperty('CD_DOSYA_' + ad, f.getId());
  }
  const c = CacheService.getScriptCache();
  if (metin.length < CD_PARCA) c.put('cd:j:' + ad, metin, CD_SURE); else c.remove('cd:j:' + ad);
}

function cdBuyukYaz_(anahtar, metin) {
  const o = {}, n = Math.ceil(metin.length / CD_PARCA) || 1;
  for (let i = 0; i < n; i++) o[anahtar + ':' + i] = metin.substr(i * CD_PARCA, CD_PARCA);
  o[anahtar + ':n'] = String(n);
  try { CacheService.getScriptCache().putAll(o, CD_SURE); } catch (e) { }
}

function cdBuyukOku_(anahtar) {
  const c = CacheService.getScriptCache();
  const n = Number(c.get(anahtar + ':n') || 0);
  if (!n) return null;
  const k = [];
  for (let i = 0; i < n; i++) k.push(anahtar + ':' + i);
  const p = c.getAll(k);
  let s = '';
  for (let i = 0; i < n; i++) { if (p[k[i]] == null) return null; s += p[k[i]]; }
  return s;
}

/* ===================== Dersler ve görseller ===================== */

function cdDersListesi_() { return cdJsonOku_('dersler.json', []); }

function cdDersOku_(id) {
  const d = cdJsonOku_('ders_' + id + '.json', null);
  if (!d) throw new Error('Ders bulunamadı.');
  return d;
}

function cdDersKaydet_(ders) {
  if (!ders || !ders.id) throw new Error('Ders bilgisi eksik.');
  const temiz = {
    id: String(ders.id).replace(/[^\w-]/g, ''),
    title: String(ders.title || 'Adsız ders').trim().slice(0, 120),
    items: (ders.items || []).map(function (it) {
      if (it.type === 'slide') return { id: String(it.id || cdKimlik_()), type: 'slide', img: String(it.img) };
      return {
        id: String(it.id || cdKimlik_()), type: 'question', kind: it.kind,
        text: String(it.text || '').slice(0, 500),
        options: (it.options || []).map(String),
        correct: it.correct == null ? null : it.correct,
        accepted: (it.accepted || []).map(String),
        bgImg: it.bgImg || null
      };
    }),
    updated: new Date().toISOString()
  };
  cdJsonYaz_('ders_' + temiz.id + '.json', temiz);
  const slaytlar = temiz.items.filter(function (i) { return i.type === 'slide'; });
  const liste = cdDersListesi_().filter(function (d) { return d.id !== temiz.id; });
  liste.unshift({
    id: temiz.id, title: temiz.title, updated: temiz.updated,
    slides: slaytlar.length, questions: temiz.items.length - slaytlar.length,
    cover: slaytlar.length ? slaytlar[0].img : null
  });
  cdJsonYaz_('dersler.json', liste);
  return { lesson: temiz, lessons: liste };
}

function cdDersSil_(id) {
  const d = cdJsonOku_('ders_' + id + '.json', null);
  if (d) {
    d.items.forEach(function (it) {
      if (it.type === 'slide' && it.img) { try { DriveApp.getFileById(it.img).setTrashed(true); } catch (e) { } }
    });
    const f = cdDosya_('ders_' + id + '.json');
    if (f) f.setTrashed(true);
    CacheService.getScriptCache().remove('cd:j:ders_' + id + '.json');
  }
  const liste = cdDersListesi_().filter(function (x) { return x.id !== id; });
  cdJsonYaz_('dersler.json', liste);
  return { lessons: liste };
}

function cdGorselKaydet_(dersId, veri) {
  if (!/^data:image\//.test(String(veri || ''))) throw new Error('Görsel verisi geçersiz.');
  const k = altKlasor_(cdKlasor_(), 'Slaytlar');
  const f = k.createFile('ders_' + dersId + '_' + Date.now() + '.txt', veri, MimeType.PLAIN_TEXT);
  cdBuyukYaz_('cd:g:' + f.getId(), veri);
  return f.getId();
}

function cdGorselOku_(id) {
  const hit = cdBuyukOku_('cd:g:' + id);
  if (hit) return hit;
  const veri = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8');
  cdBuyukYaz_('cd:g:' + id, veri);
  return veri;
}

/* PowerPoint → Google Slaytlar → PDF (sayfalar tarayıcıda resme çevrilir) */
function cdPptxDonustur_(b64, ad, mime) {
  mime = mime || 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const token = ScriptApp.getOAuthToken();
  const sinir = 'canliders' + Date.now();
  const meta = { name: 'gecici_' + ad, mimeType: 'application/vnd.google-apps.presentation', parents: [cdKlasor_().getId()] };
  const govde = Utilities.newBlob('--' + sinir + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(meta) + '\r\n--' + sinir + '\r\nContent-Type: ' + mime + '\r\n\r\n').getBytes()
    .concat(Utilities.base64Decode(b64))
    .concat(Utilities.newBlob('\r\n--' + sinir + '--').getBytes());
  const yukle = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'post', contentType: 'multipart/related; boundary=' + sinir, payload: govde,
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  if (yukle.getResponseCode() >= 300) {
    throw new Error('PowerPoint dönüştürülemedi. Sunumu PowerPoint\'te PDF olarak kaydedip onu yükleyin. (' + yukle.getResponseCode() + ')');
  }
  const id = JSON.parse(yukle.getContentText()).id;
  try {
    const pdf = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=application/pdf', {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
    if (pdf.getResponseCode() >= 300) throw new Error('Sunum PDF\'e çevrilemedi (çok büyük olabilir). PowerPoint\'te PDF olarak kaydedip yükleyin.');
    return Utilities.base64Encode(pdf.getContent());
  } finally {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { }
  }
}

/* ===================== Canlı durum ===================== */

function cdCanliOku_(sinif) {
  const k = 'CD_CANLI_' + cdOzet_(sinif);
  const c = CacheService.getScriptCache();
  const hit = c.get(k);
  if (hit) return hit === 'yok' ? null : JSON.parse(hit);
  const p = PropertiesService.getScriptProperties().getProperty(k);
  c.put(k, p || 'yok', CD_SURE);
  return p ? JSON.parse(p) : null;
}

function cdCanliYaz_(sinif, canli) {
  const k = 'CD_CANLI_' + cdOzet_(sinif);
  const c = CacheService.getScriptCache();
  if (canli) {
    const m = JSON.stringify(canli);
    c.put(k, m, CD_SURE);
    PropertiesService.getScriptProperties().setProperty(k, m);
  } else {
    c.put(k, 'yok', CD_SURE);
    PropertiesService.getScriptProperties().deleteProperty(k);
  }
}

function cdTumCanlilar_() {
  const o = {};
  siniflariGetir().forEach(function (s) { const c = cdCanliOku_(s.ad); if (c) o[s.ad] = c; });
  return o;
}

/** Öğrenciye giden öğe: doğru cevap yalnızca öğretmen "doğruyu göster" deyince eklenir. */
function cdOgrenciOgesi_(it, acik) {
  if (!it) return null;
  if (it.type === 'slide') return { id: it.id, type: 'slide', img: it.img };
  const o = { id: it.id, type: 'question', kind: it.kind, text: it.text, options: it.options, bgImg: it.bgImg || null };
  if (acik) { o.correct = it.correct; o.accepted = it.accepted; }
  return o;
}

function cdCanliAyarla_(r) {
  const s = cdSinif_(r.sinif);
  let canli = cdCanliOku_(s.ad);
  if (canli) cdAnlikKaydet_(s, canli);   // sayfa değişmeden önce cevapları tabloya yaz

  if (r.end) { cdCanliYaz_(s.ad, null); return null; }

  if (r.start || !canli) {
    const ders = cdDersOku_(r.lessonId);
    canli = { sessId: cdKimlik_(), lessonId: ders.id, idx: 0, reveal: false, startedAt: new Date().toISOString() };
    const oturumlar = cdJsonOku_('oturumlar.json', []);
    oturumlar.unshift({ sessId: canli.sessId, sinif: s.ad, lessonId: ders.id, lessonTitle: ders.title, date: canli.startedAt });
    cdJsonYaz_('oturumlar.json', oturumlar.slice(0, 300));
    // Canlı Ders kartı bu sınıfta kilitliyse aç
    try { if (etkinlikDurumu(s.ad).canli !== true) etkinlikKaydet(OGRETMEN_SIFRESI, s.ad, { canli: true }); } catch (e) { }
  }
  const ders = cdDersOku_(canli.lessonId);
  if (r.idx != null) {
    const yeni = Math.max(0, Math.min(ders.items.length - 1, Number(r.idx)));
    if (yeni !== canli.idx) { canli.idx = yeni; canli.reveal = false; }
  }
  if (r.reveal != null) canli.reveal = !!r.reveal;
  canli.updated = Date.now();
  cdCanliYaz_(s.ad, canli);
  return canli;
}

function cdCevaplariTopla_(s, canli, it) {
  const k = s.ogrenciler.map(function (o) { return cdCevapAnahtar_(canli, it.id, s.ad, o); });
  const hepsi = k.length ? CacheService.getScriptCache().getAll(k) : {};
  const sonuc = {};
  s.ogrenciler.forEach(function (o, i) { if (hepsi[k[i]]) sonuc[o] = JSON.parse(hepsi[k[i]]); });
  return sonuc;
}

function cdOgretmenCevaplar_(sinif) {
  const s = cdSinif_(sinif);
  const hk = s.ogrenciler.map(function (o) { return 'cd:hb:' + cdKisi_(s.ad, o); });
  const hb = hk.length ? CacheService.getScriptCache().getAll(hk) : {};
  const simdi = Date.now(), bagli = {};
  s.ogrenciler.forEach(function (o, i) { if (hb[hk[i]]) bagli[o] = Math.round((simdi - Number(hb[hk[i]])) / 1000); });
  const canli = cdCanliOku_(s.ad);
  if (!canli) return { live: null, online: bagli, answers: {} };
  const it = cdDersOku_(canli.lessonId).items[canli.idx];
  return { live: canli, online: bagli, answers: (it && it.type === 'question') ? cdCevaplariTopla_(s, canli, it) : {} };
}

/* ===================== Kayıt ve rapor ===================== */

function cdSayfa_() {
  const t = depo_().tablo;
  let s = t.getSheetByName('Canlı Ders');
  if (!s) {
    s = t.insertSheet('Canlı Ders');
    s.getRange(1, 1, 1, CD_BASLIK.length).setValues([CD_BASLIK]);
    s.setFrozenRows(1);
  }
  return s;
}

function cdNormal_(m) { return String(m || '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' '); }

function cdDogruMu_(it, v) {
  if ((it.kind === 'mc' || it.kind === 'tf') && it.correct != null) return v === it.correct ? 'Evet' : 'Hayır';
  if (it.kind === 'short' && it.accepted && it.accepted.length) {
    const n = cdNormal_(v);
    return it.accepted.some(function (a) { return cdNormal_(a) === n; }) ? 'Evet' : 'Hayır';
  }
  return '';
}

function cdCevapMetni_(it, v) {
  if (it.kind === 'mc' || it.kind === 'poll') return it.options[v] != null ? it.options[v] : String(v);
  if (it.kind === 'tf') return v ? 'Doğru' : 'Yanlış';
  if (it.kind === 'draw') return v.length < 49000 ? v : '(çizim)';
  return String(v);
}

/** O anki sorunun yeni ya da değişen cevaplarını tabloya ekler. */
function cdAnlikKaydet_(s, canli) {
  const ders = cdJsonOku_('ders_' + canli.lessonId + '.json', null);
  if (!ders) return;
  const it = ders.items[canli.idx];
  if (!it || it.type !== 'question') return;
  const cevaplar = cdCevaplariTopla_(s, canli, it);
  const c = CacheService.getScriptCache();
  const ik = 'cd:snap:' + canli.sessId + ':' + it.id;
  const imza = JSON.parse(c.get(ik) || '{}');
  const no = ders.items.slice(0, canli.idx + 1).filter(function (x) { return x.type === 'question'; }).length;
  const satirlar = [];
  Object.keys(cevaplar).forEach(function (ad) {
    const cv = cevaplar[ad];
    if (imza[ad] === cv.t) return;
    imza[ad] = cv.t;
    satirlar.push([new Date(cv.t), canli.sessId, s.ad, ders.title, no, it.text, it.kind, ad, cdCevapMetni_(it, cv.v), cdDogruMu_(it, cv.v)]);
  });
  if (!satirlar.length) return;
  const kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    const sayfa = cdSayfa_();
    sayfa.getRange(sayfa.getLastRow() + 1, 1, satirlar.length, CD_BASLIK.length).setValues(satirlar);
  } finally { kilit.releaseLock(); }
  c.put(ik, JSON.stringify(imza), CD_SURE);
}

function cdRapor_(sessId) {
  const o = cdJsonOku_('oturumlar.json', []).filter(function (x) { return x.sessId === sessId; })[0];
  if (!o) throw new Error('Oturum bulunamadı.');
  let s = null;
  try { s = cdSinif_(o.sinif); } catch (e) { }
  const canli = s ? cdCanliOku_(s.ad) : null;
  if (s && canli && canli.sessId === sessId) cdAnlikKaydet_(s, canli);
  const sayfa = cdSayfa_();
  const son = sayfa.getLastRow();
  const v = son > 1 ? sayfa.getRange(2, 1, son - 1, CD_BASLIK.length).getValues() : [];
  const sorular = {}, cevaplar = {}, adlar = {};
  v.forEach(function (r) {
    if (String(r[1]) !== sessId) return;
    const no = Number(r[4]);
    sorular[no] = { no: no, text: String(r[5]), kind: String(r[6]) };
    cevaplar[no] = cevaplar[no] || {};
    cevaplar[no][String(r[7])] = { answer: String(r[8]), correct: String(r[9]) };
    adlar[String(r[7])] = 1;
  });
  const ogrenciler = s ? s.ogrenciler.slice() : [];
  Object.keys(adlar).forEach(function (a) { if (ogrenciler.indexOf(a) < 0) ogrenciler.push(a); });
  return {
    session: o, students: ogrenciler,
    questions: Object.keys(sorular).map(function (k) { return sorular[k]; }).sort(function (a, b) { return a.no - b.no; }),
    answers: cevaplar
  };
}

/** Bir kez çalıştırın: klasörü ve tablo sayfasını hazırlar, PowerPoint dönüştürme iznini ister. */
function canliDersKurulum() {
  cdKlasor_();
  cdSayfa_();
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  Logger.log('Canlı Ders hazır: ' + cdKlasor_().getUrl());
}
