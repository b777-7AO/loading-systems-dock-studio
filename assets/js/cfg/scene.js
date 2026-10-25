/* Loading Systems · Dock Studio scene: warehouse with N loading bays, doors, dock levellers, shelters, bumpers, restraints, lights, trucks.
   Units metres. X along the facade, Y up, +Z = yard (outside). Yard level y = 0, warehouse floor y = DOCK_H. Facade front face at z = 0. */
import * as THREE from 'three';
import { DOORS, LEVELLERS, SHELTERS, BUMPERS, TRUCKS, WINDOWS, FULLVISION, LIFT, LIFT_620 } from './catalog.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DOCK_H = 1.2;      // dock height above yard
export const PITCH = 4.6;       // bay pitch
export const WALL_T = .3;
export const HALL_D = 24;       // hall depth
export const HALL_H = 10;       // eaves height above warehouse floor
export const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const QUALITY = { mobile: false };

export const box = (w, h, d, mat, x = 0, y = 0, z = 0, opt = {}) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  m.castShadow = opt.shadow !== false; m.receiveShadow = opt.receive !== false; return m;
};
const rbox = (w, h, d, r, mat, x = 0, y = 0, z = 0, opt = {}) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); m.position.set(x, y, z); m.castShadow = opt.shadow !== false; m.receiveShadow = opt.receive !== false; return m;
};
const cyl = (r, h, mat, x = 0, y = 0, z = 0, seg = 16, opt = {}) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y, z); m.castShadow = opt.shadow !== false; m.receiveShadow = true; return m; };
const sph = (r, mat, x = 0, y = 0, z = 0, seg = 16) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
export const plane = (w, h, mat, x, y, z, rotX = -Math.PI / 2) => {
  const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  const m = new THREE.Mesh(g, mat); m.rotation.x = rotX; m.position.set(x, y, z); m.receiveShadow = true; return m;
};
/* vertical wall in XY with rectangular openings, extruded along -Z by t; placed with its left edge at x=0, bottom at y=0, front face at z=0 */
export function wall(w, h, t, openings, mat) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, h); s.closePath();
  openings.forEach(o => { const p = new THREE.Path(); p.moveTo(o.x, o.y); p.lineTo(o.x + o.w, o.y); p.lineTo(o.x + o.w, o.y + o.h); p.lineTo(o.x, o.y + o.h); p.closePath(); s.holes.push(p); });
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
/* merge every static single-material mesh below `root` into one mesh per material (dynamic sub-trees are left alone) */
export function mergeStatic(root, { keepDynamic = true } = {}) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const buckets = new Map(); const remove = []; const rel = new THREE.Matrix4();
  const isDynamic = o => { if (!keepDynamic) return false; for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return true; return false; };
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material) || o === root || isDynamic(o) || o.userData.noMerge) return;
    const key = o.material.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
    buckets.get(key).geos.push(g); remove.push(o);
  });
  remove.forEach(o => { o.parent.remove(o); if (!o.userData.shared) o.geometry.dispose(); });
  let n = 0; buckets.forEach(b => { const merged = mergeGeometries(b.geos, false); b.geos.forEach(g => g.dispose()); if (!merged) { console.warn('merge failed', b.mat.name, b.geos.length); return; } const m = new THREE.Mesh(merged, b.mat); m.castShadow = b.cast; m.receiveShadow = b.recv; root.add(m); n++; });
  return { buckets: buckets.size, merged: n, removed: remove.length };
}
export function dispose(obj) { obj.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
/* Blender hardware library (assets/models/door_parts.glb): name -> Object3D template */
export const PARTS = {};
export function registerParts(gltfScene) {
  gltfScene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.shared = true; o.material.side = THREE.FrontSide; } });
  gltfScene.children.forEach(c => { c.position.set(0, 0, 0); PARTS[c.name] = c; });
}
export function part(name, x = 0, y = 0, z = 0, opt = {}) {
  const t = PARTS[name]; if (!t) return null; const o = t.clone(); o.position.set(x, y, z); if (opt.rotY) o.rotation.y = opt.rotY; if (opt.rotX) o.rotation.x = opt.rotX; if (opt.scale) o.scale.set(opt.scale[0], opt.scale[1], opt.scale[2]);
  o.traverse(m => { if (m.isMesh) { m.userData.shared = true; if (opt.shadow === false) m.castShadow = false; } }); return o;
}
/* Blender vehicle library (assets/models/vehicles.glb): roots 'semi' (trailer + tractor), 'rigid', 'van'; wheels are named wheel_* with the axle on X */
export const VEHICLES = {};
export function registerVehicles(gltfScene, M, { rename = {} } = {}) {
  gltfScene.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.userData.shared = true;
    const m = M.vehicleMap[o.material.name]; if (m) o.material = m;
    else if (o.material.map) { o.material.envMapIntensity = 1.0; o.material.metalness = .25; o.material.roughness = 1.0; }   // AI-scanned vehicle: keep its PBR textures, tame the metallic map (painted panels, not chrome)
    if (/decal/.test(o.name) || o.material === M.decalDark) { o.material = M.decalDark; o.castShadow = false; o.receiveShadow = false; o.renderOrder = 2; }
  });
  gltfScene.children.forEach(c => { c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); VEHICLES[rename[c.name] || c.name] = c; });
}
/* finger-safe sandwich panel: tongue on top, groove below, extruded along X. Front face at +z (z = t), back face at z = 0, bottom at y = 0.
   ExtrudeGeometry maps the big faces to U = height (m), V = width (m), which the micro-profile normal map relies on */
export function panelGeometry(w, H, t = .04) {
  const r = t / 2, s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0, H); s.absarc(t / 2, H, r, Math.PI, 0, true); s.lineTo(t, 0); s.absarc(t / 2, 0, r, 0, Math.PI, false); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 10 }); g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0);
  return g;
}

