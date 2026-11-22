/* Hearbuds Pro: one scroll-driven Three.js scene, four chapters.
   Labels follow the creator's 8-step recipe: Object3D anchors on the model,
   per-frame getWorldPosition + project, pixel conversion, HTML pills offset
   120px up and left, SVG leader line 1px at 60% opacity with a 4px dot,
   hidden when the anchor faces away or leaves the frame, only for the
   active chapter, positions lerped at 0.2 per frame. */
import * as THREE from './three.module.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp01 = v => Math.min(1, Math.max(0, v));
const sstep = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
const seg = (p, a, b) => sstep((p - a) / (b - a));
const trap = (p, a, b, c, d) => seg(p, a, b) * (1 - seg(p, c, d));
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= scroll progress ================= */
const space = $('#scrollSpace');
let targetP = 0, shownP = 0, lastScrollAt = 0;
function readScroll() {
  const max = space.offsetHeight - window.innerHeight;
  targetP = max > 0 ? clamp01(window.scrollY / max) : 0;
}
window.addEventListener('scroll', () => { readScroll(); lastScrollAt = performance.now(); }, { passive: true });
window.addEventListener('resize', readScroll);
readScroll();

const SETTLED = [0.02, 0.385, 0.64, 0.95];
function effectiveP() {
  if (!REDUCED) return shownP;
  let best = SETTLED[0], bd = 1e9;
  for (const s of SETTLED) { const d = Math.abs(s - shownP); if (d < bd) { bd = d; best = s; } }
  return best;
}
function chapterOf(p) { return p < 0.25 ? 0 : p < 0.49 ? 1 : p < 0.74 ? 2 : 3; }

/* ================= three setup ================= */
const container = $('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1218);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

const hemi = new THREE.HemisphereLight(0xbcd8e6, 0x141a20, 0.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(2.5, 4.5, 3.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fd4ee, 2.3);
rim.position.set(-3.5, 2.2, -4.5);
scene.add(rim);
const spot = new THREE.SpotLight(0xfff2dd, 0, 30, 0.5, 0.5);
spot.position.set(0, 6.5, 1.5);
spot.target.position.set(0, 1.1, 0);
scene.add(spot, spot.target);
const caseGlow = new THREE.PointLight(0x9fd4ee, 0, 8, 1.6);
caseGlow.position.set(3.6, 2.1, 2.4);
scene.add(caseGlow);

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  /* widen the lens on narrow screens so the product stays in frame */
  camera.fov = camera.aspect < 0.8 ? 66 : camera.aspect < 1.2 ? 50 : 42;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

/* ================= materials ================= */
const glossMat = new THREE.MeshPhysicalMaterial({ color: 0x11151a, roughness: 0.3, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.25 });
const tipMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.95 });
const innerMat = new THREE.MeshStandardMaterial({ color: 0x1a2129, roughness: 0.6 });

/* ================= earbud model ================= */
function makeAnchor(parent, pos, normal) {
  const a = new THREE.Object3D();
  a.position.copy(pos);
  parent.add(a);
  const ref = new THREE.Object3D();
  ref.position.copy(pos).addScaledVector(normal, 0.5);
  parent.add(ref);
  return { a, ref };
}
function makeBud() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 40, 28), glossMat);
  head.scale.set(1, 1.12, 0.92);
  g.add(head);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.115, 0.16, 20), innerMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.04, 0.28);
  g.add(nozzle);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.125, 24, 18), tipMat);
  tip.scale.set(1, 1, 1.45);
  tip.position.set(0, 0.04, 0.40);
  g.add(tip);
  const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.34, 6, 16), glossMat);
  stem.position.set(0.06, -0.36, -0.07);
  stem.rotation.z = 0.13;
  stem.rotation.x = 0.16;
  g.add(stem);
  const ventDot = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), new THREE.MeshBasicMaterial({ color: 0x05070a }));
  ventDot.position.set(0.085, -0.33, 0.045);
  ventDot.rotation.y = 0.5;
  g.add(ventDot);
  g.userData.aHead = makeAnchor(g, new THREE.Vector3(0.05, 0.31, 0.10), new THREE.Vector3(0.15, 0.9, 0.4).normalize());
  g.userData.aDriver = makeAnchor(g, new THREE.Vector3(0, 0.03, 0.24), new THREE.Vector3(0, 0.05, 1).normalize());
  g.userData.aTip = makeAnchor(g, new THREE.Vector3(0, 0.05, 0.46), new THREE.Vector3(0, 0.12, 1).normalize());
  g.userData.aVent = makeAnchor(g, new THREE.Vector3(0.09, -0.34, 0.05), new THREE.Vector3(0.45, -0.1, 0.89).normalize());
  g.userData.aLatency = makeAnchor(g, new THREE.Vector3(-0.04, -0.17, 0.24), new THREE.Vector3(-0.1, -0.25, 1).normalize());
  return g;
}
const budL = makeBud();
const budR = makeBud();
scene.add(budL, budR);

