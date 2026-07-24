const width = 960;
const height = 520;

// Create the SVG element and mount it into the #map div
const svg = d3.select("#map")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const projection = d3.geoNaturalEarth1();
const path = d3.geoPath(projection);

// Map geometry and our crime data name some countries differently.
// This table translates from the map name (left) to the name in oc_index.json (right).
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

// Color scale: light = low value, dark/red = high value.
// Thresholds are aligned with the real distribution of both metrics (2021-2025)
// (median ~5, 85th percentile ~7, maximum ~9.5) - not an assumed 0-10 range.
// This keeps the scale comparable between "Cocaine trade" and "Criminality avg.", AND
// both metrics actually make use of the color range (Criminality avg. would otherwise never reach red).
// Deliberately doesn't start at white/light grey, so "low" isn't confused with "no data".
const colorScale = d3.scaleLinear()
  .domain([0, 5, 7, 9.5])
  .range(["#cfcfcf", "#8a8a8a", "#2b2b2b", "#b0231c"])
  .clamp(true);

// "No data" gets a hatch pattern instead of a flat fill - structurally
// distinguishable from any color scale, instead of relying on a similar grey tone.
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
  cocaine: "Cocaine-trade score",
  criminality: "Criminality avg.",
};

// state.metric controls which column from oc_index.json is displayed.
const state = {
  metric: "cocaine",
  year: "2025",
};

function valueFor(ocData, mapName) {
  const dataName = NAME_ALIASES[mapName] || mapName;
  const entry = ocData[dataName];
  return entry ? entry[state.metric][state.year] : null;
}

// Swiss canton numbers (1-26) -> name. The swiss-maps geometries only provide
// numeric IDs, no names as a property, hence the manual mapping.
const CANTON_NAMES = {
  1: "Zurich", 2: "Bern", 3: "Lucerne", 4: "Uri", 5: "Schwyz", 6: "Obwalden",
  7: "Nidwalden", 8: "Glarus", 9: "Zug", 10: "Fribourg", 11: "Solothurn",
  12: "Basel-Stadt", 13: "Basel-Landschaft", 14: "Schaffhausen",
  15: "Appenzell Ausserrhoden", 16: "Appenzell Innerrhoden", 17: "St. Gallen",
  18: "Graubünden", 19: "Aargau", 20: "Thurgau", 21: "Ticino", 22: "Vaud",
  23: "Valais", 24: "Neuchâtel", 25: "Geneva", 26: "Jura",
};
const ZURICH_CANTON_ID = 1;

