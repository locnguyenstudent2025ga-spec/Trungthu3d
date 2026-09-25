/**
 * Trung Thu 3D - Đêm Trăng Rằm Lung Linh
 * Vanilla Three.js + Custom GLSL Shaders + Mobile Performance Engine
 */

// ── 1. CẤU HÌNH THIẾT BỊ & HIỆU SUẤT (3-TIER ENGINE) ──────────
const ua = navigator.userAgent;
const IS_MOBILE =
  /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
  window.innerWidth < 768;

const IS_LOW_END =
  IS_MOBILE &&
  (() => {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    return cores <= 4 || memory <= 2;
  })();

// Mặc định mọi thiết bị hiện đại (kể cả smartphone) đều chạy cấu hình cao cấp Ultra HD
const DEVICE_TIER = IS_LOW_END ? "mid" : "high";

const CFG = {
  high: {
    blossomCount: 38000,
    lanternCount: 38,
    petalCount: 160,
    starCount: 850,
    mwCount: 7500,
    moonSegments: 64,
    waterSegments: 72,
    antialias: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2.0), // Nét căng chuẩn Retina HD
    waterEnabled: true,
    shootingEnabled: false,
    hitRadius: 1.8,
  },
  mid: {
    blossomCount: 26000,
    lanternCount: 28,
    petalCount: 100,
    starCount: 600,
    mwCount: 4500,
    moonSegments: 56,
    waterSegments: 64,
    antialias: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.8),
    waterEnabled: true,
    shootingEnabled: false,
    hitRadius: 2.0,
  },
  low: {
    blossomCount: 14000,
    lanternCount: 18,
    petalCount: 50,
    starCount: 300,
    mwCount: 1800,
    moonSegments: 36,
    waterSegments: 48,
    antialias: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    waterEnabled: true,
    shootingEnabled: false,
    hitRadius: 2.4,
  },
}[DEVICE_TIER];

// ── 2. KHỞI TẠO SCENE, CAMERA, RENDERER ────────────────────────
const container = document.getElementById("webgl-container");

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040210, 0.0072);

// Góc nhìn điện thoại (FOV 48 độ) giúp đảo ngọc & vầng trăng tráng lệ, không bị méo góc rộng
const camera = new THREE.PerspectiveCamera(
  IS_MOBILE ? 48 : 45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const DEFAULT_CAM_POS = IS_MOBILE
  ? new THREE.Vector3(0, 9.6, 36.5)
  : new THREE.Vector3(0, 10, 40);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 5.2, 0);

camera.position.copy(DEFAULT_CAM_POS);

const renderer = new THREE.WebGLRenderer({
  antialias: true, // Luôn bật khử răng cưa mượt mà trên cả PC & Mobile
  alpha: false,
  powerPreference: "high-performance",
  precision: "highp", // Chuẩn 32-bit float sắc nét, dải màu mượt mà không bị bết
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(CFG.pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25; // Rực rỡ, lung linh đồng nhất giữa PC & Mobile
renderer.shadowMap.enabled = false;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 + 0.04;
controls.minDistance = 6;
controls.maxDistance = 88;
controls.target.copy(DEFAULT_CAM_TARGET);
window.camera = camera;
window.controls = controls;

const clock = new THREE.Clock();

// ── 3. HỆ THỐNG ÁNH SÁNG ──────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x2a103d, 1.45);
scene.add(ambientLight);

const treeLight = new THREE.PointLight(0xffb6c1, 2.6, 45);
treeLight.position.set(0, 8, 0);
scene.add(treeLight);

const warmLight = new THREE.PointLight(0xffaa33, 2.0, 32);
warmLight.position.set(0, -1.8, 0);
scene.add(warmLight);

const waterReflLight = new THREE.PointLight(0x00d8f0, 1.5, 50);
waterReflLight.position.set(0, -4.2, 0);
scene.add(waterReflLight);

// ── 4. CACHED TEXTURES CHUNG ──────────────────────────────────
function createParticleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.35, "rgba(240,182,188,0.65)");
  grad.addColorStop(1, "rgba(240,182,188,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(16, 16, 16, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
const SHARED_PARTICLE_TEX = createParticleTexture();

function createLanternTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#ff4141");
  grad.addColorStop(0.5, "#d62839");
  grad.addColorStop(1, "#ffb703");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 120, 120);

  // Hoa văn chữ "Phúc" cách điệu
  ctx.fillStyle = "rgba(255, 235, 150, 0.4)";
  ctx.font = "bold 42px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✦", 64, 64);

  return new THREE.CanvasTexture(canvas);
}
const SHARED_LANTERN_TEX = createLanternTexture();

function createBlossomTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const cx = 64, cy = 64;

  ctx.save();
  // 5 cánh hoa mềm mại
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);

    const grad = ctx.createRadialGradient(0, -22, 4, 0, -18, 38);
    grad.addColorStop(0, "rgba(255, 252, 254, 0.98)");
    grad.addColorStop(0.42, "rgba(255, 178, 202, 0.94)");
    grad.addColorStop(0.8, "rgba(235, 92, 138, 0.85)");
    grad.addColorStop(1, "rgba(215, 60, 105, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-16, -14, -22, -34, 0, -44);
    ctx.bezierCurveTo(22, -34, 16, -14, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  // Nhụy hoa tâm vàng kim rạng rỡ
  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
  centerGrad.addColorStop(0, "rgba(255, 240, 130, 1)");
  centerGrad.addColorStop(0.55, "rgba(255, 185, 45, 0.9)");
  centerGrad.addColorStop(1, "rgba(230, 95, 30, 0)");
  ctx.fillStyle = centerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();

  // Nhị hoa phát sáng
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * Math.PI * 2;
    const r = 9;
    ctx.fillStyle = "#fff8a5";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
const SHARED_BLOSSOM_TEX = createBlossomTexture();

function createLeafTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const cx = 64, cy = 64;

  ctx.save();
  ctx.translate(cx, cy);

  // Gradient thân lá mùa thu ấm áp
  const grad = ctx.createLinearGradient(0, -50, 0, 50);
  grad.addColorStop(0, "#ffe066");
  grad.addColorStop(0.35, "#ff9f1c");
  grad.addColorStop(0.75, "#e71d36");
  grad.addColorStop(1, "#8b0000");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.bezierCurveTo(28, -25, 34, 18, 0, 48);
  ctx.bezierCurveTo(-34, 18, -28, -25, 0, -52);
  ctx.fill();

  // Gân lá vàng kim thanh nhã
  ctx.strokeStyle = "rgba(255, 240, 160, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(0, 45);
  ctx.stroke();

  for (let y = -24; y <= 24; y += 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(14, y - 8);
    ctx.moveTo(0, y);
    ctx.lineTo(-14, y - 8);
    ctx.stroke();
  }

  // Viền dạ quang phát sáng nhẹ
  ctx.strokeStyle = "rgba(255, 215, 0, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
const SHARED_LEAF_TEX = createLeafTexture();


// Khai báo sớm các mảng dùng chung - cần trước khi code nhân vật & đảo chạy
const lanterns = [];
const interactiveObjects = [];
window.lanterns = lanterns;
window.interactiveObjects = interactiveObjects;

// ── 5. ĐẢO NỔI & CÂY HOA ANH ĐÀO ─────────────────────────────
const islandGroup = new THREE.Group();
scene.add(islandGroup);

const islandGeo = new THREE.CylinderGeometry(
  8.5,
  2.2,
  7.5,
  IS_MOBILE ? 32 : 48,
  12,
);
const posAttr = islandGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const vx = posAttr.getX(i);
  const vy = posAttr.getY(i);
  const vz = posAttr.getZ(i);
  const distFromCenter = Math.sqrt(vx * vx + vz * vz);
  const noise =
    Math.sin(vx * 0.8) * Math.cos(vz * 0.8) * 0.6 +
    Math.sin(vx * 1.8 + vz * 1.5) * 0.3;

  if (vy > 0) {
    posAttr.setY(i, vy + noise * (1.0 - distFromCenter / 12));
  } else {
    posAttr.setX(i, vx + (Math.random() - 0.5) * 1.4);
    posAttr.setZ(i, vz + (Math.random() - 0.5) * 1.4);
  }
}
islandGeo.computeVertexNormals();

const islandMat = new THREE.MeshStandardMaterial({
  color: 0x3d231b,
  roughness: 0.85,
  flatShading: true,
});
const islandMesh = new THREE.Mesh(islandGeo, islandMat);
islandGroup.add(islandMesh);

const topGeo = new THREE.CylinderGeometry(8.6, 7.8, 0.8, IS_MOBILE ? 32 : 48, 4);
const topPos = topGeo.attributes.position;
for (let i = 0; i < topPos.count; i++) {
  const vx = topPos.getX(i);
  const vy = topPos.getY(i);
  const vz = topPos.getZ(i);
  const noise = Math.sin(vx * 0.9) * Math.cos(vz * 0.9) * 0.5;
  topPos.setY(i, vy + noise * 0.4);
}
topGeo.computeVertexNormals();
const topMat = new THREE.MeshStandardMaterial({
  color: 0x22130e,
  roughness: 0.9,
  flatShading: true,
});
const topMesh = new THREE.Mesh(topGeo, topMat);
topMesh.position.y = 3.6;
islandGroup.add(topMesh);

// Bệ đá và đá tảng
const stoneMat = new THREE.MeshStandardMaterial({
  color: 0x4a4d52,
  roughness: 0.85,
  metalness: 0.1,
  flatShading: true,
});

const mainStonePlatformGeo = new THREE.CylinderGeometry(2.5, 3.0, 0.15, 6);
const mainStonePlatform = new THREE.Mesh(mainStonePlatformGeo, stoneMat);
mainStonePlatform.position.set(0, 3.9, 0);
islandGroup.add(mainStonePlatform);

const rockCount = 3;
for (let i = 0; i < rockCount; i++) {
  const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.25, 0);
  const rockMesh = new THREE.Mesh(rockGeo, stoneMat);
  const angle = (i / rockCount) * Math.PI * 2 + 0.5;
  const dist = 3.8 + Math.random() * 2.0;
  rockMesh.position.set(Math.cos(angle) * dist, 3.9, Math.sin(angle) * dist);
  rockMesh.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI,
  );
  islandGroup.add(rockMesh);
}

// ── 5. ĐẢO NỔI & CÂY HOA CỔ THỤ NGUYỆT QUẾ TRÁNG LỆ ────────────
const treeGroup = new THREE.Group();
treeGroup.position.set(0, 3.95, 0);
islandGroup.add(treeGroup);

const trunkMat = new THREE.MeshStandardMaterial({
  color: 0x331c12,
  roughness: 0.86,
  flatShading: true,
});

// Thân cây cổ thụ uốn lượn phong trần
const trunkCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0.3, 2.2, -0.2),
  new THREE.Vector3(-0.25, 4.6, 0.2),
  new THREE.Vector3(0.15, 6.8, -0.1),
  new THREE.Vector3(0.0, 8.8, 0.0),
]);

const trunkGeo = new THREE.TubeGeometry(trunkCurve, 36, 0.44, 10, false);
const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
treeGroup.add(trunkMesh);

// Rễ cổ thụ cuồn cuộn ôm chặt bệ đá
const rootAngles = [0.3, 1.5, 2.7, 3.9, 5.2];
rootAngles.forEach((ang) => {
  const rCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.8, 0),
    new THREE.Vector3(Math.cos(ang) * 0.9, 0.3, Math.sin(ang) * 0.9),
    new THREE.Vector3(Math.cos(ang) * 2.0, -0.15, Math.sin(ang) * 2.0),
  ]);
  const rGeo = new THREE.TubeGeometry(rCurve, 8, 0.15, 6, false);
  const rMesh = new THREE.Mesh(rGeo, trunkMat);
  treeGroup.add(rMesh);
});

// Cành cây nghệ thuật: Có 1 CÀNH CHÍNH LỚN vươn ra mặt hồ để Chú Cuội ngồi câu cá
const branchClusters = [];

// 1. Cành Chú Cuội (chìa ra phía bờ hồ bên phải trước)
const cuoiBranchCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.0, 5.0, 0.1),
  new THREE.Vector3(1.8, 5.8, 0.9),
  new THREE.Vector3(3.6, 6.4, 2.0),
  new THREE.Vector3(4.8, 6.7, 2.8),
]);
const cuoiBranchGeo = new THREE.TubeGeometry(cuoiBranchCurve, 16, 0.22, 8, false);
const cuoiBranchMesh = new THREE.Mesh(cuoiBranchGeo, trunkMat);
treeGroup.add(cuoiBranchMesh);
branchClusters.push({ center: new THREE.Vector3(4.5, 7.2, 2.6), radius: 3.2 });

// Các cành tỏa thế bonsai cung đình xung quanh
const otherBranchAngles = [0.8, 1.6, 2.5, 3.3, 4.2, 5.0, 5.8];
otherBranchAngles.forEach((angle, idx) => {
  const h = 3.6 + (idx % 3) * 1.8;
  const startP = trunkCurve.getPointAt(h / 8.8);
  const len = 3.2 + (idx % 2) * 1.4;
  const endP = new THREE.Vector3(
    startP.x + Math.cos(angle) * len,
    startP.y + 0.8 + Math.sin(idx) * 0.5,
    startP.z + Math.sin(angle) * len
  );
  const midP = new THREE.Vector3().addVectors(startP, endP).multiplyScalar(0.5);
  midP.y += 0.6;
  const bCurve = new THREE.CatmullRomCurve3([startP, midP, endP]);
  const bGeo = new THREE.TubeGeometry(bCurve, 12, 0.13, 6, false);
  const bMesh = new THREE.Mesh(bGeo, trunkMat);
  treeGroup.add(bMesh);
  branchClusters.push({ center: endP, radius: 3.2 + Math.random() * 0.8 });
});

// DẢI HOA RỦ MỀM MẠI QUANH CÀNH CÂY (Weeping Floral Tendrils)
const weepingVinesGroup = new THREE.Group();
treeGroup.add(weepingVinesGroup);

const vineCount = 18;
for (let v = 0; v < vineCount; v++) {
  const bCenter = branchClusters[v % branchClusters.length].center;
  const startX = bCenter.x * 0.9 + (Math.random() - 0.5) * 1.5;
  const startY = bCenter.y - 0.2 - Math.random() * 0.5;
  const startZ = bCenter.z * 0.9 + (Math.random() - 0.5) * 1.5;
  const len = 1.2 + Math.random() * 1.4;

  const points = [];
  const segments = 6;
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    points.push(new THREE.Vector3(
      startX + Math.sin(t * 2.5 + v) * 0.2,
      startY - t * len,
      startZ + Math.cos(t * 2.5 + v) * 0.2
    ));
  }
  const vCurve = new THREE.CatmullRomCurve3(points);
  const vGeo = new THREE.TubeGeometry(vCurve, 10, 0.02, 4, false);
  const vMat = new THREE.MeshStandardMaterial({
    color: 0x5a2d38,
    roughness: 0.8,
  });
  const vMesh = new THREE.Mesh(vGeo, vMat);
  weepingVinesGroup.add(vMesh);
}

// HẠT HOA ĐÀO 5 CÁNH CHI TIẾT (Detailed 5-Petal Blossoms using SHARED_BLOSSOM_TEX)
const blossomCount = 7000;
const blossomGeo = new THREE.BufferGeometry();
const blossomPos = new Float32Array(blossomCount * 3);
const blossomColors = new Float32Array(blossomCount * 3);

const colorBlossomPink = new THREE.Color(0xf472b6); // Hồng đào tươi tắn
const colorPaleSakura  = new THREE.Color(0xf9a8d4); // Hồng phấn cánh sen dịu dàng
const colorSoftRose    = new THREE.Color(0xfbcfe8); // Hồng pastel êm ái
const colorWarmCream   = new THREE.Color(0xffedf2); // Trắng kem dịu mắt (thay cho trắng tinh)

const blossomCenters = [
  new THREE.Vector3(0, 10.5, 0),
  new THREE.Vector3(1.8, 9.2, 1.2),
  new THREE.Vector3(-2.2, 8.8, -0.8),
  new THREE.Vector3(0.5, 8.2, -2.4),
  new THREE.Vector3(4.2, 8.8, 2.2), // Tán hoa trên đầu Cuội
  new THREE.Vector3(-2.4, 7.2, 1.6),
  ...branchClusters.map(b => b.center)
];

for (let i = 0; i < blossomCount; i++) {
  const center = blossomCenters[i % blossomCenters.length];
  const r = 0.5 + Math.pow(Math.random(), 0.7) * 3.2;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  let bx = center.x + r * Math.sin(phi) * Math.cos(theta);
  let by = center.y + r * Math.sin(phi) * Math.sin(theta) * 0.75;
  let bz = center.z + r * Math.cos(phi);

  // Giữ khoảng không gian trước mặt và quanh Chú Cuội thoáng đãng
  if (Math.hypot(bx - 3.6, by - 6.5, bz - 2.0) < 1.3) {
    by += 1.4; // Đẩy hoa lên trên đầu tạo vòm che
  }

  blossomPos[i * 3]     = bx;
  blossomPos[i * 3 + 1] = by;
  blossomPos[i * 3 + 2] = bz;

  const randC = Math.random();
  let col;
  if (randC < 0.35) {
    col = colorBlossomPink;
  } else if (randC < 0.70) {
    col = colorPaleSakura;
  } else if (randC < 0.90) {
    col = colorSoftRose;
  } else {
    col = colorWarmCream;
  }

  blossomColors[i * 3]     = col.r;
  blossomColors[i * 3 + 1] = col.g;
  blossomColors[i * 3 + 2] = col.b;
}

blossomGeo.setAttribute("position", new THREE.BufferAttribute(blossomPos, 3));
blossomGeo.setAttribute("color", new THREE.BufferAttribute(blossomColors, 3));

const blossomMat = new THREE.PointsMaterial({
  size: 0.72,
  vertexColors: true,
  map: SHARED_BLOSSOM_TEX,
  transparent: true,
  opacity: 0.78,
  blending: THREE.NormalBlending, // Chuyển sang NormalBlending để các cánh hoa giữ sắc hồng mịn, không bị cộng dồn chói gắt
  depthWrite: false,
});
const blossomParticles = new THREE.Points(blossomGeo, blossomMat);
treeGroup.add(blossomParticles);

// ĐÈN LỒNG TREO CÀNH CÂY CỔ THỤ (Hanging Lanterns - Rực Rỡ Ánh Sáng)
const hangingLanterns = [];
const hangingLanternCapMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.8,
  emissive: 0xffbb00,
  emissiveIntensity: 0.8,
});
const hangGlowMatBase = new THREE.SpriteMaterial({
  map: SHARED_PARTICLE_TEX,
  color: 0xff7700,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

// Bảng màu lồng đèn treo cây: thuần các sắc thái của MÀU ĐỎ truyền thống Trung Thu
const LANTERN_COLORS = [0xd90429, 0xef233c, 0xc1121f, 0xb7094c, 0xe63946, 0xa00020];

for (let i = 0; i < 14; i++) {
  const branchP = branchClusters[i % branchClusters.length].center;
  const hangGroup = new THREE.Group();
  hangGroup.position.set(
    branchP.x * 0.88 + (Math.random() - 0.5) * 1.2,
    branchP.y - 0.4 - Math.random() * 0.6,
    branchP.z * 0.88 + (Math.random() - 0.5) * 1.2
  );

  const cordGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4);
  const cord = new THREE.Mesh(cordGeo, hangingLanternCapMat);
  cord.position.y = 0.35;
  hangGroup.add(cord);

  const col = LANTERN_COLORS[i % LANTERN_COLORS.length];
  const miniMat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    transparent: true,
    opacity: 0.95,
  });
  const miniGeo = new THREE.SphereGeometry(0.24, 10, 10);
  miniGeo.scale(1, 1.35, 1);
  const miniMesh = new THREE.Mesh(miniGeo, miniMat);
  hangGroup.add(miniMesh);

  const capGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8);
  const capTop = new THREE.Mesh(capGeo, hangingLanternCapMat);
  capTop.position.y = 0.3;
  hangGroup.add(capTop);
  const capBot = new THREE.Mesh(capGeo, hangingLanternCapMat);
  capBot.position.y = -0.3;
  hangGroup.add(capBot);

  const tassGeo = new THREE.CylinderGeometry(0.01, 0.001, 0.25, 4);
  const tass = new THREE.Mesh(tassGeo, hangingLanternCapMat);
  tass.position.y = -0.45;
  hangGroup.add(tass);

  const glowMat = hangGlowMatBase.clone();
  glowMat.color.setHex(col);
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(2.2, 2.2, 1);
  hangGroup.add(glow);

  treeGroup.add(hangGroup);
  hangingLanterns.push({
    group: hangGroup,
    baseY: hangGroup.position.y,
    phase: i * 0.55 + Math.random() * 0.4,
    glow,
  });
}

