(() => {
  const { API_URL, POLL_MS } = window.APP_CONFIG;
  const $ = (s) => document.querySelector(s);
  const loginEl = $('#login'), board = $('#board'), grid = $('#grid'), stateEl = $('#state');
  const modal = $('#modal'), dialog = modal.querySelector('.dialog');
  let pw = sessionStorage.getItem('ospro_pw') || '';
  let busy = false, lastCard = null, shown = -1;

  async function api(body) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // ---- Render: semua teks pengguna lewat textContent (aman dari XSS) ----
  function render(items) {
    grid.replaceChildren();
    $('#count').textContent = items.length;
    stateEl.textContent = items.length ? '' : 'Belum ada pesan yang masuk.';
    items.slice().reverse().forEach((it) => {           // terbaru di atas
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'card';
      card.setAttribute('aria-label', `Buka pesan nomor ${it.n}`);
      const flap = document.createElement('span'); flap.className = 'flap';
      const seal = document.createElement('span'); seal.className = 'seal'; seal.textContent = '✉';
      const no = document.createElement('span'); no.className = 'no'; no.textContent = `#${it.n}`;
      const hint = document.createElement('span'); hint.className = 'muted'; hint.textContent = 'Klik untuk membuka';
      card.append(flap, seal, no, hint);
      card.addEventListener('click', () => openLetter(it, card));
      grid.append(card);
    });
  }

  async function load() {
    if (busy) return; busy = true;
    if (!grid.children.length) stateEl.textContent = 'Memuat pesan…';
    try {
      const d = await api({ action: 'list', password: pw });
      if (!d.ok) { if (d.error === 'unauthorized') return logout(); throw new Error(d.error); }
      if (d.items.length !== shown) { shown = d.items.length; render(d.items); }  // hindari re-render tak perlu
      else stateEl.textContent = d.items.length ? '' : 'Belum ada pesan yang masuk.';
    } catch (e) {
      stateEl.textContent = 'Gagal memuat data. Coba Refresh.';
    } finally { busy = false; }
  }

  // ---- Modal: zoom dari posisi card ----
  function openLetter(it, card) {
    lastCard = card;
    $('#m-no').textContent = `Pesan #${it.n}`;
    $('#m-text').textContent = it.msg;
    $('#m-date').textContent = new Date(it.ts).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    const r = card.getBoundingClientRect();
    dialog.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    $('#m-close').focus();
  }
  function closeLetter() {
    if (modal.hidden) return;
    modal.classList.remove('open');
    setTimeout(() => { modal.hidden = true; $('#m-text').textContent = ''; lastCard && lastCard.focus(); }, 250);
  }
  $('#m-close').addEventListener('click', closeLetter);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeLetter(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLetter(); });

  // ---- Auth ----
  function showBoard() {
    loginEl.hidden = true; board.hidden = false; load();
  }
  function logout() {
    sessionStorage.removeItem('ospro_pw'); pw = ''; shown = -1;
    grid.replaceChildren(); board.hidden = true; loginEl.hidden = false;
  }
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn'), st = $('#login-status');
    btn.disabled = true; btn.textContent = 'Memeriksa…'; st.textContent = ''; st.classList.remove('err');
    try {
      const d = await api({ action: 'list', password: $('#pw').value });
      if (!d.ok) { st.textContent = d.error === 'unauthorized' ? 'Password salah.' : 'Terjadi kesalahan server.'; st.classList.add('err'); return; }
      pw = $('#pw').value; sessionStorage.setItem('ospro_pw', pw); $('#pw').value = '';
      shown = d.items.length; showBoard(); render(d.items);
    } catch (err) {
      st.textContent = 'Tidak bisa terhubung ke server.'; st.classList.add('err');
    } finally { btn.disabled = false; btn.textContent = 'Buka'; }
  });
  $('#logout').addEventListener('click', logout);
  $('#refresh').addEventListener('click', load);

  // Auto-refresh hanya saat tab terlihat
  setInterval(() => { if (!board.hidden && !document.hidden) load(); }, POLL_MS);
  if (pw) showBoard();
})();
