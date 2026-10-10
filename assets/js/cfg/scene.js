/* Loading Systems · Dock Studio scene: warehouse with N loading bays, doors, dock levellers, shelters, bumpers, restraints, lights, trucks.
   Units metres. X along the facade, Y up, +Z = yard (outside). Yard level y = 0, warehouse floor y = DOCK_H. Facade front face at z = 0. */
import * as THREE from 'three';
import { DOORS, LEVELLERS, SHELTERS, BUMPERS, TRUCKS, WINDOWS, FULLVISION, LIFT, LIFT_620 } from './catalog.js';

export const DOCK_H = 1.2;      // dock height above yard
export const PITCH = 4.2;       // bay pitch
export const WALL_T = .3;
export const HALL_D = 24;       // hall depth
export const HALL_H = 10;       // eaves height above warehouse floor
export const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

export const box = (w, h, d, mat, x = 0, y = 0, z = 0, opt = {}) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  m.castShadow = opt.shadow !== false; m.receiveShadow = opt.receive !== false; return m;
};
const cyl = (r, h, mat, x = 0, y = 0, z = 0, seg = 16, opt = {}) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y, z); m.castShadow = opt.shadow !== false; m.receiveShadow = true; return m; };
export const plane = (w, h, mat, x, y, z, rotX = -Math.PI / 2) => {
  const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  const m = new THREE.Mesh(g, mat); m.rotation.x = rotX; m.position.set(x, y, z); m.receiveShadow = true; return m;
};
/* vertical wall in XY with rectangular openings, extruded along -Z by t; placed with its left edge at x=0, bottom at y=0, front face at z=0 */
export function wall(w, h, t, openings, mat) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, h); s.closePath();
  openings.forEach(o => { const p = new THREE.Path(); p.moveTo(o.x, o.y); p.lineTo(o.x + o.w, o.y); p.lineTo(o.x + o.w, o.y + o.h); p.lineTo(o.x, o.y + o.h); p.closePath(); s.holes.push(p); });
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));   // metres already
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
export function dispose(obj) { obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }

