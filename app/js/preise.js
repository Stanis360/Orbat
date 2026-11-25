// Preisliste (Materialien + Stundensätze), Material auf Baustellen, Bestellstatus, Bestellliste
import * as store from "./store.js";
import { $, esc, zahl, fmt, euro, heute, datum, nachDatum, formular, herunterladen, dialog } from "./ui.js";

export const EINHEITEN = ["Stk", "m", "lm", "m²", "m³", "kg", "t", "l", "Sack", "Eimer", "Rolle", "Paket", "Karton", "Palette", "Std", "pauschal"];
export const MSTATUS = { zu_bestellen: "Zu bestellen", bestellt: "Bestellt", vorhanden: "Vorhanden" };
const NAECHSTER = { zu_bestellen: "bestellt", bestellt: "vorhanden", vorhanden: "zu_bestellen" };

let neuZeichnen = () => {};
export function init({ zeigen }) {
  neuZeichnen = zeigen;
  // Früher gab es nur einen Stundensatz in den Einstellungen -> als Stundensatz übernehmen
  const alt = zahl(store.getMeta("stundensatz", ""));
  if (alt && !saetze().length) store.speichern({ typ: "satz", name: "Standard", preis: String(alt), standard: "1" });
  if (alt) store.setMeta("stundensatz", "");
}

// ---------- Rechnen ----------
const menge = (m) => zahl(m.menge) || 0;
export const matEk = (m) => (zahl(m.preis) != null ? menge(m) * zahl(m.preis) : null);
export const matVk = (m) => (zahl(m.vk) != null ? menge(m) * zahl(m.vk) : null);
export const stdVk = (s) => (zahl(s.stundenpreis) != null ? (zahl(s.stunden) || 0) * zahl(s.stundenpreis) : null);
// MwSt.: Baustelle > Firmendaten > alte Geräte-Einstellung > 20 %
export const mwst = (b) => zahl(b?.mwst) ?? zahl(store.get("firma")?.mwst) ?? zahl(store.getMeta("mwst", "")) ?? 20;
const aufschlag = () => zahl(store.getMeta("aufschlag", "20")) ?? 20;
const preisText = (v) => (zahl(v) == null ? "" : zahl(v).toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(zahl(v)) ? 0 : 2, maximumFractionDigits: 2, useGrouping: false }));
const vkAusEk = (ek) => (ek == null ? "" : preisText(Math.round(ek * (1 + aufschlag() / 100) * 100) / 100));
const mstatus = (m) => (MSTATUS[m.status] ? m.status : "vorhanden");

// Material oder Arbeit? (für die Aufteilung im Angebot)
export const ARTEN = { material: "Material", arbeit: "Arbeit" };
const ARBEIT_WOERTER = /arbeit|leistung|lohn|montage|verlegen|regie/i;
export const artikelArt = (a) => (ARTEN[a?.art] ? a.art : ARBEIT_WOERTER.test(a?.kategorie || "") ? "arbeit" : "material");
export function artVon(m) {
  if (ARTEN[m.art]) return m.art;
  const a = m.artikelId ? store.get(m.artikelId) : null;
  return a ? artikelArt(a) : "material";
}

export function summen(bId) {
  const st = store.von("stunden", bId), ma = store.von("material", bId);
  const sum = (l, f) => l.reduce((a, x) => a + (f(x) || 0), 0);
  return {
    std: sum(st, (s) => zahl(s.stunden)),
    stdVk: sum(st, stdVk),
    matEk: sum(ma, matEk),
    matVk: sum(ma, matVk),
    zuBestellen: ma.filter((m) => m.status === "zu_bestellen").length,
    bestellt: ma.filter((m) => m.status === "bestellt").length,
  };
}

// ---------- Stammdaten ----------
export const artikel = () => store.liste("artikel").sort((a, b) => (a.kategorie || "").localeCompare(b.kategorie || "", "de") || a.name.localeCompare(b.name, "de", { numeric: true }));
export const saetze = () => store.liste("satz").sort((a, b) => (b.standard ? 1 : 0) - (a.standard ? 1 : 0) || a.name.localeCompare(b.name, "de"));
const artikelNachName = (name) => store.liste("artikel", (a) => a.name.trim().toLowerCase() === String(name || "").trim().toLowerCase())[0] || null;

export function satzVorschlag(baustelleId) {
  const zuletzt = store.von("stunden", baustelleId).filter((s) => s.satzId && store.get(s.satzId)).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (zuletzt) return zuletzt.satzId;
  const alle = saetze();
  return (alle.find((s) => s.standard) || alle[0])?.id || "";
}

