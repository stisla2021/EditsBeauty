// Copyright (c) StISLA2021
export type FacePoint = { x: number; y: number; z?: number };

export type FaceLandmarkSet = {
  eyes: FacePoint[];
  nose: FacePoint[];
  mouth: FacePoint[];
  cheeks: FacePoint[];
  jaw: FacePoint[];
  forehead: FacePoint[];
  all: FacePoint[];
};

export type BeautySettings = {
  smooth: number;
  slim: number;
  jaw: number;
  chin: number;
  eye: number;
  eyeBright: number;
  nose: number;
  lips: number;
  lipTint: number;
  teeth: number;
  foundation: number;
  blush: number;
  contour: number;
  glow: number;
};

type LensCategory = 'beauty' | 'makeup' | 'fun' | 'classic' | 'backgrounds';
type LensBg = 'none' | 'blur' | 'white' | 'sunset';
type LensGrade = 'none' | 'film';

type Lens = {
  id: string;
  name: string;
  category: LensCategory;
  preset: Partial<BeautySettings>;
  blur: number;
  feather: number;
  bg: LensBg;
  grade: LensGrade;
  draw?: (ctx: CanvasRenderingContext2D, face: FaceLandmarkSet, w: number, h: number, time: number, alpha: number) => void;
};

type FaceMeshResults = { multiFaceLandmarks?: FacePoint[][] };
type FaceMeshInstance = {
  setOptions(options: { maxNumFaces: number; refineLandmarks: boolean; minDetectionConfidence: number; minTrackingConfidence: number }): void;
  onResults(handler: (results: FaceMeshResults) => void): void;
  send(input: { image: CanvasImageSource }): Promise<void>;
  close?: () => void;
};
type FaceMeshConstructor = new (options: { locateFile: (file: string) => string }) => FaceMeshInstance;

const MESH_KEY = 'editsbeauty-face-mesh';
const LENS_KEY = 'editsbeauty-camera-lens';
const LOOK_KEY = 'editsbeauty-custom-look';
const STRENGTH_KEY = 'editsbeauty-camera-strength';

const oval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const rightEye = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const lips = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const noseIdx = [1, 2, 4, 5, 6, 19, 94, 98, 327, 168];
const cheekIdx = [50, 101, 205, 187, 280, 330, 425, 411];
const foreheadIdx = [10, 67, 103, 109, 151, 338, 297, 332];

const emptyBeauty = (): BeautySettings => ({
  smooth: 0, slim: 0, jaw: 0, chin: 0, eye: 0, eyeBright: 0, nose: 0, lips: 0, lipTint: 0, teeth: 0, foundation: 0, blush: 0, contour: 0, glow: 0,
});

const pick = (points: FacePoint[], indexes: number[]): FacePoint[] => indexes
  .map((index) => points[index])
  .filter((point): point is FacePoint => !!point)
  .map((point) => ({ x: point.x, y: point.y, z: point.z }));

export const groupLandmarks = (points: FacePoint[]): FaceLandmarkSet | null => {
  if (points.length < 300) return null;
  return {
    eyes: [...pick(points, leftEye), ...pick(points, rightEye)],
    nose: pick(points, noseIdx),
    mouth: pick(points, lips),
    cheeks: pick(points, cheekIdx),
    jaw: pick(points, oval.slice(8, 26)),
    forehead: pick(points, foreheadIdx),
    all: points.map((point) => ({ x: point.x, y: point.y, z: point.z })),
  };
};

const mid = (points: FacePoint[]): FacePoint | null => {
  if (!points.length) return null;
  let x = 0;
  let y = 0;
  points.forEach((point) => {
    x += point.x;
    y += point.y;
  });
  return { x: x / points.length, y: y / points.length };
};

const spread = (points: FacePoint[]): { cx: number; cy: number; rx: number; ry: number } | null => {
  if (!points.length) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: Math.max(0.01, (maxX - minX) / 2), ry: Math.max(0.01, (maxY - minY) / 2) };
};

const splitEyes = (points: FacePoint[]): { left: FacePoint[]; right: FacePoint[] } | null => {
  if (points.length < 8) return null;
  const center = mid(points);
  if (!center) return null;
  const left = points.filter((point) => point.x <= center.x);
  const right = points.filter((point) => point.x > center.x);
  if (left.length < 3 || right.length < 3) return null;
  return { left, right };
};

const readStore = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStore = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The camera still keeps the choice for this visit.
  }
};

const heart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.35);
  ctx.bezierCurveTo(x - size, y - size * 0.35, x - size * 0.2, y - size, x, y - size * 0.35);
  ctx.bezierCurveTo(x + size * 0.2, y - size, x + size, y - size * 0.35, x, y + size * 0.35);
  ctx.fill();
};

const drawGlasses: Lens['draw'] = (ctx, face, w, h, _time, alpha) => {
  const eyes = splitEyes(face.eyes);
  if (!eyes) return;
  const left = spread(eyes.left);
  const right = spread(eyes.right);
  if (!left || !right) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#1c1c1e';
  ctx.fillStyle = 'rgba(180, 220, 255, 0.18)';
  ctx.lineWidth = Math.max(2, w * 0.008);
  [left, right].forEach((eye) => {
    const rw = eye.rx * w * 2.3;
    const rh = eye.ry * h * 2.1;
    ctx.beginPath();
    ctx.rect(eye.cx * w - rw / 2, eye.cy * h - rh / 2, rw, rh);
    ctx.fill();
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo((left.cx + left.rx) * w, left.cy * h);
  ctx.lineTo((right.cx - right.rx) * w, right.cy * h);
  ctx.stroke();
  ctx.restore();
};

const drawCat: Lens['draw'] = (ctx, face, w, h, _time, alpha) => {
  const head = spread(face.forehead.length ? face.forehead : face.all);
  if (!head) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#2b2b2b';
  const y = (head.cy - head.ry * 1.15) * h;
  const leftX = (head.cx - head.rx * 0.85) * w;
  const rightX = (head.cx + head.rx * 0.85) * w;
  const ear = head.rx * w * 0.85;
  ctx.beginPath();
  ctx.moveTo(leftX - ear * 0.2, y + ear);
  ctx.lineTo(leftX + ear * 0.15, y - ear * 0.15);
  ctx.lineTo(leftX + ear * 0.85, y + ear * 0.85);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rightX + ear * 0.2, y + ear);
  ctx.lineTo(rightX - ear * 0.15, y - ear * 0.15);
  ctx.lineTo(rightX - ear * 0.85, y + ear * 0.85);
  ctx.fill();
  ctx.fillStyle = '#ff8fb8';
  ctx.beginPath();
  ctx.moveTo(leftX + ear * 0.1, y + ear * 0.72);
  ctx.lineTo(leftX + ear * 0.22, y + ear * 0.15);
  ctx.lineTo(leftX + ear * 0.55, y + ear * 0.68);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rightX - ear * 0.1, y + ear * 0.72);
  ctx.lineTo(rightX - ear * 0.22, y + ear * 0.15);
  ctx.lineTo(rightX - ear * 0.55, y + ear * 0.68);
  ctx.fill();
  ctx.restore();
};

