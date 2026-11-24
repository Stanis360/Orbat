import * as store from "./store.js";
import * as sync from "./sync.js";
import { editor, vorschauSvg } from "./grundriss.js";
import * as fotos from "./fotos.js";
import * as preise from "./preise.js";
import * as dokument from "./dokument.js";
import { $, esc, zahl, fmt, euro, heute, datum, nachDatum, formular, herunterladen, dialog } from "./ui.js";

const inhalt = $("#inhalt");
const titel = $("#titel");
const zurueck = $("#zurueck");

const STATUS = { geplant: "Geplant", laufend: "Läuft", pausiert: "Pausiert", fertig: "Fertig" };
const { summen } = preise;

function massWerte(m) {
  const l = zahl(m.laenge), b = zahl(m.breite), h = zahl(m.hoehe), n = zahl(m.anzahl) || 1;
  const teile = [];
  if (l != null && b != null) teile.push(`${fmt(l * b * n)} m²`);
  if (l != null && b != null && h != null) teile.push(`${fmt(l * b * h * n)} m³`);
  if (l != null && b == null && h != null) teile.push(`${fmt(l * h * n)} m²`);
  if (l != null && b == null && h == null) teile.push(`${fmt(l * n)} m`);
  return teile.join(" · ");
}

function massText(m) {
  const n = zahl(m.anzahl) || 1;
  const d = [m.laenge, m.breite, m.hoehe].map(zahl).filter((x) => x != null).map((x) => fmt(x, 3)).join(" × ");
  return (n > 1 ? `${fmt(n)} × ` : "") + (d ? d + " m" : "");
}

// ---------- Sync-Anzeige ----------
const syncKnopf = $("#sync");
sync.beiStatus((s) => {
  let klasse = "grau", text = "Offline";
  if (s.zustand === "laeuft") { klasse = "blau"; text = "Sync …"; }
  else if (s.zustand === "ok" && !s.wartend) { klasse = "gruen"; text = "Aktuell"; }
  else if (s.wartend) { klasse = "orange"; text = `${s.wartend} offen`; }
  else if (s.zustand === "aus") { klasse = "grau"; text = "Kein Sync"; }
  syncKnopf.className = "sync " + klasse;
  syncKnopf.querySelector("b").textContent = text;
  syncKnopf.title = s.text + (s.zuletzt ? ` – zuletzt ${s.zuletzt.toLocaleString("de-DE")}` : "");
  if (location.hash.startsWith("#/einstellungen")) $("#sync-info")?.replaceChildren(syncInfoText(s));
});
syncKnopf.onclick = () => { location.hash = "#/einstellungen"; };

function syncInfoText(s) {
  const p = document.createElement("span");
  const z = s.zuletzt ? `Zuletzt synchronisiert: ${s.zuletzt.toLocaleString("de-DE")}` : "Noch nie synchronisiert";
  p.textContent = `${s.text || ""}. ${z}. ${s.wartend ? s.wartend + " Änderung(en) warten auf Sync." : ""}`;
  return p;
}

// ---------- Ansichten ----------
let aktuellerEditor = null;

function kopf(t, zurueckZu) {
  titel.textContent = t;
  zurueck.hidden = !zurueckZu;
  if (zurueckZu) zurueck.href = zurueckZu;
  document.title = t === "Baustellen" ? "Baustellen" : `${t} – Baustellen`;
}

function ansichtListe() {
  kopf("Baustellen");
  const filter = store.getMeta("filter", "offen");
  const suche = (sessionStorage.getItem("suche") || "").toLowerCase();
  let alle = store.liste("baustelle");
  const anzahl = { offen: 0, fertig: 0, alle: alle.length };
  alle.forEach((b) => (b.status === "fertig" ? anzahl.fertig++ : anzahl.offen++));
  alle = alle
    .filter((b) => filter === "alle" || (filter === "fertig" ? b.status === "fertig" : b.status !== "fertig"))
    .filter((b) => !suche || [b.name, b.kunde, b.adresse].join(" ").toLowerCase().includes(suche))
    .sort((a, b) => (a.status === "laufend" ? 0 : 1) - (b.status === "laufend" ? 0 : 1) || b.updatedAt - a.updatedAt);

  const bestellen = store.liste("material", (m) => m.status === "zu_bestellen" && store.get(m.baustelleId)).length;
  inhalt.innerHTML = `
    <div class="knopfreihe oben">
      <a class="btn" href="#/preise">📋 Preisliste</a>
      <a class="btn ${bestellen ? "hinweis-btn" : ""}" href="#/bestellen">🛒 Bestellungen${bestellen ? ` <span class="zaehler">${bestellen}</span>` : ""}</a>
    </div>
    <div class="suchzeile">
      <input id="suche" type="search" placeholder="Suchen: Name, Kunde, Ort …" value="${esc(sessionStorage.getItem("suche") || "")}">
    </div>
    <div class="filter">
      ${[["offen", "Offen"], ["fertig", "Fertig"], ["alle", "Alle"]].map(([k, l]) => `<button class="chip ${k === filter ? "aktiv" : ""}" data-filter="${k}">${l} <small>${anzahl[k]}</small></button>`).join("")}
    </div>
    <div class="liste">
      ${alle.map((b) => {
        const s = summen(b.id);
        return `<a class="karte baustelle" href="#/b/${b.id}">
          <div class="zeile"><b>${esc(b.name)}</b><span class="status ${b.status || "geplant"}">${STATUS[b.status] || "Geplant"}</span></div>
          ${b.kunde || b.adresse ? `<div class="leise">${esc([b.kunde, b.adresse].filter(Boolean).join(" · "))}</div>` : ""}
          <div class="kennzahlen"><span>⏱ ${fmt(s.std)} h</span>${s.stdVk + s.matVk ? `<span>💶 ${euro(s.stdVk + s.matVk)}</span>` : ""}${s.zuBestellen ? `<span class="warn">🛒 ${s.zuBestellen} zu bestellen</span>` : ""}</div>
        </a>`;
      }).join("") || `<div class="leer">${suche ? "Nichts gefunden." : "Noch keine Baustellen.<br>Tippe auf <b>＋</b>, um die erste anzulegen."}</div>`}
    </div>
    <button class="fab" id="neu" aria-label="Neue Baustelle">＋</button>`;
  $("#suche").addEventListener("input", (e) => {
    sessionStorage.setItem("suche", e.target.value);
    const pos = e.target.selectionStart;
    ansichtListe();
    const s = $("#suche"); s.focus(); s.setSelectionRange(pos, pos);
  });
  inhalt.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = async () => { await store.setMeta("filter", b.dataset.filter); ansichtListe(); }));
  $("#neu").onclick = () => baustelleBearbeiten();
}

