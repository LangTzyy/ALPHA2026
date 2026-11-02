(() => {
  const { API_URL, MAX_LEN, COOLDOWN_MS } = window.APP_CONFIG;
  const $ = (s) => document.querySelector(s);
  const form = $('#form'), msg = $('#msg'), send = $('#send'), status = $('#status');
  const counter = $('#counter'), success = $('#success');

  const setStatus = (t, err) => { status.textContent = t; status.classList.toggle('err', !!err); };

  msg.addEventListener('input', () => {
    counter.textContent = `${msg.value.length} / ${MAX_LEN}`;
    if (msg.value.trim()) setStatus('');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = msg.value.trim();
    if (!text) return setStatus('Pesan tidak boleh kosong.', true);
    if (text.length > MAX_LEN) return setStatus(`Maksimal ${MAX_LEN} karakter.`, true);

    // Cooldown sederhana di sisi client untuk mengurangi spam tak sengaja
    const wait = COOLDOWN_MS - (Date.now() - Number(localStorage.getItem('ospro_last') || 0));
    if (wait > 0) return setStatus(`Tunggu ${Math.ceil(wait / 1000)} detik sebelum mengirim lagi.`, true);

    send.disabled = true; send.textContent = 'Mengirim…'; setStatus('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight
        body: JSON.stringify({ action: 'submit', message: text, website: $('#hp').value })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      localStorage.setItem('ospro_last', String(Date.now()));
      form.reset(); counter.textContent = `0 / ${MAX_LEN}`;
      success.hidden = false; $('#ok').focus();
    } catch (err) {
      setStatus('Gagal mengirim. Periksa koneksi lalu coba lagi.', true);
    } finally {
      send.disabled = false; send.textContent = 'Kirim';
    }
  });

  $('#ok').addEventListener('click', () => { success.hidden = true; msg.focus(); });
})();
