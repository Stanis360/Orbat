// Gemeinsame Hilfen für alle Ansichten
export const $ = (s, w = document) => w.querySelector(s);

// ---------- Hilfen ----------
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const zahl = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
export const fmt = (n, st = 2) => (n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: st });
export const euro = (n) => (n ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const heute = () => new Date().toLocaleDateString("sv-SE");
export const datum = (d) => (d ? new Date(d + "T12:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "");
export const nachDatum = (a, b) => (b.datum || "").localeCompare(a.datum || "") || b.updatedAt - a.updatedAt;

// ---------- Formular-Dialog ----------
export const dialog = $("#dialog");
// felder: [{ n, l, typ: text|zahl|date|time|tel|textarea|select|check, opt, liste, pflicht, halb, standard, platzhalter }]
// fuss: Info-Zeile unter den Feldern (wird von beiEingabe/beiStart über form.info gefüllt)
export function formular({ titel: t, felder, werte = {}, loeschbar = false, beiEingabe, beiStart, fuss = false, speichernText = "Speichern" }) {
  return new Promise((fertig) => {
    const listen = [];
    const html = felder.map((f) => {
      const v = werte[f.n] ?? f.standard ?? "";
      const pflicht = f.pflicht ? "required" : "";
      let eingabe;
      if (f.typ === "check") {
        return `<label class="feld check"><input type="checkbox" name="${f.n}" ${v ? "checked" : ""}><span>${esc(f.l)}</span></label>`;
      }
      if (f.typ === "textarea") eingabe = `<textarea name="${f.n}" rows="3">${esc(v)}</textarea>`;
      else if (f.typ === "select") {
        const opts = Array.isArray(f.opt) ? f.opt : Object.entries(f.opt);
        eingabe = `<select name="${f.n}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      }
      else {
        let liste = "";
        if (f.liste?.length) {
          const id = "dl-" + f.n;
          listen.push(`<datalist id="${id}">${f.liste.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`);
          liste = `list="${id}"`;
        }
        const typ = f.typ === "zahl" ? `type="text" inputmode="decimal"` : `type="${f.typ || "text"}"`;
        eingabe = `<input name="${f.n}" ${typ} value="${esc(v)}" ${pflicht} ${liste} placeholder="${esc(f.platzhalter || "")}" autocomplete="off">`;
      }
      return `<label class="feld ${f.halb ? "halb" : ""}"><span>${esc(f.l)}${f.pflicht ? " *" : ""}</span>${eingabe}</label>`;
    }).join("");
    dialog.innerHTML = `
      <form method="dialog" class="dlg">
        <h3>${esc(t)}</h3>
        <div class="felder">${html}</div>
        ${fuss ? `<p class="dlg-info" data-info></p>` : ""}
        ${listen.join("")}
        <div class="dlg-knoepfe">
          ${loeschbar ? `<button type="button" class="btn gefahr" data-loeschen>Löschen</button>` : ""}
          <span class="platz"></span>
          <button type="button" class="btn" data-abbrechen>Abbrechen</button>
          <button type="submit" class="btn primaer">${esc(speichernText)}</button>
        </div>
      </form>`;
    const form = $("form", dialog);
    let erledigt = false;
    const schliessen = (erg) => { if (erledigt) return; erledigt = true; dialog.close(); fertig(erg); };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const daten = {};
      for (const f of felder) daten[f.n] = f.typ === "check" ? (form.elements[f.n].checked ? "1" : "") : (form.elements[f.n].value || "").trim();
      schliessen(daten);
    });
    form.info = $("[data-info]", form);
    if (beiEingabe) {
      form.addEventListener("input", (e) => beiEingabe(form, e.target.name));
      form.addEventListener("change", (e) => { if (e.target.tagName === "SELECT" || e.target.type === "checkbox") beiEingabe(form, e.target.name); });
    }
    beiStart?.(form);
    $("[data-abbrechen]", form).onclick = () => schliessen(null);
    const weg = $("[data-loeschen]", form);
    if (weg) weg.onclick = () => { if (confirm("Wirklich löschen?")) schliessen({ __loeschen: true }); };
    dialog.onclose = () => schliessen(null);
    dialog.showModal();
    const erstes = form.querySelector("input, textarea, select");
    if (erstes && !matchMedia("(pointer: coarse)").matches) erstes.focus();
  });
}

export function herunterladen(name, inhalt, typ) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

