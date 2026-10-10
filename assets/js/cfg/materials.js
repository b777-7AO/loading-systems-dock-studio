/* Loading Systems · Dock Studio materials (PBR, textures in metres) */
import * as THREE from 'three';
export const TEX = 'assets/tex/';

export function createMaterials(renderer, manager) {
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const cache = new Map();
  function tx(file, { srgb = false, tile = 1, wrap = true, mirror = true } = {}) {
    const key = file + '|' + tile + '|' + mirror; if (cache.has(key)) return cache.get(key);
    const t = loader.load(TEX + file);
    if (wrap) { t.wrapS = t.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); }
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = maxAniso; cache.set(key, t); return t;
  }
  const pbr = (name, tile) => ({ map: tx(name + '_d.jpg', { srgb: true, tile }), normalMap: tx(name + '_n.jpg', { tile }), roughnessMap: tx(name + '_r.jpg', { tile }) });
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
  /* procedural corrugation normal map for sandwich panels / trapezoidal sheet */
  function ribNormal(period = 64, depth = .9) {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d'); const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ph = (x % period) / period; const s = Math.sin(ph * Math.PI * 2); const nx = -s * depth; const i = (y * N + x) * 4; img.data[i] = 128 + nx * 90; img.data[i + 1] = 128; img.data[i + 2] = 255; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const ribN = ribNormal(); const fine = tx('finestructure_n.jpg', { tile: .25 }); const paintR = tx('paint_r.jpg', { tile: .8 });
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
    dark: std({ color: 0x25282b, metalness: .5, roughness: .55 }),
    black: std({ color: 0x141414, roughness: .85 }),
    yellow: std({ color: 0xf2c200, roughness: .5 }),
    yellowStripe: std({ color: 0xf2c200, roughness: .6 }),
    red: std({ color: 0xe00034, roughness: .45 }),
    green: std({ color: 0x34b04a, roughness: .5, emissive: 0x0a3a12, emissiveIntensity: .4 }),
    white: std({ color: 0xf2f3f0, roughness: .6 }),
    lamp: std({ color: 0xfff6e0, emissive: 0xffe9b8, emissiveIntensity: 2.2 }),
    lampOff: std({ color: 0xd9d9d6, roughness: .5 }),
    glass: phys({ color: 0xa9c4d6, metalness: 0, roughness: .06, transmission: .9, thickness: .02, ior: 1.5, transparent: true, opacity: .9 }),
    glassDark: phys({ color: 0x2b3a44, metalness: .6, roughness: .12, envMapIntensity: 1.2 }),
    mesh: std({ color: 0xb8bcc0, metalness: .7, roughness: .5, side: THREE.DoubleSide, transparent: true, opacity: .55 }),
    pvc: phys({ color: 0xdfe8ee, roughness: .25, transmission: .55, thickness: .01, transparent: true, opacity: .75, side: THREE.DoubleSide }),
    // door leaf (set per state)
    door: phys({ ...pbr('hf_stucco', .9), color: 0xe7ebe3, roughness: .62, metalness: .2, normalScale: new THREE.Vector2(.55, .55), clearcoat: .12, clearcoatRoughness: .5 }),
    doorEdge: std({ color: 0x9fa4a8, metalness: .6, roughness: .5 }),
    doorInner: std({ ...pbr('hf_stucco', .9), color: 0xe6e8e6, roughness: .65, metalness: .2, normalScale: new THREE.Vector2(.45, .45) }),
    curtainFabric: std({ color: 0xf0f2f1, roughness: .9, side: THREE.DoubleSide }),
    // dock
    shelter: std({ ...pbr('hf_pvcblack', .5), color: 0x9a9a9a, roughness: .8, normalScale: new THREE.Vector2(.6, .6) }),
    shelterStripe: std({ color: 0xf4f4f0, roughness: .8 }),
    cushion: std({ ...pbr('hf_pvcblack', .5), color: 0xa6a6a6, roughness: .85, normalScale: new THREE.Vector2(.6, .6) }),
    levellerPlate: std({ color: 0x2e3133, metalness: .55, roughness: .55, normalMap: fine, normalScale: new THREE.Vector2(.9, .9) }),
    levellerFrame: std({ color: 0x3c4043, metalness: .7, roughness: .45 }),
    bumperRubber: std({ ...pbr('hf_rubber', .5), color: 0xb0b0b0, roughness: .95, normalScale: new THREE.Vector2(1, 1) }),
    // vehicles
    truckWhite: phys({ color: 0xf4f5f3, roughness: .35, metalness: .1, clearcoat: .6, clearcoatRoughness: .25 }),
    truckRed: phys({ color: 0xc8102e, roughness: .35, metalness: .15, clearcoat: .7, clearcoatRoughness: .2 }),
    trailerBox: std({ color: 0xe9ebe9, roughness: .5, metalness: .15, normalMap: ribN, normalScale: new THREE.Vector2(.5, .5) }),
    tyre: std({ color: 0x1a1a1a, roughness: .9 }),
    rim: std({ color: 0xbfc3c6, metalness: .9, roughness: .3 }),
    chassis: std({ color: 0x2a2d30, metalness: .5, roughness: .6 }),
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
  [M.facade.lightMap, M.concrete.lightMap].forEach(() => {});
  /* door leaf from configuration */
  function applyDoor(ral, { kind, metallic } = {}) {
    const d = M.door; d.color.set(ral); d.clearcoat = metallic ? .5 : .15; d.metalness = metallic ? .55 : .25; d.roughness = metallic ? .4 : .55;
    d.needsUpdate = true;
    M.doorInner.color.set(ral).lerp(new THREE.Color(0xffffff), .25);
  }
  return { M, tx, pbr, noiseTex, ribN, applyDoor };
}
