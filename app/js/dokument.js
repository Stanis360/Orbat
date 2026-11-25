// Angebot / Rechnung zum Drucken (bzw. als PDF speichern)
// Firmendaten liegen in einem eigenen Datensatz (id "firma"), damit sie auf alle Geräte synchronisiert werden.
import * as store from "./store.js";
import * as preise from "./preise.js";
import { $, esc, zahl, fmt, datum, heute, formular } from "./ui.js";

export const ARTEN = { angebot: "Angebot", rechnung: "Rechnung", aufstellung: "Aufstellung" };
// Die Aufstellung ist die Anlage zur Rechnung: gleiche Nummer, gleiches Datum
const schluesselVon = (art) => (art === "aufstellung" ? "rechnung" : art);
const STANDARD_SATZ = "Ausgeführte Arbeiten laut beiliegender Aufstellung – Baustelle {zielort}";
const FIRMA_ID = "firma";

export const firma = () => store.get(FIRMA_ID) || {};
export async function firmaSpeichern(daten) {
  return store.speichern({ ...(store.get(FIRMA_ID) || { id: FIRMA_ID, typ: "firma" }), ...daten });
}

// MwSt.-Auswahl pro Baustelle: leer = Standard aus den Firmendaten
export function mwstOptionen(aktuell) {
  const std = zahl(firma().mwst) ?? zahl(store.getMeta("mwst", "")) ?? 20;
  const opt = [["", `Standard (${fmt(std)} %)`], ["0", "0 % (z.B. Firmen)"], ["4", "4 %"], ["5", "5 %"], ["10", "10 %"], ["22", "22 %"]];
  if (aktuell && !opt.some(([k]) => zahl(k) === zahl(aktuell))) opt.push([aktuell, `${aktuell} %`]);
  return opt.map(([k, l]) => [k !== "" && zahl(k) === zahl(aktuell) ? aktuell : k, l]);
}