/* ---------------------------------------------------------------- Door leaf per type */
function sectionalLeaf(w, h, ph, st, M, d) {
  const g = new THREE.Group(); const n = Math.max(2, Math.round(h / ph)); const H = h / n; const parts = [];
  const t = st.panel === 'iso80' ? .08 : .04;
  const faceMat = d.surface === 'micro' ? M.doorMicro : M.door;
  const fvIndex = st.fullvision !== 'none' ? n - 2 : -1;
  // windows sit in the panel around eye height (the LS photos show them at ~60 % of the door height)
  let winIndex = st.windows !== 'none' ? Math.max(1, Math.min(n - 2, Math.round(h * .70 / H - .5))) : -1; if (winIndex === fvIndex) winIndex--;
  const numIndex = st.numbers && st.numberStyle !== 'plate' ? Math.max(0, Math.min(n - 1, Math.round(h * .30 / H - .5))) : -1;
  const nCentre = Math.max(0, Math.round(w / 1.2) - 1);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group(); p.userData.dynamic = true;
    if (i === fvIndex) {
      const fv = FULLVISION[st.fullvision]; const nb = Math.max(2, Math.round(w / .6));
      p.add(box(w, .05, t + .005, M.galv, 0, H / 2 - .025, t / 2)); p.add(box(w, .05, t + .005, M.galv, 0, -H / 2 + .025, t / 2));
      for (let k = 0; k <= nb; k++) p.add(box(.045, H - .1, t + .005, M.galv, -w / 2 + k * (w / nb), 0, t / 2));
      p.add(box(w - .06, H - .1, .01, fv.glass === 'mesh' ? M.mesh : M.glass, 0, 0, t / 2, { shadow: false }));
    } else {
      const body = new THREE.Mesh(panelGeometry(w, H, t), [M.doorEdge, faceMat]); body.position.set(0, -H / 2, -t / 2); body.castShadow = true; body.receiveShadow = true; p.add(body);
      if (i === winIndex) {
        const win = WINDOWS[st.windows]; const count = Math.max(1, Math.min(4, st.windowCount || 1, Math.floor(w / .9))); const gap = Math.min(1.3, (w - .5) / count);
        for (let k = 0; k < count; k++) {
          const x = -gap * (count - 1) / 2 + gap * k; const frame = part(win.shape === 'oval' ? 'window_oval' : 'window_rect', x, 0, t / 2 - .01);
          if (frame) p.add(frame); p.add(box(win.w + .06, win.h + .06, t + .012, M.plastic, x, 0, 0, { shadow: false }));
          const glass = win.shape === 'oval' ? new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .012, 32).scale(win.w / 2, 1, win.h / 2), M.glassDark) : box(win.w, win.h, .012, M.glassDark, 0, 0, 0, { shadow: false });
          if (win.shape === 'oval') glass.rotation.x = Math.PI / 2; glass.position.set(x, 0, t / 2 - .01); glass.castShadow = false; p.add(glass);
        }
      }
      if (i === numIndex && st.bayNo != null) { const dg = digitDecal(st.bayNo, H * .92); dg.position.set(w * .12, 0, t / 2 + .003); p.add(dg); }
      // hinges with rollers at both edges, centre hinges along the joint (on the inside face)
      if (i < n - 1) { const y = H / 2; const l = part('side_hinge', -w / 2 + .03, y, -t / 2 - .002, { rotY: Math.PI }); const r = part('side_hinge', w / 2 - .03, y, -t / 2 - .002, { rotY: Math.PI });
        if (l) p.add(l); if (r) { r.scale.x = -1; p.add(r); } for (let k = 1; k <= nCentre; k++) { const c = part('centre_hinge', -w / 2 + k * (w / (nCentre + 1)), y, -t / 2 - .002, { rotY: Math.PI }); if (c) p.add(c); } }
    }
    p.position.y = H * i + H / 2; g.add(p); parts.push({ p, y0: H * i + H / 2 });
  }
  // bottom panel: seal profile, flush handle, Loading Systems logo plate; wicket outline
  const bottom = parts[0].p;
  const seal = part('bottom_seal', 0, -H / 2 + .01, 0, { scale: [w, 1, 1], shadow: false }); if (seal) bottom.add(seal); else bottom.add(box(w, .03, .05, M.black, 0, -H / 2 + .015, 0, { shadow: false }));
  const handle = part('flush_handle', w * .22, 0, t / 2 + .002); if (handle) { handle.position.y = Math.min(H / 2 - .1, .95 - H / 2); bottom.add(handle); }
  const lp = part('logo_plate', w / 2 - .32, -H / 2 + .14, t / 2 + .004, { shadow: false }); if (lp) bottom.add(lp);
  if (st.wicket && st.wicket !== 'none') {
    const wd = .9, hd = Math.min(2.0, h - .3), x = Math.min(w / 2 - .7, .9);
    g.add(box(.012, hd, t + .02, M.dark, x - wd / 2, hd / 2, t / 2 - .01, { shadow: false })); g.add(box(.012, hd, t + .02, M.dark, x + wd / 2, hd / 2, t / 2 - .01, { shadow: false })); g.add(box(wd, .012, t + .02, M.dark, x, hd, t / 2 - .01, { shadow: false }));
    g.add(box(.03, .14, .03, M.steel, x - wd / 2 + .1, 1.05, t / 2 + .02, { shadow: false }));
  }
  parts.forEach(({ p }) => mergeStatic(p, { keepDynamic: false }));
  g.userData.parts = parts; g.userData.H = H; g.userData.n = n; return g;
}
/* 640PR: smooth PVC curtain with two square vision windows and a bottom profile; the curtain is clipped at the head box while it travels up */
function curtainLeaf(w, h, M, clipY) {
  const g = new THREE.Group(); const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), M.curtainFabric.clone());
  sheet.material.side = THREE.DoubleSide; sheet.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)]; sheet.material.clipShadows = true;
  sheet.position.y = h / 2; sheet.castShadow = true; sheet.receiveShadow = true; g.add(sheet);
  const winMat = M.pvc.clone(); winMat.clippingPlanes = sheet.material.clippingPlanes; const ww = Math.min(.7, w * .22), wh = ww * .8, wy = Math.min(h - .6, Math.max(1.3, h * .5));
  const gap = Math.min(1.3, w * .4);
  [-1, 1].forEach(s => { g.add(box(ww, wh, .012, winMat, s * gap / 2, wy, .006, { shadow: false })); g.add(box(ww + .06, .03, .014, M.black, s * gap / 2, wy + wh / 2 + .015, .006, { shadow: false })); g.add(box(ww + .06, .03, .014, M.black, s * gap / 2, wy - wh / 2 - .015, .006, { shadow: false })); g.add(box(.03, wh + .06, .014, M.black, s * gap / 2 - ww / 2 - .015, wy, .006, { shadow: false })); g.add(box(.03, wh + .06, .014, M.black, s * gap / 2 + ww / 2 + .015, wy, .006, { shadow: false })); });
  g.add(box(w, .09, .05, M.alu, 0, .045, 0, { shadow: false })); g.add(box(w, .03, .04, M.black, 0, .0, 0, { shadow: false }));   // bottom profile + soft edge
  g.userData.h = h; return g;
}
/* fire roller: galvanised steel slats (stepped boxes) that run up into the hood */
function slatLeaf(w, h, M, clipY) {
  const g = new THREE.Group(); const sh = .11; const n = Math.ceil(h / sh); const mat = M.rollerSlats.clone(); mat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)]; mat.clipShadows = true;
  const slats = new THREE.Group();
  for (let i = 0; i < n; i++) { slats.add(box(w, sh - .008, .022, mat, 0, i * sh + sh / 2, (i % 2) * .004)); slats.add(box(w, .012, .03, mat, 0, i * sh + sh, .004, { shadow: false })); }
  mergeStatic(slats, { keepDynamic: false }); g.add(slats);
  g.add(box(w + .04, .08, .06, M.galvDark, 0, .04, 0));
  g.userData.h = h; return g;
}
function stripsLeaf(w, h, M) {
  const g = new THREE.Group(); const sw = .3, n = Math.round(w / (sw * .75));
  for (let i = 0; i < n; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, h), M.pvc); s.position.set(-w / 2 + i * (w / (n - 1)), h / 2, (i % 2) * .012); s.castShadow = false; g.add(s); }
  g.add(box(w + .1, .12, .12, M.galv, 0, h + .06, 0));
  return g;
}