const drawCrown: Lens['draw'] = (ctx, face, w, h, _time, alpha) => {
  const head = spread(face.forehead.length ? face.forehead : face.all);
  if (!head) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const y = (head.cy - head.ry * 0.2) * h;
  const left = (head.cx - head.rx * 1.05) * w;
  const right = (head.cx + head.rx * 1.05) * w;
  const lift = head.ry * h * 1.35;
  ctx.fillStyle = '#f5c518';
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left + (right - left) * 0.18, y - lift);
  ctx.lineTo(left + (right - left) * 0.38, y - lift * 0.35);
  ctx.lineTo((left + right) / 2, y - lift * 1.15);
  ctx.lineTo(left + (right - left) * 0.62, y - lift * 0.35);
  ctx.lineTo(left + (right - left) * 0.82, y - lift);
  ctx.lineTo(right, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath();
  ctx.arc((left + right) / 2, y - lift * 0.72, Math.max(3, w * 0.012), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawEarrings: Lens['draw'] = (ctx, face, w, h, _time, alpha) => {
  const jaw = spread(face.jaw.length ? face.jaw : face.all);
  if (!jaw) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#f2d27a';
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2;
  [-1, 1].forEach((side) => {
    const x = (jaw.cx + side * jaw.rx * 1.05) * w;
    const y = (jaw.cy + jaw.ry * 0.15) * h;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(4, w * 0.018), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y + w * 0.04, w * 0.012, w * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
};

const drawSparkles: Lens['draw'] = (ctx, face, w, h, time, alpha) => {
  const cheeks = face.cheeks.length ? face.cheeks : face.forehead;
  const box = spread(cheeks.length ? cheeks : face.all);
  if (!box) return;
  ctx.save();
  ctx.fillStyle = '#fff8d6';
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2 + time * 0.001;
    const dist = (0.35 + (i % 4) * 0.18) * (0.75 + 0.25 * Math.sin(time * 0.003 + i));
    const x = (box.cx + Math.cos(angle) * box.rx * dist * 1.8) * w;
    const y = (box.cy + Math.sin(angle) * box.ry * dist * 1.4) * h;
    const size = Math.max(1.5, w * 0.008) * (0.6 + 0.4 * Math.sin(time * 0.008 + i));
    ctx.globalAlpha = alpha * (0.45 + 0.55 * Math.abs(Math.sin(time * 0.006 + i)));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawPuppy: Lens['draw'] = (ctx, face, w, h, _time, alpha) => {
  const nose = mid(face.nose);
  const mouth = spread(face.mouth);
  if (!nose) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1c1c1e';
  ctx.beginPath();
  ctx.ellipse(nose.x * w, nose.y * h, w * 0.045, h * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff6b8a';
  const y = mouth ? (mouth.cy + mouth.ry) * h : nose.y * h + h * 0.04;
  ctx.beginPath();
  ctx.ellipse(nose.x * w, y, w * 0.03, h * 0.028, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();
};

const drawHearts: Lens['draw'] = (ctx, face, w, h, _time, alpha) => {
  const eyes = splitEyes(face.eyes);
  if (!eyes) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ff3b5c';
  [eyes.left, eyes.right].forEach((group) => {
    const center = mid(group);
    const sizeBox = spread(group);
    if (!center || !sizeBox) return;
    heart(ctx, center.x * w, center.y * h, Math.max(10, sizeBox.rx * w * 2.4));
  });
  ctx.restore();
};

const starterLenses: Lens[] = [
  { id: 'original', name: 'Original', category: 'classic', preset: {}, blur: 0, feather: 40, bg: 'none', grade: 'none' },
  { id: 'soft', name: 'Soft', category: 'beauty', preset: { smooth: 58, foundation: 34, glow: 26, eyeBright: 12 }, blur: 0, feather: 40, bg: 'none', grade: 'none' },
  { id: 'glow', name: 'Glow', category: 'beauty', preset: { smooth: 36, glow: 74, eyeBright: 28, foundation: 16 }, blur: 0, feather: 40, bg: 'none', grade: 'none' },
  { id: 'blush', name: 'Blush', category: 'makeup', preset: { blush: 72, lipTint: 58, lips: 18, smooth: 22 }, blur: 0, feather: 40, bg: 'none', grade: 'none' },
  { id: 'contour', name: 'Contour', category: 'makeup', preset: { contour: 70, slim: 16, jaw: 12, foundation: 20 }, blur: 0, feather: 40, bg: 'none', grade: 'none' },
  { id: 'glasses', name: 'Glasses', category: 'fun', preset: { eyeBright: 10 }, blur: 0, feather: 40, bg: 'none', grade: 'none', draw: drawGlasses },
  { id: 'cat', name: 'Cat', category: 'fun', preset: {}, blur: 0, feather: 40, bg: 'none', grade: 'none', draw: drawCat },
  { id: 'crown', name: 'Crown', category: 'fun', preset: {}, blur: 0, feather: 40, bg: 'none', grade: 'none', draw: drawCrown },
  { id: 'earrings', name: 'Earrings', category: 'fun', preset: {}, blur: 0, feather: 40, bg: 'none', grade: 'none', draw: drawEarrings },
  { id: 'sparkle', name: 'Sparkle', category: 'fun', preset: { glow: 18 }, blur: 0, feather: 40, bg: 'none', grade: 'none', draw: drawSparkles },
  { id: 'puppy', name: 'Puppy', category: 'fun', preset: {}, blur: 0, feather: 40, bg: 'none', grade: 'none', draw: drawPuppy },
  { id: 'hearts', name: 'Hearts', category: 'fun', preset: {}, blur: 0, feather: 40, bg: 'none', grade: 'none', draw: drawHearts },
  { id: 'film', name: 'Film', category: 'classic', preset: { smooth: 12 }, blur: 0, feather: 40, bg: 'none', grade: 'film' },
  { id: 'portrait', name: 'Portrait', category: 'backgrounds', preset: { smooth: 32, glow: 20, foundation: 18, eyeBright: 10 }, blur: 62, feather: 42, bg: 'blur', grade: 'none' },
  { id: 'white', name: 'White', category: 'backgrounds', preset: { smooth: 20, foundation: 12 }, blur: 0, feather: 36, bg: 'white', grade: 'none' },
  { id: 'sunset', name: 'Sunset', category: 'backgrounds', preset: { glow: 16 }, blur: 0, feather: 36, bg: 'sunset', grade: 'none' },
];

const categories: { id: LensCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'fun', label: 'Fun' },
  { id: 'classic', label: 'Classic' },
  { id: 'backgrounds', label: 'Backgrounds' },
];

const sliderFields: { key: keyof BeautySettings | 'blur' | 'feather'; label: string }[] = [
  { key: 'smooth', label: 'Skin smooth' },
  { key: 'slim', label: 'Slim face' },
  { key: 'jaw', label: 'V-shape jaw' },
  { key: 'chin', label: 'Chin' },
  { key: 'eye', label: 'Eye enlarge' },
  { key: 'eyeBright', label: 'Eye brighten' },
  { key: 'nose', label: 'Nose slim' },
  { key: 'lips', label: 'Lips plump' },
  { key: 'lipTint', label: 'Lip color' },
  { key: 'teeth', label: 'Teeth' },
  { key: 'foundation', label: 'Foundation' },
  { key: 'blush', label: 'Blush' },
  { key: 'contour', label: 'Contour & highlight' },
  { key: 'glow', label: 'Soft glow' },
  { key: 'blur', label: 'Portrait blur' },
  { key: 'feather', label: 'Edge feather' },
];

let video: HTMLVideoElement | null = null;
let facing: 'user' | 'environment' = 'user';
let running = false;
let raf = 0;
let showMesh = readStore(MESH_KEY) === 'on';
let lite = false;
let preferFull = false;
let lowStreak = 0;
let previewFrames = 0;
let previewStamp = 0;
let previewFps = 0;
let meshFrames = 0;
let meshStamp = 0;
let meshFps = 0;
let meshBusy = false;
let meshFailed = false;
let meshReady = false;
let faceMesh: FaceMeshInstance | null = null;
let liveFace: FaceLandmarkSet | null = null;
let stillFace: FaceLandmarkSet | null = null;
let category: LensCategory | 'all' = 'all';
let lensId = 'portrait';
let beauty = emptyBeauty();
let blur = 62;
let feather = 42;
let bg: LensBg = 'blur';
let grade: LensGrade = 'none';
let strength = 100;
let thumbStamp = 0;
let webglOk = false;

const source = document.createElement('canvas');
const meshInput = document.createElement('canvas');
const stage = document.createElement('canvas');
const glCanvas = document.createElement('canvas');
const sourceCtx = source.getContext('2d', { willReadFrequently: false });
const stageCtx = stage.getContext('2d', { alpha: false });
let gl: WebGLRenderingContext | null = null;
let warpProgram: WebGLProgram | null = null;
let blurProgram: WebGLProgram | null = null;
let compositeProgram: WebGLProgram | null = null;
let gridBuffer: WebGLBuffer | null = null;
let gridIndex: WebGLBuffer | null = null;
let quadBuffer: WebGLBuffer | null = null;
let gridCount = 0;
let sourceTex: WebGLTexture | null = null;
let warpTex: WebGLTexture | null = null;
let blurTex: WebGLTexture | null = null;
let tmpTex: WebGLTexture | null = null;
let warpFbo: WebGLFramebuffer | null = null;
let blurFbo: WebGLFramebuffer | null = null;
let tmpFbo: WebGLFramebuffer | null = null;
let recordStream: MediaStream | null = null;

const customLens = (): Lens | null => {
  const raw = readStore(LOOK_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { beauty?: Partial<BeautySettings>; blur?: number; feather?: number; bg?: LensBg; grade?: LensGrade; drawId?: string };
    const draw = starterLenses.find((lens) => lens.id === saved.drawId)?.draw;
    return {
      id: 'mine',
      name: 'My look',
      category: 'beauty',
      preset: saved.beauty ?? {},
      blur: saved.blur ?? 0,
      feather: saved.feather ?? 40,
      bg: saved.bg ?? 'none',
      grade: saved.grade ?? 'none',
      draw,
    };
  } catch {
    return null;
  }
};

const lensById = (id: string): Lens | undefined => {
  if (id === 'mine') return customLens() ?? undefined;
  return starterLenses.find((lens) => lens.id === id);
};

const activeDraw = (): Lens['draw'] | undefined => lensById(lensId)?.draw;

const phoneDevice = (): boolean => window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;

const processingCap = (): number => {
  const cores = navigator.hardwareConcurrency ?? 8;
  if (lite) return 480;
  if (phoneDevice() && cores <= 4) return 540;
  if (phoneDevice()) return 640;
  return 960;
};

let sizedVideo = 0;

const resizeToVideo = (): void => {
  if (!video || !video.videoWidth || !sourceCtx || !stageCtx) return;
  const cap = processingCap();
  const signature = video.videoWidth * 100000 + video.videoHeight * 10 + cap;
  if (signature === sizedVideo && source.width > 0) return;
  sizedVideo = signature;
  const scale = Math.min(1, cap / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(2, Math.round(video.videoWidth * scale));
  const height = Math.max(2, Math.round(video.videoHeight * scale));
  if (source.width === width && source.height === height) return;
  source.width = width;
  source.height = height;
  stage.width = width;
  stage.height = height;
  glCanvas.width = width;
  glCanvas.height = height;
  const meshScale = Math.min(1, 320 / width);
  meshInput.width = Math.max(2, Math.round(width * meshScale));
  meshInput.height = Math.max(2, Math.round(height * meshScale));
  allocTargets();
};

const blitSource = (): void => {
  if (!video || !sourceCtx || !source.width) return;
  sourceCtx.save();
  sourceCtx.clearRect(0, 0, source.width, source.height);
  if (facing === 'user') {
    sourceCtx.translate(source.width, 0);
    sourceCtx.scale(-1, 1);
  }
  sourceCtx.drawImage(video, 0, 0, source.width, source.height);
  sourceCtx.restore();
};

const warpVertex = `
attribute vec2 aUv;
uniform vec2 uFaceC;
uniform vec2 uFaceR;
uniform vec2 uEyeL;
uniform vec2 uEyeR;
uniform float uEyeRad;
uniform vec2 uNose;
uniform float uNoseRad;
uniform vec2 uMouth;
uniform float uMouthRad;
uniform float uSlim;
uniform float uJaw;
uniform float uChin;
uniform float uEye;
uniform float uNoseAmt;
uniform float uLips;
varying vec2 vUv;
float ell(vec2 p, vec2 c, vec2 r) {
  vec2 d = (p - c) / max(r, vec2(0.001));
  return clamp(1.0 - dot(d, d), 0.0, 1.0);
}
float blob(vec2 p, vec2 c, float rad) {
  float d = distance(p, c) / max(rad, 0.001);
  return clamp(1.0 - d * d, 0.0, 1.0);
}
vec2 pushOut(vec2 p, vec2 c, float rad, float amt) {
  vec2 d = p - c;
  float w = blob(p, c, rad);
  return p + normalize(d + vec2(0.0001, 0.0001)) * amt * w * rad * 0.55;
}
void main() {
  vec2 p = aUv;
  float face = ell(p, uFaceC, uFaceR);
  float side = abs(p.x - uFaceC.x) / max(uFaceR.x, 0.001);
  float lower = smoothstep(uFaceC.y - uFaceR.y * 0.05, uFaceC.y + uFaceR.y, p.y);
  p.x = mix(p.x, uFaceC.x, uSlim * face * side * 0.18);
  p.x = mix(p.x, uFaceC.x, uJaw * face * lower * side * 0.22);
  float chinW = exp(-pow((p.x - uFaceC.x) / max(uFaceR.x * 0.28, 0.001), 2.0)) * lower * face;
  p.y += uChin * chinW * uFaceR.y * 0.16;
  p = pushOut(p, uEyeL, uEyeRad, uEye);
  p = pushOut(p, uEyeR, uEyeRad, uEye);
  float noseW = blob(p, uNose, uNoseRad);
  p.x = mix(p.x, uNose.x, uNoseAmt * noseW * 0.45);
  p = pushOut(p, uMouth, uMouthRad, uLips);
  float border = step(0.002, aUv.x) * step(aUv.x, 0.998) * step(0.002, aUv.y) * step(aUv.y, 0.998);
  p = mix(aUv, p, border);
  vUv = aUv;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`;

const warpFragment = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  gl_FragColor = texture2D(uTex, vUv);
}`;

const blurFragment = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb * 0.227027;
  c += texture2D(uTex, vUv + uDir).rgb * 0.1945946;
  c += texture2D(uTex, vUv - uDir).rgb * 0.1945946;
  c += texture2D(uTex, vUv + uDir * 2.0).rgb * 0.1216216;
  c += texture2D(uTex, vUv - uDir * 2.0).rgb * 0.1216216;
  c += texture2D(uTex, vUv + uDir * 3.0).rgb * 0.054054;
  c += texture2D(uTex, vUv - uDir * 3.0).rgb * 0.054054;
  gl_FragColor = vec4(c, 1.0);
}`;

const quadVertex = `
attribute vec2 aUv;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aUv.x * 2.0 - 1.0, 1.0 - aUv.y * 2.0, 0.0, 1.0);
}`;

const compositeFragment = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSharp;
uniform sampler2D uSoft;
uniform vec2 uFaceC;
uniform vec2 uFaceR;
uniform vec2 uCheekL;
uniform vec2 uCheekR;
uniform float uCheekRad;
uniform vec2 uEyeL;
uniform vec2 uEyeR;
uniform float uEyeRad;
uniform vec2 uMouth;
uniform float uMouthRad;
uniform float uSmooth;
uniform float uGlow;
uniform float uFoundation;
uniform float uBlush;
uniform float uContour;
uniform float uEyeBright;
uniform float uTeeth;
uniform float uLip;
uniform float uOutside;
uniform float uFeather;
uniform float uBgMode;
uniform float uGrade;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float ell(vec2 p, vec2 c, vec2 r) {
  vec2 d = (p - c) / max(r, vec2(0.0008));
  return clamp(1.0 - dot(d, d), 0.0, 1.0);
}
float blob(vec2 p, vec2 c, float r) {
  float d = distance(p, c) / max(r, 0.0008);
  return clamp(1.0 - d * d, 0.0, 1.0);
}
void main() {
  vec2 uv = vUv;
  vec3 sharp = texture2D(uSharp, uv).rgb;
  vec3 soft = texture2D(uSoft, uv).rgb;
  float head = ell(uv, uFaceC, uFaceR * vec2(1.15, 1.45));
  float body = ell(uv, uFaceC + vec2(0.0, uFaceR.y * 0.95), uFaceR * vec2(2.15, 1.55));
  float person = max(head, body);
  float edge = smoothstep(0.0, 0.22 + uFeather * 0.45, person);
  vec3 outside = soft;
  if (uBgMode > 2.5) outside = mix(vec3(1.0, 0.45, 0.25), vec3(0.42, 0.22, 0.78), uv.y);
  else if (uBgMode > 1.5) outside = vec3(0.96, 0.96, 0.95);
  vec3 color = mix(mix(sharp, outside, uOutside), sharp, edge);
  float skinTone = smoothstep(0.08, 0.28, sharp.r - sharp.b) * smoothstep(0.0, 0.18, sharp.r - sharp.g);
  float skin = skinTone * ell(uv, uFaceC, uFaceR * vec2(1.05, 1.2));
  float detail = abs(luma(sharp) - luma(soft));
  float keep = smoothstep(0.015, 0.14, detail);
  vec3 smoothed = mix(soft, sharp, keep);
  color = mix(color, smoothed, uSmooth * max(skin, head * 0.65));
  float y = luma(color);
  vec3 found = mix(color, vec3(0.95, 0.78, 0.68) * (0.55 + y), 0.5);
  color = mix(color, found, uFoundation * skin);
  float blush = blob(uv, uCheekL, uCheekRad) + blob(uv, uCheekR, uCheekRad);
  color = mix(color, color * vec3(1.18, 0.7, 0.78) + vec3(0.05, 0.0, 0.02), clamp(uBlush * blush, 0.0, 1.0));
  float jawSide = ell(uv, uFaceC + vec2(uFaceR.x * 0.55, uFaceR.y * 0.35), uFaceR * vec2(0.45, 0.7));
  jawSide += ell(uv, uFaceC - vec2(uFaceR.x * 0.55, -uFaceR.y * 0.35), uFaceR * vec2(0.45, 0.7));
  float highlight = blob(uv, uFaceC - vec2(0.0, uFaceR.y * 0.55), uFaceR.y * 0.55);
  highlight += blob(uv, uFaceC, uFaceR.x * 0.22);
  color *= mix(1.0, 0.78, clamp(uContour * jawSide, 0.0, 0.65));
  color += vec3(0.16, 0.14, 0.1) * uContour * highlight;
  float glow = uGlow * (0.35 + 0.65 * smoothstep(0.45, 0.9, luma(soft)));
  color = 1.0 - (1.0 - color) * (1.0 - soft * glow);
  float eye = blob(uv, uEyeL, uEyeRad) + blob(uv, uEyeR, uEyeRad);
  color = mix(color, color * (1.0 + 0.35 * uEyeBright) + vec3(0.03), clamp(eye * uEyeBright, 0.0, 1.0));
  float mouth = blob(uv, uMouth, uMouthRad);
  float teeth = blob(uv, uMouth, uMouthRad * 0.55) * smoothstep(0.45, 0.75, luma(sharp));
  color = mix(color, vec3(min(1.0, y + 0.25), min(1.0, y + 0.22), min(1.0, y + 0.18)), clamp(uTeeth * teeth, 0.0, 1.0));
  float lipRing = smoothstep(0.15, 0.55, mouth) * (1.0 - teeth);
  color = mix(color, color * vec3(1.15, 0.55, 0.62) + vec3(0.08, 0.0, 0.02), clamp(uLip * lipRing, 0.0, 1.0));
  if (uGrade > 0.5) {
    color = (color - 0.5) * 1.12 + 0.5;
    color = mix(vec3(0.08, 0.05, 0.04), color, 0.92);
  }
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

const compile = (context: WebGLRenderingContext, type: number, sourceCode: string): WebGLShader | null => {
  const shader = context.createShader(type);
  if (!shader) return null;
  context.shaderSource(shader, sourceCode);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    console.warn(context.getShaderInfoLog(shader));
    context.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = (context: WebGLRenderingContext, vertex: string, fragment: string): WebGLProgram | null => {
  const vs = compile(context, context.VERTEX_SHADER, vertex);
  const fs = compile(context, context.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = context.createProgram();
  if (!program) return null;
  context.attachShader(program, vs);
  context.attachShader(program, fs);
  context.bindAttribLocation(program, 0, 'aUv');
  context.linkProgram(program);
  context.deleteShader(vs);
  context.deleteShader(fs);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    console.warn(context.getProgramInfoLog(program));
    context.deleteProgram(program);
    return null;
  }
  return program;
};

const makeTex = (context: WebGLRenderingContext): WebGLTexture | null => {
  const texture = context.createTexture();
  if (!texture) return null;
  context.bindTexture(context.TEXTURE_2D, texture);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  return texture;
};

const attach = (context: WebGLRenderingContext, texture: WebGLTexture | null, width: number, height: number): WebGLFramebuffer | null => {
  if (!texture) return null;
  context.bindTexture(context.TEXTURE_2D, texture);
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, width, height, 0, context.RGBA, context.UNSIGNED_BYTE, null);
  const buffer = context.createFramebuffer();
  context.bindFramebuffer(context.FRAMEBUFFER, buffer);
  context.framebufferTexture2D(context.FRAMEBUFFER, context.COLOR_ATTACHMENT0, context.TEXTURE_2D, texture, 0);
  return buffer;
};

const allocTargets = (): void => {
  if (!gl || !source.width) return;
  warpFbo = attach(gl, warpTex, source.width, source.height);
  blurFbo = attach(gl, blurTex, source.width, source.height);
  tmpFbo = attach(gl, tmpTex, source.width, source.height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

const buildGrid = (context: WebGLRenderingContext): void => {
  const cols = 24;
  const rows = 36;
  const uv = new Float32Array(cols * rows * 2);
  let offset = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      uv[offset] = x / (cols - 1);
      uv[offset + 1] = y / (rows - 1);
      offset += 2;
    }
  }
  const index = new Uint16Array((cols - 1) * (rows - 1) * 6);
  let t = 0;
  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < cols - 1; x += 1) {
      const i = y * cols + x;
      index[t] = i;
      index[t + 1] = i + 1;
      index[t + 2] = i + cols;
      index[t + 3] = i + 1;
      index[t + 4] = i + cols + 1;
      index[t + 5] = i + cols;
      t += 6;
    }
  }
  gridCount = index.length;
  gridBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, gridBuffer);
  context.bufferData(context.ARRAY_BUFFER, uv, context.STATIC_DRAW);
  gridIndex = context.createBuffer();
  context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, gridIndex);
  context.bufferData(context.ELEMENT_ARRAY_BUFFER, index, context.STATIC_DRAW);
  quadBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, quadBuffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), context.STATIC_DRAW);
};

const bootGl = (): void => {
  gl = glCanvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) {
    webglOk = false;
    return;
  }
  warpProgram = link(gl, warpVertex, warpFragment);
  blurProgram = link(gl, quadVertex, blurFragment);
  compositeProgram = link(gl, quadVertex, compositeFragment);
  if (!warpProgram || !blurProgram || !compositeProgram) {
    webglOk = false;
    return;
  }
  sourceTex = makeTex(gl);
  warpTex = makeTex(gl);
  blurTex = makeTex(gl);
  tmpTex = makeTex(gl);
  buildGrid(gl);
  webglOk = true;
};