/* ---------------------------------------------------------------- Door leaf per type */
function sectionalLeaf(w, h, ph, st, M, catalogWindows) {
  const g = new THREE.Group(); const n = Math.max(2, Math.round(h / ph)); const H = h / n; const parts = [];
  const mats = [M.doorEdge, M.doorEdge, M.doorEdge, M.doorEdge, M.door, M.doorInner];
  const fvIndex = st.fullvision !== 'none' ? n - 2 : -1;
  const winIndex = st.windows !== 'none' ? (fvIndex === n - 2 ? n - 3 : n - 2) : -1;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    if (i === fvIndex) {
      // Full-Vision section: aluminium frame with glazing bars every ~600 mm
      const fv = FULLVISION[st.fullvision]; const nb = Math.max(2, Math.round(w / .6));
      p.add(box(w, .05, .045, M.galv, 0, H / 2 - .025, 0)); p.add(box(w, .05, .045, M.galv, 0, -H / 2 + .025, 0));
      for (let k = 0; k <= nb; k++) p.add(box(.045, H - .1, .045, M.galv, -w / 2 + k * (w / nb), 0, 0));
      const pane = box(w - .06, H - .1, .01, fv.glass === 'mesh' ? M.mesh : M.glass, 0, 0, 0, { shadow: false }); p.add(pane);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, H - .006, .04), mats); body.castShadow = true; body.receiveShadow = true; p.add(body);
      // panel joint groove (dark line at the top of every panel)
      p.add(box(w, .008, .006, M.dark, 0, H / 2 - .004, .02, { shadow: false }));
      if (i === winIndex) {
        const win = WINDOWS[st.windows]; const count = Math.max(1, Math.min(4, Math.floor(w / 1.05))); const gap = w / count;
        for (let k = 0; k < count; k++) {
          const x = -w / 2 + gap * (k + .5);
          const frame = win.shape === 'oval' ? new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .05, 32).scale(win.w / 2 + .02, 1, win.h / 2 + .02), M.dark) : box(win.w + .04, win.h + .04, .05, M.dark, 0, 0, 0, { shadow: false });
          if (win.shape === 'oval') { frame.rotation.x = Math.PI / 2; }
          frame.position.set(x, 0, 0); frame.castShadow = false; p.add(frame);
          const glass = win.shape === 'oval' ? new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .056, 32).scale(win.w / 2, 1, win.h / 2), M.glass) : box(win.w, win.h, .056, M.glass, 0, 0, 0, { shadow: false });
          if (win.shape === 'oval') glass.rotation.x = Math.PI / 2; glass.position.set(x, 0, 0); glass.castShadow = false; p.add(glass);
        }
      }
    }
    p.position.y = H * i + H / 2; g.add(p); parts.push({ p, y0: H * i + H / 2 });
  }
  // wicket door outline + handle on panels 0..k
  if (st.wicket && st.wicket !== 'none') {
    const wd = .9, hd = Math.min(2.0, h - .3), x = Math.min(w / 2 - .7, .9);
    g.add(box(.012, hd, .05, M.dark, x - wd / 2, hd / 2, .02, { shadow: false })); g.add(box(.012, hd, .05, M.dark, x + wd / 2, hd / 2, .02, { shadow: false })); g.add(box(wd, .012, .05, M.dark, x, hd, .02, { shadow: false }));
    g.add(box(.03, .14, .03, M.steel, x - wd / 2 + .1, 1.05, .04, { shadow: false }));
    g.userData.wicket = { x, wd, hd };
  }
  // bottom rubber seal, flush handle
  g.add(box(w, .03, .05, M.black, 0, .015, 0, { shadow: false }));
  if (st.handle !== false) g.add(box(.16, .06, .012, M.dark, w * .25, .9, .025, { shadow: false }));
  g.userData.parts = parts; g.userData.H = H; g.userData.n = n; return g;
}
function curtainLeaf(w, h, M, slats = false) {
  const g = new THREE.Group();
  const mat = slats ? M.doorInner : M.curtainFabric;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, slats ? 1 : 8), mat); sheet.position.y = h / 2; sheet.castShadow = true; sheet.receiveShadow = true; sheet.material = mat.clone(); sheet.material.side = THREE.DoubleSide;
  if (slats) { sheet.material.normalMap = M.door.normalMap; sheet.material.normalScale = new THREE.Vector2(1.2, 1.2); sheet.material.color.copy(M.door.color); sheet.material.map = null; sheet.material.normalMap.rotation = Math.PI / 2; }
  else { sheet.material.color.copy(M.door.color); }
  g.add(sheet);
  if (!slats) { // vision window band + reinforcement bars in the fabric
    const band = box(w - .3, .35, .012, M.pvc, 0, h * .45, .005, { shadow: false }); g.add(band);
    for (let i = 1; i < 4; i++) g.add(box(w, .05, .03, M.dark, 0, h * i / 4, 0, { shadow: false }));
  }
  g.add(box(w, .06, .06, M.dark, 0, .03, 0, { shadow: false }));
  g.userData.sheet = sheet; g.userData.h = h; return g;
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
  const lift = d.priced === 'hs620' ? (LIFT_620[st.lift620] || LIFT_620.SL) : (LIFT[st.lift] || LIFT.normal);
  const hl = Math.min(d.priced === 'hs620' ? { SL: 0, HL750: .75, HL1370: 1.37, HL2000: 2.0, VL: 99 }[st.lift620 || 'SL'] : lift.hl, HALL_H - h - .6);
  const vertical = hl >= 99;
  if (d.kind === 'sectional') {
    const leaf = sectionalLeaf(w, h, d.panel, st, M); leaf.position.set(0, 0, zL); g.add(leaf);
    const parts = leaf.userData.parts, H = leaf.userData.H;
    const R = vertical ? 0 : .42, Ht = h + .12 + (vertical ? h : hl);
    // tracks: vertical angles + horizontal rails (or vertical only)
    [-1, 1].forEach(s => {
      g.add(box(.06, Ht + .3, .07, M.galv, s * (w / 2 + .07), (Ht + .3) / 2, zL - .06));
      if (!vertical) g.add(box(.06, .07, h + .6, M.galv, s * (w / 2 + .07), Ht + R + .03, zL - R - (h + .6) / 2));
    });
    // torsion spring shaft above the opening (inside)
    g.add(cyl(.028, w + .3, M.galv, 0, Ht + .2, zL - .18, 12).rotateZ(Math.PI / 2));
    g.add(cyl(.085, Math.min(1.6, w * .45), M.dark, 0, Ht + .2, zL - .18, 14).rotateZ(Math.PI / 2));
    if (d.motor || st.operation === 'motor') { g.add(box(.26, .3, .36, M.galv, w / 2 + .32, Ht + .2, zL - .18)); g.add(box(.32, .42, .14, M.white, w / 2 + .9, h * .55, zL - .02)); }
    const smax = Ht - parts[0].y0 + R * Math.PI / 2 + .12;
    animate = t => { const s = ease(t) * smax; parts.forEach(({ p, y0 }) => { const d1 = Ht - y0;
      if (vertical || s < d1) { p.position.set(0, y0 + s, 0); p.rotation.x = 0; }
      else if (s < d1 + R * Math.PI / 2) { const a = (s - d1) / R; p.position.set(0, Ht + R * Math.sin(a), -R * (1 - Math.cos(a))); p.rotation.x = -a; }
      else { p.position.set(0, Ht + R, -R - (s - d1 - R * Math.PI / 2)); p.rotation.x = -Math.PI / 2; } }); };
  } else if (d.kind === 'rollup' || d.kind === 'roller') {
    const leaf = curtainLeaf(w, h, M, d.kind === 'roller'); leaf.position.set(0, 0, zL); g.add(leaf);
    const sheet = leaf.userData.sheet;
    const rollR = d.kind === 'roller' ? .22 : .16; const hood = box(w + .5, rollR * 2 + .14, rollR * 2 + .14, M.galv, 0, h + rollR + .1, zL - .02); g.add(hood);
    [-1, 1].forEach(s => g.add(box(.12, h + .1, .14, M.galv, s * (w / 2 + .09), (h + .1) / 2, zL - .02)));
    if (d.kind === 'rollup') { g.add(box(.3, .46, .22, M.galv, w / 2 + .35, h + rollR + .1, zL - .02)); g.add(box(.32, .42, .14, M.white, w / 2 + .9, h * .55, zL - .02)); }
    animate = t => { const e = ease(t); const k = Math.max(.015, 1 - e); sheet.scale.y = k; sheet.position.y = h - (h * k) / 2; leaf.children[leaf.children.length - 1].position.y = h - h * k + .03; };
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
  // pit frame with hazard marking flush in the floor
  pit.add(box(pw + .3, .004, len + .3, M.yellowStripe, 0, .003, -(len + .3) / 2 + .0, { shadow: false })); pit.add(box(pw + .14, .006, len + .14, M.dark, 0, .004, -(len + .3) / 2 + .0, { shadow: false }));
  const hinge = new THREE.Group(); hinge.position.set(0, .012, -len); pit.add(hinge);
  const plate = box(pw, .06, len, M.levellerPlate, 0, 0, len / 2); hinge.add(plate);
  // anti-slip chequer stripes along the plate edges
  [-1, 1].forEach(s => hinge.add(box(.08, .062, len, M.yellowStripe, s * (pw / 2 - .04), 0, len / 2, { shadow: false })));
  hinge.add(box(pw, .4, .08, M.levellerFrame, 0, -.24, len - .04));   // front beam
  const cylm = cyl(.06, len * .6, M.levellerFrame, 0, -.3, len * .5, 10); cylm.rotation.x = Math.PI / 2 - .25; hinge.add(cylm);
  const lipPivot = new THREE.Group(); lipPivot.position.set(0, 0, len); hinge.add(lipPivot);
  let lip;
  if (L.lip === 'swing') { lip = box(pw - .1, .05, lipLen, M.levellerPlate, 0, 0, lipLen / 2); lipPivot.add(lip); lipPivot.rotation.x = Math.PI / 2 - .08; }
  else { lip = box(pw - .1, .045, lipLen, M.levellerPlate, 0, -.002, lipLen / 2 - lipLen); lipPivot.add(lip); lip.position.z = -lipLen + .05; }
  // side skirts
  [-1, 1].forEach(s => { const sk = box(.02, .7, len, M.dark, s * (pw / 2 - .01), -.36, len / 2, { shadow: false }); hinge.add(sk); });
  g.add(pit);
  const level = DOCK_H; const target = bedH == null ? DOCK_H : bedH + .02;
  function animate(t) {
    // 0..0.45 rise (plate up 9°), 0.45..0.75 lip out, 0.75..1 lower onto bed
    const r = seg(t, 0, .45), o = seg(t, .45, .75), lo = seg(t, .75, 1);
    const upA = .16;
    const dh = target - level; const downA = Math.atan2(dh, len);
    hinge.rotation.x = -(upA * ease(r)) + (upA - downA) * ease(lo);
    if (L.lip === 'swing') lipPivot.rotation.x = (Math.PI / 2 - .08) * (1 - ease(o)) + (-hinge.rotation.x) * ease(lo);
    else { lip.position.z = -lipLen + .05 + lipLen * .9 * ease(o); lipPivot.rotation.x = (-hinge.rotation.x) * ease(lo); }
  }
  return { group: g, animate };
}