// =====================================================================
//  Material auf der Baustelle
// =====================================================================
export function tabMaterial(b, ziel) {
  const filter = sessionStorage.getItem("matFilter") || "alle";
  const alle = store.von("material", b.id);
  const liste = alle.filter((m) => filter === "alle" || mstatus(m) === filter)
    .sort((x, y) => Object.keys(MSTATUS).indexOf(mstatus(x)) - Object.keys(MSTATUS).indexOf(mstatus(y)) || nachDatum(x, y));
  const s = summen(b.id);
  const anzahl = (k) => alle.filter((m) => mstatus(m) === k).length;
  const ohneVk = alle.filter((m) => zahl(m.vk) == null).length;
  ziel.innerHTML = `
    <div class="karte summe">
      <div class="zeile"><b>Kundenpreis gesamt</b><b>${euro(s.matVk)}</b></div>
      <div class="zeile leise klein"><span>Einkauf ${euro(s.matEk)}</span><span>${s.matEk && s.matVk ? `Aufschlag ${euro(s.matVk - s.matEk)}` : ""}</span></div>
      ${ohneVk ? `<div class="leise klein">${ohneVk} Position(en) ohne Kundenpreis zählen nicht zur Summe</div>` : ""}
    </div>
    <div class="knopfreihe oben">
      <button class="btn primaer" id="auswahl">📋 Aus Preisliste wählen</button>
      <button class="btn" id="frei">＋ Freie Eingabe</button>
    </div>
    <div class="filter">
      ${[["alle", "Alle", alle.length], ...Object.entries(MSTATUS).map(([k, l]) => [k, l, anzahl(k)])]
        .map(([k, l, n]) => `<button class="chip ${k === filter ? "aktiv" : ""}" data-filter="${k}">${l} <small>${n}</small></button>`).join("")}
    </div>
    <div class="liste">${liste.map((m) => materialZeile(m)).join("") || `<div class="leer">${alle.length ? "Nichts in diesem Filter." : "Noch kein Material eingetragen."}</div>`}</div>`;
  ziel.querySelectorAll("[data-filter]").forEach((el) => (el.onclick = () => { sessionStorage.setItem("matFilter", el.dataset.filter); neuZeichnen(); }));
  verknuepfen(ziel, b);
  $("#auswahl").onclick = () => auswahlDialog(b);
  $("#frei").onclick = () => materialBearbeiten(b);
}

function materialZeile(m, mitBaustelle) {
  const vk = matVk(m), st = mstatus(m);
  const bs = mitBaustelle ? store.get(m.baustelleId) : null;
  const unter = [mitBaustelle ? bs?.name : datum(m.datum), m.notiz].filter(Boolean).map(esc).join(" · ");
  return `<div class="karte eintrag material" data-id="${m.id}" role="button" tabindex="0">
    <div class="zeile"><b>${esc(m.bezeichnung)}${artVon(m) === "arbeit" ? ` <span class="art-tag">Arbeit</span>` : ""}</b><span class="wert">${fmt(menge(m))} ${esc(m.einheit || "")}</span></div>
    <div class="zeile leise">
      <span>${unter}</span>
      <span class="rechts">${vk != null ? euro(vk) : ""}<button class="mstatus ${st}" data-status="${m.id}" title="Antippen zum Weiterschalten">${MSTATUS[st]}</button></span>
    </div>
  </div>`;
}

// Klick auf Zeile = bearbeiten, Klick auf Status = weiterschalten
function verknuepfen(ziel, b) {
  ziel.querySelectorAll("[data-status]").forEach((el) => (el.onclick = async (e) => {
    e.stopPropagation();
    const m = store.get(el.dataset.status);
    const neu = NAECHSTER[mstatus(m)];
    await store.speichern({ ...m, status: neu, ...(neu === "bestellt" ? { bestelltAm: heute() } : {}) });
    neuZeichnen();
  }));
  ziel.querySelectorAll(".material[data-id]").forEach((el) => {
    const auf = () => { const m = store.get(el.dataset.id); materialBearbeiten(b || store.get(m.baustelleId), m); };
    el.onclick = auf;
    el.onkeydown = (e) => { if (e.key === "Enter") auf(); };
  });
}