const uniform = (program: WebGLProgram, name: string): WebGLUniformLocation | null => gl?.getUniformLocation(program, name) ?? null;

const faceUniforms = (): {
  faceC: number[];
  faceR: number[];
  eyeL: number[];
  eyeR: number[];
  eyeRad: number;
  nose: number[];
  noseRad: number;
  mouth: number[];
  mouthRad: number;
  cheekL: number[];
  cheekR: number[];
  cheekRad: number;
} => {
  const face = liveFace;
  const box = face ? spread(face.jaw.length ? face.jaw.concat(face.forehead) : face.all) : null;
  const eyes = face ? splitEyes(face.eyes) : null;
  const left = eyes ? mid(eyes.left) : null;
  const right = eyes ? mid(eyes.right) : null;
  const nose = face ? mid(face.nose) : null;
  const mouth = face ? mid(face.mouth) : null;
  const cheeks = face ? splitEyes(face.cheeks) : null;
  const cheekL = cheeks ? mid(cheeks.left) : null;
  const cheekR = cheeks ? mid(cheeks.right) : null;
  return {
    faceC: box ? [box.cx, box.cy] : [0.5, 0.46],
    faceR: box ? [box.rx, box.ry] : [0.18, 0.24],
    eyeL: left ? [left.x, left.y] : [0.38, 0.42],
    eyeR: right ? [right.x, right.y] : [0.62, 0.42],
    eyeRad: eyes ? Math.max(0.03, (spread(eyes.left)?.rx ?? 0.04) * 1.6) : 0.05,
    nose: nose ? [nose.x, nose.y] : [0.5, 0.5],
    noseRad: 0.06,
    mouth: mouth ? [mouth.x, mouth.y] : [0.5, 0.62],
    mouthRad: face ? Math.max(0.04, (spread(face.mouth)?.rx ?? 0.05) * 1.3) : 0.06,
    cheekL: cheekL ? [cheekL.x, cheekL.y] : [0.36, 0.54],
    cheekR: cheekR ? [cheekR.x, cheekR.y] : [0.64, 0.54],
    cheekRad: 0.07,
  };
};