/* ================= case model ================= */
const caseGroup = new THREE.Group();
const lidPivot = new THREE.Group();
{
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glossMat);
  base.scale.set(1.18, 0.66, 0.88);
  caseGroup.add(base);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.545, 0.022, 10, 48), innerMat);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.scale.set(1.18, 0.88, 1);
  rimRing.position.y = 0.005;
  caseGroup.add(rimRing);
  const wellGeo = new THREE.SphereGeometry(0.17, 20, 12);
  for (const x of [-0.27, 0.27]) {
    const well = new THREE.Mesh(wellGeo, innerMat);
    well.scale.set(1, 0.45, 1);
    well.position.set(x, 0.015, 0.03);
    caseGroup.add(well);
  }
  lidPivot.position.set(0, 0.01, -0.46);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glossMat);
  lid.scale.set(1.18, 0.66, 0.88);
  lid.position.set(0, 0, 0.46);
  lidPivot.add(lid);
  caseGroup.add(lidPivot);
}
scene.add(caseGroup);
let lidMark = null;
function addLidMark(tex) {
  lidMark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 })
  );
  lidMark.position.set(0, 0.30, 0.47);
  lidMark.rotation.x = -0.5;
  lidPivot.add(lidMark);
}

/* ================= text textures ================= */
function textTexture(text, font, color, ls = 0) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const x = c.getContext('2d');
  x.font = font;
  try { x.letterSpacing = ls + 'px'; } catch (e) {}
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = color;
  x.fillText(text, 1024, 266);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 126);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const blobTex = blobTexture();
function makeBlob(sx, sz, opacity) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(sx, sz),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/* ================= environments ================= */
function fadeGroup() { const g = new THREE.Group(); g.userData.mats = []; scene.add(g); return g; }
function regMat(g, m) { m.transparent = true; g.userData.mats.push(m); return m; }
function setWeight(g, w) {
  g.visible = w > 0.012;
  if (g.visible) for (const m of g.userData.mats) m.opacity = w;
}

/* valley */
const envValley = fadeGroup();
{
  const rockMat = regMat(envValley, new THREE.MeshStandardMaterial({ color: 0x0d1218, roughness: 1, flatShading: true }));
  const rockMat2 = regMat(envValley, new THREE.MeshStandardMaterial({ color: 0x131a21, roughness: 1, flatShading: true }));
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = [
    [-6.4, 0.6, -3.0, 3.6, rockMat], [-8.0, 2.2, -5.5, 4.6, rockMat2], [-5.2, -0.6, 0.6, 2.4, rockMat2],
    [6.8, 0.4, -3.4, 4.0, rockMat], [8.4, 2.4, -6.0, 4.8, rockMat2], [5.8, -0.8, 0.8, 2.4, rockMat],
    [-3.4, -1.1, -5.5, 2.8, rockMat2], [4.2, -1.2, -6.0, 3.0, rockMat],
  ];
  for (const [x, y, z, s, m] of rocks) {
    const r = new THREE.Mesh(rockGeo, m);
    r.position.set(x, y, z);
    r.scale.set(s, s * 0.78, s);
    r.rotation.set(x * 0.7, z * 1.1, y * 0.5);
    envValley.add(r);
  }
  const mound = new THREE.Mesh(rockGeo, rockMat2);
  mound.position.set(2.35, 0.30, 0.4);
  mound.scale.set(1.3, 0.6, 1.15);
  mound.rotation.y = 0.7;
  envValley.add(mound);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), regMat(envValley, new THREE.MeshStandardMaterial({ color: 0x090d12, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.55;
  envValley.add(ground);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), regMat(envValley, new THREE.MeshBasicMaterial({ color: 0x10303e })));
  glow.position.set(0, 7, -16);
  envValley.add(glow);
}