export async function materialBearbeiten(b, m) {
  const frueher = store.liste("material");
  let artikelId = m?.artikelId || "";
  let vkVonHand = !!(m && zahl(m.vk) != null);
  const namen = [...new Set([...artikel().map((a) => a.name), ...frueher.map((x) => x.bezeichnung)].filter(Boolean))];
  const felder = [
    { n: "bezeichnung", l: "Material", pflicht: true, liste: namen, platzhalter: "Name eintippen oder aus Liste wählen" },
    { n: "menge", l: "Menge", typ: "zahl", halb: true },
    { n: "einheit", l: "Einheit", halb: true, liste: EINHEITEN, standard: "Stk" },
    { n: "preis", l: "Einkauf € / Einheit", typ: "zahl", halb: true },
    { n: "vk", l: "Kundenpreis € / Einheit", typ: "zahl", halb: true },
    { n: "art", l: "Im Angebot unter", typ: "select", opt: Object.entries(ARTEN), halb: true, standard: "material" },
    { n: "status", l: "Status", typ: "select", opt: Object.entries(MSTATUS), halb: true, standard: "vorhanden" },
    { n: "datum", l: "Datum", typ: "date", halb: true },
    { n: "notiz", l: "Notiz / Lieferant" },
  ];
  if (!m) felder.push({ n: "inListe", l: "Neu in die Preisliste aufnehmen", typ: "check", standard: "1" });
  const info = (form) => {
    const mg = zahl(form.menge.value) || 0, ek = zahl(form.preis.value), vk = zahl(form.vk.value);
    form.info.textContent = [vk != null ? `Kunde: ${euro(mg * vk)}` : "Kein Kundenpreis", ek != null ? `Einkauf: ${euro(mg * ek)}` : ""].filter(Boolean).join(" · ");
    if (form.inListe) form.inListe.closest("label").hidden = !!artikelNachName(form.bezeichnung.value);
  };
  const erg = await formular({
    titel: m ? "Material bearbeiten" : "Material eintragen",
    werte: m ? { ...m, preis: preisText(m.preis), vk: preisText(m.vk), status: mstatus(m), art: artVon(m) } : { datum: heute(), menge: "1", status: "vorhanden" },
    loeschbar: !!m,
    fuss: true,
    felder,
    beiStart: info,
    beiEingabe(form, feld) {
      if (feld === "bezeichnung") {
        const a = artikelNachName(form.bezeichnung.value);
        if (a) {
          artikelId = a.id;
          form.einheit.value = a.einheit || form.einheit.value;
          form.preis.value = preisText(a.ek);
          form.vk.value = preisText(a.vk);
          form.art.value = artikelArt(a);
          vkVonHand = true;
        } else {
          artikelId = "";
          const vorher = frueher.filter((x) => x.bezeichnung === form.bezeichnung.value).sort((x, y) => y.updatedAt - x.updatedAt)[0];
          if (vorher) { form.einheit.value = vorher.einheit || form.einheit.value; form.preis.value = preisText(vorher.preis); form.vk.value = preisText(vorher.vk); }
        }
      }
      if (feld === "vk") vkVonHand = form.vk.value !== "";
      if (feld === "preis" && !vkVonHand) form.vk.value = vkAusEk(zahl(form.preis.value));
      info(form);
    },
  });
  if (!erg) return;
  if (erg.__loeschen) { await store.loeschen(m.id); return neuZeichnen(); }
  const { inListe, ...daten } = erg;
  const vorher = m?.status;
  if (daten.status === "bestellt" && vorher !== "bestellt") daten.bestelltAm = heute();
  if (inListe && !artikelNachName(daten.bezeichnung)) {
    const a = await store.speichern({ typ: "artikel", name: daten.bezeichnung, einheit: daten.einheit, ek: daten.preis, vk: daten.vk, lieferant: daten.notiz, art: daten.art });
    artikelId = a.id;
  }
  await store.speichern({ ...(m || { typ: "material", baustelleId: b.id }), ...daten, artikelId });
  neuZeichnen();
}