// ── HIỆU ỨNG LÁ RỤNG 3D THẬT TỰ NHIÊN (Thay cho các đốm bay) ───────
const leafCount = IS_MOBILE ? 65 : 110;
const leafGeo = new THREE.PlaneGeometry(0.36, 0.48);
const leafMat = new THREE.MeshStandardMaterial({
  map: SHARED_LEAF_TEX,
  transparent: true,
  side: THREE.DoubleSide,
  roughness: 0.5,
  emissive: 0x551100,
  emissiveIntensity: 0.45,
  depthWrite: false,
});

const fallingLeaves = [];
for (let i = 0; i < leafCount; i++) {
  const leafMesh = new THREE.Mesh(leafGeo, leafMat);
  leafMesh.position.set(
    (Math.random() - 0.5) * 14,
    3.0 + Math.random() * 10.0,
    (Math.random() - 0.5) * 14
  );
  leafMesh.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  leafMesh.scale.setScalar(0.7 + Math.random() * 0.6);
  treeGroup.add(leafMesh);

  fallingLeaves.push({
    mesh: leafMesh,
    vy: 0.014 + Math.random() * 0.022,
    vx: (Math.random() - 0.5) * 0.01,
    vz: (Math.random() - 0.5) * 0.01,
    rotX: (Math.random() - 0.5) * 0.035,
    rotY: (Math.random() - 0.5) * 0.03,
    rotZ: (Math.random() - 0.5) * 0.04,
    swaySpeed: 1.0 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
  });
}

function updateAncientTree(time) {
  // Gió đung đưa tán cây và lồng đèn
  hangingLanterns.forEach((hl) => {
    hl.group.rotation.z = Math.sin(time * 0.9 + hl.phase) * 0.12;
    hl.group.rotation.x = Math.cos(time * 0.75 + hl.phase) * 0.08;
    hl.glow.material.opacity = 0.65 + Math.sin(time * 2.5 + hl.phase) * 0.25;
  });

  // Lá mùa thu chao lượn rụng từ cành cây xuống
  for (let i = 0; i < fallingLeaves.length; i++) {
    const l = fallingLeaves[i];
    const m = l.mesh;
    m.position.y -= l.vy;
    m.position.x += l.vx + Math.sin(time * l.swaySpeed + l.phase) * 0.016;
    m.position.z += l.vz + Math.cos(time * l.swaySpeed + l.phase) * 0.016;

    m.rotation.x += l.rotX;
    m.rotation.y += l.rotY;
    m.rotation.z += l.rotZ;

    // Rơi quá mặt nước hồ (-9.0 trong treeGroup tương đương -5.0 world) -> hồi sinh trên cành
    if (m.position.y < -8.8) {
      m.position.set(
        (Math.random() - 0.5) * 12,
        9.0 + Math.random() * 4.5,
        (Math.random() - 0.5) * 12
      );
    }
  }
}

// ── 6. THỎ NGỌC GIÃ THUỐC TIÊN (RÕ RÀNG, ĐẦY NĂNG LƯỢNG) ───────
const sharedRabbitMat = new THREE.MeshStandardMaterial({
  color: 0xfdfdff,
  roughness: 0.45,
});

const jadeRabbitGroup = new THREE.Group();
// Đặt thỏ giã thuốc ngay phía trước bên phải bệ đá, hướng về camera
jadeRabbitGroup.position.set(1.7, 4.02, 2.5);
jadeRabbitGroup.rotation.y = Math.PI * 0.92;
jadeRabbitGroup.scale.setScalar(0.78); // Thu nhỏ thỏ ngọc về kích thước linh thú dễ thương, vừa vặn bên cối ngọc
islandGroup.add(jadeRabbitGroup);

// Thân thỏ
const jBodyGeo = new THREE.SphereGeometry(0.5, 14, 14);
jBodyGeo.scale(0.82, 1.0, 0.9);
const jBodyMesh = new THREE.Mesh(jBodyGeo, sharedRabbitMat);
jBodyMesh.position.y = 0.42;
jadeRabbitGroup.add(jBodyMesh);

// Đầu thỏ
const jHeadGeo = new THREE.SphereGeometry(0.36, 14, 14);
const jHeadMesh = new THREE.Mesh(jHeadGeo, sharedRabbitMat);
jHeadMesh.position.set(0, 0.9, 0.22);
jadeRabbitGroup.add(jHeadMesh);

// Tai thỏ dài với lòng tai hồng
const jEarGeo = new THREE.CylinderGeometry(0.04, 0.09, 0.58, 8);
const jEarLeft = new THREE.Mesh(jEarGeo, sharedRabbitMat);
jEarLeft.position.set(-0.13, 1.36, 0.2);
jEarLeft.rotation.z = 0.16;
jEarLeft.rotation.x = -0.12;
jadeRabbitGroup.add(jEarLeft);

const jEarRight = jEarLeft.clone();
jEarRight.position.x = 0.13;
jEarRight.rotation.z = -0.16;
jadeRabbitGroup.add(jEarRight);

// Hai chân trước (tay thỏ) vươn ra ôm chày
const pawMat = new THREE.MeshStandardMaterial({ color: 0xfdfdff, roughness: 0.5 });
const armGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.45, 8);
const armLeft = new THREE.Mesh(armGeo, pawMat);
armLeft.position.set(-0.2, 0.56, 0.42);
armLeft.rotation.x = Math.PI * 0.32;
armLeft.rotation.z = -0.25;
jadeRabbitGroup.add(armLeft);

const armRight = armLeft.clone();
armRight.position.x = 0.2;
armRight.rotation.z = 0.25;
jadeRabbitGroup.add(armRight);

// Cối đá ngọc
const mortarMat = new THREE.MeshStandardMaterial({
  color: 0x5a6065,
  roughness: 0.85,
  metalness: 0.1,
  flatShading: true,
});
const mortarGeo = new THREE.CylinderGeometry(0.32, 0.24, 0.36, 12);
const mortar = new THREE.Mesh(mortarGeo, mortarMat);
mortar.position.set(0, 0.18, 0.58);
jadeRabbitGroup.add(mortar);

// Dung dịch thuốc ngọc phát sáng bên trong cối
const elixirLiquidMat = new THREE.MeshBasicMaterial({ color: 0x00ffd2 });
const elixirLiquidGeo = new THREE.CircleGeometry(0.22, 10);
elixirLiquidGeo.rotateX(-Math.PI / 2);
const elixirLiquid = new THREE.Mesh(elixirLiquidGeo, elixirLiquidMat);
elixirLiquid.position.set(0, 0.35, 0.58);
jadeRabbitGroup.add(elixirLiquid);

// Chày ngọc to bản hai tay ôm giã
const pestleMat = new THREE.MeshStandardMaterial({
  color: 0x8ecae6,
  roughness: 0.4,
  metalness: 0.2,
});
const pestleGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.82, 10);
const jadePestle = new THREE.Mesh(pestleGeo, pestleMat);
jadePestle.position.set(0, 0.85, 0.58);
jadePestle.rotation.x = 0.08;
jadeRabbitGroup.add(jadePestle);

// Sóng xung kích năng lượng ma thuật nở rộng từ miệng cối khi giã
const shockGeo = new THREE.RingGeometry(0.18, 0.42, 24);
shockGeo.rotateX(-Math.PI / 2);
const shockMat = new THREE.MeshBasicMaterial({
  color: 0x00ffd2,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const mortarShockwave = new THREE.Mesh(shockGeo, shockMat);
mortarShockwave.position.set(0, 0.36, 0.58);
jadeRabbitGroup.add(mortarShockwave);

// Quầng sáng flash lóe sáng đáy cối
const mortarGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: SHARED_PARTICLE_TEX,
  color: 0x00ffd2,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
}));
mortarGlow.scale.set(1.9, 1.9, 1);
mortarGlow.position.set(0, 0.45, 0.58);
jadeRabbitGroup.add(mortarGlow);

// Hạt linh đan phát sáng bay lên mỗi khi giã cối
const elixirPCount = 36;
const elixirPGeo = new THREE.BufferGeometry();
const elixirPPos = new Float32Array(elixirPCount * 3);
const elixirPVels = [];
for (let i = 0; i < elixirPCount; i++) {
  elixirPPos[i * 3] = 0;
  elixirPPos[i * 3 + 1] = 0.36;
  elixirPPos[i * 3 + 2] = 0.58;
  elixirPVels.push({
    x: (Math.random() - 0.5) * 0.035,
    y: 0.02 + Math.random() * 0.04,
    z: (Math.random() - 0.5) * 0.035,
    life: Math.random(),
  });
}
elixirPGeo.setAttribute("position", new THREE.BufferAttribute(elixirPPos, 3));
const elixirPMat = new THREE.PointsMaterial({
  size: 0.22,
  color: 0x00ffd2,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const elixirSparkles = new THREE.Points(elixirPGeo, elixirPMat);
jadeRabbitGroup.add(elixirSparkles);

// Hit Mesh tương tác cho Thỏ Ngọc
const jHitGeo = new THREE.SphereGeometry(1.2, 8, 8);
const jHitMat = new THREE.MeshBasicMaterial({ visible: false });
const jHitMesh = new THREE.Mesh(jHitGeo, jHitMat);
jHitMesh.position.set(0, 0.6, 0.4);
jHitMesh.userData.isJadeRabbit = true;
jadeRabbitGroup.add(jHitMesh);
interactiveObjects.push(jHitMesh);

// 3 Thỏ chạy nhảy quanh đảo
// Hàm tạo thỏ bạn đồng hành nhỏ
function createRabbit() {
  const group = new THREE.Group();

  // Thân tròn trĩnh
  const bodyGeo = new THREE.SphereGeometry(0.42, 10, 10);
  bodyGeo.scale(0.85, 1.0, 0.88);
  const bodyMesh = new THREE.Mesh(bodyGeo, sharedRabbitMat);
  bodyMesh.position.y = 0.38;
  group.add(bodyMesh);

  // Đầu nhỏ xinh
  const headGeo = new THREE.SphereGeometry(0.28, 10, 10);
  const headMesh = new THREE.Mesh(headGeo, sharedRabbitMat);
  headMesh.position.set(0, 0.82, 0.18);
  group.add(headMesh);

  // Tai trái
  const earGeo = new THREE.CylinderGeometry(0.035, 0.07, 0.46, 6);
  const earLeft = new THREE.Mesh(earGeo, sharedRabbitMat);
  earLeft.position.set(-0.1, 1.18, 0.14);
  earLeft.rotation.z = 0.14;
  earLeft.rotation.x = -0.1;
  group.add(earLeft);

  // Tai phải
  const earRight = earLeft.clone();
  earRight.position.x = 0.1;
  earRight.rotation.z = -0.14;
  group.add(earRight);

  // Đuôi nhỏ tròn
  const tailGeo = new THREE.SphereGeometry(0.1, 6, 6);
  const tailMesh = new THREE.Mesh(tailGeo, sharedRabbitMat);
  tailMesh.position.set(0, 0.42, -0.38);
  group.add(tailMesh);

  return { group, bodyMesh, headMesh };
}

function updateRabbits(time) {
  // Hoạt ảnh giã thuốc - nhịp sống động 1.25 lần/giây
  const t = time * 1.25;
  const strokeT = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0 (chạm đáy) → 1 (nâng cao)
  const pestleY = 0.42 + strokeT * 0.75;
  const bodyTilt = (strokeT - 0.5) * 0.32;

  jadePestle.position.y = pestleY;
  jBodyMesh.rotation.x = bodyTilt * 0.7;
  jHeadMesh.rotation.x = 0.25 + bodyTilt * 0.6;
  armLeft.rotation.x = Math.PI * 0.28 + (1 - strokeT) * 0.52;
  armRight.rotation.x = Math.PI * 0.28 + (1 - strokeT) * 0.52;

  // Hiệu ứng nện chày chạm đáy (Impact Flash & Shockwave)
  if (strokeT < 0.2) {
    const impactFactor = 1 - strokeT / 0.2; // 0 -> 1
    mortarGlow.material.opacity = impactFactor * 0.95;
    mortarGlow.material.color.setHex(strokeT < 0.07 ? 0xffffff : 0x00ffd2);

    mortarShockwave.material.opacity = impactFactor * 0.88;
    const waveScale = 1.0 + impactFactor * 2.4;
    mortarShockwave.scale.set(waveScale, waveScale, 1);

    // Tai thỏ ve vẩy thích thú theo nhịp nện cối
    jEarLeft.rotation.z = 0.16 + Math.sin(time * 24.0) * impactFactor * 0.25;
    jEarRight.rotation.z = -0.16 - Math.sin(time * 24.0) * impactFactor * 0.25;
  } else {
    mortarGlow.material.opacity *= 0.85;
    mortarShockwave.material.opacity *= 0.82;
    jEarLeft.rotation.z = 0.16;
    jEarRight.rotation.z = -0.16;
  }

  // Hạt bụi sao tiên bắn bung nở lên trời khi giã
  const elPos = elixirPGeo.attributes.position.array;
  for (let i = 0; i < elixirPCount; i++) {
    const v = elixirPVels[i];
    v.life += 0.018;
    elPos[i * 3] += v.x * 0.9;
    elPos[i * 3 + 1] += v.y * 1.1;
    elPos[i * 3 + 2] += v.z * 0.9;
    if (v.life > 1.0) {
      v.life = 0;
      elPos[i * 3] = (Math.random() - 0.5) * 0.18;
      elPos[i * 3 + 1] = 0.36;
      elPos[i * 3 + 2] = 0.58 + (Math.random() - 0.5) * 0.18;
    }
  }
  elixirPGeo.attributes.position.needsUpdate = true;
}

// ── 6B. CHỊ HẰNG NGA TIÊN TỬ (HÌNH TƯỢNG SONA - LIÊN MINH HUYỀN THOẠI) ──
const changEGroup = new THREE.Group();
changEGroup.position.set(-2.4, 4.65, 2.2); // Lơ lửng bồng bềnh thanh thoát
changEGroup.rotation.y = 0.45;
changEGroup.scale.setScalar(0.92); // Dáng vóc thanh mảnh, thon thả đúng chuẩn tiên tử
islandGroup.add(changEGroup);

// Chất liệu trang phục Sona Tiên Nga (Xanh ngọc bích celestial + dạ hội lam ngọc dát vàng)
const sonaDressMat = new THREE.MeshStandardMaterial({
  color: 0x0b2545,
  roughness: 0.35,
  emissive: 0x041528,
  emissiveIntensity: 0.3,
});
const sonaTurquoiseMat = new THREE.MeshStandardMaterial({
  color: 0x00b4d8,
  roughness: 0.3,
  emissive: 0x0077b6,
  emissiveIntensity: 0.4,
});
const sonaGoldMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.85,
  roughness: 0.2,
  emissive: 0xffb703,
  emissiveIntensity: 0.45,
});
const sonaWhiteSilk = new THREE.MeshStandardMaterial({
  color: 0xf8f9fa,
  roughness: 0.4,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95,
});
const sonaSkinMat = new THREE.MeshStandardMaterial({
  color: 0xffeade,
  roughness: 0.55,
});

// Váy dài thướt tha xòe lượn hình chuông (Sona's flowing gown)
const sonaSkirtGeo = new THREE.CylinderGeometry(0.18, 0.75, 1.45, 18, 4, true);
const sonaSkirt = new THREE.Mesh(sonaSkirtGeo, sonaDressMat);
sonaSkirt.position.y = 0.65;
changEGroup.add(sonaSkirt);

// Lớp viền ngọc bích xòe lượn bên dưới
const sonaSkirtHem = new THREE.Mesh(
  new THREE.CylinderGeometry(0.68, 0.82, 0.3, 18, 1, true),
  sonaTurquoiseMat
);
sonaSkirtHem.position.y = 0.12;
changEGroup.add(sonaSkirtHem);

// Thắt lưng hoàng kim ôm eo ngọc
const sonaBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 16), sonaGoldMat);
sonaBelt.position.y = 1.38;
changEGroup.add(sonaBelt);

// Thân áo corset thanh tú
const sonaCorset = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.52, 14), sonaTurquoiseMat);
sonaCorset.position.y = 1.64;
changEGroup.add(sonaCorset);

// Cổ áo viền vàng hoàng gia
const sonaCollar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 16), sonaGoldMat);
sonaCollar.position.set(0, 1.88, 0);
sonaCollar.rotation.x = Math.PI / 2;
changEGroup.add(sonaCollar);

// Gương mặt tiên tử thanh khiết
const sonaHead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), sonaSkinMat);
sonaHead.scale.set(0.88, 1.0, 0.92);
sonaHead.position.set(0, 2.08, 0.02);
changEGroup.add(sonaHead);

// Vương miện vàng kim thanh tú
const crownGeo = new THREE.ConeGeometry(0.18, 0.22, 5);
const sonaCrown = new THREE.Mesh(crownGeo, sonaGoldMat);
sonaCrown.position.set(0, 2.34, 0.02);
changEGroup.add(sonaCrown);

// Mái tóc xanh ngọc bích huyền thoại của Sona (Vibrant Cyan-Turquoise Hair)
const hairColor = 0x00cec9;
const sonaHairMat = new THREE.MeshStandardMaterial({
  color: hairColor,
  roughness: 0.3,
  emissive: 0x00838f,
  emissiveIntensity: 0.45,
});

// Tóc trên đầu & mái tóc bồng bềnh
const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), sonaHairMat);
hairTop.scale.set(0.96, 0.85, 1.05);
hairTop.position.set(0, 2.14, -0.04);
changEGroup.add(hairTop);

// HAI DẢI TÓC ĐÔI DÀI THƯỚT THA ĐẶC TRƯNG CỦA SONA (Iconic Twintails)
const leftTailGroup = new THREE.Group();
leftTailGroup.position.set(-0.24, 2.12, -0.08);
changEGroup.add(leftTailGroup);

const rightTailGroup = new THREE.Group();
rightTailGroup.position.set(0.24, 2.12, -0.08);
changEGroup.add(rightTailGroup);

// Dựng tóc uốn lượn mềm mại bằng TubeGeometry
const leftTailCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(-0.25, -0.4, -0.1),
  new THREE.Vector3(-0.38, -0.9, 0.0),
  new THREE.Vector3(-0.22, -1.45, -0.12),
  new THREE.Vector3(-0.35, -1.9, -0.05),
]);
const leftTailMesh = new THREE.Mesh(new THREE.TubeGeometry(leftTailCurve, 20, 0.065, 8, false), sonaHairMat);
leftTailGroup.add(leftTailMesh);

const rightTailCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0.25, -0.4, -0.1),
  new THREE.Vector3(0.38, -0.9, 0.0),
  new THREE.Vector3(0.22, -1.45, -0.12),
  new THREE.Vector3(0.35, -1.9, -0.05),
]);
const rightTailMesh = new THREE.Mesh(new THREE.TubeGeometry(rightTailCurve, 20, 0.065, 8, false), sonaHairMat);
rightTailGroup.add(rightTailMesh);

// ── CÂY ĐÀN THIÊN TIÊN ETWAHL CỦA SONA (Floating Celestial Instrument) ──
const etwahlGroup = new THREE.Group();
etwahlGroup.position.set(0, 1.25, 0.52); // Lơ lửng ngay trước lòng Sona
changEGroup.add(etwahlGroup);

// Thân đàn cánh cung huyền ảo dát vàng
const etwahlBodyMat = new THREE.MeshStandardMaterial({
  color: 0x03071e,
  roughness: 0.25,
  metalness: 0.4,
});
const etwahlWingMat = sonaGoldMat;

// Thân đàn trung tâm
const eCenter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.26), etwahlBodyMat);
etwahlGroup.add(eCenter);

// Hai cánh cánh cung cong vút hình trăng khuyết đặc trưng Sona
const wingGeo = new THREE.CylinderGeometry(0.04, 0.12, 0.75, 8);
const leftWing = new THREE.Mesh(wingGeo, etwahlWingMat);
leftWing.position.set(-0.52, 0.08, 0.06);
leftWing.rotation.z = 1.15;
leftWing.rotation.y = 0.25;
etwahlGroup.add(leftWing);