/* pale steel-blue void (ANC) */
const envBlue = fadeGroup();
{
  const slope = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0),
    regMat(envBlue, new THREE.MeshStandardMaterial({ color: 0x5d7684, roughness: 1, flatShading: true })));
  slope.position.set(-4.6, -0.9, -0.8);
  slope.scale.set(4.6, 2.4, 3.4);
  slope.rotation.set(0.3, 0.8, 0.15);
  envBlue.add(slope);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40),
    regMat(envBlue, new THREE.MeshBasicMaterial({ color: 0x87a5b5 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  envBlue.add(floor);
}

/* light void (Spatial Audio) */
const envLight = fadeGroup();
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40),
    regMat(envLight, new THREE.MeshBasicMaterial({ color: 0xe9edf0 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  envLight.add(floor);
}
let proMat = null;
function addProPlane() {
  proMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.6), proMat);
  p.position.set(-0.5, 1.9, -3.4);
  envLight.add(p);
  return p;
}
const proPlane = addProPlane();

/* dark pedestal gallery (30H Battery) */
const envGallery = fadeGroup();
{
  const floorM = regMat(envGallery, new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.9 }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), floorM);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  envGallery.add(floor);
  const wallM = regMat(envGallery, new THREE.MeshStandardMaterial({ color: 0x0d1013, roughness: 1 }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallM);
  back.position.set(0, 5, -6.5);
  envGallery.add(back);
  const panelM = regMat(envGallery, new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 0.85 }));
  for (const x of [-4.4, 4.4]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7.5, 5), panelM);
    panel.position.set(x, 3.4, -1.5);
    envGallery.add(panel);
  }
  const pedM = regMat(envGallery, new THREE.MeshStandardMaterial({ color: 0x272d35, roughness: 0.7 }));
  for (const [x, h] of [[-2.7, 0.85], [2.7, 0.85]]) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, h, 28), pedM);
    ped.position.set(x, h / 2, -0.6);
    envGallery.add(ped);
  }
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 1.12, 36), pedM);
  centre.position.set(0, 0.56, 0);
  envGallery.add(centre);
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.055, 40),
    regMat(envGallery, new THREE.MeshStandardMaterial({ color: 0xf4f5f6, roughness: 0.35 })));
  tableTop.position.set(0, 1.145, 0);
  envGallery.add(tableTop);
}
let keepMat = null;
function addKeepPlane() {
  keepMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(24, 3.6), keepMat);
  p.position.set(0, 2.6, -5.2);
  envGallery.add(p);
  return p;
}
const keepPlane = addKeepPlane();
let hearMat = null;
function addHearPlane() {
  hearMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), hearMat);
  p.position.set(0, 3.4, -8.5);
  envValley.add(p);
  return p;
}
const hearPlane = addHearPlane();

/* soft blob shadows */
const blobCase = makeBlob(2.2, 1.6, 0);
const blobBudL = makeBlob(1.1, 1.1, 0);
const blobBudR = makeBlob(1.1, 1.1, 0);
scene.add(blobCase, blobBudL, blobBudR);

/* build text planes once fonts are ready (fallbacks fine after timeout) */
Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1400))]).then(() => {
  hearMat.map = textTexture('HEARBUDS', 'italic 900 300px "Archivo Narrow","Archivo",sans-serif', '#d7e7ef');
  hearMat.color.set(0xd7e7ef); hearMat.needsUpdate = true;
  proMat.map = textTexture('PRO', '900 330px "Archivo",sans-serif', '#ffffff');
  proMat.needsUpdate = true;
  keepMat.map = textTexture('KEEP LISTENING', 'italic 900 215px "Archivo Narrow","Archivo",sans-serif', '#d7e7ef');
  keepMat.color.set(0xd7e7ef); keepMat.needsUpdate = true;
  addLidMark(textTexture('HEARBUDS', '600 120px "Archivo",sans-serif', '#cfe0e9', 26));
});

