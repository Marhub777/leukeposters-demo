/* PROEF: het aapje van de A-poster komt tot leven. Drie ideeën tegelijk, om te kiezen. */
(() => {
  const B = window.LP_BASE || "/", IMG = B + "img/tot-leven/", POSTER = B + "kinderposters/alfabet-a-poster/index.html";
  const stil = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const maak = (klasse, beeld, tekst) => {
    const el = document.createElement("div");
    el.className = "aap " + klasse;
    el.innerHTML = `<div class="aap__lijf"><img src="${IMG}${beeld}" alt="" draggable="false"></div><span class="aap__ballon">${tekst} <a href="${POSTER}">Bekijk mijn poster</a></span>`;
    el.addEventListener("click", (e) => { if (e.target.closest("a")) return; e.preventDefault(); e.stopPropagation(); el.classList.toggle("praat"); });
    return el;
  };
  const label = (n, tekst) => Object.assign(document.createElement("span"), { className: "idee idee--" + n, textContent: `Idee ${n}: ${tekst}` });

  // Idee 1: hangt aan de foto in de kop en slingert
  const kop = document.querySelector(".lijstkop__beeld");
  if (kop) kop.append(maak("aap--slinger", "aap-hangen-vrij.webp", "Wiiiee!"), label(1, "slingeren"));

  // Idee 2: loopt heen en weer onderaan het scherm (blijft in beeld bij scrollen), gaat soms zitten om te zwaaien
  {
    const aap = maak("aap--wandel", "aap-lopen-vrij.webp", "Hoi! Ik ben Aap van de A.");
    aap.append(label(2, "wandelen en zwaaien"));
    document.body.append(aap);
    setTimeout(() => aap.classList.add("stil"), 9000);
    const img = aap.querySelector("img");
    const zwaai = new Image(); zwaai.src = IMG + "aap-zwaai.webp";
    let x = 20, richting = 1, pauze = 0, vorige = performance.now(), volgendeStop = 200 + Math.random() * 300;
    const stap = (nu) => {
      const dt = Math.min(50, nu - vorige); vorige = nu;
      const max = innerWidth - aap.offsetWidth - (innerWidth > 700 ? 230 : 90);  // niet door Pim heen
      if (pauze > 0) {
        pauze -= dt;
        if (pauze <= 0) { aap.classList.remove("zit"); img.src = IMG + "aap-lopen-vrij.webp"; }
      } else if (!aap.classList.contains("praat")) {
        x += richting * dt * 0.06;
        if (x > max || x < 0) { richting *= -1; x = Math.max(0, Math.min(max, x)); aap.classList.toggle("links", richting < 0); }
        if (Math.abs(x - volgendeStop) < 2) {
          pauze = 5000; aap.classList.add("zit"); img.src = zwaai.src;
          volgendeStop = Math.random() * max;
        }
      }
      aap.style.transform = `translateX(${x}px)`;
      requestAnimationFrame(stap);
    };
    if (!stil) requestAnimationFrame(stap); else img.src = zwaai.src;
  }

  // Idee 3: gluurt af en toe boven de A-poster uit (en altijd als je erover beweegt)
  const link = document.querySelector('.raster a[href*="alfabet-a-poster"]');
  const kaart = link && link.closest(".kaart");
  if (kaart) {
    kaart.classList.add("kaart--aap");
    const aap = maak("aap--gluur", "aap-gluren-vrij.webp", "Kiekeboe!");
    const vak = kaart.querySelector(".kaart__beeld");
    vak.append(aap, label(3, "kiekeboe"));
    if (!stil) setInterval(() => { aap.classList.add("op"); setTimeout(() => aap.classList.remove("op"), 2200); }, 6000);
  }

  // Uitleg voor Marco en Felix (inklapbaar, op mobiel standaard dicht)
  const uitleg = document.createElement("details");
  uitleg.className = "proefuitleg";
  uitleg.open = false;
  uitleg.innerHTML = `<summary>Proef: Aap van de A-poster leeft</summary><div><ol><li>Slingert aan de foto bovenaan</li><li>Wandelt onderaan het scherm en blijft in beeld als je scrolt. Gaat soms zitten om te zwaaien</li><li>Gluurt boven de A-poster uit</li></ol>Tik op een aapje: hij zegt hoi en linkt naar zijn poster.</div>`;
  document.body.append(uitleg);
})();