const baustelleFelder = () => [
  { n: "name", l: "Bezeichnung", pflicht: true, platzhalter: "z.B. Bad Müller" },
  { n: "kunde", l: "Kunde / Auftraggeber", liste: [...new Set(store.liste("baustelle").map((b) => b.kunde).filter(Boolean))] },
  { n: "telefon", l: "Telefon", typ: "tel", halb: true },
  { n: "status", l: "Status", typ: "select", opt: STATUS, standard: "laufend", halb: true },
  { n: "adresse", l: "Adresse" },
  { n: "beginn", l: "Beginn", typ: "date", halb: true, standard: heute() },
  { n: "ende", l: "Fertig bis", typ: "date", halb: true },
  { n: "baugenehmigung", l: "Baugenehmigung (Nr. / Datum)", halb: true, platzhalter: "z.B. Nr. 45/2026 vom 12.03.2026" },
  { n: "bauparzelle", l: "Bauparzelle / K.G.", halb: true, platzhalter: "z.B. Bp. 123, K.G. Gais" },
  { n: "notiz", l: "Notizen", typ: "textarea" },
];

async function baustelleBearbeiten(b) {
  const erg = await formular({ titel: b ? "Baustelle bearbeiten" : "Neue Baustelle", felder: baustelleFelder(), werte: b || {}, loeschbar: !!b });
  if (!erg) return;
  if (erg.__loeschen) { await store.loeschen(b.id); location.hash = "#/"; return; }
  const neu = await store.speichern({ ...(b || { typ: "baustelle" }), ...erg });
  if (!b) location.hash = `#/b/${neu.id}`;
  else zeigen();
}

const TABS = [["info", "Info"], ["masse", "Maße"], ["stunden", "Stunden"], ["material", "Material"], ["plaene", "Pläne"], ["fotos", "Fotos"]];

function ansichtBaustelle(id, tab = "info") {
  const b = store.get(id);
  if (!b) { location.hash = "#/"; return; }
  kopf(b.name, "#/");
  inhalt.innerHTML = `
    <nav class="unter-tabs">${TABS.map(([k, l]) => `<a href="#/b/${id}/${k}" class="${k === tab ? "aktiv" : ""}">${l}</a>`).join("")}</nav>
    <div id="tab"></div>`;
  const ziel = $("#tab");
  inhalt.querySelector(".unter-tabs a.aktiv")?.scrollIntoView({ block: "nearest", inline: "center" });
  ({ info: tabInfo, masse: tabMasse, stunden: tabStunden, material: preise.tabMaterial, plaene: tabPlaene, fotos: tabFotos }[tab] || tabInfo)(b, ziel);
}

