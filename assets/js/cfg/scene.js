/* Loading Systems · Dock Studio scene: warehouse with N loading bays, doors, dock levellers, shelters, bumpers, restraints, lights, trucks.
   Units metres. X along the facade, Y up, +Z = yard (outside). Yard level y = 0, warehouse floor y = DOCK_H. Facade front face at z = 0. */
import * as THREE from 'three';
import { DOORS, LEVELLERS, SHELTERS, BUMPERS, TRUCKS, WINDOWS, FULLVISION, LIFT, LIFT_620 } from './catalog.js?v=32';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DOCK_H = 1.2;      // dock height above yard
export const PITCH = 4.6;       // bay pitch
export const WALL_T = .3;
export const HALL_D = 60;       // hall depth (deep enough to zoom well out)
export const HALL_H = 10;       // eaves height above warehouse floor
export const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const QUALITY = { mobile: false };

export const box = (w, h, d, mat, x = 0, y = 0, z = 0, opt = {}) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  m.castShadow = opt.shadow !== false; m.receiveShadow = opt.receive !== false; return m;
};
/* BoxGeometry maps every face to 0..1; rescale the UVs to metres so a texture with repeat = 1/tile keeps its real size on any box (plate, lip) */
export function uvMetres(mesh) {
  const g = mesh.geometry, p = g.parameters; if (!p || g.type !== 'BoxGeometry' || g.userData.uvMetres) return mesh;
  const sizes = [[p.depth, p.height], [p.depth, p.height], [p.width, p.depth], [p.width, p.depth], [p.width, p.height], [p.width, p.height]];
  const uv = g.attributes.uv; const per = uv.count / 6;
  for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / per); uv.setXY(i, uv.getX(i) * sizes[f][0], uv.getY(i) * sizes[f][1]); }
  uv.needsUpdate = true; g.userData.uvMetres = true; return mesh;
}
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
  openings.forEach(o => { const p = new THREE.Path(); p.moveTo(o.x, o.y);
    if (o.notch) { const n = o.notch; p.lineTo(o.x + n.x, o.y); p.lineTo(o.x + n.x, o.y - n.d); p.lineTo(o.x + n.x + n.w, o.y - n.d); p.lineTo(o.x + n.x + n.w, o.y); }   // T-shaped opening (stepped dock)
    p.lineTo(o.x + o.w, o.y); p.lineTo(o.x + o.w, o.y + o.h); p.lineTo(o.x, o.y + o.h); p.closePath(); s.holes.push(p); });
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
  gltfScene.children.forEach(c => { c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); VEHICLES[rename[c.name] || c.name] = c; if (c.name === 'rigid' && !rename[c.name]) reshapeRigid(c); });
}
/* 7.5 t box truck: the scan is 2.4 m wide, 3.11 m high with a 1.05 m bed. Julian: same body width, height and bed height as the semi,
   only shorter. So (in model units, before the uniform 1.07 scale that gives the 2.63 m width): lift everything above the wheels by .17
   (bed 1.30 m) and stretch the box (z < 7, above the chassis) so its roof reaches 3.92 m; the cab (z > 7) keeps its height. */
function reshapeRigid(root) {
  root.traverse(o => { if (!o.isMesh || o.geometry.userData.reshaped) return; const pa = o.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y0 = pa.getY(i), z = pa.getZ(i); let y = y0 + (y0 > .92 ? .17 : 0); if (z < 7.0 && y0 > 1.4) y = 1.57 + (y0 - 1.4) * 1.2246; pa.setY(i, y); }
    pa.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere(); o.geometry.userData.reshaped = true; });
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
      p.add(box(w - .01, H - .012, .006, M.doorBack, 0, 0, -t / 2 - .002, { shadow: false }));   // inside skin (inner colour option)
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
    // rollers (galvanised wheel on a stem) at the top edge of each panel, both sides, running in the C-channel; extra pair at the bottom of the lowest panel
    const rollerAt = yr => [-1, 1].forEach(sx => { const stem = cyl(.006, .06, M.galvDark, sx * (w / 2 + .03), yr, -t / 2 - .035, 8); stem.rotation.z = Math.PI / 2; p.add(stem);
      const wheel = cyl(.023, .012, M.galvDark, sx * (w / 2 + .055), yr, -t / 2 - .035, 18); wheel.rotation.z = Math.PI / 2; p.add(wheel); });
    rollerAt(H / 2 - .07); if (i === 0) rollerAt(-H / 2 + .07);
    p.position.y = H * i + H / 2; g.add(p); parts.push({ p, y0: H * i + H / 2 });
  }
  // bottom panel: seal profile, flush handle, Loading Systems logo plate; wicket outline
  const bottom = parts[0].p;
  if (st.stepT) {   // (unused) T-shaped leaf variant
    const ext = new THREE.Mesh(panelGeometry(st.stepW - .02, st.stepDown, t), faceMat); ext.position.set(0, -H / 2 - st.stepDown, 0);   /* panelGeometry is centred in x */ ext.castShadow = ext.receiveShadow = true; bottom.add(ext);
    bottom.add(box(st.stepW - .03, st.stepDown - .01, .006, M.doorBack, 0, -H / 2 - st.stepDown / 2, -.003, { shadow: false }));
    bottom.add(box(st.stepW - .02, .03, .05, M.black, 0, -H / 2 - st.stepDown + .015, t / 2, { shadow: false }));   // seal under the extension
  }
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

/* Sectional door track: continuous galvanised C-channel (50 x 32 mm, opening towards the door) swept along the roller path:
   vertical section beside the opening, 90° bend, horizontal section under the ceiling. Built in the leaf frame at x = 0. */
class ArcYZ extends THREE.Curve { constructor(cy, cz, r, a0, a1) { super(); this.cy = cy; this.cz = cz; this.r = r; this.a0 = a0; this.a1 = a1; }
  getPoint(t, o = new THREE.Vector3()) { const a = this.a0 + (this.a1 - this.a0) * t; return o.set(0, this.cy + this.r * Math.sin(a), this.cz + this.r * Math.cos(a)); } }
export function trackGeometry({ Ht, R, Rr, zo, horizLen, vertical, mirror = false }) {
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(new THREE.Vector3(0, .04, -zo), new THREE.Vector3(0, Ht, -zo)));
  if (!vertical) { path.add(new ArcYZ(Ht, -R, Rr, 0, Math.PI / 2)); path.add(new THREE.LineCurve3(new THREE.Vector3(0, Ht + Rr, -R), new THREE.Vector3(0, Ht + Rr, -R - horizLen))); }
  const m = mirror ? -1 : 1;   // profile Y = sideways (binormal); the opening must face the door
  const pts = [[-.03, 0], [-.012, 0], [-.012, .0025], [-.0275, .0025], [-.0275, .03], [.0275, .03], [.0275, .0025], [.012, .0025], [.012, 0], [.03, 0], [.03, .0325], [-.03, .0325]].map(([x, y]) => new THREE.Vector2(x, y * m));
  const shape = new THREE.Shape(pts);
  const g = new THREE.ExtrudeGeometry(shape, { steps: vertical ? 2 : 56, bevelEnabled: false, extrudePath: path });
  g.computeVertexNormals(); return g;
}