/* ================= keyframe sampling ================= */
function sampler(keys, isEuler = false) {
  return p => {
    if (p <= keys[0][0]) return isEuler ? new THREE.Euler(...keys[0][1]) : new THREE.Vector3(...keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) {
      const [p0, v0] = keys[i], [p1, v1] = keys[i + 1];
      if (p <= p1) {
        const t = sstep((p - p0) / (p1 - p0));
        if (isEuler) return new THREE.Euler(
          v0[0] + (v1[0] - v0[0]) * t, v0[1] + (v1[1] - v0[1]) * t, v0[2] + (v1[2] - v0[2]) * t);
        return new THREE.Vector3(
          v0[0] + (v1[0] - v0[0]) * t, v0[1] + (v1[1] - v0[1]) * t, v0[2] + (v1[2] - v0[2]) * t);
      }
    }
    const last = keys[keys.length - 1][1];
    return isEuler ? new THREE.Euler(...last) : new THREE.Vector3(...last);
  };
}
function scalarSampler(keys) {
  return p => {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [p0, v0] = keys[i], [p1, v1] = keys[i + 1];
      if (p <= p1) return v0 + (v1 - v0) * sstep((p - p0) / (p1 - p0));
    }
    return keys[keys.length - 1][1];
  };
}

const camPosAt = sampler([
  [0.00, [0.5, 1.65, 8.8]], [0.10, [0.9, 1.45, 6.6]], [0.18, [2.7, 1.35, 4.7]],
  [0.26, [-3.4, 2.8, 5.4]], [0.36, [0, 1.5, 7.2]], [0.46, [0.6, 1.5, 7.0]],
  [0.54, [0, 1.45, 7.4]], [0.62, [0.4, 1.4, 6.6]], [0.665, [0.1, 1.42, 2.7]],
  [0.72, [0, 1.6, 6.4]], [0.80, [0, 1.8, 8.8]], [0.88, [0, 1.6, 6.0]],
  [0.94, [0, 1.55, 5.2]], [1.00, [0, 1.5, 5.0]],
]);
const camTgtAt = sampler([
  [0.00, [0.8, 1.1, 0]], [0.10, [1.6, 0.9, 0.3]], [0.18, [2.35, 0.85, 0.4]],
  [0.26, [0, 1.4, 0]], [0.36, [-0.2, 1.35, 0]], [0.54, [0.3, 1.3, 0]],
  [0.665, [0.9, 1.35, 0]], [0.72, [0, 1.2, 0]], [0.88, [0, 1.2, 0]], [1.00, [0, 1.15, 0]],
]);
const SLOT_L = [2.06, 0.82, 0.44], SLOT_R = [2.64, 0.82, 0.44];
const budLPosAt = sampler([
  [0.00, SLOT_L], [0.20, SLOT_L], [0.27, [0.6, 2.7, 0.6]], [0.36, [-1.15, 1.78, 0.1]],
  [0.46, [-1.05, 1.70, 0.1]], [0.52, [-2.9, 1.55, 0.2]], [0.60, [0.2, 1.45, 0.2]],
  [0.665, [0.9, 1.35, 0]], [0.70, [0.4, 2.15, 0.3]], [0.74, [-0.27, 0.64, 0.75]],
  [0.84, [-0.27, 1.34, 0.05]], [1.00, [-0.27, 1.34, 0.05]],
]);
const budRPosAt = sampler([
  [0.00, SLOT_R], [0.20, SLOT_R], [0.28, [1.8, 2.3, 0.9]], [0.36, [0.78, 0.98, 0.35]],
  [0.46, [0.85, 1.02, 0.35]], [0.52, [-1.7, 1.30, 0.3]], [0.60, [1.5, 1.30, 0.3]],
  [0.665, [4.6, 1.3, 0.3]], [0.70, [1.2, 2.25, 0.4]], [0.74, [0.27, 0.64, 0.75]],
  [0.84, [0.27, 1.34, 0.05]], [1.00, [0.27, 1.34, 0.05]],
]);
const budLRotAt = sampler([
  [0.00, [-0.25, -0.3, 0.1]], [0.20, [-0.25, -0.3, 0.1]], [0.30, [2.2, 1.2, 0.8]],
  [0.36, [0.35, -0.55, 0.25]], [0.46, [0.5, -0.2, 0.3]], [0.60, [0.2, -0.9, 0.15]],
  [0.665, [0.05, -0.95, 0.05]], [0.74, [-0.25, 0.2, 0.1]], [0.84, [-0.25, 0, 0]], [1.00, [-0.25, 0, 0]],
], true);
const budRRotAt = sampler([
  [0.00, [-0.25, 0.3, -0.1]], [0.20, [-0.25, 0.3, -0.1]], [0.30, [-1.8, 2.4, 1.1]],
  [0.36, [-0.5, 0.75, -0.35]], [0.46, [-0.2, 1.3, -0.2]], [0.60, [0.1, 0.6, 0.1]],
  [0.74, [-0.25, -0.2, -0.1]], [0.84, [-0.25, 0, 0]], [1.00, [-0.25, 0, 0]],
], true);
const budLScaleAt = scalarSampler([[0.00, 1], [0.60, 1], [0.665, 1.55], [0.70, 1], [1.00, 1]]);
const casePosAt = sampler([
  [0.00, [2.35, 0.80, 0.4]], [0.55, [2.35, 0.80, 0.4]], [0.68, [0, 0.62, 0.7]],
  [0.76, [0, 0.62, 0.7]], [0.86, [0, 1.32, 0]], [1.00, [0, 1.32, 0]],
]);
const caseRotYAt = scalarSampler([[0.00, -0.4], [0.55, -0.4], [0.68, 0.15], [0.86, 0], [1.00, 0]]);
const lidAt = scalarSampler([[0.00, 0], [0.12, 0], [0.20, -1.85], [0.84, -1.85], [0.90, 0], [1.00, 0]]);
const bgAt = (() => {
  const cols = [
    [0.00, new THREE.Color(0x0a1218)], [0.28, new THREE.Color(0x0a1218)],
    [0.38, new THREE.Color(0x7fa3b5)], [0.47, new THREE.Color(0x87a9ba)],
    [0.55, new THREE.Color(0xeef0f2)], [0.70, new THREE.Color(0xeef0f2)],
    [0.80, new THREE.Color(0x0b0d10)], [1.00, new THREE.Color(0x0b0d10)],
  ];
  return p => {
    if (p <= cols[0][0]) return cols[0][1].clone();
    for (let i = 0; i < cols.length - 1; i++) {
      const [p0, c0] = cols[i], [p1, c1] = cols[i + 1];
      if (p <= p1) return c0.clone().lerp(c1, sstep((p - p0) / (p1 - p0)));
    }
    return cols[cols.length - 1][1].clone();
  };
})();