/* ---------------------------------------------------------------- Dock shelter */
export function buildShelter({ M, st, w, h }) {
  const g = new THREE.Group(); const S = SHELTERS[st.shelter]; if (!S || st.shelter === 'none') return { group: g, animate: () => {} };
  const depth = .65, side = .62, top = .95; const W = w + 2 * side + .2, Hs = h + top + .15; const y0 = DOCK_H - .1;
  const frameM = M.shelter; let animate = () => {};
  if (S.type === 'curtain' || S.type === 'inflTop') {
    // frame box with projection cover + front curtains (black, white diagonal marks / slots)
    g.add(box(W, .08, depth, frameM, 0, y0 + Hs, depth / 2));
    [-1, 1].forEach(s => { g.add(box(.08, Hs, depth, frameM, s * (W / 2 - .04), y0 + Hs / 2, depth / 2)); g.add(box(side, Hs - .02, .03, frameM, s * (W / 2 - side / 2), y0 + Hs / 2, depth));
      g.add(box(.1, Hs * .62, .012, M.shelterStripe, s * (W / 2 - side / 2), y0 + Hs * .45, depth + .02, { shadow: false })); });
    g.add(box(W, top, .03, frameM, 0, y0 + Hs - top / 2, depth));
    [-1, 1].forEach(s => { const mark = box(.14, .4, .012, M.shelterStripe, s * (W / 2 - side - .5), y0 + Hs - top / 2, depth + .02, { shadow: false }); mark.rotation.z = s * .55; g.add(mark); });
    g.add(box(W + .25, .12, depth + .25, frameM, 0, y0 + Hs + .1, depth / 2 - .05));   // projection cover / rain hood
    if (S.type === 'inflTop') { const cushion = box(W - .2, .55, depth - .15, M.cushion, 0, y0 + Hs - top - .25, depth / 2); g.add(cushion); cushion.scale.y = .25; animate = t => { const e = ease(t); cushion.scale.y = .25 + .75 * e; cushion.position.y = y0 + Hs - top - .1 - (.55 * cushion.scale.y) / 2; }; }
  } else if (S.type === 'cushion' || S.type === 'foam') {
    const th = S.type === 'foam' ? .42 : .36;
    g.add(box(W, .06, depth, frameM, 0, y0 + Hs, depth / 2)); g.add(box(W, .12, depth + .25, frameM, 0, y0 + Hs + .08, depth / 2 - .05));
    [-1, 1].forEach(s => { g.add(box(th, Hs - top, depth, M.cushion, s * (W / 2 - th / 2), y0 + (Hs - top) / 2, depth / 2)); g.add(box(.06, Hs - top, .1, M.shelterStripe, s * (W / 2 - th / 2), y0 + (Hs - top) / 2, depth + .02, { shadow: false })); });
    g.add(box(W, top, depth * .9, M.cushion, 0, y0 + Hs - top / 2, depth / 2));
  } else if (S.type === 'inflatable') {
    g.add(box(W, .06, depth, frameM, 0, y0 + Hs, depth / 2)); g.add(box(W, .12, depth + .25, frameM, 0, y0 + Hs + .08, depth / 2 - .05));
    [-1, 1].forEach(s => g.add(box(.08, Hs, depth, frameM, s * (W / 2 - .04), y0 + Hs / 2, depth / 2)));
    const bags = [];
    [-1, 1].forEach(s => { const b = box(.5, Hs - top, depth - .1, M.cushion, s * (W / 2 - .34), y0 + (Hs - top) / 2, depth / 2); b.scale.x = .3; g.add(b); bags.push({ b, ax: 'x', s }); for (let k = 1; k < 7; k++) b.add(box(.52, .03, depth - .08, M.shelterStripe, 0, -(Hs - top) / 2 + k * (Hs - top) / 7, 0, { shadow: false })); });
    const tb = box(W - .2, .7, depth - .1, M.cushion, 0, y0 + Hs - .4, depth / 2); tb.scale.y = .3; g.add(tb); bags.push({ b: tb, ax: 'y' });
    g.add(box(.5, .4, .4, M.galv, W / 2 - .3, y0 + Hs - .35, -.0));   // blower
    animate = t => { const e = .3 + .7 * ease(t); bags.forEach(({ b, ax, s }) => { if (ax === 'x') { b.scale.x = e; b.position.x = s * (W / 2 - .09 - .25 * e); } else { b.scale.y = e; b.position.y = y0 + Hs - .05 - .35 * e; } }); };
  } else if (S.type === 'van') {
    const Wv = w + .6, Hv = h + .3;
    g.add(box(Wv, .06, .55, frameM, 0, y0 + Hv, .28));
    [-1, 1].forEach(s => { const c = box(.3, Hv - .3, .5, M.cushion, s * (Wv / 2 - .15), y0 + (Hv - .3) / 2, .26); c.rotation.y = -s * .15; g.add(c); });
    g.add(box(Wv, .3, .5, M.cushion, 0, y0 + Hv - .15, .26));
  }
  return { group: g, animate };
}