/* ---------------------------------------------------------------- Door rig with tracks + animate(t) */
export function buildDoor({ M, st, w, h }) {
  const d = DOORS[st.door]; const g = new THREE.Group(); g.position.y = DOCK_H - (st.stepDown || 0); const zL = -WALL_T - .06;   // stepped dock: the door starts at the bottom of the floor slit
  let animate = () => {};
  const rawHl = d.priced === 'hs620' ? { SL: 0, HL750: .75, HL1370: 1.37, HL2000: 2.0, VL: 99 }[st.lift620 || 'SL'] : (LIFT[st.lift] || LIFT.normal).hl;
  const vertical = rawHl >= 99;   // vertical lift: straight track, the leaf rises by its own height
  const hl = vertical ? Math.min(h, HALL_H - h - .4) : Math.min(rawHl, HALL_H - h - .6);
  // outside reveal: galvanised angle frame around the opening (as on the LS reference photos)
  g.add(box(w + .16, .08, .05, M.galv, 0, h + .04, -.02, { shadow: false }));
  [-1, 1].forEach(s => g.add(box(.08, h + .08, .05, M.galv, s * (w / 2 + .04), (h + .08) / 2, -.02, { shadow: false })));
  if (d.kind === 'sectional') {
    const leaf = sectionalLeaf(w, h, d.panel, st, M, d); leaf.position.set(0, 0, zL); leaf.userData.dynamic = true; g.add(leaf);
    const parts = leaf.userData.parts, H = leaf.userData.H;
    const R = vertical ? 0 : .42, Ht = h + .12 + hl;
    const heavy = d.priced === 'hs620';   // 620NG: self-supporting galvanised frame columns, FU motor at the shaft
    // tracks: continuous C-channel on each side (roller path), wall angle behind the vertical part, hanger angles for the horizontal part
    const t0 = st.panel === 'iso80' ? .08 : .04, zo = t0 / 2 + .035, Rr = Math.max(.05, R - zo), horizLen = h + .6, tx = w / 2 + .055;
    const trackMat = M.galv;
    [-1, 1].forEach(s => {
      const tg = trackGeometry({ Ht, R, Rr, zo, horizLen, vertical, mirror: s < 0 }); const tm = new THREE.Mesh(tg, trackMat); tm.position.set(s * tx, 0, zL); tm.castShadow = true; tm.receiveShadow = true; g.add(tm);
      if (heavy) g.add(box(.14, Ht + .3, .16, M.galv, s * (w / 2 + .16), (Ht + .3) / 2, zL - .06));   // 620NG self-supporting columns outside the tracks
      if (!vertical) for (let k = 0; k <= 2; k++) { const zk = zL - R - .3 - k * (horizLen - .6) / 2; const hh = st.studio ? .9 : HALL_H - (Ht + Rr + .05); g.add(box(.04, hh, .04, M.galv, s * (tx + .02), Ht + Rr + .05 + hh / 2, zk, { shadow: false })); g.add(box(.08, .04, .3, M.galv, s * tx, Ht + Rr + .07, zk, { shadow: false })); }   // hanger angles up to the roof structure
    });
    // torsion shaft with spring packs and cable drums above the opening (inside)
    // torsion spring assembly as on a real sectional door: solid shaft on end bearing brackets, centre spring-anchor bracket on the wall,
    // one coil spring each side of it with aluminium stationary / winding cones, cable drums at the ends with lifting cables down to the bottom panel
    const sy = (vertical ? h + .12 : Ht) + .2, sz = zL - .18, arm = -WALL_T - sz;   // shaft axis (vertical lift: low shaft above the opening, as VLU) and bracket reach from the wall
    g.add(cyl(.0127, w + .5, M.galv, 0, sy, sz, 10).rotateZ(Math.PI / 2));
    const bracket = x => { g.add(box(.06, .26, .004, M.galv, x, sy - .03, -WALL_T - .002, { shadow: false })); g.add(box(.06, .004, arm, M.galv, x, sy + .045, -WALL_T - arm / 2)); g.add(box(.004, .09, arm, M.galv, x + .03, sy, -WALL_T - arm / 2, { shadow: false }));
      g.add(cyl(.024, .035, M.galvDark, x, sy, sz, 14).rotateZ(Math.PI / 2)); };   // bearing hub
    bracket(0); [-1, 1].forEach(s => bracket(s * (w / 2 + .12)));
    const Ls = Math.min(1.0, w * .28);
    [-1, 1].forEach(s => { const x0 = s * (.06 + Ls / 2); g.add(cyl(.04, Ls, M.springCoil, x0, sy, sz, 16).rotateZ(Math.PI / 2));
      g.add(cyl(.046, .04, M.alu, s * .07, sy, sz, 16).rotateZ(Math.PI / 2)); g.add(cyl(.046, .05, M.alu, s * (.06 + Ls + .02), sy, sz, 16).rotateZ(Math.PI / 2)); });   // cones
    [-1, 1].forEach(s => { const dx = s * (w / 2 + .06); g.add(cyl(.062, .085, M.galvDark, dx, sy, sz, 20).rotateZ(Math.PI / 2)); for (let k = -3; k <= 3; k++) g.add(cyl(.064, .004, M.dark, dx + k * .011, sy, sz, 20, { shadow: false }).rotateZ(Math.PI / 2));   // grooved cable drum
      g.add(cyl(.0025, sy - .1, M.galvDark, dx, (sy - .1) / 2 + .1, sz + .02, 6, { shadow: false })); });   // lifting cable down to the bottom bracket
    if (d.motor || st.operation === 'motor') { const mu = part('motor_unit', w / 2 + .36, sy, zL - .18, { rotX: -Math.PI / 2 }); if (mu) g.add(mu); else g.add(box(.26, .3, .36, M.galv, w / 2 + .32, sy, zL - .18)); }
    else { g.add(cyl(.004, sy - .8, M.dark, -w / 2 - .02, sy / 2, zL - .1, 6, { shadow: false })); }   // pull rope
    const smax = vertical ? hl + .12 : Ht - parts[0].y0 + R * Math.PI / 2 + .12;   // vertical lift: the leaf rises by exactly its height (bottom edge 12 cm above the opening), the track ends there
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
export function buildLeveller({ M, st, w, bedH, truckRearZ = null }) {
  const g = new THREE.Group(); const L = LEVELLERS[st.leveller]; if (!L || st.leveller === 'none') return { group: g, animate: () => {} };
  const stepped = !!L.stepped; const G = 0;   // stepped dock: the leveller stays in its normal place; the step is the lower strip under the door, leveller-wide
  const len = (st.levellerLen || 2500) / 1000, pw = (st.levellerW || 2000) / 1000; const lipLen = L.lipLen;
  // pit box behind the facade, plate hinged at the rear
  const plateEdgeZ = stepped ? -WALL_T - .12 : 0;   // plate front edge at the dock edge (the door closes on the platform); stepped dock: behind the step strip
  const pit = new THREE.Group(); pit.position.set(0, DOCK_H, plateEdgeZ);
  if (stepped) {   // the step: a leveller-wide strip in front of the plate, 50 cm below the hall floor, closed by the T extension of the door
    const zw = pw + .1, zd = .12 + .02, zy = -.5; const zone = new THREE.Group(); zone.position.set(0, DOCK_H, -WALL_T); g.add(zone);
    zone.add(box(zw, .02, zd, M.levellerFrame, 0, zy + .01, -zd / 2));                                          // lower floor, runs out to the door
    [-1, 1].forEach(sx => zone.add(box(.06, -zy, zd, M.plinth, sx * (zw / 2 + .03), zy / 2, -zd / 2)));          // side walls of the step
    [-1, 1].forEach(sx => zone.add(box(.05, .006, zd, M.galvDark, sx * (zw / 2 + .035), .003, -zd / 2, { shadow: false })));   // edge angles along the hall floor
  }
  const gap = .02;   // pit is only 1 cm bigger than the plate on each side: the leveller is the whole area, not a plate in a wide frame
  pit.add(box(pw + gap, .02, len + gap, M.levellerFrame, 0, -.74, -(len + gap) / 2, { shadow: false }));   // pit floor
  [-1, 1].forEach(s => pit.add(box(.04, .74, len + gap, M.plinth, s * (pw / 2 + gap / 2 + .02), -.37, -(len + gap) / 2)));
  pit.add(box(pw + gap + .08, .74, .04, M.plinth, 0, -.37, -(len + gap) - .02));
  // pit frame angle flush in the floor
  { const fw = pw + gap + .04, fd = len + gap + .02, zc = -(len + gap) / 2 + .01;   // galvanised pit frame angle: a 4 cm rim round the pit (the pit itself stays open below the plate)
    [-1, 1].forEach(sx => pit.add(box(.04, .004, fd, M.galvDark, sx * (fw / 2 - .02), .003, zc, { shadow: false })));
    pit.add(box(fw, .004, .04, M.galvDark, 0, .003, zc - fd / 2 + .02, { shadow: false })); pit.add(box(fw, .004, .04, M.galvDark, 0, .003, zc + fd / 2 - .02, { shadow: false })); }
  pit.add(box(pw + gap + .08, .012, .14, M.galvDark, 0, .006, -len - .03, { shadow: false }));   // rear hinge cover: closes the gap behind the plate, floor runs through
  const hinge = new THREE.Group(); hinge.name = 'leveller_hinge'; hinge.position.set(0, -.02, -len); hinge.userData.dynamic = true; pit.add(hinge);   // plate top 1 cm above the pit frame at rest (frame boxes sit at +.001..+.007), so the tread surface is always visible
  const plate = uvMetres(box(pw, .06, len, M.levellerPlate, 0, 0, len / 2)); hinge.add(plate);
  // hazard marking across the lip hinge and on the lip, as on the 232NG / 233NG
  if (!stepped) hinge.add(box(pw, .004, .14, M.hazard, 0, .032, len - .08, { shadow: false }));   // no yellow marking on a stepped dock
  hinge.add(box(pw, .4, .08, M.levellerFrame, 0, -.24, len - .04));   // front beam
  hinge.add(box(pw - .08, .026, .01, M.black, 0, .018, len + .002, { shadow: false }));   // lip slot in the front edge
  const cylm = cyl(.06, len * .6, M.levellerFrame, 0, -.3, len * .5, 10); cylm.rotation.x = Math.PI / 2 - .25; hinge.add(cylm);
  const rod = cyl(.035, len * .3, M.chrome, 0, -.1, len * .78, 10); rod.rotation.x = Math.PI / 2 - .25; hinge.add(rod);
  const lipPivot = new THREE.Group(); lipPivot.position.set(0, 0, len); lipPivot.userData.dynamic = true; hinge.add(lipPivot);
  let lip;
  if (L.lip === 'swing') { lip = uvMetres(box(pw - .1, .05, lipLen, M.levellerPlate, 0, 0, lipLen / 2)); lipPivot.add(lip); lipPivot.add(box(pw - .1, .004, .08, M.hazard, 0, .028, lipLen - .04, { shadow: false })); lipPivot.rotation.x = Math.PI / 2 - .08; }
  else { const body = Math.min(lipLen + 1.2, len - .1); lip = uvMetres(box(pw - .1, .02, body, M.levellerPlate, 0, .019, 0)); lip.geometry.translate(0, 0, -body / 2); lipPivot.add(lip); lip.position.z = 0; if (!stepped) lip.add(box(pw - .1, .003, .08, M.hazard, 0, .0115, -.04, { shadow: false })); }   // telescopic lip: thin 20 mm steel plate flush with the platform top, one rigid piece sliding out of a slot in the front edge; its body runs 1.2 m back inside the platform
  // galvanised toe guards (side skirts)
  [-1, 1].forEach(s => { const sk = box(.02, .7, len, M.galvDark, s * (pw / 2 - .01), -.36, len / 2, { shadow: false }); hinge.add(sk); });
  mergeStatic(hinge); g.add(pit);
  const level = DOCK_H; const target = bedH == null ? DOCK_H : bedH + .02;
  const ext = truckRearZ == null ? lipLen * .5 : Math.min(lipLen - .05, truckRearZ + .08 - plateEdgeZ);   // lip reach from the plate edge: 8 cm into the vehicle (capped by the lip length)
  function animate(t, docked = true) {
    const r = seg(t, 0, .45), o = seg(t, .45, .75), lo = seg(t, .75, 1);
    const upA = .16;
    const dh = (docked ? target : level) - level; /* no vehicle to rest on: the platform comes back to floor level, never below */ const downA = Math.atan2(dh, L.lip === 'swing' ? len : len + ext);   // telescopic: the lip tip (plate + extension) rests on the vehicle floor
    hinge.rotation.x = -(upA * ease(r)) + (upA - downA) * ease(lo);
    if (L.lip === 'swing') lipPivot.rotation.x = (Math.PI / 2 - .08) * (1 - ease(o)) + (-hinge.rotation.x) * ease(lo);
    else { lip.position.z = ext * ease(o); lipPivot.rotation.x = 0; }   // no articulation: the lip extends and retracts in line with the platform
  }
  return { group: g, animate };
}

const logoPlane = (M, x, y, z, w = .62) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 85 / 240), M.logoWhite); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; return m; };
/* ---------------------------------------------------------------- Dock shelter (403M curtain, 400NG cushion, 405 foam, 407NG inflatable, 408NG inflatable top, 421NG van) */
export function buildShelter({ M, st, w, h }) {
  const g = new THREE.Group(); const S = SHELTERS[st.shelter]; if (!S || st.shelter === 'none') return { group: g, animate: () => {} };
  // LS 403M standard frame 3400 x 3500 mm with 600 mm side curtains and a 1000 mm top curtain: clear opening 2200 x 2500, so a
  // 2.55 m wide / 3.9 m high trailer overlaps the curtains and pushes them back when it docks (no gap between shelter and vehicle)
  const depth = .65, top = .95; const y0 = DOCK_H - .1; const T = TRUCKS[st.truck]; const bodyW = (T && T.bodyW) || 0, bodyH = (T && T.bodyH) || 0;
  // frame height so that the 950 mm top curtain ends 100 mm above the vehicle roof (it does not touch; 403M frames come in several heights)
  // side curtains 600 mm, frame width so that the curtains end 50 mm outside the measured vehicle body on each side (close, not touching)
  const side = .6; const W = Math.max(3.4, w + .4, bodyW + .10 + 2 * side + .2 /* curtains hang 100 mm inside the frame edge */), Hs = Math.max(3.5, h + .25, bodyH + .1 + top - y0);
  const ovS = 0, ovT = 0;   // nothing folds: all curtains hang free with a small gap to the vehicle
  // the part of each curtain that the vehicle overlaps folds round and lies flat along the body (side) or the roof (top)
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
    fb.add(box(W, .05, depth + .06, fr, 0, y0 + Hs + .02, depth / 2 - .01));                          // roof cover, same width as the frame
    // curtains: hanging section (photo texture) + end section that folds 90° to lie along the vehicle when it docks
    const curtain = (len, ov, mat, mkA, mkB) => { const a = Math.max(.05, len - ov); const pv = new THREE.Group(); pv.userData.dynamic = true; pv.add(mkA(a)); const sub = new THREE.Group(); sub.userData.dynamic = true; pv.add(sub); if (ov > .01) sub.add(mkB(ov)); return { pv, sub }; };
    const sideC = [-1, 1].map(s => { const c = curtain(side, ovS, null,
        a => box(a, Hs - top - .02, ct, s < 0 ? M.shelter403Side : M.shelter403SideR, -s * a / 2, 0, 0),
        b => box(b, Hs - top - .02, ct, M.shelterBlack, -s * b / 2, 0, 0));
      c.pv.position.set(s * (W / 2 - .1), y0 + (Hs - top) / 2 - .01, depth - ct / 2); c.sub.position.x = -s * Math.max(.05, side - ovS); g.add(c.pv); return { ...c, s }; });
    const topC = curtain(top, ovT, null, a => box(W, a, ct, M.shelter403Top, 0, -a / 2, 0), b => box(W, b, ct, M.shelterBlack, 0, -b / 2, 0));
    topC.pv.position.set(0, y0 + Hs, depth - ct / 2); topC.sub.position.y = -Math.max(.05, top - ovT); g.add(topC.pv);
    const fold = t => { const e = ease(t) * Math.PI / 2; sideC.forEach(({ sub, s }) => { sub.rotation.y = -s * e; }); topC.sub.rotation.x = e; };
    animate = fold;
    [-1, 1].forEach(s => fb.add(box(.05, Hs, .015, trim, s * (W / 2 - .025), y0 + Hs / 2, depth + .005, { shadow: false })));
    fb.add(box(W, .05, .015, trim, 0, y0 + Hs - .025, depth + .005, { shadow: false }));
    [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.TorusGeometry(.04, .006, 8, 16), M.galvDark); r.position.set(s * (W / 2 - side - .1), y0 + Hs - top + .05, depth + .02); fb.add(r); });
    if (S.type === 'inflTop') { const cushion = rbox(W - .2, .55, depth - .15, .08, M.cushion, 0, y0 + Hs - top - .25, depth / 2); cushion.userData.dynamic = true; g.add(cushion); cushion.scale.y = .25; animate = t => { fold(t); const e = ease(t); cushion.scale.y = .25 + .75 * e; cushion.position.y = y0 + Hs - top - .1 - (.55 * cushion.scale.y) / 2; }; }
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
  // Vehicle restraints sit BESIDE the truck lane (right-hand side seen from the yard), where the right wheel guide would be:
  // a long galvanised ground rail with the domed red-banded cap at the yard end; the blocking arm rides along the rail to the
  // rearmost wheel and swings under the trailer in front of it (505NG automatic, 503NG PowerLock manual).
  const g = new THREE.Group(); g.name = 'restraint'; let animate = () => {};
  if (st.restraint === 'none' || !st.restraint) return { group: g, animate };
  const T = TRUCKS[st.truck] || TRUCKS.truck; const blockZ = (T && T.blockZ) || 3.73;   // where the arm blocks: the gap in front of the rearmost wheel, measured from the vehicle rear (see vehicle wheel positions)
  const X = 1.62;                                   // rail centre line, just outside the outer wheel face (truck width 2.55 m)
  const zTarget = .34 + blockZ + .2;                // carriage position so that the arm (at -.2) sits at blockZ of the docked truck (truck rear at z = .34)
  const auto = st.restraint === 'auto';
  const z0 = .9, L = auto ? 4.6 : 3.6, zEnd = z0 + L;
  // ground rail: galvanised box profile with chamfered ends on a flat base plate
  g.add(box(.26, .22, L, M.galv, X, .11, z0 + L / 2));
  g.add(box(.44, .03, L + .3, M.galv, X, .015, z0 + L / 2, { shadow: false }));
  [z0, zEnd].forEach((z, k) => { const c = box(.26, .22, .3, M.galv, X, .11, z + (k ? .15 : -.15)); c.rotation.x = (k ? 1 : -1) * .5; g.add(c); });
  if (auto) {
    // domed cap with red band at the yard end
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.25, .27, .34, 24), M.galv); cap.position.set(X, .17, zEnd + .32); cap.castShadow = true; g.add(cap);
    g.add(sph(.25, M.galv, X, .34, zEnd + .32, 24)); const band = cyl(.272, .07, M.red, X, .3, zEnd + .32, 24); g.add(band);
  } else {
    // 503NG PowerLock: operator post at standing height with the control head (red/green light) at the yard end
    g.add(box(.22, .36, .4, M.galvDark, X, .18, zEnd + .2)); g.add(cyl(.025, 1.15, M.galv, X, .75, zEnd + .2, 10));
    g.add(box(.2, .1, .14, M.dark, X, 1.36, zEnd + .2)); const led = box(.05, .05, .02, M.green, X, 1.36, zEnd + .28, { shadow: false }); g.add(led); g.userData.led = led;
    g.add(box(.05, .05, .02, M.red, X, 1.36, zEnd + .12, { shadow: false }));
  }
  // carriage with the swing arm: parked at the yard end, travels to the rear wheel, then the arm swings across under the trailer
  const zPark = zEnd - .4;
  const carriage = new THREE.Group(); carriage.name = 'restraint_carriage'; carriage.position.set(X, .22, zPark); carriage.userData.dynamic = true; g.add(carriage);
  carriage.add(box(.5, .26, .56, M.galvDark, 0, .02, 0));   // housing straddles the rail, the telescopic tube sits inside it
  if (auto) carriage.add(box(.3, .09, .36, M.sign, 0, .2, 0, { shadow: false }));   // LS name plate on the housing
  // telescopic arm: it points across the lane and slides out of the housing sideways under the trailer (no swing)
  const arm = new THREE.Group(); arm.name = 'restraint_arm'; arm.position.set(-.17, .08, -.2); arm.rotation.y = -Math.PI / 2; carriage.add(arm);
  const outerL = .65; const outer = cyl(.055, outerL, M.galv, 0, 0, .3 - outerL / 2, 14); outer.rotation.x = Math.PI / 2; arm.add(outer);   // fixed tube: .3 m visible beside the housing, the rest inside it
  const collar = cyl(.068, .12, M.galv, 0, 0, .06, 14); collar.rotation.x = Math.PI / 2; arm.add(collar);
  const inner = new THREE.Group(); inner.name = 'restraint_arm_inner'; arm.add(inner);
  const innerL = .6; const tube = cyl(.042, innerL, M.galv, 0, 0, innerL / 2, 14); tube.rotation.x = Math.PI / 2; inner.add(tube);
  inner.add(rbox(.16, .14, .12, .02, M.bumperRubber, 0, 0, innerL - .04));
  const inMin = .3 - innerL, inMax = inMin + .4;   // retracted: pad flush with the fixed tube; extended: pad .7 m from the rail (short arm per Julian)
  inner.position.z = inMin;
  const travel = zPark - zTarget;
  animate = t => { carriage.position.z = zPark - travel * seg(t, 0, .6); inner.position.z = inMin + (inMax - inMin) * ease(seg(t, .6, 1)); };
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
  // dock traffic light 934 beside the shelter frame, higher up and further out so the driver sees it in the mirror
  const g = new THREE.Group(); const x = w / 2 + .92, y = DOCK_H + 2.5;
  g.add(box(.22, .58, .14, M.dark, x, y, .08)); g.add(box(.26, .06, .22, M.dark, x, y + .32, .1));   // housing with a sun hood on top
  const r = cyl(.075, .03, M.lampOff, x, y + .13, .16, 20); r.rotation.x = Math.PI / 2; const gr = cyl(.075, .03, M.green, x, y - .13, .16, 20); gr.rotation.x = Math.PI / 2; r.userData.dynamic = true; gr.userData.dynamic = true; g.add(r); g.add(gr);
  g.add(box(.05, .05, .1, M.galv, x, y, .0));   // wall bracket
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
  // red dock number on the facade, centred above the shelter head (as on the LS reference bays)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.95, .95), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); m.position.set(0, DOCK_H + h + 1.6, .012); m.castShadow = false; return m;
}

