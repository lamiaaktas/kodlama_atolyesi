/**
 * LEGO ATÖLYESİ SESLENDİRMESİ (Google Cloud Text-to-Speech)
 *
 * Kurulum (bir kez):
 *  1. Apps Script'te Kodlama Atölyesi projesini açın. Dosyalar → + → Komut dosyası → adı "LegoSes" olsun,
 *     bu dosyanın içeriğini yapıştırın. (Code.gs'e dokunmayın; şifreniz orada.)
 *  2. Proje Ayarları → Komut Dosyası Özellikleri → "TTS_ANAHTAR" adıyla Google API anahtarınızı ekleyin.
 *     Klavye Kâşifleri'nde kullandığınız anahtarın aynısını kullanabilirsiniz.
 *  3. Üstteki işlev listesinden "legoSesleriHazirla"yı seçip Çalıştır'a basın (izin isterse onaylayın).
 *     Bütün Lego cümleleri MP3 olarak Drive'daki "Kodlama Çalışmaları/Lego Sesler" klasörüne yazılır.
 *  4. Dağıt → Dağıtımları yönet → kalem → Sürüm: Yeni sürüm → Dağıt.
 *
 * Ses, Klavye Kâşifleri ile aynıdır. Değiştirmek için LEGO_TTS_SES'i değiştirip "legoSesleriHazirla"yı
 * yeniden çalıştırın; yeni ses için dosyalar yeniden üretilir.
 * Site yalnızca lego-ses/liste.json içindeki cümleleri seslendirir; listede olmayan bir cümle için
 * tarayıcının kendi Türkçe sesi kullanılır.
 */
const LEGO_TTS_SES = 'tr-TR-Chirp3-HD-Leda';
const LEGO_TTS_HIZ = 0.95;
const LEGO_SES_LISTE_URL = 'https://raw.githubusercontent.com/lamiaaktas/kodlama_atolyesi/main/lego-ses/liste.json';

function legoSesKlasoru_() {
  return altKlasor_(depo_().klasor, 'Lego Sesler');
}

function legoSesKimlik_(metin) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, LEGO_TTS_SES + '|' + metin, Utilities.Charset.UTF_8);
  return d.slice(0, 8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

/* İzin verilen cümleler (6 saat önbellekte). */
function legoSesListesi_() {
  const c = CacheService.getScriptCache(), hit = c.get('lses:liste');
  if (hit) return JSON.parse(hit);
  const liste = JSON.parse(UrlFetchApp.fetch(LEGO_SES_LISTE_URL + '?t=' + Date.now()).getContentText('UTF-8'));
  const izin = {};
  liste.forEach(function (t) { izin[String(t)] = 1; });
  try { c.put('lses:liste', JSON.stringify(izin), 21600); } catch (e) {}
  return izin;
}

function legoTts_(metin) {
  const anahtar = PropertiesService.getScriptProperties().getProperty('TTS_ANAHTAR');
  if (!anahtar) throw new Error('Proje Ayarları → Komut Dosyası Özellikleri bölümüne TTS_ANAHTAR adıyla API anahtarınızı ekleyin.');
  const r = UrlFetchApp.fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(anahtar), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({
      input: { text: metin },
      voice: { languageCode: 'tr-TR', name: LEGO_TTS_SES },
      audioConfig: { audioEncoding: 'MP3', speakingRate: LEGO_TTS_HIZ }
    })
  });
  if (r.getResponseCode() !== 200) throw new Error('Google seslendirme hatası (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 300));
  return Utilities.base64Decode(JSON.parse(r.getContentText()).audioContent);
}

/* Bir cümlenin MP3'ü: önce önbellek, sonra Drive, en son Google'dan üretip Drive'a yazar. */
function legoSesB64_(metin, klasor, anahtarVar) {
  const id = legoSesKimlik_(metin), c = CacheService.getScriptCache(), k = 'lses:' + id;
  const hit = c.get(k);
  if (hit) return hit;
  const ad = id + '.mp3';
  let b64 = null;
  const it = klasor.getFilesByName(ad);
  if (it.hasNext()) b64 = Utilities.base64Encode(it.next().getBlob().getBytes());
  else if (anahtarVar) {
    const bayt = legoTts_(metin);
    klasor.createFile(Utilities.newBlob(bayt, 'audio/mpeg', ad));
    b64 = Utilities.base64Encode(bayt);
  }
  if (b64) { try { c.put(k, b64, 21600); } catch (e) {} }
  return b64;
}

/* Sitenin çağırdığı işlev: { metin: base64 MP3 } döner. */
function legoSesleri(metinler) {
  const izin = legoSesListesi_();
  const anahtarVar = !!PropertiesService.getScriptProperties().getProperty('TTS_ANAHTAR');
  const liste = (metinler || []).map(function (t) { return String(t || '').trim(); })
    .filter(function (t) { return t && t.length <= 200 && izin[t]; }).slice(0, 8);
  const sonuc = {};
  if (!liste.length) return { ok: true, sesler: sonuc, anahtar: anahtarVar };
  const klasor = legoSesKlasoru_();
  liste.forEach(function (t) {
    try { const b = legoSesB64_(t, klasor, anahtarVar); if (b) sonuc[t] = b; } catch (e) {}
  });
  return { ok: true, sesler: sonuc, anahtar: anahtarVar };
}

/* Bir kez çalıştırın: bütün Lego cümlelerini önceden seslendirir (süre yetmezse yeniden çalıştırın). */
function legoSesleriHazirla() {
  const bas = Date.now();
  CacheService.getScriptCache().remove('lses:liste');
  const liste = Object.keys(legoSesListesi_());
  const klasor = legoSesKlasoru_();
  let yeni = 0;
  for (let i = 0; i < liste.length; i++) {
    if (Date.now() - bas > 4.5 * 60 * 1000) { Logger.log((liste.length - i) + ' cümle kaldı. Süre doldu: "legoSesleriHazirla"yı bir kez daha çalıştırın.'); return; }
    const ad = legoSesKimlik_(liste[i]) + '.mp3';
    if (klasor.getFilesByName(ad).hasNext()) continue;
    klasor.createFile(Utilities.newBlob(legoTts_(liste[i]), 'audio/mpeg', ad));
    yeni++;
  }
  Logger.log('Tamam: ' + liste.length + ' cümle hazır (' + yeni + ' yeni). Ses: ' + LEGO_TTS_SES + '. Klasör: ' + klasor.getUrl());
}