const reshapeOn = (): boolean => !lite && !!liveFace && (beauty.slim + beauty.jaw + beauty.chin + beauty.eye + beauty.nose + beauty.lips) > 0;

const drawQuad = (context: WebGLRenderingContext): void => {
  context.bindBuffer(context.ARRAY_BUFFER, quadBuffer);
  context.enableVertexAttribArray(0);
  context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
};

const renderGl = (): void => {
  if (!gl || !webglOk || !warpProgram || !blurProgram || !compositeProgram || !sourceTex || !source.width) return;
  const context = gl;
  const geo = faceUniforms();
  const amount = (value: number): number => value / 100;
  context.bindTexture(context.TEXTURE_2D, sourceTex);
  context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, source);
  const doWarp = reshapeOn() && !!warpFbo && !!warpTex;
  if (doWarp && warpFbo) {
    context.bindFramebuffer(context.FRAMEBUFFER, warpFbo);
    context.viewport(0, 0, source.width, source.height);
    context.useProgram(warpProgram);
    context.bindBuffer(context.ARRAY_BUFFER, gridBuffer);
    context.enableVertexAttribArray(0);
    context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
    context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, gridIndex);
    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, sourceTex);
    context.uniform1i(uniform(warpProgram, 'uTex'), 0);
    context.uniform2f(uniform(warpProgram, 'uFaceC'), geo.faceC[0], geo.faceC[1]);
    context.uniform2f(uniform(warpProgram, 'uFaceR'), geo.faceR[0], geo.faceR[1]);
    context.uniform2f(uniform(warpProgram, 'uEyeL'), geo.eyeL[0], geo.eyeL[1]);
    context.uniform2f(uniform(warpProgram, 'uEyeR'), geo.eyeR[0], geo.eyeR[1]);
    context.uniform1f(uniform(warpProgram, 'uEyeRad'), geo.eyeRad);
    context.uniform2f(uniform(warpProgram, 'uNose'), geo.nose[0], geo.nose[1]);
    context.uniform1f(uniform(warpProgram, 'uNoseRad'), geo.noseRad);
    context.uniform2f(uniform(warpProgram, 'uMouth'), geo.mouth[0], geo.mouth[1]);
    context.uniform1f(uniform(warpProgram, 'uMouthRad'), geo.mouthRad);
    context.uniform1f(uniform(warpProgram, 'uSlim'), amount(beauty.slim));
    context.uniform1f(uniform(warpProgram, 'uJaw'), amount(beauty.jaw));
    context.uniform1f(uniform(warpProgram, 'uChin'), amount(beauty.chin));
    context.uniform1f(uniform(warpProgram, 'uEye'), amount(beauty.eye));
    context.uniform1f(uniform(warpProgram, 'uNoseAmt'), amount(beauty.nose));
    context.uniform1f(uniform(warpProgram, 'uLips'), amount(beauty.lips));
    context.drawElements(context.TRIANGLES, gridCount, context.UNSIGNED_SHORT, 0);
  }
  const colorWork = beauty.smooth + beauty.glow + beauty.foundation + beauty.blush + beauty.contour + beauty.eyeBright + beauty.teeth + beauty.lipTint;
  const needsSoft = blur > 0 || bg !== 'none' || grade === 'film' || colorWork > 0;
  const passes = !needsSoft ? 0 : lite ? 1 : blur > 35 || beauty.smooth > 40 || beauty.glow > 40 ? 2 : 1;
  const sharpTex: WebGLTexture = doWarp && warpTex ? warpTex : sourceTex;
  let readTex: WebGLTexture = sharpTex;
  for (let pass = 0; pass < passes; pass += 1) {
    context.useProgram(blurProgram);
    context.bindBuffer(context.ARRAY_BUFFER, quadBuffer);
    context.enableVertexAttribArray(0);
    context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, readTex);
    context.uniform1i(uniform(blurProgram, 'uTex'), 0);
    context.bindFramebuffer(context.FRAMEBUFFER, tmpFbo);
    context.viewport(0, 0, source.width, source.height);
    context.uniform2f(uniform(blurProgram, 'uDir'), 1 / source.width, 0);
    drawQuad(context);
    context.bindTexture(context.TEXTURE_2D, tmpTex);
    context.bindFramebuffer(context.FRAMEBUFFER, blurFbo);
    context.uniform2f(uniform(blurProgram, 'uDir'), 0, 1 / source.height);
    drawQuad(context);
    readTex = blurTex ?? readTex;
  }
  context.bindFramebuffer(context.FRAMEBUFFER, null);
  context.viewport(0, 0, glCanvas.width, glCanvas.height);
  context.useProgram(compositeProgram);
  context.bindBuffer(context.ARRAY_BUFFER, quadBuffer);
  context.enableVertexAttribArray(0);
  context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
  context.activeTexture(context.TEXTURE0);
  context.bindTexture(context.TEXTURE_2D, sharpTex);
  context.uniform1i(uniform(compositeProgram, 'uSharp'), 0);
  context.activeTexture(context.TEXTURE1);
  context.bindTexture(context.TEXTURE_2D, passes > 0 && blurTex ? blurTex : sharpTex);
  context.uniform1i(uniform(compositeProgram, 'uSoft'), 1);
  context.uniform2f(uniform(compositeProgram, 'uFaceC'), geo.faceC[0], geo.faceC[1]);
  context.uniform2f(uniform(compositeProgram, 'uFaceR'), geo.faceR[0], geo.faceR[1]);
  context.uniform2f(uniform(compositeProgram, 'uCheekL'), geo.cheekL[0], geo.cheekL[1]);
  context.uniform2f(uniform(compositeProgram, 'uCheekR'), geo.cheekR[0], geo.cheekR[1]);
  context.uniform1f(uniform(compositeProgram, 'uCheekRad'), geo.cheekRad);
  context.uniform2f(uniform(compositeProgram, 'uEyeL'), geo.eyeL[0], geo.eyeL[1]);
  context.uniform2f(uniform(compositeProgram, 'uEyeR'), geo.eyeR[0], geo.eyeR[1]);
  context.uniform1f(uniform(compositeProgram, 'uEyeRad'), geo.eyeRad);
  context.uniform2f(uniform(compositeProgram, 'uMouth'), geo.mouth[0], geo.mouth[1]);
  context.uniform1f(uniform(compositeProgram, 'uMouthRad'), geo.mouthRad);
  context.uniform1f(uniform(compositeProgram, 'uSmooth'), amount(beauty.smooth));
  context.uniform1f(uniform(compositeProgram, 'uGlow'), amount(beauty.glow));
  context.uniform1f(uniform(compositeProgram, 'uFoundation'), amount(beauty.foundation));
  context.uniform1f(uniform(compositeProgram, 'uBlush'), amount(beauty.blush));
  context.uniform1f(uniform(compositeProgram, 'uContour'), amount(beauty.contour));
  context.uniform1f(uniform(compositeProgram, 'uEyeBright'), amount(beauty.eyeBright));
  context.uniform1f(uniform(compositeProgram, 'uTeeth'), amount(beauty.teeth));
  context.uniform1f(uniform(compositeProgram, 'uLip'), amount(beauty.lipTint));
  const outside = bg === 'none' ? 0 : bg === 'blur' ? amount(blur) : 1;
  context.uniform1f(uniform(compositeProgram, 'uOutside'), outside);
  context.uniform1f(uniform(compositeProgram, 'uFeather'), amount(feather));
  context.uniform1f(uniform(compositeProgram, 'uBgMode'), bg === 'sunset' ? 3 : bg === 'white' ? 2 : bg === 'blur' ? 1 : 0);
  context.uniform1f(uniform(compositeProgram, 'uGrade'), grade === 'film' ? 1 : 0);
  drawQuad(context);
  if (reshapeOn() && warpTex) {
    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, warpTex);
  }
};

