/* Loading Systems · Dock Studio catalogue
   Sources: Preislisten 11DE-601N (14.09.2026), 11DE-601DD, 11DE-604NG, 11DE-0620NG (01.06.2026), UK Product Brochure 2026, loading-systems.com product pages.
   Prices are LSP list prices (Listenpreise) in EUR net, ex works, as printed. Products without a price list in hand are "auf Anfrage". */
import PRICES from './prices.js?v=23';
export { PRICES };

/* ---------------- Doors ---------------- */
export const DOORS = {
  pd601: { label: 'Sektionaltor PowerDoor 601', short: '601', kind: 'sectional', priced: 'pd601',
    desc: 'Gut isoliertes Industrie-Sektionaltor mit 40 mm PUR-Sandwichpaneelen, 500 mm Paneelhöhe. Mit Fenstern, Full-Vision-Sektionen, Schlupftür und allen Beschlagsystemen.',
    facts: ['40 mm Sandwich-Paneel, PUR-Schaum, 500 mm Paneelhöhe', 'Beschläge: Normal, Höhergeführt HL 750 bis 4100, Vertikal, Niedrigsturz, Dachneigung', 'Optional 80 mm Paneel, Fingerklemmschutz, Full Vision, Schlupftür', 'Breite 2000 bis 8000 mm, Höhe 2000 bis 6500 mm'],
    w: [2000, 8000], h: [2000, 6500], panel: .5, speed: .2 },
  dockdoor: { label: 'Dock Door 040/045', short: 'Dock Door', kind: 'sectional', priced: 'dockdoor',
    desc: 'Die PowerDoor 601 als Verladetor: gleiche Paneele, Maße bis 3750 × 4000 mm, Preisliste für den Verladebereich. Optional Dock Door ECO.',
    facts: ['PowerDoor-601-Paneele, 40 mm PUR', 'Breite 2000 bis 3750 mm, Höhe 2000 bis 4000 mm', '1" Hohlwelle, Zugseil-Bedienung in Serie', 'Fenster, Full Vision und RAL-Farben wie 601'],
    w: [2000, 3750], h: [2000, 4000], panel: .5, speed: .2 },
  hs620: { label: 'Schnelllauf-Sektionaltor 620NG', short: '620NG', kind: 'sectional', priced: 'hs620',
    desc: 'Isoliertes Sektionaltor mit Frequenzumrichter-Antrieb, Lichtgitter und kabelloser Signalübertragung. 244 mm Paneele, 40 mm PUR, Lamela Stucco.',
    facts: ['40 mm PUR-Paneel, 244 mm Paneelhöhe, Lamela Stucco RAL 9002', 'Motor mit Frequenzumrichter, NG-Control, Lichtgitter', 'Kabellose Verbindung Torblatt zu Steuerung, 50.000 Zyklen Federn', 'Breite 2000 bis 5000 mm, Höhe 2500 bis 5000 mm'],
    w: [2000, 5000], h: [2500, 5000], panel: .244, speed: .6, motor: true },
  hs640: { label: 'Schnelllauftor 640PR', short: '640PR', kind: 'rollup', priced: null,
    desc: 'Leichtes, flexibles Schnelllauf-Rolltor mit Behang für innen und außen: Verkehrsfluss und stabile Klimatrennung bei hohen Zyklen. Preis auf Anfrage.',
    facts: ['Rolltor mit flexiblem Behang', 'Für Innenlogistik, Produktion und Außenbereiche', 'Varianten Retail, Standard, Food, Cool, Machine, Clean (650PR)', 'Preis auf Anfrage'],
    w: [2000, 5000], h: [2000, 5000], panel: .3, speed: 1.0, motor: true },
  fire: { label: 'Brandschutz-Rolltor', short: 'Brandschutz', kind: 'roller', priced: null,
    desc: 'Zertifizierter Feuerwiderstand gegen Flammen und Rauch, sichere Evakuierung und kontrollierte Abschottung. Geschlossenes Rolltor ohne Fenster. Preis auf Anfrage.',
    facts: ['Zertifizierter Feuerwiderstand', 'Rolltor, geschlossener Panzer ohne Verglasung', 'Für Logistikzentren und Betriebe mit Brandschutzauflagen', 'Preis auf Anfrage'],
    w: [2000, 6000], h: [2000, 5000], panel: .11, speed: .25 },
  curtain: { label: 'Streifenvorhang 680', short: '680', kind: 'strips', priced: null,
    desc: 'PVC-Streifenvorhang für die Trennung von Arbeitszonen und Klimabereichen bei freiem Durchgang. Preis auf Anfrage.',
    facts: ['PVC-Lamellen, überlappend', 'Trennt Zonen, lässt Verkehr durch', 'Kein Antrieb', 'Preis auf Anfrage'],
    w: [2000, 6000], h: [2000, 5000], panel: .3, speed: 0 },
};
export const DOOR_ORDER = ['dockdoor', 'pd601', 'hs620', 'hs640', 'fire', 'curtain'];