const rightWing = new THREE.Mesh(wingGeo, etwahlWingMat);
rightWing.position.set(0.52, 0.08, 0.06);
rightWing.rotation.z = -1.15;
rightWing.rotation.y = -0.25;
etwahlGroup.add(rightWing);

// Ngọc bích phát sáng ở tâm đàn
const eGemMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
const eGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), eGemMat);
eGem.position.set(0, 0.06, 0.1);
etwahlGroup.add(eGem);

// Dây đàn thiên thần phát sáng dạ quang (4 Strings)
const stringMat = new THREE.LineBasicMaterial({
  color: 0xffe74c,
  transparent: true,
  opacity: 0.9,
});
for (let s = -0.06; s <= 0.06; s += 0.04) {
  const strGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.48, 0.05, s),
    new THREE.Vector3(0.48, 0.05, s)
  ]);
  etwahlGroup.add(new THREE.Line(strGeo, stringMat));
}

// ── TAY ÁO DÀI XÒE HOA RỦ & ĐÔI TAY GẢY ĐÀN ────────────────────────
const sonaArmMat = sonaSkinMat;
const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 6), sonaArmMat);
armL.position.set(-0.25, 1.48, 0.22);
armL.rotation.set(0.65, 0.2, -0.4);
changEGroup.add(armL);

const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 6), sonaArmMat);
armR.position.set(0.25, 1.48, 0.22);
armR.rotation.set(0.65, -0.2, 0.4);
changEGroup.add(armR);

// Tay áo lụa xòe rủ mềm mại (Bell Sleeves)
const sleeveL = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 10, 1, true), sonaWhiteSilk);
sleeveL.position.set(-0.35, 1.25, 0.12);
sleeveL.rotation.set(0.3, 0.1, -0.5);
changEGroup.add(sleeveL);

const sleeveR = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 10, 1, true), sonaWhiteSilk);
sleeveR.position.set(0.35, 1.25, 0.12);
sleeveR.rotation.set(0.3, -0.1, 0.5);
changEGroup.add(sleeveR);

// Dải lụa tiên ngũ sắc phát sáng uốn lượn sau lưng
const ribbonMat = new THREE.MeshStandardMaterial({
  color: 0xff3385,
  emissive: 0xff66a3,
  emissiveIntensity: 2.8, // Phát sáng rực rỡ tiên giới
  roughness: 0.25,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.92,
});
const ribbonCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1.25, 0.6, -0.28),
  new THREE.Vector3(-0.75, 1.85, 0.2),
  new THREE.Vector3(0.0, 2.65, -0.2),
  new THREE.Vector3(0.75, 1.85, 0.2),
  new THREE.Vector3(1.25, 0.6, -0.28),
]);
const celestialRibbon = new THREE.Mesh(new THREE.TubeGeometry(ribbonCurve, 32, 0.08, 8, false), ribbonMat);
changEGroup.add(celestialRibbon);

// Ánh sáng tiên tử tỏa bóng ngọc ngà quanh Chị Hằng
const changELight = new THREE.PointLight(0x00f5d4, 1.25, 9.5);
changELight.position.set(0, 1.8, 0.6);
changEGroup.add(changELight);

// Hào quang vầng trăng dạ quang sau đầu Sona
const auraMat = new THREE.SpriteMaterial({
  map: SHARED_PARTICLE_TEX,
  color: 0x72efdd,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const changEAura = new THREE.Sprite(auraMat);
changEAura.scale.set(3.2, 3.2, 1);
changEAura.position.set(0, 2.15, -0.12);
changEGroup.add(changEAura);

// Nốt nhạc ma thuật phát quang bay từ cây đàn Etwahl
function createNoteTexture(symbol) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#00ffd2";
  ctx.shadowBlur = 16;
  ctx.fillText(symbol, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
const NOTE_SYMBOLS = ["♪", "♫", "♬", "✦", "✧", "♪"];
const melodyNotes = [];
const noteColors = [0x00f5d4, 0xffd166, 0x06d6a0, 0xff70a6, 0x70d6ff, 0xffd166];

for (let n = 0; n < NOTE_SYMBOLS.length; n++) {
  const noteTex = createNoteTexture(NOTE_SYMBOLS[n]);
  const noteMat = new THREE.SpriteMaterial({
    map: noteTex,
    color: noteColors[n],
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const noteSprite = new THREE.Sprite(noteMat);
  noteSprite.scale.set(0.65, 0.65, 1);
  changEGroup.add(noteSprite);
  melodyNotes.push({
    sprite: noteSprite,
    phase: (n / NOTE_SYMBOLS.length) * Math.PI * 2,
    speed: 0.85 + n * 0.15,
  });
}

// Vòng sóng âm ma thuật (Music Waves / Crescendo Rings) lan tỏa từ cây đàn Etwahl
const musicWaveRings = [];
for (let w = 0; w < 3; w++) {
  const ringGeo = new THREE.RingGeometry(0.2, 0.28, 24);
  ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: w % 2 === 0 ? 0x00f5d4 : 0xffd166,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const waveMesh = new THREE.Mesh(ringGeo, ringMat);
  waveMesh.position.set(0, 1.25, 0.52);
  changEGroup.add(waveMesh);
  musicWaveRings.push({ mesh: waveMesh, phase: (w / 3) * Math.PI * 2 });
}

// Hit Mesh tương tác khi click Chị Hằng Nga (Sona)
const cHitGeo = new THREE.SphereGeometry(1.4, 8, 8);
const cHitMat = new THREE.MeshBasicMaterial({ visible: false });
const cHitMesh = new THREE.Mesh(cHitGeo, cHitMat);
cHitMesh.position.set(0, 1.3, 0);
cHitMesh.userData.isChange = true;
changEGroup.add(cHitMesh);
interactiveObjects.push(cHitMesh);

function updateChangE(time) {
  // 1. Thân người lơ lửng bồng bềnh và nghiêng nhẹ đắm chìm trong giai điệu thiên đình
  changEGroup.position.y = 4.65 + Math.sin(time * 0.8) * 0.25;
  changEGroup.rotation.y = 0.45 + Math.sin(time * 0.45) * 0.09;
  changEGroup.rotation.z = Math.sin(time * 0.9) * 0.045;

  // 2. Cây đàn Etwahl dập dềnh và rung cảm ứng theo từng phím nhạc
  etwahlGroup.position.y = 1.25 + Math.sin(time * 2.2) * 0.04;
  etwahlGroup.rotation.x = Math.sin(time * 1.5) * 0.035;
  eGem.scale.setScalar(1.0 + Math.sin(time * 7.0) * 0.35); // Ngọc bích tâm đàn nhấp nháy phát quang

  // 3. Đôi tay gảy đàn Etwahl sống động (Sona Playing Animation)
  // Tay trái lướt phím vuốt dây đàn
  armL.position.x = -0.25 + Math.sin(time * 4.2) * 0.08;
  armL.position.y = 1.48 + Math.cos(time * 4.2) * 0.04;
  armL.rotation.set(0.65 + Math.sin(time * 4.2) * 0.15, 0.2, -0.4 + Math.cos(time * 4.2) * 0.2);
  sleeveL.rotation.z = -0.5 + Math.sin(time * 4.2) * 0.18;

  // Tay phải gảy dây đàn thoăn thoắt theo giai điệu
  armR.position.x = 0.25 + Math.cos(time * 5.2) * 0.07;
  armR.position.y = 1.48 + Math.sin(time * 5.2) * 0.05;
  armR.rotation.set(0.65 + Math.cos(time * 5.2) * 0.18, -0.2, 0.4 + Math.sin(time * 5.2) * 0.2);
  sleeveR.rotation.z = 0.5 - Math.cos(time * 5.2) * 0.18;

  // 4. Vòng sóng âm ma thuật lan tỏa từ cây đàn Etwahl
  for (let w = 0; w < musicWaveRings.length; w++) {
    const ring = musicWaveRings[w];
    const cycle = (time * 1.8 + ring.phase) % (Math.PI * 2);
    const progress = cycle / (Math.PI * 2);
    const scale = 0.6 + progress * 5.2;
    ring.mesh.scale.set(scale, scale, 1);
    ring.mesh.material.opacity = Math.sin(progress * Math.PI) * 0.72;
  }

  // 5. Tóc hai bên (Twintails) xanh ngọc đong đưa lượn sóng mềm mại
  leftTailGroup.rotation.z = Math.sin(time * 1.4) * 0.15;
  leftTailGroup.rotation.x = Math.cos(time * 1.1) * 0.09;
  rightTailGroup.rotation.z = -Math.sin(time * 1.4) * 0.15;
  rightTailGroup.rotation.x = Math.cos(time * 1.1) * 0.09;

  // 6. Dải lụa tiên uốn lượn sau lưng
  celestialRibbon.rotation.z = Math.sin(time * 0.8) * 0.15;
  celestialRibbon.rotation.y = Math.sin(time * 0.6) * 0.12;

  // 7. Hào quang nhịp thở bừng sáng
  changEAura.material.opacity = 0.7 + Math.sin(time * 1.8) * 0.22;

  // 8. Các nốt nhạc ma thuật bay xoắn ốc từ mặt đàn lên bầu trời
  for (let n = 0; n < melodyNotes.length; n++) {
    const mn = melodyNotes[n];
    const t = (time * mn.speed + mn.phase) % 4.0; // Vòng lặp 4 giây
    const progress = t / 4.0; // 0 -> 1

    const spiralRadius = 0.4 + progress * 1.2;
    const spiralAngle = t * 2.8;

    mn.sprite.position.set(
      Math.cos(spiralAngle) * spiralRadius,
      1.3 + progress * 2.2, // Bay từ mặt đàn lên cao 3.5
      0.52 + Math.sin(spiralAngle) * (spiralRadius * 0.5)
    );

    // Mờ dần khi lên cao
    mn.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.95;
    const s = 0.55 + Math.sin(progress * Math.PI) * 0.25;
  }
}


// ── 6C. MÂM CỖ BÁNH TRUNG THU & TRÀ THƯỞNG NGUYỆT ──────────────
const mooncakeTableGroup = new THREE.Group();
mooncakeTableGroup.position.set(-0.25, 4.02, 3.1);
islandGroup.add(mooncakeTableGroup);

// Bàn gỗ sơn mài chân quỳ
const tableMat = new THREE.MeshStandardMaterial({
  color: 0x3d1c14,
  roughness: 0.6,
  metalness: 0.1,
});
const tableGeo = new THREE.CylinderGeometry(0.95, 0.88, 0.16, 16);
const tableMesh = new THREE.Mesh(tableGeo, tableMat);
tableMesh.position.y = 0.08;
mooncakeTableGroup.add(tableMesh);

// Hộp bánh sơn mài đỏ thắm nắp hé mở
const boxMat = new THREE.MeshStandardMaterial({
  color: 0xa00020,
  roughness: 0.35,
  metalness: 0.15,
});
const goldBorderMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.7,
});

const boxGeo = new THREE.BoxGeometry(0.68, 0.18, 0.68);
const boxMesh = new THREE.Mesh(boxGeo, boxMat);
boxMesh.position.set(-0.2, 0.25, 0);
mooncakeTableGroup.add(boxMesh);

// Viền vàng nắp hộp
const boxBorderGeo = new THREE.BoxGeometry(0.7, 0.04, 0.7);
const boxBorder = new THREE.Mesh(boxBorderGeo, goldBorderMat);
boxBorder.position.set(-0.2, 0.35, 0);
mooncakeTableGroup.add(boxBorder);

// Nắp hộp hé mở nghiêng
const lidMesh = new THREE.Mesh(boxBorderGeo, boxMat);
lidMesh.position.set(-0.28, 0.42, -0.15);
lidMesh.rotation.x = -0.32;
mooncakeTableGroup.add(lidMesh);

// Bánh Trung Thu Nướng vàng óng hoa văn
const bakedMooncakeMat = new THREE.MeshStandardMaterial({
  color: 0xc87d28,
  roughness: 0.55,
  metalness: 0.05,
});
const snowskinMooncakeMat = new THREE.MeshStandardMaterial({
  color: 0xfaf5ef,
  roughness: 0.5,
});

function createMooncake(material, x, y, z) {
  const g = new THREE.Group();
  const cGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.07, 16);
  const m = new THREE.Mesh(cGeo, material);
  g.add(m);

  // Hoa văn mặt bánh dập nổi
  const ringGeo = new THREE.TorusGeometry(0.08, 0.015, 6, 16);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, material);
  ring.position.y = 0.038;
  g.add(ring);

  g.position.set(x, y, z);
  return g;
}

// 2 Bánh nướng + 2 Bánh dẻo
mooncakeTableGroup.add(createMooncake(bakedMooncakeMat, -0.32, 0.38, -0.12));
mooncakeTableGroup.add(createMooncake(bakedMooncakeMat, -0.08, 0.38, 0.12));
mooncakeTableGroup.add(createMooncake(snowskinMooncakeMat, -0.32, 0.38, 0.12));
mooncakeTableGroup.add(createMooncake(snowskinMooncakeMat, -0.08, 0.38, -0.12));

// Bộ ấm chén trà men ngọc bích
const teapotMat = new THREE.MeshStandardMaterial({
  color: 0xb7e4c7,
  roughness: 0.25,
  metalness: 0.1,
});
const potGeo = new THREE.SphereGeometry(0.14, 12, 12);
potGeo.scale(1, 0.85, 1);
const potMesh = new THREE.Mesh(potGeo, teapotMat);
potMesh.position.set(0.42, 0.26, -0.08);
mooncakeTableGroup.add(potMesh);

// Vòi ấm
const spoutGeo = new THREE.CylinderGeometry(0.02, 0.035, 0.12, 8);
spoutGeo.rotateZ(Math.PI * 0.35);
const spoutMesh = new THREE.Mesh(spoutGeo, teapotMat);
spoutMesh.position.set(0.53, 0.3, -0.08);
mooncakeTableGroup.add(spoutMesh);

// 2 Chén trà
const cupGeo = new THREE.CylinderGeometry(0.065, 0.045, 0.06, 10);
const cup1 = new THREE.Mesh(cupGeo, teapotMat);
cup1.position.set(0.32, 0.19, 0.18);
mooncakeTableGroup.add(cup1);

const cup2 = new THREE.Mesh(cupGeo, teapotMat);
cup2.position.set(0.52, 0.19, 0.15);
mooncakeTableGroup.add(cup2);

// Khói trà thơm ấm áp bốc lên
const steamPCount = 14;
const steamGeo = new THREE.BufferGeometry();
const steamPos = new Float32Array(steamPCount * 3);
const steamVels = [];
for (let i = 0; i < steamPCount; i++) {
  steamPos[i * 3] = 0.42;
  steamPos[i * 3 + 1] = 0.35;
  steamPos[i * 3 + 2] = -0.08;
  steamVels.push({
    y: 0.008 + Math.random() * 0.012,
    drift: (Math.random() - 0.5) * 0.005,
    life: Math.random(),
  });
}
steamGeo.setAttribute("position", new THREE.BufferAttribute(steamPos, 3));
const steamMat = new THREE.PointsMaterial({
  size: 0.2,
  color: 0xffffff,
  transparent: true,
  opacity: 0.45,
  map: SHARED_PARTICLE_TEX,
  depthWrite: false,
});
const teaSteam = new THREE.Points(steamGeo, steamMat);
mooncakeTableGroup.add(teaSteam);

function updateMooncakeTea(time) {
  const sPos = steamGeo.attributes.position.array;
  for (let i = 0; i < steamPCount; i++) {
    const sv = steamVels[i];
    sv.life += 0.02;
    sPos[i * 3] += sv.drift + Math.sin(time * 2 + i) * 0.002;
    sPos[i * 3 + 1] += sv.y;

    if (sv.life > 1.0) {
      sv.life = 0;
      sPos[i * 3] = 0.42;
      sPos[i * 3 + 1] = 0.35;
      sPos[i * 3 + 2] = -0.08;
    }
  }
  steamGeo.attributes.position.needsUpdate = true;
}

// ── 2 CHÚ THỎ THỢ LÀM BÁNH TRUNG THU CẠNH BÀN TRÀ ──
// 1. Thỏ Thợ Nhào Bột Dẻo (Kneader Rabbit)
const kneaderRabbitGroup = new THREE.Group();
kneaderRabbitGroup.position.set(-0.85, 0.05, 0.22);
kneaderRabbitGroup.rotation.y = 0.85;
kneaderRabbitGroup.scale.setScalar(0.72);
mooncakeTableGroup.add(kneaderRabbitGroup);

const knBody = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), sharedRabbitMat);
knBody.scale.set(0.85, 1.0, 0.88);
knBody.position.y = 0.35;
kneaderRabbitGroup.add(knBody);

const knHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), sharedRabbitMat);
knHead.position.set(0, 0.75, 0.16);
kneaderRabbitGroup.add(knHead);

const knEarL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.42, 6), sharedRabbitMat);
knEarL.position.set(-0.09, 1.08, 0.12);
knEarL.rotation.z = 0.15;
kneaderRabbitGroup.add(knEarL);
const knEarR = knEarL.clone();
knEarR.position.x = 0.09;
knEarR.rotation.z = -0.15;
kneaderRabbitGroup.add(knEarR);

const knArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.35, 6), sharedRabbitMat);
knArmL.position.set(-0.16, 0.48, 0.28);
knArmL.rotation.x = Math.PI * 0.35;
kneaderRabbitGroup.add(knArmL);
const knArmR = knArmL.clone();
knArmR.position.x = 0.16;
kneaderRabbitGroup.add(knArmR);

// Khối bột dẻo tròn trên bàn
const doughMat = new THREE.MeshStandardMaterial({ color: 0xfff3b0, roughness: 0.8 });
const doughMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), doughMat);
doughMesh.scale.set(1.2, 0.6, 1.2);
doughMesh.position.set(0, 0.18, 0.42);
kneaderRabbitGroup.add(doughMesh);

// 2. Thỏ Thợ Đóng Khuôn Bánh Nướng (Stamper Rabbit)
const stamperRabbitGroup = new THREE.Group();
stamperRabbitGroup.position.set(0.88, 0.05, -0.18);
stamperRabbitGroup.rotation.y = -1.35;
stamperRabbitGroup.scale.setScalar(0.72);
mooncakeTableGroup.add(stamperRabbitGroup);

const stBody = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), sharedRabbitMat);
stBody.scale.set(0.85, 1.0, 0.88);
stBody.position.y = 0.35;
stamperRabbitGroup.add(stBody);

const stHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), sharedRabbitMat);
stHead.position.set(0, 0.75, 0.16);
stamperRabbitGroup.add(stHead);

const stEarL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.42, 6), sharedRabbitMat);
stEarL.position.set(-0.09, 1.08, 0.12);
stEarL.rotation.z = 0.15;
stamperRabbitGroup.add(stEarL);
const stEarR = stEarL.clone();
stEarR.position.x = 0.09;
stEarR.rotation.z = -0.15;
stamperRabbitGroup.add(stEarR);

const stArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.35, 6), sharedRabbitMat);
stArmL.position.set(-0.14, 0.48, 0.28);
stArmL.rotation.x = Math.PI * 0.32;
stamperRabbitGroup.add(stArmL);

const stArmR = stArmL.clone();
stArmR.position.x = 0.14;
stamperRabbitGroup.add(stArmR);

// Khuôn bánh gỗ truyền thống
const moldGroup = new THREE.Group();
moldGroup.position.set(0, 0.32, 0.4);
stamperRabbitGroup.add(moldGroup);

const moldBlock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.2), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 }));
moldGroup.add(moldBlock);
const moldHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0x5a3e15 }));
moldHandle.rotation.x = Math.PI / 2;
moldHandle.position.z = -0.18;
moldGroup.add(moldHandle);

// Chiếc bánh nướng mới đóng xong bên dưới
const freshCake = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), bakedMooncakeMat);
freshCake.position.set(0, 0.15, 0.4);
stamperRabbitGroup.add(freshCake);