function tabInfo(b, ziel) {
  const s = summen(b.id);
  const plaene = store.von("plan", b.id).length;
  const fotoZahl = store.von("foto", b.id).length;
  const masse = store.von("mass", b.id).length;
  const karte = (k, v, link) => `<a class="kachel" href="${link}"><small>${k}</small><b>${v}</b></a>`;
  ziel.innerHTML = `
    <div class="kacheln">
      ${karte("Gesamt (netto)", euro(s.stdVk + s.matVk), `#/bericht/${b.id}`)}
      ${karte("Stunden", fmt(s.std) + " h" + (s.stdVk ? `<br><small>${euro(s.stdVk)}</small>` : ""), `#/b/${b.id}/stunden`)}
      ${karte("Material", euro(s.matVk) + (s.zuBestellen || s.bestellt ? `<br><small>${[s.zuBestellen && s.zuBestellen + " zu bestellen", s.bestellt && s.bestellt + " bestellt"].filter(Boolean).join(", ")}</small>` : ""), `#/b/${b.id}/material`)}
      ${karte("Maße", masse, `#/b/${b.id}/masse`)}
      ${karte("Grundrisse", plaene, `#/b/${b.id}/plaene`)}
      ${karte("Fotos", fotoZahl, `#/b/${b.id}/fotos`)}
    </div>
    <div class="karte info">
      <div class="zeile"><span class="leise">Status</span><span class="status ${b.status || "geplant"}">${STATUS[b.status] || "Geplant"}</span></div>
      ${b.kunde ? `<div class="zeile"><span class="leise">Kunde</span><span>${esc(b.kunde)}</span></div>` : ""}
      ${b.telefon ? `<div class="zeile"><span class="leise">Telefon</span><a class="link" href="tel:${esc(b.telefon.replace(/\s/g, ""))}">${esc(b.telefon)}</a></div>` : ""}
      ${b.adresse ? `<div class="zeile"><span class="leise">Adresse</span><a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.adresse)}">${esc(b.adresse)}</a></div>` : ""}
      ${b.beginn ? `<div class="zeile"><span class="leise">Beginn</span><span>${datum(b.beginn)}</span></div>` : ""}
      ${b.ende ? `<div class="zeile"><span class="leise">Fertig bis</span><span>${datum(b.ende)}</span></div>` : ""}
      ${b.baugenehmigung ? `<div class="zeile"><span class="leise">Baugenehmigung</span><span>${esc(b.baugenehmigung)}</span></div>` : ""}
      ${b.bauparzelle ? `<div class="zeile"><span class="leise">Bauparzelle</span><span>${esc(b.bauparzelle)}</span></div>` : ""}
      ${b.notiz ? `<div class="notiz">${esc(b.notiz)}</div>` : ""}
    </div>
    <div class="knopfreihe">
      <button class="btn" id="bearbeiten">✎ Bearbeiten</button>
      <a class="btn primaer" href="#/dok/${b.id}/angebot">📄 Angebot / Rechnung</a>
      <a class="btn" href="#/bericht/${b.id}">🖨 Bericht / PDF</a>
    </div>`;
  $("#bearbeiten").onclick = () => baustelleBearbeiten(b);
}

// ----- Maße -----
function tabMasse(b, ziel) {
  const masse = store.von("mass", b.id).sort((x, y) => (x.bereich || "").localeCompare(y.bereich || "", "de") || x.updatedAt - y.updatedAt);
  const gruppen = new Map();
  for (const m of masse) { const k = m.bereich || "Allgemein"; if (!gruppen.has(k)) gruppen.set(k, []); gruppen.get(k).push(m); }
  ziel.innerHTML = `
    <p class="leise klein">Maße in Metern. Fläche (L×B) und Volumen (L×B×H) werden automatisch berechnet.</p>
    ${[...gruppen].map(([g, liste]) => `
      <h2>${esc(g)}</h2>
      <div class="liste">${liste.map((m) => `
        <button class="karte eintrag" data-id="${m.id}">
          <div class="zeile"><b>${esc(m.bezeichnung || "Maß")}</b><span class="wert">${massWerte(m)}</span></div>
          <div class="leise">${massText(m)}${m.notiz ? " · " + esc(m.notiz) : ""}</div>
        </button>`).join("")}
      </div>`).join("") || `<div class="leer">Noch keine Maße erfasst.</div>`}
    <button class="fab" id="neu" aria-label="Neues Maß">＋</button>`;
  ziel.querySelectorAll("[data-id]").forEach((el) => (el.onclick = () => massBearbeiten(b, store.get(el.dataset.id))));
  $("#neu").onclick = () => massBearbeiten(b);
}

async function massBearbeiten(b, m) {
  const bereiche = [...new Set(store.von("mass", b.id).map((x) => x.bereich).filter(Boolean))];
  const erg = await formular({
    titel: m ? "Maß bearbeiten" : "Neues Maß",
    werte: m || { bereich: sessionStorage.getItem("letzterBereich") || "" },
    loeschbar: !!m,
    felder: [
      { n: "bereich", l: "Raum / Bereich", liste: [...bereiche, "Küche", "Bad", "Wohnzimmer", "Schlafzimmer", "Flur", "WC", "Keller", "Außen"], platzhalter: "z.B. Bad" },
      { n: "bezeichnung", l: "Was", platzhalter: "z.B. Boden, Wand Nord, Fenster", liste: ["Boden", "Decke", "Wand", "Fenster", "Tür", "Sockel"] },
      { n: "laenge", l: "Länge (m)", typ: "zahl", halb: true },
      { n: "breite", l: "Breite (m)", typ: "zahl", halb: true },
      { n: "hoehe", l: "Höhe (m)", typ: "zahl", halb: true },
      { n: "anzahl", l: "Anzahl", typ: "zahl", halb: true, standard: "1" },
      { n: "notiz", l: "Notiz" },
    ],
  });
  if (!erg) return;
  if (erg.__loeschen) await store.loeschen(m.id);
  else {
    sessionStorage.setItem("letzterBereich", erg.bereich);
    await store.speichern({ ...(m || { typ: "mass", baustelleId: b.id }), ...erg });
  }
  zeigen();
}

// ----- Stunden -----
function tabStunden(b, ziel) {
  const liste = store.von("stunden", b.id).sort(nachDatum);
  const proPerson = new Map();
  for (const s of liste) proPerson.set(s.person || "–", (proPerson.get(s.person || "–") || 0) + (zahl(s.stunden) || 0));
  const gesamt = [...proPerson.values()].reduce((a, c) => a + c, 0);
  const betrag = liste.reduce((a, x) => a + (preise.stdVk(x) || 0), 0);
  ziel.innerHTML = `
    <div class="karte summe">
      <div class="zeile"><b>Gesamt</b><b>${fmt(gesamt)} h${betrag ? ` · ${euro(betrag)}` : ""}</b></div>
      ${proPerson.size > 1 ? [...proPerson].map(([p, h]) => `<div class="zeile leise"><span>${esc(p)}</span><span>${fmt(h)} h</span></div>`).join("") : ""}
    </div>
    <div class="liste">${liste.map((s) => `
      <button class="karte eintrag" data-id="${s.id}">
        <div class="zeile"><b>${datum(s.datum)}</b><span class="wert">${fmt(zahl(s.stunden))} h</span></div>
        <div class="zeile leise"><span>${esc([s.person, s.satz, s.von && s.bis ? `${s.von}–${s.bis}` : "", s.taetigkeit].filter(Boolean).join(" · "))}</span><span>${preise.stdVk(s) != null ? euro(preise.stdVk(s)) : ""}</span></div>
      </button>`).join("") || `<div class="leer">Noch keine Stunden eingetragen.</div>`}
    </div>
    <button class="fab" id="neu" aria-label="Stunden eintragen">＋</button>`;
  ziel.querySelectorAll("[data-id]").forEach((el) => (el.onclick = () => stundenBearbeiten(b, store.get(el.dataset.id))));
  $("#neu").onclick = () => stundenBearbeiten(b);
}

function minuten(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; }

async function stundenBearbeiten(b, s) {
  const personen = [...new Set([store.getMeta("name", ""), ...store.liste("stunden").map((x) => x.person)].filter(Boolean))];
  const saetze = preise.saetze();
  const satzOpt = [...saetze.map((x) => [x.id, `${x.name} – ${euro(zahl(x.preis))}/h`]), ["", "– ohne Stundensatz –"]];
  // Gelöschter Satz bei altem Eintrag: trotzdem anzeigen
  if (s?.satzId && !store.get(s.satzId)) satzOpt.unshift([s.satzId, `${s.satz} – ${euro(zahl(s.stundenpreis))}/h`]);
  const preisVon = (form) => (s && form.satzId.value === (s.satzId || "") ? zahl(s.stundenpreis) : zahl(store.get(form.satzId.value)?.preis));
  const info = (form) => {
    const h = zahl(form.stunden.value), p = preisVon(form);
    form.info.textContent = h != null && p != null ? `${fmt(h)} h × ${euro(p)} = ${euro(h * p)}` : saetze.length ? "" : "Tipp: Stundensätze in der Preisliste anlegen";
  };
  const erg = await formular({
    titel: s ? "Stunden bearbeiten" : "Stunden eintragen",
    werte: s ? { ...s, satzId: s.satzId || "" } : { datum: heute(), person: store.getMeta("name", ""), satzId: preise.satzVorschlag(b.id) },
    loeschbar: !!s,
    fuss: true,
    beiStart: info,
    felder: [
      { n: "datum", l: "Datum", typ: "date", pflicht: true, halb: true },
      { n: "person", l: "Wer", liste: personen, halb: true },
      { n: "von", l: "Von", typ: "time", halb: true },
      { n: "bis", l: "Bis", typ: "time", halb: true },
      { n: "pause", l: "Pause (Min.)", typ: "zahl", halb: true },
      { n: "stunden", l: "Stunden", typ: "zahl", pflicht: true, halb: true, platzhalter: "z.B. 7,5" },
      { n: "satzId", l: "Stundensatz", typ: "select", opt: satzOpt },
      { n: "taetigkeit", l: "Tätigkeit", liste: [...new Set(store.liste("stunden").map((x) => x.taetigkeit).filter(Boolean))].slice(0, 30) },
    ],
    beiEingabe(form, feld) {
      info(form);
      if (!["von", "bis", "pause"].includes(feld)) return;
      const v = minuten(form.von.value), bis = minuten(form.bis.value);
      if (v == null || bis == null) return;
      let d = bis - v - (zahl(form.pause.value) || 0);
      if (d < 0) d += 24 * 60;
      form.stunden.value = fmt(Math.round((d / 60) * 100) / 100);
      info(form);
    },
  });
  if (!erg) return;
  if (erg.__loeschen) await store.loeschen(s.id);
  else {
    // Preis zum Zeitpunkt des Eintrags merken (spätere Preisänderungen ändern alte Einträge nicht)
    const satz = store.get(erg.satzId);
    const gleich = s && (s.satzId || "") === erg.satzId;
    await store.speichern({
      ...(s || { typ: "stunden", baustelleId: b.id }), ...erg, stunden: String(zahl(erg.stunden) ?? ""),
      satz: gleich ? s.satz || "" : satz?.name || "",
      stundenpreis: gleich ? s.stundenpreis || "" : satz?.preis || "",
    });
  }
  zeigen();
}

// ----- Fotos -----
const nachAufnahme = (a, c) => (c.datum || "").localeCompare(a.datum || "") || (c.zeit || "").localeCompare(a.zeit || "") || c.updatedAt - a.updatedAt;

function tabFotos(b, ziel) {
  const liste = store.von("foto", b.id).sort(nachAufnahme);
  const tage = new Map();
  for (const f of liste) { if (!tage.has(f.datum)) tage.set(f.datum, []); tage.get(f.datum).push(f); }
  ziel.innerHTML = `
    <div class="knopfreihe oben">
      <label class="btn primaer">📷 Kamera<input type="file" accept="image/*" capture="environment" data-hinzu hidden></label>
      <label class="btn">🖼 Galerie<input type="file" accept="image/*" multiple data-hinzu hidden></label>
    </div>
    <p class="leise klein" id="foto-status" hidden></p>
    ${[...tage].map(([d, fs]) => `
      <h2>${datum(d)}</h2>
      <div class="fotos">${fs.map((f) => `
        <button class="foto" data-foto="${f.id}" aria-label="Foto öffnen">
          <img src="${f.thumb}" alt="" loading="lazy">${f.notiz ? `<span>${esc(f.notiz)}</span>` : ""}
        </button>`).join("")}
      </div>`).join("") || `<div class="leer">Noch keine Fotos.<br>Die Fotos werden verkleinert gespeichert (ca. 300 KB pro Foto).</div>`}`;
  ziel.querySelectorAll("[data-hinzu]").forEach((input) => (input.onchange = async () => {
    const dateien = [...input.files];
    const st = $("#foto-status");
    st.hidden = false;
    let n = 0;
    for (const d of dateien) {
      st.textContent = `Speichere Foto ${++n} von ${dateien.length} …`;
      try { await fotos.hinzufuegen(d, b.id); } catch (e) { alert(`Foto „${d.name}“ konnte nicht gelesen werden.`); }
    }
    zeigen();
  }));
  ziel.querySelectorAll("[data-foto]").forEach((el) => (el.onclick = () => {
    const alle = store.von("foto", b.id).sort(nachAufnahme);
    offenerBetrachter = fotos.betrachter(alle, alle.findIndex((f) => f.id === el.dataset.foto), {
      name: b.name,
      beiNotiz: (f, notiz) => store.speichern({ ...f, notiz }),
      beiLoeschen: (f) => store.loeschen(f.id),
      beiSchliessen: () => { offenerBetrachter = null; zeigen(); },
    });
  }));
}

function tabPlaene(b, ziel) {
  const plaene = store.von("plan", b.id).sort((x, y) => (x.name || "").localeCompare(y.name || "", "de"));
  ziel.innerHTML = `
    <div class="plaene">${plaene.map((p) => `
      <div class="karte plan">
        <a href="#/plan/${p.id}" class="plan-bild" data-vorschau="${p.id}"></a>
        <div class="zeile"><a href="#/plan/${p.id}"><b>${esc(p.name || "Grundriss")}</b></a><button class="mini" data-umbenennen="${p.id}" aria-label="Umbenennen">✎</button></div>
      </div>`).join("")}
    </div>
    ${plaene.length ? "" : `<div class="leer">Noch kein Grundriss.<br>Zeichne eine grobe Skizze mit Wänden, Fenstern und Türen – die Längen werden automatisch angezeigt.</div>`}
    <button class="fab" id="neu" aria-label="Neuer Grundriss">＋</button>`;
  ziel.querySelectorAll("[data-vorschau]").forEach((el) => el.append(vorschauSvg(store.get(el.dataset.vorschau).elemente)));
  ziel.querySelectorAll("[data-umbenennen]").forEach((el) => (el.onclick = async () => {
    const p = store.get(el.dataset.umbenennen);
    const erg = await formular({ titel: "Grundriss", felder: [{ n: "name", l: "Name", pflicht: true }], werte: p, loeschbar: true });
    if (!erg) return;
    if (erg.__loeschen) await store.loeschen(p.id); else await store.speichern({ ...p, name: erg.name });
    zeigen();
  }));
  $("#neu").onclick = async () => {
    const erg = await formular({ titel: "Neuer Grundriss", felder: [{ n: "name", l: "Name", pflicht: true, liste: ["Erdgeschoss", "Obergeschoss", "Keller", "Dachgeschoss", "Bad", "Küche"] }], werte: { name: plaene.length ? "" : "Erdgeschoss" } });
    if (!erg) return;
    const p = await store.speichern({ typ: "plan", baustelleId: b.id, name: erg.name, elemente: [] });
    location.hash = `#/plan/${p.id}`;
  };
}

