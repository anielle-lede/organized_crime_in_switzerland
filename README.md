# Crypto Dealer, Bunker Cartel and Bodypacking

For my third LEDE project, I wanted to build something I could potentially use in my career. I already had this data on hand, and I'll soon be producing an online series about cocaine in Switzerland. Cocaine use in Switzerland is currently at an all-time high.

An interactive data-journalism story about organized drug crime in Switzerland – from the global context (Global Organized Crime Index) to three in-depth researched cases from Zurich, based on 12 indictments from the Zurich public prosecutor's office.

**Project 3 – Lede**

Live here: https://anielle-lede.github.io/organized_crime_in_switzerland/

## Data sources

| Source | Use | Access |
|---|---|---|
| [Global Organized Crime Index](https://ocindex.net) (GI-TOC) | World map: Cocaine-trade score & Criminality avg. by country, 2021/2023/2025 | `global_oc_index.xlsx`, processed in `01_data_extraction.ipynb` → `data/oc_index.json` |
| 12 indictments from the Staatsanwaltschaft II des Kantons Zürich (2017–2025) | The 12 cases on the Switzerland map, incl. the three in-depth case articles | Obtained from a contact; all proceedings are current/valid |
| [world-atlas](https://github.com/topojson/world-atlas) (Mike Bostock) | World map geometry (110m) | Loaded via CDN (jsDelivr), no local copy |
| [swiss-maps](https://github.com/interactivethings/swiss-maps) | Canton borders | Loaded via CDN (jsDelivr), no local copy |
| Own photo | Hero image on the homepage | `drugs1.png`, source: Anielle Peterhans |

**On the origin of the indictments:** The 12 proceedings were provided by a contact, not obtained through an official access request. All cases are current (case file dates: 2017–2025). Names of the accused and co-accused are anonymized throughout (`Person A`, `Person B`, etc.) – see the "Anonymization" section below.

## Project structure

The English version is the main site, published at the repository root (required for GitHub Pages); the German version lives under `/de`.

```
├── index.html              Main page (English)
├── script.js                D3 logic: world map, Switzerland zoom, canton map, case popups
├── style.css                 All styling (both language versions)
├── drugs1.png                Hero image
├── imperiale.jpg, kinahan.jpg,
│   gacanin.jpg, taghi.jpg      Photos of the four "Super Cartel" figures
├── global_oc_index.xlsx      Raw Global Organized Crime Index data
├── 01_data_extraction.ipynb  Documented data processing (xlsx → JSON)
├── data/
│   └── oc_index.json         Processed country data for the world map
└── de/
    ├── index.html             Main page (German)
    └── script.js               Same logic, German content
                                 (uses ../style.css, ../drugs1.png, ../data/oc_index.json)
```

## Methodology

The data-processing pipeline (Excel → JSON) is fully documented in `01_data_extraction.ipynb`, including data quirks that were found (e.g. inconsistent column/country-name spellings between the yearly sheets) and how they were fixed.

## Anonymization

All individuals named in the indictments (main defendants, accomplices, couriers, buyers) are anonymized with placeholders (`Person A`, `Person B`, …). Company names and exact addresses were likewise generalized wherever they could allow re-identification (e.g. via commercial-registry lookups). Basis: guidelines of the Swiss Press Council (in particular clause 7.6, naming of individuals) and the presumption of innocence for proceedings not yet legally concluded.

## Known limitations

- The positions of the 12 case markers on the canton map are **stylized**, not exact crime-scene coordinates.
- The world-map geometry (110m resolution) is heavily simplified; for Switzerland, a separate, finer canton map (swiss-maps) is therefore overlaid.
- Missing case numbers for 9 of the 12 cases are marked as such (no invented case numbers).

## Author

Anielle Peterhans for the LEDE Program at Columbia University