/* ---------------------------------------------------------------- Landscape around the site
   Terrain, access road with kerbs and pavement, chain-link fence with gate, hedges, light poles, tree impostors
   (Poly Haven island_tree_01/02 rendered from 8 angles in Blender, see ~/LS-work/blender/tree_impostors.py), parked van. */
const TREE_SPECIES = {   // frame metadata from the Blender render (frame_size = ortho width in metres, base_v = ground line from the frame centre)
  t01: { file: 'tree_01.webp', frame: 5.2285, baseV: .4808, height: 5.03 },
  t02: { file: 'tree_02.webp', frame: 4.3761, baseV: .3892, height: 3.41 },
};
const TREE_CACHE = new Map();
function treeTextures(id) {
  if (TREE_CACHE.has(id)) return TREE_CACHE.get(id);
  const sp = TREE_SPECIES[id]; const base = new THREE.TextureLoader().load('assets/tex/' + sp.file); base.colorSpace = THREE.SRGBColorSpace; base.anisotropy = 8; base.wrapS = base.wrapT = THREE.ClampToEdgeWrapping;
  const frames = []; for (let k = 0; k < 8; k++) { const t = base.clone(); t.repeat.set(.25, .5); t.offset.set((k % 4) * .25, k < 4 ? .5 : 0); t.needsUpdate = true; frames.push(t); }
  TREE_CACHE.set(id, frames); return frames;
}
function seeded(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
/* cross-billboard trees as instanced quads: per species 8 frames x 2 orientations */
export function buildTrees(spots) {
  const g = new THREE.Group(); g.userData.noMerge = true;
  const bySpecies = {};
  spots.forEach(sp => { (bySpecies[sp.id] = bySpecies[sp.id] || []).push(sp); });
  for (const [id, list] of Object.entries(bySpecies)) {
    const S = TREE_SPECIES[id]; const frames = treeTextures(id); const quad = new THREE.PlaneGeometry(1, 1);
    for (let k = 0; k < 8; k++) for (let o = 0; o < 2; o++) {
      const use = list.filter(sp => ((sp.frame + o * 2) % 8) === k); if (!use.length) continue;
      // the impostor frames were rendered in Blender under the same HDRI, so they carry their own lighting: unlit material, slightly lifted
      const mat = new THREE.MeshBasicMaterial({ map: frames[k], alphaTest: .45, side: THREE.DoubleSide, color: 0xc8c8c8, fog: true });
      const im = new THREE.InstancedMesh(quad, mat, use.length); im.castShadow = true; im.receiveShadow = false; im.userData.noMerge = true;
      im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: frames[k], alphaTest: .45 });
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
      use.forEach((sp, i) => { const size = S.frame * sp.scale; pos.set(sp.x, S.baseV * size, sp.z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.rot + o * Math.PI / 2); scl.set(size, size, 1); m.compose(pos, q, scl); im.setMatrixAt(i, m); });
      im.instanceMatrix.needsUpdate = true; g.add(im);
    }
  }
  return g;
}
function chainLinkTexture() {
  if (chainLinkTexture.t) return chainLinkTexture.t;
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = '#c9ced2'; ctx.lineWidth = 3; const p = 32;   // 256 px = 0.5 m, mesh 62 mm
  for (let i = -8; i < 16; i++) { ctx.beginPath(); ctx.moveTo(i * p, 0); ctx.lineTo(i * p + 256, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * p + 256, 0); ctx.lineTo(i * p, 256); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; chainLinkTexture.t = t; return t;
}
export function buildLandscape({ M, W, yardD, x0, bays, bayX, lite = false }) {
  const g = new THREE.Group(); const rnd = seeded(4711);
  const EX = 1600;   // terrain extent: reaches the fog so the HDRI ground never shows
  // terrain: near meadow (fine) + far meadow (coarse) with gentle undulation beyond 90 m
  const near = plane(W + 160, yardD + 160, M.meadow, 0, -.012, yardD / 2 + 20); g.add(near);
  const farGeo = new THREE.PlaneGeometry(EX, EX, 160, 160); const pa = farGeo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); const d = Math.hypot(x, y); const h = d > 110 ? (Math.sin(x * .021) * Math.cos(y * .017) * 1.6 + Math.sin(x * .07 + y * .05) * .5) * Math.min(1, (d - 110) / 80) : 0; pa.setZ(i, h); }
  farGeo.computeVertexNormals(); const uv = farGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * EX, uv.getY(i) * EX);
  const far = new THREE.Mesh(farGeo, M.meadowFar); far.rotation.x = -Math.PI / 2; far.position.set(0, -.03, 20); far.receiveShadow = true; g.add(far);
  // gravel maintenance strip along the facade sides and the back of the building
  g.add(plane(W + 6, 2.2, M.gravel, 0, -.005, -HALL_D - 1.1)); [-1, 1].forEach(s => g.add(plane(2.2, HALL_D + 2.4, M.gravel, s * (W / 2 + 1.1), -.005, -HALL_D / 2 + .1)));
  // kerb around the asphalt apron and a pavement in front of the fence line
  const halfW = W / 2 + 30;
  g.add(box(2 * halfW, .14, .25, M.kerb, 0, .06, yardD + .12, { shadow: false }));
  [-1, 1].forEach(s => g.add(box(.25, .14, yardD, M.kerb, s * halfW, .06, yardD / 2, { shadow: false })));
  // access road: 7 m wide, from the yard gate on the right side out to the horizon, with edge lines and kerbs
  const rx = W / 2 + 16, roadW = 7, roadL = EX / 2 - yardD;
  g.add(plane(roadW, roadL, M.road, rx, .002, yardD + roadL / 2));
  [-1, 1].forEach(s => { g.add(plane(.12, roadL, M.roadLine, rx + s * (roadW / 2 - .3), .006, yardD + roadL / 2)); g.add(box(.3, .12, roadL, M.kerb, rx + s * (roadW / 2 + .15), .05, yardD + roadL / 2, { shadow: false })); });
  for (let z = yardD + 2; z < yardD + roadL; z += 12) g.add(plane(.12, 6, M.roadLine, rx, .006, z + 3));
  g.add(plane(2.0, roadL, M.pavers, rx - roadW / 2 - 1.3, .004, yardD + roadL / 2));   // pavement on the yard side of the road
  // turn-in from the road into the yard (asphalt patch over the kerb line)
  g.add(plane(roadW + 6, 6, M.road, rx, .003, yardD + 3));
  // chain-link fence (2 m) along the yard front and sides, gate opening at the road
  const fenceMat = new THREE.MeshStandardMaterial({ map: chainLinkTexture(), transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .5, metalness: .6, color: 0xd8dcdf });
  const fence = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1); const geo = new THREE.PlaneGeometry(len, 2.0); const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * len * 2, u.getY(i) * 4);
    const m = new THREE.Mesh(geo, fenceMat); m.position.set((x1 + x2) / 2, 1.0, (z1 + z2) / 2); m.rotation.y = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2; m.castShadow = false; m.userData.noMerge = true; g.add(m);
    const rail = box(len, .05, .05, M.poleGalv, 0, 0, 0); rail.position.copy(m.position); rail.position.y = 2.0; rail.rotation.y = m.rotation.y; g.add(rail);   // top rail
    for (let t = 0; t <= len + .01; t += 2.5) { const x = x1 + (x2 - x1) * t / len, z = z1 + (z2 - z1) * t / len; g.add(cyl(.03, 2.1, M.poleGalv, x, 1.05, z, 10)); } };
  const gateX1 = rx - roadW / 2 - 2, gateX2 = rx + roadW / 2 + 1;
  fence(-halfW, yardD + .6, gateX1, yardD + .6); fence(gateX2, yardD + .6, halfW, yardD + .6);
  fence(-halfW, yardD + .6, -halfW, -HALL_D - 6); fence(halfW, yardD + .6, halfW, -HALL_D - 6);
  // sliding gate, open: parked along the fence inside the yard
  const gate = new THREE.Group(); gate.position.set(gateX1 - 6, 0, yardD - .2); g.add(gate);
  gate.add(box(11, .08, .08, M.poleGalv, 5.5, 2.0, 0)); gate.add(box(11, .08, .08, M.poleGalv, 5.5, .12, 0)); for (let x = 0; x <= 11; x += .14) gate.add(box(.03, 1.9, .03, M.poleGalv, x, 1.06, 0, { shadow: false }));
  gate.add(box(.16, 2.4, .16, M.poleGalv, 11.2, 1.2, 0)); gate.add(box(.16, 2.4, .16, M.poleGalv, -.2, 1.2, 0));
  // hedge inside the fence along the front (not across the gate) and clipped bushes near the road
  for (let x = -halfW + 2; x < halfW - 2; x += 1.6) { if (x > gateX1 - 8 && x < gateX2 + 2) continue; const h = .9 + rnd() * .35; const b = rbox(1.7, h, .9 + rnd() * .3, .2, M.hedge, x, h / 2 - .05, yardD - 1.2); b.rotation.y = (rnd() - .5) * .3; g.add(b); }
  // light poles along the yard front and the road
  const pole = (x, z, rot) => { g.add(cyl(.07, 8, M.poleGalv, x, 4, z, 12)); const arm = box(1.6, .08, .1, M.poleGalv, x, 8, z); arm.rotation.y = rot; arm.translateX(-.8); g.add(arm); const head = box(.6, .08, .26, M.dark, 0, 0, 0); head.position.set(x, 7.95, z); head.rotation.y = rot; head.translateX(-1.5); g.add(head); };
  for (let x = -halfW + 8; x < halfW - 4; x += 22) pole(x, yardD - 3, 0);
  for (let z = yardD + 20; z < yardD + 200; z += 32) pole(rx + roadW / 2 + 1.2, z, Math.PI / 2);
  // car park on the left with white lines and a parked van
  const px = -W / 2 - 14; for (let i = 0; i < 6; i++) g.add(plane(.1, 5, M.roadLine, px + i * 2.6, .005, yardD - 4));
  const van = (VEHICLES.van && VEHICLES.van.clone()) || null; if (van) { van.position.set(px + 1.3 + 2.6 * 2, 0, yardD - 1.6); van.rotation.y = Math.PI; van.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.shared = true; } }); van.userData.noMerge = true; g.add(van); }
  // trees: a belt of mixed broadleaf trees 60-150 m out, denser behind the hall, singles along the road and in the corners
  const spots = [];
  const add = (x, z, big) => spots.push({ id: rnd() < .55 ? 't01' : 't02', x, z, frame: Math.floor(rnd() * 8), rot: rnd() * Math.PI, scale: (big ? 2.0 : 1.5) + rnd() * .9 });
  for (let i = 0; i < (lite ? 90 : 180); i++) { const a = rnd() * Math.PI * 2; const r = 70 + rnd() * 110; const x = Math.cos(a) * r, z = 20 + Math.sin(a) * r; if (z > yardD + 4 && Math.abs(x - rx) < roadW + 6) continue; if (z > -HALL_D - 4 && z < yardD + 4 && Math.abs(x) < halfW + 6) continue; add(x, z, true); }
  for (let i = 0; i < (lite ? 20 : 40); i++) { const a = rnd() * Math.PI * 2; const r = 160 + rnd() * 120; add(Math.cos(a) * r, 20 + Math.sin(a) * r, true); }
  [[-halfW - 6, yardD + 8], [-halfW - 9, yardD + 24], [halfW + 6, yardD + 10], [rx - roadW / 2 - 7, yardD + 40], [rx - roadW / 2 - 8, yardD + 75], [rx + roadW / 2 + 9, yardD + 58], [-halfW - 5, -HALL_D - 10], [halfW + 7, -HALL_D - 14]].forEach(([x, z]) => add(x, z, false));
  g.add(buildTrees(spots));
  return g;
}