function updateBakeryRabbits(time) {
  // 1. Thỏ nhào bột dẻo - ấn bột xoay tròn nhịp nhàng
  const kneadCycle = Math.sin(time * 5.0);
  knHead.rotation.x = kneadCycle * 0.12;
  knArmL.rotation.x = Math.PI * 0.32 + kneadCycle * 0.22;
  knArmR.rotation.x = Math.PI * 0.32 - kneadCycle * 0.22;
  doughMesh.scale.set(1.2 + kneadCycle * 0.12, 0.6 - kneadCycle * 0.08, 1.2 + kneadCycle * 0.12);

  // 2. Thỏ đóng khuôn bánh - nhấc khuôn lên rồi gõ "cạch" xuống bàn
  const stampT = (Math.sin(time * 2.4) + 1) / 2; // 0 (chạm bánh) -> 1 (nhấc cao)
  moldGroup.position.y = 0.22 + stampT * 0.35;
  moldGroup.rotation.x = stampT * 0.2;
  stArmR.rotation.x = Math.PI * 0.3 + stampT * 0.4;
  stArmL.rotation.x = Math.PI * 0.3 + stampT * 0.4;

  if (stampT < 0.12) {
    // Vừa gõ khuôn xuống: tai thỏ ve vẩy thích thú
    stEarL.rotation.z = 0.15 + Math.sin(time * 20.0) * 0.2;
    stEarR.rotation.z = -0.15 - Math.sin(time * 20.0) * 0.2;
  } else {
    stEarL.rotation.z = 0.15;
    stEarR.rotation.z = -0.15;
  }
}

// Hit Mesh tương tác khi click Mâm Bánh Trung Thu
const tHitGeo = new THREE.SphereGeometry(1.4, 8, 8);
const tHitMat = new THREE.MeshBasicMaterial({ visible: false });
const tHitMesh = new THREE.Mesh(tHitGeo, tHitMat);
tHitMesh.position.set(0, 0.4, 0);
tHitMesh.userData.isMooncake = true;
mooncakeTableGroup.add(tHitMesh);
interactiveObjects.push(tHitMesh);


// ── 6D. CHÚ CUỘI NGỒI Ở BỜ ĐẢO CÂU ĐỐM SÁNG & HỆ THỐNG LỜI CHÚC ──
const cuoiGroup = new THREE.Group();
// Chú Cuội ngồi sát mép cỏ đất liền của đảo, hướng ra mặt hồ
cuoiGroup.position.set(6.4, 3.92, 3.6);
cuoiGroup.rotation.y = 0.85;
cuoiGroup.scale.setScalar(1.38); // Vóc dáng Chú Cuội đĩnh đạc, rõ nét, cân xứng với Chị Hằng và cảnh quan đảo
islandGroup.add(cuoiGroup);

// Tảng đá rêu phong phẳng dẹt đặt nằm vững chãi trên mặt đất mép đảo
const cuoiSeatRock = new THREE.Mesh(
  new THREE.CylinderGeometry(0.48, 0.62, 0.18, 8),
  new THREE.MeshStandardMaterial({
    color: 0x3d4138,
    roughness: 0.9,
    flatShading: true,
  })
);
cuoiSeatRock.position.set(0, 0.04, -0.08);
cuoiSeatRock.scale.set(1.2, 1.0, 0.9);
cuoiGroup.add(cuoiSeatRock);

// Chất liệu
const cuoiSkinMat  = new THREE.MeshStandardMaterial({ color: 0xd99b72, roughness: 0.65 });
const cuoiClothMat = new THREE.MeshStandardMaterial({ color: 0x224832, roughness: 0.6, emissive: 0x0a1e12, emissiveIntensity: 0.2 });
const cuoiHatMat   = new THREE.MeshStandardMaterial({ color: 0x5a3e15, roughness: 0.75, flatShading: true });
const cuoiPantMat  = new THREE.MeshStandardMaterial({ color: 0x162c1e, roughness: 0.7 });

// Thân
const cBodyGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.75, 8);
const cBodyMesh = new THREE.Mesh(cBodyGeo, cuoiClothMat);
cBodyMesh.position.y = 0.42;
cuoiGroup.add(cBodyMesh);

// Đầu
const cHeadMesh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 10), cuoiSkinMat);
cHeadMesh.position.set(0, 0.96, 0.05);
cuoiGroup.add(cHeadMesh);

// Nón lá mộc mạc
const cuoiHat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.34, 10), cuoiHatMat);
cuoiHat.position.set(0, 1.20, 0);
cuoiGroup.add(cuoiHat);
const hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.038, 4, 10), cuoiHatMat);
hatBrim.position.set(0, 1.04, 0);
hatBrim.rotation.x = Math.PI / 2;
cuoiGroup.add(hatBrim);

// Tay phải (cầm chắc vào cán cần câu trúc)
const cArmRight = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.52, 6), cuoiSkinMat);
cArmRight.position.set(0.26, 0.58, 0.12);
cArmRight.rotation.set(0.4, 0.15, -0.48);
cuoiGroup.add(cArmRight);

// Tay trái
const cArmLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.52, 6), cuoiSkinMat);
cArmLeft.position.set(-0.28, 0.56, 0.06);
cArmLeft.rotation.z = 0.45;
cArmLeft.rotation.x = 0.25;
cuoiGroup.add(cArmLeft);

// Hai chân buông thõng: đùi vươn qua mép bệ đá (z=0.35 > mép đá z=0.14), cẳng chân buông thẳng xuống không gian tự do, hoàn toàn KHÔNG xuyên đá
const cThighLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.36, 6), cuoiPantMat);
cThighLeft.position.set(-0.16, 0.18, 0.18);
cThighLeft.rotation.x = Math.PI / 2;
cuoiGroup.add(cThighLeft);

const cLegLeft = new THREE.Group();
cLegLeft.position.set(-0.16, 0.18, 0.35);
const cCalfLeftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.38, 6), cuoiPantMat);
cCalfLeftMesh.position.set(0, -0.19, 0);
cLegLeft.add(cCalfLeftMesh);
const cFootLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.15), cuoiSkinMat);
cFootLeft.position.set(0, -0.38, 0.04);
cLegLeft.add(cFootLeft);
cuoiGroup.add(cLegLeft);

const cThighRight = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.36, 6), cuoiPantMat);
cThighRight.position.set(0.16, 0.18, 0.18);
cThighRight.rotation.x = Math.PI / 2;
cuoiGroup.add(cThighRight);

const cLegRight = new THREE.Group();
cLegRight.position.set(0.16, 0.18, 0.35);
const cCalfRightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.38, 6), cuoiPantMat);
cCalfRightMesh.position.set(0, -0.19, 0);
cLegRight.add(cCalfRightMesh);
const cFootRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.15), cuoiSkinMat);
cFootRight.position.set(0, -0.38, 0.04);
cLegRight.add(cFootRight);
cuoiGroup.add(cLegRight);

// Cần câu trúc uốn cong mềm mại vươn ra hồ nước
const cuoiRodGroup = new THREE.Group();
cuoiGroup.add(cuoiRodGroup);

// Đường cong cần câu tre trúc uốn parabol duyên dáng
const rodCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.32, 0.44, 0.22),
  new THREE.Vector3(0.38, 0.95, 1.4),
  new THREE.Vector3(0.44, 1.12, 2.6),
  new THREE.Vector3(0.48, 0.88, 3.8)
]);
const rodGeo = new THREE.TubeGeometry(rodCurve, 24, 0.016, 6, false);
const rodMat = new THREE.MeshStandardMaterial({
  color: 0x8b5a2b,
  roughness: 0.45,
  metalness: 0.1
});
const fishingRod = new THREE.Mesh(rodGeo, rodMat);
cuoiRodGroup.add(fishingRod);

// Dây câu buông thẳng đứng từ ngọn cần (0.48, 0.88, 3.8) xuống mặt hồ (-6.32)
const lineMat = new THREE.LineBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.8 });
const lineGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0.48, 0.88, 3.8),
  new THREE.Vector3(0.48, -6.32, 3.8)
]);
const fishingLine = new THREE.Line(lineGeo, lineMat);
cuoiRodGroup.add(fishingLine);

// Phao câu cá đỏ trắng dập dềnh trên mặt hồ
const bobberGroup = new THREE.Group();
bobberGroup.position.set(0.48, -6.30, 3.8);
const bTop = new THREE.Mesh(
  new THREE.SphereGeometry(0.065, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xee2222, roughness: 0.3 })
);
const bBot = new THREE.Mesh(
  new THREE.SphereGeometry(0.065, 8, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
);
const bStick = new THREE.Mesh(
  new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
bobberGroup.add(bTop);
bobberGroup.add(bBot);
bobberGroup.add(bStick);
cuoiGroup.add(bobberGroup);

// Gợn sóng lăn tăn nơi phao câu chạm mặt hồ
const rippleGeo = new THREE.RingGeometry(0.06, 0.42, 16);
rippleGeo.rotateX(-Math.PI / 2);
const rippleMat = new THREE.MeshBasicMaterial({ color: 0x88e0ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
const waterRipple = new THREE.Mesh(rippleGeo, rippleMat);
waterRipple.position.set(0.48, -6.31, 3.8);
cuoiGroup.add(waterRipple);

// Đốm sáng (wish orb) từ đáy hồ câu lên
const wishOrbMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa, transparent: true, opacity: 0 });
const wishOrb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), wishOrbMat);
wishOrb.position.set(0.48, -6.32, 3.8);
cuoiRodGroup.add(wishOrb);

const wishOrbGlowMat = new THREE.SpriteMaterial({
  map: SHARED_PARTICLE_TEX,
  color: 0xffd23f,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const wishOrbGlow = new THREE.Sprite(wishOrbGlowMat);
wishOrbGlow.scale.set(1.6, 1.6, 1);
wishOrb.add(wishOrbGlow);

// ── CHÚ CÁ CHÉP VÀNG THẦN THOẠI (GOLDEN KOI FISH JUMP) ──
const koiFishGroup = new THREE.Group();
koiFishGroup.visible = false;
cuoiGroup.add(koiFishGroup);

const koiGoldMat = new THREE.MeshStandardMaterial({
  color: 0xff6600,
  emissive: 0xff8800,
  emissiveIntensity: 1.4,
  metalness: 0.8,
  roughness: 0.2,
});
const koiWhiteMat = new THREE.MeshStandardMaterial({
  color: 0xffeedd,
  roughness: 0.35,
});
const koiFinMat = new THREE.MeshBasicMaterial({
  color: 0xffaa22,
  transparent: true,
  opacity: 0.88,
  side: THREE.DoubleSide,
});

// Thân cá chép uốn cong hình thoi mềm mại
const koiBodyGeo = new THREE.CylinderGeometry(0.08, 0.22, 0.9, 10, 3);
koiBodyGeo.rotateZ(Math.PI / 2);
koiBodyGeo.scale(1.0, 0.75, 1.15);
const koiBody = new THREE.Mesh(koiBodyGeo, koiGoldMat);
koiFishGroup.add(koiBody);

// Bụng cá trắng sáng
const koiBellyGeo = new THREE.CylinderGeometry(0.06, 0.18, 0.8, 8);
koiBellyGeo.rotateZ(Math.PI / 2);
koiBellyGeo.scale(0.9, 0.4, 0.9);
const koiBelly = new THREE.Mesh(koiBellyGeo, koiWhiteMat);
koiBelly.position.y = -0.06;
koiFishGroup.add(koiBelly);

// Đầu cá chép
const koiHeadGeo = new THREE.SphereGeometry(0.2, 10, 10);
koiHeadGeo.scale(1.25, 0.85, 1.0);
const koiHead = new THREE.Mesh(koiHeadGeo, koiGoldMat);
koiHead.position.x = 0.42;
koiFishGroup.add(koiHead);

// Mắt cá chép ngọc đen lấp lánh
const koiEyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), koiEyeMat);
eyeL.position.set(0.48, 0.08, 0.14);
const eyeR = eyeL.clone();
eyeR.position.z = -0.14;
koiFishGroup.add(eyeL);
koiFishGroup.add(eyeR);

// Đuôi cá chép uốn lượn hình quạt mềm mại
const koiTailGroup = new THREE.Group();
koiTailGroup.position.set(-0.45, 0, 0);
koiFishGroup.add(koiTailGroup);

const koiTailFinGeo = new THREE.ConeGeometry(0.28, 0.52, 4);
koiTailFinGeo.rotateZ(-Math.PI / 2);
koiTailFinGeo.scale(1.0, 0.08, 1.4);
const koiTailFin = new THREE.Mesh(koiTailFinGeo, koiFinMat);
koiTailFin.position.x = -0.2;
koiTailGroup.add(koiTailFin);

// 2 Vây mang xòe ra
const koiFinGeo = new THREE.ConeGeometry(0.16, 0.32, 4);
koiFinGeo.rotateZ(Math.PI / 3);
koiFinGeo.scale(1.0, 0.08, 1.2);
const finL = new THREE.Mesh(koiFinGeo, koiFinMat);
finL.position.set(0.18, -0.05, 0.2);
finL.rotation.y = 0.5;
const finR = finL.clone();
finR.position.z = -0.2;
finR.rotation.y = -0.5;
koiFishGroup.add(finL);
koiFishGroup.add(finR);

// Vây lưng cá chép
const dorsalFinGeo = new THREE.ConeGeometry(0.12, 0.48, 4);
dorsalFinGeo.rotateZ(Math.PI / 2.5);
dorsalFinGeo.scale(1.0, 0.08, 0.8);
const dorsalFin = new THREE.Mesh(dorsalFinGeo, koiFinMat);
dorsalFin.position.set(0.05, 0.22, 0);
koiFishGroup.add(dorsalFin);

// Hào quang vàng rực quanh chú cá chép
const koiGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: SHARED_PARTICLE_TEX,
  color: 0xffaa00,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
}));
koiGlow.scale.set(2.6, 2.6, 1);
koiFishGroup.add(koiGlow);

// Lồng đèn hoa đăng trên tay Chú Cuội
const cuoiLanternGroup = new THREE.Group();
cuoiLanternGroup.position.set(0.0, 0.9, 0.35);
cuoiLanternGroup.visible = false;
cuoiGroup.add(cuoiLanternGroup);

const clBodyMat = new THREE.MeshStandardMaterial({
  color: 0xdd1100,
  emissive: 0xff3300,
  emissiveIntensity: 2.0,
  roughness: 0.25,
  transparent: true,
  opacity: 0.95,
});
cuoiLanternGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.46, 6, 1, true), clBodyMat));
const clCapMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.25 });
const clCapTop = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 6), clCapMat);
clCapTop.position.y = 0.25;
cuoiLanternGroup.add(clCapTop);
const clCapBot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 6), clCapMat);
clCapBot.position.y = -0.24;
cuoiLanternGroup.add(clCapBot);

const clGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: SHARED_PARTICLE_TEX,
  color: 0xff7700,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
}));
clGlow.scale.set(2.6, 2.6, 1);
cuoiLanternGroup.add(clGlow);

// Hit Mesh click Chú Cuội
const cuoiHitMesh = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
cuoiHitMesh.userData.isCuoi = true;
cuoiGroup.add(cuoiHitMesh);
interactiveObjects.push(cuoiHitMesh);

// ── WISH QUEUE & SEQUENTIAL STATE MACHINE ──────────────────────────
const wishQueue = []; // Hàng đợi lời chúc
let cuoiState = 'IDLE'; // IDLE | CATCHING | PACKING | RELEASING | REST
let cuoiStateT = 0;
const CUOI_DURATIONS = {
  BITING: 0.9,     // 1. Phao câu nhấp nháy, lặn sâu, đốm sáng bừng lên dưới nước
  CATCHING: 1.6,   // 2. Cuội giật cần, tay phải vung lên, đốm sáng vút lên lòng bàn tay
  PACKING: 1.8,    // 3. Hai tay ôm đốm sáng đưa vào lồng đèn, lồng đèn bừng sáng ngọn lửa
  RELEASING: 2.2,  // 4. Hai tay nâng lồng đèn lên cao thành kính thả bay lên cung trăng
  REST: 1.6,       // 5. Cuội nhìn theo đèn một lát, rồi từ từ hạ tay buông cần trở lại mặt hồ
};

// Cờ kiểm soát camera: CHỈ lia camera 1 LẦN DUY NHẤT khi chính người dùng gửi lời chúc
let hasFocusedCuoiForMyWish = false;
let currentWishIsMyWish = false;
let currentActiveWish = null;

window.queueWish = function(from, to, message, isMyWish = false) {
  wishQueue.push({
    from: from || "Người ẩn danh",
    to: to || "Tất cả mọi người",
    message: message || "Chúc bạn một mùa Trung Thu trọn vẹn bình an!",
    timestamp: Date.now(),
    isMyWish: !!isMyWish
  });
};

const releasedLanterns = [];

function createWishLantern(startWorldPos, wishData) {
  const lg = new THREE.Group();
  lg.position.copy(startWorldPos);
  scene.add(lg);

  const bMat = new THREE.MeshStandardMaterial({
    map: SHARED_LANTERN_TEX,
    color: 0xd90429,
    emissive: 0xff2810,
    emissiveIntensity: 2.8,
    roughness: 0.25,
    transparent: true,
    opacity: 0.96,
  });
  lg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.7, 6, 1, true), bMat));
  const cM = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.2, emissive: 0xffaa00, emissiveIntensity: 0.5 });
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 6), cM);
  capT.position.y = 0.38;
  lg.add(capT);
  const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 6), cM);
  capB.position.y = -0.38;
  lg.add(capB);

  // Lõi lửa ấm áp bên trong
  const innerFlame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: 0xffaa22,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  innerFlame.scale.set(0.6, 0.9, 1);
  lg.add(innerFlame);

  // Hào quang lõi đỏ cam ấm áp
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: 0xff4400,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  coreGlow.scale.set(1.6, 2.0, 1);
  lg.add(coreGlow);

  // Hào quang lớn tỏa rộng ấm áp ra không trung
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: 0xff3b00,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.scale.set(4.0, 4.0, 1);
  lg.add(glow);


  // Gắn thông điệp vào lồng đèn để click xem
  const hitM = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitM.userData.parentLantern = lg;
  lg.add(hitM);
  interactiveObjects.push(hitM);

  lg.userData = {
    wish: wishData ? wishData.message : "Chúc bạn mùa Trung Thu an lành!",
    from: wishData ? wishData.from : "Chú Cuội",
    to: wishData ? wishData.to : "Mọi người",
    speedY: 0.016 + Math.random() * 0.008,
    swingSpeed: 0.9 + Math.random() * 0.6,
    initialX: lg.position.x,
    initialZ: lg.position.z,
    id: Math.random() * 1000,
  };

  releasedLanterns.push({
    group: lg,
    glow,
    vy: lg.userData.speedY,
    vx: (Math.random() - 0.5) * 0.006,
    vz: (Math.random() - 0.5) * 0.006,
    age: 0,
  });

  lanterns.push(lg);
  createFirework(startWorldPos);
}