// Content for the case profiles, condensed from the indictments.
// People are anonymized with the agreed placeholders (Person A-X).
const CASE_DETAILS = {
  a: {
    fileNumbers: "B-4/2021/10026692 & B-4/2021/10011441",
    title: "The Bunker and Weapons Case",
    lede: "Person A and Person B ordered cocaine by phone at prices of CHF 40,000–43,000 per kilo and stored the goods, along with a private arsenal of weapons, in two bunkers in Zurich.",
    accused: [
      ["Person A", "Organizer, cash courier"],
      ["Person B", "Chief distributor, portioned the goods"],
    ],
    facts: [
      "Couriers from Germany/Austria; bunkers on Bodenacherstrasse (Benglen) and in storage unit U267, Bleicherweg 19",
      "Seized on 12.4.2022: 6.45 kg cocaine, 8.16 kg hashish, amphetamines, marijuana, 3,899 ecstasy tablets",
      "Arsenal of weapons: Uzi, several AK-47s, a Sturmgewehr 90, pump-action shotguns, handguns, suppressors, thousands of rounds of ammunition",
      "Money laundering: cash hidden in boxes for aperitif snack sticks and vacuum-sealed to the body, taken by night train to Munich/Milan to pay suppliers",
    ],
  },
  b: {
    fileNumbers: "C-4/2021/10012936",
    title: "The SkyECC and Covid Fraud Case",
    lede: "Person I coordinated large cocaine and marijuana deliveries via the encrypted messenger SkyECC – while simultaneously obtaining Covid-19 emergency aid for two of his own companies.",
    accused: [
      ["Person I", "Wholesaler, owner of «Kebab World» & «King City GmbH»"],
      ["Person J / Person K", "Accomplices"],
    ],
    facts: [
      "2 kg of cocaine delivered to Austria (to Person L) in several tranches",
      "Ordered 5 kg, then 21 kg of cocaine from Germany via SkyECC (EUR 32,750/kg); smuggled in vehicles with hidden compartments (incl. a VW Caddy)",
      "95.3 kg of marijuana delivered to Person O in Otelfingen on 12.4.2021, hidden among plants in a trolley",
      "Obtained a CHF 75,000 Covid-19 loan using falsified revenue figures – spent on foreign currency and shopping at Louis Vuitton, Burberry, and a bike factory",
    ],
  },
  c: {
    fileNumbers: "B-5/2022/10045782",
    title: "The Bodypacking Case",
    lede: "Person Q, Person P, and Person R flew in nearly 15 kg of cocaine from the Dominican Republic and Brazil – smuggled inside their couriers' bodies.",
    accused: [
      ["Person Q", "Organized and financed the purchases"],
      ["Person P", "Picked up the couriers, brought them to hotels"],
      ["Person R", "Stored, cut, and portioned the goods"],
    ],
    facts: [
      "Supplier Person S in the Dominican Republic; flight couriers Person T, U, and X swallowed up to 137 finger packs",
      "Handovers took place at, among other places, the Ibis Budget near the Technopark and the Hotel Olympia",
      "Sold using a color code matching Swiss banknotes («Metal» 5g, «Yellow» 10g, «Blue» 100g); major buyer Person W in Rorschacherberg/Staad",
      "Money laundering via «smurfing»: 134 individual transfers totaling CHF 77,668 via MoneyGram, Western Union and Small World to Person S",
      "Additionally charged: Person P for possession of a prohibited depiction of violence (a photo of a dismembered person)",
    ],
  },
  case4: {
    fileNumbers: null,
    title: "The 'Green Border' Taxi Network",
    lede: "A foreign ringleader organized, together with three accomplices, the smuggling of more than 50 kg of cocaine from Holland – via the unguarded green border near Basel and using a Swiss taxi as a shuttle.",
    accused: [
      ["Person A", "Ringleader"],
      ["Persons B, C, D", "Accomplices — C drove the handover taxi"],
    ],
    facts: [
      "An estimated 50+ kg of cocaine from Holland, transported in Dutch rental cars across the green border near Basel",
      "Immediately after the border, a switch into a waiting Swiss taxi headed for drug bunkers in Dietikon and Oberengstringen",
      "A taxi heading inland in the early morning hours drew less attention than a vehicle with foreign plates",
      "During the arrest, Person A fled despite a shot-out tire, racing through the Bözberg Tunnel at nearly 180 km/h",
    ],
  },
  case5: {
    fileNumbers: null,
    title: "The Balkan Cartel and the Cemetery Deals",
    lede: "Led by a ringleader and an international courier, this network imported dozens of kilos of cocaine, marijuana, and hashish from the Netherlands and Spain.",
    accused: [
      ["Person E", "Ringleader"],
      ["Person F", "International courier"],
    ],
    facts: [
      "Dozens of kilos of cocaine, marijuana, and hashish imported from the Netherlands and Spain",
      "Courier F was paid partly CHF 2,000 per smuggled kilo for cocaine transports to Zurich",
      "Handovers to numerous local buyers frequently took place at Schwandenholz Cemetery in Zurich-Seebach",
      "A failed attempt at a direct import from Bolivia via Brazil for US$7,500 per kilo",
    ],
  },
  case6: {
    fileNumbers: null,
    title: "The Minder and the Car-Battery Hideout",
    lede: "An international courier was sent by Dutch suppliers to act as a 'minder' for an indebted buyer in Glattbrugg – and smuggled cocaine himself in his car.",
    accused: [
      ["Person G", "Courier / minder"],
    ],
    facts: [
      "Sent to Switzerland by Dutch cocaine suppliers to move in as a 'minder' for a buyer in Glattbrugg",
      "The buyer owed the suppliers 70,000 euros — Person G was to monitor that the money from new sales flowed back abroad",
      "At the time of arrest, 2.14 kg of cocaine was found, hidden in a specially fitted extra battery in the trunk of a VW Touareg",
    ],
  },
  case7: {
    fileNumbers: null,
    title: "The Club Dealer and the 'Payment in Kind'",
    lede: "A dealer embedded in Zurich's club scene bought more than 1.3 kg of high-purity cocaine and partly accepted payment in kind instead of cash.",
    accused: [
      ["Person H", "Dealer"],
    ],
    facts: [
      "Purchase of more than 1.3 kg of high-purity cocaine",
      "Partly paid in kind: free use of sex workers, free cocaine at parties",
      "Imported illegal testosterone from Macedonia for the bodybuilding scene",
      "Traded counterfeit luxury watches under the Rolex and Audemars Piguet brands",
    ],
  },
  case8: {
    fileNumbers: null,
    title: "The Teenage Telegram Contractor",
    lede: "A perpetrator, born in 2004, took orders as a mere errand-runner for an unknown person who instructed him via the app Telegram under the pseudonym 'Jack Jackson'.",
    accused: [
      ["Person I", "Contractor, born 2004"],
    ],
    facts: [
      "Received orders via Telegram from an unknown person under the pseudonym 'Jack Jackson'",
      "Took delivery of kilo blocks of cocaine at home, cut them with makeup powder, and repackaged them for resale",
      "Pay: only CHF 200–500 per job — for drug values worth tens of thousands of francs",
    ],
  },
  case9: {
    fileNumbers: null,
    title: "The Snack-Stand Dealer",
    lede: "A perpetrator used his own snack stand in Affoltern am Albis as a drug-dealing hub – with strikingly high personal use.",
    accused: [
      ["Person J", "Snack-stand operator"],
    ],
    facts: [
      "Bought roughly 167 g of cocaine in total over several months, dealt from his own snack stand in Affoltern am Albis",
      "Resold about 70 g to third parties to fund himself",
      "Consumed nearly 100 g of it himself at his workplace",
    ],
  },
  case10: {
    fileNumbers: null,
    title: "The Basement Retailer",
    lede: "A small-time dealer sold tiny 0.7-gram portions to a large number of individual buyers and was caught red-handed during a traffic stop.",
    accused: [
      ["Person K", "Small-time dealer"],
    ],
    facts: [
      "Sold 0.7-gram portions for CHF 80–100 to a large number of individual buyers",
      "Kept a stash of over 300 g in vacuum bags in the basement of his home in Eglisau, and in his BMW X5",
      "Caught red-handed by police during a traffic stop",
    ],
  },
  case11: {
    fileNumbers: null,
    title: "The Bargain Street Dealer and Speedster",
    lede: "Driven by financial hardship, this dealer entered the cocaine trade on commission and sold at unusually low prices.",
    accused: [
      ["Person L", "Street dealer"],
    ],
    facts: [
      "Entered the trade out of financial hardship, selling on commission for a backer (keeping 20% of proceeds)",
      "Moved around 1.46 kg of cocaine at an unusually low average price of CHF 35 per gram for the canton",
      "Caught speeding at 124 km/h in an 80 km/h zone on the motorway shortly before his arrest",
    ],
  },
  case12: {
    fileNumbers: null,
    title: "The Stranded Tram Courier",
    lede: "A tourist with no fixed address in Switzerland was caught with cocaine and heroin during a routine ID check at a Zurich tram stop.",
    accused: [
      ["Person M", "Courier, no fixed address in Switzerland"],
    ],
    facts: [
      "ID check at a tram stop in central Zurich",
      "53.4 g of cocaine and 31.7 g of heroin found",
      "Job: deliver the drugs for a flat fee of CHF 2,000 to an unknown person — but got stranded at the stop",
    ],
  },
};

Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
  d3.json("data/oc_index.json"),
  d3.json("https://cdn.jsdelivr.net/npm/swiss-maps@4.7.0/2026/ch-combined.json"),
]).then(([world, ocData, chTopo]) => {

  const countries = topojson.feature(world, world.objects.countries).features;
  projection.fitSize([width, height], { type: "Sphere" });
  addNoDataPattern(svg);

  // All country paths go into their own group, so zooming only needs a single
  // CSS transform on the group instead of recomputing every path.
  const mapLayer = svg.append("g").attr("class", "map-layer");

  const countryPaths = mapLayer.selectAll("path.country")
    .data(countries)
    .join("path")
      .attr("class", "country")
      .attr("d", path);

  countryPaths.append("title");

  // Clicked country: show name + value in the info field and highlight the shape.
  let selected = null;

  function updateReadout() {
    const readout = d3.select("#country-readout");
    if (!selected) {
      readout.text("Click on a country for details.");
      return;
    }
    const value = valueFor(ocData, selected.properties.name);
    readout.html(
      `<strong>${selected.properties.name}</strong> — ${METRIC_LABELS[state.metric]}: ` +
      (value == null ? "no data" : `${value} / 9.5`)
    );
  }

  countryPaths.on("click", function (event, d) {
    selected = selected === d ? null : d; // clicking again clears the selection
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
        return `${d.properties.name}: ${value == null ? "no data" : value}`;
      });

    d3.select("#subtitle")
      .text(`${METRIC_LABELS[state.metric]} by country, ${state.year} (0–10)`);

    d3.selectAll(".metric-btn")
      .classed("active", function () { return this.dataset.metric === state.metric; });

    updateReadout();

    const unmatched = countries.filter(d => valueFor(ocData, d.properties.name) == null);
    console.log(`${countries.length} countries drawn, ${unmatched.length} with no data (${state.metric}, ${state.year})`);
  }

  d3.selectAll(".metric-btn").on("click", function () {
    state.metric = this.dataset.metric;
    render();
  });

  render();

  // --- One-time zoom animation onto Switzerland while scrolling ---

  const switzerland = countries.find(d => d.properties.name === "Switzerland");
  const [[x0, y0], [x1, y1]] = path.bounds(switzerland);
  const bboxWidth = x1 - x0;
  const bboxHeight = y1 - y0;
  const bboxCenterX = (x0 + x1) / 2;
  const bboxCenterY = (y0 + y1) / 2;

  const padding = 80; // pixel margin around Switzerland once zoomed in
  const zoomScale = Math.min(
    (width - padding * 2) / bboxWidth,
    (height - padding * 2) / bboxHeight
  );
  const zoomTranslateX = width / 2 - zoomScale * bboxCenterX;
  const zoomTranslateY = height / 2 - zoomScale * bboxCenterY;

  // --- Zoom targets for the intermediate stages, built from several countries'
  // outlines --- (not single countries like Switzerland, so we merge the bounds
  // across all matching country features by hand.)
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

  // --- Intermediate stage Route: South America (supplier countries) -> Europe (entry ports) ---
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

  // Arrow (curve) from the supplier countries to the entry ports, plus a
  // schematic cargo ship halfway along. Lives in .map-layer, so it zooms and
  // pans automatically together with the map.
  const routeLayer = mapLayer.append("g").attr("class", "route-arrow");
  const arrowStartX = supplierBounds.cx, arrowStartY = supplierBounds.cy;
  const arrowEndX = portBounds.cx, arrowEndY = portBounds.cy;
  const arrowCtrlX = (arrowStartX + arrowEndX) / 2;
  const arrowCtrlY = Math.min(arrowStartY, arrowEndY) - 50; // arcs upward, like a shipping route

  routeLayer.append("path")
    .attr("id", "route-arrow-path")
    .attr("class", "route-arrow-line")
    .attr("d", `M ${arrowStartX},${arrowStartY} Q ${arrowCtrlX},${arrowCtrlY} ${arrowEndX},${arrowEndY}`);

  const arrowAngleDeg = Math.atan2(arrowEndY - arrowCtrlY, arrowEndX - arrowCtrlX) * 180 / Math.PI;
  routeLayer.append("polygon")
    .attr("class", "route-arrow-head")
    .attr("points", "0,-7 16,0 0,7")
    .attr("transform", `translate(${arrowEndX},${arrowEndY}) rotate(${arrowAngleDeg})`);

  // The ship travels along the arrow curve via a native SVG <animateMotion>
  // instead of a JS rAF loop: keeps running independent of the main thread /
  // tab visibility.
  const ship = routeLayer.append("g").attr("class", "route-ship");
  // Very simple cargo-ship symbol built from basic shapes (hull + deck), drawn
  // at 0,0 - animateMotion takes care of position and orientation (rotate: auto).
  ship.append("polygon").attr("class", "ship-hull").attr("points", "-14,-3 14,-3 10,7 -10,7");
  ship.append("rect").attr("class", "ship-deck").attr("x", -5).attr("y", -9).attr("width", 10).attr("height", 7);
  ship.append("animateMotion")
    .attr("dur", "7s")
    .attr("repeatCount", "indefinite")
    .attr("rotate", "auto")
    .append("mpath")
    .attr("href", "#route-arrow-path");

  // Fact labels sit directly on the map instead of in an opaque text panel -
  // this keeps the map and the moving ship visible at all times. They only
  // fade in once the arrow/ship have been alone on screen for a while (see
  // updateScrolly/labelDelay further down).
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
    "Main cocaine suppliers",
    ["Colombia, Peru, Bolivia,", "Ecuador, Venezuela"]
  );
  addRouteLabel(
    arrowEndX, arrowEndY - 34,
    "Main entry points into Europe",
    ["Antwerp, Rotterdam,", "Amsterdam"]
  );

  // --- Fine canton map (swiss-maps) as a second layer, prepared but hidden ---
  // world-atlas only has a coarse polygon (a few dozen points) for a country like
  // Switzerland. swiss-maps provides the real canton borders. We draw them in their
  // own group with their own projection, fitted to Switzerland.
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
      .text(d => CANTON_NAMES[d.id] || `Canton ${d.id}`);

  // --- The 12 cases as markers on the canton map ---
  // Three are researched in depth (profile popup with real facts and their own
  // narrative article); the other nine also have real facts behind them, but are
  // deliberately kept grey and smaller – secondary, not unimportant. All 12 cases
  // come from the Zurich public prosecutor's office, so the same canton flashes for all.
  const FEATURED_CASES = [
    { id: "a", short: "Case 1", label: "Bunker Cartel", cantonId: ZURICH_CANTON_ID, featured: true },
    { id: "b", short: "Case 2", label: "Crypto Dealer", cantonId: ZURICH_CANTON_ID, featured: true },
    { id: "c", short: "Case 3", label: "Bodypacking", cantonId: ZURICH_CANTON_ID, featured: true },
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

  // All 12 positions are chosen to sit within the actual map area (cantons span
  // x:152–807, y:50–470 in the SVG). The three researched cases form a row near
  // Zurich, equal in rank to each other; the other nine are spread across the area.
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
    cantonPath.node().getBoundingClientRect(); // force reflow so the animation restarts
    cantonPath.classed("flash", true);
  }

  // --- Profile popup per case ---
  const popupBackdrop = d3.select("#case-popup-backdrop");

  function openCasePopup(caseData) {
    const detail = CASE_DETAILS[caseData.id];

    if (detail) {
      d3.select("#case-popup-filenum")
        .text(detail.fileNumbers ? `Case no. ${detail.fileNumbers}` : "One of 12 indictments analyzed")
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
      // Fallback in case a case without stored data is ever clicked:
      // no invented facts, just an honest placeholder.
      d3.select("#case-popup-filenum").text("One of 12 indictments analyzed");
      d3.select("#case-popup-title").text(`Case ${caseData.short} of 12`);
      d3.select("#case-popup-lede").text("This case is part of the 12 indictments analyzed. More details to follow.");
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

  // Very reduced head/shoulders hint instead of an actual face – deliberately
  // schematic, in the style of the profile-card reference. All 12 markers are
  // the same size – only the grey tone distinguishes the nine minor cases.
  const MARKER_RADIUS = 19;
  markers.append("circle").attr("class", "marker-ring").attr("r", MARKER_RADIUS);
  markers.append("circle").attr("class", "marker-head").attr("cy", -4).attr("r", 6);
  markers.append("path").attr("class", "marker-face")
    .attr("d", "M -9,10 C -9,0 9,0 9,10");

  markers.filter(d => d.featured).append("text").attr("y", 33).text(d => d.short);
  markers.filter(d => d.featured).append("text").attr("class", "marker-label").attr("y", 45).text(d => d.label);
  markers.filter(d => !d.featured).append("text").attr("class", "marker-number").attr("y", 33).text(d => d.short);

  // Zoom in three stages: World -> Route (South America/Europe overview) ->
  // Europe (Super Cartel stage) -> Switzerland (coarse shape), then crossfade to
  // the fine canton map. The original bug wasn't the animation itself, but that
  // the map scrolled out of view (fixed with position:sticky on #map) - and
  // later, that two separate timing mechanisms (trigger visibility vs. scroll
  // progress) drifted apart. Hence now: a single overallProgress value drives
  // both the map zoom and the text fades.
  const ZOOM_DURATION = 1800; // ms, must match the transition duration of .map-layer in style.css
  let showingRoute = false;
  let showingEurope = false;
  let showingSwitzerland = false;
  let crossfadeTimer = null;

  // Priority Switzerland > Europe > Route > World: sets the map transform to
  // match the "highest" stage we're currently in.
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
    applyBackgroundZoom(); // falls back to Europe/Route/World, whichever we're still in
  }

  // Trigger driven directly by the scroll event, instead of IntersectionObserver:
  // more robust and without its timing quirks. Visibility of the trigger point is
  // recomputed on every scroll.
  const trigger = document.getElementById("switzerland-trigger");

  function checkTrigger() {
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    const ratio = r.height > 0 ? visibleHeight / r.height : 0;

    if (ratio >= 0.5) {
      enterSwitzerland();
    } else if (r.top > 0) {
      // Trigger is below the viewport -> we've scrolled back up.
      exitSwitzerland();
    }
    // If the trigger is above the viewport (top < 0) and ratio < 0.5, we've scrolled
    // further down than the trigger -> the Switzerland view stays active.
  }

  // Scrollytelling sections: the empty scroll area has a lead-in (LEAD_IN)
  // during which the plain world map stays put, before the stages (Route,
  // Europe, Switzerland text) begin. Each stage fades in gently, holds in its
  // middle, and fades out again before the next one arrives.
  const scrollySection = document.querySelector(".scroll-spacer");
  const scrollyBeats = Array.from(document.querySelectorAll(".ch-scrolly"));
  const LEAD_IN = 0.1;
  const usableRange = 1 - LEAD_IN;
  // The Route stage gets more scroll length than the others, so the arrow and
  // ship have a while to be seen alone on the map before the fact labels appear.
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

    // Map zoom is coupled to the same progress as the text stages below, each
    // triggered at the point where its own stage begins.
    if (overallProgress > beatStart(0)) enterRoute(); else exitRoute();
    if (scrollyBeats.length > 1) {
      if (overallProgress > beatStart(1)) enterEurope(); else exitEurope();
    }

    scrollyBeats.forEach((beat, i) => {
      const localRaw = (overallProgress - beatStart(i)) / beatSegment(i);
      const localProgress = Math.max(0, Math.min(1, localRaw));
      const opacity = fadeShape(localProgress);
      beat.style.opacity = opacity;
      beat.style.pointerEvents = opacity > 0.05 ? "auto" : "none";
      if (beat.id === "ch-scrolly-route") {
        routeLayer.style("opacity", opacity);
        // Labels only fade in once the ship/arrow have already been alone on
        // screen for a while (first 45% of the - now longer - Route stage).
        const labelDelay = 0.45;
        const labelRaw = (localProgress - labelDelay) / (1 - labelDelay);
        const labelProgress = Math.max(0, Math.min(1, labelRaw));
        routeLabels.style("opacity", fadeShape(labelProgress));
      }
    });
  }

  function onScroll() {
    checkTrigger();
    updateScrolly();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll(); // initial state on load
});