/* Panel surface and colour (Preisliste 601N / 620NG Paneelaufbau und Farbe) */
export const RAL = [
  { id: '9002', name: 'Grauweiß', hex: '#e7ebe3', std: true }, { id: '7021', name: 'Schwarzgrau', hex: '#2f3234', std: true }, { id: '9016', name: 'Verkehrsweiß', hex: '#f4f6f4' },
  { id: '9010', name: 'Reinweiß', hex: '#f6f6f0' }, { id: '7016', name: 'Anthrazitgrau', hex: '#383e42' }, { id: '7035', name: 'Lichtgrau', hex: '#c9cccb' }, { id: '7038', name: 'Achatgrau', hex: '#b4b8b0' },
  { id: '9006', name: 'Weißaluminium', hex: '#a5a8a6', metallic: true }, { id: '9007', name: 'Graualuminium', hex: '#8f9192', metallic: true }, { id: '5010', name: 'Enzianblau', hex: '#0e3f6b' },
  { id: '3020', name: 'Verkehrsrot', hex: '#c1121c' }, { id: '6018', name: 'Gelbgrün', hex: '#57a639' }, { id: '1023', name: 'Verkehrsgelb', hex: '#f7b500' }, { id: '5015', name: 'Himmelblau', hex: '#2271b3' },
];
export const PANEL_TYPES = { industrie: { label: 'Industrie 40 mm', pct: 0 }, fsp: { label: 'Fingerklemmschutz 40 mm', pct: 7 }, iso80: { label: 'Zusätzlich isolierend 80 mm', pct: 36 } };
export const LIFT = { normal: { label: 'Normal-Beschlag', pct: 0, hl: 0 }, hl750: { label: 'Höhergeführt HL 750', pct: 3, hl: .75 }, hl1370: { label: 'Höhergeführt HL 1370', pct: 6, hl: 1.37 }, hl2000: { label: 'Höhergeführt HL 2000', pct: 10, hl: 2.0 }, vertical: { label: 'Vertikal-Beschlag', pct: 11, hl: 99 }, lowhead: { label: 'Niedrigsturz, Seile innen', fix: 358, hl: 0 } };
export const LIFT_620 = { SL: { label: 'StandardLift', pct: 0 }, HL750: { label: 'HighLift 750', pct: 1 }, HL1370: { label: 'HighLift 1370', pct: 2 }, HL2000: { label: 'HighLift 2000', pct: 3.5 }, VL: { label: 'VerticalLift', pct: 4 } };
export const WINDOWS = {
  none: { label: 'Keine Fenster', price: 0 },
  oval: { label: 'Ovales Klickfenster 663 × 343 mm', price: 70, each: true, shape: 'oval', w: .663, h: .343 },
  rect: { label: 'Rechteckiges Klickfenster 680 × 373 mm', price: 69, each: true, shape: 'rect', w: .68, h: .373 },
  slim: { label: 'Rechteckiges Fenster 609 × 146 mm', price: 91, each: true, shape: 'rect', w: .609, h: .146 },
};
export const FULLVISION = {
  none: { label: 'Ohne Full-Vision-Sektion', perM: 0 },
  fv250: { label: 'Full Vision doppeltes PMMA 2 × 2,5 mm', perM: 85, glass: 'clear' },
  fv250t: { label: 'Full Vision doppeltes PMMA, thermisch getrennt', perM: 143, glass: 'clear' },
  fv280: { label: 'Full Vision Streckgitter Alu natur', perM: 79, glass: 'mesh' },
};
export const WICKET = { none: { label: 'Keine Schlupftür', price: 0 }, std: { label: 'Schlupftür inkl. Schloss, Griffe, Schließer', price: 935 }, low: { label: 'Schlupftür mit niedriger Schwelle 80 mm', price: 935 + 220 } };
export const WICKET_LOCK = { handle: { label: 'Türgriff innen/außen', price: 0 }, knob: { label: 'Griff innen / Knopf außen', price: 51 }, cyl: { label: 'Griff innen/außen + Schließzylinder', price: 29 }, panic: { label: 'Panikschloss Griff innen/außen', price: 165 }, exitbar: { label: 'Panikschloss Exitbar innen / Griff außen', price: 250 }, electric: { label: 'Elektroschloss Befo 2421', price: 300 } };
export const OPERATION = { rope: { label: 'Zugseil (Serie)', price: 0 }, chain: { label: 'Kette 1:4', price: 115 }, motor: { label: 'Motor KE mit NG-Control (bei 620NG Serie)', price: 0 } };
export const LOCKS = { none: { label: 'Keine Zusatzverriegelung', price: 0 }, bolt490: { label: 'Schubriegel galvanisiert, Niedrigsturz-tauglich', price: 9 }, bolt491: { label: 'Schubriegel galvanisiert, alle Beschläge', price: 9 }, foot: { label: 'Fußschloss, mechanisch (Handtore)', price: 220 } };
export const SAFETY = { spring: { label: 'Federbruchsicherung 1" Achse', price: 64 }, cable: { label: 'Seilbruchsicherung verstellbar, Paar', price: 59 }, slack: { label: 'Schlaffseilsicherung Mikroschalter', price: 52 }, lightgrid: { label: 'Lichtgitter (bei 620NG Serie)', price: 0 }, photocell: { label: 'Externe Reflexlichtschranke', price: 166 } };
export const CONTROLS = { keyswitch: { label: 'Schlüsselschalter Aufputz', price: 75 }, estop: { label: 'Notstopp (Pilz)', price: 32 }, remote2: { label: 'Fernbedienung 2-Kanal 433 MHz', price: 45.68 }, remote4: { label: 'Fernbedienung 4-Kanal 433 MHz', price: 49.27 }, receiver: { label: 'HF-Empfänger 433 MHz', price: 63.06 }, light_rg: { label: 'Ampel rot/grün LED, 7 m Kabel', price: 245.92 }, light_r: { label: 'Ampel rot LED', price: 122.96 } };
export const MISC = { numbers: { label: 'Ziffer schwarz (Toranzahl 1 bis 5), pro Stück', price: 31.37 }, grille: { label: 'Kunststoff-Luftgitter', price: 33 }, handleFlush: { label: 'Handgriff Einbau schwarz', price: 12 }, springs50k: { label: 'Torsionsfedern 50.000 Zyklen', price: 140 } };

