// Efek visual saja (parallax & tilt 3D). Tidak menyentuh data, form, atau logika aplikasi.
(() => {
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const calm = matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (!fine || calm) return;

  // Amplop hero mengikuti arah kursor
  const scenes = [...document.querySelectorAll(".scene")];
  addEventListener(
    "pointermove",
    (e) => {
      const x = e.clientX / innerWidth - 0.5,
        y = e.clientY / innerHeight - 0.5;
      scenes.forEach((s) => {
        s.style.setProperty("--ry", (x * 24).toFixed(1));
        s.style.setProperty("--rx", (-y * 16).toFixed(1));
      });
    },
    { passive: true },
  );

  // Card amplop miring mengikuti kursor
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.addEventListener("pointermove", (e) => {
    const c = e.target.closest(".card");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5,
      y = (e.clientY - r.top) / r.height - 0.5;
    c.style.setProperty("--ry", (x * 16).toFixed(1) + "deg");
    c.style.setProperty("--rx", (-y * 16).toFixed(1) + "deg");
  });
  grid.addEventListener("pointerout", (e) => {
    const c = e.target.closest(".card");
    if (c && !c.contains(e.relatedTarget)) {
      c.style.removeProperty("--rx");
      c.style.removeProperty("--ry");
    }
  });
})();