function ansichtPlan(id) {
  const p = store.get(id);
  if (!p) { location.hash = "#/"; return; }
  const b = store.get(p.baustelleId);
  kopf(`${p.name}${b ? " – " + b.name : ""}`, `#/b/${p.baustelleId}/plaene`);
  document.body.classList.add("vollbild");
  inhalt.innerHTML = `<div id="ed"></div>`;
  aktuellerEditor = editor($("#ed"), p.elemente, {
    name: `${b?.name || ""} – ${p.name}`,
    beiSpeichern: (els) => store.speichern({ ...store.get(id), elemente: els }),
  });
}

// ----- Bericht (zum Drucken / als PDF speichern) -----
function ansichtBericht(id) {
  const b = store.get(id);
  if (!b) { location.hash = "#/"; return; }
  kopf("Bericht", `#/b/${id}`);
  const std = store.von("stunden", id).sort((x, y) => (x.datum || "").localeCompare(y.datum || ""));
  const mat = store.von("material", id).sort((x, y) => (x.datum || "").localeCompare(y.datum || ""));
  const masse = store.von("mass", id).sort((x, y) => (x.bereich || "").localeCompare(y.bereich || "", "de"));
  const plaene = store.von("plan", id);
  const fotoListe = store.von("foto", id).sort((a, c) => (a.datum || "").localeCompare(c.datum || "") || (a.zeit || "").localeCompare(c.zeit || ""));
  const mitFotos = store.getMeta("berichtFotos", true);
  const mitPreisen = store.getMeta("berichtPreise", true);
  const s = summen(id);
  const netto = s.stdVk + s.matVk, satzMwst = preise.mwst(b);
  const betrag = (v) => (v == null ? "" : euro(v));
  inhalt.innerHTML = `
    <div class="knopfreihe nicht-drucken"><button class="btn primaer" onclick="print()">🖨 Drucken / als PDF speichern</button>
      <label class="btn"><input type="checkbox" id="mit-preisen" ${mitPreisen ? "checked" : ""}> Preise</label>
      ${fotoListe.length ? `<label class="btn"><input type="checkbox" id="mit-fotos" ${mitFotos ? "checked" : ""}> Fotos (${fotoListe.length})</label>` : ""}</div>
    <article class="bericht">
      <h1>${esc(b.name)}</h1>
      <p>${[b.kunde, b.adresse, b.telefon].some(Boolean) ? esc([b.kunde, b.adresse, b.telefon].filter(Boolean).join(" · ")) + "<br>" : ""}
      Status: ${STATUS[b.status] || ""}${b.beginn ? " · Beginn " + datum(b.beginn) : ""} · Stand ${new Date().toLocaleDateString("de-DE")}</p>
      ${b.notiz ? `<p class="notiz">${esc(b.notiz)}</p>` : ""}
      <h3>Arbeitszeit (${fmt(s.std)} h)</h3>
      ${std.length ? `<table><tr><th>Datum</th><th>Wer</th><th>Tätigkeit</th><th class="r">Std.</th>${mitPreisen ? `<th class="r">€/h</th><th class="r">Betrag</th>` : ""}</tr>
        ${std.map((r) => `<tr><td>${datum(r.datum)}${r.von && r.bis ? `<br><small>${r.von}–${r.bis}</small>` : ""}</td><td>${esc(r.person)}${r.satz ? `<br><small>${esc(r.satz)}</small>` : ""}</td><td>${esc(r.taetigkeit)}</td><td class="r">${fmt(zahl(r.stunden))}</td>${mitPreisen ? `<td class="r">${betrag(zahl(r.stundenpreis))}</td><td class="r">${betrag(preise.stdVk(r))}</td>` : ""}</tr>`).join("")}
        <tr class="summe"><td colspan="3">Summe</td><td class="r">${fmt(s.std)}</td>${mitPreisen ? `<td></td><td class="r">${euro(s.stdVk)}</td>` : ""}</tr></table>` : "<p>–</p>"}
      <h3>Material</h3>
      ${mat.length ? `<table><tr><th>Datum</th><th>Material</th><th class="r">Menge</th>${mitPreisen ? `<th class="r">€/Einh.</th><th class="r">Betrag</th>` : ""}</tr>
        ${mat.map((r) => `<tr><td>${datum(r.datum)}</td><td>${esc(r.bezeichnung)}${r.status && r.status !== "vorhanden" ? ` <small>(${preise.MSTATUS[r.status].toLowerCase()})</small>` : ""}</td><td class="r">${fmt(zahl(r.menge))} ${esc(r.einheit)}</td>${mitPreisen ? `<td class="r">${betrag(zahl(r.vk))}</td><td class="r">${betrag(preise.matVk(r))}</td>` : ""}</tr>`).join("")}
        ${mitPreisen ? `<tr class="summe"><td colspan="4">Summe</td><td class="r">${euro(s.matVk)}</td></tr>` : ""}</table>` : "<p>–</p>"}
      ${mitPreisen && netto ? `<table class="endsumme">
        <tr><td>Arbeitszeit</td><td class="r">${euro(s.stdVk)}</td></tr>
        <tr><td>Material</td><td class="r">${euro(s.matVk)}</td></tr>
        <tr class="summe"><td>Summe netto</td><td class="r">${euro(netto)}</td></tr>
        <tr><td>zzgl. ${fmt(satzMwst)} % MwSt.</td><td class="r">${euro((netto * satzMwst) / 100)}</td></tr>
        <tr class="summe gross"><td>Gesamt brutto</td><td class="r">${euro(netto * (1 + satzMwst / 100))}</td></tr>
      </table>` : ""}
      <h3>Maße</h3>
      ${masse.length ? `<table><tr><th>Bereich</th><th>Was</th><th>Maße</th><th class="r">Ergebnis</th></tr>
        ${masse.map((m) => `<tr><td>${esc(m.bereich)}</td><td>${esc(m.bezeichnung)}${m.notiz ? ` <small>(${esc(m.notiz)})</small>` : ""}</td><td>${massText(m)}</td><td class="r">${massWerte(m)}</td></tr>`).join("")}</table>` : "<p>–</p>"}
      ${plaene.map((p) => `<h3>Grundriss: ${esc(p.name)}</h3><div class="bericht-plan" data-plan="${p.id}"></div>`).join("")}
      ${fotoListe.length && mitFotos ? `<h3>Fotos</h3><div class="bericht-fotos">${fotoListe.map((f) => `
        <figure><img data-gross="${f.id}" src="${f.thumb}" alt=""><figcaption>${datum(f.datum)}${f.zeit ? " " + f.zeit : ""}${f.notiz ? " – " + esc(f.notiz) : ""}</figcaption></figure>`).join("")}</div>` : ""}
    </article>`;
  $("#mit-preisen").addEventListener("change", async (e) => { await store.setMeta("berichtPreise", e.target.checked); zeigen(); });
  $("#mit-fotos")?.addEventListener("change", async (e) => { await store.setMeta("berichtFotos", e.target.checked); zeigen(); });
  inhalt.querySelectorAll("[data-gross]").forEach(async (img) => { const u = await fotos.grossUrl(img.dataset.gross); if (u) img.src = u; });
  inhalt.querySelectorAll("[data-plan]").forEach((el) => {
    el.append(vorschauSvg(store.get(el.dataset.plan).elemente, { beschriftet: true, breite: 680 }));
  });
}