/* ================= labels (recipe steps 1 to 8) ================= */
const labelSvg = $('#labelSvg');
const SVGNS = 'http://www.w3.org/2000/svg';
const LABELS = [
  { id: 'lbl-bluetooth', anchor: () => budL.userData.aHead, chapter: 1, range: [0.345, 0.44], off: [-120, -120] },
  { id: 'lbl-latency', anchor: () => budR.userData.aLatency, chapter: 1, range: [0.345, 0.44], off: [-120, -120] },
  { id: 'lbl-driver', anchor: () => budL.userData.aDriver, chapter: 2, range: [0.615, 0.668], off: [-120, -165] },
  { id: 'lbl-tips', anchor: () => budL.userData.aTip, chapter: 2, range: [0.615, 0.668], off: [-150, -15] },
  { id: 'lbl-vent', anchor: () => budL.userData.aVent, chapter: 2, range: [0.615, 0.668], off: [120, -120] },
];
for (const L of LABELS) {
  L.el = document.getElementById(L.id);
  L.line = document.createElementNS(SVGNS, 'line');
  L.line.setAttribute('stroke-width', '1');
  L.dot = document.createElementNS(SVGNS, 'circle');
  L.dot.setAttribute('r', '2');
  labelSvg.append(L.line, L.dot);
  L.cur = { x: 0, y: 0 };
  L.shown = false;
  L.state = { opacity: 0, facing: false, dotX: 0, dotY: 0 };
}
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Vector3();
function updateLabels(p, chapter) {
  const w = container.clientWidth, h = container.clientHeight;
  labelSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const idle = REDUCED || performance.now() - lastScrollAt > 180;
  const dark = chapter === 2;
  for (const L of LABELS) {
    const { a, ref } = L.anchor();
    a.getWorldPosition(_v);
    const worldPos = _v.clone();
    _v.project(camera);
    const behind = _v.z > 1;
    const px = (_v.x + 1) / 2 * w, py = (1 - _v.y) / 2 * h;
    ref.getWorldPosition(_n);
    _n.sub(worldPos).normalize();
    _c.copy(camera.position).sub(worldPos).normalize();
    const facing = _n.dot(_c) > 0.12;
    const inRange = p >= L.range[0] && p <= L.range[1] && chapter === L.chapter;
    const active = inRange && idle && facing && !behind;
    if (active && !L.shown) { L.cur.x = px; L.cur.y = py; }
    L.shown = active;
    /* recipe step 8: lerp at 0.2 per frame */
    const k = REDUCED ? 1 : 0.2;
    L.cur.x += (px - L.cur.x) * k;
    L.cur.y += (py - L.cur.y) * k;
    const pillX = L.cur.x + L.off[0], pillY = L.cur.y + L.off[1];
    L.el.style.transform = `translate(${pillX}px, ${pillY}px) translate(-50%, -50%)`;
    L.el.style.opacity = active ? '1' : '0';
    const stroke = dark ? 'rgba(16,21,27,0.6)' : 'rgba(255,255,255,0.6)';
    L.line.setAttribute('x1', pillX); L.line.setAttribute('y1', pillY);
    L.line.setAttribute('x2', L.cur.x); L.line.setAttribute('y2', L.cur.y);
    L.line.setAttribute('stroke', stroke);
    L.line.style.opacity = active ? '1' : '0';
    L.dot.setAttribute('cx', L.cur.x); L.dot.setAttribute('cy', L.cur.y);
    L.dot.setAttribute('fill', dark ? 'rgba(16,21,27,0.85)' : 'rgba(255,255,255,0.9)');
    L.dot.style.opacity = active ? '1' : '0';
    L.state = { opacity: active ? 1 : 0, facing, dotX: L.cur.x, dotY: L.cur.y, pillX, pillY };
  }
}