const tinyCanvas = document.createElement('canvas');
const tinyCtx = tinyCanvas.getContext('2d', { alpha: false });

const drawFallback = (): void => {
  if (!stageCtx || !source.width || !tinyCtx) return;
  stageCtx.drawImage(source, 0, 0);
  if (bg === 'none' && beauty.smooth <= 0) return;
  const tiny = Math.max(8, Math.round(source.width / 10));
  tinyCanvas.width = tiny;
  tinyCanvas.height = Math.max(8, Math.round(source.height / 10));
  tinyCtx.drawImage(source, 0, 0, tinyCanvas.width, tinyCanvas.height);
  const geo = faceUniforms();
  stageCtx.save();
  stageCtx.drawImage(tinyCanvas, 0, 0, stage.width, stage.height);
  stageCtx.globalCompositeOperation = 'destination-out';
  stageCtx.beginPath();
  stageCtx.ellipse(geo.faceC[0] * stage.width, geo.faceC[1] * stage.height, geo.faceR[0] * stage.width * 1.4, geo.faceR[1] * stage.height * 1.8, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();
  stageCtx.save();
  stageCtx.beginPath();
  stageCtx.ellipse(geo.faceC[0] * stage.width, geo.faceC[1] * stage.height, geo.faceR[0] * stage.width * 1.4, geo.faceR[1] * stage.height * 1.8, 0, 0, Math.PI * 2);
  stageCtx.clip();
  stageCtx.drawImage(source, 0, 0);
  stageCtx.restore();
};

const paintStage = (time: number): void => {
  if (!stageCtx) return;
  if (webglOk) {
    renderGl();
    stageCtx.drawImage(glCanvas, 0, 0, stage.width, stage.height);
  } else {
    drawFallback();
  }
  if (liveFace && !lite) activeDraw()?.(stageCtx, liveFace, stage.width, stage.height, time, strength / 100);
  if (showMesh && liveFace) drawMesh(stageCtx, liveFace);
};

const drawMesh = (ctx: CanvasRenderingContext2D, face: FaceLandmarkSet): void => {
  const line = (indexes: number[]): void => {
    ctx.beginPath();
    indexes.forEach((index, order) => {
      const point = face.all[index];
      if (!point) return;
      const x = point.x * ctx.canvas.width;
      const y = point.y * ctx.canvas.height;
      if (order === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  };
  ctx.save();
  ctx.strokeStyle = 'rgba(190, 220, 255, 0.55)';
  ctx.lineWidth = 1;
  line(oval);
  line(leftEye);
  line(rightEye);
  line(lips);
  const nose = mid(face.nose);
  if (nose) {
    ctx.beginPath();
    oval.forEach((index, order) => {
      if (order % 2) return;
      const point = face.all[index];
      if (!point) return;
      ctx.moveTo(nose.x * ctx.canvas.width, nose.y * ctx.canvas.height);
      ctx.lineTo(point.x * ctx.canvas.width, point.y * ctx.canvas.height);
    });
    ctx.stroke();
  }
  ctx.restore();
};

let meshCtx: CanvasRenderingContext2D | null = null;
let lastMeshSent = 0;
let lastFrameCost = 0;
let slowFrames = 0;

const loop = (time: number): void => {
  if (!running) return;
  raf = window.requestAnimationFrame(loop);
  const started = performance.now();
  resizeToVideo();
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !source.width) return;
  blitSource();
  const meshGap = lite ? 100 : 34;
  if (started - lastMeshSent >= meshGap && lastFrameCost < 48) {
    lastMeshSent = started;
    sendMesh();
  }
  paintStage(time);
  lastFrameCost = performance.now() - started;
  meter(time, lastFrameCost);
  if (time - thumbStamp > 140) {
    thumbStamp = time;
    paintNextThumb();
  }
};

const sendMesh = (): void => {
  if (!faceMesh || meshBusy || meshFailed || !source.width || !running) return;
  if (!meshCtx) meshCtx = meshInput.getContext('2d', { alpha: false });
  if (!meshCtx) return;
  meshCtx.drawImage(source, 0, 0, meshInput.width, meshInput.height);
  meshBusy = true;
  faceMesh.send({ image: meshInput }).catch(() => {
    meshFailed = true;
    meshReady = false;
    faceMesh = null;
  }).finally(() => {
    meshBusy = false;
  });
};

const meter = (time: number, cost: number): void => {
  previewFrames += 1;
  if (!previewStamp) previewStamp = time;
  if (cost > 40) slowFrames += 1;
  else slowFrames = Math.max(0, slowFrames - 1);
  if (!lite && slowFrames >= (preferFull ? 18 : 8)) {
    lite = true;
    sizedVideo = 0;
    slowFrames = 0;
    const full = document.getElementById('cameraLite');
    if (full) full.textContent = 'Lite mode on';
  }
  if (time - previewStamp >= 500) {
    previewFps = Math.round((previewFrames * 1000) / (time - previewStamp));
    previewFrames = 0;
    previewStamp = time;
    if (previewFps < 20) lowStreak += 1;
    else lowStreak = 0;
    if (!lite && !preferFull && lowStreak >= 2) {
      lite = true;
      sizedVideo = 0;
    }
    writeHint();
  }
};

const writeHint = (): void => {
  const hint = document.getElementById('cameraHint');
  if (!hint) return;
  const meshNote = meshFailed ? 'Face mesh unavailable. Color beauty still runs.' : meshReady ? `Mesh ${meshFps} fps` : 'Finding a face…';
  const modeNote = lite ? 'Lite mode' : webglOk ? 'WebGL' : 'Basic';
  hint.textContent = `${modeNote} · Preview ${previewFps} fps · ${meshNote}`;
};

let meshScript: Promise<boolean> | null = null;
let meshBooting = false;

export const ensureFaceMeshScript = (): Promise<boolean> => {
  if ((window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh) return Promise.resolve(true);
  if (meshScript) return meshScript;
  meshScript = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(Boolean((window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh));
    script.onerror = () => {
      meshScript = null;
      resolve(false);
    };
    document.head.append(script);
  });
  return meshScript;
};

const bootMesh = (): void => {
  if (faceMesh || meshFailed || meshBooting) return;
  meshBooting = true;
  void ensureFaceMeshScript().then((ready) => {
    meshBooting = false;
    if (!running) return;
    if (!ready) {
      meshFailed = true;
      writeHint();
      return;
    }
    createFaceMesh();
  });
};

const createFaceMesh = (): void => {
  if (faceMesh || meshFailed) return;
  const FaceMesh = (window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh;
  if (!FaceMesh) {
    meshFailed = true;
    writeHint();
    return;
  }
  try {
    const created = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    const desktop = !phoneDevice() && (navigator.hardwareConcurrency ?? 4) >= 8;
    created.setOptions({
      maxNumFaces: 1,
      refineLandmarks: desktop,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    created.onResults((results) => {
      if (!running) return;
      const raw = results.multiFaceLandmarks?.[0] ?? null;
      liveFace = raw ? groupLandmarks(raw) : null;
      meshReady = true;
      meshFrames += 1;
      const now = performance.now();
      if (!meshStamp) meshStamp = now;
      if (now - meshStamp >= 1000) {
        meshFps = Math.round((meshFrames * 1000) / (now - meshStamp));
        meshFrames = 0;
        meshStamp = now;
      }
    });
    faceMesh = created;
  } catch {
    meshFailed = true;
    meshReady = false;
    writeHint();
  }
};

let rememberTimer = 0;

const rememberLens = (): void => {
  window.clearTimeout(rememberTimer);
  rememberTimer = window.setTimeout(() => {
    writeStore(LENS_KEY, lensId);
    const savedStrength = readStrengthMap();
    savedStrength[lensId] = strength;
    writeStore(STRENGTH_KEY, JSON.stringify(savedStrength));
  }, 180);
};

const applyLens = (id: string, nextStrength = strength, refreshSliders = true): void => {
  const lens = lensById(id) ?? starterLenses[0];
  lensId = lens.id;
  strength = Math.max(0, Math.min(100, Math.round(nextStrength)));
  const scale = strength / 100;
  beauty = emptyBeauty();
  (Object.keys(lens.preset) as (keyof BeautySettings)[]).forEach((key) => {
    const value = lens.preset[key];
    if (typeof value === 'number' && key in beauty) beauty[key] = Math.round(value * scale);
  });
  blur = Math.round(lens.blur * scale);
  feather = lens.feather;
  bg = lens.bg;
  grade = lens.grade;
  syncTray();
  if (refreshSliders) syncSliders();
  rememberLens();
};

const readStrengthMap = (): Record<string, number> => {
  const raw = readStore(STRENGTH_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const visibleLenses = (): Lens[] => {
  const custom = customLens();
  const list = starterLenses.filter((lens) => lens.id === 'original' || category === 'all' || lens.category === category);
  if (custom && (category === 'all' || category === 'beauty')) list.splice(1, 0, custom);
  return list;
};

const syncTray = (): void => {
  document.querySelectorAll<HTMLButtonElement>('[data-lens]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.lens === lensId));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-lens-cat]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.lensCat === category));
  });
  const meshButton = document.getElementById('cameraMesh');
  if (meshButton) meshButton.setAttribute('aria-pressed', String(showMesh));
};

const syncSliders = (): void => {
  sliderFields.forEach((field) => {
    const input = document.getElementById(`live${field.key}`) as HTMLInputElement | null;
    if (!input) return;
    if (field.key === 'blur') input.value = String(blur);
    else if (field.key === 'feather') input.value = String(feather);
    else input.value = String(beauty[field.key]);
  });
  const strengthInput = document.getElementById('liveStrength') as HTMLInputElement | null;
  if (strengthInput) strengthInput.value = String(strength);
};

let thumbIndex = 0;

const paintThumb = (button: HTMLButtonElement): void => {
    const canvas = button.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    const lens = lensById(button.dataset.lens ?? '');
    if (!canvas || !ctx || !lens) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const selected = button.dataset.lens === lensId;
    const picture = selected && stage.width ? stage : source;
    if (picture.width) ctx.drawImage(picture, 0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = '#2a2a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#d7b39a';
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height * 0.46, canvas.width * 0.22, canvas.height * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!selected) {
      if (lens.preset.blush) {
        ctx.fillStyle = 'rgba(255, 99, 132, 0.28)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (lens.preset.smooth || lens.preset.glow) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (liveFace) lens.draw?.(ctx, liveFace, canvas.width, canvas.height, performance.now(), 1);
  }
};

const paintNextThumb = (): void => {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-lens]');
  if (!buttons.length) return;
  const selected = thumbIndex % 3 === 0 ? [...buttons].find((button) => button.dataset.lens === lensId) : undefined;
  paintThumb(selected ?? buttons[thumbIndex % buttons.length]);
  thumbIndex += 1;
};

const paintThumbs = (): void => {
  document.querySelectorAll<HTMLButtonElement>('[data-lens]').forEach((button) => paintThumb(button));
};

const buildTray = (): void => {
  const cats = document.getElementById('cameraCats');
  const row = document.getElementById('cameraFilters');
  if (!cats || !row) return;
  cats.replaceChildren();
  categories.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lensCat = item.id;
    button.textContent = item.label;
    button.setAttribute('aria-pressed', String(item.id === category));
    button.addEventListener('click', () => {
      category = item.id;
      buildTray();
    });
    cats.append(button);
  });
  row.replaceChildren();
  visibleLenses().forEach((lens) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lens-chip';
    button.dataset.lens = lens.id;
    button.setAttribute('aria-pressed', String(lens.id === lensId));
    button.setAttribute('aria-label', lens.name);
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 72;
    const label = document.createElement('span');
    label.textContent = lens.name;
    button.append(canvas, label);
    let hold = 0;
    let moved = false;
    let startX = 0;
    let startY = 0;
    button.addEventListener('pointerdown', (event) => {
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      hold = window.setTimeout(() => {
        applyLens(lens.id, readStrengthMap()[lens.id] ?? strength);
        openTune();
      }, 420);
    });
    button.addEventListener('pointermove', (event) => {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 12) {
        moved = true;
        window.clearTimeout(hold);
      }
    });
    button.addEventListener('pointerup', () => {
      window.clearTimeout(hold);
      if (!moved) applyLens(lens.id, readStrengthMap()[lens.id] ?? 100);
    });
    button.addEventListener('pointercancel', () => window.clearTimeout(hold));
    row.append(button);
  });
  paintThumbs();
};

const openTune = (): void => {
  const tune = document.getElementById('cameraTune');
  if (tune) tune.hidden = false;
  syncSliders();
};

const saveLook = (): void => {
  const lens = lensById(lensId);
  writeStore(LOOK_KEY, JSON.stringify({
    beauty,
    blur,
    feather,
    bg,
    grade,
    drawId: lens?.draw ? lens.id : '',
  }));
  lensId = 'mine';
  writeStore(LENS_KEY, 'mine');
  buildTray();
  const hint = document.getElementById('cameraHint');
  if (hint) hint.textContent = 'Saved My look on this device.';
};

const buildTune = (): void => {
  const tune = document.getElementById('cameraTune');
  if (!tune) return;
  tune.replaceChildren();
  const bar = document.createElement('div');
  bar.className = 'camera-tune-bar';
  const title = document.createElement('strong');
  title.textContent = 'Tune';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click', () => {
    tune.hidden = true;
  });
  bar.append(title, close);
  tune.append(bar);
  const strengthLabel = document.createElement('label');
  strengthLabel.textContent = 'Strength';
  const strengthInput = document.createElement('input');
  strengthInput.type = 'range';
  strengthInput.id = 'liveStrength';
  strengthInput.min = '0';
  strengthInput.max = '100';
  strengthInput.value = String(strength);
  strengthInput.addEventListener('input', () => {
    applyLens(lensId, Number(strengthInput.value), false);
  });
  strengthLabel.append(strengthInput);
  tune.append(strengthLabel);
  sliderFields.forEach((field) => {
    const label = document.createElement('label');
    label.textContent = field.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `live${field.key}`;
    input.min = '0';
    input.max = '100';
    input.value = '0';
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (field.key === 'blur') {
        blur = value;
        if (value > 0 && bg === 'none') bg = 'blur';
        if (value === 0 && bg === 'blur') bg = 'none';
      } else if (field.key === 'feather') feather = value;
      else beauty[field.key] = value;
    });
    label.append(input);
    tune.append(label);
  });
  const actions = document.createElement('div');
  actions.className = 'camera-tune-actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Save look';
  save.addEventListener('click', saveLook);
  const full = document.createElement('button');
  full.type = 'button';
  full.id = 'cameraLite';
  full.textContent = 'Full quality';
  full.addEventListener('click', () => {
    lite = !lite;
    preferFull = !lite;
    lowStreak = 0;
    full.textContent = lite ? 'Lite mode on' : 'Full quality';
    resizeToVideo();
  });
  actions.append(save, full);
  tune.append(actions);
};