/* ---------------------------------------------------------------- Bumpers, restraint, lights, signs */
export function buildBumpers({ M, st, w }) {
  const g = new THREE.Group(); const B = BUMPERS[st.bumper] || BUMPERS.rubber; const mat = new THREE.MeshStandardMaterial({ color: B.col, roughness: .9 });
  [-1, 1].forEach(s => {
    const x = s * (w / 2 + .32), y = DOCK_H - .22, z = .18;
    if (B.style === 'nylon') { g.add(box(.3, .5, .12, M.galv, x, y, z - .06)); g.add(box(.26, .46, .07, mat, x, y, z + .03)); }
    else if (B.style === 'lamella') { for (let k = 0; k < 6; k++) g.add(box(.3, .06, .18, mat, x, y - .2 + k * .08, z)); g.add(box(.32, .5, .04, M.galv, x, y, z - .1)); }
    else if (B.style === 'sab') { g.add(box(.36, .56, .1, M.galv, x, y, z - .12)); g.add(box(.3, .5, .2, mat, x, y, z + .03)); g.add(box(.34, .06, .22, M.galv, x, y + .28, z + .02)); }
    else if (B.style === 'framed') { g.add(box(.34, .54, .06, M.galv, x, y, z - .08)); g.add(box(.3, .5, .16, mat, x, y, z + .03)); }
    else g.add(box(.25, .5, .18, mat, x, y, z));
  });
  return g;
}
export function buildRestraint({ M, st, w }) {
  const g = new THREE.Group(); let animate = () => {};
  if (st.restraint === 'manual') {
    const rail = box(.1, .04, 2.2, M.galv, w * .32, .02, 2.3); g.add(rail);
    const body = new THREE.Group(); body.position.set(w * .32, .0, 1.6); g.add(body);
    body.add(box(.5, .3, .6, M.yellow, 0, .17, 0)); body.add(cyl(.02, 1.0, M.galv, -.1, .8, -.2, 8)); body.add(box(.14, .05, .05, M.dark, -.1, 1.3, -.2));
    body.add(box(.04, .04, .04, M.green, .2, .3, .31, { shadow: false }));
    animate = t => { body.position.z = 1.6 + 1.3 * ease(t); };
    g.userData.led = body.children[4];
  } else if (st.restraint === 'auto') {
    const tube = cyl(.11, 6.2, M.galv, w * .34, .22, 4.4, 18); tube.rotation.x = Math.PI / 2; g.add(tube);
    const cap = cyl(.115, .18, M.red, w * .34, .22, 7.55, 18); cap.rotation.x = Math.PI / 2; g.add(cap);
    g.add(box(.36, .3, .5, M.galv, w * .34, .15, 1.45)); g.add(box(.32, .1, .4, M.sign, w * .34, .33, 1.45, { shadow: false }));
    const carriage = new THREE.Group(); carriage.position.set(w * .34, .22, 4.0); g.add(carriage);
    carriage.add(box(.32, .3, .5, M.galv, 0, 0, 0));
    const arm = new THREE.Group(); carriage.add(arm); arm.add(box(.08, .9, .08, M.yellow, -.22, .45, 0)); arm.add(box(.08, .08, .5, M.yellow, -.22, .9, .25)); arm.rotation.x = Math.PI / 2;
    animate = t => { carriage.position.z = 4.0 + 2.4 * seg(t, 0, .6); arm.rotation.x = Math.PI / 2 * (1 - ease(seg(t, .6, 1))); };
  }
  return { group: g, animate };
}
export function buildDockLight({ M, st, w, h }) {
  const g = new THREE.Group(); if (st.light === 'none') return { group: g, setOn: () => {} };
  const arm = new THREE.Group(); arm.position.set(-w / 2 - .25, DOCK_H + h + .25, -WALL_T - .12); g.add(arm);
  arm.add(box(.12, .18, .1, M.dark, 0, 0, 0));
  const a1 = box(.06, .06, 1.0, M.yellow, 0, 0, .5); arm.add(a1);
  const head = new THREE.Group(); head.position.set(0, -.1, 1.0); arm.add(head);
  if (st.light === 'hurricane') { head.add(box(.3, .3, .28, M.yellow, 0, 0, 0)); const lens = cyl(.1, .03, M.lampOff, 0, -.16, .0, 20); lens.rotation.x = Math.PI / 2; head.add(lens); head.userData.lens = lens; head.add(cyl(.14, .02, M.dark, 0, -.17, .0, 24).rotateX(Math.PI / 2)); }
  else { const lens = cyl(.11, .06, M.lampOff, 0, 0, 0, 24); lens.rotation.x = Math.PI / 2; head.add(lens); head.userData.lens = lens; head.add(cyl(.13, .05, M.yellow, 0, 0, -.04, 24).rotateX(Math.PI / 2)); }
  const spot = new THREE.SpotLight(0xfff2d4, 0, 14, .55, .5, 1.2); spot.position.set(0, 0, 0); spot.target.position.set(0, -1.5, 6); head.add(spot, spot.target);
  arm.rotation.y = .35; arm.rotation.x = -.25;
  return { group: g, setOn: on => { spot.intensity = on ? 60 : 0; head.userData.lens.material = on ? M.lamp : M.lampOff; } };
}
export function buildTrafficLight({ M, w, h }) {
  const g = new THREE.Group(); const x = w / 2 + .62, y = DOCK_H + 1.9;
  g.add(box(.14, .36, .1, M.dark, x, y, .06)); const r = cyl(.045, .03, M.lampOff, x, y + .08, .12, 16); r.rotation.x = Math.PI / 2; const gr = cyl(.045, .03, M.green, x, y - .08, .12, 16); gr.rotation.x = Math.PI / 2; g.add(r, gr);
  return { group: g, set: state => { r.material = state === 'red' ? new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 1.6 }) : M.lampOff; gr.material = state === 'green' ? M.green : M.lampOff; } };
}
export function numberPlate({ M, n, w, h }) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const ctx = c.getContext('2d'); ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = '#fff'; ctx.font = 'bold 170px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); m.position.set(-w / 2 - .25, DOCK_H + h + 1.0, .012); m.castShadow = false; return m;
}