/* ================= DOM chapter state ================= */
const copies = $$('.copy');
const navLinks = $$('.nav-link');
const underline = $('#navUnderline');
const header = $('#siteHeader');
const stageEl = $('#stage');
const counterNum = $('#counterNum');
const counterCap = $('#counterCap');
const scrollHint = $('#scrollHint');
let curChapter = -1;
function setChapter(ch, p) {
  copies.forEach(c => { c.hidden = Number(c.dataset.copy) !== ch; });
  navLinks.forEach(l => l.classList.toggle('is-active', Number(l.dataset.chapter) === ch));
  const active = navLinks[ch];
  if (active) {
    underline.style.width = active.offsetWidth + 'px';
    underline.style.transform = `translateX(${active.offsetLeft}px)`;
  }
  const light = ch === 2;
  header.dataset.theme = light ? 'light' : 'dark';
  stageEl.dataset.theme = light ? 'light' : 'dark';
  if (p >= 0.13 && p < 0.26) { counterNum.textContent = '02'; counterCap.textContent = 'Open the case'; }
  else {
    counterNum.textContent = '0' + (ch + 1);
    counterCap.textContent = ['Hi-Fi Sound', 'Adaptive ANC', 'Spatial Audio', '30H Battery'][ch];
  }
  scrollHint.style.opacity = p < 0.02 ? '1' : '0';
}