// ----- Einstellungen -----
function ansichtEinstellungen() {
  kopf("Einstellungen", "#/");
  const adr = sync.serverAdresse();
  inhalt.innerHTML = `
    <h2>Synchronisation</h2>
    <form class="karte form" id="sync-form">
      <p class="leise klein" id="sync-info"></p>
      <label class="feld"><span>Server-Adresse</span>
        <input name="server" placeholder="${esc(location.origin)}" value="${esc(store.getMeta("server", ""))}" autocomplete="off" autocapitalize="off">
      </label>
      <p class="leise klein">Leer lassen, wenn die App direkt vom Server zu Hause geöffnet wurde (Standard). Aktuell: <b>${esc(adr || "–")}</b></p>
      <label class="feld"><span>Sync-Passwort (falls am Server gesetzt)</span>
        <input name="passwort" type="password" value="${esc(store.getMeta("passwort", ""))}" autocomplete="off">
      </label>
      <div class="knopfreihe"><button class="btn primaer" type="submit">Speichern &amp; jetzt synchronisieren</button></div>
    </form>

    <h2>Allgemein</h2>
    <form class="karte form" id="allg-form">
      <label class="feld"><span>Mein Name (Vorschlag bei Stunden)</span><input name="name" value="${esc(store.getMeta("name", ""))}"></label>
      <p class="leise klein">Stundensätze und Materialpreise pflegst du in der <a class="link" href="#/preise">Preisliste</a>.</p>
      <div class="knopfreihe"><button class="btn" type="submit">Speichern</button></div>
    </form>

    <h2>Firmendaten (für Angebot &amp; Rechnung)</h2>
    ${dokument.firmaFormular()}

    <h2>Datensicherung</h2>
    <div class="karte form">
      <p class="leise klein">Der Server zu Hause legt jeden Tag automatisch eine Sicherung an. Zusätzlich kannst du hier alles als Datei speichern.</p>
      <div class="knopfreihe">
        <button class="btn" id="export">⬇ Sicherung speichern</button>
        <label class="btn">⬆ Sicherung einspielen<input type="file" id="import" accept=".json,application/json" hidden></label>
        <button class="btn" id="csv">⬇ Stunden &amp; Material als CSV (Excel)</button>
      </div>
    </div>
    <p class="leise klein mitte">Geräte-ID ${esc(store.getMeta("deviceId").slice(0, 8))} · ${store.alles().filter((r) => !r.deleted).length} Einträge</p>`;
  sync.beiStatus((s) => $("#sync-info")?.replaceChildren(syncInfoText(s)))();

  $("#sync-form").onsubmit = async (e) => {
    e.preventDefault();
    await store.setMeta("server", e.target.server.value.trim());
    await store.setMeta("passwort", e.target.passwort.value);
    await store.setMeta("seq", 0); // bei neuem Server alles neu abgleichen
    await sync.jetzt();
    ansichtEinstellungen();
  };
  dokument.firmaVerknuepfen();
  $("#allg-form").onsubmit = async (e) => {
    e.preventDefault();
    await store.setMeta("name", e.target.name.value.trim());
    e.target.querySelector("button").textContent = "✓ Gespeichert";
  };
  $("#export").onclick = () => herunterladen(`baustellen-sicherung-${heute()}.json`, JSON.stringify({ app: "baustellen", version: 1, records: store.alles() }), "application/json");
  $("#import").onchange = async (e) => {
    const datei = e.target.files[0];
    if (!datei) return;
    try {
      const daten = JSON.parse(await datei.text());
      const n = await store.einspielen(daten.records || []);
      alert(`${n} Einträge übernommen.`);
    } catch {
      alert("Die Datei konnte nicht gelesen werden.");
    }
    ansichtEinstellungen();
  };
  $("#csv").onclick = csvExport;
}

