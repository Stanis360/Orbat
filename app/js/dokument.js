// Angebot / Rechnung zum Drucken (bzw. als PDF speichern)
// Firmendaten liegen in einem eigenen Datensatz (id "firma"), damit sie auf alle Geräte synchronisiert werden.
import * as store from "./store.js";
import * as preise from "./preise.js";
import { $, esc, zahl, fmt, datum, heute, formular } from "./ui.js";

export const ARTEN = { angebot: "Angebot", rechnung: "Rechnung" };
const FIRMA_ID = "firma";

export const firma = () => store.get(FIRMA_ID) || {};
export async function firmaSpeichern(daten) {
  return store.speichern({ ...(store.get(FIRMA_ID) || { id: FIRMA_ID, typ: "firma" }), ...daten });
}

// Zahlen wie in der Vorlage: 1.234,56 (ohne €-Zeichen)
const z2 = (n) => (n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nr = (art) => zahl(firma()[`nr_${art}`]) || 1;

// ---------- Positionen aus der Baustelle ----------
export function positionen(b, { stundenZusammen }) {
  // Reihenfolge wie in der Vorlage: erst Material und Leistungen, dann Arbeitsstunden
  const pos = store.von("material", b.id)
    .sort((x, y) => (x.datum || "").localeCompare(y.datum || "") || x.updatedAt - y.updatedAt)
    .map((m) => ({ code: (m.artikelId && store.get(m.artikelId)?.artnr) || "", text: m.bezeichnung, me: m.einheit || "", menge: zahl(m.menge) || 0, preis: zahl(m.vk) }));
  const stunden = store.von("stunden", b.id).sort((x, y) => (x.datum || "").localeCompare(y.datum || ""));
  if (stundenZusammen) {
    // Nach Stundensatz und Preis zusammenfassen
    const gruppen = new Map();
    for (const s of stunden) {
      const k = `${s.satz || ""}|${zahl(s.stundenpreis) ?? ""}`;
      if (!gruppen.has(k)) gruppen.set(k, { text: `Arbeitsstunden${s.satz ? " " + s.satz : ""}`, me: "h", menge: 0, preis: zahl(s.stundenpreis) });
      gruppen.get(k).menge += zahl(s.stunden) || 0;
    }
    pos.push(...gruppen.values());
  } else {
    for (const s of stunden) pos.push({ text: `Arbeitsstunden${s.taetigkeit ? " " + s.taetigkeit : s.satz ? " " + s.satz : ""}`, me: "h", menge: zahl(s.stunden) || 0, preis: zahl(s.stundenpreis) });
  }
  return pos;
}

// ---------- Ansicht ----------
export function ansicht(kopf, inhalt, id, art = "angebot") {
  const b = store.get(id);
  if (!b) { location.hash = "#/"; return; }
  if (!ARTEN[art]) art = "angebot";
  kopf(ARTEN[art], `#/b/${id}`);
  const f = firma();
  const satz = preise.mwst(b);
  const zusammen = store.getMeta("stundenZusammen", false);
  const pos = positionen(b, { stundenZusammen: zusammen });
  const netto = pos.reduce((s, p) => s + (p.preis != null ? p.menge * p.preis : 0), 0);
  const steuer = Math.round(netto * satz) / 100;
  const nummer = b[`${art}Nr`] || String(nr(art));
  const dokDatum = b[`${art}Datum`] || heute();
  const text = b[`${art}Text`] ?? b.angebotText ?? "";
  const ohnePreis = pos.filter((p) => p.preis == null).length;
  const empfaenger = (b.rechnungsadresse || [b.kunde, b.adresse].filter(Boolean).join("\n")).split("\n").map((z) => z.trim()).filter(Boolean);
  const firmaFehlt = !f.name;

  inhalt.innerHTML = `
    <div class="nicht-drucken dok-steuerung">
      <div class="filter">${Object.entries(ARTEN).map(([k, l]) => `<a class="chip ${k === art ? "aktiv" : ""}" href="#/dok/${id}/${k}">${l}</a>`).join("")}</div>
      ${firmaFehlt ? `<p class="warnbox">Deine Firmendaten fehlen noch (Name, Adresse, Steuernummer, Bank). <a class="link" href="#/einstellungen">Jetzt unter ⚙ Einstellungen eintragen</a></p>` : ""}
      ${ohnePreis ? `<p class="warnbox">${ohnePreis} Position(en) ohne Kundenpreis – bitte in Stunden/Material nachtragen.</p>` : ""}
      <form class="karte form" id="dok-form">
        <div class="felder">
          <label class="feld halb"><span>Nummer</span><input name="nr" value="${esc(nummer)}"></label>
          <label class="feld halb"><span>Datum</span><input name="datum" type="date" value="${esc(dokDatum)}"></label>
          <label class="feld"><span>Einleitung (erste Zeile, z.B. „Liefern und verlegen der Wand- und Bodenfliesen für das Bad“)</span><input name="text" value="${esc(text)}"></label>
          <label class="feld halb"><span>MwSt. %</span><input name="mwst" inputmode="decimal" value="${esc(fmt(satz))}"></label>
          <label class="feld check halb"><input type="checkbox" name="zusammen" ${zusammen ? "checked" : ""}><span>Stunden zusammenfassen</span></label>
        </div>
      </form>
      <div class="knopfreihe"><button class="btn primaer" id="drucken">🖨 Drucken / als PDF speichern</button>
        <button class="btn" id="kunde">✎ Empfänger / Kundendaten</button></div>
    </div>

    <article class="dok">
      <header class="dok-firma">
        <b>${esc(f.name || "Deine Firma")}</b>
        ${(f.adresse || "").split("\n").filter(Boolean).map((z) => `<div>${esc(z)}</div>`).join("")}
        ${f.steuernr ? `<div>Steuernummer ${esc(f.steuernr)}</div>` : ""}
        ${f.ustid ? `<div>USt.-ID ${esc(f.ustid)}</div>` : ""}
        ${f.kontakt ? `<div>${esc(f.kontakt)}</div>` : ""}
      </header>

      <div class="dok-raster dokkopf">
        <div class="dok-titel">${ARTEN[art]}</div>
        <div class="zelle"><small>Datum</small><b>${new Date(dokDatum + "T12:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}</b></div>
        <div class="zelle"><small>Nummer</small><b>${esc(nummer)}</b></div>
      </div>
      <div class="dok-raster zwei">
        <div class="zelle hoch"><small>Zielort</small><b>${esc(b.adresse || b.name)}</b></div>
        <div class="zelle hoch"><small>Empfänger</small><b>${empfaenger.map(esc).join("<br>") || "&nbsp;"}</b></div>
      </div>
      <div class="dok-raster vier">
        <div class="zelle"><small>Kundennr.</small><b>${esc(b.kundennr || "")}&nbsp;</b></div>
        <div class="zelle"><small>Währung</small><b>EUR</b></div>
        <div class="zelle"><small>USt.-ID</small><b>${esc(b.kundeUstId || "")}&nbsp;</b></div>
        <div class="zelle"><small>Steuernummer</small><b>${esc(b.kundeSteuernr || "")}&nbsp;</b></div>
      </div>

      <table class="dok-pos">
        <thead><tr><th>Code</th><th>Beschreibung</th><th>ME</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">Rabatt</th><th class="r">Betrag</th><th class="r">USt.</th></tr></thead>
        <tbody>
          ${text ? `<tr><td></td><td>${esc(text)}</td><td></td><td class="r">0,00</td><td class="r">0,00</td><td></td><td class="r">0,00</td><td class="r">${fmt(satz)}</td></tr>` : ""}
          ${pos.map((p) => `<tr><td>${esc(p.code || "")}</td><td>${esc(p.text)}</td><td>${esc(p.me)}</td><td class="r">${z2(p.menge)}</td><td class="r">${p.preis != null ? z2(p.preis) : "?"}</td><td></td><td class="r">${p.preis != null ? z2(p.menge * p.preis) : "?"}</td><td class="r">${fmt(satz)}</td></tr>`).join("")}
        </tbody>
      </table>

      <footer class="dok-fuss">
        <div class="dok-raster bank">
          <div class="zelle hoch"><small>Zahlungsart</small><b>${esc(f.zahlungsart || "Überweisung")}</b></div>
          <div class="zelle"><small>Referenzbank</small><b>${esc(f.bank || "")}&nbsp;</b></div>
          <div class="zelle"><small>Bankeinzug von</small><b>&nbsp;</b></div>
          <div class="zelle"><small>IBAN - SWIFT</small><b>${esc([f.iban, f.bic].filter(Boolean).join(" - "))}&nbsp;</b></div>
          <div class="zelle"><small>IBAN - SWIFT</small><b>&nbsp;</b></div>
        </div>
        <table class="dok-steuer">
          <tr><th>USt.-Id. - Bezeichnung</th><th class="r">Nettobetrag</th><th class="r">Steuersatz</th><th class="r">MWSt.</th></tr>
          <tr><td>${fmt(satz)} - MwSt. ${fmt(satz)}%</td><td class="r">${z2(netto)}</td><td class="r">${z2(satz)}%</td><td class="r">${z2(steuer)}</td></tr>
        </table>
        <div class="dok-details">
          <div class="dok-details-titel">Betrag Details</div>
          <div class="dok-raster sechs">
            <div class="zelle"><small>Waren und Dienstleistungen</small><b class="r">${z2(netto)}</b></div>
            <div class="zelle"><small>Rabatte</small><b class="r">0,00</b></div>
            <div class="zelle"><small>Anzahlungen</small><b class="r">0,00</b></div>
            <div class="zelle"><small>Steuer gesamt</small><b class="r">${z2(steuer)}</b></div>
            <div class="zelle"><small>Nettobetrag</small><b class="r">${z2(netto)}</b></div>
            <div class="zelle"><small>Gesamtbetrag des Dokuments</small><b class="r">${z2(netto + steuer)}</b></div>
          </div>
          <div class="dok-zahlen"><span>Zu zahlen gesamt</span><b>${z2(netto + steuer)}</b></div>
        </div>
        ${f.fusstext ? `<p class="dok-fusstext">${esc(f.fusstext)}</p>` : ""}
      </footer>
    </article>`;

  const form = $("#dok-form");
  const feld = async (daten) => { await store.speichern({ ...store.get(id), ...daten }); ansicht(kopf, inhalt, id, art); };
  form.nr.onchange = () => feld({ [`${art}Nr`]: form.nr.value.trim() });
  form.datum.onchange = () => feld({ [`${art}Datum`]: form.datum.value });
  form.text.onchange = () => feld({ [`${art}Text`]: form.text.value.trim() });
  form.mwst.onchange = () => feld({ mwst: form.mwst.value.trim() });
  form.zusammen.onchange = async () => { await store.setMeta("stundenZusammen", form.zusammen.checked); ansicht(kopf, inhalt, id, art); };
  form.onsubmit = (e) => e.preventDefault();
  $("#kunde").onclick = () => kundeBearbeiten(store.get(id)).then(() => ansicht(kopf, inhalt, id, art));
  $("#drucken").onclick = async () => {
    // Nummer und Datum beim ersten Drucken festhalten und den Zähler weiterzählen
    const akt = store.get(id);
    if (!akt[`${art}Nr`]) {
      await store.speichern({ ...akt, [`${art}Nr`]: nummer, [`${art}Datum`]: dokDatum });
      const n = zahl(nummer);
      if (n != null && n >= nr(art)) await firmaSpeichern({ [`nr_${art}`]: String(n + 1) });
    }
    const alterTitel = document.title;
    document.title = `${ARTEN[art]} ${nummer} ${b.kunde || b.name}`.replace(/[\\/:*?"<>|]/g, "-");
    print();
    document.title = alterTitel;
  };
}

export async function kundeBearbeiten(b) {
  const erg = await formular({
    titel: "Empfänger / Kundendaten",
    werte: { ...b, rechnungsadresse: b.rechnungsadresse || [b.kunde, b.adresse].filter(Boolean).join("\n") },
    felder: [
      { n: "rechnungsadresse", l: "Empfänger (Name, Straße, PLZ Ort – je eine Zeile)", typ: "textarea" },
      { n: "kundennr", l: "Kundennummer", halb: true },
      { n: "kundeUstId", l: "USt.-ID Kunde", halb: true },
      { n: "kundeSteuernr", l: "Steuernummer Kunde", halb: true },
      { n: "adresse", l: "Zielort / Adresse Baustelle", halb: true },
    ],
  });
  if (erg) await store.speichern({ ...store.get(b.id), ...erg });
}

// ---------- Firmendaten (Einstellungen) ----------
export function firmaFormular() {
  const f = firma();
  return `
    <form class="karte form" id="firma-form">
      <p class="leise klein">Erscheinen oben und unten auf Angebot und Rechnung. Werden auf alle Geräte synchronisiert.</p>
      <label class="feld"><span>Firmenname</span><input name="name" value="${esc(f.name || "")}" placeholder="z.B. Muster KG des Max Muster & Co."></label>
      <label class="feld"><span>Adresse (je eine Zeile)</span><textarea name="adresse" rows="2">${esc(f.adresse || "")}</textarea></label>
      <div class="felder">
        <label class="feld halb"><span>Steuernummer</span><input name="steuernr" value="${esc(f.steuernr || "")}"></label>
        <label class="feld halb"><span>USt.-ID</span><input name="ustid" value="${esc(f.ustid || "")}"></label>
        <label class="feld halb"><span>Telefon / E-Mail (optional)</span><input name="kontakt" value="${esc(f.kontakt || "")}"></label>
        <label class="feld halb"><span>Zahlungsart</span><input name="zahlungsart" value="${esc(f.zahlungsart || "Überweisung Sofort")}"></label>
        <label class="feld"><span>Bank</span><input name="bank" value="${esc(f.bank || "")}"></label>
        <label class="feld halb"><span>IBAN</span><input name="iban" value="${esc(f.iban || "")}" autocapitalize="characters"></label>
        <label class="feld halb"><span>BIC / SWIFT (optional)</span><input name="bic" value="${esc(f.bic || "")}" autocapitalize="characters"></label>
        <label class="feld halb"><span>MwSt. % (Standard)</span><input name="mwst" inputmode="decimal" value="${esc(f.mwst ?? store.getMeta("mwst", "20"))}"></label>
        <label class="feld halb"><span>Nächste Angebots-Nr.</span><input name="nr_angebot" inputmode="numeric" value="${esc(String(nr("angebot")))}"></label>
        <label class="feld halb"><span>Nächste Rechnungs-Nr.</span><input name="nr_rechnung" inputmode="numeric" value="${esc(String(nr("rechnung")))}"></label>
        <label class="feld"><span>Fußtext (optional, z.B. Gültigkeit, Zahlungsziel)</span><input name="fusstext" value="${esc(f.fusstext || "")}"></label>
      </div>
      <div class="knopfreihe"><button class="btn primaer" type="submit">Firmendaten speichern</button></div>
    </form>`;
}

export function firmaVerknuepfen() {
  const form = $("#firma-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const daten = {};
    for (const el of form.elements) if (el.name) daten[el.name] = el.value.trim();
    await firmaSpeichern(daten);
    form.querySelector("button[type=submit]").textContent = "✓ Gespeichert";
  };
}
