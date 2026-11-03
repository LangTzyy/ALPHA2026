// Isi API_URL dengan URL Web App Apps Script (berakhiran /exec)
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyz63uHgEIqn5LTxQvv5Wr53fpOnyIUweDltmCJXax3du2gZSejXGWDH72Fvsq8NnDUfA/exec',
  MAX_LEN: 1000,        // batas karakter per kolom (Pesan dan Kesan masing-masing)
  COOLDOWN_MS: 30000,   // jeda antar kiriman per perangkat
  POLL_MS: 30000,       // interval auto-refresh halaman panitia
  ALLOW_REREAD: true    // true = pesan yang sudah dibuka tetap bisa dibaca ulang; false = hanya sekali buka
};