function csvExport() {
  const zelle = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const z = (n) => (n == null ? "" : String(Math.round(n * 100) / 100).replace(".", ","));
  const name = (id) => store.get(id)?.name || "";
  const zeilen = [["Art", "Baustelle", "Datum", "Wer / Material", "Tätigkeit / Notiz", "Stundensatz / Status", "Von", "Bis", "Stunden", "Menge", "Einheit", "EK je Einheit", "Kundenpreis je Einheit", "EK gesamt", "Kunde gesamt"]];
  const nachD = (a, b) => (a.datum || "").localeCompare(b.datum || "");
  for (const s of store.liste("stunden").sort(nachD))
    zeilen.push(["Stunden", name(s.baustelleId), s.datum, s.person, s.taetigkeit, s.satz, s.von, s.bis, z(zahl(s.stunden)), "", "", "", z(zahl(s.stundenpreis)), "", z(preise.stdVk(s))]);
  for (const m of store.liste("material").sort(nachD))
    zeilen.push(["Material", name(m.baustelleId), m.datum, m.bezeichnung, m.notiz, preise.MSTATUS[m.status] || "Vorhanden", "", "", "", z(zahl(m.menge)), m.einheit, z(zahl(m.preis)), z(zahl(m.vk)), z(preise.matEk(m)), z(preise.matVk(m))]);
  herunterladen(`baustellen-${heute()}.csv`, "\ufeff" + zeilen.map((r) => r.map(zelle).join(";")).join("\r\n"), "text/csv");
}

