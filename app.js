/* Leukeposters.nl: winkelwagen (2+1 automatisch), verlanglijst, filters, zoeken, productpagina,
   posterhulp en muurplanner. Geen libraries, geen cookies: alles staat in de browser van de bezoeker. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const euro = (n) => "€ " + n.toFixed(2).replace(".", ",");
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lees = (k, std) => { try { return JSON.parse(localStorage.getItem(k)) ?? std; } catch { return std; } };
  const bewaar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privémodus: werkt dan alleen deze pagina */ } };
  const icoon = (naam) => ({
    pijl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    tas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  }[naam]);

  // Winkelregels (gelijk aan inhoud.py; de catalogus levert ze ook mee)
  const FORMATEN = { "30x40": 14.99, "50x70": 29.99, "60x85": 34.99, "70x100": 44.99, "100x140": 64.99 };
  const GRATIS_VANAF = 50, VERZENDKOSTEN = 4.95;
  const ADVIES = {
    "30x40": "Kleine plekken, toilet, boekenkast, fotowanden en trio's.",
    "50x70": "Meest gekozen. Boven dressoir, bureau of kinderbed, of als duo boven de bank.",
    "60x85": "Net iets meer aanwezig dan 50x70. Mooi in de hal of boven een smal bed.",
    "70x100": "Boven de bank of het bed. Eén poster die de ruimte draagt.",
    "100x140": "Statement op een grote muur. Boven een bank van 2 meter of breder.",
  };
  const sleutel = (m) => m.split("x").map(Number).sort((a, b) => a - b).join("x");
  const prijsVan = (m) => FORMATEN[sleutel(m)] ?? 0;

  // Online werkt alles met paden vanaf de root. In de offline demo (losse bestanden) zet demo.py LP_BASE en LP_CATALOGUS.
  const BASE = window.LP_BASE;
  const IMG = BASE ? BASE + "img/" : "/img/";
  const pad = (u) => {
    if (!BASE) return u;
    const [p, q] = u.split("?");
    return BASE + p.slice(1) + (p.endsWith("/") ? "index.html" : "") + (q ? "?" + q : "");
  };
  let catalogusBelofte;
  const catalogus = () => (catalogusBelofte ??= window.LP_CATALOGUS ? Promise.resolve(window.LP_CATALOGUS) : fetch("/data/catalogus.json").then((r) => r.json()));

  /* ---------------- Winkelwagen ---------------- */
  let mand = lees("lp_mand", []);

  function bereken(regels) {
    // 2+1: per 3 posters is de goedkoopste gratis. Gratis stuks gaan naar de goedkoopste regels.
    const stuks = regels.flatMap((r, i) => Array.from({ length: r.a }, () => ({ i, p: prijsVan(r.m) })));
    stuks.sort((a, b) => b.p - a.p);
    const gratis = Math.floor(stuks.length / 3);
    const gratisPerRegel = {};
    stuks.slice(stuks.length - gratis).forEach((s) => { gratisPerRegel[s.i] = (gratisPerRegel[s.i] || 0) + 1; });
    const subtotaal = stuks.reduce((t, s) => t + s.p, 0);
    const korting = stuks.slice(stuks.length - gratis).reduce((t, s) => t + s.p, 0);
    const naKorting = subtotaal - korting;
    const verzending = stuks.length === 0 || naKorting >= GRATIS_VANAF ? 0 : VERZENDKOSTEN;
    return { aantal: stuks.length, subtotaal, korting, verzending, totaal: naKorting + verzending, naKorting, gratisPerRegel };
  }

  function zetInMand(item) {
    const bestaand = mand.find((r) => r.s === item.s && r.m === item.m);
    if (bestaand) bestaand.a += item.a || 1; else mand.push({ a: 1, ...item });
    bewaarMand();
  }
  function bewaarMand() {
    mand = mand.filter((r) => r.a > 0);
    bewaar("lp_mand", mand);
    tekenMand();
  }

  function mandHtml(compact) {
    if (!mand.length) {
      return `<div class="mand__leeg">${$(".logo .merk")?.outerHTML || ""}<p><b>Je winkelwagen is nog leeg.</b><br>Zonde van die muur.</p><a class="knop knop--tomaat" href="${pad("/alle-posters/")}">Bekijk alle posters</a></div>`;
    }
    const b = bereken(mand);
    const regels = mand.map((r, i) => {
      const stukprijs = prijsVan(r.m), gratis = b.gratisPerRegel[i] || 0;
      const totaal = stukprijs * (r.a - gratis);
      return `<div class="mandregel"><img src="${IMG}poster/${r.s}-480.webp" alt="" width="64" height="91" loading="lazy">
        <div><h3><a href="${pad(r.u)}">${esc(r.n)}</a></h3><p>${r.m.replace("x", " × ")} cm · ${euro(stukprijs)}</p>
        ${compact ? "" : ""}<div class="aantal" role="group" aria-label="Aantal ${esc(r.n)}"><button type="button" data-min="${i}" aria-label="Eén minder">−</button><span>${r.a}</span><button type="button" data-plus="${i}" aria-label="Eén meer">+</button></div></div>
        <div class="mandregel__prijs">${gratis ? `<s>${euro(stukprijs * r.a)}</s>` : ""}${euro(totaal)}${gratis ? `<span class="mandregel__gratis">${gratis}× gratis</span>` : ""}</div></div>`;
    }).join("");
    const nogTot = GRATIS_VANAF - b.naKorting;
    const voortgang = nogTot > 0
      ? `<div class="mand__voortgang">Nog <b>${euro(nogTot)}</b> tot gratis verzending<div class="mand__balk"><span style="width:${Math.min(100, (b.naKorting / GRATIS_VANAF) * 100)}%"></span></div></div>`
      : `<div class="mand__voortgang">Je verzending is <b>gratis</b><div class="mand__balk"><span style="width:100%"></span></div></div>`;
    const rest = b.aantal % 3;
    const tip = rest === 2 ? `<p class="mand__tip"><b>Nog 1 poster</b> en de goedkoopste is gratis. <a class="link" href="${pad("/populaire-posters/")}">Kies er nog één</a></p>`
      : rest === 1 && b.aantal > 1 ? `<p class="mand__tip">Nog 2 posters en je krijgt er weer één gratis.</p>` : "";
    return `${voortgang}${regels}${tip}<div class="mand__totaal">
      <div><span>Subtotaal (${b.aantal} ${b.aantal === 1 ? "poster" : "posters"})</span><span>${euro(b.subtotaal)}</span></div>
      ${b.korting ? `<div class="korting"><span>2+1 gratis</span><span>−${euro(b.korting)}</span></div>` : ""}
      <div><span>Verzending</span><span>${b.verzending ? euro(b.verzending) : "Gratis"}</span></div>
      <div class="eind"><span>Totaal</span><span>${euro(b.totaal)}</span></div>
      ${compact ? "" : `<a class="knop knop--tomaat knop--breed" href="${pad("/afrekenen/")}">Afrekenen ${icoon("pijl")}</a><p class="klein" style="text-align:center;margin:6px 0 0">Inclusief btw. In huis binnen 3 tot 4 werkdagen.</p>`}</div>`;
  }

  function tekenMand() {
    const aantal = mand.reduce((t, r) => t + r.a, 0);
    const teller = $("[data-mand-teller]");
    if (teller) { teller.hidden = !aantal; teller.textContent = aantal; }
    $$("[data-mand-inhoud], [data-mand-pagina]").forEach((el) => { el.innerHTML = mandHtml(false); });
    $$("[data-mand-overzicht]").forEach((el) => { el.innerHTML = mandHtml(true); });
  }

  document.addEventListener("click", (ev) => {
    const min = ev.target.closest("[data-min]"), plus = ev.target.closest("[data-plus]");
    if (min) { mand[+min.dataset.min].a--; bewaarMand(); }
    if (plus) { mand[+plus.dataset.plus].a++; bewaarMand(); }
  });

  const lade = $("[data-mand]");
  let laatsteFocus;
  function openMand() {
    if (!lade) return;
    laatsteFocus = document.activeElement;
    lade.hidden = false;
    document.body.style.overflow = "hidden";
    $(".lade__paneel button", lade)?.focus();
  }
  function sluitMand() {
    if (!lade) return;
    lade.hidden = true;
    document.body.style.overflow = "";
    laatsteFocus?.focus?.();
  }
  $$("[data-mand-open]").forEach((k) => k.addEventListener("click", openMand));
  $$("[data-mand-sluit]").forEach((k) => k.addEventListener("click", sluitMand));
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    sluitMand(); sluitZoek(); sluitKiezer();
    const hulp = $("#hulp-paneel"); if (hulp && !hulp.hidden) zetHulp(false);
  });

  /* ---------------- Verlanglijst ---------------- */
  let harten = lees("lp_hart", []);
  function tekenHarten() {
    $$("[data-hart]").forEach((k) => k.setAttribute("aria-pressed", harten.includes(k.dataset.hart)));
    const t = $("[data-hart-teller]");
    if (t) { t.hidden = !harten.length; t.textContent = harten.length; }
  }
  document.addEventListener("click", (ev) => {
    const k = ev.target.closest("[data-hart]");
    if (!k) return;
    ev.preventDefault();
    const s = k.dataset.hart;
    harten = harten.includes(s) ? harten.filter((x) => x !== s) : [...harten, s];
    bewaar("lp_hart", harten);
    tekenHarten();
    const t = $("[data-hart-teller]"); t?.classList.remove("bots"); void t?.offsetWidth; t?.classList.add("bots");
  });

  const miniKaart = (p) => `<a class="mini" href="${pad(p.u)}"><span class="mini__beeld" style="--tint:${p.t}"><img class="lijst--${p.j || "zwart"}" src="${IMG}poster/${p.s}-480.webp" alt="" loading="lazy" width="${p.l ? 1540 : 1080}" height="${p.l ? 1080 : 1540}"></span>${esc(p.n)}</a>`;

  const verlanglijst = $("[data-verlanglijst]");
  if (verlanglijst) {
    catalogus().then((c) => {
      const lijst = c.producten.filter((p) => harten.includes(p.s));
      $("[data-verlanglijst-leeg]").hidden = lijst.length > 0;
      verlanglijst.innerHTML = lijst.map((p) => `<article class="kaart"><a class="kaart__beeld" href="${pad(p.u)}" style="--tint:${p.t}"><img class="kaart__poster lijst--${p.j || "zwart"}" src="${IMG}poster/${p.s}-480.webp" alt="" loading="lazy"></a>
        <button class="kaart__hart" type="button" data-hart="${p.s}" aria-label="Verwijder van je verlanglijst" aria-pressed="true"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>
        <div class="kaart__tekst"><h3><a href="${pad(p.u)}">${esc(p.n)}</a></h3><p>vanaf ${euro(14.99)}</p></div></article>`).join("");
    });
  }

  /* ---------------- Megamenu: voorbeeld wisselt mee met de stijl waar je overheen beweegt ---------------- */
  const mega = $("[data-mega]");
  if (mega) {
    // Beelden pas ophalen als iemand het menu opent: scheelt ruim 40 beelden per pagina
    const laadMega = () => $$("img[data-src]", mega).forEach((im) => { im.src = im.dataset.src.startsWith("/") ? pad(im.dataset.src) : im.dataset.src; im.removeAttribute("data-src"); });
    const uitklap = mega.closest(".nav__item--uitklap");
    ["mouseenter", "focusin", "touchstart"].forEach((ev) => uitklap.addEventListener(ev, laadMega, { once: true, passive: true }));
    const kies = (stijl) => {
      $$("[data-mega-stijl]", mega).forEach((a) => a.classList.toggle("actief", a.dataset.megaStijl === stijl));
      $$("[data-mega-voorbeeld]", mega).forEach((v) => v.classList.toggle("actief", v.dataset.megaVoorbeeld === stijl));
    };
    $$("[data-mega-stijl]", mega).forEach((a) => {
      a.addEventListener("mouseenter", () => kies(a.dataset.megaStijl));
      a.addEventListener("focus", () => kies(a.dataset.megaStijl));
    });
  }

  /* ---------------- Mobiel menu ---------------- */
  const menuKnop = $("[data-menu-knop]"), menu = $("[data-menu]");
  menuKnop?.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuKnop.setAttribute("aria-expanded", open);
    document.body.style.overflow = open ? "hidden" : "";
  });

  /* ---------------- Filters op lijstpagina's ---------------- */
  const raster = $("[data-raster]");
  if (raster) {
    const kaarten = $$(".kaart", raster);
    const actief = {};
    const zoek = $("[data-zoek]"), sorteer = $("[data-sorteer]"), aantal = $("[data-aantal]"), paneel = $("[data-filter-paneel]");
    const params = new URLSearchParams(location.search);
    if (params.get("q")) zoek.value = params.get("q");
    const pas = () => {
      const q = zoek.value.trim().toLowerCase();
      let n = 0;
      kaarten.forEach((k) => {
        const ok = Object.entries(actief).every(([veld, waarden]) => !waarden.size || [...waarden].some((w) => (k.dataset[veld] || "").split(" ").includes(w)))
          && (!q || (k.dataset.naam + " " + k.dataset.stijlen + " " + k.dataset.sfeer + " " + k.dataset.kleuren).includes(q));
        k.hidden = !ok; if (ok) n++;
      });
      aantal.textContent = `${n} ${n === 1 ? "poster" : "posters"}`;
      $("[data-leeg]").hidden = n > 0;
    };
    const sorteerNu = () => {
      const v = sorteer.value;
      const lijst = [...kaarten].sort((a, b) => v === "pop" ? a.dataset.pop - b.dataset.pop : v === "az" ? a.dataset.naam.localeCompare(b.dataset.naam) : b.dataset.naam.localeCompare(a.dataset.naam));
      lijst.forEach((k) => raster.appendChild(k));
    };
    $$("[data-filter]").forEach((chip) => chip.addEventListener("click", () => {
      const veld = chip.dataset.filter, w = chip.dataset.waarde;
      actief[veld] ??= new Set();
      const aan = chip.getAttribute("aria-pressed") !== "true";
      chip.setAttribute("aria-pressed", aan);
      aan ? actief[veld].add(w) : actief[veld].delete(w);
      pas();
    }));
    $$("[data-wis]").forEach((k) => k.addEventListener("click", () => {
      Object.values(actief).forEach((s) => s.clear());
      $$("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", "false"));
      zoek.value = ""; pas();
    }));
    $("[data-filter-open]").addEventListener("click", (ev) => {
      paneel.hidden = !paneel.hidden;
      ev.currentTarget.setAttribute("aria-expanded", !paneel.hidden);
    });
    zoek.addEventListener("input", pas);
    sorteer.addEventListener("change", sorteerNu);
    pas();
  }

  /* ---------------- Zoeklaag ---------------- */
  const zoeklaag = $("[data-zoeklaag]");
  function zoekIn(c, q) {
    const woorden = q.toLowerCase().split(/\s+/).filter(Boolean);
    return c.producten.map((p) => {
      const tekst = `${p.n.toLowerCase()} ${p.z} ${p.st.join(" ")} ${p.sf.join(" ")} ${p.r.join(" ")} ${p.k.join(" ")}`;
      const score = woorden.reduce((s, w) => s + (p.n.toLowerCase().includes(w) ? 3 : tekst.includes(w) ? 1 : -99), 0);
      return { p, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.p.p - b.p.p).map((x) => x.p);
  }
  function openZoek() {
    zoeklaag.hidden = false;
    document.body.style.overflow = "hidden";
    const input = $("[data-zoeklaag-input]");
    input.focus();
    toonZoek(input.value);
  }
  function sluitZoek() { if (zoeklaag && !zoeklaag.hidden) { zoeklaag.hidden = true; document.body.style.overflow = ""; } }
  async function toonZoek(q) {
    const c = await catalogus();
    const doel = $("[data-zoeklaag-resultaat]");
    if (!q.trim()) {
      const tips = ["tijger", "zwart-wit", "kinderkamer", "koffie", "Bauhaus", "Meisje met de parel", "botanisch", "tekst"];
      doel.innerHTML = `<p class="filter__label">Veel gezocht</p><div class="zoeklaag__tips">${tips.map((t) => `<button type="button" class="chip" data-tip="${t}">${t}</button>`).join("")}</div>
        <p class="filter__label" style="margin-top:20px">Populair</p><div class="raster">${c.producten.slice().sort((a, b) => a.p - b.p).slice(0, 6).map(miniKaart).join("")}</div>`;
      return;
    }
    const r = zoekIn(c, q);
    doel.innerHTML = r.length
      ? `<p class="filter__label">${r.length} posters</p><div class="raster">${r.slice(0, 18).map(miniKaart).join("")}</div>${r.length > 18 ? `<p class="meer"><a class="link link--pijl" href="${pad("/alle-posters/")}?q=${encodeURIComponent(q)}">Alle ${r.length} resultaten ${icoon("pijl")}</a></p>` : ""}`
      : `<p>Niets gevonden voor <b>${esc(q)}</b>. Probeer een onderwerp, kleur of ruimte.</p>`;
  }
  if (zoeklaag) {
    $$("[data-zoek-open]").forEach((k) => k.addEventListener("click", openZoek));
    $("[data-zoek-sluit]").addEventListener("click", sluitZoek);
    zoeklaag.addEventListener("click", (ev) => {
      if (ev.target === zoeklaag) sluitZoek();
      const tip = ev.target.closest("[data-tip]");
      if (tip) { const i = $("[data-zoeklaag-input]"); i.value = tip.dataset.tip; toonZoek(i.value); }
    });
    $("[data-zoeklaag-input]").addEventListener("input", (ev) => toonZoek(ev.target.value));
    $("[data-zoeklaag-input]").addEventListener("keydown", (ev) => { if (ev.key === "Enter") location.href = pad("/alle-posters/") + "?q=" + encodeURIComponent(ev.target.value); });
  }

  /* ---------------- Productpagina ---------------- */
  const product = $("[data-product]");
  if (product) {
    const form = $("[data-koop]"), prijsEl = $("[data-prijs]"), advies = $("[data-advies]");
    const balk = $("[data-koopbalk]"), balkPrijs = $("[data-koopbalk-prijs]");
    const vergelijker = $("[data-vergelijker]");
    const gekozen = () => $("input[name=maat]:checked", form).value;
    const wil = new URLSearchParams(location.search).get("maat");
    if (wil) { const r = $(`input[name=maat][value="${CSS.escape(wil)}"]`, form); if (r) r.checked = true; }
    const update = () => {
      const m = gekozen(), p = prijsVan(m);
      prijsEl.textContent = euro(p); balkPrijs.textContent = euro(p);
      advies.textContent = ADVIES[sleutel(m)];
      const u = new URL(location.href); u.searchParams.set("maat", m);
      try { history.replaceState(null, "", u); } catch { /* offline demo: adresbalk blijft gelijk */ }
      tekenVergelijker(m);
      const planLink = $(".koop__planner");
      if (planLink) planLink.href = pad("/muurplanner/") + `?p=${product.dataset.product}&l=een&m=${sleutel(m)}`;
    };
    function tekenVergelijker(m) {
      const [b, h] = m.split("x").map(Number), schaal = 0.8;
      const w = b * schaal, hh = h * schaal, x = 158 - w / 2, y = 130 - hh;
      const rect = $("[data-vergelijker-poster] rect", vergelijker);
      Object.entries({ x, y, width: w, height: hh }).forEach(([k, v]) => rect.setAttribute(k, v));
    }
    form.addEventListener("change", update);
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      zetInMand({ s: product.dataset.product, m: gekozen(), n: product.dataset.naam, u: product.dataset.url });
      openMand();
      const t = $("[data-mand-teller]"); t.classList.remove("bots"); void t.offsetWidth; t.classList.add("bots");
    });
    $("[data-koopbalk-knop]")?.addEventListener("click", () => form.requestSubmit());
    if ("IntersectionObserver" in window && balk) {
      new IntersectionObserver(([e]) => { balk.hidden = e.isIntersecting || e.boundingClientRect.top > 0 || innerWidth > 900; })
        .observe($(".koop__knoppen", form));
    }
    $$("[data-duim]").forEach((d) => d.addEventListener("click", () => {
      $$("[data-duim]").forEach((x) => x.setAttribute("aria-pressed", x === d));
      $$("[data-dia]").forEach((x) => { x.hidden = x.dataset.dia !== d.dataset.duim; });
    }));
    $("[data-vergelijker-open]").addEventListener("click", (ev) => {
      vergelijker.hidden = !vergelijker.hidden;
      ev.currentTarget.setAttribute("aria-expanded", !vergelijker.hidden);
      if (!vergelijker.hidden) vergelijker.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    update();
  }

  /* ---------------- Posterhulp ---------------- */
  const hulpPaneel = $("#hulp-paneel"), gesprek = $("[data-hulp-gesprek]");
  const keuze = { ruimte: null, sfeer: null, kleur: null };
  const RUIMTE_LIJST = ["woonkamer", "slaapkamer", "kinderkamer", "keuken", "werkplek", "hal"];
  const SFEER_LIJST = ["rustig", "speels", "stoer", "klassiek", "kleurrijk", "minimalistisch", "grappig", "luxe", "natuur", "romantisch"];
  const KLEUR_LIJST = ["zwart-wit", "beige", "blauw", "groen", "rood", "oranje", "geel", "roze"];
  const PIM = $(".hulp__kop-pim")?.innerHTML || "";
  const bot = (html) => {
    // Pim "typt" heel even, dan verschijnt zijn antwoord
    gesprek.insertAdjacentHTML("beforeend", `<div class="bericht-rij" data-typt><span class="bericht__pim">${PIM}</span><div class="bericht bericht--bot bericht--typt"><span></span><span></span><span></span></div></div>`);
    gesprek.scrollTop = gesprek.scrollHeight;
    setTimeout(() => {
      const rij = gesprek.querySelector("[data-typt]");
      if (!rij) return;
      rij.removeAttribute("data-typt");
      rij.querySelector(".bericht").outerHTML = `<div class="bericht bericht--bot">${html}</div>`;
      gesprek.scrollTop = gesprek.scrollHeight;
    }, 450);
  };
  const jij = (t) => { gesprek.insertAdjacentHTML("beforeend", `<div class="bericht bericht--jij">${esc(t)}</div>`); gesprek.scrollTop = gesprek.scrollHeight; };
  const chips = (stap, lijst, extra = []) => `<div class="keuzes">${[...lijst, ...extra].map((w) => `<button type="button" class="chip" data-stap="${stap}" data-w="${w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join("")}</div>`;
  function startHulp() {
    gesprek.innerHTML = "";
    Object.keys(keuze).forEach((k) => (keuze[k] = null));
    bot(`<p>Hoi, ik ben <b>Pim</b>! Ik hang hier de hele dag aan de muur, dus ik weet wel iets van posters. Drie vragen en je hebt een shortlist. Je mag me ook gewoon iets vragen.</p><p><b>Waar komt hij te hangen?</b></p>${chips("ruimte", RUIMTE_LIJST)}`);
  }
  function zetHulp(open) {
    if (!hulpPaneel) return;
    hulpPaneel.hidden = !open;
    $("[data-hulp-open]").setAttribute("aria-expanded", open);
    if (open) { if (!gesprek.children.length) startHulp(); $("#hulp-vraag").focus(); }
  }
  async function toonAdvies() {
    const c = await catalogus();
    let lijst = c.producten.filter((p) => p.r.includes(keuze.ruimte) && p.sf.includes(keuze.sfeer) && (!keuze.kleur || p.k.includes(keuze.kleur)));
    let ruimer = false;
    if (lijst.length < 3) { lijst = c.producten.filter((p) => p.r.includes(keuze.ruimte) && (p.sf.includes(keuze.sfeer) || (keuze.kleur && p.k.includes(keuze.kleur)))); ruimer = true; }
    lijst.sort((a, b) => a.p - b.p);
    const ruimtePad = { woonkamer: "posters-woonkamer", slaapkamer: "posters-slaapkamer", kinderkamer: "posters-kinderkamer", keuken: "posters-keuken", werkplek: "posters-werkplek", hal: "posters-hal" }[keuze.ruimte];
    if (!lijst.length) { bot(`<p>Daar heb ik helaas niets voor gevonden. <a class="link" href="${pad(`/${ruimtePad}/`)}">Bekijk alle posters voor de ${keuze.ruimte}</a>.</p>${chips("opnieuw", ["opnieuw beginnen"])}`); return; }
    bot(`<p>${ruimer ? "Precies die combinatie is er niet, maar deze komen dichtbij." : `Deze ${Math.min(6, lijst.length)} passen bij een ${keuze.sfeer}e ${keuze.ruimte}.`}</p><div class="hulp__tips">${lijst.slice(0, 6).map(miniKaart).join("")}</div>
      <p style="margin-top:8px"><a class="link" href="${pad(`/${ruimtePad}/`)}">Meer voor de ${keuze.ruimte}</a> · <a class="link" href="${pad("/muurplanner/")}?p=${lijst.slice(0, 3).map((p) => p.s).join(",")}&l=trio">Zet ze in de muurplanner</a></p>${chips("opnieuw", ["opnieuw beginnen"])}`);
  }
  const FAQ_SLEUTELS = [[/lever|snel|wanneer|bezorg|duur.*(lever|verzend)/, 0], [/verzend|verzending|kost.*verz|gratis verz/, 1], [/2\s*\+\s*1|korting|actie|code|gratis/, 2], [/lijst|frame/, 3], [/papier|kwaliteit|materiaal|druk/, 4], [/retour|terug|ruil|bedenk/, 5], [/formaat|maat|groot|afmeting|hoe groot|cm/, 6], [/belgi/, 7], [/betal|ideal|paypal|bancontact|creditcard/, 8]];
  const PRAATJES = [
    [/(wie ben jij|wie is pim|ben je een robot|ben jij echt)/, () => "<p>Ik ben Pim, het postertje van Leukeposters.nl. Geen echte medewerker, wel heel behulpzaam. Voor lastige vragen verwijs ik je door naar de mensen achter de winkel.</p>"],
    [/^(hoi|hallo|hey|hi|goedemorgen|goedemiddag|goedenavond|yo)\b/, () => `<p>Hoi! Leuk dat je er bent. Zoek je iets voor een bepaalde kamer, of heb je een vraag over bestellen?</p>${chips("ruimte", RUIMTE_LIJST)}`],
    [/(bedankt|dankje|dank je|thanks|top|super)/, () => "<p>Graag gedaan! Hang er iets leuks van op. Ik hang hier nog even, voor als je meer vragen hebt.</p>"],
    [/(muurplanner|eigen muur|foto van (mijn|je) muur|hoe (ziet|staat|hangt).*(muur|thuis)|uploaden)/, () => `<p>Daar is de <a class="link" href="${pad("/muurplanner/")}">muurplanner</a> voor. Maak een foto van je muur, upload hem, en je posters hangen er meteen in, ingelijst en op ware grootte. Je foto blijft op je eigen toestel.</p>`],
    [/(cadeau|kado|verjaardag|geschenk|voor (mijn|een) (vriendin|vriend|moeder|vader|zus|broer))/, () => `<p>Een poster is een fijn cadeau. Vul bij het afrekenen gewoon het adres van de ontvanger in, er staat geen prijs op de verpakking. Twijfel je over de smaak? Zwart-wit en botanisch vallen bijna altijd goed.</p><p><a class="link" href="${pad("/populaire-posters/")}">Bekijk wat populair is</a></p>`],
    [/(boven (de|mijn) (bank|bed|bank)|bank van|bed van|hoe breed)/, () => `<p>Vuistregel: je poster of groepje posters is ongeveer twee derde zo breed als het meubel eronder. Boven een bank van 2 meter is dat één poster van 100x140, of twee van 50x70 naast elkaar. Hang de onderkant 20 tot 30 cm boven de rugleuning.</p><p><a class="link" href="${pad("/gidsen/welk-posterformaat-kies-je/")}">Lees de hele gids</a></p>`],
    [/(contact|mens|medewerker|bellen|telefoon|mail)/, () => '<p>Wil je liever een mens spreken? Mail naar <a class="link" href="mailto:info@leukeposters.nl">info@leukeposters.nl</a>. Je krijgt meestal binnen één werkdag antwoord.</p>'],
    [/(ophangen|boren|spijker|plakstrip|huurhuis)/, () => `<p>Zonder boren kan prima: met verwijderbare plakstrips, een fotoplank of een houten posterhanger. In mijn <a class="link" href="${pad("/gidsen/poster-ophangen-zonder-boren/")}">ophanggids</a> staan alle manieren op een rij.</p>`],
    [/(fotowand|gallery|meerdere posters|combineren)/, () => `<p>Een fotowand begint met één grote ankerposter, een kleur die overal terugkomt en 5 tot 8 cm tussen de lijsten. Probeer het eerst in de <a class="link" href="${pad("/muurplanner/")}?l=wand">muurplanner</a>, of lees de <a class="link" href="${pad("/gidsen/fotowand-maken/")}">fotowand-gids</a>.</p>`],
  ];
  async function vrije(vraag) {
    const c = await catalogus(), q = vraag.toLowerCase().trim();
    const praatje = PRAATJES.find(([re]) => re.test(q));
    if (praatje) { bot(praatje[1]()); return; }
    const faq = FAQ_SLEUTELS.find(([re]) => re.test(q));
    if (faq) { const [v, a] = c.faq[faq[1]]; bot(`<p><b>${esc(v)}</b></p><p>${a}</p>`); return; }
    const r = zoekIn(c, q.replace(/\b(poster|posters|een|met|voor|de|het|ik|zoek|wil|graag|mijn)\b/g, " ").trim() || q);
    if (r.length) bot(`<p>Ik vond ${r.length} ${r.length === 1 ? "poster" : "posters"}. Deze springen eruit:</p><div class="hulp__tips">${r.slice(0, 6).map(miniKaart).join("")}</div>${r.length > 6 ? `<p style="margin-top:8px"><a class="link" href="${pad("/alle-posters/")}?q=${encodeURIComponent(q)}">Bekijk ze allemaal</a></p>` : ""}`);
    else bot(`<p>Hmm, daar weet ik (nog) geen antwoord op. Mail je vraag naar <a class="link" href="mailto:info@leukeposters.nl">info@leukeposters.nl</a>, dan krijg je antwoord van een mens.</p>${chips("opnieuw", ["help me kiezen"])}`);
  }
  const ballon = $("[data-hulp-ballon]");
  if (ballon && !lees("lp_ballon", false) && !document.body.classList.contains("plannerpagina")) {
    setTimeout(() => { if (hulpPaneel.hidden) ballon.hidden = false; }, 5000);
  }
  const ballonWeg = () => { if (ballon) ballon.hidden = true; bewaar("lp_ballon", true); };
  ballon?.addEventListener("click", (e) => { ballonWeg(); if (!e.target.closest("[data-hulp-ballon-weg]")) zetHulp(true); });
  if (hulpPaneel) {
    $("[data-hulp-open]").addEventListener("click", () => { ballonWeg(); zetHulp(hulpPaneel.hidden); });
    $("[data-hulp-sluit]").addEventListener("click", () => zetHulp(false));
    $$("[data-hulp-start]").forEach((k) => k.addEventListener("click", () => { zetHulp(true); }));
    gesprek.addEventListener("click", (ev) => {
      const k = ev.target.closest("[data-stap]");
      if (!k) return;
      const { stap, w } = k.dataset;
      k.parentElement.querySelectorAll("button").forEach((b) => (b.disabled = true));
      if (stap === "opnieuw") { startHulp(); return; }
      jij(w[0].toUpperCase() + w.slice(1));
      if (stap === "ruimte") { keuze.ruimte = w; bot(`<p><b>Welke sfeer zoek je?</b></p>${chips("sfeer", SFEER_LIJST)}`); }
      if (stap === "sfeer") { keuze.sfeer = w; bot(`<p><b>Moet er een kleur terugkomen?</b> Bijvoorbeeld van je bank of kussens.</p>${chips("kleur", KLEUR_LIJST, ["maakt niet uit"])}`); }
      if (stap === "kleur") { keuze.kleur = w === "maakt niet uit" ? null : w; toonAdvies(); }
    });
    $("[data-hulp-form]").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const i = $("#hulp-vraag"), v = i.value.trim();
      if (!v) return;
      jij(v); i.value = ""; vrije(v);
    });
  }

  /* ---------------- Muurplanner ---------------- */
  // Tekent een echte kamerfoto (of de eigen foto van de bezoeker) met ingelijste posters op ware grootte op een canvas.
  // Alles gebeurt in de browser: een geüploade foto verlaat het toestel niet.
  const planner = $("[data-planner]");
  const kiezer = $("[data-kiezer]");
  function sluitKiezer() { if (kiezer && !kiezer.hidden) { kiezer.hidden = true; document.body.style.overflow = ""; } }
  if (planner) {
    // Een indeling bestaat uit kolommen; elke kolom is een stapel vakken (van onder naar boven).
    // Kolommen staan naast elkaar en zijn verticaal gecentreerd. Alles wordt berekend op de échte formaten,
    // dus een groter formaat schuift de rest netjes op en hangt nooit over het meubel heen.
    const INDELINGEN = {
      een: { naam: "Eén poster", maten: ["70x100"], kolommen: [[0]] },
      groot: { naam: "Eén grote", maten: ["100x140"], kolommen: [[0]] },
      duo: { naam: "Duo", maten: ["50x70", "50x70"], kolommen: [[0], [1]] },
      trio: { naam: "Trio", maten: ["50x70", "50x70", "50x70"], kolommen: [[0], [1], [2]] },
      mix: { naam: "Groot en klein", maten: ["70x100", "30x40", "30x40"], kolommen: [[0], [1, 2]] },
      wand: { naam: "Fotowand", maten: ["50x70", "30x40", "30x40", "30x40", "30x40"], kolommen: [[1, 2], [0], [3, 4]] },
    };
    const TUSSEN = 8; // cm tussen de lijsten
    const LIJSTEN = { auto: ["Automatisch", null], zwart: ["Zwart", "#18161d"], eiken: ["Eiken", "#b88a5a"], wit: ["Wit", "#f4f1ea"] };
    const LIJST_CM = 2.2;
    const params = new URLSearchParams(location.search);
    const st = {
      kamer: params.get("k") || "woonkamer",
      eigen: null,
      indeling: INDELINGEN[params.get("l")] ? params.get("l") : ((params.get("p") || "").includes(",") ? "trio" : "een"),
      posters: (params.get("p") || "").split(",").filter(Boolean),
      maten: (params.get("m") || "").split(",").map((m) => (FORMATEN[sleutel(m)] ? sleutel(m) : undefined)),
      lijst: LIJSTEN[params.get("f")] ? params.get("f") : "auto",
      pos: [],
    };
    const canvas = $("[data-canvas]"), ctx = canvas.getContext("2d");
    const beelden = {};
    const laad = (src) => (beelden[src] ??= new Promise((ok, fout) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fout; im.src = src; }));
    let c, per, achter, pxcm = 3, anker = { x: 0, y: 0 }, plafond = 0, verschuif = 0, sleep = null, gepland = false;

    const vakken = () => INDELINGEN[st.indeling].maten.map((m) => ({ m }));
    const maatVan = (i) => {
      const m = st.maten[i] || vakken()[i].m, p = per[st.posters[i]];
      const [b, h] = m.split("x").map(Number);
      return p && p.l ? [h, b] : [b, h];
    };
    const kleurVan = (i) => LIJSTEN[st.lijst][1] || LIJSTEN[per[st.posters[i]]?.j || "zwart"][1];

    function vulAan() {
      const vrij = c.producten.filter((p) => !p.l && !st.posters.includes(p.s)).sort((a, b) => a.p - b.p);
      while (st.posters.length < vakken().length) st.posters.push(vrij.shift().s);
    }
    async function zetMuur() {
      if (st.eigen) {
        achter = st.eigen.beeld;
        pxcm = achter.width / st.eigen.breedte;
        anker = { x: achter.width / 2, y: achter.height * 0.5 };
        plafond = 0;
      } else {
        const k = c.kamers[st.kamer] || c.kamers.woonkamer;
        achter = await laad(`${IMG}kamers-leeg/${st.kamer}-1264.webp`);
        const f = achter.width / 1264;
        pxcm = k.pxcm * f;
        anker = { x: k.cx * f, y: k.onder * f };
        plafond = (k.plafond || 0) * f;
      }
    }
    // Rechthoeken in cm t.o.v. het ankerpunt (x vanaf het midden, y omhoog vanaf de onderkant), lijst meegerekend
    function schikking(ind, maatVanVak) {
      const kol = ind.kolommen.map((stapel) => {
        const vk = stapel.map((i) => { const [b, h] = maatVanVak(i); return { i, b: b + 2 * LIJST_CM, h: h + 2 * LIJST_CM }; });
        return { vk, b: Math.max(...vk.map((v) => v.b)), h: vk.reduce((t, v) => t + v.h, 0) + TUSSEN * (vk.length - 1) };
      });
      const totaalB = kol.reduce((t, k) => t + k.b, 0) + TUSSEN * (kol.length - 1), maxH = Math.max(...kol.map((k) => k.h));
      const uit = [];
      let x = -totaalB / 2;
      for (const k of kol) {
        let y = (maxH - k.h) / 2;
        for (const v of k.vk) { uit[v.i] = { x: x + (k.b - v.b) / 2, y, b: v.b, h: v.h }; y += v.h + TUSSEN; }
        x += k.b + TUSSEN;
      }
      return uit;
    }
    function indeel() {
      st.pos = schikking(INDELINGEN[st.indeling], maatVan).map((q) => ({ x: anker.x + q.x * pxcm, y: anker.y - (q.y + q.h) * pxcm, w: q.b * pxcm, h: q.h * pxcm }));
      // Past de groep niet op de foto? Dan verlengen we de muur naar boven (zonder plafond of sierlijst),
      // zodat de posters boven het meubel blijven hangen en helemaal in beeld zijn.
      const boven = Math.min(...st.pos.map((q) => q.y)), marge = achter.height * 0.04;
      verschuif = boven < marge ? Math.ceil(marge - boven) : 0;
      st.pos.forEach((q) => { q.y += verschuif; });
      canvas.width = achter.width;
      canvas.height = achter.height + verschuif;
    }
    function omlijst(im, x, y, W, H, kleur) {
      const d = LIJST_CM * pxcm, w = W - 2 * d, h = H - 2 * d;
      ctx.save(); // zachte schaduw op de muur, licht van linksboven
      ctx.shadowColor = "rgba(20,14,10,.42)"; ctx.shadowBlur = Math.max(10, d * 2.6); ctx.shadowOffsetX = d * 0.55; ctx.shadowOffsetY = d * 1.0;
      ctx.fillStyle = kleur; ctx.fillRect(x, y, W, H); ctx.restore();
      ctx.save(); // strakke contactschaduw
      ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = d * 0.45; ctx.shadowOffsetY = d * 0.15;
      ctx.fillStyle = kleur; ctx.fillRect(x, y, W, H); ctx.restore();
      const g = ctx.createLinearGradient(x, y, x + W, y + H); // afschuining van de lijst
      g.addColorStop(0, "rgba(255,255,255,.2)"); g.addColorStop(0.45, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.2)");
      ctx.fillStyle = g; ctx.fillRect(x, y, W, H);
      const r = Math.max(w / im.width, h / im.height), sw = w / r, sh = h / r; // poster vullend in de lijst
      ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x + d, y + d, w, h);
      ctx.save(); // schaduw van de lijst op de poster
      ctx.beginPath(); ctx.rect(x + d, y + d, w, h); ctx.clip();
      ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = d * 0.9; ctx.shadowOffsetX = d * 0.2; ctx.shadowOffsetY = d * 0.3;
      ctx.lineWidth = d; ctx.strokeStyle = "#000"; ctx.strokeRect(x + d / 2, y + d / 2, w + d, h + d); ctx.restore();
      const glans = ctx.createLinearGradient(x, y, x + W * 0.7, y + H);
      glans.addColorStop(0, "rgba(255,255,255,.08)"); glans.addColorStop(0.4, "rgba(255,255,255,0)");
      ctx.fillStyle = glans; ctx.fillRect(x + d, y + d, w, h);
    }
    async function teken(voorDownload = false) {
      const ims = await Promise.all(vakken().map((_, i) => st.posters[i] ? laad(`${IMG}poster/${st.posters[i]}-960.webp`).catch(() => laad(`${IMG}poster/${st.posters[i]}-480.webp`)) : null));
      if (verschuif) {
        const y0 = Math.round(plafond), strook = Math.max(4, Math.round(achter.height * 0.012)), boven = verschuif + y0;
        ctx.drawImage(achter, 0, y0, achter.width, strook, 0, 0, canvas.width, boven + 1); // muur doortrekken
        const g = ctx.createLinearGradient(0, 0, 0, boven);
        g.addColorStop(0, "rgba(0,0,0,.08)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, boven);
        ctx.drawImage(achter, 0, y0, achter.width, achter.height - y0, 0, boven, achter.width, achter.height - y0);
      } else {
        ctx.drawImage(achter, 0, 0, canvas.width, achter.height);
      }
      ims.forEach((im, i) => { if (im) { const p = st.pos[i]; omlijst(im, p.x, p.y, p.w, p.h, kleurVan(i)); } });
      if (!voorDownload && sleep) {
        const p = st.pos[sleep.i];
        ctx.save(); ctx.setLineDash([10, 8]); ctx.lineWidth = Math.max(2, canvas.width / 500); ctx.strokeStyle = "#fff";
        ctx.strokeRect(p.x - 6, p.y - 6, p.w + 12, p.h + 12); ctx.restore();
      }
      const fs = Math.round(canvas.width / 60);
      ctx.save(); ctx.font = `700 ${fs}px system-ui, sans-serif`; ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = fs / 3;
      ctx.fillText("leukeposters.nl", canvas.width - fs, canvas.height - fs); ctx.restore();
    }
    const tekenSnel = () => { if (gepland) return; gepland = true; requestAnimationFrame(() => { gepland = false; teken(); }); };

    function tekenPaneel() {
      $$("[data-kamer]").forEach((b) => b.setAttribute("aria-pressed", !st.eigen && b.dataset.kamer === st.kamer));
      $("[data-upload-label]").classList.toggle("actief", !!st.eigen);
      $("[data-kalibratie]").hidden = !st.eigen;
      $("[data-indelingen]").innerHTML = Object.entries(INDELINGEN).map(([k, v]) => {
        const sch = schikking(v, (i) => v.maten[i].split("x").map(Number));
        const x0 = Math.min(...sch.map((q) => q.x)), x1 = Math.max(...sch.map((q) => q.x + q.b)), y1 = Math.max(...sch.map((q) => q.y + q.h));
        const svg = `<svg viewBox="${x0 - 8} ${-y1 - 8} ${x1 - x0 + 16} ${y1 + 16}" aria-hidden="true">${sch.map((q) => `<rect x="${q.x}" y="${-(q.y + q.h)}" width="${q.b}" height="${q.h}" rx="2" fill="currentColor"/>`).join("")}</svg>`;
        return `<button type="button" class="indeling" data-indeling="${k}" aria-pressed="${k === st.indeling}">${svg}<span>${v.naam}</span></button>`;
      }).join("");
      $("[data-vakken]").innerHTML = vakken().map((v, i) => {
        const p = per[st.posters[i]], m = st.maten[i] || v.m;
        const opties = c.formaten.map(([f, pr]) => `<option value="${f}" ${f === m ? "selected" : ""}>${f.replace("x", " × ")} cm · ${euro(pr)}</option>`).join("");
        return `<div class="vak"><button type="button" class="vak__beeld" data-wissel="${i}" aria-label="Wissel poster ${i + 1}">${p ? `<img src="${IMG}poster/${p.s}-480.webp" alt="">` : "+"}</button>
          <div class="vak__info"><b>${p ? esc(p.n) : "Kies een poster"}</b><label class="sr" for="maat-${i}">Formaat</label><select id="maat-${i}" data-maat="${i}">${opties}</select></div>
          <button type="button" class="link" data-wissel="${i}">Wissel</button></div>`;
      }).join("");
      $("[data-lijsten]").innerHTML = Object.entries(LIJSTEN).map(([k, [naam, kleur]]) => `<button type="button" class="lijstknop" data-lijst="${k}" aria-pressed="${k === st.lijst}"><span style="background:${kleur || "conic-gradient(#18161d 0 33%, #b88a5a 0 66%, #f4f1ea 0)"}"></span>${naam}</button>`).join("");
      const regels = vakken().map((v, i) => per[st.posters[i]] && { s: st.posters[i], m: st.maten[i] || v.m, a: 1, n: per[st.posters[i]].n, u: per[st.posters[i]].u }).filter(Boolean);
      const b = bereken(regels);
      $("[data-planner-totaal]").innerHTML = `<div><p><b>${regels.length} ${regels.length === 1 ? "poster" : "posters"}</b> · ${b.korting ? `<s>${euro(b.subtotaal)}</s> ` : ""}<b>${euro(b.naKorting)}</b>${b.korting ? ` <span class="label">2+1 gratis</span>` : ""}</p><p class="planner__regels">Lijsten niet inbegrepen</p></div>
        <div class="knoppen"><button type="button" class="knop knop--rand knop--klein" data-download>Download foto</button><button type="button" class="knop knop--tomaat knop--klein" data-planner-mand>${icoon("tas")} In winkelwagen</button></div>`;
      planner._regels = regels;
      const u = new URL(location.href);
      u.searchParams.set("l", st.indeling); u.searchParams.set("p", st.posters.slice(0, vakken().length).join(","));
      st.maten.some(Boolean) ? u.searchParams.set("m", vakken().map((v, i) => st.maten[i] || v.m).join(",")) : u.searchParams.delete("m");
      st.eigen ? u.searchParams.delete("k") : u.searchParams.set("k", st.kamer);
      st.lijst === "auto" ? u.searchParams.delete("f") : u.searchParams.set("f", st.lijst);
      try { history.replaceState(null, "", u); } catch { /* offline demo */ }
    }
    async function alles(opnieuwIndelen = true) {
      await zetMuur();
      if (opnieuwIndelen) indeel();
      tekenPaneel();
      await teken();
    }

    // Slepen (muis en touch)
    const punt = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; };
    const raak = (q) => { for (let i = st.pos.length - 1; i >= 0; i--) { const p = st.pos[i]; if (st.posters[i] && q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + p.h) return i; } return -1; };
    canvas.addEventListener("pointerdown", (e) => {
      const q = punt(e), i = raak(q);
      if (i < 0) return;
      sleep = { i, dx: q.x - st.pos[i].x, dy: q.y - st.pos[i].y };
      canvas.setPointerCapture(e.pointerId);
      $("[data-hint]").hidden = true;
      tekenSnel();
    });
    canvas.addEventListener("pointermove", (e) => {
      const q = punt(e);
      if (!sleep) { canvas.style.cursor = raak(q) >= 0 ? "grab" : "default"; return; }
      canvas.style.cursor = "grabbing";
      st.pos[sleep.i].x = q.x - sleep.dx; st.pos[sleep.i].y = q.y - sleep.dy;
      tekenSnel();
    });
    const los = () => { if (sleep) { sleep = null; tekenSnel(); } };
    canvas.addEventListener("pointerup", los);
    canvas.addEventListener("pointercancel", los);

    // Eigen foto
    $("[data-upload]").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const im = await laad(URL.createObjectURL(f));
      const schaal = Math.min(1, 2000 / Math.max(im.width, im.height));
      const doek = document.createElement("canvas");
      doek.width = Math.round(im.width * schaal); doek.height = Math.round(im.height * schaal);
      doek.getContext("2d").drawImage(im, 0, 0, doek.width, doek.height);
      st.eigen = { beeld: doek, breedte: +$("[data-breedte]").value || 300 };
      await alles();
      planner.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("[data-breedte]").addEventListener("input", (e) => { if (st.eigen) { st.eigen.breedte = Math.max(80, +e.target.value || 300); alles(); } });

    planner.addEventListener("change", (e) => {
      const m = e.target.closest("[data-maat]");
      if (m) { st.maten[+m.dataset.maat] = m.value; alles(); }
    });
    planner.addEventListener("click", async (e) => {
      const k = e.target.closest("[data-kamer]"), ind = e.target.closest("[data-indeling]"), lj = e.target.closest("[data-lijst]"), w = e.target.closest("[data-wissel]");
      if (k) { st.eigen = null; st.kamer = k.dataset.kamer; await alles(); planner.scrollIntoView({ behavior: "smooth", block: "start" }); }
      if (ind) { st.indeling = ind.dataset.indeling; st.maten = []; vulAan(); await alles(); }
      if (lj) { st.lijst = lj.dataset.lijst; tekenPaneel(); teken(); }
      if (w) openKiezer(+w.dataset.wissel);
      if (e.target.closest("[data-planner-mand]")) { planner._regels.forEach((r) => zetInMand(r)); openMand(); }
      if (e.target.closest("[data-download]")) {
        await teken(true);
        try {
          canvas.toBlob((blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob); a.download = "mijn-muur-leukeposters.jpg"; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          }, "image/jpeg", 0.9);
        } catch { alert("Downloaden lukt in de online versie van de site."); }
      }
    });

    let actiefVak = 0;
    function openKiezer(i) {
      actiefVak = i;
      kiezer.hidden = false;
      document.body.style.overflow = "hidden";
      const z = $("[data-kiezer-zoek]");
      z.value = ""; z.focus();
      tekenKiezer("");
    }
    function tekenKiezer(q) {
      const lijst = (q ? zoekIn(c, q) : c.producten.slice().sort((a, b) => a.p - b.p)).slice(0, 60);
      $("[data-kiezer-raster]").innerHTML = lijst.map((p) => `<button type="button" data-kies="${p.s}">${miniKaart(p).replace(/^<a [^>]+>/, '<span class="mini">').replace(/<\/a>$/, "</span>")}</button>`).join("") || "<p>Niets gevonden.</p>";
    }
    kiezer.addEventListener("click", (e) => {
      if (e.target.closest("[data-kiezer-sluit]")) sluitKiezer();
      const k = e.target.closest("[data-kies]");
      if (k) { st.posters[actiefVak] = k.dataset.kies; sluitKiezer(); alles(); }
    });
    $("[data-kiezer-zoek]").addEventListener("input", (e) => tekenKiezer(e.target.value));

    catalogus().then((cat) => {
      c = cat;
      per = Object.fromEntries(c.producten.map((p) => [p.s, p]));
      if (!c.kamers[st.kamer]) st.kamer = "woonkamer";
      st.posters = st.posters.filter((s) => per[s]);
      vulAan();
      alles();
    });
  }

  /* ---------------- Afrekenen (concept) ---------------- */
  const afrekenen = $("[data-afrekenen]");
  afrekenen?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    let ok = true;
    $$("input[required]", afrekenen).forEach((i) => { const goed = i.value.trim() && i.checkValidity(); i.setAttribute("aria-invalid", !goed); ok = ok && goed; });
    const melding = $("[data-afrekenen-melding]");
    melding.hidden = false;
    melding.textContent = !mand.length ? "Je winkelwagen is leeg." : !ok ? "Vul de rood gemarkeerde velden in."
      : "Dit is de conceptversie van de nieuwe site. Betalen via Mollie en het automatisch doorzetten naar de drukker worden in de volgende stap gekoppeld. Er is niets besteld.";
  });

  tekenMand();
  tekenHarten();
})();
