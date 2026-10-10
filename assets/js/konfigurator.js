/* Loading Systems · Dock Studio (Three.js r170) */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as C from './cfg/catalog.js';
import { createMaterials, TEX } from './cfg/materials.js';
import { buildWarehouse, buildStudio, dispose, DOCK_H, ease } from './cfg/scene.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);

/* ------------------------------------------------------------------ State */
const state = {
  door: 'dockdoor', w: 3000, h: 3250, ral: '9002', panel: 'industrie', lift: 'normal', lift620: 'SL', windows: 'none', fullvision: 'none', wicket: 'none', wicketLock: 'handle',
  operation: 'rope', lock: 'none', safety: [], controls: [], numbers: true, grille: false,
  leveller: 'tele', levellerLen: 2500, levellerW: 2000, levellerCap: 'std', shelter: 'inflatable', bumper: 'nylon', restraint: 'auto', light: 'led', trafficLight: true, bollards: true, wheelGuides: true, dockControl: 'combi',
  mandoor: 'none', mandoorW: 1000, mandoorH: 2125, mandoorLock: 'std', mandoorThermal: true,
  bays: 3, activeBay: 1, truck: 'truck', truckBays: 'one', facade: 'panel_light', interiorLight: 'led_line',
  mode: 'yard', view: 'yard',
};
const ARR = ['safety', 'controls']; const BOOL = ['numbers', 'grille', 'trafficLight', 'bollards', 'wheelGuides', 'mandoorThermal'];
const KEYS = Object.keys(state).filter(k => k !== 'view');
function hash() { return '#' + KEYS.map(k => `${k}=${ARR.includes(k) ? state[k].join('.') : BOOL.includes(k) ? (state[k] ? 1 : 0) : state[k]}`).join('&'); }
function readHash() {
  if (!location.hash) return; const p = new URLSearchParams(location.hash.slice(1));
  KEYS.forEach(k => { if (!p.has(k)) return; const v = p.get(k); state[k] = ARR.includes(k) ? (v ? v.split('.') : []) : BOOL.includes(k) ? v === '1' : (typeof state[k] === 'number' ? parseInt(v, 10) : v); });
  normalise();
}
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
function normalise() {
  if (!C.DOORS[state.door]) state.door = 'dockdoor';
  const d = C.DOORS[state.door]; state.w = clamp(Math.round(state.w / 50) * 50, d.w); state.h = clamp(Math.round(state.h / 50) * 50, d.h);
  state.bays = clamp(state.bays, C.LIMITS.bays); state.activeBay = clamp(state.activeBay, [0, state.bays - 1]);
  if (d.kind !== 'sectional') { state.windows = 'none'; state.fullvision = 'none'; state.wicket = 'none'; state.panel = 'industrie'; }
  if (d.priced === 'hs620') state.operation = 'motor';
  if (state.door === 'hs620' && !C.LIFT_620[state.lift620]) state.lift620 = 'SL';
  if (!C.RAL.some(r => r.id === state.ral)) state.ral = '9002';
  if (state.mode === 'studio') state.view = 'studio';
}
readHash();