function updateCuoi(delta, time) {
  if (typeof delta !== "number" || isNaN(delta)) delta = 0.016;
  if (typeof time !== "number" || isNaN(time)) time = 0;

  // 1. Chân & nón Chú Cuội đong đưa nhẹ theo gió
  cuoiGroup.rotation.x = Math.sin(time * 0.45) * 0.02;
  cLegLeft.rotation.x  = Math.sin(time * 1.1) * 0.12;
  cLegRight.rotation.x = Math.sin(time * 1.1 + 0.85) * 0.12;

  // Gợn sóng nơi phao câu
  const ripScale = 1.0 + (time * 1.5 % 3.0) * 1.2;
  waterRipple.scale.set(ripScale, ripScale, 1);
  rippleMat.opacity = Math.max(0, 0.6 - (time * 1.5 % 3.0) * 0.2);

  cuoiStateT += delta;

  // 2. State Machine Tuần Tự (BITING -> CATCHING -> PACKING -> RELEASING -> REST -> IDLE/NEXT)
  if (cuoiState === 'IDLE') {
    // Ngồi câu cá thư thái
    cuoiRodGroup.rotation.z = Math.sin(time * 1.2) * 0.025;
    cuoiRodGroup.rotation.x = 0;
    cArmRight.rotation.set(0.4, 0.15, -0.48);
    cArmLeft.rotation.set(0.25, 0, 0.45);
    cuoiHat.rotation.set(0, 0, Math.sin(time * 0.55) * 0.03);
    bobberGroup.position.set(0.48, -6.30 + Math.sin(time * 2.5) * 0.035, 3.8);

    wishOrbMat.opacity = 0;
    wishOrbGlowMat.opacity = 0;
    cuoiLanternGroup.visible = false;
    koiFishGroup.visible = false;

    // Có lời chúc mới đang đợi trong hàng đợi -> BẮT ĐẦU CHU KỲ CÂU LÊN
    if (wishQueue.length > 0) {
      currentActiveWish = wishQueue.shift();
      currentWishIsMyWish = !!(currentActiveWish && currentActiveWish.isMyWish);

      // CHỈ lia camera 1 LẦN DUY NHẤT nếu đây là lời chúc của chính người dùng
      if (currentWishIsMyWish && !hasFocusedCuoiForMyWish) {
        hasFocusedCuoiForMyWish = true;
        const cuoiWP = new THREE.Vector3();
        cuoiGroup.getWorldPosition(cuoiWP);
        targetCamPos = new THREE.Vector3(cuoiWP.x + 3.2, cuoiWP.y + 0.9, cuoiWP.z + 3.8);
        targetCamTarget = new THREE.Vector3(cuoiWP.x, cuoiWP.y + 0.4, cuoiWP.z);
      }

      cuoiState = 'BITING';
      cuoiStateT = 0;
    }

  } else if (cuoiState === 'BITING') {
    // 1. Phao cắn câu nhấp nhô mạnh, Cá Chép Vàng sủi bọt ngậm đốm sáng nhô lên
    const p = Math.min(cuoiStateT / CUOI_DURATIONS.BITING, 1);
    const ease = p * p * (3 - 2 * p);

    // Phao câu lặn giật giật
    bobberGroup.position.y = -6.30 - ease * 0.18 + Math.sin(time * 24) * 0.045;
    // Cuội hơi chồm người tới quan sát
    cuoiGroup.rotation.x = 0.06 * ease;
    // Cần câu hơi rũ đầu ngọn
    cuoiRodGroup.rotation.z = -0.08 * ease;

    // Chú Cá Chép Vàng xuất hiện dưới nước quẫy đuôi
    koiFishGroup.visible = true;
    koiFishGroup.position.set(0.48, -6.45 + ease * 0.28, 3.8);
    koiFishGroup.rotation.set(-Math.PI * 0.45, 0, 0);
    koiTailGroup.rotation.y = Math.sin(time * 28) * 0.45;

    // Đốm sáng bừng lên tại miệng cá chép
    wishOrb.position.set(0.48, -6.32, 3.8);
    wishOrbMat.opacity = ease * 0.95;
    wishOrbGlowMat.opacity = ease * 0.9;
    wishOrbGlow.scale.setScalar(1.2 + Math.sin(time * 18) * 0.5);

    if (cuoiStateT >= CUOI_DURATIONS.BITING) {
      cuoiState = 'CATCHING';
      cuoiStateT = 0;
    }

  } else if (cuoiState === 'CATCHING') {
    // 2. Chú Cuội giật cần câu bổng lên, Cá Chép Vàng nhảy vút lên khỏi mặt nước trao đốm sáng
    const p = Math.min(cuoiStateT / CUOI_DURATIONS.CATCHING, 1);
    const ease = p * p * (3 - 2 * p);

    // Tay phải và cần câu giật vung lên cao
    cArmRight.rotation.set(0.4 - ease * 0.9, 0.15, -0.48 - ease * 0.4);
    cuoiRodGroup.rotation.z = ease * 0.75;
    cuoiRodGroup.rotation.x = -ease * 0.35;

    // Tay trái đưa ra phía trước ngực sẵn sàng đón lấy
    cArmLeft.rotation.set(0.25 + ease * 0.42, ease * 0.35, 0.45 - ease * 0.25);

    // Cá Chép Vàng bay hình parabol vút từ mặt nước (-6.32) lên tới trước ngực Cuội (0.08, 0.55, 0.35)
    const arcHeight = Math.sin(p * Math.PI) * 1.5;
    const fishX = 0.48 + (0.08 - 0.48) * ease;
    const fishY = -6.32 + (0.55 - (-6.32)) * ease + arcHeight;
    const fishZ = 3.8 + (0.35 - 3.8) * ease;

    koiFishGroup.visible = true;
    koiFishGroup.position.set(fishX, fishY, fishZ);
    // Cá chép uốn mình theo quỹ đạo bay và quẫy đuôi mạnh
    koiFishGroup.rotation.set(-Math.PI * 0.45 + ease * 0.9, Math.sin(time * 12) * 0.2, ease * 0.6);
    koiTailGroup.rotation.y = Math.sin(time * 36) * 0.65;
    finL.rotation.z = Math.sin(time * 28) * 0.4;
    finR.rotation.z = -Math.sin(time * 28) * 0.4;

    // Đốm sáng ngậm ở đầu cá chép bay theo
    wishOrb.position.set(fishX + 0.15, fishY + 0.1, fishZ);
    wishOrbGlow.scale.setScalar(1.4 + Math.sin(time * 12) * 0.3);

    // Phao câu bay lên theo một đoạn ngắn
    bobberGroup.position.y = -6.30 + ease * 3.5;

    if (cuoiStateT >= CUOI_DURATIONS.CATCHING) {
      cuoiState = 'PACKING';
      cuoiStateT = 0;
    }

  } else if (cuoiState === 'PACKING') {
    // 3. Cuội đón lấy đốm sáng đưa vào lồng đèn, Cá Chép Vàng lặn chúc xuống hồ
    const p = Math.min(cuoiStateT / CUOI_DURATIONS.PACKING, 1);
    const ease = p * p * (3 - 2 * p);

    // Cá Chép Vàng quay đầu lặn chúc xuống lòng hồ
    const fishDive = Math.min(ease * 1.5, 1);
    if (fishDive < 0.98) {
      koiFishGroup.visible = true;
      koiFishGroup.position.set(
        0.08 + (0.48 - 0.08) * fishDive,
        0.55 + (-6.32 - 0.55) * fishDive,
        0.35 + (3.8 - 0.35) * fishDive
      );
      koiFishGroup.rotation.set(Math.PI * 0.45, 0, 0);
      koiTailGroup.rotation.y = Math.sin(time * 32) * 0.55;
    } else {
      koiFishGroup.visible = false;
    }


    // Cần câu gác nghiêng một bên
    cuoiRodGroup.rotation.z = 0.75 * (1 - ease * 0.5);
    cuoiRodGroup.rotation.x = -0.35 * (1 - ease * 0.5);

    // Hai cánh tay chụm lại trước ngực ôm lấy lồng đèn
    cArmLeft.rotation.set(0.65, 0.42, 0.15);
    cArmRight.rotation.set(0.65, -0.42, -0.15);

    // Lồng đèn xuất hiện và lớn dần giữa hai tay
    cuoiLanternGroup.visible = true;
    cuoiLanternGroup.position.set(0.0, 0.55, 0.32);
    cuoiLanternGroup.scale.setScalar(0.25 + ease * 0.75);

    // Đốm sáng lặn dần vào tâm lồng đèn
    wishOrb.position.lerp(new THREE.Vector3(0.0, 0.55, 0.32), ease * 0.5);
    wishOrbMat.opacity = (1 - ease) * 0.95;
    wishOrbGlowMat.opacity = (1 - ease) * 0.9;

    // Lồng đèn bừng sáng
    clGlow.material.opacity = 0.3 + ease * 0.6 + Math.sin(time * 8) * 0.1;

    if (cuoiStateT >= CUOI_DURATIONS.PACKING) {
      cuoiState = 'RELEASING';
      cuoiStateT = 0;
      cuoiGroup.userData.lanternSpawned = false;
    }

  } else if (cuoiState === 'RELEASING') {
    // 4. Cuội nâng hai tay lên cao qua đầu thành kính thả đèn hoa đăng bay lên cung trăng
    const p = Math.min(cuoiStateT / CUOI_DURATIONS.RELEASING, 1);
    const ease = p * p * (3 - 2 * p);

    // Hai cánh tay nâng cao qua đầu
    cArmLeft.rotation.set(0.65 + ease * 0.75, 0.42 - ease * 0.22, 0.15 + ease * 0.2);
    cArmRight.rotation.set(0.65 + ease * 0.75, -0.42 + ease * 0.22, -0.15 - ease * 0.2);

    // Nón lá ngửa nhẹ lên nhìn theo
    cuoiHat.rotation.x = -0.22 * ease;

    // Lồng đèn từ từ bay lên cao khỏi tay Cuội
    cuoiLanternGroup.position.y = 0.55 + ease * 3.6;
    cuoiLanternGroup.position.z = 0.32 + ease * 0.8;
    cuoiLanternGroup.rotation.y += 0.025;

    // Giữa chu kỳ: Tách thành đèn bay thật trong không gian
    if (cuoiStateT > CUOI_DURATIONS.RELEASING * 0.45 && !cuoiGroup.userData.lanternSpawned) {
      cuoiGroup.userData.lanternSpawned = true;
      const wp = new THREE.Vector3();
      cuoiLanternGroup.getWorldPosition(wp);
      createWishLantern(wp, currentActiveWish);
    }

    if (cuoiStateT >= CUOI_DURATIONS.RELEASING) {
      cuoiLanternGroup.visible = false;
      cuoiLanternGroup.position.set(0.0, 0.55, 0.32);
      cuoiState = 'REST';
      cuoiStateT = 0;
    }

  } else if (cuoiState === 'REST') {
    // 5. Cuội nhìn theo đèn một lát, từ từ hạ tay, hạ cần trúc và buông dây câu xuống hồ câu tiếp
    const p = Math.min(cuoiStateT / CUOI_DURATIONS.REST, 1);
    const ease = p * p * (3 - 2 * p);

    // Nón lá từ từ hạ về góc bình thường
    cuoiHat.rotation.x = -0.22 * (1 - ease);

    // Hai cánh tay từ từ hạ xuống vị trí cầm cần
    cArmLeft.rotation.set(1.4 - ease * 1.15, 0.2 - ease * 0.2, 0.35 + ease * 0.1);
    cArmRight.rotation.set(1.4 - ease * 1.0, 0.15, -0.48);

    // Cần câu hạ ngọn chúc lại mặt hồ
    cuoiRodGroup.rotation.z = 0.375 * (1 - ease);
    cuoiRodGroup.rotation.x = -0.175 * (1 - ease);

    // Phao câu và dây câu hạ lại mặt hồ tại -8.70
    bobberGroup.position.set(0.48, -8.70, 3.8);

    if (cuoiStateT >= CUOI_DURATIONS.REST) {
      // Nếu lời chúc vừa thả là của chính người dùng, trả camera về góc toàn cảnh ban đầu
      if (currentWishIsMyWish) {
        targetCamPos = DEFAULT_CAM_POS.clone();
        targetCamTarget = DEFAULT_CAM_TARGET.clone();
        currentWishIsMyWish = false;
      }

      // Nếu còn lời chúc tiếp theo trong hàng đợi -> chạy tiếp tuần tự
      if (wishQueue.length > 0) {
        currentActiveWish = wishQueue.shift();
        currentWishIsMyWish = !!(currentActiveWish && currentActiveWish.isMyWish);

        // Nếu là wish của chính người dùng và chưa từng focus -> mới focus
        if (currentWishIsMyWish && !hasFocusedCuoiForMyWish) {
          hasFocusedCuoiForMyWish = true;
          const cuoiWP = new THREE.Vector3();
          cuoiGroup.getWorldPosition(cuoiWP);
          targetCamPos = new THREE.Vector3(cuoiWP.x + 3.2, cuoiWP.y + 0.9, cuoiWP.z + 3.8);
          targetCamTarget = new THREE.Vector3(cuoiWP.x, cuoiWP.y + 0.4, cuoiWP.z);
        }

        cuoiState = 'BITING';
        cuoiStateT = 0;
      } else {
        cuoiState = 'IDLE';
        cuoiStateT = 0;
      }
    }
  }

  // 3. Cập nhật các lồng đèn đã được thả bay lên trời
  for (let i = releasedLanterns.length - 1; i >= 0; i--) {
    const rl = releasedLanterns[i];
    rl.age += delta;
    rl.group.position.y += rl.vy;
    rl.group.position.x += rl.vx + Math.sin(time * 0.6 + i) * 0.005;
    rl.group.position.z += rl.vz + Math.cos(time * 0.6 + i) * 0.005;
    rl.group.rotation.y += 0.008;
    if (rl.age > 45.0) {
      scene.remove(rl.group);
      releasedLanterns.splice(i, 1);
    }
  }
}

