/**
 * Backend Pesan & Kesan OSPRO TI 2026 (Google Apps Script)
 * Sheet "Pesan": ID | Timestamp | Pesan | Kesan | Dibuka
 * Kolom "Dibuka": kosong = belum dibuka; berisi waktu ISO = sudah dibuka panitia.
 * Password admin disimpan di Script Properties, bukan di kode.
 *
 * PENTING: setiap Code.gs diubah, buat versi baru:
 * Deploy -> Manage deployments -> (ikon pensil) -> Version: New version -> Deploy.
 */
const SHEET_NAME = 'Pesan';

// Opsional tapi disarankan: isi dengan ID spreadsheet (bagian di antara /d/ dan /edit pada URL Sheets).
// Kalau diisi, data pasti masuk ke spreadsheet itu, apa pun cara script dibuat.
// Kalau dikosongkan, script harus dibuat dari Extensions -> Apps Script di dalam spreadsheet tujuan.
const SPREADSHEET_ID = '';

// Nama Script Property yang berisi password panitia. Dicek berurutan, pakai yang pertama ada.
const PW_PROPERTIES = ['AdminOspro2026', 'ADMIN_PASSWORD'];
const CELL_MAX = 49000; // batas teknis sel Google Sheets (50.000), bukan batasan untuk peserta

function getSpreadsheet_() {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Tidak ada spreadsheet. Isi SPREADSHEET_ID atau buat script dari dalam spreadsheet (Extensions -> Apps Script).');
  return ss;
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let s = ss.getSheetByName(SHEET_NAME);
  if (!s) {
    s = ss.insertSheet(SHEET_NAME);
    s.appendRow(['ID', 'Timestamp', 'Pesan', 'Kesan', 'Dibuka']);
    s.getRange('C:E').setNumberFormat('@'); // teks polos: cegah formula injection
  } else {
    // Migrasi sheet lama: tambah kolom yang belum ada; data lama tetap aman
    if (!s.getRange('D1').getValue()) { s.getRange('D1').setValue('Kesan'); s.getRange('D:D').setNumberFormat('@'); }
    if (!s.getRange('E1').getValue()) { s.getRange('E1').setValue('Dibuka'); s.getRange('E:E').setNumberFormat('@'); }
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
    if (d.action === 'open') return json_(open_(d));
    return json_({ ok: false, error: 'bad_action' });
  } catch (err) {
    console.error(err && err.stack || err); // muncul di menu Executions pada editor Apps Script
    return json_({ ok: false, error: 'server_error' });
  }
}

function doGet() { return json_({ ok: true, service: 'pesan-kesan-ospro', version: 3 }); }

function submit_(d) {
  // Honeypot: field tersembunyi bernama "hp". Kalau terisi, anggap bot dan diabaikan diam-diam.
  if (d.hp) { console.warn('Honeypot terisi, kiriman diabaikan.'); return { ok: true }; }

  // Format lama (d.message) tetap diterima sebagai Pesan agar frontend lama tidak rusak
  const legacy = d.message !== undefined && d.pesan === undefined;
  const pesan = String(legacy ? d.message : d.pesan || '').trim().slice(0, CELL_MAX);
  const kesan = String(d.kesan || '').trim().slice(0, CELL_MAX);
  if (!pesan) return { ok: false, error: 'empty_pesan' };
  if (!legacy && !kesan) return { ok: false, error: 'empty_kesan' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);                          // aman untuk kiriman bersamaan
  let n;
  try {
    const s = getSheet_();
    const row = s.getLastRow() + 1;
    s.getRange(row, 1, 1, 4).setNumberFormat('@')
      .setValues([[Utilities.getUuid(), new Date().toISOString(), pesan, kesan]]);
    SpreadsheetApp.flush();                      // pastikan tertulis sebelum membalas sukses
    n = row - 1;
  } finally {
    lock.releaseLock();
  }
  return { ok: true, n };
}

function authorized_(d) {
  const props = PropertiesService.getScriptProperties();
  let pw = '';
  for (const k of PW_PROPERTIES) { pw = props.getProperty(k); if (pw) break; }
  if (!pw || String(d.password || '') !== pw) {
    Utilities.sleep(1500);                       // perlambat tebak password
    return false;
  }
  return true;
}

function list_(d) {
  if (!authorized_(d)) return { ok: false, error: 'unauthorized' };
  const s = getSheet_();
  const last = s.getLastRow();
  if (last < 2) return { ok: true, items: [] };
  const items = s.getRange(2, 1, last - 1, 5).getValues()
    .map((r, i) => ({
      n: i + 1, id: String(r[0]), ts: String(r[1]), pesan: String(r[2]), kesan: String(r[3] || ''),
      opened: String(r[4] || '') !== ''
    }));
  return { ok: true, items };
}

// Tandai satu pesan sebagai sudah dibuka. Server jadi sumber kebenaran:
// pesan yang sudah dibuka (di perangkat mana pun) dibalas error "already_opened".
function open_(d) {
  if (!authorized_(d)) return { ok: false, error: 'unauthorized' };
  const id = String(d.id || '');
  if (!id) return { ok: false, error: 'bad_id' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const s = getSheet_();
    const last = s.getLastRow();
    if (last < 2) return { ok: false, error: 'not_found' };
    const ids = s.getRange(2, 1, last - 1, 1).getValues();
    const i = ids.findIndex((r) => String(r[0]) === id);
    if (i < 0) return { ok: false, error: 'not_found' };
    const cell = s.getRange(i + 2, 5);
    if (String(cell.getValue() || '') !== '') return { ok: false, error: 'already_opened' };
    cell.setValue(new Date().toISOString());
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
