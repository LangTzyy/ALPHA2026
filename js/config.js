// Isi API_URL dengan URL Web App Apps Script (berakhiran /exec)
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwa6QCRtFpJI-lNI2hl_zval0L0yR0EBNqkcaezFWb0yhwJOU4VN2J4R3rLwA3qPrU/exec',
  MAX_LEN: 1000,        // harus sama dengan MAX_LEN di Code.gs
  COOLDOWN_MS: 30000,   // jeda antar kiriman per perangkat
  POLL_MS: 30000        // interval auto-refresh halaman panitia
};