// ---------- Routing ----------
let offenerBetrachter = null;
function zeigen() {
  if (offenerBetrachter) { const b = offenerBetrachter; offenerBetrachter = null; b.schliessen(true); }
  if (aktuellerEditor) { aktuellerEditor.schliessen(); aktuellerEditor = null; }
  document.body.classList.remove("vollbild");
  const teile = location.hash.replace(/^#\/?/, "").split("/");
  if (teile[0] === "b" && teile[1]) ansichtBaustelle(teile[1], teile[2]);
  else if (teile[0] === "plan" && teile[1]) ansichtPlan(teile[1]);
  else if (teile[0] === "bericht" && teile[1]) ansichtBericht(teile[1]);
  else if (teile[0] === "einstellungen") ansichtEinstellungen();
  else if (teile[0] === "preise") preise.ansichtPreisliste(kopf, inhalt, teile[1] || "material");
  else if (teile[0] === "dok" && teile[1]) dokument.ansicht(kopf, inhalt, teile[1], teile[2]);
  else if (teile[0] === "bestellen") preise.ansichtBestellen(kopf, inhalt);
  else ansichtListe();
}

let altHash = location.hash;
window.addEventListener("hashchange", () => {
  const nurTab = altHash.split("/").slice(0, 3).join("/") === location.hash.split("/").slice(0, 3).join("/");
  altHash = location.hash;
  zeigen();
  if (!nurTab) window.scrollTo(0, 0);
});

// Änderungen von anderen Geräten anzeigen (nicht mitten im Zeichnen oder in einem Formular)
let neuZeichnenAusstehend = false;
store.beiAenderung((quelle) => {
  if (quelle !== "sync") return;
  if (aktuellerEditor || offenerBetrachter || dialog.open || document.activeElement?.id === "suche") { neuZeichnenAusstehend = true; return; }
  zeigen();
});
dialog.addEventListener("close", () => { if (neuZeichnenAusstehend && !aktuellerEditor) { neuZeichnenAusstehend = false; setTimeout(zeigen, 0); } });

// ---------- Start ----------
(async () => {
  try {
    await store.init();
  } catch (e) {
    inhalt.innerHTML = `<div class="leer">Der Gerätespeicher ist nicht verfügbar (privater Modus?).<br><small>${esc(e.message)}</small></div>`;
    return;
  }
  preise.init({ zeigen });
  zeigen();
  sync.starten();
  if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
