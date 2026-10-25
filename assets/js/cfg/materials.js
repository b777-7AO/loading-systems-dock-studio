/* Loading Systems · Dock Studio materials (PBR, textures in metres). Texture credits in assets/tex/LICENSES.txt */
import * as THREE from 'three';
export const TEX = 'assets/tex/';

export function createMaterials(renderer, manager, { mobile = false } = {}) {
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = Math.min(mobile ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  const cache = new Map();
  function tx(file, { srgb = false, tile = 1, wrap = true, mirror = true } = {}) {
    const key = file + '|' + tile + '|' + mirror; if (cache.has(key)) return cache.get(key);
    const t = loader.load(TEX + file);
    if (wrap) { t.wrapS = t.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); }
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = maxAniso; cache.set(key, t); return t;
  }
  const pbr = (name, tile, mirror = true) => ({ map: tx(name + '_d.jpg', { srgb: true, tile, mirror }), normalMap: tx(name + '_n.jpg', { tile, mirror }), roughnessMap: tx(name + '_r.jpg', { tile, mirror }) });
  const std = o => new THREE.MeshStandardMaterial(o);
  const phys = o => new THREE.MeshPhysicalMaterial(o);
  const noiseCache = new Map();
  function noiseTex(lo, hi, metres = 14) {
    const key = lo + '|' + hi + '|' + metres; if (noiseCache.has(key)) return noiseCache.get(key);
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d'); const img = ctx.createImageData(N, N), g = 8, grid = []; let seed = 11 + metres;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = 0; y <= g; y++) { grid[y] = []; for (let x = 0; x <= g; x++) grid[y][x] = rnd(); }
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * g, fy = y / N * g, x0 = Math.floor(fx) % g, y0 = Math.floor(fy) % g, tx_ = sm(fx - Math.floor(fx)), ty_ = sm(fy - Math.floor(fy));
      const a = grid[y0][x0], b = grid[y0][(x0 + 1) % g], cc = grid[(y0 + 1) % g][x0], d = grid[(y0 + 1) % g][(x0 + 1) % g];
      const v = (a * (1 - tx_) + b * tx_) * (1 - ty_) + (cc * (1 - tx_) + d * tx_) * ty_;
      const l = Math.round(255 * (lo + (hi - lo) * v)); const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = l; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / metres, 1 / metres); t.channel = 0; noiseCache.set(key, t); return t;
  }
  /* procedural normal maps: sinus corrugation (trapezoid sheet), and the micro-profile of an LS sandwich panel
     (flat faces with shallow V-grooves every `pitch` of the tile, grooves run along U) */
  function ribNormal(period = 64, depth = .9) {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d'); const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ph = (x % period) / period; const s = Math.sin(ph * Math.PI * 2); const nx = -s * depth; const i = (y * N + x) * 4; img.data[i] = 128 + nx * 90; img.data[i + 1] = 128; img.data[i + 2] = 255; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function microProfileNormal(grooves = 5, grooveW = .045, depth = 1.15, panelH = .5) {
    // the door panel ExtrudeGeometry maps U = height in metres, so one tile along U = one panel: `grooves` shallow V-grooves plus a joint shadow at u = 0
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d'); const img = ctx.createImageData(N, N);
    for (let x = 0; x < N; x++) {
      const u = x / N; let nx = 0;
      for (let k = 0; k < grooves; k++) { const cpos = (k + .5) / grooves; const d = (u - cpos) / grooveW; if (Math.abs(d) < 1) nx += (d < 0 ? -1 : 1) * (1 - Math.abs(d)) * depth; }
      const j = u < .02 ? -(1 - u / .02) : u > .98 ? (u - .98) / .02 : 0; nx += j * .9;
      const r = 128 + Math.max(-1, Math.min(1, nx)) * 90;
      for (let y = 0; y < N; y++) { const i = (y * N + x) * 4; img.data[i] = r; img.data[i + 1] = 128; img.data[i + 2] = 255; img.data[i + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / panelH, 1 / panelH); return t;
  }
  /* yellow/black hazard stripes (leveller lip edge, bollards), 1 tile = 0.3 m */
  function hazardTex() {
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d'); ctx.fillStyle = '#f2c200'; ctx.fillRect(0, 0, N, N); ctx.fillStyle = '#111';
    for (let k = -2; k < 4; k++) { ctx.beginPath(); ctx.moveTo(k * N / 2, 0); ctx.lineTo(k * N / 2 + N / 4, 0); ctx.lineTo(k * N / 2 + N / 4 + N, N); ctx.lineTo(k * N / 2 + N, N); ctx.closePath(); ctx.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / .3, 1 / .3); return t;
  }
  /* white diagonal reflective marks + vertical slots on black shelter fronts are geometry; the curtain PVC gets a seam texture */
  const ribN = ribNormal(); const microN = microProfileNormal(); const fine = tx('finestructure_n.jpg', { tile: .25 }); const paintR = tx('paint_r.jpg', { tile: .8 });
  const hazard = hazardTex();
  // decal planes come from the glTF (v already flipped by the exporter, u mirrored by the Blender plane orientation): undo both on the texture
  const decalTex = (file, mirror) => { const t = tx(file, { srgb: true, wrap: false }).clone(); t.flipY = false; if (mirror) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; } t.needsUpdate = true; return t; };
  const logoDark = decalTex('../img/ls_logo_dark.png', false), logoDarkL = decalTex('../img/ls_logo_dark.png', true); const logoWhite = decalTex('../img/ls_logo.png', false);
  const M = {
    // building
    facade: std({ ...pbr('hf_facade', 1.2), color: 0xe6e8e9, roughness: .6, metalness: .2, normalScale: new THREE.Vector2(.7, .7), lightMap: noiseTex(.86, 1, 9), lightMapIntensity: 1 }),
    facadeInner: std({ ...pbr('hf_facade', 1.2), color: 0xeceeee, roughness: .7, metalness: .1, normalScale: new THREE.Vector2(.5, .5) }),
    plinth: std({ ...pbr('hf_dockwall', 2.4), roughness: 1, color: 0xc4c5c1, normalScale: new THREE.Vector2(.8, .8) }),
    concrete: std({ ...pbr('concrete', 2.2), roughness: 1, color: 0xc7c8c4, lightMap: noiseTex(.8, 1, 12), lightMapIntensity: 1 }),
    floor: std({ ...pbr('hf_whfloor', 4.2), roughness: .6, color: 0xdcdcd8, normalScale: new THREE.Vector2(.4, .4), lightMap: noiseTex(.78, 1, 10), lightMapIntensity: 1 }),
    asphalt: std({ ...pbr('hf_asphalt2', 5.5), roughness: .95, color: 0x9a9b9c, normalScale: new THREE.Vector2(.6, .6), lightMap: noiseTex(.7, 1, 16), lightMapIntensity: 1 }),
    pavers: std({ ...pbr('pavers', 2), roughness: 1 }),
    lawn: std({ map: tx('lawn_d.jpg', { srgb: true, tile: 2.6 }), normalMap: tx('lawn_n.jpg', { tile: 2.6 }), roughness: 1, lightMap: noiseTex(.62, 1, 18), lightMapIntensity: 1 }),
    hedge: std({ map: tx('hedge_d.jpg', { srgb: true, tile: 1.1 }), normalMap: tx('hedge_n.jpg', { tile: 1.1 }), roughness: 1 }),
    gravel: std({ ...pbr('gravel', 1.1), roughness: 1 }),
    steel: std({ color: 0x9a9ea2, metalness: .85, roughness: .4 }),
    galv: std({ ...pbr('hf_galv', .6), color: 0xd0d4d7, metalness: .85, roughness: .5, normalScale: new THREE.Vector2(.35, .35) }),
    galvDark: std({ ...pbr('hf_galv', .6), color: 0xa8adb1, metalness: .85, roughness: .55, normalScale: new THREE.Vector2(.35, .35) }),
    alu: std({ color: 0xd5d8da, metalness: .9, roughness: .32 }),
    chrome: std({ color: 0xe6e8ea, metalness: 1, roughness: .12 }),
    dark: std({ color: 0x25282b, metalness: .5, roughness: .55 }),
    black: std({ color: 0x141414, roughness: .85 }),
    plastic: std({ color: 0x1b1c1e, roughness: .6, metalness: .05 }),
    yellow: std({ color: 0xf2c200, roughness: .5 }),
    yellowStripe: std({ color: 0xf2c200, roughness: .6 }),
    hazard: std({ map: hazard, roughness: .55 }),
    red: std({ color: 0xe00034, roughness: .45 }),
    green: std({ color: 0x34b04a, roughness: .5, emissive: 0x0a3a12, emissiveIntensity: .4 }),
    white: std({ color: 0xf2f3f0, roughness: .6 }),
    lamp: std({ color: 0xfff6e0, emissive: 0xffe9b8, emissiveIntensity: 2.2 }),
    lampOff: std({ color: 0xd9d9d6, roughness: .5 }),
    glass: phys({ color: 0xa9c4d6, metalness: 0, roughness: .06, transmission: .9, thickness: .02, ior: 1.5, transparent: true, opacity: .9 }),
    glassTint: phys({ color: 0x5b6e7c, metalness: 0, roughness: .08, transmission: .55, thickness: .02, ior: 1.5, transparent: true, opacity: .92 }),
    glassDark: phys({ color: 0x1d2a33, metalness: .5, roughness: .1, envMapIntensity: 1.3 }),
    mesh: std({ color: 0xb8bcc0, metalness: .7, roughness: .5, side: THREE.DoubleSide, transparent: true, opacity: .55 }),
    pvc: phys({ color: 0xdfe8ee, roughness: .25, transmission: .55, thickness: .01, transparent: true, opacity: .75, side: THREE.DoubleSide }),
    // door leaf (set per state)
    door: phys({ ...pbr('hf_stucco', .9), color: 0xe7ebe3, roughness: .6, metalness: .2, normalScale: new THREE.Vector2(.55, .55), clearcoat: .12, clearcoatRoughness: .5 }),
    doorMicro: phys({ map: tx('hf_stucco_d.jpg', { srgb: true, tile: .9 }), normalMap: microN, color: 0xe7ebe3, roughness: .58, metalness: .2, normalScale: new THREE.Vector2(.7, .7), clearcoat: .12, clearcoatRoughness: .5 }),
    doorEdge: std({ color: 0x9fa4a8, metalness: .6, roughness: .5 }),
    doorInner: std({ ...pbr('hf_stucco', .9), color: 0xe6e8e6, roughness: .65, metalness: .2, normalScale: new THREE.Vector2(.45, .45) }),
    curtainFabric: std({ color: 0xf0f2f1, roughness: .55, side: THREE.DoubleSide }),
    rollerSlats: std({ ...pbr('cc_corrugated', .35), color: 0xd4d7d9, metalness: .8, roughness: .45, normalScale: new THREE.Vector2(.8, .8) }),
    // dock
    shelter: std({ ...pbr('hf_pvcblack', .5), color: 0x8f9194, roughness: .75, normalScale: new THREE.Vector2(.5, .5) }),
    shelterBlack: std({ ...pbr('ph_pvcseam', 1.3), color: 0x3a3c3f, roughness: .72, normalScale: new THREE.Vector2(.6, .6) }),
    shelterFrame: std({ color: 0xbfc3c6, metalness: .7, roughness: .4 }),
    shelterStripe: std({ color: 0xf4f4f0, roughness: .7, emissive: 0x222222, emissiveIntensity: .25 }),
    cushion: std({ ...pbr('hf_pvcblack', .5), color: 0x353739, roughness: .8, normalScale: new THREE.Vector2(.6, .6) }),
    levellerPlate: std({ ...pbr('cc_chequer', .55, false), color: 0x3a3d40, metalness: .55, roughness: .6, normalScale: new THREE.Vector2(1.1, 1.1) }),
    levellerFrame: std({ color: 0x2f3236, metalness: .65, roughness: .5 }),
    bumperRubber: std({ ...pbr('cc_rubber', .4), color: 0x9a9a9a, roughness: .92, normalScale: new THREE.Vector2(.8, .8) }),
    // vehicles (glTF material names are remapped onto these)
    truckPaint: phys({ color: 0xc8102e, roughness: .3, metalness: .2, clearcoat: .8, clearcoatRoughness: .18, roughnessMap: paintR }),
    truckPaintWhite: phys({ color: 0xf2f3f1, roughness: .32, metalness: .15, clearcoat: .7, clearcoatRoughness: .2 }),
    truckTrim: std({ color: 0x1f2124, roughness: .5, metalness: .2 }),
    trailerBox: std({ color: 0xeef0ee, roughness: .45, metalness: .2, normalMap: tx('ph_boxprofile_n.jpg', { tile: 1.6 }), normalScale: new THREE.Vector2(.45, .45), roughnessMap: tx('ph_boxprofile_r.jpg', { tile: 1.6 }) }),
    trailerRoof: std({ color: 0xe3e5e3, roughness: .6, metalness: .2 }),
    tyre: std({ ...pbr('cc_rubber', .25), color: 0x2b2b2b, roughness: .95, normalScale: new THREE.Vector2(.6, .6) }),
    rim: std({ color: 0xcfd3d6, metalness: .9, roughness: .3 }),
    chassis: std({ color: 0x24272a, metalness: .5, roughness: .6 }),
    lightRed: std({ color: 0xc81c1c, roughness: .25, emissive: 0x7a0000, emissiveIntensity: .6 }),
    lightAmber: std({ color: 0xf0a020, roughness: .25, emissive: 0x7a4a00, emissiveIntensity: .5 }),
    lightWhite: std({ color: 0xf4f4ee, roughness: .2, emissive: 0x9a9a90, emissiveIntensity: .25 }),
    plateWhite: std({ color: 0xf6f6f3, roughness: .5 }),
    reflYellow: std({ color: 0xf5c518, roughness: .3, emissive: 0x4a3a00, emissiveIntensity: .3 }),
    decalDark: std({ map: logoDark, transparent: true, roughness: .55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    decalDarkL: std({ map: logoDarkL, transparent: true, roughness: .55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    decalWhite: std({ map: logoWhite, transparent: true, roughness: .55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    // interior
    rack: std({ color: 0x1f4e9b, roughness: .55, metalness: .4 }),
    rackBeam: std({ color: 0xf2a900, roughness: .5, metalness: .4 }),
    pallet: std({ ...pbr('wood_clad', .9), roughness: 1, color: 0xcdb48d }),
    boxKraft: std({ color: 0xc9a977, roughness: .95 }),
    ceiling: std({ color: 0xdfe2e4, roughness: .9, side: THREE.DoubleSide }),
    truss: std({ color: 0xb4b8bc, metalness: .7, roughness: .5 }),
    forklift: std({ color: 0xf2a900, roughness: .5, metalness: .3 }),
    sign: std({ color: 0xffffff, roughness: .6 }),
  };
  M.truckPaint.name = 'truckPaint'; M.decalDark.name = 'decalDark';
  /* glTF material name -> scene material */
  M.vehicleMap = { paint: M.truckPaint, paint_dark: M.truckTrim, body_panel: M.trailerBox, body_roof: M.trailerRoof, chassis: M.chassis, galv: M.galvDark, alu: M.alu, chrome: M.chrome, tyre: M.tyre, rim: M.rim, glass: M.glassDark, plastic: M.plastic, rubber: M.black, light_red: M.lightRed, light_amber: M.lightAmber, light_white: M.lightWhite, plate: M.plateWhite, refl_yellow: M.reflYellow, decal: M.decalDark };
  /* door leaf from configuration */
  function applyDoor(ral, { kind, metallic } = {}) {
    [M.door, M.doorMicro].forEach(d => { d.color.set(ral); d.clearcoat = metallic ? .5 : .15; d.metalness = metallic ? .55 : .25; d.roughness = metallic ? .4 : .55; d.needsUpdate = true; });
    M.doorInner.color.set(ral).lerp(new THREE.Color(0xffffff), .25);
    M.curtainFabric.color.set(ral);
  }
  return { M, tx, pbr, noiseTex, ribN, microN, hazard, applyDoor };
}