/* ---------------------------------------------------------------- Door rig with tracks + animate(t) */
export function buildDoor({ M, st, w, h }) {
  const d = DOORS[st.door]; const g = new THREE.Group(); g.position.y = DOCK_H; const zL = -WALL_T - .06;
  let animate = () => {};
  const hl = Math.min(d.priced === 'hs620' ? { SL: 0, HL750: .75, HL1370: 1.37, HL2000: 2.0, VL: 99 }[st.lift620 || 'SL'] : (LIFT[st.lift] || LIFT.normal).hl, HALL_H - h - .6);
  const vertical = hl >= 99;
  // outside reveal: galvanised angle frame around the opening (as on the LS reference photos)
  g.add(box(w + .16, .08, .05, M.galv, 0, h + .04, -.02, { shadow: false }));
  [-1, 1].forEach(s => g.add(box(.08, h + .08, .05, M.galv, s * (w / 2 + .04), (h + .08) / 2, -.02, { shadow: false })));
  if (d.kind === 'sectional') {
    const leaf = sectionalLeaf(w, h, d.panel, st, M, d); leaf.position.set(0, 0, zL); leaf.userData.dynamic = true; g.add(leaf);
    const parts = leaf.userData.parts, H = leaf.userData.H;
    const R = vertical ? 0 : .42, Ht = h + .12 + (vertical ? h : hl);
    const heavy = d.priced === 'hs620';   // 620NG: self-supporting galvanised frame columns, FU motor at the shaft
    [-1, 1].forEach(s => {
      g.add(box(heavy ? .14 : .06, Ht + .3, heavy ? .16 : .07, M.galv, s * (w / 2 + (heavy ? .1 : .07)), (Ht + .3) / 2, zL - .06));
      if (!vertical) g.add(box(.06, .07, h + .6, M.galv, s * (w / 2 + .07), Ht + R + .03, zL - R - (h + .6) / 2));
      if (!vertical) g.add(box(.05, .05, h + .6, M.galv, s * (w / 2 + .07), Ht + R + .6, zL - R - (h + .6) / 2, { shadow: false }));   // hanger angle
    });
    // torsion shaft with spring packs and cable drums above the opening (inside)
    g.add(cyl(.028, w + .4, M.galv, 0, Ht + .2, zL - .18, 12).rotateZ(Math.PI / 2));
    [-1, 1].forEach(s => { g.add(cyl(.085, Math.min(1.2, w * .3), M.dark, s * (w / 4), Ht + .2, zL - .18, 14).rotateZ(Math.PI / 2)); g.add(cyl(.09, .1, M.galvDark, s * (w / 2 + .02), Ht + .2, zL - .18, 16).rotateZ(Math.PI / 2)); g.add(box(.16, .34, .12, M.galv, s * (w / 2 + .1), Ht + .1, zL - .18)); });
    if (d.motor || st.operation === 'motor') { const mu = part('motor_unit', w / 2 + .36, Ht + .2, zL - .18, { rotX: -Math.PI / 2 }); if (mu) g.add(mu); else g.add(box(.26, .3, .36, M.galv, w / 2 + .32, Ht + .2, zL - .18)); }
    else { g.add(cyl(.004, Ht - .6, M.dark, -w / 2 - .02, Ht / 2 + .2, zL - .1, 6, { shadow: false })); }   // pull rope
    const smax = Ht - parts[0].y0 + R * Math.PI / 2 + .12;
    animate = t => { const s = ease(t) * smax; parts.forEach(({ p, y0 }) => { const d1 = Ht - y0;
      if (vertical || s < d1) { p.position.set(0, y0 + s, 0); p.rotation.x = 0; }
      else if (s < d1 + R * Math.PI / 2) { const a = (s - d1) / R; p.position.set(0, Ht + R * Math.sin(a), -R * (1 - Math.cos(a))); p.rotation.x = -a; }
      else { p.position.set(0, Ht + R, -R - (s - d1 - R * Math.PI / 2)); p.rotation.x = -Math.PI / 2; } }); };
  } else if (d.kind === 'rollup' || d.kind === 'roller') {
    const roller = d.kind === 'roller'; const rollR = roller ? .24 : .19;
    // clipping plane in world space: the leaf group sits at y = DOCK_H, the bay group adds only x
    const clipY = DOCK_H + h + .03;
    const leaf = roller ? slatLeaf(w, h, M, clipY) : curtainLeaf(w, h, M, clipY); leaf.position.set(0, 0, zL); leaf.userData.dynamic = true; g.add(leaf);
    const hood = roller ? box(w + .5, rollR * 2 + .16, rollR * 2 + .16, M.galvDark, 0, h + rollR + .1, zL - .02) : rbox(w + .46, rollR * 2 + .1, rollR * 2 + .08, .07, M.white, 0, h + rollR + .08, zL - .02); g.add(hood);
    [-1, 1].forEach(s => g.add(box(roller ? .14 : .11, h + .1, roller ? .16 : .13, roller ? M.galvDark : M.white, s * (w / 2 + (roller ? .1 : .085)), (h + .1) / 2, zL - .02)));
    if (!roller) { [-1, 1].forEach(s => g.add(box(.05, h, .05, M.black, s * (w / 2 + .035), h / 2, zL + .02, { shadow: false }))); }   // zipper guide strips
    const mu = part('motor_unit', w / 2 + .42, h + rollR + .08, zL - .02, { rotX: -Math.PI / 2 }); if (mu) g.add(mu); else g.add(box(.3, .46, .22, M.galv, w / 2 + .35, h + rollR + .1, zL - .02));
    const travel = h - .14;
    animate = t => { leaf.position.y = ease(t) * travel; };
  } else if (d.kind === 'strips') {
    const leaf = stripsLeaf(w, h, M); leaf.position.set(0, 0, zL); g.add(leaf);
  }
  return { group: g, animate };
}