// ----- Mehrere Materialien auf einmal aus der Preisliste -----
function auswahlDialog(b) {
  const alle = artikel();
  if (!alle.length) {
    if (confirm("Die Preisliste ist noch leer. Jetzt Materialien anlegen?")) location.hash = "#/preise";
    return;
  }
  const mengen = new Map();
  dialog.innerHTML = `
    <form method="dialog" class="dlg auswahl">
      <h3>Aus Preisliste wählen</h3>
      <input type="search" class="suche" placeholder="Suchen …" autocomplete="off">
      <div class="auswahl-liste"></div>
      <div class="felder">
        <label class="feld halb"><span>Status</span><select name="status">${Object.entries(MSTATUS).map(([k, l]) => `<option value="${k}" ${k === "vorhanden" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="feld halb"><span>Datum</span><input type="date" name="datum" value="${heute()}"></label>
      </div>
      <p class="dlg-info" data-info></p>
      <div class="dlg-knoepfe"><span class="platz"></span>
        <button type="button" class="btn" data-abbrechen>Abbrechen</button>
        <button type="submit" class="btn primaer" data-ok disabled>Übernehmen</button>
      </div>
    </form>`;
  const form = $("form", dialog);
  const listeEl = $(".auswahl-liste", form);
  const suche = $(".suche", form);
  const zeichnen = () => {
    const q = suche.value.trim().toLowerCase();
    let gruppe = null;
    listeEl.innerHTML = alle.filter((a) => !q || [a.name, a.kategorie, a.lieferant].join(" ").toLowerCase().includes(q)).map((a) => {
      const kopf = (a.kategorie || "") !== gruppe ? `<div class="auswahl-gruppe">${esc((gruppe = a.kategorie || "") || "Ohne Kategorie")}</div>` : "";
      const n = mengen.get(a.id) || 0;
      return `${kopf}<div class="auswahl-zeile ${n ? "gewaehlt" : ""}" data-a="${a.id}">
        <div class="auswahl-name"><b>${esc(a.name)}</b><small>${zahl(a.vk) != null ? euro(zahl(a.vk)) + " / " + esc(a.einheit || "Stk") : esc(a.einheit || "")}</small></div>
        <button type="button" class="stepper" data-d="-1" aria-label="weniger">−</button>
        <input class="menge" inputmode="decimal" value="${n ? fmt(n, 3) : ""}" placeholder="0" aria-label="Menge">
        <button type="button" class="stepper" data-d="1" aria-label="mehr">＋</button>
      </div>`;
    }).join("") || `<p class="leise mitte">Nichts gefunden.</p>`;
  };
  const infoAkt = () => {
    const gew = [...mengen].filter(([, n]) => n > 0);
    const summe = gew.reduce((s, [id, n]) => s + n * (zahl(store.get(id)?.vk) || 0), 0);
    $("[data-info]", form).textContent = gew.length ? `${gew.length} Material(ien) gewählt · Kunde ${euro(summe)}` : "Menge eintragen oder ＋ tippen";
    const ok = $("[data-ok]", form);
    ok.disabled = !gew.length;
    ok.textContent = gew.length ? `Übernehmen (${gew.length})` : "Übernehmen";
  };
  listeEl.addEventListener("click", (e) => {
    const knopf = e.target.closest(".stepper");
    if (!knopf) return;
    const zeile = knopf.closest("[data-a]");
    const n = Math.max(0, (mengen.get(zeile.dataset.a) || 0) + Number(knopf.dataset.d));
    mengen.set(zeile.dataset.a, n);
    zeile.querySelector(".menge").value = n ? fmt(n, 3) : "";
    zeile.classList.toggle("gewaehlt", n > 0);
    infoAkt();
  });
  listeEl.addEventListener("input", (e) => {
    const zeile = e.target.closest("[data-a]");
    if (!zeile) return;
    const n = Math.max(0, zahl(e.target.value) || 0);
    mengen.set(zeile.dataset.a, n);
    zeile.classList.toggle("gewaehlt", n > 0);
    infoAkt();
  });
  suche.addEventListener("input", zeichnen);
  suche.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
  let fertig = false;
  $("[data-abbrechen]", form).onclick = () => dialog.close();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (fertig) return;
    fertig = true;
    const status = form.status.value, d = form.datum.value || heute();
    for (const [id, n] of mengen) {
      if (!(n > 0)) continue;
      const a = store.get(id);
      await store.speichern({
        typ: "material", baustelleId: b.id, artikelId: a.id, bezeichnung: a.name, einheit: a.einheit || "Stk", art: artikelArt(a),
        menge: String(n), preis: a.ek || "", vk: a.vk || "", status, datum: d, notiz: a.lieferant || "",
        ...(status === "bestellt" ? { bestelltAm: heute() } : {}),
      });
    }
    dialog.close();
    neuZeichnen();
  };
  dialog.onclose = null;
  zeichnen();
  infoAkt();
  dialog.showModal();
  if (!matchMedia("(pointer: coarse)").matches) suche.focus();
}

// =====================================================================
//  Bestellliste über alle Baustellen
// =====================================================================
export function ansichtBestellen(kopf, inhalt) {
  kopf("Bestellungen", "#/");
  const offen = store.liste("material", (m) => (m.status === "zu_bestellen" || m.status === "bestellt") && store.get(m.baustelleId));
  const gruppe = (k) => offen.filter((m) => m.status === k).sort((a, b) => (store.get(a.baustelleId).name || "").localeCompare(store.get(b.baustelleId).name || "", "de") || a.bezeichnung.localeCompare(b.bezeichnung, "de"));
  const zu = gruppe("zu_bestellen"), be = gruppe("bestellt");
  inhalt.innerHTML = `
    <p class="leise klein">Status antippen schaltet weiter: Zu bestellen → Bestellt → Vorhanden.</p>
    <h2>Zu bestellen (${zu.length}) ${zu.length ? `<button class="btn klein-btn" id="teilen">📤 Liste senden / kopieren</button>` : ""}</h2>
    <div class="liste">${zu.map((m) => materialZeile(m, true)).join("") || `<div class="leer klein">Nichts zu bestellen. 👍</div>`}</div>
    <h2>Bestellt – warte auf Lieferung (${be.length})</h2>
    <div class="liste">${be.map((m) => materialZeile(m, true).replace("</b>", `</b>${m.bestelltAm ? ` <small class="leise">seit ${new Date(m.bestelltAm + "T12:00").toLocaleDateString("de-DE")}</small>` : ""}`)).join("") || `<div class="leer klein">Keine offenen Bestellungen.</div>`}</div>`;
  verknuepfen(inhalt, null);
  $("#teilen")?.addEventListener("click", async () => {
    // Nach Lieferant gruppieren (aus Preisliste bzw. Notiz)
    const nachLieferant = new Map();
    for (const m of zu) {
      const a = m.artikelId ? store.get(m.artikelId) : null;
      const l = a?.lieferant || "Ohne Lieferant";
      if (!nachLieferant.has(l)) nachLieferant.set(l, []);
      nachLieferant.get(l).push(m);
    }
    const text = [...nachLieferant].map(([l, ms]) => `*${l}*\n` + ms.map((m) =>
      `- ${fmt(menge(m), 3)} ${m.einheit || ""} ${m.bezeichnung}${m.artikelId && store.get(m.artikelId)?.artnr ? ` (Art.-Nr. ${store.get(m.artikelId).artnr})` : ""} – ${store.get(m.baustelleId).name}`).join("\n")).join("\n\n");
    try {
      if (navigator.share) await navigator.share({ title: "Bestellliste", text });
      else { await navigator.clipboard.writeText(text); alert("Bestellliste kopiert – z.B. in WhatsApp oder E-Mail einfügen."); }
    } catch (e) {
      if (e.name !== "AbortError") prompt("Zum Kopieren:", text);
    }
  });
}

// =====================================================================
//  Preisliste
// =====================================================================
export function ansichtPreisliste(kopf, inhalt, tab = "material") {
  kopf("Preisliste", "#/");
  inhalt.innerHTML = `
    <nav class="unter-tabs"><a href="#/preise" class="${tab === "material" ? "aktiv" : ""}">Material</a><a href="#/preise/stunden" class="${tab === "stunden" ? "aktiv" : ""}">Stundensätze</a></nav>
    <div id="tab"></div>`;
  (tab === "stunden" ? tabSaetze : tabArtikel)($("#tab"));
}

function tabArtikel(ziel) {
  const suche = (sessionStorage.getItem("artSuche") || "").toLowerCase();
  const alle = artikel();
  const liste = alle.filter((a) => !suche || [a.name, a.kategorie, a.lieferant, a.artnr].join(" ").toLowerCase().includes(suche));
  let gruppe = null;
  ziel.innerHTML = `
    <div class="knopfreihe oben">
      <button class="btn primaer" id="vorlage" hidden>📦 Vorbereitete Preisliste übernehmen</button>
      <button class="btn primaer" id="einfuegen">📥 Liste einfügen</button>
      <button class="btn" id="csv" ${alle.length ? "" : "disabled"}>⬇ Als Excel (CSV)</button>
    </div>
    <form class="aufschlag" id="aufschlag">Kundenpreis automatisch = Einkauf + <input name="a" inputmode="decimal" value="${esc(store.getMeta("aufschlag", "20"))}"> % Aufschlag</form>
    <div class="suchzeile"><input id="art-suche" type="search" placeholder="Suchen: Name, Kategorie, Lieferant …" value="${esc(sessionStorage.getItem("artSuche") || "")}"></div>
    <div class="liste">${liste.map((a) => {
      const ek = zahl(a.ek), vk = zahl(a.vk);
      const kopfZeile = (a.kategorie || "") !== gruppe ? `<h2>${esc((gruppe = a.kategorie || "") || "Ohne Kategorie")}</h2>` : "";
      return `${kopfZeile}<button class="karte eintrag" data-art="${a.id}">
        <div class="zeile"><b>${esc(a.name)}${artikelArt(a) === "arbeit" ? ` <span class="art-tag">Arbeit</span>` : ""}</b><span class="wert">${vk != null ? euro(vk) : "–"} <small class="leise">/ ${esc(a.einheit || "Stk")}</small></span></div>
        <div class="zeile leise klein"><span>${esc([a.lieferant, a.artnr && "Nr. " + a.artnr].filter(Boolean).join(" · "))}</span><span>${ek != null ? `EK ${euro(ek)}${vk != null && ek ? ` · +${fmt(((vk - ek) / ek) * 100, 0)} %` : ""}` : ""}</span></div>
      </button>`;
    }).join("") || `<div class="leer">${suche ? "Nichts gefunden." : "Noch keine Materialien.<br>Tippe auf <b>＋</b> oder füge eine ganze Liste aus Excel ein."}</div>`}</div>
    <button class="fab" id="neu" aria-label="Neues Material">＋</button>`;
  const s = $("#art-suche");
  s.addEventListener("input", () => {
    sessionStorage.setItem("artSuche", s.value);
    const pos = s.selectionStart;
    tabArtikel(ziel);
    const n = $("#art-suche"); n.focus(); n.setSelectionRange(pos, pos);
  });
  $("#aufschlag").onsubmit = (e) => e.preventDefault();
  $("#aufschlag").a.onchange = (e) => store.setMeta("aufschlag", e.target.value.trim());
  ziel.querySelectorAll("[data-art]").forEach((el) => (el.onclick = () => artikelBearbeiten(store.get(el.dataset.art))));
  $("#neu").onclick = () => artikelBearbeiten();
  $("#einfuegen").onclick = listeEinfuegen;
  vorlageAnbieten();
  $("#csv").onclick = () => {
    const z = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const zeilen = [["Name", "Einheit", "Einkaufspreis", "Kundenpreis", "Kategorie", "Lieferant", "Artikelnummer"],
      ...alle.map((a) => [a.name, a.einheit, preisText(a.ek), preisText(a.vk), a.kategorie, a.lieferant, a.artnr])];
    herunterladen(`preisliste-${heute()}.csv`, "﻿" + zeilen.map((r) => r.map(z).join(";")).join("\r\n"), "text/csv");
  };
}

async function artikelBearbeiten(a) {
  let vkVonHand = !!(a && zahl(a.vk) != null);
  const kategorien = [...new Set(store.liste("artikel").map((x) => x.kategorie).filter(Boolean))];
  const lieferanten = [...new Set(store.liste("artikel").map((x) => x.lieferant).filter(Boolean))];
  const info = (form) => {
    const ek = zahl(form.ek.value), vk = zahl(form.vk.value);
    form.info.textContent = ek && vk != null ? `Aufschlag ${fmt(((vk - ek) / ek) * 100, 1)} % = ${euro(vk - ek)} je ${form.einheit.value || "Einheit"}` : "";
  };
  const erg = await formular({
    titel: a ? "Material bearbeiten" : "Neues Material",
    werte: a ? { ...a, ek: preisText(a.ek), vk: preisText(a.vk), art: artikelArt(a) } : { einheit: "Stk" },
    loeschbar: !!a,
    fuss: true,
    felder: [
      { n: "name", l: "Name", pflicht: true, platzhalter: "z.B. Fliesenkleber flexibel 25 kg" },
      { n: "einheit", l: "Einheit", halb: true, liste: EINHEITEN },
      { n: "kategorie", l: "Kategorie", halb: true, liste: kategorien, platzhalter: "z.B. Fliesen" },
      { n: "art", l: "Im Angebot unter", typ: "select", opt: Object.entries(ARTEN), standard: "material" },
      { n: "ek", l: "Einkauf € / Einheit", typ: "zahl", halb: true },
      { n: "vk", l: "Kundenpreis € / Einheit", typ: "zahl", halb: true },
      { n: "lieferant", l: "Lieferant", halb: true, liste: lieferanten },
      { n: "artnr", l: "Artikelnummer", halb: true },
    ],
    beiStart: info,
    beiEingabe(form, feld) {
      if (feld === "vk") vkVonHand = form.vk.value !== "";
      if (feld === "ek" && !vkVonHand) form.vk.value = vkAusEk(zahl(form.ek.value));
      info(form);
    },
  });
  if (!erg) return;
  if (erg.__loeschen) await store.loeschen(a.id);
  else {
    const doppelt = artikelNachName(erg.name);
    if (doppelt && doppelt.id !== a?.id && !confirm(`„${doppelt.name}“ gibt es schon. Trotzdem ein zweites Mal anlegen?`)) return;
    await store.speichern({ ...(a || { typ: "artikel" }), ...erg });
  }
  neuZeichnen();
}

// ----- Vorbereitete Preisliste, die mit der App mitkommt (vorlagen/preisliste.txt) -----
// Bietet nur an, was neu ist oder sich geändert hat.
function unterschiede(liste) {
  const felder = ["einheit", "ek", "vk", "kategorie", "artnr", "art"];
  return liste.filter((neu) => {
    const alt = artikelNachName(neu.name);
    if (!alt) return true;
    return felder.some((k) => neu[k] != null && String(neu[k]) !== String(k === "art" ? artikelArt(alt) : alt[k] ?? ""));
  });
}

async function vorlageAnbieten() {
  const knopf = $("#vorlage");
  if (!knopf) return;
  let liste;
  try {
    const res = await fetch("vorlagen/preisliste.txt", { cache: "no-cache" });
    if (!res.ok) return;
    liste = listeLesen((await res.text()).split("\n").filter((z) => !z.trim().startsWith("#")).join("\n"));
  } catch { return; }
  const offen = unterschiede(liste);
  if (!offen.length || !document.body.contains(knopf)) return;
  const neu = offen.filter((a) => !artikelNachName(a.name)).length;
  knopf.hidden = false;
  knopf.textContent = `📦 Vorbereitete Preisliste übernehmen (${[neu && neu + " neu", offen.length - neu && offen.length - neu + " geändert"].filter(Boolean).join(", ")})`;
  knopf.onclick = async () => {
    if (!confirm(`${offen.length} Einträge in die Preisliste übernehmen?${offen.length - neu ? " Bei vorhandenen werden die Preise aktualisiert." : ""}`)) return;
    knopf.disabled = true;
    for (const a of offen) {
      const alt = artikelNachName(a.name);
      await store.speichern({ ...(alt || { typ: "artikel", einheit: "Stk" }), ...a });
    }
    neuZeichnen();
  };
}

// ----- Ganze Liste einfügen (aus Excel, Word, Text) -----
const SPALTEN = {
  name: /^(name|bezeichnung|material|artikel|text|beschreibung)/i,
  einheit: /^(einheit|me|eh|unit)/i,
  ek: /^(ek|einkauf|netto.?ek|preis.?ek)/i,
  vk: /^(vk|verkauf|kunde|kundenpreis|preis)/i,
  kategorie: /^(kategorie|gruppe|warengruppe|bereich)/i,
  lieferant: /^(lieferant|händler|haendler|hersteller)/i,
  artnr: /^(art|artikelnummer|art\.?-?nr|nummer|nr)/i,
};
const STANDARD_REIHENFOLGE = ["name", "einheit", "ek", "vk", "kategorie", "lieferant", "artnr", "art"];

export function listeLesen(text) {
  const zeilen = text.split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  if (!zeilen.length) return [];
  const trenner = zeilen.some((z) => z.includes("\t")) ? "\t" : zeilen.some((z) => z.includes(";")) ? ";" : null;
  const teilen = (z) => (trenner ? z.split(trenner) : [z]).map((x) => x.trim().replace(/^"(.*)"$/, "$1").trim());
  let reihenfolge = STANDARD_REIHENFOLGE;
  const erste = teilen(zeilen[0]);
  // Kopfzeile erkennen und Spalten danach zuordnen
  if (erste.some((x) => SPALTEN.name.test(x)) && !erste.some((x) => zahl(x) != null)) {
    reihenfolge = erste.map((x) => Object.keys(SPALTEN).find((k) => SPALTEN[k].test(x)) || null);
    zeilen.shift();
  }
  const geld = (v) => { if (!v) return ""; const n = zahl(String(v).replace(/[€\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "")); return n == null ? "" : String(n).replace(".", ","); };
  return zeilen.map((z) => {
    const w = teilen(z);
    const a = {};
    reihenfolge.forEach((k, i) => { if (k && w[i] != null && w[i] !== "") a[k] = w[i]; });
    if (a.art) a.art = /arbeit|leistung/i.test(a.art) ? "arbeit" : /material/i.test(a.art) ? "material" : undefined;
    if (!a.art) delete a.art;
    if (a.ek) a.ek = geld(a.ek);
    // "-" beim Kundenpreis = wird nicht verrechnet (kein automatischer Aufschlag)
    if (a.vk && /^[-–—]$/.test(a.vk.trim())) { a.vk = ""; a.nichtVerrechnen = true; }
    else if (a.vk) a.vk = geld(a.vk);
    return a;
  }).filter((a) => a.name);
}

function listeEinfuegen() {
  dialog.innerHTML = `
    <form method="dialog" class="dlg">
      <h3>Liste einfügen</h3>
      <p class="leise klein">Eine Zeile pro Material. Am einfachsten in <b>Excel</b> die Zeilen markieren, kopieren und hier einfügen.
      Reihenfolge der Spalten: <b>Name; Einheit; Einkaufspreis; Kundenpreis; Kategorie; Lieferant; Artikelnummer</b>.
      Mit Überschriftenzeile (z.B. „Name, Einheit, EK, VK“) dürfen die Spalten auch anders sortiert sein. Nur der Name ist Pflicht.
      Steht in der Kategorie „Arbeit“ (oder z.B. „Verlegen“, „Montage“), kommt der Eintrag im Angebot unter <b>Arbeit</b>, sonst unter <b>Material</b>.
      Ein <b>„-“ als Kundenpreis</b> heißt: wird nicht verrechnet (z.B. Silikon-Tuben, wenn der Kunde pro lm zahlt) – kommt dann nicht aufs Angebot.</p>
      <textarea name="text" rows="9" placeholder="Fliesenkleber flexibel; Sack; 12,90; 18,50; Fliesen; Baumarkt&#10;Silikon Tube sanitär weiß; Stk; 6,20; -; Material&#10;Silikon verfugen; lm; ; 4,30; Fliesen"></textarea>
      <label class="feld"><span>Die eingefügten Einträge kommen im Angebot unter</span><select name="art">
        <option value="">automatisch (nach Kategorie)</option><option value="material">Material</option><option value="arbeit">Arbeit</option></select></label>
      <label class="feld check"><input type="checkbox" name="auto" checked><span>Fehlenden Kundenpreis aus Einkauf + ${esc(store.getMeta("aufschlag", "20"))} % berechnen</span></label>
      <p class="dlg-info" data-info>Noch nichts eingefügt.</p>
      <div class="dlg-knoepfe"><span class="platz"></span>
        <button type="button" class="btn" data-abbrechen>Abbrechen</button>
        <button type="submit" class="btn primaer" data-ok disabled>Übernehmen</button>
      </div>
    </form>`;
  const form = $("form", dialog);
  let gelesen = [];
  const pruefen = () => {
    gelesen = listeLesen(form.text.value);
    const vorhanden = gelesen.filter((a) => artikelNachName(a.name)).length;
    $("[data-info]", form).innerHTML = gelesen.length
      ? `<b>${gelesen.length}</b> Material(ien) erkannt${vorhanden ? `, davon ${vorhanden} schon vorhanden (werden aktualisiert)` : ""}.<br><small>Erste Zeile: ${esc([gelesen[0].name, gelesen[0].einheit, gelesen[0].ek && "EK " + gelesen[0].ek, gelesen[0].vk && "VK " + gelesen[0].vk, gelesen[0].kategorie].filter(Boolean).join(" · "))}</small>`
      : "Noch nichts erkannt.";
    $("[data-ok]", form).disabled = !gelesen.length;
  };
  form.text.addEventListener("input", pruefen);
  $("[data-abbrechen]", form).onclick = () => dialog.close();
  form.onsubmit = async (e) => {
    e.preventDefault();
    for (const eintrag of gelesen) {
      const { nichtVerrechnen, ...neu } = eintrag;
      if (form.auto.checked && !nichtVerrechnen && !neu.vk && neu.ek) neu.vk = vkAusEk(zahl(neu.ek));
      if (form.art.value) neu.art = form.art.value;
      const alt = artikelNachName(neu.name);
      await store.speichern({ ...(alt || { typ: "artikel", einheit: "Stk" }), ...neu });
    }
    dialog.close();
    sessionStorage.removeItem("artSuche");
    neuZeichnen();
  };
  dialog.onclose = null;
  dialog.showModal();
}

// ----- Stundensätze -----
function tabSaetze(ziel) {
  const liste = saetze();
  ziel.innerHTML = `
    <p class="leise klein">Lege hier deine Stundensätze an (z.B. Facharbeiter, Helfer, Maschine). Beim Stunden-Eintragen wählst du dann nur noch aus.</p>
    <div class="liste">${liste.map((s) => `
      <button class="karte eintrag" data-satz="${s.id}">
        <div class="zeile"><b>${esc(s.name)}${s.standard ? ` <span class="status laufend">Standard</span>` : ""}</b><span class="wert">${euro(zahl(s.preis))} / h</span></div>
        ${zahl(s.kosten) != null ? `<div class="leise klein">Eigene Kosten ${euro(zahl(s.kosten))} / h</div>` : ""}
      </button>`).join("") || `<div class="leer">Noch keine Stundensätze.</div>`}</div>
    <button class="fab" id="neu" aria-label="Neuer Stundensatz">＋</button>`;
  ziel.querySelectorAll("[data-satz]").forEach((el) => (el.onclick = () => satzBearbeiten(store.get(el.dataset.satz))));
  $("#neu").onclick = () => satzBearbeiten();
}

async function satzBearbeiten(s) {
  const erste = !saetze().length;
  const erg = await formular({
    titel: s ? "Stundensatz bearbeiten" : "Neuer Stundensatz",
    werte: s ? { ...s, preis: preisText(s.preis), kosten: preisText(s.kosten) } : { standard: erste ? "1" : "" },
    loeschbar: !!s,
    felder: [
      { n: "name", l: "Bezeichnung", pflicht: true, liste: ["Facharbeiter", "Geselle", "Meister", "Helfer", "Lehrling", "Regie", "Maschine", "Anfahrt"] },
      { n: "preis", l: "Kundenpreis € / Stunde", typ: "zahl", pflicht: true, halb: true },
      { n: "kosten", l: "Eigene Kosten € / Std. (optional)", typ: "zahl", halb: true },
      { n: "standard", l: "Als Standard vorschlagen", typ: "check" },
    ],
  });
  if (!erg) return;
  if (erg.__loeschen) await store.loeschen(s.id);
  else {
    if (erg.standard) for (const x of saetze()) if (x.standard && x.id !== s?.id) await store.speichern({ ...x, standard: "" });
    await store.speichern({ ...(s || { typ: "satz" }), ...erg });
  }
  neuZeichnen();
}