/* ---------------------------------------------------------------- LS control units (930 door / 932 dock leveller), after the pictures on loading-systems.com/en-gb/products/controls */
const CU = { housing: null, panel: null, logoImg: null, btnTex: new Map() };
function cuIcon(kind) {
  if (CU.btnTex.has(kind)) return CU.btnTex.get(kind);
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  ctx.fillStyle = kind === 'R' || kind === 'stop' ? '#c8102e' : '#2e3134'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1c1e'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  const arrow = rot => { ctx.save(); ctx.translate(64, 64); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(26, -4); ctx.lineTo(10, -4); ctx.lineTo(10, 32); ctx.lineTo(-10, 32); ctx.lineTo(-10, -4); ctx.lineTo(-26, -4); ctx.closePath(); ctx.fill(); ctx.restore(); };
  if (kind === 'up') arrow(0); else if (kind === 'down') arrow(Math.PI); else if (kind === 'right') arrow(Math.PI / 2); else if (kind === 'left') arrow(-Math.PI / 2);
  else if (kind === 'R') { ctx.font = 'bold 72px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R', 64, 68); }
  else if (kind === 'stop') { ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(64, 64, 28, 0, Math.PI * 2); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.center.set(.5, .5); t.rotation = Math.PI / 2;   // cylinder cap UVs are turned 90° once the button faces the hall
  CU.btnTex.set(kind, t); return t;
}
function cuPanel(type) {
  // front face texture: dark panel with red 7-segment display, LS logo, pictogram labels; buttons are real geometry
  const W = 640, H = 896; const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2d30'; ctx.fillRect(0, 0, W, H);                                  // housing front
  const px = 52, py = 52, pw = W - 104, ph = type === 'lev' ? 560 : 500;
  ctx.fillStyle = '#1c1f22'; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill();   // inset panel
  ctx.strokeStyle = '#3a3d41'; ctx.lineWidth = 3; ctx.stroke();
  // display
  ctx.fillStyle = '#121416'; ctx.beginPath(); ctx.roundRect(px + 28, py + 36, 170, 56, 6); ctx.fill();
  ctx.fillStyle = '#ff2d3a'; ctx.font = 'bold 44px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(type === 'lev' ? '0 0 5' : '0 0 0 0', px + 44, py + 66);
  // pictogram labels (white) and a yellow warning label as on the 932
  const label = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke(); };
  if (type === 'lev') {
    label(px + 28, py + 300, 150, 70, '#f4f4f2'); ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px + 44, py + 352); ctx.lineTo(px + 104, py + 352); ctx.lineTo(px + 150, py + 330); ctx.stroke();   // leveller profile glyph
    ctx.beginPath(); ctx.moveTo(px + 44, py + 352); ctx.lineTo(px + 80, py + 322); ctx.lineTo(px + 110, py + 322); ctx.stroke();
    label(px + 28, py + 400, 150, 70, '#f6c400'); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(px + 58, py + 460); ctx.lineTo(px + 86, py + 412); ctx.lineTo(px + 114, py + 460); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6c400'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center'; ctx.fillText('!', px + 86, py + 446);
  }
  // pictograms next to the buttons (small white squares with a glyph)
  const rows = type === 'lev' ? [['up', 'lev'], ['right', 'lip'], ['left', 'lip'], ['R', 'lev']] : [['up', 'door'], ['stop', ''], ['down', 'door']];
  const by0 = py + 70, dy = type === 'lev' ? 120 : 150;
  rows.forEach(([k, g], i) => { if (!g) return; const y = by0 + i * dy; label(px + pw - 120, y - 24, 56, 48, '#f4f4f2'); ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath();
    if (g === 'lev') { ctx.moveTo(px + pw - 110, y + 12); ctx.lineTo(px + pw - 84, y + 12); ctx.lineTo(px + pw - 72, y - 2); }
    else if (g === 'lip') { ctx.moveTo(px + pw - 110, y + 10); ctx.lineTo(px + pw - 90, y + 10); ctx.lineTo(px + pw - 72, y + 10); ctx.moveTo(px + pw - 80, y + 2); ctx.lineTo(px + pw - 72, y + 10); ctx.lineTo(px + pw - 80, y + 18); }
    else { ctx.rect(px + pw - 108, y - 14, 32, 28); ctx.moveTo(px + pw - 108, y - 4); ctx.lineTo(px + pw - 76, y - 4); ctx.moveTo(px + pw - 108, y + 6); ctx.lineTo(px + pw - 76, y + 6); }
    ctx.stroke(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // LS logo drawn when the image is in
  const drawLogo = img => { ctx.drawImage(img, px + 28, py + 150, 170, 170 * img.height / img.width); t.needsUpdate = true; };
  if (CU.logoImg) drawLogo(CU.logoImg); else new THREE.ImageLoader().load('assets/img/ls_logo_white.png', img => { CU.logoImg = img; drawLogo(img); });
  return t;
}
export function buildControlUnit({ M, type = 'lev' }) {
  // housing 250 x 350 x 110 mm, front at +z (rotate the group to face the hall)
  const g = new THREE.Group(); const W = .25, H = .35, D = .11;
  if (!CU.housing) CU.housing = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: .6, metalness: .05 });
  const front = new THREE.MeshStandardMaterial({ map: cuPanel(type), roughness: .55, metalness: .05 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 3, .012), [CU.housing, CU.housing, CU.housing, CU.housing, front, CU.housing]); body.castShadow = true; g.add(body);
  [-1, 1].forEach(sx => [-1, 1].forEach(sy => { const sc = cyl(.009, .004, M.black, sx * (W / 2 - .018), sy * (H / 2 - .018), D / 2 + .001, 12, { shadow: false }); sc.rotation.x = Math.PI / 2; g.add(sc); }));   // corner screws
  // buttons: real cylinders with icon caps
  const rows = type === 'lev' ? ['up', 'right', 'left', 'R'] : ['up', 'stop', 'down'];
  const pxm = W * (52 / 640), pym = H * (52 / 896); const bx = -W / 2 + W * ((640 - 104 - 160) / 640) + .0; const by0 = H / 2 - H * ((52 + 70) / 896); const dy = H * ((type === 'lev' ? 120 : 150) / 896);
  rows.forEach((k, i) => { const cap = new THREE.MeshStandardMaterial({ map: cuIcon(k), roughness: .5 }); const side = new THREE.MeshStandardMaterial({ color: k === 'R' || k === 'stop' ? 0xa30d26 : 0x1f2224, roughness: .5 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.0135, .0135, .012, 24), [side, cap, side]); b.rotation.x = Math.PI / 2; b.position.set(bx, by0 - i * dy, D / 2 + .006); b.castShadow = false; g.add(b);
    const ring = cyl(.016, .003, M.black, bx, by0 - i * dy, D / 2 + .0015, 24, { shadow: false }); ring.rotation.x = Math.PI / 2; g.add(ring); });
  if (type === 'lev') {   // rotary main switch on a yellow plate, bottom left
    const sx = -W / 2 + .06, sy = -H / 2 + .055;
    g.add(box(.062, .062, .004, M.yellow, sx, sy, D / 2 + .002, { shadow: false }));
    const knob = cyl(.021, .014, M.red, sx, sy, D / 2 + .011, 24, { shadow: false }); knob.rotation.x = Math.PI / 2; g.add(knob);
    g.add(box(.012, .048, .012, M.red, sx, sy, D / 2 + .024, { shadow: false }));   // handle
  }
  [-1, 1].forEach(sx => { const gl = cyl(.011, .022, M.lampOff, sx * .055, -H / 2 - .011, 0, 12, { shadow: false }); g.add(gl); });   // cable glands
  g.userData.size = { W, H, D }; return g;
}
export function buildControlUnits({ M, st, w }) {
  // 'basic': door control 930 above the leveller control 932; 'combi' / 'dockMgmt': the two housings joined side by side (as on the LS integrated-control picture)
  const g = new THREE.Group(); const lev = buildControlUnit({ M, type: 'lev' }); const door = buildControlUnit({ M, type: 'door' });
  if (st.dockControl === 'basic') { door.position.set(0, .37, 0); lev.position.set(0, 0, 0); g.add(door, lev); }
  else { door.position.set(-.127, 0, 0); lev.position.set(.127, 0, 0); g.add(door, lev); }
  return g;
}