/* ---------------------------------------------------------------- Dock leveller with lip */
export function buildLeveller({ M, st, w, bedH }) {
  const g = new THREE.Group(); const L = LEVELLERS[st.leveller]; if (!L || st.leveller === 'none') return { group: g, animate: () => {} };
  const len = (st.levellerLen || 2500) / 1000, pw = (st.levellerW || 2000) / 1000; const lipLen = L.lipLen;
  // pit box behind the facade, plate hinged at the rear
  const pit = new THREE.Group(); pit.position.set(0, DOCK_H, -WALL_T);
  pit.add(box(pw + .3, .02, len + .3, M.levellerFrame, 0, -.74, -(len + .3) / 2, { shadow: false }));   // pit floor
  [-1, 1].forEach(s => pit.add(box(.15, .74, len + .3, M.plinth, s * (pw / 2 + .075), -.37, -(len + .3) / 2)));
  pit.add(box(pw + .3, .74, .15, M.plinth, 0, -.37, -(len + .3) + .075));
  // pit frame angle flush in the floor
  pit.add(box(pw + .3, .004, len + .3, M.galvDark, 0, .003, -(len + .3) / 2 + .0, { shadow: false })); pit.add(box(pw + .14, .006, len + .14, M.dark, 0, .004, -(len + .3) / 2 + .0, { shadow: false }));
  const hinge = new THREE.Group(); hinge.position.set(0, .012, -len); hinge.userData.dynamic = true; pit.add(hinge);
  const plate = box(pw, .06, len, M.levellerPlate, 0, 0, len / 2); hinge.add(plate);
  // hazard marking across the lip hinge and on the lip, as on the 232NG / 233NG
  hinge.add(box(pw, .004, .14, M.hazard, 0, .032, len - .08, { shadow: false }));
  hinge.add(box(pw, .4, .08, M.levellerFrame, 0, -.24, len - .04));   // front beam
  const cylm = cyl(.06, len * .6, M.levellerFrame, 0, -.3, len * .5, 10); cylm.rotation.x = Math.PI / 2 - .25; hinge.add(cylm);
  const rod = cyl(.035, len * .3, M.chrome, 0, -.1, len * .78, 10); rod.rotation.x = Math.PI / 2 - .25; hinge.add(rod);
  const lipPivot = new THREE.Group(); lipPivot.position.set(0, 0, len); lipPivot.userData.dynamic = true; hinge.add(lipPivot);
  let lip;
  if (L.lip === 'swing') { lip = box(pw - .1, .05, lipLen, M.levellerPlate, 0, 0, lipLen / 2); lipPivot.add(lip); lipPivot.add(box(pw - .1, .004, .08, M.hazard, 0, .028, lipLen - .04, { shadow: false })); lipPivot.rotation.x = Math.PI / 2 - .08; }
  else { lip = box(pw - .1, .045, lipLen, M.levellerPlate, 0, -.002, lipLen / 2 - lipLen); lipPivot.add(lip); lip.position.z = -lipLen + .05; lip.add(box(pw - .1, .004, .08, M.hazard, 0, .025, lipLen / 2 - .04, { shadow: false })); }
  // galvanised toe guards (side skirts)
  [-1, 1].forEach(s => { const sk = box(.02, .7, len, M.galvDark, s * (pw / 2 - .01), -.36, len / 2, { shadow: false }); hinge.add(sk); });
  mergeStatic(hinge); g.add(pit);
  const level = DOCK_H; const target = bedH == null ? DOCK_H : bedH + .02;
  function animate(t) {
    const r = seg(t, 0, .45), o = seg(t, .45, .75), lo = seg(t, .75, 1);
    const upA = .16;
    const dh = target - level; const downA = Math.atan2(dh, len);
    hinge.rotation.x = -(upA * ease(r)) + (upA - downA) * ease(lo);
    if (L.lip === 'swing') lipPivot.rotation.x = (Math.PI / 2 - .08) * (1 - ease(o)) + (-hinge.rotation.x) * ease(lo);
    else { lip.position.z = -lipLen + .05 + lipLen * .9 * ease(o); lipPivot.rotation.x = (-hinge.rotation.x) * ease(lo); }
  }
  return { group: g, animate };
}

const logoPlane = (M, x, y, z, w = .62) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 85 / 240), M.logoWhite); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; return m; };
/* ---------------------------------------------------------------- Dock shelter (403M curtain, 400NG cushion, 405 foam, 407NG inflatable, 408NG inflatable top, 421NG van) */
export function buildShelter({ M, st, w, h }) {
  const g = new THREE.Group(); const S = SHELTERS[st.shelter]; if (!S || st.shelter === 'none') return { group: g, animate: () => {} };
  const depth = .65, side = .55, top = .95; const W = w + 2 * side + .1, Hs = h + top + .12; const y0 = DOCK_H - .1;
  let animate = () => {};
  const marks = (zf, frameW = side, topH = top) => {   // white reflective marks as on the LS 403M: two parallel diagonals in each top corner, one vertical pill per side curtain
    [-1, 1].forEach(s => { [0, .19].forEach(dx => { const mk = rbox(.075, .38, .012, .03, M.shelterStripe, s * (W / 2 - frameW + .3 + dx), y0 + Hs - topH / 2 + .12 - dx * .55, zf, { shadow: false }); mk.rotation.z = s * .72; g.add(mk); });
      g.add(rbox(.1, Hs * .2, .012, .045, M.shelterStripe, s * (W / 2 - frameW / 2), y0 + Hs * .44, zf, { shadow: false })); });
    g.add(logoPlane(M, 0, y0 + Hs - topH / 2 + .12, zf + .01));
  };
  if (S.type === 'curtain' || S.type === 'inflTop') {
    // 403M / 408NG: one closed black frame box (galvanised frame under black PVC), flexible curtains flush in the front plane,
    // white trim strip along the outer front edge, photo textures for the curtains (marks + white LS logo), hooks on the top curtain
    const fr = M.shelterBlack, trim = M.shelterStripe, ct = .06;
    const fb = new THREE.Group(); g.add(fb);
    fb.add(box(W, .1, depth, fr, 0, y0 + Hs - .05, depth / 2));                                   // top plate
    [-1, 1].forEach(s => fb.add(box(.1, Hs, depth, fr, s * (W / 2 - .05), y0 + Hs / 2, depth / 2)));   // side walls
    [-1, 1].forEach(s => fb.add(box(side + .05, Hs, .04, fr, s * (W / 2 - side / 2 - .02), y0 + Hs / 2, .02))); fb.add(box(W, top + .05, .04, fr, 0, y0 + Hs - top / 2, .02));   // closed back ring against the facade (opening stays free)
    fb.add(box(W + .12, .05, depth + .12, fr, 0, y0 + Hs + .02, depth / 2 - .04));                    // roof cover
    [-1, 1].forEach(s => fb.add(box(side, Hs - top - .02, ct, s < 0 ? M.shelter403Side : M.shelter403SideR, s * (W / 2 - side / 2), y0 + (Hs - top) / 2 - .01, depth - ct / 2)));
    fb.add(box(W, top, ct, M.shelter403Top, 0, y0 + Hs - top / 2, depth - ct / 2));
    [-1, 1].forEach(s => fb.add(box(.05, Hs, .015, trim, s * (W / 2 - .025), y0 + Hs / 2, depth + .005, { shadow: false })));
    fb.add(box(W, .05, .015, trim, 0, y0 + Hs - .025, depth + .005, { shadow: false }));
    [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.TorusGeometry(.04, .006, 8, 16), M.galvDark); r.position.set(s * (W / 2 - side - .1), y0 + Hs - top + .05, depth + .02); fb.add(r); });
    if (S.type === 'inflTop') { const cushion = rbox(W - .2, .55, depth - .15, .08, M.cushion, 0, y0 + Hs - top - .25, depth / 2); cushion.userData.dynamic = true; g.add(cushion); cushion.scale.y = .25; animate = t => { const e = ease(t); cushion.scale.y = .25 + .75 * e; cushion.position.y = y0 + Hs - top - .1 - (.55 * cushion.scale.y) / 2; }; }
  } else if (S.type === 'cushion' || S.type === 'foam') {
    const th = S.type === 'foam' ? .44 : .36; const r = S.type === 'foam' ? .12 : .05;
    g.add(box(W, .06, depth, M.shelterFrame, 0, y0 + Hs, depth / 2)); g.add(box(W, .1, depth + .25, M.shelterFrame, 0, y0 + Hs + .08, depth / 2 - .05));
    g.add(box(W, Hs, .04, M.shelterBlack, 0, y0 + Hs / 2, .02));   // black back panel against the wall
    [-1, 1].forEach(s => { g.add(rbox(th, Hs - top, depth, r, M.cushion, s * (W / 2 - th / 2), y0 + (Hs - top) / 2, depth / 2)); g.add(box(.06, (Hs - top) * .5, .012, M.shelterStripe, s * (W / 2 - th / 2), y0 + (Hs - top) * .5, depth + .005, { shadow: false })); });
    g.add(rbox(W, top, depth * .9, r, M.cushion, 0, y0 + Hs - top / 2, depth / 2));
    [-1, 1].forEach(s => { const mk = box(.12, .4, .012, M.shelterStripe, s * (W / 2 - .45), y0 + Hs - top / 2 + .05, depth * .9 + .01, { shadow: false }); mk.rotation.z = s * .6; g.add(mk); });
    g.add(logoPlane(M, 0, y0 + Hs - top / 2 + .1, depth * .9 + .02));
  } else if (S.type === 'inflatable') {
    // 407NG: light grey projection frame, black pleated bags that inflate after docking
    const frameM = M.shelter;
    g.add(box(W, .08, depth, frameM, 0, y0 + Hs, depth / 2)); g.add(box(W + .2, .1, depth + .25, M.shelterFrame, 0, y0 + Hs + .08, depth / 2 - .05));
    [-1, 1].forEach(s => { g.add(box(.08, Hs, depth, frameM, s * (W / 2 - .04), y0 + Hs / 2, depth / 2)); g.add(box(side, Hs, .04, frameM, s * (W / 2 - side / 2), y0 + Hs / 2, depth)); });
    g.add(box(W, top, .04, frameM, 0, y0 + Hs - top / 2, depth));
    const bags = []; const bagRoot = new THREE.Group(); bagRoot.userData.dynamic = true; g.add(bagRoot);
    [-1, 1].forEach(s => { const b = rbox(.5, Hs - top, depth - .1, .06, M.cushion, s * (W / 2 - .34), y0 + (Hs - top) / 2, depth / 2); b.scale.x = .3; bagRoot.add(b); bags.push({ b, ax: 'x', s }); for (let k = 1; k < 9; k++) b.add(box(.52, .02, depth - .08, M.black, 0, -(Hs - top) / 2 + k * (Hs - top) / 9, 0, { shadow: false })); });
    const tb = rbox(W - .2, .7, depth - .1, .06, M.cushion, 0, y0 + Hs - .4, depth / 2); tb.scale.y = .3; bagRoot.add(tb); bags.push({ b: tb, ax: 'y' });
    for (let k = 1; k < 6; k++) tb.add(box(W - .18, .02, depth - .08, M.black, 0, -.35 + k * .7 / 6, 0, { shadow: false }));
    bags.forEach(({ b }) => { if (b.children.length) { const sc = b.scale.clone(); b.scale.set(1, 1, 1); mergeStatic(b); b.scale.copy(sc); } });
    g.add(box(.5, .4, .4, M.galv, W / 2 - .3, y0 + Hs - .35, -.0));   // blower
    marks(depth + .025, side, top);
    animate = t => { const e = .3 + .7 * ease(t); bags.forEach(({ b, ax, s }) => { if (ax === 'x') { b.scale.x = e; b.position.x = s * (W / 2 - .09 - .25 * e); } else { b.scale.y = e; b.position.y = y0 + Hs - .05 - .35 * e; } }); };
  } else if (S.type === 'van') {
    const Wv = w + .6, Hv = h + .3;
    g.add(box(Wv, .06, .55, M.shelterFrame, 0, y0 + Hv, .28));
    [-1, 1].forEach(s => { const c = rbox(.3, Hv - .3, .5, .06, M.cushion, s * (Wv / 2 - .15), y0 + (Hv - .3) / 2, .26); c.rotation.y = -s * .15; g.add(c); g.add(box(.05, (Hv - .3) * .5, .012, M.shelterStripe, s * (Wv / 2 - .15), y0 + (Hv - .3) * .5, .52, { shadow: false })); });
    g.add(rbox(Wv, .3, .5, .06, M.cushion, 0, y0 + Hv - .15, .26));
    g.add(logoPlane(M, 0, y0 + Hv - .15, .52, .4));
  }
  return { group: g, animate };
}

