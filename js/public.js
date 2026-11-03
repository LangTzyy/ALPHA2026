(() => {
  const { API_URL, MAX_LEN, COOLDOWN_MS } = window.APP_CONFIG;
  const $ = (s) => document.querySelector(s);
  const form = $('#form'), pesan = $('#pesan'), kesan = $('#kesan'), send = $('#send'), status = $('#status');
  const cPesan = $('#count-pesan'), cKesan = $('#count-kesan'), success = $('#success');

  const setStatus = (t, err) => { status.textContent = t; status.classList.toggle('err', !!err); };
  const bindCounter = (el, out) => el.addEventListener('input', () => {
    out.textContent = `${el.value.length} / ${MAX_LEN}`;
    if (pesan.value.trim() && kesan.value.trim()) setStatus('');
  });
  bindCounter(pesan, cPesan); bindCounter(kesan, cKesan);

  const ERRORS = {
    empty_pesan: 'Pesan tidak boleh kosong.',
    empty_kesan: 'Kesan tidak boleh kosong.',
    server_error: 'Server bermasalah. Coba lagi sebentar lagi.'
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = pesan.value.trim(), k = kesan.value.trim();
    if (!p) return setStatus(ERRORS.empty_pesan, true);
    if (!k) return setStatus(ERRORS.empty_kesan, true);
    if (p.length > MAX_LEN || k.length > MAX_LEN) return setStatus(`Maksimal ${MAX_LEN} karakter per kolom.`, true);

    // Cooldown sederhana di sisi client untuk mengurangi spam tak sengaja
    const wait = COOLDOWN_MS - (Date.now() - Number(localStorage.getItem('ospro_last') || 0));
    if (wait > 0) return setStatus(`Tunggu ${Math.ceil(wait / 1000)} detik sebelum mengirim lagi.`, true);

    send.disabled = true; send.textContent = 'Mengirim…'; setStatus('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight
        body: JSON.stringify({ action: 'submit', pesan: p, kesan: k, hp: $('#hp').value })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'unknown');
      localStorage.setItem('ospro_last', String(Date.now()));
      form.reset(); cPesan.textContent = cKesan.textContent = `0 / ${MAX_LEN}`;
      success.hidden = false; $('#ok').focus();
    } catch (err) {
      console.error('Kirim gagal:', err);
      setStatus(ERRORS[err.message] || 'Gagal mengirim. Periksa koneksi lalu coba lagi.', true);
    } finally {
      send.disabled = false; send.textContent = 'Kirim';
    }
  });

  $('#ok').addEventListener('click', () => { success.hidden = true; pesan.focus(); });
})();
