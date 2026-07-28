const width = 960;
const height = 520;

// SVG-Element erstellen und ins #map-div einhängen
const svg = d3.select("#map")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const projection = d3.geoNaturalEarth1();
const path = d3.geoPath(projection);

// Kartengeometrie und unsere Kriminalitätsdaten benennen Länder teils anders.
// Diese Tabelle übersetzt vom Kartennamen (links) zum Namen in oc_index.json (rechts).
const NAME_ALIASES = {
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Central African Rep.": "Central African Republic",
  "Congo": "Congo, Rep.",
  "Czechia": "Czech Republic",
  "Dem. Rep. Congo": "Congo, Dem. Rep.",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "eSwatini": "Eswatini",
  "North Korea": "Korea, DPR",
  "South Korea": "Korea, Rep.",
  "Macedonia": "North Macedonia",
  "Solomon Is.": "Solomon Islands",
  "S. Sudan": "South Sudan",
  "United States of America": "United States",
};

// Farbskala: hell = niedriger Wert, dunkel/rot = hoher Wert.
// Schwellenwerte sind an der echten Verteilung beider Kennzahlen (2021-2025) ausgerichtet
// (Median ~5, 85. Perzentil ~7, Maximum ~9.5) – nicht an einer angenommenen 0-10-Spannbreite.
// So bleibt die Skala zwischen "Cocaine trade" und "Criminality avg." vergleichbar, UND
// beide Metriken nutzen den Farbraum tatsächlich aus (Criminality avg. erreicht sonst nie Rot).
// Start bewusst nicht bei Weiss/Hellgrau, damit "niedrig" nicht mit "keine Daten" verwechselt wird.
const colorScale = d3.scaleLinear()
  .domain([0, 5, 7, 9.5])
  .range(["#cfcfcf", "#8a8a8a", "#2b2b2b", "#b0231c"])
  .clamp(true);

// "Keine Daten" bekommt eine Schraffur statt einer Fläche – strukturell von
// jeder Farbskala unterscheidbar, statt sich auf einen ähnlichen Grauton zu verlassen.
function addNoDataPattern(svg) {
  svg.append("defs")
    .append("pattern")
      .attr("id", "hatch-nodata")
      .attr("width", 6)
      .attr("height", 6)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)")
    .call(pattern => {
      pattern.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#f7f7f5");
      pattern.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6)
        .attr("stroke", "#c7c7c2").attr("stroke-width", 2);
    });
}

const METRIC_LABELS = {
  cocaine: "Cocaine-trade-Score",
  criminality: "Criminality avg.",
};

// state.metric steuert, welche Spalte aus oc_index.json angezeigt wird.
// state.year kommt in Schritt 5 dazu (Zeitverlauf).
const state = {
  metric: "cocaine",
  year: "2025",
};

function valueFor(ocData, mapName) {
  const dataName = NAME_ALIASES[mapName] || mapName;
  const entry = ocData[dataName];
  return entry ? entry[state.metric][state.year] : null;
}

// BFS-Kantonsnummern (1-26) -> Name. Die swiss-maps-Geometrien liefern nur
// numerische IDs, keine Namen als Property, darum die Zuordnung von Hand.
const CANTON_NAMES = {
  1: "Zürich", 2: "Bern", 3: "Luzern", 4: "Uri", 5: "Schwyz", 6: "Obwalden",
  7: "Nidwalden", 8: "Glarus", 9: "Zug", 10: "Freiburg", 11: "Solothurn",
  12: "Basel-Stadt", 13: "Basel-Landschaft", 14: "Schaffhausen",
  15: "Appenzell Ausserrhoden", 16: "Appenzell Innerrhoden", 17: "St. Gallen",
  18: "Graubünden", 19: "Aargau", 20: "Thurgau", 21: "Tessin", 22: "Waadt",
  23: "Wallis", 24: "Neuenburg", 25: "Genf", 26: "Jura",
};
const ZURICH_CANTON_ID = 1;