// Zahlen wie in der Vorlage: 1.234,56 (ohne €-Zeichen)
const z2 = (n) => (n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nr = (art) => zahl(firma()[`nr_${art}`]) || 1;

// ---------- Positionen aus der Baustelle ----------
export function positionen(b, { stundenZusammen }) {
  // Reihenfolge wie in der Vorlage: erst Material und Leistungen, dann Arbeitsstunden
  const pos = store.von("material", b.id)
    .sort((x, y) => (x.datum || "").localeCompare(y.datum || "") || x.updatedAt - y.updatedAt)
    .map((m) => ({ art: preise.artVon(m), code: (m.artikelId && store.get(m.artikelId)?.artnr) || "", text: m.bezeichnung, me: m.einheit || "", menge: zahl(m.menge) || 0, preis: zahl(m.vk) }));
  const stunden = store.von("stunden", b.id).sort((x, y) => (x.datum || "").localeCompare(y.datum || ""));
  if (stundenZusammen) {
    // Nach Stundensatz und Preis zusammenfassen
    const gruppen = new Map();
    for (const s of stunden) {
      const k = `${s.satz || ""}|${zahl(s.stundenpreis) ?? ""}`;
      if (!gruppen.has(k)) gruppen.set(k, { art: "arbeit", text: `Arbeitsstunden${s.satz ? " " + s.satz : ""}`, me: "h", menge: 0, preis: zahl(s.stundenpreis) });
      gruppen.get(k).menge += zahl(s.stunden) || 0;
    }
    pos.push(...gruppen.values());
  } else {
    for (const s of stunden) pos.push({ art: "arbeit", text: `Arbeitsstunden${s.taetigkeit ? " " + s.taetigkeit : s.satz ? " " + s.satz : ""}`, me: "h", menge: zahl(s.stunden) || 0, preis: zahl(s.stundenpreis) });
  }
  return pos;
}

// Satz für die Rechnung in SuperBill, mit Platzhaltern aus den Firmendaten
// Ist für die Baustelle ein eigener Satz gespeichert, wird der genommen.
export function satzFuerRechnung(f, b, nummer, datumText, einleitung, nurVorlage = false) {
  const werte = {
    zielort: b.adresse || b.name, baustelle: b.name, kunde: b.kunde || "", nummer, datum: datumText, einleitung: einleitung || "",
    baugenehmigung: b.baugenehmigung || "", bauparzelle: b.bauparzelle || "",
  };
  const vorlage = (!nurVorlage && b.satzRechnung) || f.satzVorlage || STANDARD_SATZ;
  return vorlage.replace(/\{(\w+)\}/g, (m, k) => (k in werte ? werte[k] : m)).replace(/\s+/g, " ").trim();
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
  const aufteilen = store.getMeta("aufteilen", true);
  // Positionen ohne Kundenpreis (z.B. Verbrauchsmaterial wie Silikon-Tuben) kommen nicht aufs Dokument
  const allePos = positionen(b, { stundenZusammen: zusammen });
  const pos = allePos.filter((p) => p.preis != null);
  // Summen je Block (Material / Arbeit) und Nachlass in % je Block
  const r2 = (n) => Math.round(n * 100) / 100;
  const nachlass = { material: zahl(b.nachlassMaterial) || 0, arbeit: zahl(b.nachlassArbeit) || 0 };
  const summe = {}, rabatt = {};
  for (const k of Object.keys(preise.ARTEN)) {
    summe[k] = r2(pos.filter((p) => p.art === k).reduce((a, p) => a + p.menge * p.preis, 0));
    rabatt[k] = r2((summe[k] * nachlass[k]) / 100);
  }
  const waren = r2(Object.values(summe).reduce((a, x) => a + x, 0));
  const rabatte = r2(Object.values(rabatt).reduce((a, x) => a + x, 0));
  const netto = r2(waren - rabatte);
  const steuer = r2((netto * satz) / 100);
  const nachlassZeile = (k) => (rabatt[k] ? `<tr class="dok-nachlass"><td></td><td colspan="5">abzgl. ${fmt(nachlass[k])} % Nachlass auf ${preise.ARTEN[k]}</td><td class="r">-${z2(rabatt[k])}</td><td></td></tr>` : "");
  const sk = schluesselVon(art);
  const nummer = b[`${sk}Nr`] || String(nr(sk));
  const dokDatum = b[`${sk}Datum`] || heute();
  const text = b[`${sk}Text`] ?? b.angebotText ?? "";
  const datumText = new Date(dokDatum + "T12:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const istAufstellung = art === "aufstellung";
  // Platzhalter in der Satz-Vorlage, für die auf der Baustelle noch nichts eingetragen ist
  const vorlageTxt = b.satzRechnung || f.satzVorlage || STANDARD_SATZ;
  const fehlt = [["baugenehmigung", "Baugenehmigung"], ["bauparzelle", "Bauparzelle"], ["kunde", "Kunde"]]
    .filter(([k]) => vorlageTxt.includes(`{${k}}`) && !b[k]).map(([, l]) => l);
  const ohnePreis = allePos.filter((p) => p.preis == null);
  // Eigene Rechnungsadresse nur, wenn sie wirklich abweicht (alte Einträge wiederholten oft nur die Adresse)
  const ra = (b.rechnungsadresse || "").trim();
  const eigeneAdresse = ra && ra !== standardEmpfaenger(b) && ra !== (b.adresse || "").trim();
  const empfaenger = (eigeneAdresse ? ra : standardEmpfaenger(b)).split("\n").map((z) => z.trim()).filter(Boolean);
  const firmaFehlt = !f.name;
  const kundeFehlt = !b.kunde && !(eigeneAdresse && ra.includes("\n"));

  const zeile = (p) => `<tr><td>${esc(p.code || "")}</td><td>${esc(p.text)}</td><td>${esc(p.me)}</td><td class="r">${z2(p.menge)}</td><td class="r">${z2(p.preis)}</td><td></td><td class="r">${z2(p.menge * p.preis)}</td><td class="r">${fmt(satz)}</td></tr>`;
  inhalt.innerHTML = `
    <div class="nicht-drucken dok-steuerung">
      <div class="filter">${Object.entries(ARTEN).map(([k, l]) => `<a class="chip ${k === art ? "aktiv" : ""}" href="#/dok/${id}/${k}">${l}</a>`).join("")}</div>
      ${firmaFehlt ? `<p class="warnbox">Deine Firmendaten fehlen noch (Name, Adresse, Steuernummer, Bank). <a class="link" href="#/einstellungen">Jetzt unter ⚙ Einstellungen eintragen</a></p>` : ""}
      ${kundeFehlt ? `<p class="warnbox">Beim Empfänger fehlt der Name des Kunden. <a class="link" href="#" id="kunde-fehlt">Jetzt eintragen</a></p>` : ""}
      ${ohnePreis.length ? `<p class="hinweisbox">Nicht aufgeführt, weil ohne Kundenpreis: ${ohnePreis.map((p) => esc(p.text)).join(", ")}. Falls das verrechnet werden soll, bitte den Kundenpreis nachtragen.</p>` : ""}
      <form class="karte form" id="dok-form">
        <div class="felder">
          <label class="feld halb"><span>${istAufstellung ? "Rechnungs-Nr. (wie in SuperBill)" : "Nummer"}</span><input name="nr" value="${esc(nummer)}"></label>
          <label class="feld halb"><span>${istAufstellung ? "Rechnungsdatum" : "Datum"}</span><input name="datum" type="date" value="${esc(dokDatum)}"></label>
          <label class="feld"><span>Einleitung (erste Zeile, z.B. „Liefern und verlegen der Wand- und Bodenfliesen für das Bad“)</span><input name="text" value="${esc(text)}"></label>
          <label class="feld halb"><span>MwSt.</span><select name="mwst">${mwstOptionen(b.mwst || "").map(([k, l]) => `<option value="${esc(k)}" ${k === (b.mwst || "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          <label class="feld halb"><span>Nachlass Material %</span><input name="nachlassMaterial" inputmode="decimal" value="${esc(b.nachlassMaterial || "")}" placeholder="0"></label>
          <label class="feld halb"><span>Nachlass Arbeit %</span><input name="nachlassArbeit" inputmode="decimal" value="${esc(b.nachlassArbeit || "")}" placeholder="0"></label>
          <label class="feld check halb"><input type="checkbox" name="zusammen" ${zusammen ? "checked" : ""}><span>Stunden zusammenfassen</span></label>
          <label class="feld check"><input type="checkbox" name="aufteilen" ${aufteilen ? "checked" : ""}><span>In Material und Arbeit aufteilen (mit Zwischensummen)</span></label>
        </div>
      </form>
      ${satz === 0 && !f.hinweis0 ? `<p class="warnbox">0 % MwSt.: Es ist noch kein Hinweistext hinterlegt (z.B. zur Umkehr der Steuerschuldnerschaft). <a class="link" href="#/einstellungen">In den Firmendaten eintragen</a></p>` : ""}
      ${art !== "angebot" ? `<div class="karte superbill">
        <b>Für SuperBill</b> <small class="leise">– Text und Beträge für die elektronische Rechnung</small>
        ${fehlt.length ? `<p class="warnbox klein">Für den Satz fehlt noch: ${fehlt.join(", ")}. <a class="link" href="#" id="sb-daten">Jetzt eintragen</a></p>` : ""}
        <div class="sb-zeile"><textarea class="sb-text" id="sb-satz" rows="3">${esc(satzFuerRechnung(f, b, nummer, datumText, text))}</textarea><button class="btn klein-btn" data-kopie="sb-satz">Kopieren</button></div>
        ${b.satzRechnung ? `<p class="leise klein">Eigener Satz für diese Baustelle. <a class="link" href="#" id="sb-vorlage">Wieder die Vorlage einsetzen</a></p>` : ""}
        <div class="sb-betraege">
          <span>Netto <b id="sb-netto">${z2(netto)}</b> <button class="btn klein-btn" data-kopie="sb-netto">Kopieren</button></span>
          <span>MwSt. ${fmt(satz)} % <b>${z2(steuer)}</b></span>
          <span>Gesamt <b>${z2(netto + steuer)}</b></span>
        </div>
        <small class="leise">Änderungen hier gelten nur für diese Baustelle. Die Vorlage für alle änderst du unter ⚙ Einstellungen → Firmendaten.</small>
      </div>` : ""}
      <div class="knopfreihe"><button class="btn primaer" id="drucken">🖨 Drucken / als PDF speichern</button>
        <button class="btn" id="kunde">✎ Kundendaten &amp; Baustelle</button></div>
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
        <div class="dok-titel">${ARTEN[art]}${istAufstellung ? `<small>Anlage zur Rechnung Nr. ${esc(nummer)} vom ${datumText}</small>` : ""}</div>
        <div class="zelle"><small>${istAufstellung ? "Rechnungsdatum" : "Datum"}</small><b>${datumText}</b></div>
        <div class="zelle"><small>${istAufstellung ? "Zu Rechnung Nr." : "Nummer"}</small><b>${esc(nummer)}</b></div>
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
          ${aufteilen ? Object.entries(preise.ARTEN).map(([k, titel]) => {
            const teil = pos.filter((p) => p.art === k);
            if (!teil.length) return "";
            return `<tr class="dok-block"><td></td><td colspan="7">${titel}</td></tr>
              ${teil.map(zeile).join("")}
              <tr class="dok-zwischen"><td></td><td colspan="5">Zwischensumme ${titel}</td><td class="r">${z2(summe[k])}</td><td></td></tr>
              ${rabatt[k] ? `${nachlassZeile(k)}<tr class="dok-zwischen"><td></td><td colspan="5">Summe ${titel}</td><td class="r">${z2(summe[k] - rabatt[k])}</td><td></td></tr>` : ""}`;
          }).join("") : pos.map(zeile).join("") + (rabatte ? `
            <tr class="dok-zwischen"><td></td><td colspan="5">Zwischensumme</td><td class="r">${z2(waren)}</td><td></td></tr>
            ${Object.keys(preise.ARTEN).map(nachlassZeile).join("")}
            <tr class="dok-zwischen"><td></td><td colspan="5">Summe nach Nachlass</td><td class="r">${z2(netto)}</td><td></td></tr>` : "")}
        </tbody>
      </table>

      <footer class="dok-fuss">
        ${istAufstellung ? "" : `<div class="dok-raster bank">
          <div class="zelle hoch"><small>Zahlungsart</small><b>${esc(f.zahlungsart || "Überweisung")}</b></div>
          <div class="zelle"><small>Referenzbank</small><b>${esc(f.bank || "")}&nbsp;</b></div>
          <div class="zelle"><small>Bankeinzug von</small><b>&nbsp;</b></div>
          <div class="zelle"><small>IBAN - SWIFT</small><b>${esc([f.iban, f.bic].filter(Boolean).join(" - "))}&nbsp;</b></div>
          <div class="zelle"><small>IBAN - SWIFT</small><b>&nbsp;</b></div>
        </div>`}
        <table class="dok-steuer ${istAufstellung ? "mit-rand" : ""}">
          <tr><th>USt.-Id. - Bezeichnung</th><th class="r">Nettobetrag</th><th class="r">Steuersatz</th><th class="r">MWSt.</th></tr>
          <tr><td>${fmt(satz)} - MwSt. ${fmt(satz)}%</td><td class="r">${z2(netto)}</td><td class="r">${z2(satz)}%</td><td class="r">${z2(steuer)}</td></tr>
        </table>
        <div class="dok-details">
          <div class="dok-details-titel">Betrag Details</div>
          <div class="dok-raster sechs">
            <div class="zelle"><small>Waren und Dienstleistungen</small><b class="r">${z2(waren)}</b></div>
            <div class="zelle"><small>Rabatte</small><b class="r">${rabatte ? "-" : ""}${z2(rabatte)}</b></div>
            <div class="zelle"><small>Anzahlungen</small><b class="r">0,00</b></div>
            <div class="zelle"><small>Steuer gesamt</small><b class="r">${z2(steuer)}</b></div>
            <div class="zelle"><small>Nettobetrag</small><b class="r">${z2(netto)}</b></div>
            <div class="zelle"><small>Gesamtbetrag des Dokuments</small><b class="r">${z2(netto + steuer)}</b></div>
          </div>
          <div class="dok-zahlen"><span>Zu zahlen gesamt</span><b>${z2(netto + steuer)}</b></div>
        </div>
        ${satz === 0 && f.hinweis0 ? `<p class="dok-fusstext dok-hinweis0">${esc(f.hinweis0)}</p>` : ""}
        ${f.fusstext ? `<p class="dok-fusstext">${esc(f.fusstext)}</p>` : ""}
      </footer>
    </article>`;

  const form = $("#dok-form");
  const feld = async (daten) => { await store.speichern({ ...store.get(id), ...daten }); ansicht(kopf, inhalt, id, art); };
  form.nr.onchange = () => feld({ [`${sk}Nr`]: form.nr.value.trim() });
  form.datum.onchange = () => feld({ [`${sk}Datum`]: form.datum.value });
  form.text.onchange = () => feld({ [`${sk}Text`]: form.text.value.trim() });
  form.mwst.onchange = () => feld({ mwst: form.mwst.value.trim() });
  form.nachlassMaterial.onchange = () => feld({ nachlassMaterial: form.nachlassMaterial.value.trim() });
  form.nachlassArbeit.onchange = () => feld({ nachlassArbeit: form.nachlassArbeit.value.trim() });
  form.aufteilen.onchange = async () => { await store.setMeta("aufteilen", form.aufteilen.checked); ansicht(kopf, inhalt, id, art); };
  form.zusammen.onchange = async () => { await store.setMeta("stundenZusammen", form.zusammen.checked); ansicht(kopf, inhalt, id, art); };
  form.onsubmit = (e) => e.preventDefault();
  inhalt.querySelectorAll("[data-kopie]").forEach((k) => (k.onclick = async () => {
    const el = $("#" + k.dataset.kopie);
    const t = el.value ?? el.textContent;
    try { await navigator.clipboard.writeText(t); k.textContent = "✓ Kopiert"; } catch { prompt("Zum Kopieren:", t); }
  }));
  $("#sb-satz")?.addEventListener("change", (e) => {
    // Nur speichern, wenn wirklich vom Vorlagen-Satz abweichend
    const v = e.target.value.trim();
    feld({ satzRechnung: v === satzFuerRechnung(f, store.get(id), nummer, datumText, text, true) ? "" : v });
  });
  $("#sb-vorlage")?.addEventListener("click", (e) => { e.preventDefault(); feld({ satzRechnung: "" }); });
  $("#sb-daten")?.addEventListener("click", (e) => { e.preventDefault(); $("#kunde").click(); });
  $("#kunde-fehlt")?.addEventListener("click", (e) => { e.preventDefault(); $("#kunde").click(); });
  $("#kunde").onclick = () => kundeBearbeiten(store.get(id)).then(() => ansicht(kopf, inhalt, id, art));
  $("#drucken").onclick = async () => {
    // Nummer und Datum beim ersten Drucken festhalten und den Zähler weiterzählen
    const akt = store.get(id);
    if (!akt[`${sk}Nr`]) {
      await store.speichern({ ...akt, [`${sk}Nr`]: nummer, [`${sk}Datum`]: dokDatum });
      const n = zahl(nummer);
      if (n != null && n >= nr(sk)) await firmaSpeichern({ [`nr_${sk}`]: String(n + 1) });
    }
    const alterTitel = document.title;
    document.title = `${ARTEN[art]} ${nummer} ${b.kunde || b.name}`.replace(/[\\/:*?"<>|]/g, "-");
    print();
    document.title = alterTitel;
  };
}

const standardEmpfaenger = (b) => [b.kunde, b.adresse].filter(Boolean).join("\n");

export async function kundeBearbeiten(b) {
  const erg = await formular({
    titel: "Kundendaten & Baustelle",
    werte: { ...b, rechnungsadresse: b.rechnungsadresse || "" },
    felder: [
      { n: "kunde", l: "Kunde (Name)", pflicht: true, liste: [...new Set(store.liste("baustelle").map((x) => x.kunde).filter(Boolean))] },
      { n: "adresse", l: "Adresse Baustelle / Kunde" },
      { n: "rechnungsadresse", l: "Andere Rechnungsadresse (nur falls abweichend – Name, Straße, PLZ Ort je eine Zeile)", typ: "textarea" },
      { n: "kundennr", l: "Kundennummer", halb: true },
      { n: "kundeUstId", l: "USt.-ID Kunde", halb: true },
      { n: "kundeSteuernr", l: "Steuernummer Kunde", halb: true },
      { n: "baugenehmigung", l: "Baugenehmigung (Nr. / Datum)", halb: true, platzhalter: "z.B. Nr. 45/2026 vom 12.03.2026" },
      { n: "bauparzelle", l: "Bauparzelle / K.G.", halb: true, platzhalter: "z.B. Bp. 123, K.G. Gais" },
    ],
  });
  if (!erg) return;
  // Eine Rechnungsadresse, die nur Kunde + Adresse wiederholt, nicht fest speichern
  if (erg.rechnungsadresse.trim() === standardEmpfaenger(erg)) erg.rechnungsadresse = "";
  await store.speichern({ ...store.get(b.id), ...erg });
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
        <label class="feld"><span>Hinweis bei 0 % MwSt. (erscheint dann auf Angebot, Rechnung und Aufstellung)</span><textarea name="hinweis0" rows="2" placeholder="z.B. Vermerk zur Umkehr der Steuerschuldnerschaft (Reverse Charge) – Wortlaut vom Steuerberater">${esc(f.hinweis0 || "")}</textarea></label>
        <label class="feld halb"><span>MwSt. % (Standard)</span><input name="mwst" inputmode="decimal" value="${esc(f.mwst ?? store.getMeta("mwst", "20"))}"></label>
        <label class="feld halb"><span>Nächste Angebots-Nr.</span><input name="nr_angebot" inputmode="numeric" value="${esc(String(nr("angebot")))}"></label>
        <label class="feld halb"><span>Nächste Rechnungs-Nr.</span><input name="nr_rechnung" inputmode="numeric" value="${esc(String(nr("rechnung")))}"></label>
        <label class="feld"><span>Satz für die Rechnung (SuperBill) – Platzhalter: {baugenehmigung} {bauparzelle} {zielort} {kunde} {baustelle} {nummer} {datum} {einleitung}</span><textarea name="satzVorlage" rows="3" placeholder="${esc(STANDARD_SATZ)}">${esc(f.satzVorlage || "")}</textarea></label>
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