/* ------------------------------------------------------------------ Renderer / scene */
const canvas = $('cfgCanvas'), wrap = $('canvasWrap');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const useAO = !q.has('noao') && window.matchMedia('(pointer: fine)').matches && Math.min(innerWidth, innerHeight) > 600;
renderer.setPixelRatio(Math.min(devicePixelRatio, useAO ? 1.75 : 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
let assetsReady = false; const manager = new THREE.LoadingManager(() => { assetsReady = true; finishLoading(); });
const mats = createMaterials(renderer, manager); const { M } = mats;
const scene = new THREE.Scene();
const sky = mats.tx('sky.jpg', { srgb: true, wrap: false }); sky.mapping = THREE.EquirectangularReflectionMapping; const SKY_ROT = 1.95;
let skyEnv = sky; new RGBELoader(manager).load(TEX + 'sky_1k.hdr', t => { t.mapping = THREE.EquirectangularReflectionMapping; skyEnv = t; if (state.mode !== 'studio') scene.environment = t; });
scene.background = sky; scene.environment = sky; scene.environmentIntensity = .55; scene.backgroundIntensity = .9; scene.backgroundRotation.set(0, SKY_ROT, 0); scene.environmentRotation.set(0, SKY_ROT, 0);
const pmrem = new THREE.PMREMGenerator(renderer); const studioEnv = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
const sunDir = new THREE.Vector3(.555, .742, .377).applyAxisAngle(new THREE.Vector3(0, 1, 0), -SKY_ROT).normalize();
const camera = new THREE.PerspectiveCamera(38, 1, .2, 400);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = true; controls.maxPolarAngle = Math.PI / 2 - .02; controls.screenSpacePanning = false;
class AOPass extends GTAOPass { overrideVisibility() { super.overrideVisibility(); this.scene.traverse(o => { if (o.userData.cutout) o.visible = false; }); } }
let composer = null, aoPass = null, aoOn = useAO;
if (useAO) {
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  aoPass = new AOPass(scene, camera, 1, 1, {}, { radius: .4, distanceExponent: 1, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false }, { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
  aoPass.output = GTAOPass.OUTPUT.Default; aoPass.blendIntensity = .9; composer.addPass(aoPass);
  const lens = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv; float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); } void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; float v = 1.0 - .26 * smoothstep(.25, 1.1, dot(d, d) * 2.2); float g = (hash(vUv * 1200.0) - .5) * .01; gl_FragColor = vec4(c.rgb * v + g, c.a); }' });
  composer.addPass(lens); composer.addPass(new OutputPass()); window.__lens = lens;
}
function draw() { if (composer && aoOn) composer.render(); else renderer.render(scene, camera); }
const sun = new THREE.DirectionalLight(0xfff1dc, 3.2); sun.position.copy(sunDir).multiplyScalar(80); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { near: 5, far: 220, left: -60, right: 60, top: 60, bottom: -60 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -.0003; sun.shadow.normalBias = .04;
const fill = new THREE.DirectionalLight(0xeaf2ff, .5); fill.position.set(-20, 12, 40);
const hemi = new THREE.HemisphereLight(0xdde8ff, 0x6f7a63, .08); scene.add(sun, fill, hemi);
scene.fog = new THREE.Fog(0xc9d2da, 120, 320);
const studioKey = new THREE.DirectionalLight(0xffffff, 2.0); studioKey.position.set(-8, 14, 12); studioKey.castShadow = true; studioKey.shadow.mapSize.set(2048, 2048); Object.assign(studioKey.shadow.camera, { near: 1, far: 60, left: -14, right: 14, top: 16, bottom: -4 }); studioKey.shadow.camera.updateProjectionMatrix();
const studioFill = new THREE.DirectionalLight(0xe8f0ff, .8); studioFill.position.set(10, 6, 10); const studioLights = new THREE.Group(); studioLights.add(studioKey, studioFill); scene.add(studioLights);

/* ------------------------------------------------------------------ World */
const world = new THREE.Group(); scene.add(world);
let wh = null, studioGroup = null, dims = {};
let docking = 0, dockTarget = 0, dockAnimStart = null, dockFrom = 0, camTween = null, pendingLimits = null;
function buildWorld() {
  if (wh) { world.remove(wh.group); dispose(wh.group); wh = null; } if (studioGroup) { world.remove(studioGroup); dispose(studioGroup); studioGroup = null; }
  const ral = C.RAL.find(r => r.id === state.ral); mats.applyDoor(ral.hex, { kind: C.DOORS[state.door].kind, metallic: ral.metallic });
  const studio = state.mode === 'studio';
  wh = buildWarehouse({ mats, st: state, studio }); world.add(wh.group); dims = wh.dims;
  if (studio) { studioGroup = buildStudio({ M, dims }); world.add(studioGroup); }
  scene.background = studio ? new THREE.Color(0xe9eaec) : sky; scene.environment = studio ? studioEnv : skyEnv; scene.fog = studio ? null : new THREE.Fog(0xc9d2da, 120, 320);
  scene.environmentIntensity = studio ? .75 : .55; sun.visible = !studio; fill.visible = !studio; hemi.visible = !studio; studioLights.visible = studio; renderer.toneMappingExposure = studio ? 1.1 : 1.0;
  applyDocking(docking, true);
}
/* docking sequence phases */
function applyDocking(t, force = false) {
  if (!wh) return; const r = wh.rigs;
  const arrive = ease(Math.min(1, t / .38)); const restr = Math.max(0, Math.min(1, (t - .36) / .12)); const door = Math.max(0, Math.min(1, (t - .46) / .2)); const shel = Math.max(0, Math.min(1, (t - .5) / .22)); const lev = Math.max(0, Math.min(1, (t - .66) / .34));
  r.trucks.forEach(tr => { const start = 34, end = .36; const z = start + (end - start) * arrive; const prev = tr.group.position.z; tr.group.position.z = z; tr.animate(prev - z); });
  r.restraints.forEach(x => x.animate(restr)); r.doors.forEach(x => x.animate(door)); r.shelters.forEach(x => x.animate(shel)); r.levellers.forEach(x => x.animate(lev));
  r.lights.forEach(x => x.setOn(door > .3)); r.traffic.forEach(x => x.set(restr > .5 ? 'red' : 'green'));
  $('dockLabel').textContent = t < .05 ? 'Dock frei' : t < .38 ? 'Lkw fährt an' : t < .48 ? 'Wegfahrsicherung aktiv' : t < .68 ? 'Tor öffnet' : t < .98 ? 'Überladebrücke fährt auf' : 'Verladung läuft';
}

/* ------------------------------------------------------------------ Views */
function views() {
  const { W, H, D, w, h, bayX } = dims; const cx = state.mode === 'studio' ? 0 : bayX(state.activeBay); const yc = DOCK_H + h / 2;
  return {
    yard: { pos: [cx + W * .35 + 6, 4.5, 26], tgt: [cx - 2, 2.2, 0], polar: .3, dist: [4, 90] },
    bay: { pos: [cx + 9, 2.6, 6.5], tgt: [cx + .5, yc - .3, .6], polar: .3, dist: [2, 40] },
    inside: { pos: [cx + 1.5, DOCK_H + 1.7, -7.5], tgt: [cx, yc, 0], polar: .3, dist: [1.5, 30] },
    hall: { pos: [cx - 6, DOCK_H + 3.5, -D + 3], tgt: [cx, DOCK_H + 1.5, -4], polar: .3, dist: [2, 60] },
    top: { pos: [cx, 34, 12], tgt: [cx, 0, -2], polar: .05, dist: [10, 120] },
    studio: { pos: [w * 1.2 + 4, 2.4, 9.5], tgt: [0, yc + .2, 0], polar: .25, dist: [3, 30] },
    detail: { pos: [-1.8, DOCK_H + 1.4, 3.4], tgt: [-.5, DOCK_H + 1.1, 0], polar: .25, dist: [1, 30] },
  };
}
function goView(name, instant = false) {
  const all = views(); const v = all[name] || all[state.mode === 'studio' ? 'studio' : 'yard']; state.view = name;
  document.querySelectorAll('#cfgViews button').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  controls.minDistance = .5; controls.maxDistance = 200; controls.minPolarAngle = 0;
  const k = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 1.2 : 1; const pos = v.tgt.map((t, i) => t + (v.pos[i] - t) * k);
  if (instant) { camera.position.fromArray(pos); controls.target.fromArray(v.tgt); controls.minDistance = v.dist[0]; controls.maxDistance = v.dist[1]; controls.minPolarAngle = v.polar; controls.update(); return; }
  pendingLimits = v; camTween = { from: camera.position.clone(), fromT: controls.target.clone(), to: new THREE.Vector3().fromArray(pos), toT: new THREE.Vector3().fromArray(v.tgt), start: performance.now(), dur: 1000 };
}
function setMode(mode) {
  state.mode = mode; document.querySelectorAll('.cfg-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
  $('viewsYard').hidden = mode === 'studio'; $('viewsStudio').hidden = mode !== 'studio';
  buildWorld(); goView(mode === 'studio' ? 'studio' : 'yard', true); history.replaceState(null, '', hash());
}
function setDock(open) { dockTarget = open ? 1 : 0; dockFrom = docking; dockAnimStart = performance.now(); const b = $('dockBtn'); b.querySelector('span').textContent = open ? 'Lkw abfahren' : 'Lkw andocken'; b.classList.toggle('is-open', open); }

/* ------------------------------------------------------------------ Loop */
function resize() { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(wrap); resize();
let overlayDone = false; const T0 = performance.now(); const perf = { samples: [], last: 0, adjusted: false };
function finishLoading() { if (overlayDone || !wh) return; overlayDone = true; controls.update(); draw(); $('cfgLoading').classList.add('done'); const hint = $('cfgHint'); hint.hidden = false; const hide = () => { hint.hidden = true; canvas.removeEventListener('pointerdown', hide); }; canvas.addEventListener('pointerdown', hide); setTimeout(hide, 6000); }
function adaptQuality(now) { if (perf.adjusted) return; if (perf.last) perf.samples.push(now - perf.last); perf.last = now; if (perf.samples.length < 40) return; const avg = perf.samples.slice(5).reduce((a, b) => a + b, 0) / 35; perf.adjusted = true; if (avg > 45) { aoOn = false; renderer.setPixelRatio(1); if (composer) composer.setPixelRatio(1); resize(); } }
const _v = new THREE.Vector3();
function place(el, x, y, z) { _v.set(x, y, z).project(camera); const w = wrap.clientWidth, h = wrap.clientHeight; const px = (_v.x + 1) / 2 * w, py = (1 - _v.y) / 2 * h; const vis = _v.z < 1 && px > 40 && px < w - 40 && py > 70 && py < h - 60; el.hidden = !vis; if (vis) { el.style.left = px + 'px'; el.style.top = py + 'px'; } }
function labels() { const cx = state.mode === 'studio' ? 0 : dims.bayX(state.activeBay); place($('dimLabel'), cx, DOCK_H + dims.h + .55, .1); }
function loop(now) {
  requestAnimationFrame(loop);
  if (camTween) { const k = Math.min(1, (now - camTween.start) / camTween.dur), e = ease(k); camera.position.lerpVectors(camTween.from, camTween.to, e); controls.target.lerpVectors(camTween.fromT, camTween.toT, e); if (k >= 1) { camTween = null; if (pendingLimits) { controls.minDistance = pendingLimits.dist[0]; controls.maxDistance = pendingLimits.dist[1]; controls.minPolarAngle = pendingLimits.polar; pendingLimits = null; } } }
  if (dockAnimStart !== null) { const k = Math.min(1, (now - dockAnimStart) / 9000); docking = dockFrom + (dockTarget - dockFrom) * k; applyDocking(docking); $('dockRange').value = Math.round(docking * 100); if (k >= 1) dockAnimStart = null; }
  if (window.__lens) window.__lens.uniforms.uTime.value = (now % 1000) / 37;
  controls.update(); draw(); labels();
  if (!overlayDone && (assetsReady || now - T0 > 7000)) finishLoading(); if (overlayDone) adaptQuality(now);
  window.__frames = (window.__frames || 0) + 1;
}

/* ------------------------------------------------------------------ Pricing */
function priceDoor() {
  const d = C.DOORS[state.door]; const lines = []; const notes = [];
  const base = C.basePrice(state.door, state.w, state.h); if (!base) return { lines, total: null, notes: [d.priced ? 'Maß außerhalb der Preismatrix' : 'Preis auf Anfrage'], perBay: null };
  const area = state.w * state.h / 1e6;
  lines.push([`${d.label} ${base.W} × ${base.H} mm (Matrixmaß ab ${state.w} × ${state.h})`, base.price]);
  let perBay = base.price;
  const add = (l, p) => { if (p) { lines.push([l, p]); perBay += p; } };
  if (d.kind === 'sectional') {
    const pt = C.PANEL_TYPES[state.panel]; if (pt.pct) add(`${pt.label} (+${pt.pct} %)`, Math.round(base.price * pt.pct / 100));
    if (d.priced === 'hs620') { const l = C.LIFT_620[state.lift620]; if (l.pct) add(`${l.label} (+${l.pct} %)`, Math.round(base.price * l.pct / 100)); }
    else { const l = C.LIFT[state.lift]; if (l.pct) add(`${l.label} (+${l.pct} %)`, Math.round(base.price * l.pct / 100)); if (l.fix) add(l.label, l.fix); }
    if (state.windows !== 'none') { const win = C.WINDOWS[state.windows]; const n = Math.max(1, Math.min(4, Math.floor(state.w / 1050))); add(`${n} × ${win.label}`, win.price * n); }
    if (state.fullvision !== 'none') { const fv = C.FULLVISION[state.fullvision]; add(`${fv.label}, ${(state.w / 1000).toFixed(2)} m`, Math.round(fv.perM * state.w / 1000)); }
    if (state.wicket !== 'none') { add(C.WICKET[state.wicket].label, C.WICKET[state.wicket].price); add(C.WICKET_LOCK[state.wicketLock].label, C.WICKET_LOCK[state.wicketLock].price); }
    if (state.ral !== '9002' && state.ral !== '7021') { const r = C.RAL.find(x => x.id === state.ral); add(`RAL ${r.id} ${r.name} außen (${r.metallic ? 96 : 34} €/m²)`, Math.round((r.metallic ? 96 : 34) * area)); }
    else if (d.priced !== 'hs620') add('RAL 9002/7021 Paneel 500 (7 €/m²)', Math.round(7 * area));
    if (state.grille) add(C.MISC.grille.label, C.MISC.grille.price);
  }
  if (d.priced !== 'hs620') { const op = C.OPERATION[state.operation]; if (op.price) add(op.label, op.price); }
  const lk = C.LOCKS[state.lock]; if (lk.price) add(lk.label, lk.price);
  state.safety.forEach(k => { const s = C.SAFETY[k]; if (s && s.price) add(s.label, s.price); });
  state.controls.forEach(k => { const s = C.CONTROLS[k]; if (s && s.price) add(s.label, s.price); });
  if (state.numbers) add('Dock-Ziffer schwarz', 31.37);
  if (state.trafficLight) add(C.ACCESSORIES.trafficLight.label, C.ACCESSORIES.trafficLight.price);
  notes.push(`Listenpreis ${base.rev}, gültig ab ${base.validFrom.split('-').reverse().join('.')}, netto ab Werk, ohne Montage und MwSt.`);
  return { lines, perBay, total: perBay * state.bays, notes };
}
function priceMandoor() {
  if (state.mandoor === 'none') return null; const t = C.PRICES.mandoor; const row = t.rows[String(state.mandoorH)]; const i = t.widths.indexOf(state.mandoorW); if (!row || i < 0) return null;
  const base = (state.mandoorThermal ? row.thermal : row.plain)[i]; const lock = C.MANDOOR.locks[state.mandoorLock]; return { lines: [[`Nebentür 604NG ${state.mandoorW} × ${state.mandoorH} mm${state.mandoorThermal ? ', mit Thermobrücke' : ''}`, base], [lock.label, lock.price], ['Türschließer mit Stoppfunktion', C.MANDOOR.closer]], total: base + lock.price + C.MANDOOR.closer };
}
function dockItems() {
  const items = [];
  if (state.leveller !== 'none') items.push(`${C.LEVELLERS[state.leveller].label}, ${state.levellerLen} × ${state.levellerW} mm, ${C.LEVELLER_CAP[state.levellerCap].label}`);
  if (state.shelter !== 'none') items.push(C.SHELTERS[state.shelter].label);
  items.push(C.BUMPERS[state.bumper].label + ' (Paar)');
  if (state.restraint !== 'none') items.push(C.RESTRAINTS[state.restraint].label);
  if (state.light !== 'none') items.push(C.LIGHTS[state.light].label);
  if (state.bollards) items.push(C.ACCESSORIES.bollards.label); if (state.wheelGuides) items.push(C.ACCESSORIES.wheelGuides.label);
  items.push(C.DOCK_CONTROL[state.dockControl].label);
  return items;
}

/* ------------------------------------------------------------------ UI */
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const chip = (c, id, label, on, title) => { const b = el('button', 'cfg-chip', label); b.type = 'button'; b.dataset.id = id; b.setAttribute('aria-pressed', String(on)); if (title) b.title = title; c.appendChild(b); return b; };
const swatch = (c, id, label, css, on) => { const b = el('button', 'cfg-swatch', `<span class="dot" style="background:${css}"></span><small>${label}</small>`); b.type = 'button'; b.dataset.id = id; b.setAttribute('aria-pressed', String(on)); c.appendChild(b); return b; };
const card = (c, id, title, desc, on, icon = '') => { const b = el('button', 'cfg-card', `${icon}<span><strong>${title}</strong><small>${desc}</small></span>`); b.type = 'button'; b.dataset.id = id; b.setAttribute('aria-pressed', String(on)); c.appendChild(b); return b; };
const ICON = {
  sectional: '<svg viewBox="0 0 48 36"><rect x="3" y="3" width="42" height="30" rx="1"/><path d="M3 11h42M3 19h42M3 27h42"/></svg>', rollup: '<svg viewBox="0 0 48 36"><rect x="3" y="3" width="42" height="6"/><path d="M8 9v24M40 9v24M12 15h24M12 20h24M12 25h24"/></svg>',
  roller: '<svg viewBox="0 0 48 36"><rect x="3" y="3" width="42" height="7"/><path d="M6 10v23h36V10"/><path d="M6 14h36M6 18h36M6 22h36M6 26h36M6 30h36"/></svg>', strips: '<svg viewBox="0 0 48 36"><rect x="3" y="3" width="42" height="4"/><path d="M8 7v26M14 7v26M20 7v26M26 7v26M32 7v26M38 7v26"/></svg>',
};
function renderUI() {
  const d = C.DOORS[state.door];
  const dc = $('optDoor'); dc.innerHTML = ''; C.DOOR_ORDER.forEach(id => { const x = C.DOORS[id]; card(dc, id, x.label, x.priced ? 'Listenpreis' : 'Preis auf Anfrage', state.door === id, ICON[x.kind]); });
  $('doorFacts').innerHTML = d.facts.map(f => `<li>${f}</li>`).join(''); $('doorDesc').textContent = d.desc;
  $('inpW').value = state.w; $('inpH').value = state.h; $('inpW').min = d.w[0]; $('inpW').max = d.w[1]; $('inpH').min = d.h[0]; $('inpH').max = d.h[1];
  $('sizeNote').textContent = `${d.label}: Breite ${d.w[0]} bis ${d.w[1]} mm, Höhe ${d.h[0]} bis ${d.h[1]} mm. Preis nach nächstem Matrixmaß.`;
  const sp = $('optSize'); sp.innerHTML = ''; [[2500, 2750], [3000, 3250], [3500, 3500], [4000, 4500]].forEach(([w, h]) => { if (w >= d.w[0] && w <= d.w[1] && h >= d.h[0] && h <= d.h[1]) chip(sp, `${w}x${h}`, `${w} × ${h}`, state.w === w && state.h === h); });
  const sec = d.kind === 'sectional'; $('sectionalOpts').hidden = !sec;
  const pn = $('optPanel'); pn.innerHTML = ''; Object.entries(C.PANEL_TYPES).forEach(([id, v]) => chip(pn, id, v.label + (v.pct ? ` +${v.pct} %` : ''), state.panel === id));
  const lf = $('optLift'); lf.innerHTML = ''; if (d.priced === 'hs620') Object.entries(C.LIFT_620).forEach(([id, v]) => chip(lf, id, v.label + (v.pct ? ` +${v.pct} %` : ''), state.lift620 === id)); else Object.entries(C.LIFT).forEach(([id, v]) => chip(lf, id, v.label + (v.pct ? ` +${v.pct} %` : v.fix ? ` +${v.fix} €` : ''), state.lift === id));
  const rc = $('optRal'); rc.innerHTML = ''; C.RAL.forEach(r => swatch(rc, r.id, `RAL ${r.id}<br>${r.name}${r.std ? '' : ''}`, r.hex, state.ral === r.id));
  const wn = $('optWindows'); wn.innerHTML = ''; Object.entries(C.WINDOWS).forEach(([id, v]) => chip(wn, id, v.label + (v.price ? ` · ${C.eur(v.price)}/St.` : ''), state.windows === id));
  const fv = $('optFullvision'); fv.innerHTML = ''; Object.entries(C.FULLVISION).forEach(([id, v]) => chip(fv, id, v.label + (v.perM ? ` · ${C.eur(v.perM)}/m` : ''), state.fullvision === id));
  const wk = $('optWicket'); wk.innerHTML = ''; Object.entries(C.WICKET).forEach(([id, v]) => chip(wk, id, v.label + (v.price ? ` · ${C.eur(v.price)}` : ''), state.wicket === id));
  const wl = $('optWicketLock'); wl.innerHTML = ''; Object.entries(C.WICKET_LOCK).forEach(([id, v]) => chip(wl, id, v.label + (v.price ? ` · ${C.eur(v.price)}` : ''), state.wicketLock === id)); $('wicketLockRow').hidden = state.wicket === 'none';
  const op = $('optOperation'); op.innerHTML = ''; Object.entries(C.OPERATION).forEach(([id, v]) => { if (d.priced === 'hs620' && id !== 'motor') return; chip(op, id, v.label + (v.price ? ` · ${C.eur(v.price)}` : ''), state.operation === id); });
  const lk = $('optLock'); lk.innerHTML = ''; Object.entries(C.LOCKS).forEach(([id, v]) => chip(lk, id, v.label + (v.price ? ` · ${C.eur(v.price)}` : ''), state.lock === id));
  const sf = $('optSafety'); sf.innerHTML = ''; Object.entries(C.SAFETY).forEach(([id, v]) => chip(sf, id, v.label + (v.price ? ` · ${C.eur(v.price)}` : ' · Serie'), state.safety.includes(id)));
  const ct = $('optControls'); ct.innerHTML = ''; Object.entries(C.CONTROLS).forEach(([id, v]) => chip(ct, id, v.label + ` · ${C.eur2(v.price)}`, state.controls.includes(id)));
  ['numbers', 'grille', 'trafficLight', 'bollards', 'wheelGuides', 'mandoorThermal'].forEach(k => { const i = $('opt_' + k); if (i) i.checked = !!state[k]; });
  // dock
  const lv = $('optLeveller'); lv.innerHTML = ''; Object.entries(C.LEVELLERS).forEach(([id, v]) => card(lv, id, v.label, v.desc || 'Ohne Rampe', state.leveller === id));
  const ll = $('optLevellerLen'); ll.innerHTML = ''; C.LEVELLER_SIZES.lengths.forEach(v => chip(ll, String(v), `${v} mm`, state.levellerLen === v)); const lw = $('optLevellerW'); lw.innerHTML = ''; C.LEVELLER_SIZES.widths.forEach(v => chip(lw, String(v), `${v} mm`, state.levellerW === v));
  const lc = $('optLevellerCap'); lc.innerHTML = ''; Object.entries(C.LEVELLER_CAP).forEach(([id, v]) => chip(lc, id, v.label, state.levellerCap === id)); $('levellerRows').hidden = state.leveller === 'none';
  const sh = $('optShelter'); sh.innerHTML = ''; Object.entries(C.SHELTERS).forEach(([id, v]) => card(sh, id, v.label, v.desc || 'Offene Verladestelle', state.shelter === id));
  const bp = $('optBumper'); bp.innerHTML = ''; Object.entries(C.BUMPERS).forEach(([id, v]) => swatch(bp, id, v.label, v.col, state.bumper === id));
  $('bumperDesc').textContent = C.BUMPERS[state.bumper].desc;
  const rs = $('optRestraint'); rs.innerHTML = ''; Object.entries(C.RESTRAINTS).forEach(([id, v]) => chip(rs, id, v.label, state.restraint === id, v.desc));
  const lt = $('optLight'); lt.innerHTML = ''; Object.entries(C.LIGHTS).forEach(([id, v]) => chip(lt, id, v.label, state.light === id, v.desc));
  const dcc = $('optDockControl'); dcc.innerHTML = ''; Object.entries(C.DOCK_CONTROL).forEach(([id, v]) => chip(dcc, id, v.label, state.dockControl === id, v.desc)); $('dockControlDesc').textContent = C.DOCK_CONTROL[state.dockControl].desc;
  // building
  const by = $('optBays'); by.innerHTML = ''; for (let i = 1; i <= 6; i++) chip(by, String(i), i === 1 ? '1 Dock' : `${i} Docks`, state.bays === i);
  const ab = $('optActiveBay'); ab.innerHTML = ''; for (let i = 0; i < state.bays; i++) chip(ab, String(i), `Dock ${i + 1}`, state.activeBay === i); $('activeBayRow').hidden = state.bays < 2;
  const tk = $('optTruck'); tk.innerHTML = ''; Object.entries(C.TRUCKS).forEach(([id, v]) => chip(tk, id, v.label, state.truck === id));
  const tb = $('optTruckBays'); tb.innerHTML = ''; [['one', 'Nur am gewählten Dock'], ['all', 'An allen Docks']].forEach(([id, l]) => chip(tb, id, l, state.truckBays === id));
  const fa = $('optFacade'); fa.innerHTML = ''; C.FACADES.forEach(f => swatch(fa, f.id, f.name, f.hex, state.facade === f.id));
  const il = $('optInteriorLight'); il.innerHTML = ''; Object.entries(C.INTERIOR_LIGHTS).forEach(([id, v]) => chip(il, id, v.label, state.interiorLight === id, v.desc));
  const md = $('optMandoor'); md.innerHTML = ''; [['none', 'Keine Nebentür'], ['std', 'Nebentür 604NG']].forEach(([id, l]) => chip(md, id, l, state.mandoor === id)); $('mandoorRows').hidden = state.mandoor === 'none';
  const mw = $('optMandoorW'); mw.innerHTML = ''; C.MANDOOR.widths.forEach(v => chip(mw, String(v), `${v} mm`, state.mandoorW === v)); const mh = $('optMandoorH'); mh.innerHTML = ''; C.MANDOOR.heights.forEach(v => chip(mh, String(v), `${v} mm`, state.mandoorH === v));
  const ml = $('optMandoorLock'); ml.innerHTML = ''; Object.entries(C.MANDOOR.locks).forEach(([id, v]) => chip(ml, id, v.label + (v.price ? ` · ${C.eur(v.price)}` : ''), state.mandoorLock === id));
  const pr = $('optPreset'); pr.innerHTML = ''; C.PRESETS.forEach(v => chip(pr, v.id, v.label, Object.entries(v.patch).every(([k, val]) => state[k] === val)));
  renderSummary();
}
function renderSummary() {
  const d = C.DOORS[state.door]; const p = priceDoor(); const md = priceMandoor(); const items = dockItems();
  const ral = C.RAL.find(r => r.id === state.ral);
  const rows = [['Tor', `${d.label}, ${state.w} × ${state.h} mm, RAL ${ral.id} ${ral.name}`], ['Docks', `${state.bays} × ${C.TRUCKS[state.truck].label}`], ['Überladebrücke', state.leveller === 'none' ? 'keine' : `${C.LEVELLERS[state.leveller].label}, ${state.levellerLen} × ${state.levellerW} mm`], ['Torabdichtung', state.shelter === 'none' ? 'keine' : C.SHELTERS[state.shelter].label], ['Puffer', C.BUMPERS[state.bumper].label], ['Sicherheit', [state.restraint !== 'none' ? C.RESTRAINTS[state.restraint].label : null, state.light !== 'none' ? C.LIGHTS[state.light].label : null, state.trafficLight ? 'Ampel' : null].filter(Boolean).join(', ') || 'Serie'], ['Steuerung', C.DOCK_CONTROL[state.dockControl].label]];
  if (md) rows.push(['Nebentür', `604NG ${state.mandoorW} × ${state.mandoorH} mm`]);
  $('summary').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const box = $('priceBox'); let html = '';
  if (p.total != null) {
    html += `<div class="cfg-price-total"><span>Listenpreis Tore, ${state.bays} × </span><strong>${C.eur(p.total)}</strong></div><ul class="cfg-price-lines"><li class="is-head"><span>Je Tor</span><span>${C.eur(p.perBay)}</span></li>${p.lines.map(([l, v]) => `<li><span>${l}</span><span>${C.eur(v)}</span></li>`).join('')}</ul>`;
    if (md) html += `<ul class="cfg-price-lines"><li class="is-head"><span>Nebentür</span><span>${C.eur(md.total)}</span></li>${md.lines.map(([l, v]) => `<li><span>${l}</span><span>${C.eur(v)}</span></li>`).join('')}</ul>`;
    html += `<p class="cfg-price-note">${p.notes.join(' ')}</p>`;
  } else html += `<div class="cfg-price-total"><span>Tor</span><strong>auf Anfrage</strong></div><p class="cfg-price-note">${p.notes.join(' ')}</p>`;
  html += `<div class="cfg-price-quote"><span>Dockausrüstung, Angebot nach Aufmaß</span><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  box.innerHTML = html;
  const grand = p.total != null ? p.total + (md ? md.total : 0) : null;
  $('stickyPrice').textContent = grand != null ? C.eur(grand) + ' + Dock' : 'auf Anfrage'; $('stickySummary').textContent = `${d.short} ${state.w} × ${state.h} · ${state.bays} Docks · ${C.SHELTERS[state.shelter].label.split(' ')[0]}`;
  $('dimText').textContent = `${state.w} × ${state.h} mm`; $('stageModel').textContent = d.label; $('stageSub').textContent = `${state.bays} Docks · ${C.LEVELLERS[state.leveller].label} · ${C.SHELTERS[state.shelter].label}`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + (grand != null ? `\nListenpreis Tore: ${C.eur(grand)}` : '') + '\nDockausrüstung: ' + items.join('; ') + `\nLink: ${location.origin}${location.pathname}${hash()}`;
  const href = `kontakt.html?konfiguration=${encodeURIComponent(text)}`; $('requestBtn').href = href; $('stickyRequest').href = href;
}
function update(patch, rebuild = true) {
  Object.assign(state, patch); normalise(); if (rebuild) { buildWorld(); goView(state.view, true); } renderUI(); history.replaceState(null, '', hash());
}
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-id]'); if (!b) return; const id = b.dataset.id, box = b.parentElement.id;
  const num = v => parseInt(v, 10);
  const map = { optDoor: () => update({ door: id }), optPanel: () => update({ panel: id }), optLift: () => update(state.door === 'hs620' ? { lift620: id } : { lift: id }), optRal: () => update({ ral: id }), optWindows: () => update({ windows: id }), optFullvision: () => update({ fullvision: id }),
    optWicket: () => update({ wicket: id }), optWicketLock: () => update({ wicketLock: id }, false), optOperation: () => update({ operation: id }), optLock: () => update({ lock: id }, false),
    optSafety: () => update({ safety: state.safety.includes(id) ? state.safety.filter(x => x !== id) : [...state.safety, id] }, false), optControls: () => update({ controls: state.controls.includes(id) ? state.controls.filter(x => x !== id) : [...state.controls, id] }, false),
    optLeveller: () => update({ leveller: id }), optLevellerLen: () => update({ levellerLen: num(id) }), optLevellerW: () => update({ levellerW: num(id) }), optLevellerCap: () => update({ levellerCap: id }, false), optShelter: () => update({ shelter: id }), optBumper: () => update({ bumper: id }),
    optRestraint: () => update({ restraint: id }), optLight: () => update({ light: id }), optDockControl: () => update({ dockControl: id }, false), optBays: () => update({ bays: num(id) }), optActiveBay: () => { update({ activeBay: num(id) }); goView(state.view); }, optTruck: () => update({ truck: id }), optTruckBays: () => update({ truckBays: id }),
    optFacade: () => update({ facade: id }), optInteriorLight: () => update({ interiorLight: id }), optMandoor: () => update({ mandoor: id }), optMandoorW: () => update({ mandoorW: num(id) }), optMandoorH: () => update({ mandoorH: num(id) }), optMandoorLock: () => update({ mandoorLock: id }, false),
    optSize: () => { const [w, h] = id.split('x').map(num); update({ w, h }); }, optPreset: () => update(C.PRESETS.find(p => p.id === id).patch) };
  if (map[box]) map[box]();
});
['numbers', 'grille', 'trafficLight', 'bollards', 'wheelGuides', 'mandoorThermal'].forEach(k => { const i = $('opt_' + k); if (i) i.addEventListener('change', e => update({ [k]: e.target.checked }, k !== 'grille' && k !== 'mandoorThermal')); });
function sizeInput(id, key) { const e = $(id); const commit = () => { let v = parseInt(e.value, 10); if (!Number.isFinite(v)) v = state[key]; update({ [key]: v }); }; e.addEventListener('change', commit); e.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } }); }
sizeInput('inpW', 'w'); sizeInput('inpH', 'h');
$('resetBtn').addEventListener('click', () => { history.replaceState(null, '', location.pathname); location.reload(); });
$('dockBtn').addEventListener('click', () => setDock(dockTarget === 0));
$('dockRange').addEventListener('input', e => { dockAnimStart = null; docking = dockTarget = e.target.value / 100; applyDocking(docking); $('dockBtn').querySelector('span').textContent = docking > .5 ? 'Lkw abfahren' : 'Lkw andocken'; });
document.querySelectorAll('.cfg-views button').forEach(b => b.addEventListener('click', () => goView(b.dataset.view)));
document.querySelectorAll('.cfg-tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
document.querySelectorAll('.cfg-step-head').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('is-collapsed')));
$('shareBtn').addEventListener('click', async () => { const url = location.origin + location.pathname + hash(); try { await navigator.clipboard.writeText(url); } catch (err) { prompt('Link:', url); } $('shareNote').hidden = false; setTimeout(() => { $('shareNote').hidden = true; }, 3500); });
$('saveImage').addEventListener('click', () => { draw(); const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/jpeg', .92); a.download = `loading-systems-dock-${state.door}-${state.w}x${state.h}.jpg`; a.click(); });

/* ------------------------------------------------------------------ Go */
window.__cfg = { camera, controls, state, scene, world, dims: () => dims, update, setMode, goView, setDock, applyDocking, THREE, price: priceDoor };
buildWorld(); renderUI(); setMode(state.mode === 'studio' ? 'studio' : 'yard'); goView(q.get('view') || (state.mode === 'studio' ? 'studio' : 'yard'), true);
if (q.get('dock') === '1') { docking = dockTarget = 1; applyDocking(1); $('dockRange').value = 100; $('dockBtn').querySelector('span').textContent = 'Lkw abfahren'; }
history.replaceState(null, '', location.pathname + location.search + hash());
(async () => { try { await renderer.compileAsync(scene, camera); } catch (e) { } loop(performance.now()); })();