const mount = (): void => {
  const view = document.getElementById('cameraView');
  const host = document.getElementById('cameraStage');
  if (host instanceof HTMLCanvasElement) {
    stage.width = host.width;
    stage.height = host.height;
    host.replaceWith(stage);
  } else if (view && !view.querySelector('canvas.camera-stage')) {
    view.prepend(stage);
  }
  stage.className = 'camera-stage';
  stage.id = 'cameraStage';
  const saved = readStore(LENS_KEY);
  const initial = saved && lensById(saved) ? saved : 'portrait';
  const remembered = readStrengthMap()[initial] ?? 100;
  buildTune();
  applyLens(initial, remembered);
  buildTray();
  bootGl();
  document.getElementById('cameraMesh')?.addEventListener('click', () => {
    showMesh = !showMesh;
    writeStore(MESH_KEY, showMesh ? 'on' : 'off');
    syncTray();
  });
  document.getElementById('cameraTuneOpen')?.addEventListener('click', openTune);
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) {
      stopLivePreview();
      return;
    }
    releaseCamera();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === MESH_KEY) {
      showMesh = event.newValue === 'on';
      syncTray();
    }
  });
};

export const currentLandmarks = (): FaceLandmarkSet | null => (running && liveFace ? liveFace : stillFace);