/* ---------------------------------------------------------------- Trucks (Blender library, see ~/LS-work/blender/vehicles.py) */
export function buildTruck({ M, kind, trailerOnly = false }) {
  const g = new THREE.Group(); g.userData.dynamic = true; const T = TRUCKS[kind]; if (!T || kind === 'none') return { group: g, animate: () => {}, doors: () => {}, len: 0, bedH: null };
  const tpl = (trailerOnly && VEHICLES[T.model + '_proc']) || VEHICLES[T.model] || VEHICLES[T.model + '_proc']; const wheels = [];
  let doors = () => {}; let planes = null;
  if (tpl) {
    const v = tpl.clone(); if (T.scale) v.scale.setScalar(T.scale); g.add(v);
    v.traverse(o => { if (o.name.startsWith('wheel')) wheels.push(o); if (trailerOnly && o.name === 'tractor') o.visible = false; });
    if (!trailerOnly && T.doorW) {
      // Rear doors: the scanned model has them painted shut. Clip that slab of the shell away (world-space planes, intersection = the door
      // opening only), put a lit interior behind it and hang two door leaves that fold 270° against the sides as the truck arrives.
      const zF = T.doorFaceZ, xo = T.doorW, yB = T.bedH + .02, yT = T.doorTop;
      planes = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)];
      v.traverse(o => { if (o.isMesh && o.material && o.material.map && !/decal/.test(o.name)) { o.material = o.material.clone(); o.material.clippingPlanes = planes; o.material.clipIntersection = true; o.material.side = THREE.DoubleSide; } });
      const depth = T.boxLen || Math.min(4, T.len * .3), inW = 2 * xo - .02, inH = yT - yB;
      const ply = new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: .88, metalness: 0 });   // dark grey plywood floor
      const inside = new THREE.Group(); inside.position.set(0, yB, zF); g.add(inside);
      inside.add(box(inW, .03, depth, ply, 0, -.015, depth / 2));                                         // plywood floor
      for (let z = 1.2; z < depth - .3; z += 1.22) inside.add(box(inW - .04, .002, .012, M.plastic, 0, .002, z, { shadow: false }));   // sheet joints
      [-1, 1].forEach(sx => inside.add(box(.02, inH, depth, M.trailerRoof, sx * (inW / 2 - .01), inH / 2, depth / 2, { shadow: false })));
      inside.add(box(inW, .02, depth, M.trailerRoof, 0, inH - .01, depth / 2, { shadow: false }));       // ceiling
      inside.add(box(inW, inH, .02, M.plastic, 0, inH / 2, depth - .01, { shadow: false }));             // end wall of the visible interior
      const lamp = new THREE.PointLight(0xfff4e0, 0, 9, 1.4); lamp.position.set(0, inH - .15, 1.6); inside.add(lamp); inside.userData.lamp = lamp;
      const lamp2 = new THREE.PointLight(0xfff4e0, 0, 9, 1.4); lamp2.position.set(0, inH - .15, Math.min(depth - 1, 5.5)); inside.add(lamp2);
      const hinges = [-1, 1].map(sx => { const hg = new THREE.Group(); hg.position.set(sx * (xo + .08), yB, zF - .03); g.add(hg);
        const leaf = box(xo + .06, inH - .04, .04, M.trailerBox, -sx * (xo + .06) / 2, inH / 2, 0); hg.add(leaf);
        [.3, inH - .3].forEach(y => hg.add(box(.05, .22, .06, M.galvDark, -sx * (xo + .06) / 2, y, .04)));   // lock bars
        return { hg, sx }; });
      doors = (t, maxA = Math.PI * 1.5) => { const a = maxA * ease(t); hinges.forEach(({ hg, sx }) => { hg.rotation.y = sx > 0 ? -a : a; }); lamp.intensity = lamp2.intensity = t > .5 ? 2.5 : 0; };
    }
  } else {   // fallback if the library did not load: a plain box on wheels
    const L = T.len * .75, W = 2.5, H = 2.7, bed = T.bedH; g.add(box(W, H, L, M.trailerBox, 0, bed + H / 2, L / 2)); g.add(box(W, .35, L, M.chassis, 0, bed - .18, L / 2));
    [1.3, 2.6, 3.9].forEach(z => [-1, 1].forEach(s => { const t = cyl(T.wheelR, .32, M.tyre, s * (W / 2 - .25), T.wheelR, z, 24); t.rotation.z = Math.PI / 2; g.add(t); wheels.push(t); }));
  }
  const wp = new THREE.Vector3();
  function updatePlanes() {
    if (!planes) return; g.updateWorldMatrix(true, false); g.getWorldPosition(wp);
    planes[0].constant = -(wp.z + T.doorFaceZ + .32); planes[1].constant = wp.y + T.bedH + .02; planes[2].constant = -(wp.y + T.doorTop);
    planes[3].constant = -(wp.x + T.doorW); planes[4].constant = wp.x - T.doorW;
  }
  updatePlanes();
  return { group: g, animate: dz => { wheels.forEach(w => { w.rotation.x -= dz / T.wheelR; }); updatePlanes(); }, doors, len: T.len, bedH: T.bedH };
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
  const stepDown = st.leveller === 'stepped' ? .5 : 0, stepW = (st.levellerW || 2000) / 1000 + .1;   // stepped dock: slit in the floor in front of the leveller (leveller width, 50 cm deep); the straight, taller door runs down into it and disappears into the floor at the sides
  // stepped dock: the wall opening is a T (lowered only over the leveller-wide slit); beside the slit the wall stays solid concrete and the door's lower edges run into a thin slot in it
  const openings = []; for (let i = 0; i < bays; i++) openings.push({ x: bayX(i) - x0 - w / 2, y: DOCK_H, w, h, notch: stepDown ? { x: (w - stepW) / 2, w: stepW, d: stepDown } : null, faceNotch: stepDown ? { x: (w - stepW) / 2, w: stepW, d: stepDown } : null });
  // mandoor (pedestrian door) next to the first bay
  if (st.mandoor && st.mandoor !== 'none' && !studio) openings.push({ x: bayX(0) - x0 - w / 2 - 1.9, y: DOCK_H, w: (st.mandoorW || 1000) / 1000, h: (st.mandoorH || 2125) / 1000 });
  // facade: dock wall (concrete) up to DOCK_H, sandwich panels above
  const facMat = st.facade === 'panel_dark' ? M.facade.clone() : st.facade === 'panel_white' ? M.facade.clone() : st.facade === 'brick' ? new THREE.MeshStandardMaterial({ ...mats.pbr('brick', 2.4), roughness: 1 }) : M.facade;
  if (st.facade === 'panel_dark') facMat.color.set(0x4a4f53); if (st.facade === 'panel_white') facMat.color.set(0xeceeee);
  if (studio) {
    // product studio: no hall, only the equipment on a concrete dock block (U-shaped round the leveller pit)
    // cut-out exactly the pit footprint (pit = plate + .02 each way, frame angle .04), measured from the plate edge at plateEdgeZ
    const len = (st.levellerLen || 2500) / 1000 + .06, pw = (st.levellerW || 2000) / 1000 + .08, bw = w + 2.6, bd = len + 1.6, zf = -WALL_T - .12 + .03;
    [-1, 1].forEach(sx => g.add(box((bw - pw) / 2, DOCK_H, bd, M.plinth, sx * (pw / 2 + (bw - pw) / 4), DOCK_H / 2, zf - bd / 2)));
    g.add(box(pw, DOCK_H, bd - len, M.plinth, 0, DOCK_H / 2, zf - len - (bd - len) / 2));          // behind the pit
    const fh = DOCK_H - stepDown, sw = stepDown ? stepW : pw;                                          // front strip (dock face): lowered over the slit width on a stepped dock
    g.add(box(sw, fh, .3, M.plinth, 0, fh / 2, zf + .15)); [-1, 1].forEach(sx => g.add(box((bw - sw) / 2, DOCK_H, .3, M.plinth, sx * (sw / 2 + (bw - sw) / 4), DOCK_H / 2, zf + .15)));
    g.add(box(pw, DOCK_H - .78, len, M.plinth, 0, (DOCK_H - .78) / 2, zf - len / 2));                // under the pit
  } else {
  const front = wall(W, H + .4, WALL_T, openings, facMat); front.position.set(x0, 0, 0); g.add(front);
  // dock wall: concrete face below the openings, split per bay
  let px = x0; openings.forEach(o => { const ox = x0 + o.x; if (ox - px > .01) g.add(box(ox - px, DOCK_H + .02, .06, M.plinth, (ox + px) / 2, (DOCK_H + .02) / 2, .03));
    if (o.faceNotch) { const n = o.faceNotch;   // stepped dock: concrete face under the door, open only over the leveller-wide slit
      g.add(box(n.x, DOCK_H + .02, .06, M.plinth, ox + n.x / 2, (DOCK_H + .02) / 2, .03)); g.add(box(o.w - n.x - n.w, DOCK_H + .02, .06, M.plinth, ox + n.x + n.w + (o.w - n.x - n.w) / 2, (DOCK_H + .02) / 2, .03));
      g.add(box(n.w, DOCK_H - n.d, .06, M.plinth, ox + n.x + n.w / 2, (DOCK_H - n.d) / 2, .03)); }
    else if (st.leveller !== 'none') {   // leveller runs to the dock edge: the face is lowered over the plate width so the platform front shows at the edge
      const pw = (st.levellerW || 2000) / 1000 + .08, sx = (o.w - pw) / 2;
      g.add(box(sx, DOCK_H + .02, .06, M.plinth, ox + sx / 2, (DOCK_H + .02) / 2, .03)); g.add(box(sx, DOCK_H + .02, .06, M.plinth, ox + o.w - sx / 2, (DOCK_H + .02) / 2, .03));
      g.add(box(pw, DOCK_H - .08, .06, M.plinth, ox + o.w / 2, (DOCK_H - .08) / 2, .03));
    } else g.add(box(o.w, DOCK_H + .02, .06, M.plinth, ox + o.w / 2, (DOCK_H + .02) / 2, .03));   // concrete face under the door
    px = ox + o.w; }); if (x0 + W - px > .01) g.add(box(x0 + W - px, DOCK_H + .02, .06, M.plinth, (x0 + W + px) / 2, (DOCK_H + .02) / 2, .03));
  // roof edge / parapet and gutter
  g.add(box(W + .4, .5, .5, M.dark, 0, H + .4, -.1)); g.add(box(W + .6, .08, .14, M.galv, 0, H + .66, .1, { shadow: false }));
  // side walls, back wall, floor, ceiling, trusses, lights
  const inner = M.facadeInner;
  g.add(box(WALL_T, H, D, facMat, x0 + WALL_T / 2, H / 2, -D / 2)); g.add(box(WALL_T, H, D, facMat, -x0 - WALL_T / 2, H / 2, -D / 2));
  g.add(box(W, H, WALL_T, inner, 0, H / 2, -D + WALL_T / 2));
  if (st.leveller !== 'none') {   // hall floor with the leveller pits cut out (plus the stepped-dock step strips), one per bay
    const fw = W - .6, fd = D - .6; const sh = new THREE.Shape(); sh.moveTo(-fw / 2, -fd / 2); sh.lineTo(fw / 2, -fd / 2); sh.lineTo(fw / 2, fd / 2); sh.lineTo(-fw / 2, fd / 2); sh.closePath();
    const isStepped = st.leveller === 'stepped'; const pLen = (st.levellerLen || 2500) / 1000 + .02, pW = (st.levellerW || 2000) / 1000 + .04; const pEdge = isStepped ? -WALL_T - .12 : 0;
    const addHole = (cx, hw, z1, z2) => { const y1 = -z1 - D / 2, y2 = -z2 - D / 2; /* local y = -(world z) - D/2 */ const hole = new THREE.Path(); hole.moveTo(cx - hw, y1); hole.lineTo(cx + hw, y1); hole.lineTo(cx + hw, y2); hole.lineTo(cx - hw, y2); hole.closePath(); sh.holes.push(hole); };
    for (let i = 0; i < bays; i++) { const cx = bayX(i);
      if (isStepped) addHole(cx, stepW / 2, -WALL_T - .02, -WALL_T - .14);   /* step strip; must lie inside the floor plane (front edge at -WALL_T-.3+.3) */
      addHole(cx, pW / 2, Math.min(pEdge, -WALL_T - .04) - (isStepped ? .12 : 0), pEdge - pLen - .01); }   // pit
    const fg = new THREE.ShapeGeometry(sh, 2); const uv = fg.attributes.uv, pa = fg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pa.getX(i), pa.getY(i));
    const fm = new THREE.Mesh(fg, M.floor); fm.rotation.x = -Math.PI / 2; fm.position.set(0, DOCK_H, -D / 2); fm.receiveShadow = true; g.add(fm);
  } else g.add(plane(W - .6, D - .6, M.floor, 0, DOCK_H, -D / 2));
  g.add(box(W, .3, D, M.ceiling, 0, H + .15, -D / 2, { shadow: false }));
  for (let z = -3; z > -D; z -= 6) { g.add(box(W - .6, .5, .12, M.truss, 0, H - .3, z, { shadow: false })); if (!lite) for (let k = 0; k < 14; k++) { const d = box(.05, .45, .05, M.truss, x0 + .6 + k * (W - 1.2) / 13, H - .3, z, { shadow: false }); d.rotation.z = (k % 2 ? 1 : -1) * .6; g.add(d); } }
  const lightMeshes = [];
  if (st.interiorLight === 'led_line') { for (let i = 0; i < 3; i++) { const z = -4 - i * 7; const l = box(W - 2, .06, .14, M.lamp, 0, H - .62, z, { shadow: false }); g.add(l); lightMeshes.push(l); if (!lite || i < 2) { const pl = new THREE.PointLight(0xfff4e0, 60, 26, 1.6); pl.position.set(0, H - 1, z); g.add(pl); } } }
  else if (st.interiorLight === 'highbay') { for (let i = 0; i < 3; i++) for (let k = 0; k < Math.max(2, Math.round(W / 9)); k++) { const x = x0 + 4.5 + k * (W - 9) / Math.max(1, Math.round(W / 9) - 1), z = -4 - i * 7; const l = cyl(.22, .12, M.lamp, x, H - .7, z, 20, { shadow: false }); g.add(l); lightMeshes.push(l); g.add(cyl(.26, .1, M.dark, x, H - .6, z, 20, { shadow: false })); if (!lite || (i === 1)) { const pl = new THREE.PointLight(0xfff4e0, 45, 20, 1.6); pl.position.set(x, H - 1.1, z); g.add(pl); } } }
  }   // end of hall (not in the studio)
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
  if (!studio) g.add(plane(W + 60, yardD, M.asphalt, 0, 0, yardD / 2));
  if (!studio) {
    for (let i = 0; i < bays; i++) [-1, 1].forEach(s => g.add(plane(.12, 18, M.yellowStripe, bayX(i) + s * (1.5), .004, 9.5)));
    g.add(buildLandscape({ M, W, yardD, x0, bays, bayX, lite }));
  }
  // a parked trailer (without tractor) at the far end of the yard for scale
  if (!studio && bays > 1 && !lite) { const pt = buildTruck({ M, kind: 'truck', trailerOnly: true }); pt.group.position.set(x0 - 6, 0, 14); pt.group.rotation.y = .55; g.add(pt.group); }
  // per bay
  for (let i = 0; i < bays; i++) {
    const cx = bayX(i); const bay = new THREE.Group(); bay.position.x = cx; g.add(bay);
    // dock edge plate
    const door = buildDoor({ M, st: { ...st, bayNo: i + 1, studio, stepDown }, w, h: h + stepDown }); bay.add(door.group); rigs.doors.push(door);
    if (stepDown && !studio) {   // the notch through the wall is concrete, not facade panel: sill and side cheeks
      bay.add(box(stepW + .02, .02, WALL_T + .02, M.plinth, 0, DOCK_H - stepDown + .01, -WALL_T / 2, { shadow: false }));
      [-1, 1].forEach(sx => bay.add(box(.02, stepDown + .02, WALL_T + .02, M.plinth, sx * (stepW / 2 + .01), DOCK_H - stepDown / 2, -WALL_T / 2, { shadow: false })));
    }
    if (st.leveller !== 'stepped') bay.add(box(w + .7, .14, .02, M.yellowStripe, 0, DOCK_H - .2, .07, { shadow: false }));   // yellow dock-edge marking (not on a stepped dock: the notch cuts through it)
    const truckKind = st.truck; const bedH = TRUCKS[truckKind] && truckKind !== 'none' ? TRUCKS[truckKind].bedH : null;
    const truckRearZ = bedH != null ? .34 + (TRUCKS[truckKind].doorFaceZ || 0) : null;
    const lev = buildLeveller({ M, st, w, bedH, truckRearZ }); bay.add(lev.group); rigs.levellers.push(lev);
    const sh = buildShelter({ M, st, w, h }); bay.add(sh.group); rigs.shelters.push(sh);
    if (st.leveller !== 'stepped') bay.add(buildBumpers({ M, st, w }));   // stepped dock: no bumpers in front of the dock
    const rs = buildRestraint({ M, st, w }); bay.add(rs.group); rigs.restraints.push(rs);
    const dl = buildDockLight({ M, st, w, h }); bay.add(dl.group); rigs.lights.push(dl);
    if (st.trafficLight) { const tl = buildTrafficLight({ M, w, h }); bay.add(tl.group); rigs.traffic.push(tl); }
    if (st.numbers && st.numberStyle === 'plate' && !studio) bay.add(numberPlate({ M, n: i + 1, w, h }));
    if (st.bollards) [-1, 1].forEach(s => { const b = part('bollard', s * (w / 2 + .85), 0, .55); if (b) bay.add(b); else bay.add(cyl(.08, 1.1, M.yellow, s * (w / 2 + .85), .55, .55, 16)); });
    if (st.wheelGuides) [-1, 1].forEach(s => { if (s > 0 && st.restraint && st.restraint !== 'none') return;   // the restraint rail takes the right-hand side
      const x = s * 1.55; const t = cyl(.06, 4.6, M.yellow, x, .18, 4.6, 12); t.rotation.x = Math.PI / 2; bay.add(t); [2.5, 6.6].forEach(z => bay.add(cyl(.06, .3, M.yellow, x, .1, z, 12))); });
    // dock control box inside next to the door
    const cu = buildControlUnits({ M, st, w }); cu.position.set(w / 2 + .52, DOCK_H + 1.35, -WALL_T - .056); cu.rotation.y = Math.PI; bay.add(cu);   // LS 930/932 control units at hand height next to the door
    // truck
    if (truckKind !== 'none' && (studio ? true : (st.truckBays === 'all' || i === (st.activeBay || 0)))) {
      const tr = buildTruck({ M, kind: truckKind }); tr.group.position.set(0, 0, 0); bay.add(tr.group); tr.animate(0); rigs.trucks.push({ ...tr, bay: i });
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
  const g = new THREE.Group(); const r = Math.max(70, dims.W * 3);   // large stage so the camera can orbit and zoom out behind the equipment
  const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 72), new THREE.MeshStandardMaterial({ color: 0xe2e3e5, roughness: .35 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.001; floor.receiveShadow = true; g.add(floor);
  const s = new THREE.Shape(); s.moveTo(-3, 0); s.lineTo(0, 0); s.absarc(0, 3, 3, -Math.PI / 2, 0, false); s.lineTo(3, 60); s.lineTo(3.6, 60); s.lineTo(3.6, -.4); s.lineTo(-3, -.4); s.closePath();
  const cyc = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: r * 2, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: .95 }));
  cyc.rotation.y = Math.PI / 2; cyc.position.set(-r, -.002, -r * .75); cyc.receiveShadow = true; cyc.material.side = THREE.DoubleSide; g.add(cyc);   // cyclorama far behind, visible from both sides
  return g;
}
