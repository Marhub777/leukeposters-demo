/* Vaste vrienden (zie personages-concept.md). Vijf regels:
   1. stil, behalve bij binnenkomst (1 keer per bezoek), aantikken of eerste keer in beeld; nooit op een timer
   2. vaste plek, nooit mee met scrollen   3. elke beweging max 3 seconden
   4. 1 per pagina, praat alleen als je hem aantikt   5. "minder beweging" = stilstaand */
(() => {
  const v = document.querySelector("[data-vriend]");
  if (!v) return;
  const stil = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const id = v.dataset.vriend, beweging = v.dataset.beweging;
  const lijf = v.querySelector(".vriend__lijf"), rust = v.querySelector(".vriend__rust");
  let gezien = false;
  try { gezien = sessionStorage.getItem("lp-vriend-" + id) === "1"; sessionStorage.setItem("lp-vriend-" + id, "1"); } catch (e) {}

  // Zwaaien: animatie 1 keer ophalen na het laden van de pagina, en bij elke keer spelen opnieuw starten via een nieuwe blob-url
  let zwaai = null;
  if (beweging === "zwaai" && !stil) {
    const haal = () => fetch(rust.src.replace(/-rust\.webp(\?.*)?$/, "-zwaai.webp")).then((r) => r.ok && r.blob()).then((b) => { zwaai = b || null; }).catch(() => {});
    document.readyState === "complete" ? haal() : addEventListener("load", haal, { once: true });
  }

  let bezig = false;
  const speel = () => {
    if (stil || bezig) return;
    bezig = true;
    if (beweging === "zwaai" && zwaai) {
      const u = URL.createObjectURL(zwaai), oud = rust.src;
      rust.src = u;
      setTimeout(() => { rust.src = oud; URL.revokeObjectURL(u); bezig = false; }, 3100);
      return;
    }
    v.classList.remove("speelt"); void v.offsetWidth; v.classList.add("speelt");
    setTimeout(() => { v.classList.remove("speelt"); bezig = false; }, 2800);
  };

  const praat = (aan) => { v.classList.toggle("praat", aan); lijf.setAttribute("aria-expanded", String(aan)); };
  lijf.addEventListener("click", (e) => { e.stopPropagation(); const aan = !v.classList.contains("praat"); praat(aan); if (aan) speel(); });
  document.addEventListener("click", (e) => { if (!v.contains(e.target)) praat(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") praat(false); });

  if (!gezien) setTimeout(speel, beweging === "zwaai" ? 1400 : 700);

  // Kiekeboe op zijn eigen poster in het overzicht
  const link = document.querySelector(`.raster .kaart__beeld[href*="/${v.dataset.poster}/"]`);
  const bron = v.querySelector(".vriend__gluren");
  if (!link || !bron) return;
  const kaart = link.closest(".kaart");
  kaart.classList.add("kaart--vriend");
  const gluur = bron.cloneNode();
  gluur.hidden = false;
  gluur.className = "vriend-gluur vriend-gluur--" + id;
  link.prepend(gluur);
  if (stil || !matchMedia("(hover: none)").matches) return;  // desktop: alleen bij hover (css)
  const kijk = new IntersectionObserver((items) => {
    if (!items.some((i) => i.isIntersecting)) return;
    kijk.disconnect();
    setTimeout(() => { kaart.classList.add("kiekeboe"); setTimeout(() => kaart.classList.remove("kiekeboe"), 2200); }, 400);
  }, { threshold: 0.8 });
  kijk.observe(kaart);
})();
