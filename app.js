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

  const miniKaart = (p) => `<a class="mini" href="${pad(p.u)}"><span class="mini__beeld" style="--tint:${p.t}"><img src="${IMG}poster/${p.s}-480.webp" alt="" loading="lazy" width="${p.l ? 1540 : 1080}" height="${p.l ? 1080 : 1540}"></span>${esc(p.n)}</a>`;

  const verlanglijst = $("[data-verlanglijst]");
  if (verlanglijst) {
    catalogus().then((c) => {
      const lijst = c.producten.filter((p) => harten.includes(p.s));
      $("[data-verlanglijst-leeg]").hidden = lijst.length > 0;
      verlanglijst.innerHTML = lijst.map((p) => `<article class="kaart"><a class="kaart__beeld" href="${pad(p.u)}" style="--tint:${p.t}"><img class="kaart__poster" src="${IMG}poster/${p.s}-480.webp" alt="" loading="lazy"></a>
        <button class="kaart__hart" type="button" data-hart="${p.s}" aria-label="Verwijder van je verlanglijst" aria-pressed="true"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>
        <div class="kaart__tekst"><h3><a href="${pad(p.u)}">${esc(p.n)}</a></h3><p>vanaf ${euro(14.99)}</p></div></article>`).join("");
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
  const bot = (html) => { gesprek.insertAdjacentHTML("beforeend", `<div class="bericht bericht--bot">${html}</div>`); gesprek.scrollTop = gesprek.scrollHeight; };
  const jij = (t) => { gesprek.insertAdjacentHTML("beforeend", `<div class="bericht bericht--jij">${esc(t)}</div>`); gesprek.scrollTop = gesprek.scrollHeight; };
  const chips = (stap, lijst, extra = []) => `<div class="keuzes">${[...lijst, ...extra].map((w) => `<button type="button" class="chip" data-stap="${stap}" data-w="${w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join("")}</div>`;
  function startHulp() {
    gesprek.innerHTML = "";
    Object.keys(keuze).forEach((k) => (keuze[k] = null));
    bot(`<p>Hoi! Ik help je de juiste poster vinden. Drie vragen, dan heb je een shortlist.</p><p><b>Waar komt hij te hangen?</b></p>${chips("ruimte", RUIMTE_LIJST)}`);
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
  async function vrije(vraag) {
    const c = await catalogus(), q = vraag.toLowerCase();
    const faq = FAQ_SLEUTELS.find(([re]) => re.test(q));
    if (faq) { const [v, a] = c.faq[faq[1]]; bot(`<p><b>${esc(v)}</b></p><p>${a}</p>`); return; }
    const r = zoekIn(c, q.replace(/\b(poster|posters|een|met|voor|de|het|ik|zoek|wil|graag|mijn)\b/g, " ").trim() || q);
    if (r.length) bot(`<p>Ik vond ${r.length} ${r.length === 1 ? "poster" : "posters"}. Deze springen eruit:</p><div class="hulp__tips">${r.slice(0, 6).map(miniKaart).join("")}</div>${r.length > 6 ? `<p style="margin-top:8px"><a class="link" href="${pad("/alle-posters/")}?q=${encodeURIComponent(q)}">Bekijk ze allemaal</a></p>` : ""}`);
    else bot(`<p>Daar weet ik nog geen antwoord op. Mail je vraag naar <a class="link" href="mailto:info@leukeposters.nl">info@leukeposters.nl</a>, dan krijg je antwoord van een mens.</p>${chips("opnieuw", ["help me kiezen"])}`);
  }
  if (hulpPaneel) {
    $("[data-hulp-open]").addEventListener("click", () => zetHulp(hulpPaneel.hidden));
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
  const planner = $("[data-planner]");
  const kiezer = $("[data-kiezer]");
  function sluitKiezer() { if (kiezer && !kiezer.hidden) { kiezer.hidden = true; document.body.style.overflow = ""; } }
  if (planner) {
    // Muur 420 cm breed, 290 cm hoog (zelfde verhouding als in de css); vloerstrook 26 cm; bank 220 x 84 cm.
    // Per vak: x = midden t.o.v. het bankmidden, y = onderkant boven de vloer (cm).
    const W = 420, H = 290, VLOER = 26;
    const INDELINGEN = {
      een: { naam: "Eén grote", vakken: [{ m: "100x140", x: 0, y: 104 }] },
      duo: { naam: "Duo", vakken: [{ m: "50x70", x: -30, y: 118 }, { m: "50x70", x: 30, y: 118 }] },
      trio: { naam: "Trio", vakken: [{ m: "50x70", x: -60, y: 118 }, { m: "50x70", x: 0, y: 118 }, { m: "50x70", x: 60, y: 118 }] },
      mix: { naam: "Groot en klein", vakken: [{ m: "70x100", x: -25, y: 112 }, { m: "30x40", x: 33, y: 112 }, { m: "30x40", x: 33, y: 160 }] },
      wand: { naam: "Fotowand", vakken: [{ m: "50x70", x: 0, y: 120 }, { m: "30x40", x: -48, y: 112 }, { m: "30x40", x: -48, y: 158 }, { m: "30x40", x: 48, y: 112 }, { m: "30x40", x: 48, y: 158 }] },
    };
    const MUREN = { Terracotta: "#C86F4F", Olijf: "#6B7150", Blush: "#E2BFB2", Kalk: "#E9E3D8", Inkt: "#2D3550", Salie: "#AEB99E" };
    const params = new URLSearchParams(location.search);
    let indeling = INDELINGEN[params.get("l")] ? params.get("l") : (params.get("p")?.includes(",") ? "trio" : "duo");
    let muur = MUREN[params.get("m")] ? params.get("m") : "Terracotta";
    let gevuld = (params.get("p") || "").split(",").filter(Boolean);
    let actiefVak = 0;
    const muurEl = $("[data-muur]");

    const indelingSvg = (v) => `<svg viewBox="-110 0 220 150" aria-hidden="true"><rect x="-110" y="0" width="220" height="150" rx="10" fill="var(--papier-2)"/>${v.vakken.map((s) => { const [b, h] = s.m.split("x").map(Number); return `<rect x="${s.x - b / 2}" y="${150 - s.y - h + 30}" width="${b}" height="${h}" fill="var(--tomaat)" opacity=".85"/>`; }).join("")}</svg>`;
    $("[data-indelingen]").innerHTML = Object.entries(INDELINGEN).map(([k, v]) => `<button type="button" class="indeling" data-indeling="${k}" aria-pressed="false">${indelingSvg(v)}${v.naam}</button>`).join("");
    $("[data-muren]").innerHTML = Object.entries(MUREN).map(([n, c]) => `<button type="button" class="muurkleur" data-muurkleur="${n}" style="background:${c}" aria-label="Muurkleur ${n}" aria-pressed="false"></button>`).join("");

    async function teken() {
      const c = await catalogus();
      const per = Object.fromEntries(c.producten.map((p) => [p.s, p]));
      gevuld = gevuld.filter((s) => per[s]);
      const vakken = INDELINGEN[indeling].vakken;
      muurEl.style.setProperty("--muur", MUREN[muur]);
      $$("[data-indeling]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.indeling === indeling));
      $$("[data-muurkleur]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.muurkleur === muur));
      $("[data-vakken]").innerHTML = vakken.map((v, i) => {
        const [b, h] = v.m.split("x").map(Number);
        const p = per[gevuld[i]];
        const stijl = `left:${((W / 2 + v.x - b / 2) / W) * 100}%;bottom:${((VLOER + v.y) / H) * 100}%;width:${(b / W) * 100}%;height:${(h / H) * 100}%`;
        return p
          ? `<button type="button" class="vak vak--gevuld" data-vak="${i}" style="${stijl}" aria-label="${esc(p.n)}, ${v.m} cm. Klik om te wisselen"><img src="${IMG}poster/${p.s}-480.webp" alt=""></button>`
          : `<button type="button" class="vak" data-vak="${i}" style="${stijl}">+ Kies poster<small>${v.m.replace("x", " × ")}</small></button>`;
      }).join("");
      const regels = vakken.map((v, i) => per[gevuld[i]] && { s: gevuld[i], m: v.m, a: 1, n: per[gevuld[i]].n, u: per[gevuld[i]].u }).filter(Boolean);
      const b = bereken(regels);
      const u = new URL(location.href);
      u.searchParams.set("l", indeling); u.searchParams.set("m", muur);
      gevuld.length ? u.searchParams.set("p", gevuld.slice(0, vakken.length).join(",")) : u.searchParams.delete("p");
      try { history.replaceState(null, "", u); } catch { /* offline demo */ }
      $("[data-planner-totaal]").innerHTML = regels.length
        ? `<div><p><b>${regels.length} van ${vakken.length} posters gekozen</b></p><p class="planner__regels">${euro(b.subtotaal)}${b.korting ? ` · 2+1 gratis −${euro(b.korting)}` : ""} · totaal <b>${euro(b.naKorting)}</b></p></div>
           <div class="knoppen"><button type="button" class="link" data-planner-deel>Link kopiëren</button><button type="button" class="knop knop--tomaat" data-planner-mand>${icoon("tas")} Alles in winkelwagen</button></div>`
        : `<p>Klik op een vak om een poster te kiezen.</p>`;
      planner._regels = regels;
    }
    async function openKiezer(i) {
      actiefVak = i;
      kiezer.hidden = false;
      document.body.style.overflow = "hidden";
      const z = $("[data-kiezer-zoek]");
      z.value = ""; z.focus();
      tekenKiezer("");
    }
    async function tekenKiezer(q) {
      const c = await catalogus();
      const lijst = (q ? zoekIn(c, q) : c.producten.slice().sort((a, b) => a.p - b.p)).filter((p) => !p.l).slice(0, 60);
      $("[data-kiezer-raster]").innerHTML = lijst.map((p) => `<button type="button" data-kies="${p.s}">${miniKaart(p).replace(/^<a [^>]+>/, '<span class="mini">').replace(/<\/a>$/, "</span>")}</button>`).join("") || "<p>Niets gevonden.</p>";
    }
    planner.addEventListener("click", (ev) => {
      const ind = ev.target.closest("[data-indeling]"), kl = ev.target.closest("[data-muurkleur]"), vak = ev.target.closest("[data-vak]");
      if (ind) { indeling = ind.dataset.indeling; teken(); }
      if (kl) { muur = kl.dataset.muurkleur; teken(); }
      if (vak) openKiezer(+vak.dataset.vak);
      if (ev.target.closest("[data-planner-mand]")) { planner._regels.forEach((r) => zetInMand(r)); openMand(); }
      if (ev.target.closest("[data-planner-deel]")) {
        navigator.clipboard?.writeText(location.href).then(() => { ev.target.textContent = "Gekopieerd"; setTimeout(() => (ev.target.textContent = "Link kopiëren"), 1800); });
      }
    });
    kiezer.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-kiezer-sluit]")) sluitKiezer();
      const k = ev.target.closest("[data-kies]");
      if (k) { gevuld[actiefVak] = k.dataset.kies; for (let i = 0; i < actiefVak; i++) gevuld[i] ??= ""; sluitKiezer(); teken(); }
    });
    $("[data-kiezer-zoek]").addEventListener("input", (ev) => tekenKiezer(ev.target.value));
    teken();
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