// ── 7. GLSL SHADER: MẶT TRĂNG 3D VỚI CRATER & ÁNH SÁNG ────────
const moonVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const moonFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * smoothNoise(p);
      p *= 2.08;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Màu vàng ngà ấm áp đặc trưng trăng rằm
    vec3 baseMoon = vec3(0.99, 0.94, 0.82);
    vec3 craterTint = vec3(0.68, 0.58, 0.46);

    // Tính đốm crater tự nhiên qua FBM noise
    float n = fbm(vUv * 8.5);
    float crater = smoothstep(0.42, 0.58, n);
    vec3 col = mix(baseMoon, craterTint, crater * 0.42);

    // Rim lighting (hiệu ứng rìa sáng tỏa không gian)
    vec3 viewDir = normalize(vViewPosition);
    float rim = 1.0 - max(dot(vNormal, viewDir), 0.0);
    rim = pow(rim, 2.5);
    col = mix(col, vec3(1.0, 0.98, 0.9), rim * 0.4);

    // Vầng sáng ấm nhẹ trung tâm trăng
    float centerGlow = 1.0 - length(vUv - 0.5) * 1.5;
    col += vec3(0.12, 0.08, 0.02) * clamp(centerGlow, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── 7. GLSL SHADER: MẶT TRĂNG 3D SIÊU TO & ĐỊNH HƯỚNG THEO CAMERA ──
const moonGeo = new THREE.SphereGeometry(
  16.5,
  CFG.moonSegments,
  CFG.moonSegments,
);
const moonMat = new THREE.ShaderMaterial({
  vertexShader: moonVertexShader,
  fragmentShader: moonFragmentShader,
});
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
scene.add(moonMesh);

// Hào quang trăng (Bloom Glow Sprites) tỏa sáng tráng lệ
function createMoonGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255, 245, 195, 0.85)");
  g.addColorStop(0.25, "rgba(255, 215, 120, 0.45)");
  g.addColorStop(0.6, "rgba(255, 185, 70, 0.12)");
  g.addColorStop(1, "rgba(255, 180, 50, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}
const SHARED_MOON_GLOW_TEX = createMoonGlowTexture();
const moonGlowGroup = new THREE.Group();

[85, 58, 42].forEach((sz, idx) => {
  const sm = new THREE.SpriteMaterial({
    map: SHARED_MOON_GLOW_TEX,
    transparent: true,
    opacity: [0.35, 0.48, 0.65][idx],
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(sm);
  sp.scale.set(sz, sz, 1);
  moonGlowGroup.add(sp);
});
scene.add(moonGlowGroup);

// ── TẦNG MÂY CUỘN Á ĐÔNG CÁCH ĐIỆU VỜN 2 BÊN TRĂNG (FLANKING AUSPICIOUS CLOUDS) ──
function createOrientalCloudTexture(isFlipped = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.save();
  if (isFlipped) {
    ctx.translate(512, 0);
    ctx.scale(-1, 1);
  }

  // Vẽ dáng mây cuộn cổ truyền Á Đông (nhiều tầng vòm mây mềm mại uốn lượn)
  ctx.beginPath();
  ctx.moveTo(50, 160);
  ctx.bezierCurveTo(70, 105, 130, 90, 175, 115);
  ctx.bezierCurveTo(205, 55, 290, 50, 335, 100);
  ctx.bezierCurveTo(375, 75, 430, 95, 455, 135);
  ctx.bezierCurveTo(495, 150, 505, 185, 465, 205);
  ctx.bezierCurveTo(410, 225, 110, 225, 60, 195);
  ctx.bezierCurveTo(35, 180, 35, 170, 50, 160);
  ctx.closePath();

  // Tô màu mây chuyển sắc tím lam dạ vũ & hồng phấn bồng bềnh, rõ ràng sắc nét
  const grad = ctx.createLinearGradient(80, 50, 350, 220);
  grad.addColorStop(0, "rgba(240, 220, 255, 0.88)");
  grad.addColorStop(0.35, "rgba(195, 170, 245, 0.72)");
  grad.addColorStop(0.7, "rgba(135, 125, 215, 0.52)");
  grad.addColorStop(1, "rgba(75, 80, 160, 0.22)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Viền mây ánh trăng vàng hoàng kim rõ nét, tinh tế
  ctx.strokeStyle = "rgba(255, 238, 165, 0.95)";
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // Vân xoắn ốc cổ truyền bên trong áng mây sắc nét
  ctx.beginPath();
  ctx.arc(190, 145, 25, 0.2, Math.PI * 1.5, false);
  ctx.strokeStyle = "rgba(255, 240, 185, 0.85)";
  ctx.lineWidth = 3.0;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(325, 140, 32, 0.3, Math.PI * 1.45, false);
  ctx.strokeStyle = "rgba(255, 240, 185, 0.80)";
  ctx.lineWidth = 3.0;
  ctx.stroke();

  ctx.restore();
  return new THREE.CanvasTexture(canvas);
}

const orientalCloudTexLeft = createOrientalCloudTexture(false);
const orientalCloudTexRight = createOrientalCloudTexture(true);

const celestialCloudsGroup = new THREE.Group();
const celestialClouds = [];

// Thiết kế 6 áng mây cuộn rõ nét nằm dạt hẳn sang 2 bên sườn vầng trăng (tả hữu ôm trăng, không che tâm trăng)
const CLOUD_CONFIGS = [
  // 3 áng mây bên trái sườn trăng (Left Flank)
  { tex: orientalCloudTexLeft, offsetX: -26.0, offsetY: 4.5, offsetZ: -2.0, width: 48, height: 24, opacity: 0.86, speed: 0.38, phase: 0.0 },
  { tex: orientalCloudTexLeft, offsetX: -21.5, offsetY: -5.5, offsetZ: 2.5, width: 40, height: 20, opacity: 0.82, speed: 0.32, phase: 1.8 },
  { tex: orientalCloudTexLeft, offsetX: -31.0, offsetY: -1.0, offsetZ: -4.0, width: 52, height: 26, opacity: 0.78, speed: 0.28, phase: 3.5 },
  // 3 áng mây bên phải sườn trăng (Right Flank)
  { tex: orientalCloudTexRight, offsetX: 25.5, offsetY: 3.0, offsetZ: -1.5, width: 46, height: 23, opacity: 0.85, speed: 0.35, phase: 3.14 },
  { tex: orientalCloudTexRight, offsetX: 22.0, offsetY: -6.5, offsetZ: 2.0, width: 38, height: 19, opacity: 0.80, speed: 0.40, phase: 4.8 },
  { tex: orientalCloudTexRight, offsetX: 30.5, offsetY: -2.0, offsetZ: -3.5, width: 50, height: 25, opacity: 0.76, speed: 0.30, phase: 0.9 }
];

for (let i = 0; i < CLOUD_CONFIGS.length; i++) {
  const cfg = CLOUD_CONFIGS[i];
  const cMat = new THREE.SpriteMaterial({
    map: cfg.tex,
    transparent: true,
    opacity: cfg.opacity,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(cMat);
  sp.scale.set(cfg.width, cfg.height, 1);
  sp.position.set(cfg.offsetX, cfg.offsetY, cfg.offsetZ);
  celestialCloudsGroup.add(sp);

  celestialClouds.push({
    sprite: sp,
    baseX: cfg.offsetX,
    baseY: cfg.offsetY,
    baseZ: cfg.offsetZ,
    baseOpacity: cfg.opacity,
    speed: cfg.speed,
    phase: cfg.phase
  });
}

scene.add(celestialCloudsGroup);

const moonLight = new THREE.DirectionalLight(0xfff6d8, 1.15);
scene.add(moonLight);

// Vị trí trăng bám theo hướng nhìn của người dùng (Luôn trong tầm mắt)
const currentMoonPos = new THREE.Vector3(0, 40, -95);

function updateMoon(time) {
  // Vector nhìn từ camera xuyên qua tâm đảo (controls.target)
  const viewDir = new THREE.Vector3().subVectors(controls.target, camera.position);
  viewDir.y = 0; // Chiếu lên mặt phẳng ngang
  if (viewDir.lengthSq() > 0.001) {
    viewDir.normalize();
  } else {
    viewDir.set(0, 0, -1);
  }

  // Đặt mặt trăng phía sau đảo theo hướng nhìn để lúc nào xoay camera cũng thấy trăng
  const moonDistance = 96;
  const swayAngle = Math.sin(time * 0.25) * 0.14; // Dao động nhẹ để tự nhiên
  const cosSway = Math.cos(swayAngle);
  const sinSway = Math.sin(swayAngle);
  const dirX = viewDir.x * cosSway - viewDir.z * sinSway;
  const dirZ = viewDir.x * sinSway + viewDir.z * cosSway;

  const targetX = controls.target.x + dirX * moonDistance;
  const targetY = 38 + Math.sin(time * 0.35) * 2.5; // Độ cao lộng lẫy trên nền trời
  const targetZ = controls.target.z + dirZ * moonDistance;
  const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

  // Lerp mượt mà theo chuyển động xoay camera của người xem
  currentMoonPos.lerp(targetPos, 0.048);

  moonMesh.position.copy(currentMoonPos);
  moonGlowGroup.position.copy(currentMoonPos);
  celestialCloudsGroup.position.copy(currentMoonPos);
  moonLight.position.copy(currentMoonPos);

  // Mây cuộn 2 bên sườn trăng lượn sóng êm dịu theo nhịp thở trăng rằm
  for (let c = 0; c < celestialClouds.length; c++) {
    const cl = celestialClouds[c];
    cl.sprite.position.y = cl.baseY + Math.sin(time * cl.speed + cl.phase) * 1.5;
    cl.sprite.position.x = cl.baseX + Math.cos(time * (cl.speed * 0.7) + cl.phase) * 1.2;
    cl.sprite.material.opacity = cl.baseOpacity + Math.sin(time * 0.6 + cl.phase) * 0.06;
  }

  // Tự xoay trục trăng rất chậm để bề mặt crater sống động
  moonMesh.rotation.y = time * 0.015;
}


// ── 8. GLSL SHADER: HỒ NƯỚC HUYỀN ẢO CAO CẤP (BIOLUMINESCENT LAKE) ──
let waterMesh = null;
let waterMat = null;

if (CFG.waterEnabled) {
  const waterVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    uniform float uTime;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Sóng đa tần Gerstner-like mềm mại, trải dài vô cực
      float dist = length(pos.xz);
      float waveScale = clamp(1.0 - dist / 380.0, 0.3, 1.0);

      float wave1 = sin(pos.x * 0.55 + uTime * 1.5) * cos(pos.z * 0.45 + uTime * 1.2) * 0.22;
      float wave2 = sin((pos.x + pos.z) * 0.75 + uTime * 1.8) * 0.14;
      float wave3 = cos((pos.x - pos.z) * 1.1 + uTime * 2.0) * 0.08;
      pos.y += (wave1 + wave2 + wave3) * waveScale;

      // Tính pháp tuyến mặt sóng gần đúng
      float dHdx = 0.55 * cos(pos.x * 0.55 + uTime * 1.5) * cos(pos.z * 0.45 + uTime * 1.2) * 0.22 * waveScale;
      float dHdz = -0.45 * sin(pos.x * 0.55 + uTime * 1.5) * sin(pos.z * 0.45 + uTime * 1.2) * 0.22 * waveScale;
      vNormal = normalize(vec3(-dHdx, 1.0, -dHdz));

      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const waterFragmentShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    uniform float uTime;
    uniform vec3 uMoonPos;
    uniform vec3 uCamPos;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float caustics(vec2 p) {
      vec2 p1 = p + vec2(uTime * 0.32, uTime * 0.2);
      vec2 p2 = p * 1.25 - vec2(uTime * 0.25, uTime * 0.35);
      float n1 = noise(p1);
      float n2 = noise(p2);
      float c = abs(sin(n1 * 6.28 + n2 * 6.28));
      return pow(1.0 - c, 3.0);
    }

    void main() {
      float dist = length(vWorldPos.xz);

      // 1. Màu nền nước biển đêm sâu thẳm lung linh (Midnight Deep Ocean -> Sapphire Cyan)
      vec3 deepWater = vec3(0.010, 0.038, 0.14);
      vec3 surfaceWater = vec3(0.035, 0.16, 0.35);
      vec3 waterColor = mix(surfaceWater, deepWater, clamp(dist / 85.0, 0.0, 1.0));

      // 2. Viền bọt sóng ngọc bích quanh chân đảo (Bioluminescent Shore Foam)
      float shoreEdge = smoothstep(8.2, 3.2, dist);
      float foamNoise = noise(vWorldPos.xz * 2.5 + vec2(uTime * 1.2, -uTime * 0.8));
      float shoreFoam = pow(foamNoise, 2.0) * shoreEdge * 1.4;
      vec3 bioCyan = vec3(0.12, 0.92, 0.85);

      // 3. Hoa văn vân nước caustics lấp lánh (rõ gần bờ, êm dần ra xa)
      float c = caustics(vWorldPos.xz * 0.25);
      float causticsFade = clamp(1.0 - dist / 90.0, 0.1, 1.0);
      vec3 causticsColor = vec3(0.15, 0.82, 1.0) * c * 0.5 * causticsFade;

      // 4. Phản chiếu dải trăng dát vàng vô cực trải dài tới chân trời (Infinity Moon Path)
      vec3 viewDir = normalize(uCamPos - vWorldPos);
      vec3 moonDir = normalize(uMoonPos - vWorldPos);
      vec3 halfVec = normalize(viewDir + moonDir);
      float spec = max(dot(vNormal, halfVec), 0.0);
      float moonSpec = pow(spec, 58.0) * 0.72; // Vệt óng trăng thanh mảnh, lung linh tinh tế dịu mắt
      float moonGlowTrail = pow(spec, 8.5) * 0.28; // Giảm hào quang loang rộng để không bị chói
      vec3 moonPathColor = vec3(1.0, 0.94, 0.78) * moonSpec + vec3(0.98, 0.82, 0.45) * moonGlowTrail;

      // 5. Phản chiếu ánh lồng đèn ấm áp bồng bềnh
      float lanternRipple = sin(vWorldPos.x * 0.55 + uTime * 1.8) * cos(vWorldPos.z * 0.55 + uTime * 1.4) * 0.5 + 0.5;
      float lanternTrail = pow(lanternRipple, 4.0) * 0.45;
      vec3 lanternColor = vec3(1.0, 0.52, 0.15) * lanternTrail;

      // 6. Hiệu ứng Fresnel thấu quang
      float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
      fresnel = pow(fresnel, 2.6);

      // Tổng hợp màu sắc mặt nước
      vec3 finalColor = waterColor;
      finalColor += causticsColor;
      finalColor += bioCyan * shoreFoam;
      finalColor += bioCyan * shoreEdge * 0.55;
      finalColor += moonPathColor;
      finalColor += lanternColor;
      finalColor += vec3(0.35, 0.78, 1.0) * fresnel * 0.38;

      // 7. Hiệu ứng Hồ Vô Cực (Infinity Lake): Chân trời hòa tan mượt mà vào bầu trời đêm sâu thẳm
      vec3 horizonSkyColor = vec3(0.005, 0.008, 0.020);
      float horizonFog = smoothstep(120.0, 460.0, dist);
      vec3 infinityWaterColor = mix(finalColor, horizonSkyColor, horizonFog * 0.94);

      float alpha = clamp(0.92 + fresnel * 0.08, 0.0, 1.0);
      gl_FragColor = vec4(infinityWaterColor, alpha);
    }
  `;

  // Mở rộng quy mô hồ nước từ 52m lên 480m tạo cảm giác hồ nước phẳng lặng vô cực
  const waterGeo = new THREE.CircleGeometry(480, 80);
  waterGeo.rotateX(-Math.PI / 2);

  waterMat = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uMoonPos: { value: new THREE.Vector3(0, 40, -95) },
      uCamPos: { value: camera.position },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = -4.8;
  scene.add(waterMesh);
}

// ── 8B. ĐÀN ĐOM ĐÓM DẠ QUANG MẶT HỒ VÔ CỰC (BIOLUMINESCENT WATER FIREFLIES) ──
const waterFirefliesGroup = new THREE.Group();
const waterFireflies = [];
const FIREFLY_COLORS = [0xd4ff00, 0x00ffd2, 0xffea00, 0x70e000, 0xffb703, 0x06d6a0];

for (let f = 0; f < 80; f++) {
  const fMat = new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: FIREFLY_COLORS[f % FIREFLY_COLORS.length],
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(fMat);
  const sz = 0.55 + Math.random() * 0.45;
  sp.scale.set(sz, sz, 1);

  // Phân bố từ rìa đảo r = 10m ra tới xa r = 68m, dập dờn là là trên sóng nước
  const rad = 10 + Math.random() * 58;
  const ang = Math.random() * Math.PI * 2;
  const initX = Math.cos(ang) * rad;
  const initZ = Math.sin(ang) * rad;
  const initY = -4.4 + Math.random() * 2.8;

  sp.position.set(initX, initY, initZ);
  waterFirefliesGroup.add(sp);

  waterFireflies.push({
    sprite: sp,
    initX,
    initY,
    initZ,
    rad,
    ang,
    speedAng: (0.15 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1),
    speedY: 0.8 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
    pulseSpeed: 2.2 + Math.random() * 2.8,
    baseScale: sz,
  });
}
scene.add(waterFirefliesGroup);

function updateWaterFireflies(time) {
  for (let i = 0; i < waterFireflies.length; i++) {
    const ff = waterFireflies[i];
    const a = ff.ang + time * ff.speedAng;
    const r = ff.rad + Math.sin(time * 0.4 + ff.phase) * 3.2;
    ff.sprite.position.x = Math.cos(a) * r;
    ff.sprite.position.z = Math.sin(a) * r;
    ff.sprite.position.y = ff.initY + Math.sin(time * ff.speedY + ff.phase) * 0.65;

    // Nhấp nháy phát quang sinh học
    const pulse = (Math.sin(time * ff.pulseSpeed + ff.phase) + 1) / 2;
    ff.sprite.material.opacity = 0.25 + pulse * 0.75;
    const s = ff.baseScale * (0.8 + pulse * 0.45);
    ff.sprite.scale.set(s, s, 1);
  }
}

// ── 9. DẢI NGÂN HÀ & BẦU TRỜI SAO ─────────────────────────────
const mwGeo = new THREE.BufferGeometry();
const mwPos = new Float32Array(CFG.mwCount * 3);
const mwCol = new Float32Array(CFG.mwCount * 3);

const mwPalette = [
  new THREE.Color(0x99ccff),
  new THREE.Color(0xfff2cc),
  new THREE.Color(0xffd1dc),
  new THREE.Color(0xffffff),
];

for (let i = 0; i < CFG.mwCount; i++) {
  const t = (Math.random() - 0.5) * 170;
  const spread = 20 + Math.abs(t) * 0.06;
  const x = (Math.random() - 0.5) * spread;
  const y = (Math.random() - 0.5) * 9 + 52 + Math.abs(x) * 0.25;
  const z = t - 70;

  const tilt = 0.48;
  mwPos[i * 3] = x * Math.cos(tilt) - z * Math.sin(tilt) * 0.28;
  mwPos[i * 3 + 1] = y;
  mwPos[i * 3 + 2] = x * Math.sin(tilt) + z;

  const baseC = mwPalette[Math.floor(Math.random() * mwPalette.length)];
  const fade = Math.exp((-Math.abs(x) / spread) * 2.4);
  mwCol[i * 3] = baseC.r * fade;
  mwCol[i * 3 + 1] = baseC.g * fade;
  mwCol[i * 3 + 2] = baseC.b * fade;
}

mwGeo.setAttribute("position", new THREE.BufferAttribute(mwPos, 3));
mwGeo.setAttribute("color", new THREE.BufferAttribute(mwCol, 3));

const mwMat = new THREE.PointsMaterial({
  size: IS_MOBILE ? 0.32 : 0.28,
  vertexColors: true,
  transparent: true,
  opacity: 0.52,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
scene.add(new THREE.Points(mwGeo, mwMat));

// Sao đêm nền
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(CFG.starCount * 3);
for (let i = 0; i < CFG.starCount; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 190;
  starPos[i * 3 + 1] = Math.random() * 95;
  starPos[i * 3 + 2] = (Math.random() - 0.5) * 190;
}
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.4,
  transparent: true,
  opacity: 0.72,
});
scene.add(new THREE.Points(starGeo, starMat));

// ── 10. THIÊN THẠCH (SHOOTING STARS) ─────────────────────────
const shootingStars = [];
let nextShootingStarTime = 3.5;

function spawnShootingStar() {
  const trailLen = 28;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(trailLen * 3);

  const startX = (Math.random() - 0.5) * 130;
  const startY = 48 + Math.random() * 26;
  const startZ = (Math.random() - 0.5) * 70 - 40;

  const dir = new THREE.Vector3(
    (Math.random() - 0.5) * 0.7 - 0.45,
    -0.45 - Math.random() * 0.28,
    (Math.random() - 0.5) * 0.25,
  ).normalize();

  for (let i = 0; i < trailLen; i++) {
    sPos[i * 3] = startX - dir.x * i * 0.85;
    sPos[i * 3 + 1] = startY - dir.y * i * 0.85;
    sPos[i * 3 + 2] = startZ - dir.z * i * 0.85;
  }
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));

  const sMat = new THREE.PointsMaterial({
    size: 0.72,
    color: Math.random() < 0.5 ? 0xffffff : 0xffea77,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Points(sGeo, sMat);
  scene.add(mesh);

  shootingStars.push({
    mesh,
    posArr: sPos,
    dir,
    speed: 2.2 + Math.random() * 1.4,
    life: 1.0,
    trailLen,
  });
}

function updateShootingStars(delta, time) {
  if (!CFG.shootingEnabled) return;

  if (time > nextShootingStarTime) {
    spawnShootingStar();
    if (Math.random() < 0.4) {
      setTimeout(() => spawnShootingStar(), 180);
    }
    nextShootingStarTime = time + 1.2 + Math.random() * 2.2;
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const ss = shootingStars[i];
    ss.life -= delta * 0.85;

    const len = ss.trailLen || 16;
    for (let j = 0; j < len; j++) {
      ss.posArr[j * 3] += ss.dir.x * ss.speed * delta * 60;
      ss.posArr[j * 3 + 1] += ss.dir.y * ss.speed * delta * 60;
      ss.posArr[j * 3 + 2] += ss.dir.z * ss.speed * delta * 60;
    }
    ss.mesh.geometry.attributes.position.needsUpdate = true;
    ss.mesh.material.opacity = Math.max(0, ss.life);

    if (ss.life <= 0) {
      ss.mesh.geometry.dispose();
      ss.mesh.material.dispose();
      scene.remove(ss.mesh);
      shootingStars.splice(i, 1);
    }
  }
}

// ── 11. HỆ THỐNG LỒNG ĐÈN & LỜI CHÚC TRUNG THU ────────────────
const lanternsGroup = new THREE.Group();
scene.add(lanternsGroup);

// Xoá sạch cache lời chúc mẫu cũ trong trình duyệt của người dùng
try {
  if (localStorage.getItem("tthu3d_clean_v2") !== "true") {
    localStorage.removeItem("tthu3d_wishes");
    localStorage.setItem("tthu3d_clean_v2", "true");
  }
} catch (e) {}

// 1. Lời chúc ban đầu duy nhất (từ chủ trang web)
const DEFAULT_WISHES = [
  { from: "Lộc Nguyễn", to: "Mọi người", message: "Cảm ơn mọi người đã ghé Site. Chúc mọi người có một đêm trung thu bình an bên gia đình", date: "Rằm Tháng Tám" }
];

// Cấu hình kết nối Supabase (lưu trữ & đồng bộ Realtime toàn cầu)
const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  url: "https://rdoupykzqnmdpvmzezcx.supabase.co",
  anonKey: "sb_publishable_1hMgQqYhWj9-olHLhpDSXA_nu9miqOw",
  table: "wishes"
};

// Định danh session duy nhất của client để tránh lặp hiệu ứng cho chính mình
const CLIENT_SESSION_ID = "client_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now().toString(36);

// 2. Module quản lý kho lời chúc WishStore (LocalStorage + Supabase sync & Realtime)
const WishStore = {
  getAll() {
    try {
      const stored = localStorage.getItem("tthu3d_wishes");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [...DEFAULT_WISHES];
  },

  // Đảm bảo luôn có ít nhất minCount lời chúc cho các lồng đèn (lặp vòng từ lời chúc thật)
  getActiveWishes(minCount = 20) {
    const list = this.getAll();
    if (!list || list.length === 0) return [...DEFAULT_WISHES];
    const result = [];
    while (result.length < minCount) {
      for (const w of list) {
        result.push(w);
        if (result.length >= minCount) break;
      }
    }
    return result;
  },

  add(item) {
    const all = this.getAll();
    all.unshift(item);
    try {
      localStorage.setItem("tthu3d_wishes", JSON.stringify(all.slice(0, 300)));
    } catch (e) {}
    updateInboxCount();

    // Đồng bộ lên Supabase nếu có cấu hình (kèm client_id)
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
      fetch(`${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_CONFIG.anonKey,
          "Authorization": `Bearer ${SUPABASE_CONFIG.anonKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          sender: item.from,
          recipient: item.to,
          message: item.message,
          client_id: CLIENT_SESSION_ID,
          created_at: new Date().toISOString()
        })
      }).catch(err => console.warn("Supabase sync warning:", err));
    }

    // Sinh thêm một lồng đèn mới mang lời chúc này vào không gian
    spawnFloatingWishLantern(item);

    return all;
  },

  // Đồng bộ lời chúc từ Supabase khi mở web
  async syncFromSupabase() {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) return;
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?select=*&order=created_at.desc&limit=100`, {
        headers: {
          "apikey": SUPABASE_CONFIG.anonKey,
          "Authorization": `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const remoteWishes = data.map(d => ({
            from: d.sender || "Người ẩn danh",
            to: d.recipient || "Tất cả mọi người",
            message: d.message || "",
            date: "Rằm Tháng Tám"
          })).filter(w => w.message);

          if (remoteWishes.length > 0) {
            localStorage.setItem("tthu3d_wishes", JSON.stringify(remoteWishes.slice(0, 300)));
            updateInboxCount();
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch remote wishes from Supabase:", e);
    }
  },

  // Khởi tạo Supabase Realtime Channel: phát sóng sự kiện khi có lời chúc mới toàn cầu
  initRealtime() {
    if (!window.supabase || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) return;
    try {
      const supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      supabaseClient
        .channel("wishes-broadcast")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: SUPABASE_CONFIG.table },
          (payload) => {
            const row = payload.new;
            if (!row || row.client_id === CLIENT_SESSION_ID) return; // Tránh lặp lại cho chính client này

            const remoteWish = {
              from: row.sender || "Người ẩn danh",
              to: row.recipient || "Tất cả mọi người",
              message: row.message || "",
              date: "Rằm Tháng Tám"
            };

            // Thêm vào kho lời chúc
            const all = WishStore.getAll();
            if (!all.some(w => w.message === remoteWish.message && w.from === remoteWish.from)) {
              all.unshift(remoteWish);
              try {
                localStorage.setItem("tthu3d_wishes", JSON.stringify(all.slice(0, 300)));
              } catch (e) {}
              updateInboxCount();
            }

            // Thông báo Toast cho toàn bộ người xem đang online
            showToast(`🏮 Lời chúc mới từ "${remoteWish.from}" vừa gửi tới cung trăng ✨`);

            // Kích hoạt Chú Cuội câu cá chép vàng và thả đèn mang lời chúc (không lia camera người xem)
            if (typeof window.queueWish === "function") {
              window.queueWish(remoteWish.from, remoteWish.to, remoteWish.message, false);
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("🟢 [Supabase Realtime] Đã kết nối lắng nghe lời chúc thời gian thực!");
          }
        });
    } catch (e) {
      console.warn("Supabase Realtime setup warning:", e);
    }
  }
};
window.WishStore = WishStore;

function updateInboxCount() {
  const el = document.getElementById("inbox-count");
  if (el) {
    const list = WishStore.getAll();
    el.textContent = list.length;
  }
}
updateInboxCount();

// Khởi chạy đồng bộ & Realtime nếu có Supabase
setTimeout(() => {
  WishStore.syncFromSupabase();
  WishStore.initRealtime();
}, 2000);

// Bảng màu lồng đèn bay: thuần các sắc thái của MÀU ĐỎ rực rỡ truyền thống Trung Thu
const FLOAT_LANTERN_PALETTE = [
  { body: 0xd90429, emissive: 0xff1e2e, glow: 0xff2535 }, // Đỏ nhung thắm
  { body: 0xef233c, emissive: 0xff2b3b, glow: 0xff3344 }, // Đỏ cờ rực rỡ
  { body: 0xc1121f, emissive: 0xf51829, glow: 0xff2030 }, // Đỏ son cung đình
  { body: 0xb7094c, emissive: 0xe01e5a, glow: 0xff2550 }, // Đỏ lựu hoàng gia
  { body: 0xe63946, emissive: 0xff3344, glow: 0xff3b4d }, // Đỏ thắm Hội An
  { body: 0xa00020, emissive: 0xdb002c, glow: 0xff1a35 }, // Đỏ ngọc ruby
];



const lanternCapMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.6,
  roughness: 0.3,
  emissive: 0xffaa00,
  emissiveIntensity: 0.35,
});

let _lanternIdx = 0;
function createLanternMesh() {
  const group = new THREE.Group();
  const pal = FLOAT_LANTERN_PALETTE[_lanternIdx % FLOAT_LANTERN_PALETTE.length];
  _lanternIdx++;

  // ── Thân lồng đèn trụ lục giác truyền thống ──
  const bodyMat = new THREE.MeshStandardMaterial({
    map: SHARED_LANTERN_TEX,
    color: pal.body,
    emissive: pal.emissive,
    emissiveIntensity: 4.2, // Rực sáng bừng trong đêm
    roughness: 0.2,
    transparent: true,
    opacity: 0.96,
  });
  // Thân trụ lục giác - hình dạng lồng đèn cổ điển chuẩn
  const bodyGeo = new THREE.CylinderGeometry(0.58, 0.48, 1.5, 6, 1, true);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Lõi ngọn lửa ấm áp bên trong lồng đèn
  const flameMat = new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: pal.emissive,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerFlame = new THREE.Sprite(flameMat);
  innerFlame.scale.set(0.7, 1.1, 1);
  group.add(innerFlame);

  // Hào quang lõi đỏ cam ấm rực rỡ
  const coreGlowMat = new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: pal.glow,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreGlow = new THREE.Sprite(coreGlowMat);
  coreGlow.scale.set(1.8, 2.2, 1);
  group.add(coreGlow);

  // Nắp trên (đĩa lục giác)
  const capTopGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 6);
  const capTop = new THREE.Mesh(capTopGeo, lanternCapMat);
  capTop.position.y = 0.8;
  group.add(capTop);

  // Nắp dưới
  const capBotGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 6);
  const capBot = new THREE.Mesh(capBotGeo, lanternCapMat);
  capBot.position.y = -0.79;
  group.add(capBot);

  // Chóp đỉnh nhọn nhỏ
  const pinnacleGeo = new THREE.CylinderGeometry(0.06, 0.24, 0.22, 6);
  const pinnacle = new THREE.Mesh(pinnacleGeo, lanternCapMat);
  pinnacle.position.y = 0.95;
  group.add(pinnacle);

  // Móc treo
  const hookGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6);
  const hook = new THREE.Mesh(hookGeo, lanternCapMat);
  hook.position.y = 1.1;
  group.add(hook);

  // Tua rúm 3 sợi
  const tassMat = new THREE.MeshBasicMaterial({ color: pal.body });
  for (let t = 0; t < 3; t++) {
    const ta = (t / 3) * Math.PI * 2;
    const tGeo = new THREE.CylinderGeometry(0.012, 0.002, 0.55, 4);
    const tMesh = new THREE.Mesh(tGeo, tassMat);
    tMesh.position.set(Math.cos(ta) * 0.1, -1.1, Math.sin(ta) * 0.1);
    group.add(tMesh);
  }

  // Hào quang ấm áp tỏa rộng trong đêm trăng
  const glowMat = new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: pal.glow,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerGlow = new THREE.Sprite(glowMat);
  outerGlow.scale.set(4.2, 4.2, 1);
  group.add(outerGlow);


  // Hit sphere
  const hitGeo = new THREE.SphereGeometry(CFG.hitRadius, 8, 8);
  const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hitMesh);

  return { group, hitMesh, outerGlow };
}

// 3. Khởi tạo danh sách lồng đèn: Số lượng lồng đèn = số lời chúc (tối thiểu 20 đèn)
const activeLanternWishes = WishStore.getActiveWishes(20);
const initialLanternCount = Math.max(20, activeLanternWishes.length);

for (let i = 0; i < initialLanternCount; i++) {
  const { group: lantern, hitMesh, outerGlow } = createLanternMesh();

  const radius = 9 + Math.random() * 25;
  const angle = Math.random() * Math.PI * 2;
  const y = -1 + Math.random() * 30;
  lantern.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);

  const wishData = activeLanternWishes[i % activeLanternWishes.length];
  lantern.userData = {
    speedY: 0.008 + Math.random() * 0.012,
    swingSpeed: 0.8 + Math.random() * 1.2,
    initialX: lantern.position.x,
    initialZ: lantern.position.z,
    wish: wishData.message,
    from: wishData.from || "Người ẩn danh",
    to: wishData.to || "Tất cả mọi người",
    date: wishData.date || "Rằm Tháng Tám",
    id: i,
    outerGlow,
  };

  const sc = 0.75 + Math.random() * 0.5;
  lantern.scale.set(sc, sc, sc);

  hitMesh.userData.parentLantern = lantern;
  lanternsGroup.add(lantern);
  lanterns.push(lantern);
  interactiveObjects.push(hitMesh);
}

// Hàm sinh thêm lồng đèn mang lời chúc mới bay vào không gian
function spawnFloatingWishLantern(wishItem) {
  const { group: lantern, hitMesh, outerGlow } = createLanternMesh();
  const radius = 8 + Math.random() * 18;
  const angle = Math.random() * Math.PI * 2;
  lantern.position.set(Math.cos(angle) * radius, -2.5, Math.sin(angle) * radius);

  lantern.userData = {
    speedY: 0.012 + Math.random() * 0.010,
    swingSpeed: 0.9 + Math.random() * 0.8,
    initialX: lantern.position.x,
    initialZ: lantern.position.z,
    wish: wishItem.message,
    from: wishItem.from || "Người ẩn danh",
    to: wishItem.to || "Tất cả mọi người",
    date: wishItem.date || "Rằm Tháng Tám",
    id: Date.now() + Math.random(),
    outerGlow,
  };

  const sc = 0.9 + Math.random() * 0.4;
  lantern.scale.set(sc, sc, sc);

  hitMesh.userData.parentLantern = lantern;
  lanternsGroup.add(lantern);
  lanterns.push(lantern);
  interactiveObjects.push(hitMesh);
}
window.spawnFloatingWishLantern = spawnFloatingWishLantern;

// ── 12. CÁ NHÂN HOÁ: LỒNG ĐÈN RIÊNG & CONFETTI ───────────────
function spawnPersonalLantern(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Nền gradient đỏ vàng rực rỡ
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#ff1a40");
  grad.addColorStop(0.5, "#cc0e2e");
  grad.addColorStop(1, "#ffc300");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Viền hoàng kim
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 244, 244);

  // Tên người nhận
  ctx.fillStyle = "#fff8e7";
  ctx.font = "bold 32px 'Dancing Script', cursive, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const words = name.split(" ");
  if (words.length <= 2) {
    ctx.fillText(name, 128, 105);
  } else {
    ctx.fillText(words.slice(0, 2).join(" "), 128, 92);
    ctx.fillText(words.slice(2).join(" "), 128, 132);
  }

  ctx.font = "28px serif";
  ctx.fillText("✦ ĐOÀN VIÊN ✦", 128, 182);

  const customTex = new THREE.CanvasTexture(canvas);

  const { group: pLantern, hitMesh } = createLanternMesh();
  pLantern.children[0].material = new THREE.MeshStandardMaterial({
    map: customTex,
    emissive: 0xff6600,
    emissiveIntensity: 2.0,
    roughness: 0.25,
  });

  // Xuất hiện ngay phía trước tầm nhìn camera
  pLantern.position.set(0, 2.5, 12);
  pLantern.scale.setScalar(1.65);

  pLantern.userData = {
    speedY: 0.015,
    swingSpeed: 0.65,
    initialX: 0,
    initialZ: 12,
    wish: `Gửi tặng ${name} — Chúc bạn một mùa Trung Thu thật ấm áp, viên mãn và tràn ngập niềm vui. Ánh trăng rằm sẽ luôn soi sáng vạn nẻo đường bình an cho bạn! 🌕`,
    imgUrl: "./assets/1.jpg",
    id: 9999,
    isPersonal: true,
  };

  hitMesh.userData.parentLantern = pLantern;
  lanternsGroup.add(pLantern);
  lanterns.push(pLantern);
  interactiveObjects.push(hitMesh);

  // Bùng nổ confetti rực rỡ chào đón
  spawnConfetti(pLantern.position);
}

// ── 13. CÁNH HOA ĐÀO RƠI & HOA ĐĂNG NỔI TRÊN MẶT NƯỚC ────────
// Hệ thống cánh hoa rơi 3D chao lượn trong gió đêm
const petalCount = 240;
const petalGeo = new THREE.BufferGeometry();
const petalPos = new Float32Array(petalCount * 3);
const petalData = [];

for (let i = 0; i < petalCount; i++) {
  petalPos[i * 3]     = (Math.random() - 0.5) * 32;
  petalPos[i * 3 + 1] = 3.0 + Math.random() * 18;
  petalPos[i * 3 + 2] = (Math.random() - 0.5) * 32;

  petalData.push({
    vy: 0.018 + Math.random() * 0.024,
    vx: (Math.random() - 0.5) * 0.012,
    vz: (Math.random() - 0.5) * 0.012,
    swaySpeed: 1.2 + Math.random() * 1.8,
    swayRadius: 0.4 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
  });
}

petalGeo.setAttribute("position", new THREE.BufferAttribute(petalPos, 3));
const petalMat = new THREE.PointsMaterial({
  size: IS_MOBILE ? 0.65 : 0.55,
  map: SHARED_BLOSSOM_TEX,
  transparent: true,
  opacity: 0.88,
  blending: THREE.NormalBlending,
  depthWrite: false,
});
const petalParticles = new THREE.Points(petalGeo, petalMat);
scene.add(petalParticles);

function updateFallingPetals(delta, time) {
  const pArr = petalGeo.attributes.position.array;
  for (let i = 0; i < petalCount; i++) {
    const d = petalData[i];
    pArr[i * 3 + 1] -= d.vy;
    pArr[i * 3]     += d.vx + Math.sin(time * d.swaySpeed + d.phase) * 0.014;
    pArr[i * 3 + 2] += d.vz + Math.cos(time * d.swaySpeed + d.phase) * 0.014;

    // Chạm mặt hồ (y ~ -4.8) -> tái sinh lại trên tán cây
    if (pArr[i * 3 + 1] < -4.8) {
      pArr[i * 3]     = (Math.random() - 0.5) * 22;
      pArr[i * 3 + 1] = 12.0 + Math.random() * 7;
      pArr[i * 3 + 2] = (Math.random() - 0.5) * 22;
    }
  }
  petalGeo.attributes.position.needsUpdate = true;
}

// 8 Hoa Sen Đăng nổi dập dềnh trên mặt hồ quanh đảo
const floatingLotusGroup = new THREE.Group();
scene.add(floatingLotusGroup);

const lotusMat = new THREE.MeshStandardMaterial({
  color: 0xff6699,
  emissive: 0xff2255,
  emissiveIntensity: 0.6,
  roughness: 0.35,
  side: THREE.DoubleSide
});
const lotusCandleMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

const lotusItems = [];
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2 + 0.3;
  const rad = 9.8 + (i % 2) * 2.4;
  const lg = new THREE.Group();
  lg.position.set(Math.cos(angle) * rad, -4.75, Math.sin(angle) * rad);

  // Cánh hoa sen xếp tròn
  for (let p = 0; p < 8; p++) {
    const pa = (p / 8) * Math.PI * 2;
    const petGeo = new THREE.ConeGeometry(0.18, 0.45, 5);
    petGeo.rotateZ(0.65);
    const petMesh = new THREE.Mesh(petGeo, lotusMat);
    petMesh.position.set(Math.cos(pa) * 0.22, 0.08, Math.sin(pa) * 0.22);
    petMesh.rotation.y = -pa;
    lg.add(petMesh);
  }

  // Ngọn nến lung linh ở giữa
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6), lotusCandleMat);
  candle.position.y = 0.12;
  lg.add(candle);

  const candleGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: SHARED_PARTICLE_TEX,
    color: 0xffaa22,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  candleGlow.scale.set(1.2, 1.2, 1);
  candleGlow.position.y = 0.22;
  lg.add(candleGlow);

  floatingLotusGroup.add(lg);
  lotusItems.push({ group: lg, phase: i * 0.7, glow: candleGlow });
}

function updateFloatingLotus(time) {
  lotusItems.forEach((item) => {
    item.group.position.y = -4.75 + Math.sin(time * 1.4 + item.phase) * 0.06;
    item.group.rotation.y = time * 0.1 + item.phase;
    item.glow.material.opacity = 0.6 + Math.sin(time * 4.0 + item.phase) * 0.2;
  });
}

// ── 14. PHÁO HOA & HIỆU ỨNG TƯƠNG TÁC ─────────────────────────
const fireworks = [];

function createFirework(pos) {
  const pCount = IS_MOBILE ? 35 : 55;
  const pGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(pCount * 3);
  const velocities = [];

  for (let i = 0; i < pCount; i++) {
    pPositions[i * 3] = pos.x;
    pPositions[i * 3 + 1] = pos.y;
    pPositions[i * 3 + 2] = pos.z;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 0.08 + Math.random() * 0.12;

    velocities.push(
      new THREE.Vector3(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.sin(phi) * Math.sin(theta),
        speed * Math.cos(phi),
      ),
    );
  }

  pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.36,
    color: 0xffd700,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
  });

  const pMesh = new THREE.Points(pGeo, pMat);
  scene.add(pMesh);
  fireworks.push({ mesh: pMesh, velocities, life: 1.0 });
}

function spawnConfetti(pos) {
  const palette = [0xffd700, 0xff4d6d, 0xff9ebb, 0xffffff, 0xffaa00];
  palette.forEach((col) => {
    const pCount = 20;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(pCount * 3);
    const vels = [];

    for (let i = 0; i < pCount; i++) {
      arr[i * 3] = pos.x;
      arr[i * 3 + 1] = pos.y;
      arr[i * 3 + 2] = pos.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const spd = 0.05 + Math.random() * 0.11;
      vels.push(
        new THREE.Vector3(
          spd * Math.sin(phi) * Math.cos(theta),
          spd * Math.abs(Math.sin(phi) * Math.sin(theta)) + 0.04,
          spd * Math.cos(phi),
        ),
      );
    }

    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.28,
      color: col,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Points(geo, mat);
    scene.add(mesh);
    fireworks.push({ mesh, velocities: vels, life: 1.4 });
  });
}

// Vòng sóng cảm ứng thị giác khi tap lồng đèn
function showTapRing(worldPos) {
  const ringGeo = new THREE.RingGeometry(0.5, 0.75, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(worldPos);
  ring.lookAt(camera.position);
  scene.add(ring);

  const startT = clock.getElapsedTime();
  function animateRing() {
    const elapsed = clock.getElapsedTime() - startT;
    if (elapsed > 0.6) {
      ring.geometry.dispose();
      ring.material.dispose();
      scene.remove(ring);
      return;
    }
    const s = 1.0 + elapsed * 3.5;
    ring.scale.set(s, s, 1);
    ring.material.opacity = 0.9 * (1.0 - elapsed / 0.6);
    requestAnimationFrame(animateRing);
  }
  animateRing();
}

// ── 15. TƯƠNG TÁC RAYCASTER, HỘP THƯ & WISH STORAGE ────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let targetCamPos = null;
let targetCamTarget = null;

// Toast notification
function showToast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    if (t.parentNode) t.parentNode.removeChild(t);
  }, 4200);
}

// Modal Elements
const wishModal = document.getElementById("wishModal");
const wishTitle = document.getElementById("wishTitle");
const wishTag = document.getElementById("wishTag");
const wishToName = document.getElementById("wishToName");
const wishText = document.getElementById("wishText");
const wishFromName = document.getElementById("wishFromName");
const wishDate = document.getElementById("wishDate");
const closeWishBtn = document.getElementById("closeWishBtn");

function openWishCard({ title, tag, to, message, from, date }) {
  if (wishTitle) wishTitle.textContent = title || "Thông Điệp Nguyện Ước";
  if (wishTag) wishTag.textContent = tag || "✦ TRUNG THU AN LÀNH ✦";
  if (wishToName) wishToName.textContent = to || "Tất cả mọi người";
  if (wishText) wishText.textContent = message || "";
  if (wishFromName) wishFromName.textContent = from || "Người ẩn danh";
  if (wishDate) wishDate.textContent = date || "Rằm Tháng Tám";

  wishModal.classList.add("active");
}

function closeWishCard() {
  if (wishModal) wishModal.classList.remove("active");
  resetCamera();
}

if (closeWishBtn) closeWishBtn.addEventListener("click", closeWishCard);
if (wishModal) {
  wishModal.addEventListener("click", (e) => {
    if (e.target === wishModal) closeWishCard();
  });
}

// In-scene Wish Drawer
const wishDrawerOverlay = document.getElementById("wishDrawerOverlay");
const openWishDrawerBtn = document.getElementById("open-wish-drawer-btn");
const closeWishDrawerBtn = document.getElementById("closeWishDrawerBtn");
const sceneSubmitBtn = document.getElementById("scene-submit-btn");

if (openWishDrawerBtn) {
  openWishDrawerBtn.addEventListener("click", () => {
    wishDrawerOverlay.classList.add("active");
  });
}
if (closeWishDrawerBtn) {
  closeWishDrawerBtn.addEventListener("click", () => {
    wishDrawerOverlay.classList.remove("active");
  });
}
if (wishDrawerOverlay) {
  wishDrawerOverlay.addEventListener("click", (e) => {
    if (e.target === wishDrawerOverlay) wishDrawerOverlay.classList.remove("active");
  });
}

// In-scene Inbox Modal
const inboxModalOverlay = document.getElementById("inboxModalOverlay");
const openInboxBtn = document.getElementById("open-inbox-btn");
const closeInboxBtn = document.getElementById("closeInboxBtn");
const inboxList = document.getElementById("inboxList");

function renderInbox() {
  if (!inboxList) return;
  const wishes = WishStore.getAll();
  inboxList.innerHTML = wishes.map((w, idx) => `
    <div class="inbox-item" data-idx="${idx}">
      <div class="inbox-item-header">
        <span class="inbox-item-from">🏮 ${escapeHtml(w.from || "Người gửi")}</span>
        <span class="inbox-item-to">Gửi: ${escapeHtml(w.to || "Tất cả")}</span>
      </div>
      <p class="inbox-item-msg">"${escapeHtml(w.message)}"</p>
    </div>
  `).join("");

  // Bấm vào item để mở thiệp lớn
  inboxList.querySelectorAll(".inbox-item").forEach(item => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.getAttribute("data-idx"), 10);
      const w = wishes[idx];
      if (w) {
        inboxModalOverlay.classList.remove("active");
        openWishCard({
          title: "Lời Chúc Đêm Trăng",
          tag: "✦ HỘP THƯ NGUYỆN ƯỚC ✦",
          to: w.to,
          message: w.message,
          from: w.from,
          date: w.date || "Rằm Tháng Tám"
        });
      }
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

if (openInboxBtn) {
  openInboxBtn.addEventListener("click", () => {
    renderInbox();
    inboxModalOverlay.classList.add("active");
  });
}
if (closeInboxBtn) {
  closeInboxBtn.addEventListener("click", () => {
    inboxModalOverlay.classList.remove("active");
  });
}
if (inboxModalOverlay) {
  inboxModalOverlay.addEventListener("click", (e) => {
    if (e.target === inboxModalOverlay) inboxModalOverlay.classList.remove("active");
  });
}

// Xử lý gửi lời chúc trong Scene Drawer
if (sceneSubmitBtn) {
  sceneSubmitBtn.addEventListener("click", () => {
    const sInput = document.getElementById("scene-sender-name");
    const rInput = document.getElementById("scene-recipient-name");
    const mInput = document.getElementById("scene-wish-message");

    const sName = (sInput && sInput.value ? sInput.value.trim() : "") || "Người ẩn danh";
    const rName = (rInput && rInput.value ? rInput.value.trim() : "") || "Tất cả mọi người";
    const msg   = mInput && mInput.value ? mInput.value.trim() : "";

    if (!msg) {
      alert("Vui lòng nhập lời chúc của bạn trước khi thả đèn!");
      return;
    }

    const newWish = { from: sName, to: rName, message: msg, date: "Rằm Tháng Tám" };
    WishStore.add(newWish);
    window.queueWish(newWish.from, newWish.to, newWish.message, true);

    wishDrawerOverlay.classList.remove("active");
    if (mInput) mInput.value = "";
    const charCounter = document.getElementById("scene-char-count");
    if (charCounter) charCounter.textContent = "0";

    showToast("Nguyện ước của bạn đang được Chú Cuội thắp sáng và thả lên cung trăng ✨");
  });
}

// Character counter in scene drawer
const sceneMsgInput = document.getElementById("scene-wish-message");
if (sceneMsgInput) {
  sceneMsgInput.addEventListener("input", function() {
    const c = document.getElementById("scene-char-count");
    if (c) c.textContent = this.value.length;
  });
}

// Raycasting click
let pointerDownPos = { x: 0, y: 0 };
function onPointerDown(event) {
  pointerDownPos.x = event.clientX || (event.touches && event.touches[0].clientX) || 0;
  pointerDownPos.y = event.clientY || (event.touches && event.touches[0].clientY) || 0;
}

function onPointerUp(event) {
  if (
    event.target.closest(".top-bar") ||
    event.target.closest(".wish-modal") ||
    event.target.closest(".drawer-overlay") ||
    event.target.closest("#intro-screen")
  ) {
    return;
  }

  const clientX = event.clientX || (event.changedTouches && event.changedTouches[0].clientX) || 0;
  const clientY = event.clientY || (event.changedTouches && event.changedTouches[0].clientY) || 0;

  if (Math.hypot(clientX - pointerDownPos.x, clientY - pointerDownPos.y) > 9) return;

  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveObjects, false);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;

    // 1. Chị Hằng Nga
    if (hitMesh.userData.isChange) {
      const wp = new THREE.Vector3();
      changEGroup.getWorldPosition(wp);
      showTapRing(wp);
      createFirework(wp);
      targetCamPos = new THREE.Vector3(wp.x + 2.5, wp.y + 0.6, wp.z + 3.2);
      targetCamTarget = wp.clone().add(new THREE.Vector3(0, 1.2, 0));

      setTimeout(() => {
        openWishCard({
          title: "Lời Chúc Từ Chị Hằng Nga",
          tag: "✦ CUNG TRĂNG HUYỀN ẢO ✦",
          to: "Người bạn hiền",
          message: "Hằng Nga gửi tặng bạn ánh trăng thanh khiết nhất đêm Rằm. Chúc bạn luôn giữ được nụ cười rạng rỡ, tâm hồn an yên tự tại và vạn sự như ý nguyện!",
          from: "Chị Hằng Nga",
          date: "Rằm Tháng Tám"
        });
      }, 300);
      return;
    }

    // 2. Mâm Bánh Trung Thu
    if (hitMesh.userData.isMooncake) {
      const wp = new THREE.Vector3();
      mooncakeTableGroup.getWorldPosition(wp);
      showTapRing(wp);
      createFirework(wp);
      targetCamPos = new THREE.Vector3(wp.x + 2.4, wp.y + 1.2, wp.z + 2.6);
      targetCamTarget = wp.clone().add(new THREE.Vector3(0, 0.4, 0));

      setTimeout(() => {
        openWishCard({
          title: "Mâm Bánh & Trà Thưởng Nguyệt",
          tag: "✦ ĐOÀN VIÊN VIÊN MÃN ✦",
          to: "Mái ấm sum vầy",
          message: "Bánh nướng vàng óng, chén trà sen ấm áp ngát hương. Chúc bạn cùng gia đình một mùa Đoàn Viên sum vầy viên mãn, ngọt ngào và vạn điều như ý!",
          from: "Bếp Đoàn Viên",
          date: "Rằm Tháng Tám"
        });
      }, 300);
      return;
    }

    // 3. Thỏ Ngọc Giã Thuốc
    if (hitMesh.userData.isJadeRabbit) {
      const wp = new THREE.Vector3();
      jadeRabbitGroup.getWorldPosition(wp);
      showTapRing(wp);
      createFirework(wp);
      targetCamPos = new THREE.Vector3(wp.x + 2.0, wp.y + 0.8, wp.z + 2.4);
      targetCamTarget = wp.clone().add(new THREE.Vector3(0, 0.6, 0));

      setTimeout(() => {
        openWishCard({
          title: "Thỏ Ngọc Giã Thuốc Tiên",
          tag: "✦ TIÊN DƯỢC BÌNH AN ✦",
          to: "Bạn thân mến",
          message: "Thỏ Ngọc đang cặm cụi giã từng mẻ thuốc tiên cát tường trên Cung Quảng Hàn. Chúc bạn luôn dồi dào sức khỏe, tràn đầy năng lượng và bình an trong cuộc sống!",
          from: "Thỏ Ngọc",
          date: "Rằm Tháng Tám"
        });
      }, 300);
      return;
    }

    // 4. Chú Cuội
    if (hitMesh.userData.isCuoi) {
      const wp = new THREE.Vector3();
      cuoiGroup.getWorldPosition(wp);
      showTapRing(wp);
      createFirework(wp);
      targetCamPos = new THREE.Vector3(wp.x + 3.2, wp.y + 0.9, wp.z + 3.8);
      targetCamTarget = wp.clone().add(new THREE.Vector3(0, 0.4, 0));

      setTimeout(() => {
        openWishCard({
          title: "Chú Cuội Câu Cá Bên Mép Đảo",
          tag: "✦ HUYỀN THOẠI CUNG TRĂNG ✦",
          to: "Bạn tri kỷ",
          message: "Chú Cuội ngồi bên mép đảo buông cần câu cá dưới trăng rằm, thắp sáng những đốm sao và thả lồng đèn gửi gắm tâm nguyện. Chúc bạn luôn giữ được tâm thái an nhiên, tự tại và vạn sự như ý!",
          from: "Chú Cuội",
          date: "Rằm Tháng Tám"
        });
      }, 300);
      return;
    }

    // 5. Lồng đèn trên bầu trời
    const selLantern = hitMesh.userData.parentLantern || hitMesh.parent;
    if (selLantern && selLantern.userData) {
      const lPos = new THREE.Vector3();
      selLantern.getWorldPosition(lPos);
      showTapRing(lPos);
      createFirework(lPos);

      const offset = new THREE.Vector3().subVectors(camera.position, lPos).normalize().multiplyScalar(5.2);
      targetCamPos = new THREE.Vector3().addVectors(lPos, offset);
      targetCamTarget = lPos.clone();

      setTimeout(() => {
        openWishCard({
          title: "Đèn Lồng Nguyện Ước",
          tag: "✦ LỜI CHÚC ĐÊM TRĂNG ✦",
          to: selLantern.userData.to || "Tất cả mọi người",
          message: selLantern.userData.wish || "Chúc bạn một mùa Trung Thu ấm áp, tràn đầy niềm vui và may mắn!",
          from: selLantern.userData.from || "Người gửi ẩn danh",
          date: "Rằm Tháng Tám"
        });
      }, 300);
    }
  }
}

window.addEventListener("pointerdown", onPointerDown, { passive: true });
window.addEventListener("pointerup", onPointerUp, { passive: true });

function resetCamera() {
  targetCamPos = DEFAULT_CAM_POS.clone();
  targetCamTarget = DEFAULT_CAM_TARGET.clone();
}
window.resetCamera = resetCamera;

const resetCamBtn = document.getElementById("reset-cam-btn");
if (resetCamBtn) resetCamBtn.addEventListener("click", resetCamera);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeWishCard();
    if (wishDrawerOverlay) wishDrawerOverlay.classList.remove("active");
    if (inboxModalOverlay) inboxModalOverlay.classList.remove("active");
  }
});

// ── 16. MÀN HÌNH INTRO & FORM GỬI LỜI CHÚC TRANG CHỦ ───────────
const introScreen = document.getElementById("intro-screen");
const senderInput = document.getElementById("sender-name");
const recipientInput = document.getElementById("recipient-name");
const wishMessageInput = document.getElementById("wish-message");
const charCountSpan = document.getElementById("char-count");
const introSubmitBtn = document.getElementById("intro-submit-btn");
const introSkipBtn = document.getElementById("intro-skip");

const bgm = document.getElementById("bgm");
const audioBtn = document.getElementById("audio-btn");
let isPlaying = false;

// Đếm ký tự
if (wishMessageInput && charCountSpan) {
  wishMessageInput.addEventListener("input", function() {
    charCountSpan.textContent = this.value.length;
  });
}

// Gợi ý lời chúc nhanh
document.querySelectorAll(".quick-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const msg = chip.getAttribute("data-msg");
    if (wishMessageInput && msg) {
      wishMessageInput.value = msg;
      if (charCountSpan) charCountSpan.textContent = msg.length;
    }
  });
});

function playAudioSmoothly() {
  if (isPlaying || !bgm) return;
  bgm.volume = 0;
  bgm.play().then(() => {
    isPlaying = true;
    if (audioBtn) audioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    let vol = 0;
    const fadeIn = setInterval(() => {
      vol = Math.min(vol + 0.05, 0.75);
      bgm.volume = vol;
      if (vol >= 0.75) clearInterval(fadeIn);
    }, 70);
  }).catch(() => {});
}

function launchScene(sender, recipient, message) {
  if (introScreen) {
    introScreen.classList.add("hidden");
    setTimeout(() => {
      if (introScreen && introScreen.parentNode) {
        introScreen.parentNode.removeChild(introScreen);
      }
    }, 850);
  }

  playAudioSmoothly();

  if (message) {
    const sName = (sender || "").trim() || "Người ẩn danh";
    const rName = (recipient || "").trim() || "Tất cả mọi người";
    const wish = { from: sName, to: rName, message, date: "Rằm Tháng Tám" };
    WishStore.add(wish);
    window.queueWish(wish.from, wish.to, wish.message, true);
    spawnPersonalLantern(wish.from);
    showToast("Nguyện ước của bạn đang được Chú Cuội thắp sáng và thả lên cung trăng ✨");
  }
}

if (introSubmitBtn) {
  introSubmitBtn.addEventListener("click", () => {
    const s = senderInput ? senderInput.value.trim() : "";
    const r = recipientInput ? recipientInput.value.trim() : "";
    const m = wishMessageInput ? wishMessageInput.value.trim() : "";
    if (!m) {
      alert("Vui lòng nhập lời chúc của bạn trước khi thắp lồng đèn!");
      return;
    }
    const finalSender = s || "Người ẩn danh";
    const finalRecipient = r || "Tất cả mọi người";
    launchScene(finalSender, finalRecipient, m);
  });
}

if (introSkipBtn) {
  introSkipBtn.addEventListener("click", () => {
    launchScene("", "", "");
  });
}

// Nút Audio thủ công
if (audioBtn) {
  audioBtn.addEventListener("click", () => {
    if (isPlaying) {
      bgm.pause();
      audioBtn.innerHTML = '<i class="fas fa-music" style="opacity:0.5;"></i>';
      isPlaying = false;
    } else {
      bgm.play().then(() => {
        bgm.volume = 0.75;
        audioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        isPlaying = true;
      }).catch(() => {});
    }
  });
}

// ── 17. VÒNG LẶP ANIMATION CHÍNH ──────────────────────────────
let lastFrameTime = 0;
const TARGET_FPS = DEVICE_TIER === "low" ? 30 : 60;
const FRAME_MS = 1000 / TARGET_FPS;

function animate(timestamp = 0) {
  requestAnimationFrame(animate);

  // Frame throttle cho thiết bị yếu để bảo toàn pin
  if (DEVICE_TIER === "low" && timestamp - lastFrameTime < FRAME_MS) return;
  lastFrameTime = timestamp;

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // 1. Cập nhật lồng đèn bay & lắc lư & nhấp nháy
  for (let i = 0; i < lanterns.length; i++) {
    const l = lanterns[i];
    l.position.y += l.userData.speedY;
    l.position.x =
      l.userData.initialX +
      Math.sin(time * l.userData.swingSpeed + l.userData.id) * 0.42;
    l.position.z =
      l.userData.initialZ +
      Math.cos(time * l.userData.swingSpeed + l.userData.id) * 0.42;
    l.rotation.y += 0.004;
    // Glow nhấp nháy nhẹ theo pha riêng
    if (l.userData.outerGlow) {
      const glowPulse = 0.45 + Math.sin(time * 1.8 + l.userData.id * 0.7) * 0.15;
      l.userData.outerGlow.material.opacity = glowPulse;
    }
    if (l.position.y > 32) {
      l.position.y = -3.2;
    }
  }

  // 2. Cánh hoa rơi & hoa đăng đã được cập nhật qua updateFallingPetals & updateFloatingLotus

  // 3. Pháo hoa & giải phóng bộ nhớ (Dispose)
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const fw = fireworks[i];
    fw.life -= delta * 1.25;
    const posArr = fw.mesh.geometry.attributes.position.array;

    for (let j = 0; j < fw.velocities.length; j++) {
      posArr[j * 3] += fw.velocities[j].x;
      posArr[j * 3 + 1] += fw.velocities[j].y;
      posArr[j * 3 + 2] += fw.velocities[j].z;
    }
    fw.mesh.geometry.attributes.position.needsUpdate = true;
    fw.mesh.material.opacity = Math.max(0, fw.life);

    if (fw.life <= 0) {
      fw.mesh.geometry.dispose();
      fw.mesh.material.dispose();
      scene.remove(fw.mesh);
      fireworks.splice(i, 1);
    }
  }

  // 4. Đảo nổi xoay nhẹ
  islandGroup.rotation.y = Math.sin(time * 0.15) * 0.045;

  // 4b. Cây Cổ Thụ, lồng đèn treo & tinh linh đom đóm
  if (typeof updateAncientTree === "function") updateAncientTree(time);

  // 5. Thỏ hoạt cảnh & Thỏ Ngọc giã thuốc tiên
  updateRabbits(time);

  // 5b. Chị Hằng Nga lơ lửng & dải lụa bay
  if (typeof updateChangE === "function") updateChangE(time);

  // 5c. Mâm bánh trung thu & khói trà thơm bốc lên & 2 thỏ làm bánh
  if (typeof updateMooncakeTea === "function") updateMooncakeTea(time);
  if (typeof updateBakeryRabbits === "function") updateBakeryRabbits(time);

  // 4c. Cánh hoa rơi & Hoa đăng nổi mặt hồ
  if (typeof updateFallingPetals === "function") updateFallingPetals(delta, time);
  if (typeof updateFloatingLotus === "function") updateFloatingLotus(time);

  // 5d. Chú Cuội câu đốm sáng và thả đèn nguyện ước (sửa lỗi NaN)
  if (typeof updateCuoi === "function") updateCuoi(delta, time);

  // 6. Mặt trăng & mặt nước
  updateMoon(time);
  if (waterMat) {
    waterMat.uniforms.uTime.value = time;
    waterMat.uniforms.uMoonPos.value.copy(moonMesh.position);
    waterMat.uniforms.uCamPos.value.copy(camera.position);
  }

  // 7. Thiên thạch sao băng
  updateShootingStars(delta, time);

  // 7b. Đom đóm dạ quang mặt hồ vô cực
  if (typeof updateWaterFireflies === "function") updateWaterFireflies(time);

  // 8. Chế độ Cinematic Tour Camera hoặc Di chuyển camera xem lời chúc
  if (isCinematicTour) {
    updateCinematicCamera(delta);
  } else if (targetCamPos && targetCamTarget) {
    camera.position.lerp(targetCamPos, 0.045);
    controls.target.lerp(targetCamTarget, 0.045);

    if (camera.position.distanceTo(targetCamPos) < 0.08) {
      targetCamPos = null;
      targetCamTarget = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

// ── 19. CHẾ ĐỘ THƯỞNG NGOẠN ĐIỆN ẢNH (CINEMATIC TOUR MODE) ────
let isCinematicTour = false;
let cinematicTime = 0;

function toggleCinematicTour() {
  isCinematicTour = !isCinematicTour;
  const btn = document.getElementById("cinematic-btn");
  if (btn) {
    if (isCinematicTour) {
      btn.classList.add("active");
      btn.innerHTML = '<i class="fas fa-times"></i><span>Dừng Ngoạn</span>';
      cinematicTime = 0;
      showToast("🎬 Bắt đầu Chuyến Thưởng Ngoạn Điện Ảnh 360°");

      // Tự động phát nhạc
      playAudioSmoothly();
    } else {
      btn.classList.remove("active");
      btn.innerHTML = '<i class="fas fa-film"></i><span>Thưởng Ngoạn</span>';
      showToast("Đã trở về góc nhìn tự do");
      targetCamPos = DEFAULT_CAM_POS.clone();
      targetCamTarget = DEFAULT_CAM_TARGET.clone();
    }
  }
}

const cinematicBtn = document.getElementById("cinematic-btn");
if (cinematicBtn) {
  cinematicBtn.addEventListener("click", toggleCinematicTour);
}

// Bắt sự kiện thoát cinematic khi người dùng chủ động kéo chuột xoay màn hình
const onUserInteractScene = (e) => {
  if (e.target && (e.target.closest(".top-bar") || e.target.closest(".intro-inner") || e.target.closest(".drawer-card") || e.target.closest(".modal-card") || e.target.closest("#intro-screen"))) {
    return;
  }
  if (isCinematicTour) {
    toggleCinematicTour();
  }
};
window.addEventListener("pointerdown", onUserInteractScene, { passive: true });

function updateCinematicCamera(delta) {
  if (!isCinematicTour) return;

  cinematicTime += delta;

  // 1. Tốc độ xoay chậm rãi quanh tâm đảo
  const angle = cinematicTime * 0.088;

  // 2. Chu kỳ zoom ra / zoom vào siêu êm mượt (Smooth Breathing Zoom Orbit)
  // Chu kỳ ~38 giây: lướt từ cận cảnh 21m (ngắm Cuội, Thỏ làm bánh, Chị Hằng) ra toàn cảnh 43m (ngắm trăng và ngàn hoa đăng)
  const zoomCycle = Math.sin(cinematicTime * 0.165);
  // Hàm làm mượt bậc 3 (Smoothstep) triệt tiêu hoàn toàn cảm giác giật cục khi đảo chiều zoom
  const smoothZoom = zoomCycle * zoomCycle * (3.0 - 2.0 * Math.abs(zoomCycle)) * Math.sign(zoomCycle);

  // Bán kính dao động mượt mà từ 21.0m (cận cảnh) đến 43.0m (toàn cảnh)
  const radius = 32.0 + smoothZoom * 11.0;

  // Độ cao máy bay biến thiên tương ứng: 5.2m khi zoom gần, 11.5m khi zoom xa
  const height = 8.2 + smoothZoom * 3.2 + Math.sin(cinematicTime * 0.07) * 1.2;

  const camX = Math.sin(angle) * radius;
  const camZ = Math.cos(angle) * radius;
  const targetY = 3.6 + smoothZoom * 0.4; // Tâm nhìn neo vững chắc ở đảo

  // Lerp chậm rãi 0.028: triệt tiêu hoàn toàn giật cục, mượt như camera flycam điện ảnh
  camera.position.lerp(new THREE.Vector3(camX, height, camZ), 0.028);
  controls.target.lerp(new THREE.Vector3(0, targetY, 0), 0.028);
}


animate();

// ── 18. XỬ LÝ RESIZE & XOAY MÀN HÌNH (ORIENTATION) ───────────
let resizeTimeout = null;

function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.fov = width < 768 ? 48 : 45;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(CFG.pixelRatio);

    if (IS_MOBILE) {
      controls.target.copy(DEFAULT_CAM_TARGET);
      controls.update();
    }
  }, 140);
}

window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", () => {
  setTimeout(handleResize, 350);
});