/* ================= timeline ================= */
function applyTimeline(p, t) {
  camera.position.copy(camPosAt(p));
  camera.lookAt(camTgtAt(p));

  const wValley = 1 - seg(p, 0.22, 0.33);
  const wBlue = trap(p, 0.27, 0.36, 0.45, 0.52);
  const wLight = trap(p, 0.50, 0.55, 0.71, 0.78);
  const wGallery = seg(p, 0.76, 0.85);
  setWeight(envValley, wValley);
  setWeight(envBlue, wBlue);
  setWeight(envLight, wLight);
  setWeight(envGallery, wGallery);
  hearMat.opacity = wValley;
  keepMat.opacity = wGallery;
  proMat.opacity = wLight;
  proMat.color.setRGB(0.78 - 0.72 * seg(p, 0.53, 0.62), 0.80 - 0.73 * seg(p, 0.53, 0.62), 0.83 - 0.75 * seg(p, 0.53, 0.62));
  scene.background.copy(bgAt(p));
  rim.intensity = 2.3 * (wValley + wBlue + wGallery) + 0.35 * wLight + 0.2;
  hemi.intensity = 0.55 + 0.85 * wLight + 0.25 * wBlue;
  spot.intensity = 260 * wGallery;
  caseGlow.intensity = 14 * wValley;

  caseGroup.visible = p < 0.34 || p > 0.66;
  caseGroup.position.copy(casePosAt(p));
  caseGroup.rotation.y = caseRotYAt(p);
  lidPivot.rotation.x = lidAt(p);

  budL.position.copy(budLPosAt(p));
  budL.rotation.copy(budLRotAt(p));
  const ls = budLScaleAt(p);
  budL.scale.setScalar(ls);
  budR.position.copy(budRPosAt(p));
  budR.rotation.copy(budRRotAt(p));

  /* gentle drift while the ANC chapter is settled */
  if (p > 0.345 && p < 0.44 && !REDUCED) {
    budL.position.y += Math.sin(t * 0.0011) * 0.05;
    budR.position.y += Math.cos(t * 0.0009) * 0.05;
    budR.rotation.y += Math.sin(t * 0.0006) * 0.12;
  }

  /* blob shadows on the light ground and the gallery floor */
  const lightFloor = wLight > 0.4;
  blobCase.material.opacity = lightFloor ? 0.5 : 0;
  blobBudL.material.opacity = lightFloor ? 0.4 : 0;
  blobBudR.material.opacity = lightFloor ? 0.4 : 0;
  if (lightFloor) {
    blobCase.position.set(caseGroup.position.x, 0.005, caseGroup.position.z);
    blobBudL.position.set(budL.position.x, 0.005, budL.position.z);
    blobBudR.position.set(budR.position.x, 0.005, budR.position.z);
  }
}

/* ================= render loop ================= */
let lastChapter = -1;
function frame(t) {
  requestAnimationFrame(frame);
  if (REDUCED) shownP = targetP;
  else shownP += (targetP - shownP) * 0.14;
  if (Math.abs(targetP - shownP) < 0.0004) shownP = targetP;
  const p = effectiveP();
  const ch = chapterOf(p);
  applyTimeline(p, t);
  renderer.render(scene, camera);
  updateLabels(p, ch);
  if (ch !== lastChapter || Math.abs(p - (frame._lp ?? -1)) > 0.002) {
    setChapter(ch, p);
    lastChapter = ch;
    frame._lp = p;
  }
}
resize();
requestAnimationFrame(frame);

/* test hook */
window.__hearbuds = {
  progress: () => effectiveP(),
  rawProgress: () => targetP,
  chapter: () => chapterOf(effectiveP()),
  label: id => {
    const L = LABELS.find(l => l.id === id);
    return L ? { ...L.state } : null;
  },
  colour: () => currentColour,
  setColour: name => setColour(name),
  budScreen: which => {
    const b = which === 'R' ? budR : budL;
    const v = new THREE.Vector3();
    b.getWorldPosition(v); v.project(camera);
    return { x: (v.x + 1) / 2 * container.clientWidth, y: (1 - v.y) / 2 * container.clientHeight, z: v.z };
  },
};