/* ---------------------------------------------------------------- Trucks */
export function buildTruck({ M, kind }) {
  const g = new THREE.Group(); const T = TRUCKS[kind]; if (!T || kind === 'none') return { group: g, animate: () => {}, len: 0, bedH: null };
  const wheels = [];
  const wheel = (x, z, r = .52) => { const t = cyl(r, .32, M.tyre, x, r, z, 24); t.rotation.z = Math.PI / 2; const rim = cyl(r * .55, .34, M.rim, 0, 0, 0, 16); t.add(rim); g.add(t); wheels.push(t); return t; };
  if (kind === 'truck') {
    // semi-trailer: rear at z = 0 (door end), length 13.6, bed 1.3 m
    const L = 13.6, W = 2.55, H = 2.7, bed = 1.3;
    const boxm = box(W, H - .06, L, M.trailerBox, 0, bed + .06 + (H - .06) / 2, L / 2); g.add(boxm);
    g.add(box(W, .35, L, M.chassis, 0, bed - .18, L / 2)); g.add(box(W - .04, .06, .5, M.rim, 0, bed + .02, .25)); // rear sill
    // rear doors: centre seam, two locking bars per leaf, hinges, underrun bar, lights
    g.add(box(.02, H - .2, .02, M.dark, 0, bed + H / 2, .02, { shadow: false }));
    [-1, 1].forEach(s => { [.45, .95].forEach(x_ => { g.add(box(.04, H - .3, .04, M.galv, s * x_, bed + H / 2, .04, { shadow: false })); g.add(box(.12, .05, .06, M.dark, s * x_, bed + 1.0, .05, { shadow: false })); g.add(box(.12, .05, .06, M.dark, s * x_, bed + H - .6, .05, { shadow: false })); });
      [.3, 1.3, 2.3].forEach(y_ => g.add(box(.06, .18, .05, M.dark, s * (W / 2 - .03), bed + y_, .03, { shadow: false }))); g.add(box(.14, .08, .04, M.red, s * (W / 2 - .2), bed - .15, .06, { shadow: false })); });
    g.add(box(W - .4, .1, .08, M.galv, 0, bed - .45, .02, { shadow: false })); g.add(box(.5, .11, .02, M.sign, 0, bed - .25, .06, { shadow: false }));
    [1.3, 2.6, 3.9].forEach(z => [-1, 1].forEach(s => wheel(s * (W / 2 - .25), z)));
    // tractor
    const cz = L + .3; g.add(box(W - .1, .6, 3.4, M.chassis, 0, .75, cz + 1.4));
    g.add(box(W, 2.4, 2.2, M.truckRed, 0, bed + 1.2, cz + 2.4)); g.add(box(W - .2, 1.1, .05, M.glassDark, 0, bed + 1.55, cz + 3.53, { shadow: false }));
    g.add(box(W - .2, .5, 2.2, M.truckRed, 0, bed + 2.55, cz + 2.4)); g.add(box(.8, .35, .3, M.dark, 0, bed + 2.3, cz + 3.5, { shadow: false }));
    [-1, 1].forEach(s => { wheel(s * (W / 2 - .25), cz + 3.0); wheel(s * (W / 2 - .25), cz + .4); });
    return { group: g, animate: dz => wheels.forEach(w => { w.rotation.x += dz / .52; }), len: L + 5.5, bedH: bed };
  }
  if (kind === 'rigid') {
    const L = 6.8, W = 2.45, H = 2.5, bed = 1.15;
    g.add(box(W, H, L, M.trailerBox, 0, bed + H / 2, L / 2)); g.add(box(W, .3, L + 1.2, M.chassis, 0, bed - .16, (L + 1.2) / 2));
    g.add(box(W + .1, .08, .2, M.red, 0, bed - .36, .05, { shadow: false }));
    g.add(box(W, 2.2, 1.9, M.truckWhite, 0, bed + 1.0, L + 1.1)); g.add(box(W - .2, .9, .05, M.glassDark, 0, bed + 1.3, L + 2.08, { shadow: false }));
    [1.4, L + 1.0].forEach(z => [-1, 1].forEach(s => wheel(s * (W / 2 - .25), z, .48)));
    return { group: g, animate: dz => wheels.forEach(w => { w.rotation.x += dz / .48; }), len: L + 2.2, bedH: bed };
  }
  // van
  const L = 5.4, W = 2.0, H = 1.9, bed = .62;
  const body = box(W, H, L - 1.6, M.truckWhite, 0, bed + H / 2 - .1, (L - 1.6) / 2); g.add(body);
  const cab = box(W - .05, 1.5, 1.7, M.truckWhite, 0, bed + .65, L - .85); g.add(cab); g.add(box(W - .3, .7, .05, M.glassDark, 0, bed + 1.0, L - .02, { shadow: false }));
  g.add(box(W - .2, .5, 2.8, M.glassDark, 0, bed + 1.25, 1.6, { shadow: false }));
  [-1, 1].forEach(s => { g.add(box(.03, H - .3, .04, M.dark, s * .3, bed + H / 2 - .1, .02, { shadow: false })); });
  [1.0, L - 1.1].forEach(z => [-1, 1].forEach(s => wheel(s * (W / 2 - .2), z, .34)));
  return { group: g, animate: dz => wheels.forEach(w => { w.rotation.x += dz / .34; }), len: L, bedH: bed };
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
  g.add(box(1.15, .75, 2.1, M.forklift, 0, .75, -.1)); g.add(box(1.0, .45, 1.0, M.dark, 0, 1.3, -.7)); g.add(box(.9, .5, .9, M.forklift, 0, .78, -1.0));
  [-.5, .5].forEach(x_ => { g.add(box(.06, 1.2, .06, M.dark, x_, 1.75, .6)); g.add(box(.06, 1.2, .06, M.dark, x_, 1.75, -.9)); }); g.add(box(1.1, .05, 1.6, M.dark, 0, 2.35, -.15));
  [-.3, .3].forEach(x_ => { g.add(box(.08, 2.6, .08, M.dark, x_, 1.3, .95)); g.add(box(.1, .05, 1.1, M.galv, x_, .08, 1.55)); });
  g.add(box(.5, .4, .25, M.dark, 0, 1.0, .5, { shadow: false }));
  [[-.55, .55], [.55, .55], [-.55, -.75], [.55, -.75]].forEach(([a, b]) => { const w = cyl(.3, .24, M.tyre, a, .3, b, 18); w.rotation.z = Math.PI / 2; g.add(w); });
  g.position.set(x, 0, z); g.rotation.y = rot; return g;
}
/* ---------------------------------------------------------------- Whole warehouse */
export function buildWarehouse({ mats, st, studio = false }) {
  const { M } = mats; const g = new THREE.Group(); const rigs = { doors: [], levellers: [], shelters: [], restraints: [], lights: [], traffic: [], trucks: [] };
  const w = st.w / 1000, h = st.h / 1000; const bays = studio ? 1 : st.bays;
  const pitch = Math.max(PITCH, w + 1.6); const W = studio ? w + 3.2 : bays * pitch + 8; const H = DOCK_H + HALL_H; const D = studio ? 6 : HALL_D;
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
  for (let z = -3; z > -D; z -= 6) { g.add(box(W - .6, .5, .12, M.truss, 0, H - .3, z, { shadow: false })); for (let k = 0; k < 14; k++) { const d = box(.05, .45, .05, M.truss, x0 + .6 + k * (W - 1.2) / 13, H - .3, z, { shadow: false }); d.rotation.z = (k % 2 ? 1 : -1) * .6; g.add(d); } }
  const lightMeshes = [];
  if (st.interiorLight === 'led_line') { for (let i = 0; i < 3; i++) { const z = -4 - i * 7; const l = box(W - 2, .06, .14, M.lamp, 0, H - .62, z, { shadow: false }); g.add(l); lightMeshes.push(l); const pl = new THREE.PointLight(0xfff4e0, 60, 26, 1.6); pl.position.set(0, H - 1, z); g.add(pl); } }
  else if (st.interiorLight === 'highbay') { for (let i = 0; i < 3; i++) for (let k = 0; k < Math.max(2, Math.round(W / 9)); k++) { const x = x0 + 4.5 + k * (W - 9) / Math.max(1, Math.round(W / 9) - 1), z = -4 - i * 7; const l = cyl(.22, .12, M.lamp, x, H - .7, z, 20, { shadow: false }); g.add(l); lightMeshes.push(l); g.add(cyl(.26, .1, M.dark, x, H - .6, z, 20, { shadow: false })); const pl = new THREE.PointLight(0xfff4e0, 45, 20, 1.6); pl.position.set(x, H - 1.1, z); g.add(pl); } }
  // interior: yellow safety line, racks, forklift, dock bumpers inside? (no), control box per bay
  if (!studio) {
    g.add(plane(W - .6, .12, M.yellowStripe, 0, DOCK_H + .003, -4.2)); g.add(plane(W - .6, .12, M.yellowStripe, 0, DOCK_H + .003, -4.6));
    for (let k = 0; k < Math.max(1, Math.floor((W - 6) / 9)); k++) g.add(rack(M, x0 + 2.5 + k * 9, -D + 2.2, 3, 3));
    for (let k = 0; k < Math.max(1, Math.floor((W - 6) / 9)); k++) g.add(rack(M, x0 + 2.5 + k * 9, -D + 6.0, 3, 3));
    g.add(forklift(M, bayX(Math.min(1, bays - 1)) + 2.6, -8.5, -.6));
    // staged pallets behind the active dock
    for (let i = 0; i < bays; i++) for (let k = 0; k < 3; k++) { if ((i * 3 + k) % 4 === 1) continue; const px = bayX(i) - 1.4 + k * 1.4, pz = -6.2 - (k % 2) * 1.1; g.add(box(1.2, .14, .8, M.pallet, px, DOCK_H + .07, pz)); const bh = .6 + ((i + k) % 3) * .35; g.add(box(1.1, bh, .75, M.boxKraft, px, DOCK_H + .14 + bh / 2, pz)); }
    // steel columns along the side walls, roof lights (skylight strips)
    for (let z = -4; z > -D; z -= 6) [x0 + .5, -x0 - .5].forEach(x => g.add(box(.3, H - .2, .3, M.truss, x, H / 2, z)));
    for (let z = -6; z > -D; z -= 9) g.add(box(W - 4, .05, 1.2, M.lamp, 0, H + .02, z, { shadow: false }));
  }
  // yard: asphalt apron, lane markings per bay, kerb, lawn, hedge, fence line
  const yardD = studio ? 10 : 40;
  g.add(plane(W + (studio ? 0 : 60), yardD, M.asphalt, 0, 0, yardD / 2));
  if (!studio) {
    for (let i = 0; i < bays; i++) [-1, 1].forEach(s => g.add(plane(.12, 18, M.yellowStripe, bayX(i) + s * (1.5), .004, 9.5)));
    g.add(plane(W + 60, 60, M.lawn, 0, -.01, yardD + 30)); g.add(box(W + 60, .14, .2, M.plinth, 0, .07, yardD, { shadow: false }));
    g.add(box(W + 60, 1.0, .8, M.hedge, 0, .5, yardD + 2.5));
  }
  // a parked trailer at the far end of the yard for scale
  if (!studio && bays > 1) { const pt = buildTruck({ M, kind: 'truck' }); pt.group.position.set(x0 - 6, 0, 14); pt.group.rotation.y = .55; g.add(pt.group); }
  // per bay
  for (let i = 0; i < bays; i++) {
    const cx = bayX(i); const bay = new THREE.Group(); bay.position.x = cx; g.add(bay);
    // door reveal frame (galvanised angle) and dock edge plate
    bay.add(box(w + .14, .07, .06, M.galv, 0, DOCK_H + h + .035, -WALL_T / 2, { shadow: false }));
    bay.add(box(w + .4, .08, .3, M.galv, 0, DOCK_H - .04, .12, { shadow: false }));
    const door = buildDoor({ M, st, w, h }); bay.add(door.group); rigs.doors.push(door);
    const truckKind = st.truck; const bedH = TRUCKS[truckKind] && truckKind !== 'none' ? TRUCKS[truckKind].bedH : null;
    const lev = buildLeveller({ M, st, w, bedH }); bay.add(lev.group); rigs.levellers.push(lev);
    const sh = buildShelter({ M, st, w, h }); bay.add(sh.group); rigs.shelters.push(sh);
    bay.add(buildBumpers({ M, st, w }));
    const rs = buildRestraint({ M, st, w }); bay.add(rs.group); rigs.restraints.push(rs);
    const dl = buildDockLight({ M, st, w, h }); bay.add(dl.group); rigs.lights.push(dl);
    if (st.trafficLight) { const tl = buildTrafficLight({ M, w, h }); bay.add(tl.group); rigs.traffic.push(tl); }
    if (st.numbers) bay.add(numberPlate({ M, n: i + 1, w, h }));
    if (st.bollards) [-1, 1].forEach(s => { const b = cyl(.08, 1.1, M.yellow, s * (w / 2 + .85), .55, .55, 16); bay.add(b); [.25, .55, .85].forEach(y => bay.add(cyl(.083, .08, M.black, s * (w / 2 + .85), y, .55, 16, { shadow: false }))); });
    if (st.wheelGuides) [-1, 1].forEach(s => { const x = s * 1.55; const t = cyl(.06, 4.6, M.yellow, x, .18, 4.6, 12); t.rotation.x = Math.PI / 2; bay.add(t); [2.5, 6.6].forEach(z => bay.add(cyl(.06, .3, M.yellow, x, .1, z, 12))); });
    // dock control box inside next to the door
    bay.add(box(.3, .42, .12, M.white, w / 2 + .7, DOCK_H + 1.4, -WALL_T - .07)); bay.add(box(.05, .05, .02, M.green, w / 2 + .62, DOCK_H + 1.5, -WALL_T - .14, { shadow: false })); bay.add(box(.05, .05, .02, M.red, w / 2 + .62, DOCK_H + 1.4, -WALL_T - .14, { shadow: false }));
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