export const publishStillLandmarks = (points: FacePoint[] | null): void => {
  stillFace = points ? groupLandmarks(points) : null;
};

export const startLivePreview = (nextVideo: HTMLVideoElement, nextFacing: 'user' | 'environment'): void => {
  video = nextVideo;
  facing = nextFacing;
  running = true;
  previewStamp = 0;
  previewFrames = 0;
  if (!meshFailed) bootMesh();
  if (!webglOk && !gl) bootGl();
  window.cancelAnimationFrame(raf);
  raf = window.requestAnimationFrame(loop);
};

export const stopLivePreview = (): void => {
  running = false;
  window.cancelAnimationFrame(raf);
  liveFace = null;
  meshBusy = false;
  faceMesh?.close?.();
  faceMesh = null;
  meshReady = false;
  recordStream?.getAudioTracks().forEach((track) => recordStream?.removeTrack(track));
};

const releaseCamera = (): void => {
  stopLivePreview();
  const lose = gl?.getExtension('WEBGL_lose_context');
  lose?.loseContext();
  gl = null;
  webglOk = false;
  warpProgram = null;
  blurProgram = null;
  compositeProgram = null;
};

export const liveStill = (): string | null => {
  if (!running || stage.width < 2) return null;
  try {
    return stage.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
};

export const liveRecordStream = (audioFrom: MediaStream | null): MediaStream | null => {
  if (!running || stage.width < 2 || !stage.captureStream) return null;
  if (!recordStream) recordStream = stage.captureStream(30);
  recordStream.getAudioTracks().forEach((track) => recordStream?.removeTrack(track));
  const audio = audioFrom?.getAudioTracks()[0];
  if (audio) {
    try {
      recordStream.addTrack(audio);
    } catch {
      // The picture is still recorded when the mic track cannot be shared.
    }
  }
  return recordStream;
};

export const liveEffectsActive = (): boolean => running && (lensId !== 'original' || Object.values(beauty).some((value) => value > 0) || blur > 0 || bg !== 'none');

export const renderBeautyTest = (): { webgl: boolean; fps: number; lenses: number; originalFirst: boolean; corner: number[]; face: number[] } => {
  const sample = document.createElement('canvas');
  sample.width = 360;
  sample.height = 480;
  const ctx = sample.getContext('2d');
  if (!ctx) return { webgl: webglOk, fps: 0, lenses: starterLenses.length, originalFirst: starterLenses[0]?.id === 'original', corner: [], face: [] };
  ctx.fillStyle = '#6ea8ff';
  ctx.fillRect(0, 0, sample.width, sample.height);
  ctx.fillStyle = '#e7b89a';
  ctx.beginPath();
  ctx.ellipse(180, 210, 90, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(145, 180, 22, 10);
  ctx.fillRect(195, 180, 22, 10);
  if (!webglOk) bootGl();
  source.width = sample.width;
  source.height = sample.height;
  stage.width = sample.width;
  stage.height = sample.height;
  glCanvas.width = sample.width;
  glCanvas.height = sample.height;
  allocTargets();
  sourceCtx?.drawImage(sample, 0, 0);
  const before = lensId;
  const beforeStrength = strength;
  applyLens('white', 100);
  const started = performance.now();
  for (let i = 0; i < 20; i += 1) paintStage(started + i * 16);
  gl?.finish();
  const fps = Math.round((20 * 1000) / Math.max(1, performance.now() - started));
  const read = stageCtx?.getImageData(4, 4, 1, 1).data;
  const face = stageCtx?.getImageData(180, 210, 1, 1).data;
  applyLens(before, beforeStrength);
  return {
    webgl: webglOk,
    fps,
    lenses: starterLenses.length,
    originalFirst: starterLenses[0]?.id === 'original',
    corner: read ? [read[0], read[1], read[2]] : [],
    face: face ? [face[0], face[1], face[2]] : [],
  };
};

const faceApi = {
  landmarks: currentLandmarks,
  groupLandmarks,
  available: () => meshReady && !meshFailed,
  failed: () => meshFailed,
  renderTest: renderBeautyTest,
};

window.editsBeautyFace = faceApi;

declare global {
  interface Window {
    editsBeautyFace?: typeof faceApi;
  }
}

if (document.getElementById('cameraView')) mount();