/* ---------------------------------------------------------------- Bumpers, restraint, lights, signs */
export function buildBumpers({ M, st, w }) {
  const g = new THREE.Group(); const B = BUMPERS[st.bumper] || BUMPERS.rubber; const mat = B.style === 'nylon' ? new THREE.MeshStandardMaterial({ color: B.col, roughness: .5 }) : M.bumperRubber.clone(); if (B.style !== 'nylon') mat.color.set(B.col).multiplyScalar(5.5);
  [-1, 1].forEach(s => {
    const x = s * (w / 2 + .32), y = DOCK_H - .22, z = .18;
    if (B.style === 'nylon') { g.add(box(.3, .5, .12, M.galv, x, y, z - .06)); g.add(rbox(.26, .46, .07, .01, mat, x, y, z + .03)); }
    else if (B.style === 'lamella') { for (let k = 0; k < 6; k++) g.add(rbox(.3, .06, .18, .01, mat, x, y - .2 + k * .08, z)); g.add(box(.32, .5, .04, M.galv, x, y, z - .1)); }
    else if (B.style === 'sab') { g.add(box(.36, .56, .1, M.galv, x, y, z - .12)); g.add(rbox(.3, .5, .2, .02, mat, x, y, z + .03)); g.add(box(.34, .06, .22, M.galv, x, y + .28, z + .02)); }
    else if (B.style === 'framed') { g.add(box(.34, .54, .06, M.galv, x, y, z - .08)); g.add(rbox(.3, .5, .16, .015, mat, x, y, z + .03)); [.16, -.16].forEach(dy => g.add(cyl(.025, .01, M.black, x, y + dy, z + .112, 12, { shadow: false }))); }
    else { g.add(rbox(.25, .5, .18, .018, mat, x, y, z)); [.17, -.17].forEach(dy => g.add(cyl(.028, .01, M.black, x, y + dy, z + .092, 12, { shadow: false }))); g.add(box(.27, .52, .012, M.galv, x, y, z - .095)); }
  });
  return g;
}
export function buildRestraint({ M, st, w }) {
  const g = new THREE.Group(); let animate = () => {};
  if (st.restraint === 'manual') {
    // 503NG PowerLock: galvanised ground profile with a wheel chock on a sliding carriage, operated from a standing-height post
    const rail = box(.1, .04, 2.6, M.galv, w * .32, .02, 2.4); g.add(rail);
    g.add(box(.14, .14, .4, M.galv, w * .32, .07, 1.2)); g.add(cyl(.02, 1.0, M.galv, w * .32 - .1, .8, 1.1, 8)); g.add(box(.18, .07, .06, M.dark, w * .32 - .1, 1.32, 1.1));
    const body = new THREE.Group(); body.position.set(w * .32, .0, 1.6); body.userData.dynamic = true; g.add(body);
    body.add(rbox(.5, .3, .6, .03, M.yellow, 0, .17, 0)); body.add(box(.04, .04, .04, M.green, .2, .3, .31, { shadow: false }));
    animate = t => { body.position.z = 1.6 + 1.3 * ease(t); };
    g.userData.led = body.children[1];
  } else if (st.restraint === 'auto') {
    // 505NG: long galvanised tube on the ground with a rounded red-banded cap, the blocking arm travels along it and swings up behind the wheel
    const x = w * .34; const L = 6.2;
    const tube = cyl(.11, L, M.galv, x, .22, L / 2 + 1.3, 18); tube.rotation.x = Math.PI / 2; g.add(tube);
    g.add(sph(.11, M.galv, x, .22, L + 1.3, 18)); const band = cyl(.113, .1, M.red, x, .22, L + 1.3 - .3, 18); band.rotation.x = Math.PI / 2; g.add(band);
    g.add(box(.4, .04, L, M.galv, x, .02, L / 2 + 1.3, { shadow: false }));   // base plate
    g.add(box(.36, .3, .5, M.galv, x, .15, 1.45)); g.add(box(.32, .1, .4, M.sign, x, .33, 1.45, { shadow: false }));
    const carriage = new THREE.Group(); carriage.position.set(x, .22, 4.0); carriage.userData.dynamic = true; g.add(carriage);
    carriage.add(box(.34, .3, .5, M.galvDark, 0, 0, 0));
    const arm = new THREE.Group(); carriage.add(arm); arm.add(box(.08, .9, .08, M.yellow, -.22, .45, 0)); arm.add(box(.08, .08, .5, M.yellow, -.22, .9, .25)); arm.rotation.x = Math.PI / 2;
    animate = t => { carriage.position.z = 4.0 + 2.4 * seg(t, 0, .6); arm.rotation.x = Math.PI / 2 * (1 - ease(seg(t, .6, 1))); };
  }
  return { group: g, animate };
}
export function buildDockLight({ M, st, w, h }) {
  const g = new THREE.Group(); if (st.light === 'none') return { group: g, setOn: () => {} };
  const arm = new THREE.Group(); arm.position.set(-w / 2 - .25, DOCK_H + h + .25, -WALL_T - .12); arm.userData.dynamic = true; g.add(arm);
  arm.add(box(.12, .18, .1, M.dark, 0, 0, 0));
  const a1 = box(.06, .06, 1.0, M.yellow, 0, 0, .5); arm.add(a1);
  const head = new THREE.Group(); head.position.set(0, -.1, 1.0); arm.add(head);
  if (st.light === 'hurricane') { head.add(rbox(.3, .3, .28, .03, M.yellow, 0, 0, 0)); const lens = cyl(.1, .03, M.lampOff, 0, -.16, .0, 20); lens.rotation.x = Math.PI / 2; head.add(lens); head.userData.lens = lens; head.add(cyl(.14, .02, M.dark, 0, -.17, .0, 24).rotateX(Math.PI / 2)); }
  else { const lens = cyl(.11, .06, M.lampOff, 0, 0, 0, 24); lens.rotation.x = Math.PI / 2; head.add(lens); head.userData.lens = lens; head.add(cyl(.13, .05, M.yellow, 0, 0, -.04, 24).rotateX(Math.PI / 2)); }
  const spot = new THREE.SpotLight(0xfff2d4, 0, 14, .55, .5, 1.2); spot.position.set(0, 0, 0); spot.target.position.set(0, -1.5, 6); head.add(spot, spot.target);
  arm.rotation.y = .35; arm.rotation.x = -.25;
  return { group: g, setOn: on => { spot.intensity = on ? 60 : 0; head.userData.lens.material = on ? M.lamp : M.lampOff; } };
}
export function buildTrafficLight({ M, w, h }) {
  const g = new THREE.Group(); const x = w / 2 + .62, y = DOCK_H + 1.9;
  g.add(box(.14, .36, .1, M.dark, x, y, .06)); const r = cyl(.045, .03, M.lampOff, x, y + .08, .12, 16); r.rotation.x = Math.PI / 2; const gr = cyl(.045, .03, M.green, x, y - .08, .12, 16); gr.rotation.x = Math.PI / 2; r.userData.dynamic = true; gr.userData.dynamic = true; g.add(r, gr);
  const redOn = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 1.6 });
  return { group: g, set: state => { r.material = state === 'red' ? redOn : M.lampOff; gr.material = state === 'green' ? M.green : M.lampOff; } };
}
const digitCache = new Map();
export function digitDecal(n, size) {
  const key = String(n); let t = digitCache.get(key);
  if (!t) { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 256, 512); ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 440px "Open Sans", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(key, 128, 268); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; digitCache.set(key, t); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size / 2, size), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false })); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; return m;
}
export function numberPlate({ M, n, w, h }) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const ctx = c.getContext('2d'); ctx.fillStyle = '#e00034'; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = '#fff'; ctx.font = 'bold 170px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); m.position.set(-w / 2 - .25, DOCK_H + h + 1.0, .012); m.castShadow = false; return m;
}

