/**
 * Backend Pesan & Kesan OSPRO TI 2026 (Google Apps Script)
 * Sheet "Pesan": ID | Timestamp | Pesan
 * Password admin disimpan di Script Properties (key: ADMIN_PASSWORD), bukan di kode.
 */
const SHEET_NAME = 'Pesan';
const MAX_LEN = 1000;

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(SHEET_NAME);
  if (!s) {
    s = ss.insertSheet(SHEET_NAME);
    s.appendRow(['ID', 'Timestamp', 'Pesan']);
    s.getRange('C:C').setNumberFormat('@'); // teks polos: cegah formula injection
  }
  return s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

// Semua request lewat POST (password tidak muncul di URL)
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'submit') return json_(submit_(d));
    if (d.action === 'list') return json_(list_(d));
    return json_({ ok: false, error: 'bad_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server_error' });
  }
}

function doGet() { return json_({ ok: true, service: 'pesan-kesan-ospro' }); }

function submit_(d) {
  if (d.website) return { ok: true };           // honeypot: bot diam-diam diabaikan
  const msg = String(d.message || '').trim();
  if (!msg) return { ok: false, error: 'empty' };
  if (msg.length > MAX_LEN) return { ok: false, error: 'too_long' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);                          // aman untuk kiriman bersamaan
  try {
    const s = getSheet_();
    const row = s.getLastRow() + 1;
    s.getRange(row, 1, 1, 3).setNumberFormat('@')
      .setValues([[Utilities.getUuid(), new Date().toISOString(), msg]]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function list_(d) {
  const pw = PropertiesService.getScriptProperties().getProperty('AdminOspro2026');
  if (!pw || String(d.password || '') !== pw) {
    Utilities.sleep(1500);                       // perlambat tebak password
    return { ok: false, error: 'unauthorized' };
  }
  const s = getSheet_();
  const last = s.getLastRow();
  if (last < 2) return { ok: true, items: [] };
  const items = s.getRange(2, 1, last - 1, 3).getValues()
    .map((r, i) => ({ n: i + 1, id: String(r[0]), ts: String(r[1]), msg: String(r[2]) }));
  return { ok: true, items };
}