/* Mandoor 604NG (Nebentür) */
export const MANDOOR = { widths: [1000, 1200, 1500], heights: [2125, 2250, 2500], locks: { std: { label: 'Griff außen und innen', price: 0 }, knob: { label: 'Knopf außen, Griff innen', price: 18 }, panic: { label: 'Panikschloss Griff/Griff', price: 239 }, panicbar: { label: 'Panikschloss, Panikstange innen', price: 623 }, threepoint: { label: '3-Punkt-Verriegelung', price: 334 }, electric: { label: 'Elektroschloss 10-24 V', price: 209 } }, closer: 101, thermal: 'Mit Thermobrücke' };

/* ---------------- Dock equipment (brochure, no price list in hand) ---------------- */
export const LEVELLERS = {
  none: { label: 'Keine Überladebrücke', desc: 'Ebenerdiges Tor ohne Rampe.' },
  swing: { label: 'Überladebrücke mit Klappkeil 232NG', desc: 'Elektrohydraulisch, robuster Klappkeil, für Standard-Verladestellen. Pulverbeschichtet in Serie.', lip: 'swing', lipLen: .4 },
  tele: { label: 'Überladebrücke mit Vorschubkeil 233NG', desc: 'Elektrohydraulisch mit teleskopierendem Vorschub bis 1000 mm: präzises Anfahren, ISO-Docking, weniger Energieverlust.', lip: 'tele', lipLen: 1.0 },
  stepped: { label: 'Stepped Dock mit Vorschubkeil', desc: 'Der Lkw dockt vollständig an, bevor das Tor öffnet. Sealed Docking gegen Energieverlust.', lip: 'tele', lipLen: 1.0, stepped: true },
  combi: { label: 'Combidock 253NG', desc: 'Für Lkw und Lieferwagen: automatischer Gewichtsausgleich, selbsttragend, kein separates Van-Dock.', lip: 'tele', lipLen: .8 },
  manual: { label: 'Manuelle Überladebrücke 105NG', desc: 'Kompakt, ohne Antrieb, ausziehbarer Keil für kleine Höhenunterschiede.', lip: 'tele', lipLen: .5, manual: true },
};
export const LEVELLER_SIZES = { lengths: [2000, 2500, 3000, 3500, 4000, 4500, 5000], widths: [2000, 2200, 2500] };
export const LEVELLER_CAP = { std: { label: '60 kN Standard', kn: 60 }, heavy: { label: 'Heavy Duty bis 180 kN', kn: 180 }, iso: { label: 'ISO Option, isolierte Plattform', kn: 60 } };
export const SHELTERS = {
  none: { label: 'Keine Torabdichtung', desc: '' },
  curtain: { label: 'Planen-Torabdichtung 403M', desc: 'Flexible Planen für viele Fahrzeuggrößen, Dachüberstand und integrierte Entwässerung.', type: 'curtain' },
  cushion: { label: 'Kissen-Torabdichtung 400NG', desc: 'Robuste Kissen schließen den Spalt zwischen Fahrzeug und Gebäude: Kühl- und Tiefkühlhäuser.', type: 'cushion' },
  foam: { label: 'Schaum-Torabdichtung 405', desc: 'Schaumgefüllte Seitenkissen, die beim Andocken nachgeben und zurückfedern. Für intensive Nutzung und schiefes Andocken.', type: 'foam' },
  inflatable: { label: 'Aufblasbare Torabdichtung 407NG', desc: 'Dichtet nach dem Andocken, adaptiver Gebläsemotor spart bis zu 35 % Energie. Loading Systems Exclusive.', type: 'inflatable' },
  inflTop: { label: 'Torabdichtung mit aufblasbarem Oberteil 408NG', desc: 'Aufblasbares Oberkissen und flexible Seitenplanen für gemischte Flotten.', type: 'inflTop' },
  van: { label: 'Van-Torabdichtung 421NG', desc: 'Geformte Kissen folgen der Heckform von Lieferwagen: Paketdienste und Last-Mile.', type: 'van' },
};
export const BUMPERS = {
  rubber: { label: 'Gummipuffer', desc: 'Langlebiger stoßdämpfender Gummi, für niedrige bis mittlere Frequenz.', col: '#1b1b1b', style: 'block' },
  pe: { label: 'PE-Puffer (Recycling-Kunststoff)', desc: 'Recycelter Kunststoff, vierfache Lebensdauer, widerstandsfähig.', col: '#232323', style: 'block' },
  rbm: { label: 'RBM-Puffer', desc: 'Gummi mit Stahlrahmen für mittlere Frequenz.', col: '#1f1f1f', style: 'framed' },
  nylon: { label: 'Nylon-Puffer', desc: 'Gelbe Nylon-Lauffläche auf verzinktem Träger: gleitet mit dem Fahrzeug, hohe Frequenz.', col: '#f2c200', style: 'nylon' },
  lamella: { label: 'Lamellenpuffer', desc: 'Gummilamellen auf Stahlträger, hohe Dämpfung.', col: '#2a2a2a', style: 'lamella' },
  ssb: { label: 'SSB-Puffer', desc: 'Stahl-Gummi-Verbund für schwere Lkw.', col: '#3a3a3a', style: 'framed' },
  es: { label: 'ES-Puffer', desc: 'Verschleißarmer Verbundpuffer.', col: '#2f2f2f', style: 'block' },
  sab: { label: 'SAB stoßabsorbierend', desc: 'Kinematisches System nimmt die Stoßenergie auf: höchste Frequenz, schwere Fahrzeuge.', col: '#444', style: 'sab' },
};
export const RESTRAINTS = { none: { label: 'Keine Wegfahrsicherung' }, manual: { label: 'Manuelle Wegfahrsicherung 503NG', desc: 'Blockiert das Hinterrad, Bedienung in Stehhöhe, Raderkennung und LED.' }, auto: { label: 'Automatische Wegfahrsicherung 505NG', desc: 'Erkennt das Hinterrad und blockiert automatisch, Ampel-Kommunikation mit dem Fahrer. Klasse 3 geprüft.' } };
export const LIGHTS = { none: { label: 'Kein Dock-Licht' }, led: { label: 'LED Dock-Licht 920', desc: 'Leuchtet den ganzen Laderaum aus, 90 % weniger Energie als Halogen.' }, hurricane: { label: 'Hurricane Light NG 920-980', desc: 'LED-Licht mit integriertem Ventilator: Luftzirkulation im Laderaum, weniger Kondensat.' } };
export const INTERIOR_LIGHTS = { led_line: { label: 'LED-Lichtbänder', desc: 'Durchgehende LED-Bänder unter der Decke.' }, highbay: { label: 'LED-Hallenstrahler', desc: 'Runde Highbay-Strahler im Raster.' }, none: { label: 'Nur Tageslicht' } };
export const ACCESSORIES = { trafficLight: { label: 'Ampel 934 rot/grün', price: 245.92, src: '620NG Steuerung' }, wheelGuides: { label: 'Radführungen 970', desc: 'Gebogene Rohre, verzinkt oder gelb.' }, bollards: { label: 'Sicherheitspoller 961', desc: 'Gelb-schwarze Poller am Torpfeiler.' }, chocks: { label: 'Unterlegkeile 990' }, numbers: { label: 'Dock-Nummernschild' }, mirror: { label: 'Sicherheitsspiegel' }, tailSeal: { label: 'Hubladebühnen-Abdichtung' }, cornerSeal: { label: 'Eckdichtung' } };
export const DOCK_CONTROL = { basic: { label: 'Einzelsteuerungen', desc: 'Tor, Überladebrücke und Torabdichtung je eigene Bedienung.' }, combi: { label: 'Kombisteuerung', desc: 'Tor, Brücke, Abdichtung und Wegfahrsicherung in einem Gehäuse, verriegelt in logischer Reihenfolge.' }, dockMgmt: { label: 'Dock Management System', desc: 'Alle Docks zentral überwacht: Status, Ampeln, Verriegelung.' } };