/* ---------------------------------------------------------------- Trucks (Blender library, see ~/LS-work/blender/vehicles.py) */
export function buildTruck({ M, kind, trailerOnly = false }) {
  const g = new THREE.Group(); g.userData.dynamic = true; const T = TRUCKS[kind]; if (!T || kind === 'none') return { group: g, animate: () => {}, len: 0, bedH: null };
  const tpl = (trailerOnly && VEHICLES[T.model + '_proc']) || VEHICLES[T.model] || VEHICLES[T.model + '_proc']; const wheels = [];
  if (tpl) {
    const v = tpl.clone(); g.add(v);
    v.traverse(o => { if (o.name.startsWith('wheel')) wheels.push(o); if (trailerOnly && o.name === 'tractor') o.visible = false; });
  } else {   // fallback if the library did not load: a plain box on wheels
    const L = T.len * .75, W = 2.5, H = 2.7, bed = T.bedH; g.add(box(W, H, L, M.trailerBox, 0, bed + H / 2, L / 2)); g.add(box(W, .35, L, M.chassis, 0, bed - .18, L / 2));
    [1.3, 2.6, 3.9].forEach(z => [-1, 1].forEach(s => { const t = cyl(T.wheelR, .32, M.tyre, s * (W / 2 - .25), T.wheelR, z, 24); t.rotation.z = Math.PI / 2; g.add(t); wheels.push(t); }));
  }
  return { group: g, animate: dz => wheels.forEach(w => { w.rotation.x -= dz / T.wheelR; }), len: T.len, bedH: T.bedH };
}