/* ================= navigation ================= */
const GOTO_P = [0.0, 0.385, 0.575, 0.95];
function gotoP(p) {
  const max = space.offsetHeight - window.innerHeight;
  window.scrollTo({ top: p * max, behavior: REDUCED ? 'auto' : 'smooth' });
}
$$('[data-goto]').forEach(el => {
  el.addEventListener('click', () => {
    const custom = el.dataset.gotoP;
    gotoP(custom !== undefined ? Number(custom) : GOTO_P[Number(el.dataset.goto)]);
  });
});

/* ================= sheets ================= */
const backdrop = $('#sheetBackdrop');
let openSheetEl = null;
function openSheet(el) {
  closeSheet(true);
  openSheetEl = el;
  el.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add('show');
    backdrop.classList.add('show');
  }));
  setTimeout(() => { el.classList.add('show'); backdrop.classList.add('show'); }, 90);
}
function closeSheet(instant = false) {
  if (!openSheetEl) { backdrop.hidden = true; return; }
  const el = openSheetEl;
  openSheetEl = null;
  el.classList.remove('show');
  backdrop.classList.remove('show');
  setTimeout(() => { el.hidden = true; backdrop.hidden = true; }, instant ? 0 : 480);
}
backdrop.addEventListener('click', () => closeSheet());
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeSheet()));

/* ================= colour selector ================= */
let currentColour = 'Midnight';
const colourBtns = $$('.colour');
function setColour(name) {
  currentColour = name;
  const pearl = name === 'Pearl';
  glossMat.color.set(pearl ? 0xe9e4d8 : 0x11151a);
  glossMat.roughness = pearl ? 0.22 : 0.3;
  tipMat.color.set(pearl ? 0xd9d2c2 : 0x2b3038);
  colourBtns.forEach(b => {
    const on = b.dataset.colour === name;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const sel = $('#bfColour');
  if (sel) sel.value = name;
}
colourBtns.forEach(b => b.addEventListener('click', () => setColour(b.dataset.colour)));

/* ================= buy + compare ================= */
const buySheet = $('#buySheet'), compareSheet = $('#compareSheet');
function openBuy() { openSheet(buySheet); }
$('#buyBtn').addEventListener('click', openBuy);
$('#preorderBtn').addEventListener('click', () => { gotoP(0.95); openBuy(); });
$$('[data-buy]').forEach(b => b.addEventListener('click', openBuy));
$('#compareBtn').addEventListener('click', () => openSheet(compareSheet));
$$('[data-compare]').forEach(b => b.addEventListener('click', () => openSheet(compareSheet)));
$('[data-buy-from-compare]').addEventListener('click', openBuy);

const bfQty = $('#bfQty'), bfTotal = $('#bfTotal'), bfColour = $('#bfColour');
function syncTotal() { bfTotal.textContent = '$' + (199 * Number(bfQty.value)); }
bfQty.addEventListener('change', syncTotal);
bfColour.addEventListener('change', () => setColour(bfColour.value));
syncTotal();

$('#buyForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#bfName').value.trim();
  const email = $('#bfEmail').value.trim();
  const err = $('#bfError');
  const missing = [];
  if (!name) missing.push('your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) missing.push('a valid email');
  if (missing.length) {
    err.hidden = false;
    err.textContent = 'Please add ' + missing.join(' and ') + ' so we can reserve your pair.';
    return;
  }
  err.hidden = true;
  const ref = 'HB-2026-' + (1000 + Math.floor(Math.random() * 9000));
  const qty = Number(bfQty.value);
  $('#bfSuccessText').textContent =
    `Thank you, ${name}. ${qty} pair${qty > 1 ? 's' : ''} of Hearbuds Pro in ${currentColour} ${qty > 1 ? 'are' : 'is'} reserved under reference ${ref}. ` +
    `Total ${bfTotal.textContent}, charged only when your pair ships. A confirmation is on its way to ${email}.`;
  $('#bfSuccess').hidden = false;
});
