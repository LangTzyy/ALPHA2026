(() => {
  const { API_URL, POLL_MS } = window.APP_CONFIG;
  const $ = (s) => document.querySelector(s);
  const loginEl = $("#login"),
    board = $("#board"),
    grid = $("#grid"),
    stateEl = $("#state");
  const modal = $("#modal"),
    dialog = modal.querySelector(".dialog");
  let pw = sessionStorage.getItem("ospro_pw") || "";
  let busy = false,
    lastCard = null,
    sig = "",
    current = [],
    randomBusy = false;
  const randomBtn = $("#random");
  const calm = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const stage = $("#stage"),
    sOpen = $("#s-open"),
    sCancel = $("#s-cancel"),
    sStatus = $("#s-status"),
    sparks = $("#sparks"),
    stageEnv = stage.querySelector(".env");
  let stageItem = null,
    stageActive = false,
    stageBusy = false;

  const signature = (items) =>
    items.map((i) => i.id + (i.opened ? "1" : "0")).join(",");

  async function api(body) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  function markDone(card) {
    card.classList.add("done");
    card.disabled = true;
    card.setAttribute("aria-label", "Pesan sudah dibuka");
    card.querySelector(".muted").textContent = "Sudah dibuka";
  }

  // ---- Render: semua teks pengguna lewat textContent (aman dari XSS) ----
  function render(items) {
    current = items;
    sig = signature(items);
    grid.replaceChildren();
    $("#count").textContent = items.length;
    stateEl.textContent = items.length ? "" : "Belum ada pesan yang masuk.";
    items
      .slice()
      .reverse()
      .forEach((it) => {
        // terbaru di atas
        const card = document.createElement("button");
        card.type = "button";
        card.className = "card";
        card.dataset.id = it.id;
        card.setAttribute("aria-label", `Pilih pesan nomor ${it.n}`);
        const flap = document.createElement("span");
        flap.className = "flap";
        const seal = document.createElement("span");
        seal.className = "seal";
        seal.textContent = "✉";
        const no = document.createElement("span");
        no.className = "no";
        no.textContent = `#${it.n}`;
        const hint = document.createElement("span");
        hint.className = "muted";
        hint.textContent = "Klik untuk memilih";
        card.append(flap, seal, no, hint);
        if (it.opened) markDone(card);
        card.addEventListener("click", () => {
          if (it.opened || randomBusy || stageActive) return;
          openStage(it);
        });
        grid.append(card);
      });
    updateRandomBtn();
  }

  async function load() {
    if (busy || stageActive || randomBusy) return;
    busy = true;
    if (!grid.children.length) stateEl.textContent = "Memuat pesan…";
    try {
      const d = await api({ action: "list", password: pw });
      if (!d.ok) {
        if (d.error === "unauthorized") return logout();
        throw new Error(d.error);
      }
      if (signature(d.items) !== sig)
        render(d.items); // hindari re-render tak perlu
      else
        stateEl.textContent = d.items.length
          ? ""
          : "Belum ada pesan yang masuk.";
    } catch (e) {
      console.error("Gagal memuat:", e);
      stateEl.textContent = "Gagal memuat data. Coba Refresh.";
    } finally {
      busy = false;
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const findCard = (id) => [...grid.children].find((c) => c.dataset.id === id);
  const unopened = () => current.filter((i) => !i.opened);

  function updateRandomBtn() {
    randomBtn.disabled = randomBusy || stageActive || unopened().length === 0;
  }

  function markOpened(id) {
    const it = current.find((i) => i.id === id);
    if (it) it.opened = true;
    const c = findCard(id);
    if (c) markDone(c);
    sig = signature(current);
    updateRandomBtn();
  }

  // ---- Efek percikan emas ----
  function burst(n, power) {
    if (calm) return;
    sparks.replaceChildren();
    const colors = ["#f2b84b", "#ffdc8a", "#fff6d6", "#ffffff"];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        d = (90 + Math.random() * 150) * power;
      const sp = document.createElement("span");
      sp.className = "spark";
      sp.style.setProperty("--dx", Math.cos(a) * d + "px");
      sp.style.setProperty("--dy", Math.sin(a) * d + "px");
      sp.style.setProperty("--sz", 4 + Math.random() * 7 + "px");
      sp.style.setProperty("--t", 0.8 + Math.random() * 0.7 + "s");
      sp.style.setProperty("--c", colors[i % colors.length]);
      sparks.append(sp);
    }
  }

  // ---- Panggung: kartu terpilih tetap TERTUTUP sampai tombol "Buka" ditekan ----
  function openStage(it) {
    stageItem = it;
    stageActive = true;
    stageBusy = false;
    const card = findCard(it.id);
    if (card) card.classList.add("chosen");
    $("#s-no").textContent = `Pesan #${it.n}`;
    sStatus.textContent = "";
    sStatus.classList.remove("err");
    stageEnv.classList.remove("open");
    stage.classList.remove("opening");
    sOpen.disabled = sCancel.disabled = false;
    sOpen.textContent = "Buka";
    updateRandomBtn();
    stage.hidden = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        stage.classList.add("show");
        burst(26, 1);
      }),
    );
    sOpen.focus();
  }

  function closeStage() {
    const card = stageItem && findCard(stageItem.id);
    if (card) card.classList.remove("chosen");
    stageActive = false;
    stageBusy = false;
    stageItem = null;
    stage.classList.remove("show");
    setTimeout(() => {
      if (stageActive) return; // dibuka lagi saat menunggu
      stage.hidden = true;
      stageEnv.classList.remove("open");
      stage.classList.remove("opening");
    }, 380);
    updateRandomBtn();
  }

  function stageFail(msg) {
    stageBusy = false;
    sOpen.disabled = sCancel.disabled = false;
    sOpen.textContent = "Buka";
    sStatus.textContent = msg;
    sStatus.classList.add("err");
    sOpen.focus();
  }

  // Klaim di server dulu, baru isi pesan ditampilkan. Sekali dibuka = tidak bisa dibuka lagi.
  async function confirmOpen() {
    if (!stageItem || stageBusy) return;
    const it = stageItem;
    stageBusy = true;
    sOpen.disabled = sCancel.disabled = true;
    sOpen.textContent = "Membuka…";
    sStatus.textContent = "";
    sStatus.classList.remove("err");
    let d;
    try {
      d = await api({ action: "open", password: pw, id: it.id });
    } catch (e) {
      return stageFail("Gagal membuka pesan. Periksa koneksi lalu coba lagi.");
    }
    if (!d.ok && d.error === "unauthorized") {
      closeStage();
      return logout();
    }
    if (!d.ok && d.error !== "already_opened")
      return stageFail("Gagal membuka pesan. Coba lagi.");
    markOpened(it.id);
    if (!d.ok) {
      // sudah dibuka di perangkat lain
      closeStage();
      stateEl.textContent = `Pesan #${it.n} sudah dibuka di perangkat lain.`;
      return;
    }
    stage.classList.add("opening");
    stageEnv.classList.add("open");
    burst(40, 1.5);
    await sleep(calm ? 0 : 1250);
    showModal(it, findCard(it.id), true);
    closeStage();
  }
  sOpen.addEventListener("click", confirmOpen);
  sCancel.addEventListener("click", () => {
    if (!stageBusy) closeStage();
  });

  // ---- Acak: shuffle kartu (riffle -> kipas -> sorotan melambat -> kartu terpilih) ----
  async function shuffleShow() {
    const wrap = $("#shuffle"),
      deck = $("#sh-deck"),
      label = $("#sh-label");
    const N = 12,
      sx = innerWidth < 520 ? 62 : 95;
    const rest = (i) => `translate(0px,${-i * 1.5}px) rotate(0deg)`;
    const mv = (el, to, dur, delay = 0, ease = "cubic-bezier(.3,.7,.2,1)") => {
      const from = getComputedStyle(el).transform;
      const a = el.animate([{ transform: from }, { transform: to }], {
        duration: dur,
        delay,
        easing: ease,
        fill: "both",
      });
      return a.finished.then(() => {
        el.style.transform = to;
        a.cancel();
      });
    };

    deck.replaceChildren();
    let cards = Array.from({ length: N }, (_, i) => {
      const c = document.createElement("div");
      c.className = "sh-card";
      c.innerHTML = "<span>✉</span>";
      c.style.zIndex = i;
      c.style.transform = rest(i);
      deck.append(c);
      return c;
    });
    label.textContent = "Mengacak kartu…";
    wrap.hidden = false;
    try {
      await sleep(30);
      wrap.classList.add("show");
      await sleep(450);

      // 1) Riffle shuffle: tumpukan dibelah, lalu kartu saling menyelip
      for (let r = 0; r < 4; r++) {
        const h = N / 2,
          L = cards.slice(0, h),
          R = cards.slice(h);
        await Promise.all([
          ...L.map((c, i) =>
            mv(c, `translate(${-sx}px,${-i * 1.5}px) rotate(-7deg)`, 240),
          ),
          ...R.map((c, i) =>
            mv(c, `translate(${sx}px,${-i * 1.5}px) rotate(7deg)`, 240),
          ),
        ]);
        const order = [];
        for (let i = 0; i < h; i++)
          r % 2 ? order.push(L[i], R[i]) : order.push(R[i], L[i]);
        order.forEach((c, i) => (c.style.zIndex = i));
        await Promise.all(order.map((c, i) => mv(c, rest(i), 170, i * 40)));
        cards = order;
        await sleep(60);
      }

      // 2) Kartu melebar seperti kipas
      label.textContent = "Memilih kartu…";
      const step = Math.min(40, (innerWidth - 170) / (N - 1)),
        mid = (N - 1) / 2;
      const pos = (i, up = 0) =>
        `translate(${(i - mid) * step}px,${Math.abs(i - mid) * 3 - up}px) rotate(${(i - mid) * 6}deg)`;
      await Promise.all(
        cards.map((c, i) =>
          mv(c, pos(i), 520, i * 25, "cubic-bezier(.2,.9,.3,1)"),
        ),
      );
      await sleep(250);

      // 3) Sorotan berpindah-pindah, makin lama makin lambat, berhenti di pemenang
      const winIdx = Math.floor(Math.random() * N),
        steps = 14,
        seq = [];
      let prev = -1;
      for (let k = 0; k < steps - 1; k++) {
        let j;
        do j = Math.floor(Math.random() * N);
        while (j === prev || (k === steps - 2 && j === winIdx));
        seq.push(j);
        prev = j;
      }
      seq.push(winIdx);
      for (let k = 0; k < seq.length; k++) {
        const i = seq[k],
          c = cards[i];
        c.classList.add("hot");
        c.style.zIndex = 50;
        mv(c, pos(i, 34), 120);
        if (k === seq.length - 1) break;
        await sleep(70 + Math.pow(k / (seq.length - 1), 2) * 380);
        c.classList.remove("hot");
        c.style.zIndex = i;
        mv(c, pos(i), 120);
      }

      // 4) Kartu terpilih maju ke tengah, sisanya meredup
      const w = cards[winIdx];
      label.textContent = "Terpilih!";
      cards.forEach((c, i) => {
        if (i === winIdx) return;
        c.style.transition = "opacity .4s";
        c.style.opacity = ".2";
      });
      w.classList.add("win");
      await mv(
        w,
        "translate(0px,-40px) rotate(0deg) scale(1.25)",
        500,
        0,
        "cubic-bezier(.2,1.3,.4,1)",
      );
      await sleep(800);
    } finally {
      wrap.classList.remove("show");
      await sleep(300);
      wrap.hidden = true;
      deck.replaceChildren();
    }
  }

  async function pickRandom() {
    if (randomBusy || stageActive || !modal.hidden) return;
    const pool = unopened();
    if (!pool.length) {
      stateEl.textContent = "Semua pesan sudah dibuka.";
      return;
    }
    randomBusy = true;
    updateRandomBtn();
    stateEl.textContent = "";
    const pick = pool[Math.floor(Math.random() * pool.length)];
    try {
      if (!calm) await shuffleShow();
      const item = current.find((i) => i.id === pick.id);
      if (!item || item.opened) {
        stateEl.textContent = "Daftar berubah. Coba acak lagi.";
        return;
      }
      const card = findCard(item.id);
      if (card) card.scrollIntoView({ block: "center", behavior: "auto" });
      openStage(item);
    } finally {
      randomBusy = false;
      updateRandomBtn();
    }
  }
  randomBtn.addEventListener("click", pickRandom);

  // ---- Modal: zoom dari posisi card ----
  function showModal(it, card, center) {
    lastCard = card;
    $("#m-no").textContent = `Pesan #${it.n}`;
    $("#m-pesan").textContent = it.pesan || "—";
    $("#m-kesan").textContent = it.kesan || "";
    $("#m-pesan").previousElementSibling.textContent = it.kesan
      ? "Pesan"
      : "Pesan & Kesan";
    $("#m-kesan").previousElementSibling.style.display = it.kesan ? "" : "none";
    $("#m-kesan").style.display = it.kesan ? "" : "none";
    $("#m-date").textContent = new Date(it.ts).toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });
    if (center || !card) dialog.style.transformOrigin = "50% 50%";
    else {
      const r = card.getBoundingClientRect();
      dialog.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
    }
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("open"));
    $("#m-close").focus();
  }
  function closeLetter() {
    if (modal.hidden) return;
    modal.classList.remove("open");
    setTimeout(() => {
      modal.hidden = true;
      $("#m-pesan").textContent = "";
      $("#m-kesan").textContent = "";
      lastCard && lastCard.focus();
    }, 250);
  }
  $("#m-close").addEventListener("click", closeLetter);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeLetter();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (stageActive) {
      if (!stageBusy) closeStage();
    } else closeLetter();
  });

  // ---- Auth ----
  function showBoard() {
    loginEl.hidden = true;
    board.hidden = false;
    load();
  }
  function logout() {
    sessionStorage.removeItem("ospro_pw");
    pw = "";
    sig = "";
    current = [];
    grid.replaceChildren();
    board.hidden = true;
    loginEl.hidden = false;
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#login-btn"),
      st = $("#login-status");
    btn.disabled = true;
    btn.textContent = "Memeriksa…";
    st.textContent = "";
    st.classList.remove("err");
    try {
      const d = await api({ action: "list", password: $("#pw").value });
      if (!d.ok) {
        st.textContent =
          d.error === "unauthorized"
            ? "Password salah."
            : "Terjadi kesalahan server.";
        st.classList.add("err");
        return;
      }
      pw = $("#pw").value;
      sessionStorage.setItem("ospro_pw", pw);
      $("#pw").value = "";
      loginEl.hidden = true;
      board.hidden = false;
      render(d.items);
    } catch (err) {
      st.textContent = "Tidak bisa terhubung ke server.";
      st.classList.add("err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Buka";
    }
  });
  $("#logout").addEventListener("click", logout);

  // Auto-refresh hanya saat tab terlihat
  setInterval(() => {
    if (!board.hidden && !document.hidden) load();
  }, POLL_MS);
  if (pw) showBoard();
})();