export const FACADES = [{ id: 'panel_light', name: 'Sandwichpaneel hellgrau', hex: '#d8dadb' }, { id: 'panel_white', name: 'Sandwichpaneel weiß', hex: '#eceeee' }, { id: 'panel_dark', name: 'Sandwichpaneel anthrazit', hex: '#4a4f53' }, { id: 'brick', name: 'Klinker', hex: '#8d5b4a' }];
export const TRUCKS = { none: { label: 'Kein Fahrzeug' }, truck: { label: 'Sattelzug 13,6 m', model: 'semi', len: 16.6, bedH: 1.30, wheelR: .51 }, rigid: { label: 'Lkw 7,5 t', model: 'rigid', len: 8.0, bedH: 1.05, wheelR: .43 }, van: { label: 'Lieferwagen', model: 'van', len: 7.0, bedH: .65, wheelR: .36 } };

export const LIMITS = { w: [2000, 8000], h: [2000, 6500], bays: [1, 6] };
export const PRESETS = [
  { id: 'logistik', label: 'Logistikzentrum', patch: { door: 'dockdoor', w: 3000, h: 3250, leveller: 'tele', shelter: 'inflatable', bumper: 'nylon', restraint: 'auto', light: 'led', bays: 3, truck: 'truck' } },
  { id: 'kuehl', label: 'Kühlhaus', patch: { door: 'hs620', w: 3000, h: 3250, leveller: 'stepped', shelter: 'cushion', bumper: 'sab', restraint: 'auto', light: 'hurricane', bays: 2, truck: 'truck' } },
  { id: 'paket', label: 'Paketdienst Van-Dock', patch: { door: 'dockdoor', w: 2500, h: 2750, leveller: 'combi', shelter: 'van', bumper: 'pe', restraint: 'manual', light: 'led', bays: 4, truck: 'van' } },
  { id: 'produktion', label: 'Produktion innen', patch: { door: 'hs640', w: 3000, h: 3500, leveller: 'none', shelter: 'none', bumper: 'rubber', restraint: 'none', light: 'none', bays: 1, truck: 'none' } },
];

/* ---------------- Price engine ---------------- */
export function nearestUp(list, v) { for (const x of list) if (v <= x) return x; return null; }
export function basePrice(doorId, w, h) {
  const d = DOORS[doorId]; if (!d.priced) return null;
  const t = PRICES[d.priced]; const W = nearestUp(t.widths, w); const heights = Object.keys(t.rows).map(Number).sort((a, b) => a - b); const H = nearestUp(heights, h);
  if (W == null || H == null) return null;
  const row = t.rows[String(H)]; const i = t.widths.indexOf(W); const v = row[i];
  return Number.isFinite(v) ? { price: v, W, H, rev: t.rev, validFrom: t.validFrom } : null;
}
export const eur = n => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const eur2 = n => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