// Inhalte der drei Fall-Steckbriefe, verdichtet aus den Anklageschriften.
// Personen sind mit den vereinbarten Platzhaltern (Person A-X) anonymisiert.
const CASE_DETAILS = {
  a: {
    fileNumbers: "B-4/2021/10026692 & B-4/2021/10011441",
    title: "Der Bunker- und Waffen-Fall",
    lede: "Person A und Person B bestellten telefonisch Kokain zu Kilopreisen von CHF 40'000–43'000 und lagerten die Ware zusammen mit einem privaten Waffenarsenal in zwei Bunkern in Zürich.",
    accused: [
      ["Person A", "Organisator, Geldkurier"],
      ["Person B", "Grossverteiler, portionierte die Ware"],
    ],
    facts: [
      "Kuriere aus Deutschland/Österreich, Bunker an der Bodenacherstrasse (Benglen) und im Lagerraum U267, Bleicherweg 19",
      "Am 12.4.2022 beschlagnahmt: 6.45 kg Kokain, 8.16 kg Haschisch, Amphetamine, Marihuana, 3899 Ecstasy-Tabletten",
      "Waffenarsenal: Uzi, mehrere AK47, ein Sturmgewehr 90, Pumpguns, Handfeuerwaffen, Schalldämpfer, Tausende Schuss Munition",
      "Geldwäsche: Bargeld in Apérostängel-Schachteln sowie am Körper vakuumiert, per Nachtzug nach München/Mailand zu den Lieferanten",
    ],
  },
  b: {
    fileNumbers: "C-4/2021/10012936",
    title: "Der SkyECC- und Covid-Betrug-Fall",
    lede: "Person I koordinierte über den verschlüsselten Messenger SkyECC grosse Kokain- und Marihuana-Lieferungen – und erschlich sich parallel dazu Covid-19-Nothilfe für zwei eigene Firmen.",
    accused: [
      ["Person I", "Grosshändler, Inhaber «Kebab World» & «King City GmbH»"],
      ["Person J / Person K", "Komplizen"],
    ],
    facts: [
      "2 kg Kokain in mehreren Tranchen nach Österreich (an Person L) geliefert",
      "Via SkyECC 5 kg, dann 21 kg Kokain aus Deutschland bestellt (EUR 32'750/kg), Schmuggel in Fahrzeugen mit Geheimversteck (u.a. VW Caddy)",
      "95,3 kg Marihuana am 12.4.2021 an Person O in Otelfingen geliefert, versteckt zwischen Pflanzen in einem Rollwagen",
      "CHF 75'000 Covid-19-Kredit mit gefälschten Umsatzzahlen erschlichen – ausgegeben für Fremdwährungen und Shopping bei Louis Vuitton, Burberry und einer Bike Factory",
    ],
  },
  c: {
    fileNumbers: "B-5/2022/10045782",
    title: "Der Bodypacking-Fall",
    lede: "Person Q, Person P und Person R liessen knapp 15 kg Kokain aus der Dominikanischen Republik und Brasilien einfliegen – geschmuggelt im Körper der Kuriere.",
    accused: [
      ["Person Q", "organisierte und finanzierte die Einkäufe"],
      ["Person P", "holte die Kuriere ab, brachte sie in Hotels"],
      ["Person R", "bunkerte, streckte und portionierte die Ware"],
    ],
    facts: [
      "Lieferant Person S in der Dominikanischen Republik; Flugkuriere Person T, U und X schluckten bis zu 137 Fingerlinge",
      "Übergabe u.a. im Ibis Budget beim Technopark und im Hotel Olympia",
      "Verkauf nach Farbcode analog Schweizer Banknoten («Metall» 5g, «Gelb» 10g, «Blau» 100g); Grossabnehmer Person W in Rorschacherberg/Staad",
      "Geldwäsche per «Smurfing»: 134 Einzelüberweisungen über CHF 77'668 via MoneyGram, Western Union und Small World an Person S",
      "Zusätzlich angeklagt: Person P wegen Besitzes einer verbotenen Gewaltdarstellung (Foto eines zerstückelten Menschen)",
    ],
  },
  case4: {
    fileNumbers: null,
    title: "Das «Grüne Grenze»-Taxi-Netzwerk",
    lede: "Ein ausländischer Drahtzieher organisierte mit drei Komplizen den Schmuggel von über 50 kg Kokain aus Holland – über die unbewachte grüne Grenze bei Basel und mit einem Schweizer Taxi als Zubringer.",
    accused: [
      ["Person A", "Drahtzieher"],
      ["Person B, C, D", "Komplizen — C fuhr das Übergabe-Taxi"],
    ],
    facts: [
      "Schätzungsweise über 50 kg Kokain aus Holland, Transport in holländischen Mietwagen über die grüne Grenze bei Basel",
      "Direkt nach der Grenze Umstieg in ein bereitstehendes Schweizer Taxi Richtung Drogenbunker in Dietikon und Oberengstringen",
      "Ein Taxi im Landesinneren fiel in den frühen Morgenstunden weniger auf als ein Fahrzeug mit ausländischem Kennzeichen",
      "Bei der Verhaftung floh Person A trotz zerschossenem Reifen mit knapp 180 km/h durch den Bözbergtunnel",
    ],
  },
  case5: {
    fileNumbers: null,
    title: "Das Balkan-Kartell und die Friedhofs-Deals",
    lede: "Angeführt von einem Anführer und einem internationalen Kurier importierte dieses Netzwerk Dutzende Kilo Kokain, Marihuana und Haschisch aus den Niederlanden und Spanien.",
    accused: [
      ["Person E", "Anführer"],
      ["Person F", "internationaler Kurier"],
    ],
    facts: [
      "Dutzende Kilo Kokain, Marihuana und Haschisch aus Niederlande und Spanien importiert",
      "Kurier F erhielt für Kokain-Transporte nach Zürich teils CHF 2'000 Lohn pro geschmuggeltem Kilo",
      "Übergaben an zahlreiche lokale Abnehmer häufig beim Friedhof Schwandenholz in Zürich-Seebach",
      "Gescheiterter Versuch eines Direktimports aus Bolivien via Brasilien für 7'500 US-Dollar pro Kilo",
    ],
  },
  case6: {
    fileNumbers: null,
    title: "Der Aufpasser und das Autobatterie-Versteck",
    lede: "Ein internationaler Kurier wurde von holländischen Lieferanten als «Aufpasser» zu einem verschuldeten Abnehmer in Glattbrugg geschickt – und schmuggelte selbst Kokain im Auto.",
    accused: [
      ["Person G", "Kurier / Aufpasser"],
    ],
    facts: [
      "Von holländischen Kokainlieferanten in die Schweiz geschickt, um als «Aufpasser» bei einem Abnehmer in Glattbrugg einzuziehen",
      "Der Abnehmer hatte 70'000 Euro Schulden bei den Lieferanten — Person G sollte den Rückfluss des Geldes überwachen",
      "Bei der Verhaftung 2,14 kg Kokain gefunden, versteckt in einer präparierten Zusatzbatterie im Kofferraum eines VW Touareg",
    ],
  },
  case7: {
    fileNumbers: null,
    title: "Der Club-Dealer und die «Naturalien»",
    lede: "Ein in der Zürcher Clubszene verankerter Dealer kaufte über 1,3 kg hochreines Kokain und liess sich teils in Naturalien statt Bargeld bezahlen.",
    accused: [
      ["Person H", "Dealer"],
    ],
    facts: [
      "Kauf von über 1,3 kg hochreinem Kokain",
      "Bezahlung teils in «Naturalien»: unentgeltliche Prostituierte, Gratis-Kokain auf Partys",
      "Import von illegalem Testosteron aus Mazedonien für die Kraftsportszene",
      "Handel mit gefälschten Luxusuhren der Marken Rolex und Audemars Piguet",
    ],
  },
  case8: {
    fileNumbers: null,
    title: "Der jugendliche Telegram-Auftragnehmer",
    lede: "Ein Täter, Jahrgang 2004, nahm über die App Telegram Befehle von einer unbekannten Person unter dem Pseudonym «Jack Jackson» entgegen.",
    accused: [
      ["Person I", "Auftragnehmer, Jahrgang 2004"],
    ],
    facts: [
      "Aufträge über Telegram von einer unbekannten Person unter dem Pseudonym «Jack Jackson»",
      "Nahm Kiloblöcke Kokain zu Hause entgegen, streckte sie mit Schminke und packte sie für den Weiterverkauf neu ab",
      "Lohn: nur CHF 200–500 pro Auftrag — bei Drogenwerten von zehntausenden Franken",
    ],
  },
  case9: {
    fileNumbers: null,
    title: "Der Imbissstand-Dealer",
    lede: "Ein Täter nutzte seinen eigenen Imbissstand in Affoltern am Albis als Drogenumschlagplatz — mit auffällig hohem Eigenkonsum.",
    accused: [
      ["Person J", "Imbissstand-Betreiber"],
    ],
    facts: [
      "Kauf von insgesamt rund 167 g Kokain über mehrere Monate, Umschlag am eigenen Imbissstand in Affoltern am Albis",
      "Rund 70 g an Dritte weiterverkauft, um sich zu finanzieren",
      "Fast 100 g davon am Arbeitsplatz selbst konsumiert",
    ],
  },
  case10: {
    fileNumbers: null,
    title: "Der Detailverkäufer aus dem Keller",
    lede: "Ein Kleindealer verkaufte winzige 0,7-Gramm-Portionen an eine Vielzahl von Einzelabnehmern und wurde bei einer Verkehrskontrolle überführt.",
    accused: [
      ["Person K", "Kleindealer"],
    ],
    facts: [
      "Verkauf von 0,7-Gramm-Portionen für CHF 80–100 an eine Vielzahl von Einzelabnehmern",
      "Vorrat von über 300 g in Vakuumbeuteln im Keller des Wohnorts in Eglisau sowie im eigenen BMW X5",
      "Bei einer Verkehrskontrolle auf frischer Tat von der Polizei überführt",
    ],
  },
  case11: {
    fileNumbers: null,
    title: "Der günstige Strassenverkäufer und Raser",
    lede: "Aus finanzieller Not stieg dieser Verkäufer auf Provisionsbasis in den Kokainhandel ein und bot zu ungewöhnlich tiefen Preisen an.",
    accused: [
      ["Person L", "Strassenverkäufer"],
    ],
    facts: [
      "Einstieg aus finanzieller Notlage, Verkauf auf Provisionsbasis für einen Hintermann (20 % des Erlöses)",
      "Rund 1,46 kg Kokain zu einem im kantonalen Vergleich extrem tiefen Preis von durchschnittlich CHF 35 pro Gramm umgesetzt",
      "Kurz vor der Verhaftung mit 124 km/h in einer 80er-Zone auf der Autobahn geblitzt",
    ],
  },
  case12: {
    fileNumbers: null,
    title: "Der gestrandete Tram-Kurier",
    lede: "Ein Tourist ohne festen Wohnsitz in der Schweiz wurde bei einer einfachen Personenkontrolle an einer Zürcher Tramhaltestelle mit Kokain und Heroin erwischt.",
    accused: [
      ["Person M", "Kurier, ohne festen Wohnsitz in der Schweiz"],
    ],
    facts: [
      "Personenkontrolle an einer Tramhaltestelle im Zentrum von Zürich",
      "53,4 g Kokain und 31,7 g Heroin gefunden",
      "Auftrag: Auslieferung gegen ein Fixentgelt von CHF 2'000 an eine unbekannte Person — strandete jedoch an der Haltestelle",
    ],
  },
};

Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
  d3.json("../data/oc_index.json"),
  d3.json("https://cdn.jsdelivr.net/npm/swiss-maps@4.7.0/2026/ch-combined.json"),
]).then(([world, ocData, chTopo]) => {

  const countries = topojson.feature(world, world.objects.countries).features;
  projection.fitSize([width, height], { type: "Sphere" });
  addNoDataPattern(svg);

  // Alle Länder-Pfade in eine eigene Gruppe, damit wir für den Zoom nur einen
  // CSS-Transform auf die Gruppe legen müssen, statt jeden Pfad neu zu berechnen.
  const mapLayer = svg.append("g").attr("class", "map-layer");

  const countryPaths = mapLayer.selectAll("path.country")
    .data(countries)
    .join("path")
      .attr("class", "country")
      .attr("d", path);

  countryPaths.append("title");

  // Angeklicktes Land: Name + Wert im Info-Feld anzeigen und die Fläche hervorheben.
  let selected = null;

  function updateReadout() {
    const readout = d3.select("#country-readout");
    if (!selected) {
      readout.text("Klicke auf ein Land für Details.");
      return;
    }
    const value = valueFor(ocData, selected.properties.name);
    readout.html(
      `<strong>${selected.properties.name}</strong> — ${METRIC_LABELS[state.metric]}: ` +
      (value == null ? "keine Daten" : `${value} / 9.5`)
    );
  }

  countryPaths.on("click", function (event, d) {
    selected = selected === d ? null : d; // nochmal klicken hebt die Auswahl auf
    countryPaths.classed("selected", p => p === selected);
    updateReadout();
  });

  function render() {
    countryPaths
      .attr("fill", d => {
        const value = valueFor(ocData, d.properties.name);
        return value == null ? "url(#hatch-nodata)" : colorScale(value);
      });

    countryPaths.select("title")
      .text(d => {
        const value = valueFor(ocData, d.properties.name);
        return `${d.properties.name}: ${value == null ? "keine Daten" : value}`;
      });

    d3.select("#subtitle")
      .text(`${METRIC_LABELS[state.metric]} pro Land, ${state.year} (0–10)`);

    d3.selectAll(".metric-btn")
      .classed("active", function () { return this.dataset.metric === state.metric; });

    updateReadout();

    const unmatched = countries.filter(d => valueFor(ocData, d.properties.name) == null);
    console.log(`${countries.length} Länder gezeichnet, ${unmatched.length} ohne Daten (${state.metric}, ${state.year})`);
  }

  d3.selectAll(".metric-btn").on("click", function () {
    state.metric = this.dataset.metric;
    render();
  });

  render();

  // --- Einmalige Zoom-Animation auf die Schweiz beim Scrollen ---

  const switzerland = countries.find(d => d.properties.name === "Switzerland");
  const [[x0, y0], [x1, y1]] = path.bounds(switzerland);
  const bboxWidth = x1 - x0;
  const bboxHeight = y1 - y0;
  const bboxCenterX = (x0 + x1) / 2;
  const bboxCenterY = (y0 + y1) / 2;

  const padding = 80; // Pixel Rand um die Schweiz herum im gezoomten Zustand
  const zoomScale = Math.min(
    (width - padding * 2) / bboxWidth,
    (height - padding * 2) / bboxHeight
  );
  const zoomTranslateX = width / 2 - zoomScale * bboxCenterX;
  const zoomTranslateY = height / 2 - zoomScale * bboxCenterY;

  // --- Zoom-Ziele für Zwischenstationen aus den Umrissen mehrerer Länder ---
  // (keine Einzelländer wie bei der Schweiz, darum die Bounds von Hand über
  // alle passenden Länder-Features hinweg zusammenführen.)
  function combinedBounds(names) {
    const feats = countries.filter(d => names.includes(d.properties.name));
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    feats.forEach(feature => {
      const [[a, b], [c, d]] = path.bounds(feature);
      bx0 = Math.min(bx0, a);
      by0 = Math.min(by0, b);
      bx1 = Math.max(bx1, c);
      by1 = Math.max(by1, d);
    });
    return { x0: bx0, y0: by0, x1: bx1, y1: by1, cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2 };
  }

  function zoomTarget(bounds, padding) {
    const bboxWidth = bounds.x1 - bounds.x0;
    const bboxHeight = bounds.y1 - bounds.y0;
    const scale = Math.min(
      (width - padding * 2) / bboxWidth,
      (height - padding * 2) / bboxHeight
    );
    return {
      scale,
      translateX: width / 2 - scale * bounds.cx,
      translateY: height / 2 - scale * bounds.cy,
    };
  }

  const EUROPE_COUNTRIES = [
    "Portugal", "Spain", "France", "Netherlands", "Belgium", "Germany",
    "Switzerland", "Italy", "Austria", "Poland", "Czechia", "Denmark",
    "United Kingdom", "Ireland",
  ];
  const europeBounds = combinedBounds(EUROPE_COUNTRIES);
  const europeZoom = zoomTarget(europeBounds, 60);
  const europeScale = europeZoom.scale;
  const europeTranslateX = europeZoom.translateX;
  const europeTranslateY = europeZoom.translateY;

  // --- Zwischenstation Route: Südamerika (Lieferländer) -> Europa (Einfallstore) ---
  const SOUTH_AMERICA_SUPPLIERS = ["Colombia", "Peru", "Bolivia", "Ecuador", "Venezuela"];
  const ENTRY_PORT_COUNTRIES = ["Netherlands", "Belgium"];
  const supplierBounds = combinedBounds(SOUTH_AMERICA_SUPPLIERS);
  const portBounds = combinedBounds(ENTRY_PORT_COUNTRIES);
  const routeBounds = {
    x0: Math.min(supplierBounds.x0, portBounds.x0),
    y0: Math.min(supplierBounds.y0, portBounds.y0),
    x1: Math.max(supplierBounds.x1, portBounds.x1),
    y1: Math.max(supplierBounds.y1, portBounds.y1),
  };
  routeBounds.cx = (routeBounds.x0 + routeBounds.x1) / 2;
  routeBounds.cy = (routeBounds.y0 + routeBounds.y1) / 2;
  const routeZoom = zoomTarget(routeBounds, 90);
  const routeScale = routeZoom.scale;
  const routeTranslateX = routeZoom.translateX;
  const routeTranslateY = routeZoom.translateY;

  // Pfeil (Kurve) von den Lieferländern zu den Einfallstoren, plus ein
  // schematisches Frachtschiff auf halbem Weg. Liegt in .map-layer, zoomt und
  // verschiebt sich darum automatisch zusammen mit der Karte.
  const routeLayer = mapLayer.append("g").attr("class", "route-arrow");
  const arrowStartX = supplierBounds.cx, arrowStartY = supplierBounds.cy;
  const arrowEndX = portBounds.cx, arrowEndY = portBounds.cy;
  const arrowCtrlX = (arrowStartX + arrowEndX) / 2;
  const arrowCtrlY = Math.min(arrowStartY, arrowEndY) - 50; // Bogen nach oben, wie eine Schiffsroute

  routeLayer.append("path")
    .attr("id", "route-arrow-path")
    .attr("class", "route-arrow-line")
    .attr("d", `M ${arrowStartX},${arrowStartY} Q ${arrowCtrlX},${arrowCtrlY} ${arrowEndX},${arrowEndY}`);

  const arrowAngleDeg = Math.atan2(arrowEndY - arrowCtrlY, arrowEndX - arrowCtrlX) * 180 / Math.PI;
  routeLayer.append("polygon")
    .attr("class", "route-arrow-head")
    .attr("points", "0,-7 16,0 0,7")
    .attr("transform", `translate(${arrowEndX},${arrowEndY}) rotate(${arrowAngleDeg})`);

  // Schiff fährt entlang der Pfeil-Kurve, per natives SVG-<animateMotion> statt
  // JS-rAF-Loop: läuft unabhängig vom Hauptthread/Tab-Sichtbarkeit weiter.
  const ship = routeLayer.append("g").attr("class", "route-ship");
  // Sehr einfaches Frachtschiff-Symbol aus Grundformen (Rumpf + Aufbau), bei 0,0
  // gezeichnet - animateMotion übernimmt Position und Ausrichtung (rotate: auto).
  ship.append("polygon").attr("class", "ship-hull").attr("points", "-14,-3 14,-3 10,7 -10,7");
  ship.append("rect").attr("class", "ship-deck").attr("x", -5).attr("y", -9).attr("width", 10).attr("height", 7);
  ship.append("animateMotion")
    .attr("dur", "7s")
    .attr("repeatCount", "indefinite")
    .attr("rotate", "auto")
    .append("mpath")
    .attr("href", "#route-arrow-path");

  // Fakten-Labels direkt auf der Karte statt in einem deckenden Text-Panel -
  // so bleiben Karte und fahrendes Schiff durchgehend sichtbar. Blenden erst
  // ein, nachdem Pfeil/Schiff schon eine Weile allein zu sehen waren (siehe
  // updateScrolly/labelDelay weiter unten).
  const routeLabels = routeLayer.append("g").attr("class", "route-labels");

  function addRouteLabel(x, y, title, lines) {
    const g = routeLabels.append("g").attr("class", "route-label");
    const padX = 7, padY = 5, lineHeight = 9;
    g.append("text")
      .attr("class", "route-label-title")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .text(title);
    lines.forEach((line, i) => {
      g.append("text")
        .attr("class", "route-label-text")
        .attr("x", 0)
        .attr("y", lineHeight * (i + 1))
        .attr("text-anchor", "middle")
        .text(line);
    });
    const bbox = g.node().getBBox();
    g.insert("rect", ":first-child")
      .attr("class", "route-label-bg")
      .attr("x", bbox.x - padX)
      .attr("y", bbox.y - padY)
      .attr("width", bbox.width + padX * 2)
      .attr("height", bbox.height + padY * 2)
      .attr("rx", 4);
    g.attr("transform", `translate(${x},${y})`);
    return g;
  }

  addRouteLabel(
    arrowStartX, arrowStartY + 34,
    "Hauptlieferanten von Kokain",
    ["Kolumbien, Peru, Bolivien,", "Ecuador, Venezuela"]
  );
  addRouteLabel(
    arrowEndX, arrowEndY - 34,
    "Haupt-Einfallstore in Europa",
    ["Antwerpen, Rotterdam,", "Amsterdam"]
  );

  // --- Feine Kantonskarte (swiss-maps) als zweite Ebene, vorbereitet aber unsichtbar ---
  // world-atlas hat für ein Land wie die Schweiz nur ein grobes Polygon (paar Dutzend
  // Punkte). swiss-maps liefert die echten Kantonsgrenzen. Wir zeichnen sie in einer
  // eigenen Gruppe mit eigener, auf die Schweiz zugeschnittenen Projektion.
  const cantons = topojson.feature(chTopo, chTopo.objects.cantons).features;
  const chProjection = d3.geoMercator();
  const chPath = d3.geoPath(chProjection);
  chProjection.fitExtent([[50, 50], [width - 50, height - 50]], {
    type: "FeatureCollection",
    features: cantons,
  });

  const chLayer = svg.append("g").attr("class", "ch-layer");

  chLayer.selectAll("path.canton")
    .data(cantons)
    .join("path")
      .attr("class", "canton")
      .attr("d", chPath)
      .attr("fill", "#d8d8d3")
    .append("title")
      .text(d => CANTON_NAMES[d.id] || `Kanton ${d.id}`);

  // --- Die 12 Fälle als Marker auf der Kantonskarte ---
  // Drei sind vertieft recherchiert (Steckbrief-Popup mit echten Fakten und
  // eigenem Fliesstext-Artikel), die übrigen neun sind ebenfalls mit echten
  // Fakten hinterlegt, aber bewusst grau und kleiner gehalten – untergeordnet,
  // nicht unwichtig. Alle 12 Verfahren stammen von der Zürcher Staatsanwaltschaft,
  // daher blitzt bei allen derselbe Kanton auf.
  const FEATURED_CASES = [
    { id: "a", short: "Fall 1", label: "Bunker-Kartell", cantonId: ZURICH_CANTON_ID, featured: true },
    { id: "b", short: "Fall 2", label: "Krypto-Händler", cantonId: ZURICH_CANTON_ID, featured: true },
    { id: "c", short: "Fall 3", label: "Bodypacking", cantonId: ZURICH_CANTON_ID, featured: true },
  ];

  const OTHER_CASES = d3.range(4, 13).map(n => ({
    id: `case${n}`,
    short: String(n),
    cantonId: ZURICH_CANTON_ID,
    featured: false,
  }));

  const CASES = [...FEATURED_CASES, ...OTHER_CASES];

  const zurichFeature = cantons.find(c => c.id === ZURICH_CANTON_ID);
  const [zx, zy] = chPath.centroid(zurichFeature);

  // Alle 12 Positionen sind so gewählt, dass sie innerhalb der tatsächlichen
  // Kartenfläche liegen (Kantone spannen x:152–807, y:50–470 im SVG). Die drei
  // recherchierten Fälle bilden eine Reihe nahe Zürich, gleichrangig zueinander
  // (keine Hierarchie); die übrigen neun verteilen sich über die ganze Fläche.
  const MARKER_OFFSETS = [
    [-82, -10],
    [0, -10],
    [82, -10],
    [-292, 25],
    [-242, 145],
    [-302, 245],
    [-122, 225],
    [8, 165],
    [138, 65],
    [178, 185],
    [58, 265],
    [-62, 85],
  ];

  const markerGroup = svg.append("g").attr("class", "case-markers");

  function flashCanton(cantonId) {
    const cantonPath = chLayer.selectAll("path.canton").filter(d => d.id === cantonId);
    cantonPath.classed("flash", false);
    cantonPath.node().getBoundingClientRect(); // Reflow erzwingen, damit die Animation neu startet
    cantonPath.classed("flash", true);
  }

  // --- Steckbrief-Popup pro Fall ---
  const popupBackdrop = d3.select("#case-popup-backdrop");

  function openCasePopup(caseData) {
    const detail = CASE_DETAILS[caseData.id];

    if (detail) {
      d3.select("#case-popup-filenum")
        .text(detail.fileNumbers ? `Az. ${detail.fileNumbers}` : "Eine von 12 ausgewerteten Anklageschriften")
        .style("display", null);
      d3.select("#case-popup-title").text(detail.title);
      d3.select("#case-popup-lede").text(detail.lede);
      d3.select("#case-popup-accused").selectAll("li")
        .data(detail.accused)
        .join("li")
          .html(([name, role]) => `<b>${name}</b> — ${role}`);
      d3.select("#case-popup-facts").selectAll("li")
        .data(detail.facts)
        .join("li")
          .text(fact => fact);
      d3.selectAll(".case-popup-section-label").style("display", null);
    } else {
      // Fallback, falls doch mal ein Fall ohne hinterlegte Daten angeklickt wird:
      // keine erfundenen Fakten, nur ein ehrlicher Platzhalter.
      d3.select("#case-popup-filenum").text("Eine von 12 ausgewerteten Anklageschriften");
      d3.select("#case-popup-title").text(`Fall ${caseData.short} von 12`);
      d3.select("#case-popup-lede").text("Dieser Fall ist Teil der ausgewerteten 12 Anklageschriften. Weitere Details folgen.");
      d3.select("#case-popup-accused").selectAll("li").data([]).join("li");
      d3.select("#case-popup-facts").selectAll("li").data([]).join("li");
      d3.selectAll(".case-popup-section-label").style("display", "none");
    }

    popupBackdrop.classed("open", true);
  }

  function closeCasePopup() {
    popupBackdrop.classed("open", false);
  }

  d3.select("#case-popup-close").on("click", closeCasePopup);
  popupBackdrop.on("click", (event) => {
    if (event.target.id === "case-popup-backdrop") closeCasePopup();
  });
  d3.select(document).on("keydown", (event) => {
    if (event.key === "Escape") closeCasePopup();
  });

  const markers = markerGroup.selectAll("g.case-marker")
    .data(CASES)
    .join("g")
      .attr("class", d => `case-marker${d.featured ? "" : " minor"}`)
      .attr("transform", (d, i) => {
        const [ox, oy] = MARKER_OFFSETS[i];
        return `translate(${zx + ox}, ${zy + oy})`;
      })
      .on("click", (event, d) => {
        flashCanton(d.cantonId);
        openCasePopup(d);
      });

  // Sehr reduzierte Kopf/Schulter-Andeutung statt eines echten Gesichts – bewusst
  // schematisch, angelehnt an den Steckbrief-Stil aus der Referenz. Alle 12 Marker
  // sind gleich gross – nur der Grauton unterscheidet die neun Nebenfälle.
  const MARKER_RADIUS = 19;
  markers.append("circle").attr("class", "marker-ring").attr("r", MARKER_RADIUS);
  markers.append("circle").attr("class", "marker-head").attr("cy", -4).attr("r", 6);
  markers.append("path").attr("class", "marker-face")
    .attr("d", "M -9,10 C -9,0 9,0 9,10");

  markers.filter(d => d.featured).append("text").attr("y", 33).text(d => d.short);
  markers.filter(d => d.featured).append("text").attr("class", "marker-label").attr("y", 45).text(d => d.label);
  markers.filter(d => !d.featured).append("text").attr("class", "marker-number").attr("y", 33).text(d => d.short);

  // Zoom in drei Stufen: Welt -> Route (Südamerika/Europa-Übersicht) -> Europa
  // (Super-Cartel-Etappe) -> Schweiz (grobe Form), dann Crossfade zur feinen
  // Kantonskarte. Der eigentliche Bug vorher war nicht die Animation, sondern
  // dass die Karte beim Scrollen aus dem Bild lief (durch position:sticky auf
  // #map behoben) - und später, dass zwei getrennte Zeitmesser (Trigger-Sichtbarkeit
  // vs. Scroll-Fortschritt) auseinanderliefen. Darum jetzt: ein einziger
  // overallProgress-Wert treibt sowohl Kartenzoom als auch Text-Einblendung.
  const ZOOM_DURATION = 1800; // ms, muss zur Transition-Dauer von .map-layer in style.css passen
  let showingRoute = false;
  let showingEurope = false;
  let showingSwitzerland = false;
  let crossfadeTimer = null;

  // Rangfolge Schweiz > Europa > Route > Welt: setzt das Karten-Transform passend
  // zum "höchsten" Stadium, in dem wir uns gerade befinden.
  function applyBackgroundZoom() {
    if (showingSwitzerland) {
      mapLayer.style("transform", `translate(${zoomTranslateX}px, ${zoomTranslateY}px) scale(${zoomScale})`);
    } else if (showingEurope) {
      mapLayer.style("transform", `translate(${europeTranslateX}px, ${europeTranslateY}px) scale(${europeScale})`);
    } else if (showingRoute) {
      mapLayer.style("transform", `translate(${routeTranslateX}px, ${routeTranslateY}px) scale(${routeScale})`);
    } else {
      mapLayer.style("transform", null);
    }
  }

  function enterRoute() {
    if (showingRoute) return;
    showingRoute = true;
    applyBackgroundZoom();
  }

  function exitRoute() {
    if (!showingRoute) return;
    showingRoute = false;
    applyBackgroundZoom();
  }

  function enterEurope() {
    if (showingEurope) return;
    showingEurope = true;
    applyBackgroundZoom();
  }

  function exitEurope() {
    if (!showingEurope) return;
    showingEurope = false;
    applyBackgroundZoom();
  }

  function enterSwitzerland() {
    if (showingSwitzerland) return;
    showingSwitzerland = true;
    applyBackgroundZoom();
    d3.select("body").classed("showing-switzerland", true);

    clearTimeout(crossfadeTimer);
    crossfadeTimer = setTimeout(() => {
      // Dimming-Opacity aus updateScrolly() zuerst löschen, damit opacity:0
      // der .faded-out-Klasse nicht von einem übrig gebliebenen Inline-Style
      // blockiert wird.
      mapLayer.style("opacity", null);
      mapLayer.classed("faded-out", true);
      chLayer.classed("visible", true);
      markerGroup.classed("visible", true);
    }, ZOOM_DURATION);
  }

  function exitSwitzerland() {
    if (!showingSwitzerland) return;
    showingSwitzerland = false;
    clearTimeout(crossfadeTimer);

    d3.select("body").classed("showing-switzerland", false);
    mapLayer.classed("faded-out", false);
    chLayer.classed("visible", false);
    markerGroup.classed("visible", false);
    closeCasePopup();
    applyBackgroundZoom(); // fällt auf Europa/Route/Welt zurück, je nachdem wo wir noch sind
  }

  // Blendet alle Länder aus, die für die aktuelle Etappe nicht relevant sind,
  // damit der Blick gezielt auf die gerade erzählten Länder fällt statt auf die
  // gesamte (weiterhin voll eingefärbte) Choroplethenkarte. `null` löscht die
  // Hervorhebung (Zustand vor Beginn jeder Etappe, wenn die normale Karte
  // erkundet wird).
  function updateCountryHighlight() {
    let names = null;
    if (showingSwitzerland) {
      names = ["Switzerland"];
    } else if (showingEurope) {
      names = EUROPE_COUNTRIES;
    } else if (showingRoute) {
      names = [...SOUTH_AMERICA_SUPPLIERS, ...ENTRY_PORT_COUNTRIES];
    }
    countryPaths.classed("dimmed", d => names !== null && !names.includes(d.properties.name));
  }

  // Auslöser direkt über den Scroll-Event, statt über IntersectionObserver:
  // robuster und ohne dessen Timing-Eigenheiten. Bei jedem Scroll wird die
  // Sichtbarkeit des Trigger-Punkts neu berechnet.
  const trigger = document.getElementById("switzerland-trigger");

  function checkTrigger() {
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    const ratio = r.height > 0 ? visibleHeight / r.height : 0;

    if (ratio >= 0.5) {
      enterSwitzerland();
    } else if (r.top > 0) {
      // Trigger liegt unterhalb des Viewports -> wir sind wieder hochgescrollt.
      exitSwitzerland();
    }
    // Liegt der Trigger oberhalb des Viewports (top < 0) und ratio < 0.5, sind wir
    // weiter runtergescrollt als der Trigger -> Schweiz-Ansicht bleibt aktiv.
  }

  // Scrollytelling-Abschnitte: der leere Scroll-Bereich hat einen Vorlauf
  // (LEAD_IN), in dem die Weltkarte pur stehen bleibt, bevor die Etappen
  // (Route, Europa, Schweiz-Text) starten. Jede Etappe blendet sanft ein,
  // bleibt in ihrer Mitte stehen und blendet wieder aus, bevor die nächste kommt.
  const scrollySection = document.querySelector(".scroll-spacer");
  const scrollyBeats = Array.from(document.querySelectorAll(".ch-scrolly"));
  const LEAD_IN = 0.1;
  const usableRange = 1 - LEAD_IN;
  // Die Route-Etappe kriegt mehr Scroll-Länge als die anderen, damit Pfeil und
  // Schiff eine Weile für sich allein auf der Karte zu sehen sind, bevor die
  // Fakten-Labels einblenden.
  const BEAT_WEIGHTS = { "ch-scrolly-route": 1.8 };
  const beatWeights = scrollyBeats.map((b) => BEAT_WEIGHTS[b.id] || 1);
  const totalBeatWeight = beatWeights.reduce((sum, w) => sum + w, 0);
  const beatStarts = [];
  let beatWeightAcc = 0;
  beatWeights.forEach((w) => {
    beatStarts.push(LEAD_IN + (usableRange * beatWeightAcc) / totalBeatWeight);
    beatWeightAcc += w;
  });

  function beatStart(i) {
    return beatStarts[i];
  }

  function beatSegment(i) {
    return (usableRange * beatWeights[i]) / totalBeatWeight;
  }

  function fadeShape(progress) {
    const fadeIn = 0.15;
    const fadeOut = 0.85;
    if (progress < fadeIn) return progress / fadeIn;
    if (progress > fadeOut) return 1 - (progress - fadeOut) / (1 - fadeOut);
    return 1;
  }

  function updateScrolly() {
    if (!scrollySection || scrollyBeats.length === 0) return;
    const top = scrollySection.offsetTop;
    const height = scrollySection.offsetHeight;
    const raw = (window.scrollY + window.innerHeight / 2 - top) / height;
    const overallProgress = Math.max(0, Math.min(1, raw));

    // Kartenzoom an denselben Fortschritt gekoppelt wie die Text-Etappen unten,
    // je an dem Punkt, an dem die jeweilige Etappe beginnt.
    if (overallProgress > beatStart(0)) enterRoute(); else exitRoute();
    if (scrollyBeats.length > 1) {
      if (overallProgress > beatStart(1)) enterEurope(); else exitEurope();
    }

    let maxBeatOpacity = 0;
    scrollyBeats.forEach((beat, i) => {
      const localRaw = (overallProgress - beatStart(i)) / beatSegment(i);
      const localProgress = Math.max(0, Math.min(1, localRaw));
      const opacity = fadeShape(localProgress);
      beat.style.opacity = opacity;
      beat.style.pointerEvents = opacity > 0.05 ? "auto" : "none";
      maxBeatOpacity = Math.max(maxBeatOpacity, opacity);
      if (beat.id === "ch-scrolly-route") {
        routeLayer.style("opacity", opacity);
        // Labels blenden erst ein, nachdem Schiff/Pfeil schon eine Weile allein
        // zu sehen waren (erste 45% der - jetzt längeren - Route-Etappe).
        const labelDelay = 0.45;
        const labelRaw = (localProgress - labelDelay) / (1 - labelDelay);
        const labelProgress = Math.max(0, Math.min(1, labelRaw));
        routeLabels.style("opacity", fadeShape(labelProgress));
      }
    });

    // Zwischen den Etappen (Vorlauf, oder die Strecke nachdem "Die Schweiz
    // mittendrin" schon ausgeblendet ist - inklusive der Zoom-Verweildauer vor
    // dem Kantonskarten-Crossfade) ist gerade kein Scrolly-Text zu sehen - die
    // Hintergrundkarte wird dann gedimmt statt in voller Stärke gezeigt, damit
    // sie zurücktritt statt ständig neu "aufzutauchen". Sobald der Crossfade
    // zur Kantonskarte tatsächlich startet, übernimmt .faded-out (enterSwitzerland
    // löscht diesen Inline-Style direkt vor dem Setzen der Klasse), darum hier
    // dann nichts mehr anfassen.
    // `raw > 0` schützt den Ruhezustand der Seite, bevor überhaupt in den
    // Scroll-Bereich gescrollt wurde - ohne diese Bedingung wurde auch die
    // unangetastete Startkarte (die normale Choroplethenkarte vor jedem Scrollen)
    // gedimmt, weil "Scroll-Bereich noch nicht erreicht" auf denselben Wert
    // overallProgress=0 abgeschnitten wird wie "gerade erst im Vorlauf".
    if (!mapLayer.classed("faded-out")) {
      const dim = raw > 0 && maxBeatOpacity < 0.05;
      mapLayer.style("opacity", dim ? 0.3 : 1);
    }

    updateCountryHighlight();
  }

  function onScroll() {
    checkTrigger();
    updateScrolly();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll(); // initialer Zustand beim Laden
});
