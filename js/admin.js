(() => {
  const { API_URL, POLL_MS, ALLOW_REREAD } = window.APP_CONFIG;
  const $ = (s) => document.querySelector(s);
  const loginEl = $('#login'), board = $('#board'), grid = $('#grid'), stateEl = $('#state');
  const modal = $('#modal'), dialog = modal.querySelector('.dialog');
  let pw = sessionStorage.getItem('ospro_pw') || '';
  let busy = false, lastCard = null, sig = '', current = [], randomBusy = false;
  const randomBtn = $('#random');

  const signature = (items) => items.map((i) => i.id + (i.opened ? '1' : '0')).join(',');

  async function api(body) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  function markDone(card) {
    card.classList.add('done');
    card.querySelector('.muted').textContent = 'Sudah dibuka';
  }

  // ---- Render: semua teks pengguna lewat textContent (aman dari XSS) ----
  function render(items) {
    current = items; sig = signature(items);
    grid.replaceChildren();
    $('#count').textContent = items.length;
    stateEl.textContent = items.length ? '' : 'Belum ada pesan yang masuk.';
    items.slice().reverse().forEach((it) => {           // terbaru di atas
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'card'; card.dataset.id = it.id;
      card.setAttribute('aria-label', `Buka pesan nomor ${it.n}`);
      const flap = document.createElement('span'); flap.className = 'flap';
      const seal = document.createElement('span'); seal.className = 'seal'; seal.textContent = '✉';
      const no = document.createElement('span'); no.className = 'no'; no.textContent = `#${it.n}`;
      const hint = document.createElement('span'); hint.className = 'muted'; hint.textContent = 'Klik untuk membuka';
      card.append(flap, seal, no, hint);
      if (it.opened) markDone(card);
      card.addEventListener('click', () => openLetter(it, card));
      grid.append(card);
    });
    updateRandomBtn();
  }

  async function load() {
    if (busy) return; busy = true;
    if (!grid.children.length) stateEl.textContent = 'Memuat pesan…';
    try {
      const d = await api({ action: 'list', password: pw });
      if (!d.ok) { if (d.error === 'unauthorized') return logout(); throw new Error(d.error); }
      if (signature(d.items) !== sig) render(d.items);  // hindari re-render tak perlu
      else stateEl.textContent = d.items.length ? '' : 'Belum ada pesan yang masuk.';
    } catch (e) {
      console.error('Gagal memuat:', e);
      stateEl.textContent = 'Gagal memuat data. Coba Refresh.';
    } finally { busy = false; }
  }

  // ---- Buka surat: klaim di server dulu, baru tampilkan ----
  async function openLetter(it, card, fromRandom) {
    if (!it.opened) {
      card.disabled = true; stateEl.textContent = '';
      let d;
      try { d = await api({ action: 'open', password: pw, id: it.id }); }
      catch (e) { card.disabled = false; stateEl.textContent = 'Gagal membuka pesan. Periksa koneksi lalu coba lagi.'; return; }
      card.disabled = false;
      if (!d.ok && d.error === 'unauthorized') return logout();
      if (!d.ok && d.error !== 'already_opened') { stateEl.textContent = 'Gagal membuka pesan. Coba lagi.'; return; }
      it.opened = true; markDone(card); sig = signature(current); updateRandomBtn();
      if (!d.ok && fromRandom) return 'taken';   // sudah dibuka perangkat lain: acak ulang
      if (!d.ok && !ALLOW_REREAD) { stateEl.textContent = `Pesan #${it.n} sudah dibuka di perangkat lain.`; return; }
    } else if (!ALLOW_REREAD) {
      stateEl.textContent = `Pesan #${it.n} sudah pernah dibuka.`; return;
    }
    showModal(it, card);
    return 'shown';
  }

  // ---- Acak: pilih satu kartu yang BELUM dibuka; yang sudah dibuka tidak ikut diacak ----
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const findCard = (id) => [...grid.children].find((c) => c.dataset.id === id);
  const unopened = () => current.filter((i) => !i.opened);

  function updateRandomBtn() {
    randomBtn.disabled = randomBusy || unopened().length === 0;
  }

  async function pickRandom() {
    if (randomBusy || !modal.hidden) return;
    if (!unopened().length) { stateEl.textContent = 'Semua pesan sudah dibuka.'; return; }
    randomBusy = true; updateRandomBtn(); stateEl.textContent = '';
    try {
      for (let tries = 0; tries < 5; tries++) {
        const pool = unopened();
        if (!pool.length) { stateEl.textContent = 'Semua pesan sudah dibuka.'; break; }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;

        // Efek "mengundi": sorot beberapa kartu bergantian, lalu berhenti di kartu terpilih
        const cards = [...grid.querySelectorAll('.card:not(.done)')];
        if (!calm && cards.length > 1) {
          for (let i = 0; i < 8; i++) {
            const c = cards[Math.floor(Math.random() * cards.length)];
            c.classList.add('pick'); await sleep(90); c.classList.remove('pick');
          }
        }
        let card = findCard(pick.id);
        if (!card) break;                                   // daftar berubah saat refresh
        card.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        card.classList.add('pick'); await sleep(calm ? 0 : 500); card.classList.remove('pick');

        card = findCard(pick.id);
        const item = current.find((i) => i.id === pick.id);
        if (!card || !item || item.opened) continue;        // sudah terpilih: acak lagi
        const r = await openLetter(item, card, true);
        if (r !== 'taken') break;
      }
    } finally {
      randomBusy = false; updateRandomBtn();
    }
  }
  randomBtn.addEventListener('click', pickRandom);

  // ---- Modal: zoom dari posisi card ----
  function showModal(it, card) {
    lastCard = card;
    $('#m-no').textContent = `Pesan #${it.n}`;
    $('#m-pesan').textContent = it.pesan || '—';
    $('#m-kesan').textContent = it.kesan || '—';
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
    setTimeout(() => {
      modal.hidden = true; $('#m-pesan').textContent = ''; $('#m-kesan').textContent = '';
      lastCard && lastCard.focus();
    }, 250);
  }
  $('#m-close').addEventListener('click', closeLetter);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeLetter(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLetter(); });

  // ---- Auth ----
  function showBoard() {
    loginEl.hidden = true; board.hidden = false; load();
  }
  function logout() {
    sessionStorage.removeItem('ospro_pw'); pw = ''; sig = ''; current = [];
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
      loginEl.hidden = true; board.hidden = false; render(d.items);
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