/* ---------------------------------------------------------------- Interior props */
function rack(M, x, z, bays = 3, levels = 3) {
  const g = new THREE.Group(); const bw = 2.7, depth = 1.1, lh = 1.8;
  for (let i = 0; i <= bays; i++) [-1, 1].forEach(s => g.add(box(.09, levels * lh + .3, .09, M.rack, i * bw, (levels * lh + .3) / 2, s * depth / 2)));
  for (let l = 1; l <= levels; l++) for (let i = 0; i < bays; i++) [-1, 1].forEach(s => g.add(box(bw - .1, .12, .06, M.rackBeam, i * bw + bw / 2, l * lh, s * depth / 2)));
  for (let l = 0; l < levels; l++) for (let i = 0; i < bays; i++) for (let k = 0; k < 2; k++) {
    if ((i * 7 + l * 3 + k) % 5 === 0) continue;
    const px = i * bw + .7 + k * 1.3, py = l * lh + (l ? .06 : 0);
    g.add(box(1.2, .14, .8, M.pallet, px, py + .07, 0)); const bh = .5 + ((i + l + k) % 3) * .3; g.add(box(1.1, bh, .75, M.boxKraft, px, py + .14 + bh / 2, 0));
  }
  g.position.set(x, 0, z); return g;
}
function forklift(M, x, z, rot = 0) {
  const g = new THREE.Group();
  g.add(rbox(1.15, .75, 2.1, .06, M.forklift, 0, .75, -.1)); g.add(box(1.0, .45, 1.0, M.dark, 0, 1.3, -.7)); g.add(rbox(.9, .5, .9, .05, M.forklift, 0, .78, -1.0));
  [-.5, .5].forEach(x_ => { g.add(box(.06, 1.2, .06, M.dark, x_, 1.75, .6)); g.add(box(.06, 1.2, .06, M.dark, x_, 1.75, -.9)); }); g.add(box(1.1, .05, 1.6, M.dark, 0, 2.35, -.15));
  [-.3, .3].forEach(x_ => { g.add(box(.08, 2.6, .08, M.dark, x_, 1.3, .95)); g.add(box(.1, .05, 1.1, M.galv, x_, .08, 1.55)); });
  g.add(box(.5, .4, .25, M.dark, 0, 1.0, .5, { shadow: false }));
  [[-.55, .55], [.55, .55], [-.55, -.75], [.55, -.75]].forEach(([a, b]) => { const w = cyl(.3, .24, M.tyre, a, .3, b, 18); w.rotation.z = Math.PI / 2; g.add(w); });
  g.position.set(x, 0, z); g.rotation.y = rot; return g;
}
/* ---------------------------------------------------------------- Whole warehouse */
export function buildWarehouse({ mats, st, studio = false }) {
  const { M } = mats; const g = new THREE.Group(); const rigs = { doors: [], levellers: [], shelters: [], restraints: [], lights: [], traffic: [], trucks: [] };
  const w = st.w / 1000, h = st.h / 1000; const bays = studio ? 1 : st.bays; const lite = QUALITY.mobile;
  const pitch = Math.max(PITCH, w + 1.9); const W = studio ? w + 3.2 : bays * pitch + 8; const H = DOCK_H + HALL_H; const D = studio ? 6 : HALL_D;
  const x0 = -W / 2; const bayX = i => studio ? 0 : x0 + 4 + pitch * i + pitch / 2;
  const openings = []; for (let i = 0; i < bays; i++) openings.push({ x: bayX(i) - x0 - w / 2, y: DOCK_H, w, h });
  // mandoor (pedestrian door) next to the first bay
  if (st.mandoor && st.mandoor !== 'none' && !studio) openings.push({ x: bayX(0) - x0 - w / 2 - 1.9, y: DOCK_H, w: (st.mandoorW || 1000) / 1000, h: (st.mandoorH || 2125) / 1000 });
  // facade: dock wall (concrete) up to DOCK_H, sandwich panels above
  const facMat = st.facade === 'panel_dark' ? M.facade.clone() : st.facade === 'panel_white' ? M.facade.clone() : st.facade === 'brick' ? new THREE.MeshStandardMaterial({ ...mats.pbr('brick', 2.4), roughness: 1 }) : M.facade;
  if (st.facade === 'panel_dark') facMat.color.set(0x4a4f53); if (st.facade === 'panel_white') facMat.color.set(0xeceeee);
  const front = wall(W, H + .4, WALL_T, openings, facMat); front.position.set(x0, 0, 0); g.add(front);
  // dock wall: concrete face below the openings, split per bay
  let px = x0; openings.forEach(o => { const ox = x0 + o.x; if (ox - px > .01) g.add(box(ox - px, DOCK_H + .02, .06, M.plinth, (ox + px) / 2, (DOCK_H + .02) / 2, .03)); px = ox + o.w; }); if (x0 + W - px > .01) g.add(box(x0 + W - px, DOCK_H + .02, .06, M.plinth, (x0 + W + px) / 2, (DOCK_H + .02) / 2, .03));
  // roof edge / parapet and gutter
  g.add(box(W + .4, .5, .5, M.dark, 0, H + .4, -.1)); g.add(box(W + .6, .08, .14, M.galv, 0, H + .66, .1, { shadow: false }));
  // side walls, back wall, floor, ceiling, trusses, lights
  const inner = M.facadeInner;
  g.add(box(WALL_T, H, D, facMat, x0 + WALL_T / 2, H / 2, -D / 2)); g.add(box(WALL_T, H, D, facMat, -x0 - WALL_T / 2, H / 2, -D / 2));
  g.add(box(W, H, WALL_T, inner, 0, H / 2, -D + WALL_T / 2));
  g.add(plane(W - .6, D - .6, M.floor, 0, DOCK_H, -D / 2));
  g.add(box(W, .3, D, M.ceiling, 0, H + .15, -D / 2, { shadow: false }));
  for (let z = -3; z > -D; z -= 6) { g.add(box(W - .6, .5, .12, M.truss, 0, H - .3, z, { shadow: false })); if (!lite) for (let k = 0; k < 14; k++) { const d = box(.05, .45, .05, M.truss, x0 + .6 + k * (W - 1.2) / 13, H - .3, z, { shadow: false }); d.rotation.z = (k % 2 ? 1 : -1) * .6; g.add(d); } }
  const lightMeshes = [];
  if (st.interiorLight === 'led_line') { for (let i = 0; i < 3; i++) { const z = -4 - i * 7; const l = box(W - 2, .06, .14, M.lamp, 0, H - .62, z, { shadow: false }); g.add(l); lightMeshes.push(l); if (!lite || i < 2) { const pl = new THREE.PointLight(0xfff4e0, 60, 26, 1.6); pl.position.set(0, H - 1, z); g.add(pl); } } }
  else if (st.interiorLight === 'highbay') { for (let i = 0; i < 3; i++) for (let k = 0; k < Math.max(2, Math.round(W / 9)); k++) { const x = x0 + 4.5 + k * (W - 9) / Math.max(1, Math.round(W / 9) - 1), z = -4 - i * 7; const l = cyl(.22, .12, M.lamp, x, H - .7, z, 20, { shadow: false }); g.add(l); lightMeshes.push(l); g.add(cyl(.26, .1, M.dark, x, H - .6, z, 20, { shadow: false })); if (!lite || (i === 1)) { const pl = new THREE.PointLight(0xfff4e0, 45, 20, 1.6); pl.position.set(x, H - 1.1, z); g.add(pl); } } }
  // interior: yellow safety line, racks, forklift, control box per bay
  if (!studio) {
    g.add(plane(W - .6, .12, M.yellowStripe, 0, DOCK_H + .003, -4.2)); g.add(plane(W - .6, .12, M.yellowStripe, 0, DOCK_H + .003, -4.6));
    const nR = Math.max(1, Math.floor((W - 6) / 9));
    for (let k = 0; k < nR; k++) g.add(rack(M, x0 + 2.5 + k * 9, -D + 2.2, 3, 3));
    if (!lite) for (let k = 0; k < nR; k++) g.add(rack(M, x0 + 2.5 + k * 9, -D + 6.0, 3, 3));
    g.add(forklift(M, bayX(Math.min(1, bays - 1)) + 2.6, -8.5, -.6));
    // staged pallets behind the active dock
    for (let i = 0; i < bays; i++) for (let k = 0; k < 3; k++) { if ((i * 3 + k) % 4 === 1) continue; const px = bayX(i) - 1.4 + k * 1.4, pz = -6.2 - (k % 2) * 1.1; g.add(box(1.2, .14, .8, M.pallet, px, DOCK_H + .07, pz)); const bh = .6 + ((i + k) % 3) * .35; g.add(box(1.1, bh, .75, M.boxKraft, px, DOCK_H + .14 + bh / 2, pz)); }
    // steel columns along the side walls, roof lights (skylight strips)
    for (let z = -4; z > -D; z -= 6) [x0 + .5, -x0 - .5].forEach(x => g.add(box(.3, H - .2, .3, M.truss, x, H / 2, z)));
    for (let z = -6; z > -D; z -= 9) g.add(box(W - 4, .05, 1.2, M.lamp, 0, H + .02, z, { shadow: false }));
  }
  // yard: asphalt apron, lane markings per bay, kerb, lawn, hedge, fence line
  const yardD = studio ? 10 : 54;
  g.add(plane(W + (studio ? 0 : 60), yardD, M.asphalt, 0, 0, yardD / 2));
  if (!studio) {
    for (let i = 0; i < bays; i++) [-1, 1].forEach(s => g.add(plane(.12, 18, M.yellowStripe, bayX(i) + s * (1.5), .004, 9.5)));
    g.add(plane(W + 60, 60, M.lawn, 0, -.01, yardD + 30)); g.add(box(W + 60, .14, .2, M.plinth, 0, .07, yardD, { shadow: false }));
    g.add(box(W + 60, 1.0, .8, M.hedge, 0, .5, yardD + 2.5));
  }
  // a parked trailer (without tractor) at the far end of the yard for scale
  if (!studio && bays > 1 && !lite) { const pt = buildTruck({ M, kind: 'truck', trailerOnly: true }); pt.group.position.set(x0 - 6, 0, 14); pt.group.rotation.y = .55; g.add(pt.group); }
  // per bay
  for (let i = 0; i < bays; i++) {
    const cx = bayX(i); const bay = new THREE.Group(); bay.position.x = cx; g.add(bay);
    // dock edge plate
    bay.add(box(w + .4, .08, .3, M.galv, 0, DOCK_H - .04, .12, { shadow: false }));
    const door = buildDoor({ M, st: { ...st, bayNo: i + 1 }, w, h }); bay.add(door.group); rigs.doors.push(door);
    bay.add(box(w + .7, .14, .02, M.yellowStripe, 0, DOCK_H - .09, .07, { shadow: false }));   // yellow dock-edge marking
    const truckKind = st.truck; const bedH = TRUCKS[truckKind] && truckKind !== 'none' ? TRUCKS[truckKind].bedH : null;
    const lev = buildLeveller({ M, st, w, bedH }); bay.add(lev.group); rigs.levellers.push(lev);
    const sh = buildShelter({ M, st, w, h }); bay.add(sh.group); rigs.shelters.push(sh);
    bay.add(buildBumpers({ M, st, w }));
    const rs = buildRestraint({ M, st, w }); bay.add(rs.group); rigs.restraints.push(rs);
    const dl = buildDockLight({ M, st, w, h }); bay.add(dl.group); rigs.lights.push(dl);
    if (st.trafficLight) { const tl = buildTrafficLight({ M, w, h }); bay.add(tl.group); rigs.traffic.push(tl); }
    if (st.numbers && st.numberStyle === 'plate') bay.add(numberPlate({ M, n: i + 1, w, h }));
    if (st.bollards) [-1, 1].forEach(s => { const b = part('bollard', s * (w / 2 + .85), 0, .55); if (b) bay.add(b); else bay.add(cyl(.08, 1.1, M.yellow, s * (w / 2 + .85), .55, .55, 16)); });
    if (st.wheelGuides) [-1, 1].forEach(s => { const x = s * 1.55; const t = cyl(.06, 4.6, M.yellow, x, .18, 4.6, 12); t.rotation.x = Math.PI / 2; bay.add(t); [2.5, 6.6].forEach(z => bay.add(cyl(.06, .3, M.yellow, x, .1, z, 12))); });
    // dock control box inside next to the door
    const cb = part('control_box', w / 2 + .7, DOCK_H + 1.4, -WALL_T - .07, { rotY: Math.PI }); if (cb) bay.add(cb); else bay.add(box(.3, .42, .12, M.white, w / 2 + .7, DOCK_H + 1.4, -WALL_T - .07));
    // truck
    if (truckKind !== 'none' && (studio ? true : (st.truckBays === 'all' || i === (st.activeBay || 0)))) {
      const tr = buildTruck({ M, kind: truckKind }); tr.group.position.set(0, 0, 0); bay.add(tr.group); rigs.trucks.push({ ...tr, bay: i });
    }
  }
  // mandoor leaf
  if (st.mandoor && st.mandoor !== 'none' && !studio) {
    const mw = (st.mandoorW || 1000) / 1000, mh = (st.mandoorH || 2125) / 1000, mx = bayX(0) - w / 2 - 1.9 + mw / 2;
    const leaf = box(mw - .02, mh - .02, .05, M.doorInner, mx, DOCK_H + mh / 2, -.03); g.add(leaf);
    g.add(box(mw + .1, .06, .1, M.galv, mx, DOCK_H + mh + .03, -.03, { shadow: false })); g.add(box(.03, .15, .03, M.steel, mx + mw / 2 - .12, DOCK_H + 1.05, .02, { shadow: false }));
    g.add(box(1.4, .18, 1.2, M.plinth, mx, DOCK_H - .09, .6)); // landing + steps
    for (let k = 1; k < 7; k++) g.add(box(1.4, .18, .3, M.plinth, mx, DOCK_H - .09 - k * .17, 1.2 + k * .3));
  }
  return { group: g, rigs, dims: { W, H, D, w, h, pitch, bays, bayX, x0 } };
}

/* Studio cyclorama for product mode */
export function buildStudio({ M, dims }) {
  const g = new THREE.Group(); const r = Math.max(14, dims.W * 1.5);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 72), new THREE.MeshStandardMaterial({ color: 0xe2e3e5, roughness: .35 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.001; floor.receiveShadow = true; g.add(floor);
  const s = new THREE.Shape(); s.moveTo(-3, 0); s.lineTo(0, 0); s.absarc(0, 1.6, 1.6, -Math.PI / 2, 0, false); s.lineTo(1.6, 16); s.lineTo(2.2, 16); s.lineTo(2.2, -.4); s.lineTo(-3, -.4); s.closePath();
  const cyc = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: r * 2, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: .95 }));
  cyc.rotation.y = Math.PI / 2; cyc.position.set(-r, -.002, -(dims.D + 2.2)); cyc.receiveShadow = true; g.add(cyc);
  return g;
}
