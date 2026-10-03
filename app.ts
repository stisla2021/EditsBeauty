// Copyright (c) StISLA2021
import { ensureFaceMeshScript, liveEffectsActive, liveRecordStream, liveStill, publishStillLandmarks, startLivePreview, stopLivePreview } from './camera-live';
import { noteEdit, noteGuide, noteTool } from './usage';

type FacePoint = { x: number; y: number; z?: number };
type FaceMeshResults = { multiFaceLandmarks?: FacePoint[][] };
type FaceMeshInstance = {
  setOptions(options: { maxNumFaces: number; refineLandmarks: boolean; minDetectionConfidence: number; minTrackingConfidence: number }): void;
  onResults(handler: (results: FaceMeshResults) => void): void;
  send(input: { image: HTMLImageElement }): Promise<void>;
  close?: () => void;
};
type FaceMeshConstructor = new (options: { locateFile: (file: string) => string }) => FaceMeshInstance;
type MaskSource = CanvasImageSource & { width: number; height: number };
type SegmentationResults = { segmentationMask?: MaskSource };
type SelfieSegmentationInstance = {
  setOptions(options: { modelSelection: number; selfieMode?: boolean }): void;
  onResults(handler: (results: SegmentationResults) => void): void;
  send(input: { image: CanvasImageSource }): Promise<void>;
  close?: () => void;
};
type SelfieSegmentationConstructor = new (options: { locateFile: (file: string) => string }) => SelfieSegmentationInstance;
type SceneKind = 'photo' | 'color' | 'gradient' | 'blank' | 'blur';
type SceneSpec = { label: string; kind: SceneKind; url?: string; color?: string; from?: string; to?: string };

const byId = <T extends HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

const upload = byId<HTMLInputElement>('upload');
const canvas = byId<HTMLCanvasElement>('canvas');
const editorPanel = byId<HTMLElement>('editor');
const context = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
const smoothSlider = byId<HTMLInputElement>('smooth');
const teethSlider = byId<HTMLInputElement>('teeth');
const noseSlider = byId<HTMLInputElement>('nose');
const smoothValue = byId<HTMLOutputElement>('smoothVal');
const teethValue = byId<HTMLOutputElement>('teethVal');
const noseValue = byId<HTMLOutputElement>('noseVal');
const retouchScreen = byId<HTMLElement>('retouchScreen');
const narrowScreen = byId<HTMLElement>('narrowScreen');
const retouchStage = byId<HTMLElement>('retouchStage');
const narrowStage = byId<HTMLElement>('narrowStage');
const brushRing = byId<HTMLElement>('brushRing');
const brushChip = byId<HTMLElement>('brushChip');
const noseLandmarks = document.getElementById('noseLandmarks') as SVGSVGElement | null;
let pendingPortrait: 'retouch' | 'narrow' | null = null;
let pendingCrop = false;
let portraitSnapshot = { smooth: '0', nose: '0' };
let portraitGuides: { points: Array<{ x: number; y: number }> | null; cx: number; cy: number; rx: number; ry: number } = {
  points: null,
  cx: 0.5,
  cy: 0.53,
  rx: 0.085,
  ry: 0.14,
};
const emptyState = byId<HTMLDivElement>('emptyState');
const toolsSheet = byId<HTMLElement>('toolsSheet');
const backdrop = byId<HTMLDivElement>('sheetBackdrop');
const downloadButton = byId<HTMLButtonElement>('downloadBtn');
const gridStudio = byId<HTMLElement>('gridStudio');
const gridCanvas = byId<HTMLCanvasElement>('gridCanvas');
const gridContext = gridCanvas?.getContext('2d') ?? null;
const gridUpload = byId<HTMLInputElement>('gridUpload');
const gridLayout = byId<HTMLSelectElement>('gridLayout');
const gridRatio = byId<HTMLSelectElement>('gridRatio');
const gridTileShape = byId<HTMLSelectElement>('gridTileShape');
const gridGap = byId<HTMLInputElement>('gridGap');
const gridGapValue = byId<HTMLOutputElement>('gridGapValue');
const gridBackground = byId<HTMLInputElement>('gridBackground');
const gridStatus = byId<HTMLParagraphElement>('gridStatus');
const saveGridButton = byId<HTMLButtonElement>('saveGrid');
const creativeControls = byId<HTMLDivElement>('creativeControls');
const faceDetectionStatus = byId<HTMLParagraphElement>('faceDetectionStatus');
const aiEnhanceButton = byId<HTMLButtonElement>('aiEnhance');
const photoFilter = byId<HTMLSelectElement>('photoFilter');
const enhanceSlider = byId<HTMLInputElement>('enhance');
const photoRatio = byId<HTMLSelectElement>('photoRatio');
const bodyTuneSlider = byId<HTMLInputElement>('bodyTune');
const faceVolumeSlider = byId<HTMLInputElement>('faceVolume');
const hairTint = byId<HTMLInputElement>('hairTint');
const hairStrength = byId<HTMLInputElement>('hairStrength');
const cutoutColor = byId<HTMLInputElement>('cutoutColor');
const cutoutTolerance = byId<HTMLInputElement>('cutoutTolerance');
const editBackground = byId<HTMLInputElement>('editBackground');
const backgroundStatus = byId<HTMLParagraphElement>('backgroundStatus');
const aiLoading = byId<HTMLParagraphElement>('aiLoading');
const overlayText = byId<HTMLInputElement>('overlayText');
const stickerChoice = byId<HTMLElement>('stickerChoice');
const brushColor = byId<HTMLInputElement>('brushColor');
const brushSize = byId<HTMLInputElement>('brushSize');
const timestampToggle = byId<HTMLInputElement>('timestampToggle');
const batchUpload = byId<HTMLInputElement>('batchUpload');
const batchStatus = byId<HTMLParagraphElement>('batchStatus');
const batchExportButton = byId<HTMLButtonElement>('batchExport');
const videoStudio = byId<HTMLElement>('videoStudio');
const videoUpload = byId<HTMLInputElement>('videoUpload');
const videoPreview = byId<HTMLVideoElement>('videoPreview');
const videoCanvas = byId<HTMLCanvasElement>('videoCanvas');
const videoFilter = byId<HTMLSelectElement>('videoFilter');
const videoStatus = byId<HTMLParagraphElement>('videoStatus');
const videoScreenshotButton = byId<HTMLButtonElement>('videoScreenshot');
const startVideoExportButton = byId<HTMLButtonElement>('startVideoExport');
const stopVideoExportButton = byId<HTMLButtonElement>('stopVideoExport');
const phoneDevice = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
const maxDimension = phoneDevice ? 1080 : 1800;
let aiLoadingToken = 0;
let aiLoadingTimer = 0;
let originalImage: HTMLImageElement | null = null;
let imageUrl: string | null = null;
let faceMeshLandmarks: FacePoint[] | null = null;
let teethPixels = 0;
let imageGeneration = 0;
let activeBackgroundScene: BackgroundScene | null = null;
let personMask: HTMLCanvasElement | null = null;
let maskPromise: Promise<HTMLCanvasElement | null> | null = null;
let maskPromiseGeneration = -1;
let aiEnhanceEnabled = false;
let videoUrl: string | null = null;
let videoRecorder: MediaRecorder | null = null;
let videoChunks: Blob[] = [];
let videoAnimationFrame = 0;
let gridImages: HTMLImageElement[] = [];
let gridImageUrls: string[] = [];
let toastTimer = 0;
type BrushStroke = { color: string; size: number; mode: 'paint' | 'heal'; points: Array<{ x: number; y: number }> };
let brushEnabled = false;
let brushMode: BrushStroke['mode'] = 'paint';
let currentBrush: BrushStroke | null = null;
const brushStrokes: BrushStroke[] = [];
const textOverlays: string[] = [];
type PlacedSticker = {
  id: number;
  kind: 'emoji' | 'word' | 'mark';
  glyph: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  tone: string;
};
const stickerOverlays: PlacedSticker[] = [];
let stickerSerial = 1;
let selectedStickerId = 0;

const showAiLoading = (): number => {
  const token = aiLoadingToken + 1;
  aiLoadingToken = token;
  window.clearTimeout(aiLoadingTimer);
  if (aiLoading) aiLoading.hidden = false;
  if (backgroundStatus) backgroundStatus.textContent = 'AI Loading...';
  return token;
};

const hideAiLoading = (token: number): void => {
  if (token !== aiLoadingToken) return;
  window.clearTimeout(aiLoadingTimer);
  if (aiLoading) aiLoading.hidden = true;
};

const offlinePill = byId<HTMLParagraphElement>('offlinePill');
const syncOfflinePill = (): void => {
  if (!offlinePill) return;
  offlinePill.hidden = false;
  const online = navigator.onLine;
  offlinePill.textContent = online ? 'Online' : 'Offline. Filters, Adjust, crop, and the camera still work.';
  offlinePill.classList.toggle('is-online', online);
  offlinePill.classList.toggle('is-offline', !online);
};
syncOfflinePill();
window.addEventListener('online', syncOfflinePill);
window.addEventListener('offline', syncOfflinePill);

const showToast = (message: string): void => {
  let toast = document.querySelector<HTMLDivElement>('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast?.remove(), 2800);
};

const copyShareLink = async (shareUrl: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('Link copied. Send it to share EditsBeauty.');
  } catch {
    showToast(shareUrl);
  }
};

byId<HTMLButtonElement>('shareApp')?.addEventListener('click', () => {
  document.getElementById('navLinks')?.classList.remove('active');
  document.getElementById('hamburger')?.setAttribute('aria-expanded', 'false');
  const shareUrl = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? 'https://editsbeauty.vercel.app/'
    : new URL('./', window.location.href).href;
  const payload = { title: 'EditsBeauty', text: 'Edit photos in your browser with EditsBeauty.', url: shareUrl };
  if (navigator.share) {
    void navigator.share(payload).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      void copyShareLink(shareUrl);
    });
    return;
  }
  void copyShareLink(shareUrl);
});

function composeCanvasFilters(...filters: string[]): string {
  const activeFilters = filters.filter((filter) => filter && filter !== 'none');
  return activeFilters.length ? activeFilters.join(' ') : 'none';
}

const blurHorizontal = (input: Float32Array, output: Float32Array, width: number, height: number, radius: number): void => {
  const span = radius * 2 + 1;
  const scale = 1 / span;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 3;
    let red = 0;
    let green = 0;
    let blue = 0;
    const first = row;
    const last = row + (width - 1) * 3;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sample = offset < 0 ? first : offset >= width ? last : row + offset * 3;
      red += input[sample];
      green += input[sample + 1];
      blue += input[sample + 2];
    }
    for (let x = 0; x < width; x += 1) {
      const index = row + x * 3;
      output[index] = red * scale;
      output[index + 1] = green * scale;
      output[index + 2] = blue * scale;
      const add = x + radius + 1 < width ? row + (x + radius + 1) * 3 : last;
      const remove = x - radius >= 0 ? row + (x - radius) * 3 : first;
      red += input[add] - input[remove];
      green += input[add + 1] - input[remove + 1];
      blue += input[add + 2] - input[remove + 2];
    }
  }
};

const blurVertical = (input: Float32Array, output: Float32Array, width: number, height: number, radius: number): void => {
  const span = radius * 2 + 1;
  const scale = 1 / span;
  for (let x = 0; x < width; x += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;
    const column = x * 3;
    const stride = width * 3;
    const first = column;
    const last = column + (height - 1) * stride;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sample = offset < 0 ? first : offset >= height ? last : column + offset * stride;
      red += input[sample];
      green += input[sample + 1];
      blue += input[sample + 2];
    }
    for (let y = 0; y < height; y += 1) {
      const index = column + y * stride;
      output[index] = red * scale;
      output[index + 1] = green * scale;
      output[index + 2] = blue * scale;
      const add = y + radius + 1 < height ? column + (y + radius + 1) * stride : last;
      const remove = y - radius >= 0 ? column + (y - radius) * stride : first;
      red += input[add] - input[remove];
      green += input[add + 1] - input[remove + 1];
      blue += input[add + 2] - input[remove + 2];
    }
  }
};

const boxBlur = (data: Uint8ClampedArray, width: number, height: number, radius: number): void => {
  const amount = Math.max(1, Math.round(radius));
  const src = new Float32Array(width * height * 3);
  const tmp = new Float32Array(src.length);
  for (let pixel = 0, index = 0; pixel < data.length; pixel += 4, index += 3) {
    src[index] = data[pixel];
    src[index + 1] = data[pixel + 1];
    src[index + 2] = data[pixel + 2];
  }
  blurHorizontal(src, tmp, width, height, amount);
  blurVertical(tmp, src, width, height, amount);
  for (let pixel = 0, index = 0; pixel < data.length; pixel += 4, index += 3) {
    data[pixel] = src[index];
    data[pixel + 1] = src[index + 1];
    data[pixel + 2] = src[index + 2];
  }
};

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const applyFilterChain = (data: Uint8ClampedArray, filter: string): void => {
  const steps = filter.match(/[a-z-]+\([^)]+\)/g) ?? [];
  for (const step of steps) {
    const splitAt = step.indexOf('(');
    const name = step.slice(0, splitAt);
    const amount = Number.parseFloat(step.slice(splitAt + 1));
    if (!Number.isFinite(amount) || name === 'blur') continue;
    for (let index = 0; index < data.length; index += 4) {
      let red = data[index];
      let green = data[index + 1];
      let blue = data[index + 2];
      if (name === 'grayscale') {
        const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        red += (luma - red) * amount;
        green += (luma - green) * amount;
        blue += (luma - blue) * amount;
      } else if (name === 'sepia') {
        const sepiaRed = red * 0.393 + green * 0.769 + blue * 0.189;
        const sepiaGreen = red * 0.349 + green * 0.686 + blue * 0.168;
        const sepiaBlue = red * 0.272 + green * 0.534 + blue * 0.131;
        red += (sepiaRed - red) * amount;
        green += (sepiaGreen - green) * amount;
        blue += (sepiaBlue - blue) * amount;
      } else if (name === 'hue-rotate') {
        const radians = amount * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nextRed = red * (0.213 + cos * 0.787 - sin * 0.213) + green * (0.715 - cos * 0.715 - sin * 0.715) + blue * (0.072 - cos * 0.072 + sin * 0.928);
        const nextGreen = red * (0.213 - cos * 0.213 + sin * 0.143) + green * (0.715 + cos * 0.285 + sin * 0.140) + blue * (0.072 - cos * 0.072 - sin * 0.283);
        const nextBlue = red * (0.213 - cos * 0.213 - sin * 0.787) + green * (0.715 - cos * 0.715 + sin * 0.715) + blue * (0.072 + cos * 0.928 + sin * 0.072);
        red = nextRed;
        green = nextGreen;
        blue = nextBlue;
      } else if (name === 'saturate') {
        const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        red = luma + (red - luma) * amount;
        green = luma + (green - luma) * amount;
        blue = luma + (blue - luma) * amount;
      } else if (name === 'contrast') {
        red = (red - 128) * amount + 128;
        green = (green - 128) * amount + 128;
        blue = (blue - 128) * amount + 128;
      } else if (name === 'brightness') {
        red *= amount;
        green *= amount;
        blue *= amount;
      }
      data[index] = clampByte(red);
      data[index + 1] = clampByte(green);
      data[index + 2] = clampByte(blue);
    }
  }
};

const paintFilterPixels = (target: CanvasRenderingContext2D, filter: string, originX = 0, originY = 0, pixelWidth = target.canvas.width, pixelHeight = target.canvas.height): void => {
  if (!filter || filter === 'none' || pixelWidth < 1 || pixelHeight < 1) return;
  try {
    const pixels = target.getImageData(originX, originY, pixelWidth, pixelHeight);
    applyFilterChain(pixels.data, filter);
    const blur = Number(filter.match(/blur\(([\d.]+)px\)/)?.[1] ?? 0);
    if (blur > 0.4) boxBlur(pixels.data, pixelWidth, pixelHeight, blur);
    target.putImageData(pixels, originX, originY);
  } catch {
    showToast('This photo is too large for this filter on the phone.');
  }
};

const mouthLoop = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const faceOval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const leftEyeLoop = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const rightEyeLoop = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const lipOuter = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

const growLoop = (points: FacePoint[], scale: number): FacePoint[] => {
  if (points.length < 3) return points;
  let centerX = 0;
  let centerY = 0;
  points.forEach((point) => {
    centerX += point.x;
    centerY += point.y;
  });
  centerX /= points.length;
  centerY /= points.length;
  return points.map((point) => ({
    x: centerX + (point.x - centerX) * scale,
    y: centerY + (point.y - centerY) * scale,
  }));
};

const smoothSkin = (
  target: CanvasRenderingContext2D,
  amount: number,
  face: { oval: FacePoint[]; eyes: FacePoint[][]; mouth: FacePoint[] } | null,
): void => {
  const width = target.canvas.width;
  const height = target.canvas.height;
  if (width < 2 || height < 2 || amount <= 0) return;
  let minX = Math.floor(width * 0.18);
  let minY = Math.floor(height * 0.12);
  let maxX = Math.ceil(width * 0.82);
  let maxY = Math.ceil(height * 0.78);
  if (face) {
    const pad = Math.max(8, width * 0.02);
    minX = Math.max(0, Math.floor(Math.min(...face.oval.map((point) => point.x * width)) - pad));
    minY = Math.max(0, Math.floor(Math.min(...face.oval.map((point) => point.y * height)) - pad));
    maxX = Math.min(width, Math.ceil(Math.max(...face.oval.map((point) => point.x * width)) + pad));
    maxY = Math.min(height, Math.ceil(Math.max(...face.oval.map((point) => point.y * height)) + pad));
  }
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  if (boxWidth < 4 || boxHeight < 4) return;
  const mask = document.createElement('canvas');
  mask.width = boxWidth;
  mask.height = boxHeight;
  const maskContext = mask.getContext('2d');
  if (!maskContext) return;
  const trace = (points: FacePoint[]): void => {
    if (points.length < 3) return;
    maskContext.beginPath();
    points.forEach((point, index) => {
      const x = point.x * width - minX;
      const y = point.y * height - minY;
      if (index === 0) maskContext.moveTo(x, y);
      else maskContext.lineTo(x, y);
    });
    maskContext.closePath();
    maskContext.fill();
  };
  maskContext.fillStyle = '#fff';
  if (face) {
    trace(face.oval);
    maskContext.globalCompositeOperation = 'destination-out';
    face.eyes.forEach((eye) => trace(growLoop(eye, 1.45)));
    trace(growLoop(face.mouth, 1.2));
    maskContext.globalCompositeOperation = 'source-over';
  } else {
    maskContext.beginPath();
    maskContext.ellipse(boxWidth / 2, boxHeight / 2, boxWidth * 0.42, boxHeight * 0.46, 0, 0, Math.PI * 2);
    maskContext.fill();
  }
  let pixels: ImageData;
  let maskPixels: ImageData;
  try {
    pixels = target.getImageData(minX, minY, boxWidth, boxHeight);
    maskPixels = maskContext.getImageData(0, 0, boxWidth, boxHeight);
  } catch {
    return;
  }
  const blurred = new Uint8ClampedArray(pixels.data);
  const span = Math.hypot(boxWidth, boxHeight);
  const radius = Math.max(2, Math.min(12, Math.round(span * (0.01 + (amount / 100) * 0.028))));
  boxBlur(blurred, boxWidth, boxHeight, radius);
  boxBlur(blurred, boxWidth, boxHeight, Math.max(2, Math.round(radius * 0.65)));
  const strength = 0.34 + (amount / 100) * 0.58;
  const softEdge = 34 + amount * 0.28;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const cover = maskPixels.data[index] / 255;
    if (cover < 0.05) continue;
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const delta = Math.hypot(red - blurred[index], green - blurred[index + 1], blue - blurred[index + 2]);
    const keep = delta <= softEdge ? 1 : delta >= softEdge + 46 ? 0 : (softEdge + 46 - delta) / 46;
    const mix = cover * strength * keep;
    if (mix <= 0.01) continue;
    pixels.data[index] = red + (blurred[index] - red) * mix;
    pixels.data[index + 1] = green + (blurred[index + 1] - green) * mix;
    pixels.data[index + 2] = blue + (blurred[index + 2] - blue) * mix;
  }
  target.putImageData(pixels, minX, minY);
};

const whitenTeeth = (
  target: CanvasRenderingContext2D,
  points: FacePoint[],
  amount: number,
): number => {
  const width = target.canvas.width;
  const height = target.canvas.height;
  if (points.length < 8 || amount <= 0 || width < 2 || height < 2) return 0;
  let centerX = 0;
  let centerY = 0;
  points.forEach((point) => {
    centerX += point.x;
    centerY += point.y;
  });
  centerX /= points.length;
  centerY /= points.length;
  const inset = points.map((point) => ({
    x: centerX + (point.x - centerX) * 0.86,
    y: centerY + (point.y - centerY) * 0.86,
  }));
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const maskContext = mask.getContext('2d');
  if (!maskContext) return 0;
  maskContext.fillStyle = '#fff';
  maskContext.shadowColor = '#fff';
  maskContext.shadowBlur = Math.max(1.5, width * 0.003);
  maskContext.beginPath();
  inset.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) maskContext.moveTo(x, y);
    else maskContext.lineTo(x, y);
  });
  maskContext.closePath();
  maskContext.fill();
  const left = Math.max(0, Math.floor(Math.min(...inset.map((point) => point.x)) * width) - 4);
  const top = Math.max(0, Math.floor(Math.min(...inset.map((point) => point.y)) * height) - 4);
  const right = Math.min(width, Math.ceil(Math.max(...inset.map((point) => point.x)) * width) + 4);
  const bottom = Math.min(height, Math.ceil(Math.max(...inset.map((point) => point.y)) * height) + 4);
  const pixelWidth = right - left;
  const pixelHeight = bottom - top;
  if (pixelWidth < 2 || pixelHeight < 2) return 0;
  let photo: ImageData;
  let coverage: ImageData;
  try {
    photo = target.getImageData(left, top, pixelWidth, pixelHeight);
    coverage = maskContext.getImageData(left, top, pixelWidth, pixelHeight);
  } catch {
    return 0;
  }
  const strength = amount / 100;
  let changed = 0;
  for (let index = 0; index < photo.data.length; index += 4) {
    const cover = coverage.data[index] / 255;
    if (cover < 0.08) continue;
    const red = photo.data[index];
    const green = photo.data[index + 1];
    const blue = photo.data[index + 2];
    const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const saturation = max === 0 ? 1 : (max - min) / max;
    if (luma < 96 || saturation > 0.58 || red - green > 36 || blue > red + 8) continue;
    const bright = Math.max(0, Math.min(1, (luma - 96) / 80));
    const neutral = Math.max(0, Math.min(1, (0.58 - saturation) / 0.58));
    const mix = strength * cover * bright * neutral;
    if (mix < 0.04) continue;
    const lifted = luma + (255 - luma) * mix * 0.34;
    const yellow = Math.max(0, (red + green) * 0.5 - blue);
    photo.data[index] = clampByte(red + (lifted - red) * mix * 0.62 - yellow * mix * 0.12);
    photo.data[index + 1] = clampByte(green + (lifted - green) * mix * 0.72);
    photo.data[index + 2] = clampByte(blue + (lifted - blue) * mix * 0.92 + yellow * mix * 0.35);
    changed += 1;
  }
  if (changed > 0) target.putImageData(photo, left, top);
  return changed;
};

const drawFilteredSource = (
  target: CanvasRenderingContext2D,
  image: CanvasImageSource,
  filter: string,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
): void => {
  target.filter = 'none';
  target.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight);
  if (!filter || filter === 'none') return;
  const originX = Math.max(0, Math.floor(destX));
  const originY = Math.max(0, Math.floor(destY));
  const pixelWidth = Math.max(1, Math.min(target.canvas.width - originX, Math.round(destWidth)));
  const pixelHeight = Math.max(1, Math.min(target.canvas.height - originY, Math.round(destHeight)));
  paintFilterPixels(target, filter, originX, originY, pixelWidth, pixelHeight);
};

type LookRecipe = {
  saturate?: number;
  contrast?: number;
  sepia?: number;
  grayscale?: number;
  hue?: number;
  brightness?: number;
};

const lookRecipes: Record<string, LookRecipe> = {
  original: {},
  film: { sepia: 0.45, contrast: 1.2, saturate: 0.7 },
  warm: { sepia: 0.35, saturate: 1.35, hue: -8 },
  glow: { brightness: 1.28, saturate: 1.25, contrast: 0.92 },
  cool: { hue: 28, saturate: 0.75, brightness: 1.05 },
  vivid: { saturate: 1.3, contrast: 1.1 },
  'vivid-warm': { saturate: 1.3, sepia: 0.2 },
  'vivid-cool': { saturate: 1.2, hue: -10 },
  dramatic: { contrast: 1.3, brightness: 0.95 },
  'dramatic-warm': { contrast: 1.25, sepia: 0.25, brightness: 0.97 },
  'dramatic-cool': { contrast: 1.3, hue: -18, brightness: 0.96 },
  mono: { grayscale: 1, contrast: 1.5, brightness: 0.9 },
  silvertone: { grayscale: 1, contrast: 1.2 },
  noir: { grayscale: 1, contrast: 1.5, brightness: 0.9 },
  fade: { saturate: 0.55, contrast: 0.82, brightness: 1.18, sepia: 0.22 },
  instant: { contrast: 1.28, saturate: 0.7, sepia: 0.28, brightness: 1.06 },
  transfer: { sepia: 0.5, contrast: 1.12, saturate: 1.35, hue: 18 },
  chrome: { contrast: 1.35, saturate: 1.4, brightness: 1.12, hue: 14 },
  soft: { brightness: 1.08, saturate: 0.88, contrast: 0.9 },
  pink: { saturate: 1.12, sepia: 0.16, hue: -14, brightness: 1.06 },
  vintage: { sepia: 0.42, contrast: 0.88, saturate: 0.72, brightness: 1.06 },
  pop: { saturate: 1.55, contrast: 1.16, brightness: 1.04 },
  matte: { saturate: 0.7, contrast: 0.86, brightness: 1.1 },
  golden: { sepia: 0.3, saturate: 1.18, brightness: 1.08, hue: -8 },
  beauty: { brightness: 1.1, saturate: 1.04, contrast: 0.92, sepia: 0.1 },
};

const mixUnit = (value: number, amount: number): number => 1 + (value - 1) * amount;

const recipeToFilter = (recipe: LookRecipe, intensity: number): string => {
  const amount = Math.max(0, Math.min(1, intensity / 100));
  if (amount <= 0) return 'none';
  const parts: string[] = [];
  if (recipe.grayscale) parts.push(`grayscale(${(recipe.grayscale * amount).toFixed(3)})`);
  if (recipe.sepia) parts.push(`sepia(${(recipe.sepia * amount).toFixed(3)})`);
  if (recipe.hue) parts.push(`hue-rotate(${(recipe.hue * amount).toFixed(2)}deg)`);
  if (recipe.saturate) parts.push(`saturate(${mixUnit(recipe.saturate, amount).toFixed(3)})`);
  if (recipe.contrast) parts.push(`contrast(${mixUnit(recipe.contrast, amount).toFixed(3)})`);
  if (recipe.brightness) parts.push(`brightness(${mixUnit(recipe.brightness, amount).toFixed(3)})`);
  return parts.length ? parts.join(' ') : 'none';
};

const filterIntensityValue = (): number => Number(byId<HTMLInputElement>('filterIntensity')?.value ?? 100);

const lookFilter = (look: string, intensity = filterIntensityValue()): string =>
  recipeToFilter(lookRecipes[look] ?? {}, intensity);

const sliderNumber = (id: string): number => Number(byId<HTMLInputElement>(id)?.value ?? 0);

const adjustControlIds = [
  'adjustExposure',
  'adjustBrilliance',
  'adjustHighlights',
  'adjustShadows',
  'adjustContrast',
  'adjustBrightness',
  'adjustBlackPoint',
  'adjustSaturation',
  'adjustVibrance',
  'adjustWarmth',
  'adjustTint',
  'adjustSharpness',
  'adjustDefinition',
  'adjustNoise',
  'adjustVignette',
] as const;

const autoAdjustRecipe: Record<(typeof adjustControlIds)[number], number> = {
  adjustExposure: 10,
  adjustBrilliance: 18,
  adjustHighlights: -14,
  adjustShadows: 20,
  adjustContrast: 8,
  adjustBrightness: 4,
  adjustBlackPoint: 6,
  adjustSaturation: 4,
  adjustVibrance: 16,
  adjustWarmth: 6,
  adjustTint: 0,
  adjustSharpness: 16,
  adjustDefinition: 12,
  adjustNoise: 0,
  adjustVignette: 8,
};

let fineBlurLayer: HTMLCanvasElement | null = null;
let broadBlurLayer: HTMLCanvasElement | null = null;

const blurSurface = (layer: HTMLCanvasElement | null, source: HTMLCanvasElement, radius: number): HTMLCanvasElement | null => {
  const copy = layer ?? document.createElement('canvas');
  if (copy.width !== source.width || copy.height !== source.height) {
    copy.width = source.width;
    copy.height = source.height;
  }
  const layerContext = copy.getContext('2d', { willReadFrequently: true });
  if (!layerContext) return null;
  layerContext.filter = 'none';
  layerContext.clearRect(0, 0, copy.width, copy.height);
  layerContext.drawImage(source, 0, 0);
  const frame = layerContext.getImageData(0, 0, copy.width, copy.height);
  boxBlur(frame.data, copy.width, copy.height, radius);
  layerContext.putImageData(frame, 0, 0);
  return copy;
};

const applyPhotoAdjustments = (target: CanvasRenderingContext2D, surface: HTMLCanvasElement): void => {
  const width = surface.width;
  const height = surface.height;
  if (!width || !height) return;
  const exposure = sliderNumber('adjustExposure') / 100;
  const brilliance = sliderNumber('adjustBrilliance') / 100;
  const highlights = sliderNumber('adjustHighlights') / 100;
  const shadows = sliderNumber('adjustShadows') / 100;
  const contrast = sliderNumber('adjustContrast') / 100;
  const brightness = sliderNumber('adjustBrightness') / 100;
  const blackPoint = sliderNumber('adjustBlackPoint') / 100;
  const saturation = sliderNumber('adjustSaturation') / 100;
  const vibrance = sliderNumber('adjustVibrance') / 100;
  const warmth = sliderNumber('adjustWarmth') / 100;
  const tint = sliderNumber('adjustTint') / 100;
  const sharpness = sliderNumber('adjustSharpness') / 100;
  const definition = sliderNumber('adjustDefinition') / 100;
  const noise = sliderNumber('adjustNoise') / 100;
  const vignette = sliderNumber('adjustVignette') / 100;
  const colorEdit = exposure || brilliance || highlights || shadows || contrast || brightness || blackPoint || saturation || vibrance || warmth || tint || vignette;
  if (colorEdit) {
    try {
      const frame = target.getImageData(0, 0, width, height);
      const data = frame.data;
      const expGain = Math.pow(2, exposure * 1.15);
      const contrastScale = 1 + contrast * 0.9;
      const satScale = Math.max(0, 1 + saturation);
      for (let y = 0; y < height; y += 1) {
        const ny = y / height - 0.5;
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          let r = data[index] / 255;
          let g = data[index + 1] / 255;
          let b = data[index + 2] / 255;
          r = r * expGain + brightness * 0.38;
          g = g * expGain + brightness * 0.38;
          b = b * expGain + brightness * 0.38;
          let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (brilliance) {
            const shadowLift = Math.max(0, 0.58 - luma) * brilliance * 0.7;
            const highlightRoll = Math.max(0, luma - 0.62) * brilliance * 0.35;
            r += shadowLift - highlightRoll;
            g += shadowLift - highlightRoll;
            b += shadowLift - highlightRoll;
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          }
          if (shadows) {
            const mask = Math.max(0, 0.62 - luma) / 0.62;
            const lift = shadows * 0.55 * mask * mask;
            r += lift;
            g += lift;
            b += lift;
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          }
          if (highlights) {
            const mask = Math.max(0, luma - 0.42) / 0.58;
            const lift = highlights * 0.5 * mask * mask;
            r += lift;
            g += lift;
            b += lift;
          }
          if (blackPoint > 0) {
            const crush = blackPoint * 0.42;
            const scale = 1 / Math.max(0.2, 1 - crush);
            r = (r - crush) * scale;
            g = (g - crush) * scale;
            b = (b - crush) * scale;
          } else if (blackPoint < 0) {
            const lift = -blackPoint * 0.32;
            r = r * (1 - lift) + lift;
            g = g * (1 - lift) + lift;
            b = b * (1 - lift) + lift;
          }
          r = (r - 0.5) * contrastScale + 0.5;
          g = (g - 0.5) * contrastScale + 0.5;
          b = (b - 0.5) * contrastScale + 0.5;
          r += warmth * 0.16;
          b -= warmth * 0.16;
          r += tint * 0.1;
          b += tint * 0.08;
          g -= tint * 0.12;
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = gray + (r - gray) * satScale;
          g = gray + (g - gray) * satScale;
          b = gray + (b - gray) * satScale;
          if (vibrance) {
            const dull = 1 - Math.min(1, (Math.max(r, g, b) - Math.min(r, g, b)) * 1.7);
            const skin = r > g && g > b * 0.9 && r > 0.25 ? 0.4 : 1;
            const boost = 1 + vibrance * 0.95 * dull * skin;
            r = gray + (r - gray) * boost;
            g = gray + (g - gray) * boost;
            b = gray + (b - gray) * boost;
          }
          if (vignette) {
            const dist = Math.hypot((x / width - 0.5) * 1.15, ny * 1.2);
            const edge = Math.max(0, dist - 0.28) / 0.72;
            const factor = 1 - vignette * 0.85 * edge * edge;
            r *= factor;
            g *= factor;
            b *= factor;
          }
          data[index] = clampByte(r * 255);
          data[index + 1] = clampByte(g * 255);
          data[index + 2] = clampByte(b * 255);
        }
      }
      target.putImageData(frame, 0, 0);
    } catch {
      showToast('This photo is too large for these adjustments in the browser.');
      return;
    }
  }
  if (!sharpness && !definition && !noise) return;
  const fine = sharpness || noise ? blurSurface(fineBlurLayer, surface, 1.15) : null;
  if (fine) fineBlurLayer = fine;
  const broad = definition ? blurSurface(broadBlurLayer, surface, 6.5) : null;
  if (broad) broadBlurLayer = broad;
  const fineContext = fine?.getContext('2d');
  const broadContext = broad?.getContext('2d');
  try {
    const frame = target.getImageData(0, 0, width, height);
    const fineData = fineContext?.getImageData(0, 0, width, height).data;
    const broadData = broadContext?.getImageData(0, 0, width, height).data;
    const data = frame.data;
    const noiseMix = noise * 0.62;
    const sharpGain = sharpness * 1.25;
    const definitionGain = definition * 0.95;
    for (let index = 0; index < data.length; index += 4) {
      let r = data[index];
      let g = data[index + 1];
      let b = data[index + 2];
      if (fineData && noiseMix) {
        r = r * (1 - noiseMix) + fineData[index] * noiseMix;
        g = g * (1 - noiseMix) + fineData[index + 1] * noiseMix;
        b = b * (1 - noiseMix) + fineData[index + 2] * noiseMix;
      }
      if (fineData && sharpGain) {
        r += (r - fineData[index]) * sharpGain;
        g += (g - fineData[index + 1]) * sharpGain;
        b += (b - fineData[index + 2]) * sharpGain;
      }
      if (broadData && definitionGain) {
        r += (r - broadData[index]) * definitionGain;
        g += (g - broadData[index + 1]) * definitionGain;
        b += (b - broadData[index + 2]) * definitionGain;
      }
      data[index] = clampByte(r);
      data[index + 1] = clampByte(g);
      data[index + 2] = clampByte(b);
    }
    target.putImageData(frame, 0, 0);
  } catch {
    showToast('This photo is too large for these adjustments in the browser.');
  }
};

const syncFilterChips = (): void => {
  const current = photoFilter?.value === 'noir' ? 'mono' : (photoFilter?.value ?? 'original');
  document.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.look === current));
  });
};

const paintFilterPreviews = (source: HTMLImageElement | null = originalImage): void => {
  if (!source?.naturalWidth) return;
  document.querySelectorAll<HTMLCanvasElement>('[data-filter-preview]').forEach((thumb) => {
    const thumbContext = thumb.getContext('2d');
    if (!thumbContext) return;
    const size = 108;
    thumb.width = size;
    thumb.height = size;
    const side = Math.min(source.naturalWidth, source.naturalHeight);
    const originX = (source.naturalWidth - side) / 2;
    const originY = (source.naturalHeight - side) / 2;
    thumbContext.filter = 'none';
    thumbContext.drawImage(source, originX, originY, side, side, 0, 0, size, size);
    paintFilterPixels(thumbContext, lookFilter(thumb.dataset.filterPreview ?? 'original', 100));
    thumb.classList.add('ready');
  });
};

const samplePreview = new Image();
samplePreview.onload = () => {
  if (!originalImage) paintFilterPreviews(samplePreview);
};
samplePreview.src = 'images/EditsBeauty.jpeg';

const openTools = (): void => {
  toolsSheet?.classList.add('open');
  toolsSheet?.setAttribute('aria-hidden', 'false');
  backdrop?.classList.add('open');
};

const closeTools = (): void => {
  toolsSheet?.classList.remove('open');
  toolsSheet?.setAttribute('aria-hidden', 'true');
  backdrop?.classList.remove('open');
};

const showEditor = (): void => {
  if (editorPanel) editorPanel.hidden = false;
  document.body.classList.add('studio-open');
  const stage = byId<HTMLElement>('canvasStage');
  stage?.classList.toggle('has-photo', Boolean(originalImage));
};

type HomeEffect = 'smooth-skin' | 'lipstick' | 'eyelashes' | 'double-chin' | 'acne' | 'ai-retouch' | 'ai-bg' | 'red-light' | 'golden-hour' | 'slim' | 'body' | 'remover' | 'removal';

const homeEffectLabel: Record<HomeEffect, string> = {
  'smooth-skin': 'SMOOTH SKIN',
  lipstick: 'LIPSTICK',
  eyelashes: 'EYELASHES',
  'double-chin': 'DOUBLE CHIN',
  acne: 'ACNE',
  'ai-retouch': 'AI Retouch',
  'ai-bg': 'AI BG Change',
  'red-light': 'RED CAR LIGHT',
  'golden-hour': 'GOLDEN HOUR',
  slim: 'Slim',
  body: 'Body Tuner',
  remover: 'Remover-People',
  removal: 'Removal',
};

let activeHomeEffect: HomeEffect | null = null;

const isHomeEffect = (value: string): value is HomeEffect => Object.prototype.hasOwnProperty.call(homeEffectLabel, value);

const requestPhoto = (): void => {
  if (!upload) return;
  upload.value = '';
  upload.click();
};

const beginHomeEffect = (effect: HomeEffect): void => {
  if (effect !== 'ai-bg') remember();
  if (effect === 'ai-bg') {
    activeHomeEffect = null;
    console.log('filter', effect);
    closeTools();
    showEditor();
    setStudioTab('adjust');
    const more = byId<HTMLDetailsElement>('moreTools');
    if (more) more.open = true;
    const title = byId<HTMLElement>('editorTitle');
    if (title) title.textContent = homeEffectLabel[effect];
    if (originalImage) {
      void selectBackgroundScene('studio', true);
      return;
    }
    showToast('Choose a photo, then pick a background.');
    requestPhoto();
    return;
  }
  activeHomeEffect = effect;
  console.log('filter', effect);
  closeTools();
  setStudioTab('filters');
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = homeEffectLabel[effect];
  canvas?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (originalImage) {
    render();
    showToast(`${homeEffectLabel[effect]} applied.`);
    return;
  }
  showToast('Choose a photo.');
  requestPhoto();
};

const closeStudio = (): void => {
  keepCrop();
  if (editorPanel) editorPanel.hidden = true;
  const cropScreen = byId<HTMLElement>('cropScreen');
  if (cropScreen) cropScreen.hidden = true;
  document.body.classList.remove('studio-open');
};

const markDock = (name: string): void => {
  document.querySelectorAll<HTMLButtonElement>('[data-dock]').forEach((button) => {
    const selected = button.dataset.dock === name;
    button.setAttribute('aria-pressed', String(selected));
  });
};

const setStudioTab = (tab: 'adjust' | 'filters' | 'crop'): void => {
  if (tab === 'crop') {
    markDock('Crop');
    if (!originalImage) {
      showEditor();
      showToast('Choose a photo to crop.');
      pendingCrop = true;
      upload?.click();
      return;
    }
    openCrop();
    return;
  }
  keepCrop();
  const cropScreen = byId<HTMLElement>('cropScreen');
  if (cropScreen) cropScreen.hidden = true;
  showEditor();
  const filters = byId<HTMLElement>('panelFilters');
  const adjust = byId<HTMLElement>('panelAdjust');
  if (filters) filters.hidden = tab !== 'filters';
  if (adjust) adjust.hidden = tab !== 'adjust';
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = activeHomeEffect ? homeEffectLabel[activeHomeEffect] : tab === 'filters' ? 'Filters' : 'Adjust';
  document.querySelectorAll<HTMLButtonElement>('[data-studio-tab]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.studioTab === tab));
  });
  markDock(tab === 'filters' ? 'Filters' : tab === 'adjust' ? 'Adjust' : 'Crop');
};

type PhotoGridLayout = '2-up' | '2x2' | '3x3' | 'strip-horizontal' | 'strip-vertical';
type PhotoTileShape = 'rectangle' | 'rounded' | 'circle';

const drawPhotoTile = (
  target: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  shape: PhotoTileShape,
): void => {
  target.save();
  target.beginPath();
  if (shape === 'circle') {
    target.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    const radius = Math.min(width, height) * 0.12;
    target.moveTo(x + radius, y);
    target.lineTo(x + width - radius, y);
    target.quadraticCurveTo(x + width, y, x + width, y + radius);
    target.lineTo(x + width, y + height - radius);
    target.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    target.lineTo(x + radius, y + height);
    target.quadraticCurveTo(x, y + height, x, y + height - radius);
    target.lineTo(x, y + radius);
    target.quadraticCurveTo(x, y, x + radius, y);
  } else {
    target.rect(x, y, width, height);
  }
  target.clip();

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  target.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  target.restore();
};

const renderPhotoGrid = (): void => {
  if (!gridCanvas || !gridContext || !gridBackground || !gridImages.length) return;
  const layout = (gridLayout?.value ?? '2-up') as PhotoGridLayout;
  const ratio = gridRatio?.value ?? 'square';
  const shape = (gridTileShape?.value ?? 'rectangle') as PhotoTileShape;
  const outputWidth = ratio === 'landscape' ? 1350 : 900;
  const outputHeight = ratio === 'portrait' ? 1125 : ratio === 'landscape' ? 900 : ratio === 'story' ? 1600 : 900;
  const photoCount = gridImages.length;
  let columns = 2;
  let rows = Math.ceil(photoCount / columns);
  let slotCount = photoCount;

  if (layout === '2x2') {
    columns = 2;
    rows = 2;
    slotCount = 4;
  } else if (layout === '3x3') {
    columns = 3;
    rows = 3;
    slotCount = 9;
  } else if (layout === 'strip-horizontal') {
    columns = Math.min(photoCount, 9);
    rows = 1;
  } else if (layout === 'strip-vertical') {
    columns = 1;
    rows = Math.min(photoCount, 9);
  }

  const visibleCount = Math.min(photoCount, slotCount);
  const gap = Number(gridGap?.value ?? 12);
  gridCanvas.width = outputWidth;
  gridCanvas.height = outputHeight;
  gridContext.fillStyle = gridBackground.value;
  gridContext.fillRect(0, 0, outputWidth, outputHeight);
  const tileWidth = (outputWidth - gap * (columns + 1)) / columns;
  const tileHeight = (outputHeight - gap * (rows + 1)) / rows;

  for (let index = 0; index < visibleCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawPhotoTile(
      gridContext,
      gridImages[index],
      gap + column * (tileWidth + gap),
      gap + row * (tileHeight + gap),
      tileWidth,
      tileHeight,
      shape,
    );
  }

  if (saveGridButton) saveGridButton.disabled = false;
  if (gridStatus) {
    const layoutName = gridLayout?.selectedOptions[0]?.textContent ?? 'Photo grid';
    gridStatus.textContent = visibleCount < photoCount
      ? `Showing ${visibleCount} of ${photoCount} photos in ${layoutName}.`
      : `${photoCount} photo${photoCount === 1 ? '' : 's'} · ${layoutName}`;
  }
};

const openGridStudio = (layout?: PhotoGridLayout): void => {
  if (!gridStudio) return;
  if (layout && gridLayout) gridLayout.value = layout;
  gridStudio.hidden = false;
  gridStudio.scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderPhotoGrid();
};

const closeGridStudio = (): void => {
  if (gridStudio) gridStudio.hidden = true;
};

byId<HTMLButtonElement>('closeGrid')?.addEventListener('click', closeGridStudio);
gridUpload?.addEventListener('change', () => {
  const files = Array.from(gridUpload.files ?? []).filter((file) => file.type.startsWith('image/')).slice(0, 9);
  gridImageUrls.forEach((url) => URL.revokeObjectURL(url));
  gridImages = [];
  gridImageUrls = files.map((file) => URL.createObjectURL(file));
  void Promise.all(gridImageUrls.map((url) => new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  }))).then((images) => {
    gridImages = images.filter((image): image is HTMLImageElement => image !== null);
    if (gridStatus && !gridImages.length) gridStatus.textContent = 'Those photos could not be opened. Choose different images.';
    if (saveGridButton) saveGridButton.disabled = !gridImages.length;
    renderPhotoGrid();
  });
  if (files.length === 9 && gridStatus) gridStatus.textContent = 'Using the first 9 photos.';
});

[gridLayout, gridRatio, gridTileShape, gridBackground].forEach((control) => {
  control?.addEventListener('input', renderPhotoGrid);
  control?.addEventListener('change', renderPhotoGrid);
});
gridGap?.addEventListener('input', () => {
  if (gridGapValue) gridGapValue.value = gridGap.value;
  renderPhotoGrid();
});
saveGridButton?.addEventListener('click', () => {
  gridCanvas?.toBlob((blob) => {
    if (!blob) {
      showToast('The photo grid could not be exported.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'editsbeauty-photo-grid.png';
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
});

const videoLooks: Record<string, string> = {
  original: 'none',
  soft: 'brightness(1.06) saturate(0.9)',
  film: 'sepia(0.28) contrast(1.12) saturate(0.84)',
  mono: 'grayscale(1) contrast(1.06)',
  warm: 'sepia(0.16) saturate(1.2)',
};

const updateVideoLook = (): void => {
  if (videoPreview) videoPreview.style.filter = videoLooks[videoFilter?.value ?? 'original'] ?? 'none';
};

const openVideoStudio = (look?: string): void => {
  if (!videoStudio) return;
  if (look && videoFilter) videoFilter.value = look;
  updateVideoLook();
  videoStudio.hidden = false;
  videoStudio.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const closeVideoStudio = (): void => {
  videoPreview?.pause();
  if (videoStudio) videoStudio.hidden = true;
};

const drawVideoFrame = (): boolean => {
  if (!videoPreview || !videoCanvas || videoPreview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const scale = Math.min(1, 1600 / Math.max(videoPreview.videoWidth, videoPreview.videoHeight));
  videoCanvas.width = Math.max(1, Math.round(videoPreview.videoWidth * scale));
  videoCanvas.height = Math.max(1, Math.round(videoPreview.videoHeight * scale));
  const videoContext = videoCanvas.getContext('2d');
  if (!videoContext) return false;
  videoContext.filter = 'none';
  videoContext.drawImage(videoPreview, 0, 0, videoCanvas.width, videoCanvas.height);
  paintFilterPixels(videoContext, videoLooks[videoFilter?.value ?? 'original'] ?? 'none');
  return true;
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};

batchUpload?.addEventListener('change', () => {
  const files = Array.from(batchUpload.files ?? []).filter((file) => file.type.startsWith('image/'));
  if (batchExportButton) batchExportButton.disabled = files.length === 0;
  if (batchStatus) batchStatus.textContent = files.length > 9
    ? `Selected ${files.length} photos. The first 9 will be exported.`
    : `${files.length} photo${files.length === 1 ? '' : 's'} selected.`;
});

batchExportButton?.addEventListener('click', async () => {
  const files = Array.from(batchUpload?.files ?? []).filter((file) => file.type.startsWith('image/')).slice(0, 9);
  if (!files.length) return;
  batchExportButton.disabled = true;
  let exported = 0;
  try {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      const loaded = new Promise<boolean>((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
      });
      image.src = url;
      if (!(await loaded)) {
        URL.revokeObjectURL(url);
        continue;
      }
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const output = document.createElement('canvas');
      output.width = Math.max(1, Math.round(image.naturalWidth * scale));
      output.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const outputContext = output.getContext('2d');
      if (!outputContext) {
        URL.revokeObjectURL(url);
        continue;
      }
      const value = Number(enhanceSlider?.value ?? 100) / 100;
      outputContext.filter = 'none';
      drawFilteredSource(outputContext, image, composeCanvasFilters(lookFilter(photoFilter?.value ?? 'original'), `brightness(${value}) contrast(${value}) saturate(${value})`), 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, output.width, output.height);
      applyPhotoAdjustments(outputContext, output);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'));
      if (blob) {
        const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
        downloadBlob(blob, `${name}-editsbeauty.png`);
        exported += 1;
      }
      URL.revokeObjectURL(url);
      if (batchStatus) batchStatus.textContent = `Exported ${exported} of ${files.length} photos.`;
    }
    if (batchStatus) batchStatus.textContent = `Exported ${exported} photo${exported === 1 ? '' : 's'}. Allow multiple downloads if your browser asks.`;
  } finally {
    batchExportButton.disabled = false;
  }
});

byId<HTMLButtonElement>('closeVideo')?.addEventListener('click', closeVideoStudio);
videoFilter?.addEventListener('input', updateVideoLook);
videoFilter?.addEventListener('change', updateVideoLook);
videoUpload?.addEventListener('change', () => {
  const file = videoUpload.files?.[0];
  if (!file || !file.type.startsWith('video/') || !videoPreview) return;
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);
  videoPreview.src = videoUrl;
  videoPreview.load();
  videoPreview.onloadedmetadata = () => {
    const duration = Number.isFinite(videoPreview.duration) ? `${Math.round(videoPreview.duration)} sec` : 'video';
    if (videoStatus) videoStatus.textContent = `Ready · ${duration}`;
    if (videoScreenshotButton) videoScreenshotButton.disabled = false;
    if (startVideoExportButton) startVideoExportButton.disabled = false;
  };
  videoPreview.onerror = () => {
    if (videoStatus) videoStatus.textContent = 'This video format could not be opened in the browser.';
  };
  updateVideoLook();
});

videoScreenshotButton?.addEventListener('click', () => {
  if (!drawVideoFrame() || !videoCanvas) {
    showToast('Play or pause the video on a frame before saving it.');
    return;
  }
  videoCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, 'editsbeauty-video-frame.png');
    else showToast('The video frame could not be exported.');
  }, 'image/png');
});

startVideoExportButton?.addEventListener('click', async () => {
  if (!videoPreview || !videoCanvas || !videoCanvas.captureStream || typeof MediaRecorder === 'undefined') {
    showToast('Filtered video export is not supported by this browser.');
    return;
  }
  if (!drawVideoFrame()) {
    showToast('Choose a video before exporting.');
    return;
  }
  const stream = videoCanvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  try {
    videoRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined);
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    showToast('This browser could not start video export.');
    return;
  }
  videoChunks = [];
  videoRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size) videoChunks.push(event.data);
  };
  videoRecorder.onstop = () => {
    const output = new Blob(videoChunks, { type: videoRecorder?.mimeType || 'video/webm' });
    stream.getTracks().forEach((track) => track.stop());
    if (output.size) downloadBlob(output, 'editsbeauty-video-edit.webm');
    if (videoStatus) videoStatus.textContent = 'Video export complete. Audio is not included.';
    if (startVideoExportButton) startVideoExportButton.disabled = false;
    if (stopVideoExportButton) stopVideoExportButton.hidden = true;
    videoRecorder = null;
  };
  videoRecorder.start();
  if (startVideoExportButton) startVideoExportButton.disabled = true;
  if (stopVideoExportButton) stopVideoExportButton.hidden = false;
  if (videoStatus) videoStatus.textContent = 'Recording filtered video…';
  videoPreview.currentTime = 0;
  try {
    await videoPreview.play();
  } catch {
    videoRecorder.stop();
    showToast('Tap play on the video before starting export.');
    return;
  }
  const recordFrame = (): void => {
    if (!videoRecorder || videoRecorder.state !== 'recording' || !videoPreview) return;
    drawVideoFrame();
    if (videoPreview.ended) videoRecorder.stop();
    else videoAnimationFrame = window.requestAnimationFrame(recordFrame);
  };
  recordFrame();
});

stopVideoExportButton?.addEventListener('click', () => {
  if (videoAnimationFrame) window.cancelAnimationFrame(videoAnimationFrame);
  if (videoPreview) videoPreview.pause();
  if (videoRecorder?.state === 'recording') videoRecorder.stop();
});

const outputBindings: Array<[HTMLInputElement | null, string, (value: string) => string]> = [
  [enhanceSlider, 'enhanceValue', (value) => `${value}%`],
  [bodyTuneSlider, 'bodyTuneValue', (value) => value],
  [faceVolumeSlider, 'faceVolumeValue', (value) => value],
  [hairStrength, 'hairStrengthValue', (value) => `${value}%`],
  [cutoutTolerance, 'cutoutToleranceValue', (value) => value],
  [brushSize, 'brushSizeValue', (value) => value],
];

outputBindings.forEach(([input, outputId, format]) => {
  input?.addEventListener('input', () => {
    if (input === enhanceSlider) aiEnhanceEnabled = false;
    const output = byId<HTMLOutputElement>(outputId);
    if (output) output.value = format(input.value);
    scheduleRender();
  });
});

aiEnhanceButton?.addEventListener('click', () => {
  remember();
  aiEnhanceEnabled = true;
  if (enhanceSlider) enhanceSlider.value = '110';
  const output = byId<HTMLOutputElement>('enhanceValue');
  if (output) output.value = '110%';
  render();
  byId<HTMLElement>('editorTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!originalImage) showToast('Choose a photo to apply Enhance.');
});

[photoFilter, hairTint, cutoutColor, editBackground, timestampToggle].forEach((control) => {
  control?.addEventListener('input', () => {
    if (control === photoFilter) syncFilterChips();
    scheduleRender();
  });
  control?.addEventListener('change', () => {
    if (control === photoFilter) {
      syncFilterChips();
      if (photoFilter.value === 'beauty' && smoothSlider) {
        smoothSlider.value = '72';
        if (smoothValue) smoothValue.value = '72';
        paintRange(smoothSlider);
      }
    }
    render();
  });
});

photoRatio?.addEventListener('change', () => {
  setPhotoCanvasSize();
  render();
});

byId<HTMLButtonElement>('addText')?.addEventListener('click', () => {
  const value = overlayText?.value.trim();
  if (!value) {
    showToast('Type a caption before adding text.');
    return;
  }
  remember();
  textOverlays.push(value);
  render();
});
const stickerTones = ['#1a2332', '#14b8a6', '#2f6f62', '#8a5a44', '#3d4f66', '#9a3412'];
const stickerCatalog: Array<{ title: string; kind: PlacedSticker['kind']; items: string[] }> = [
  { title: 'Shapes', kind: 'mark', items: ['star', 'heart', 'spark', 'blossom', 'sun', 'moon', 'ring', 'drop', 'diamond'] },
  { title: 'Beauty', kind: 'mark', items: ['gloss', 'lash', 'petal', 'mirror', 'blush'] },
  { title: 'Words', kind: 'word', items: ['SOFT', 'GLOW', 'LOVE', 'YES', 'CUTE', 'WOW', 'HI', 'OK', 'NEW', 'SLAY'] },
  { title: 'Smileys', kind: 'emoji', items: ['😊', '😍', '🥰', '😎', '🤩', '😜', '😇', '🥳', '😂', '😘'] },
  { title: 'Cute', kind: 'emoji', items: ['🌸', '🦋', '🐰', '🐻', '✨', '🌙', '🍓', '🎀', '☕', '🍀'] },
  { title: 'Fun', kind: 'emoji', items: ['🎉', '🔥', '👑', '💯', '🎵', '📸', '👍', '✌️', '💪', '🌈'] },
];

type EditorStamp = {
  token: number;
  image?: string;
  filter: string;
  intensity: string;
  smooth: string;
  teeth: string;
  nose: string;
  body: string;
  face: string;
  enhance: string;
  enhanced: boolean;
  hair: string;
  hairColor: string;
  adjusts: Record<string, string>;
  background: string | null;
  effect: string | null;
  stickers: PlacedSticker[];
  texts: string[];
  brush: BrushStroke[];
  timestamp: boolean;
};
const HISTORY_LIMIT = 15;
const undoStack: EditorStamp[] = [];
const redoStack: EditorStamp[] = [];
let imageToken = 0;
let applyingHistory = false;
let historyLock = 0;
let sliderArm: EditorStamp | null = null;

const cloneStickers = (items: PlacedSticker[]): PlacedSticker[] => items.map((item) => ({ ...item }));
const cloneBrush = (items: BrushStroke[]): BrushStroke[] => items.map((stroke) => ({
  ...stroke,
  points: stroke.points.map((point) => ({ ...point })),
}));

const captureStamp = (withImage: boolean): EditorStamp => {
  const adjusts: Record<string, string> = {};
  adjustControlIds.forEach((id) => {
    adjusts[id] = byId<HTMLInputElement>(id)?.value ?? '0';
  });
  const stamp: EditorStamp = {
    token: imageToken,
    filter: photoFilter?.value ?? 'original',
    intensity: byId<HTMLInputElement>('filterIntensity')?.value ?? '100',
    smooth: smoothSlider?.value ?? '0',
    teeth: teethSlider?.value ?? '0',
    nose: noseSlider?.value ?? '0',
    body: bodyTuneSlider?.value ?? '0',
    face: faceVolumeSlider?.value ?? '0',
    enhance: enhanceSlider?.value ?? '100',
    enhanced: aiEnhanceEnabled,
    hair: hairStrength?.value ?? '0',
    hairColor: hairTint?.value ?? '#784b32',
    adjusts,
    background: activeBackgroundScene,
    effect: activeHomeEffect,
    stickers: cloneStickers(stickerOverlays),
    texts: [...textOverlays],
    brush: cloneBrush(brushStrokes),
    timestamp: !!timestampToggle?.checked,
  };
  if (withImage && originalImage) stamp.image = snapshotSource();
  return stamp;
};

const syncHistoryButtons = (): void => {
  const undo = byId<HTMLButtonElement>('undoBtn');
  const redo = byId<HTMLButtonElement>('redoBtn');
  if (undo) undo.disabled = undoStack.length === 0;
  if (redo) redo.disabled = redoStack.length === 0;
};

const pushUndo = (stamp: EditorStamp): void => {
  undoStack.push(stamp);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
};

const remember = (withImage = false): void => {
  if (applyingHistory || historyLock) return;
  sliderArm = null;
  pushUndo(captureStamp(withImage));
};

const resetEditHistory = (): void => {
  undoStack.length = 0;
  redoStack.length = 0;
  sliderArm = null;
  imageToken += 1;
  syncHistoryButtons();
};

const setHistorySlider = (id: string, value: string): void => {
  const input = byId<HTMLInputElement>(id);
  if (!input) return;
  input.value = value;
  paintRange(input);
  const output = byId<HTMLOutputElement>(`${id}Val`);
  if (output) output.value = id === 'filterIntensity' ? `${value}%` : formatAdjustValue(id, value);
};

const applyStamp = async (stamp: EditorStamp): Promise<void> => {
  applyingHistory = true;
  try {
    if (photoFilter) photoFilter.value = stamp.filter;
    syncFilterChips();
    const intensity = byId<HTMLInputElement>('filterIntensity');
    if (intensity) {
      intensity.value = stamp.intensity;
      paintRange(intensity);
      const output = byId<HTMLOutputElement>('filterIntensityVal');
      if (output) output.value = `${stamp.intensity}%`;
    }
    if (smoothSlider) {
      smoothSlider.value = stamp.smooth;
      if (smoothValue) smoothValue.value = stamp.smooth;
      paintRange(smoothSlider);
    }
    if (teethSlider) {
      teethSlider.value = stamp.teeth;
      if (teethValue) teethValue.value = stamp.teeth;
      paintRange(teethSlider);
    }
    if (noseSlider) {
      noseSlider.value = stamp.nose;
      if (noseValue) noseValue.value = stamp.nose;
    }
    if (bodyTuneSlider) bodyTuneSlider.value = stamp.body;
    if (faceVolumeSlider) faceVolumeSlider.value = stamp.face;
    if (enhanceSlider) enhanceSlider.value = stamp.enhance;
    aiEnhanceEnabled = stamp.enhanced;
    if (hairStrength) hairStrength.value = stamp.hair;
    if (hairTint) hairTint.value = stamp.hairColor;
    if (timestampToggle) timestampToggle.checked = stamp.timestamp;
    applyingAuto = true;
    adjustControlIds.forEach((id) => setHistorySlider(id, stamp.adjusts[id] ?? '0'));
    applyingAuto = false;
    syncAdjustBoard();
    activeHomeEffect = stamp.effect && isHomeEffect(stamp.effect) ? stamp.effect : null;
    stickerOverlays.splice(0, stickerOverlays.length, ...cloneStickers(stamp.stickers));
    textOverlays.splice(0, textOverlays.length, ...stamp.texts);
    brushStrokes.splice(0, brushStrokes.length, ...cloneBrush(stamp.brush));
    if (!stickerOverlays.some((item) => item.id === selectedStickerId)) selectedStickerId = 0;
    if (stamp.image && stamp.token !== imageToken) {
      imageToken = stamp.token;
      await new Promise<void>((resolve) => {
        replaceOriginal(stamp.image ?? '', '', resolve);
      });
    }
    if (stamp.background !== activeBackgroundScene) {
      if (stamp.background && isBackgroundScene(stamp.background)) await selectBackgroundScene(stamp.background, false);
      else {
        activeBackgroundScene = null;
        setSceneButtons(null);
        canvas?.classList.remove('is-blank');
        if (backgroundStatus) backgroundStatus.textContent = 'Pick a scene. The person stays, and the photo behind them changes on this device.';
        render();
      }
    } else render();
  } finally {
    applyingHistory = false;
    syncHistoryButtons();
  }
};

const undoEdit = (): void => {
  const stamp = undoStack.pop();
  if (!stamp) {
    showToast('Nothing to undo.');
    syncHistoryButtons();
    return;
  }
  redoStack.push(captureStamp(stamp.image !== undefined));
  void applyStamp(stamp);
};

const redoEdit = (): void => {
  const stamp = redoStack.pop();
  if (!stamp) {
    showToast('Nothing to redo.');
    syncHistoryButtons();
    return;
  }
  undoStack.push(captureStamp(stamp.image !== undefined));
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  void applyStamp(stamp);
};

byId<HTMLButtonElement>('undoBtn')?.addEventListener('click', undoEdit);
byId<HTMLButtonElement>('redoBtn')?.addEventListener('click', redoEdit);
document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoEdit();
    else undoEdit();
  } else if (key === 'y') {
    event.preventDefault();
    redoEdit();
  }
});

const armSliderHistory = (input: HTMLInputElement | null): void => {
  input?.addEventListener('pointerdown', () => {
    if (applyingHistory || historyLock) return;
    sliderArm = captureStamp(false);
  });
  input?.addEventListener('change', () => {
    if (!sliderArm || applyingHistory || historyLock) {
      sliderArm = null;
      return;
    }
    const next = captureStamp(false);
    if (JSON.stringify(sliderArm) !== JSON.stringify(next)) pushUndo(sliderArm);
    sliderArm = null;
  });
};
[...adjustControlIds, 'smooth', 'teeth', 'nose', 'bodyTune', 'faceVolume', 'filterIntensity', 'hairStrength'].forEach((id) => {
  armSliderHistory(byId<HTMLInputElement>(id));
});
syncHistoryButtons();

const drawMark = (context: CanvasRenderingContext2D, name: string, size: number, tone: string): void => {
  context.save();
  context.fillStyle = tone;
  context.strokeStyle = tone;
  context.lineWidth = Math.max(2, size * 0.08);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const radius = size / 2;
  if (name === 'star' || name === 'spark') {
    const points = name === 'spark' ? 4 : 5;
    const inner = name === 'spark' ? 0.16 : 0.42;
    context.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const distance = index % 2 === 0 ? radius : radius * inner;
      const angle = -Math.PI / 2 + (index * Math.PI) / points;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  } else if (name === 'heart') {
    context.beginPath();
    context.moveTo(0, radius * 0.32);
    context.bezierCurveTo(-radius, -radius * 0.2, -radius * 0.55, -radius, 0, -radius * 0.32);
    context.bezierCurveTo(radius * 0.55, -radius, radius, -radius * 0.2, 0, radius * 0.32);
    context.fill();
  } else if (name === 'blossom') {
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      context.ellipse(0, -radius * 0.38, radius * 0.26, radius * 0.46, (index * Math.PI) / 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#fffdf8';
    context.beginPath();
    context.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
    context.fill();
  } else if (name === 'sun') {
    context.beginPath();
    context.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
    context.fill();
    for (let index = 0; index < 8; index += 1) {
      context.rotate(Math.PI / 4);
      context.beginPath();
      context.moveTo(0, -radius * 0.55);
      context.lineTo(0, -radius);
      context.stroke();
    }
  } else if (name === 'moon') {
    context.beginPath();
    context.arc(-radius * 0.08, 0, radius * 0.72, -1.1, 1.1, true);
    context.arc(radius * 0.28, 0, radius * 0.58, 1.15, -1.15);
    context.closePath();
    context.fill();
  } else if (name === 'ring') {
    context.lineWidth = Math.max(3, size * 0.12);
    context.beginPath();
    context.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    context.stroke();
  } else if (name === 'drop') {
    context.beginPath();
    context.moveTo(0, -radius);
    context.bezierCurveTo(radius * 0.9, -radius * 0.1, radius * 0.72, radius * 0.72, 0, radius);
    context.bezierCurveTo(-radius * 0.72, radius * 0.72, -radius * 0.9, -radius * 0.1, 0, -radius);
    context.fill();
  } else if (name === 'diamond') {
    context.beginPath();
    context.moveTo(0, -radius);
    context.lineTo(radius * 0.7, 0);
    context.lineTo(0, radius);
    context.lineTo(-radius * 0.7, 0);
    context.closePath();
    context.fill();
  } else if (name === 'gloss') {
    context.beginPath();
    context.ellipse(0, 0, radius * 0.92, radius * 0.4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgb(255 253 248 / 50%)';
    context.beginPath();
    context.ellipse(-radius * 0.18, -radius * 0.08, radius * 0.32, radius * 0.1, -0.4, 0, Math.PI * 2);
    context.fill();
  } else if (name === 'lash') {
    context.lineWidth = Math.max(2, size * 0.07);
    for (let index = -2; index <= 2; index += 1) {
      context.beginPath();
      context.moveTo(index * radius * 0.28, radius * 0.2);
      context.quadraticCurveTo(index * radius * 0.36, -radius * 0.15, index * radius * 0.5, -radius * 0.9);
      context.stroke();
    }
  } else if (name === 'petal') {
    context.beginPath();
    context.ellipse(0, 0, radius * 0.4, radius * 0.88, 0, 0, Math.PI * 2);
    context.fill();
  } else if (name === 'mirror') {
    context.lineWidth = Math.max(2, size * 0.08);
    context.beginPath();
    context.roundRect(-radius * 0.55, -radius * 0.78, radius * 1.1, radius * 1.56, radius * 0.18);
    context.stroke();
    context.beginPath();
    context.moveTo(-radius * 0.18, -radius * 0.45);
    context.lineTo(radius * 0.12, radius * 0.4);
    context.stroke();
  } else if (name === 'blush') {
    context.globalAlpha = 0.9;
    context.beginPath();
    context.ellipse(-radius * 0.38, 0, radius * 0.4, radius * 0.26, 0, 0, Math.PI * 2);
    context.ellipse(radius * 0.38, 0, radius * 0.4, radius * 0.26, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};

const paintStickers = (context: CanvasRenderingContext2D, width: number, height: number): void => {
  stickerOverlays.forEach((sticker) => {
    context.save();
    context.translate(sticker.x * width, sticker.y * height);
    context.rotate(sticker.rotation);
    context.scale(sticker.scale, sticker.scale);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgb(26 35 50 / 28%)';
    context.shadowBlur = Math.max(2, width * 0.004);
    if (sticker.kind === 'word') {
      const fontSize = Math.max(16, width * 0.045);
      context.font = `800 ${fontSize}px "Avenir Next", "Segoe UI", sans-serif`;
      const padX = Math.max(10, width * 0.018);
      const boxWidth = context.measureText(sticker.glyph).width + padX * 2;
      const boxHeight = Math.max(28, width * 0.07);
      context.fillStyle = sticker.tone;
      context.beginPath();
      context.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8);
      context.fill();
      context.shadowColor = 'transparent';
      context.fillStyle = '#fffdf8';
      context.fillText(sticker.glyph, 0, 0);
    } else if (sticker.kind === 'emoji') {
      context.font = `${Math.max(28, width * 0.11)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      context.fillText(sticker.glyph, 0, 0);
    } else {
      context.shadowColor = 'transparent';
      drawMark(context, sticker.glyph, width * 0.16, sticker.tone);
    }
    context.restore();
  });
};

const stickerBox = (sticker: PlacedSticker, width: number): { w: number; h: number } => {
  if (sticker.kind === 'word') {
    const fontSize = Math.max(16, width * 0.045);
    const textWidth = sticker.glyph.length * fontSize * 0.62;
    return {
      w: (textWidth + Math.max(10, width * 0.018) * 2) * sticker.scale,
      h: Math.max(28, width * 0.07) * sticker.scale,
    };
  }
  const base = Math.max(28, width * (sticker.kind === 'emoji' ? 0.11 : 0.16));
  return { w: base * sticker.scale, h: base * sticker.scale };
};

const placeStickerFrame = (): void => {
  const frame = byId<HTMLElement>('stickerFrame');
  const stage = byId<HTMLElement>('canvasStage');
  if (!frame || !stage || !canvas) return;
  const sticker = stickerOverlays.find((item) => item.id === selectedStickerId);
  if (!sticker || canvas.parentElement !== stage || !canvas.classList.contains('has-image')) {
    frame.hidden = true;
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const box = stickerBox(sticker, canvas.width || 1);
  const width = box.w * (canvasRect.width / (canvas.width || 1));
  const height = box.h * (canvasRect.height / (canvas.height || 1));
  frame.hidden = false;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.left = `${canvasRect.left - stageRect.left + sticker.x * canvasRect.width - width / 2}px`;
  frame.style.top = `${canvasRect.top - stageRect.top + sticker.y * canvasRect.height - height / 2}px`;
  frame.style.transform = `rotate(${sticker.rotation}rad)`;
};

const hitSticker = (nx: number, ny: number): PlacedSticker | null => {
  if (!canvas?.width || !canvas.height) return null;
  const px = nx * canvas.width;
  const py = ny * canvas.height;
  for (let index = stickerOverlays.length - 1; index >= 0; index -= 1) {
    const sticker = stickerOverlays[index];
    const dx = px - sticker.x * canvas.width;
    const dy = py - sticker.y * canvas.height;
    const cos = Math.cos(-sticker.rotation);
    const sin = Math.sin(-sticker.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    const box = stickerBox(sticker, canvas.width);
    if (Math.abs(localX) <= box.w / 2 && Math.abs(localY) <= box.h / 2) return sticker;
  }
  return null;
};

type StickerDrag = {
  mode: 'move' | 'rotate' | 'scale';
  stamp: EditorStamp;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  startRotation: number;
  startScale: number;
  startAngle: number;
  startDistance: number;
};
let stickerDrag: StickerDrag | null = null;

const stickerCenter = (sticker: PlacedSticker): { x: number; y: number } | null => {
  if (!canvas) return null;
  const bounds = canvas.getBoundingClientRect();
  return { x: bounds.left + sticker.x * bounds.width, y: bounds.top + sticker.y * bounds.height };
};

const beginStickerDrag = (mode: StickerDrag['mode'], event: PointerEvent): void => {
  const sticker = stickerOverlays.find((item) => item.id === selectedStickerId);
  if (!sticker || applyingHistory) return;
  const center = stickerCenter(sticker);
  const angle = center ? Math.atan2(event.clientY - center.y, event.clientX - center.x) : 0;
  const distance = center ? Math.max(12, Math.hypot(event.clientX - center.x, event.clientY - center.y)) : 12;
  stickerDrag = {
    mode,
    stamp: captureStamp(false),
    startX: event.clientX,
    startY: event.clientY,
    originX: sticker.x,
    originY: sticker.y,
    startRotation: sticker.rotation,
    startScale: sticker.scale,
    startAngle: angle,
    startDistance: distance,
  };
  event.preventDefault();
  event.stopPropagation();
};

const moveStickerDrag = (event: PointerEvent): void => {
  if (!stickerDrag || !canvas) return;
  const sticker = stickerOverlays.find((item) => item.id === selectedStickerId);
  if (!sticker) return;
  if (stickerDrag.mode === 'move') {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    sticker.x = Math.max(0.02, Math.min(0.98, stickerDrag.originX + (event.clientX - stickerDrag.startX) / bounds.width));
    sticker.y = Math.max(0.02, Math.min(0.98, stickerDrag.originY + (event.clientY - stickerDrag.startY) / bounds.height));
  } else {
    const center = stickerCenter(sticker);
    if (!center) return;
    if (stickerDrag.mode === 'rotate') {
      const angle = Math.atan2(event.clientY - center.y, event.clientX - center.x);
      sticker.rotation = stickerDrag.startRotation + (angle - stickerDrag.startAngle);
    } else {
      const distance = Math.max(12, Math.hypot(event.clientX - center.x, event.clientY - center.y));
      sticker.scale = Math.max(0.35, Math.min(3.2, stickerDrag.startScale * (distance / stickerDrag.startDistance)));
    }
  }
  scheduleRender();
};

const endStickerDrag = (): void => {
  if (!stickerDrag) return;
  const stamp = stickerDrag.stamp;
  const before = JSON.stringify(stamp.stickers);
  stickerDrag = null;
  if (before !== JSON.stringify(stickerOverlays)) pushUndo(stamp);
  render();
};

const stickerGroups = byId<HTMLElement>('stickerGroups');
const addSticker = (glyph: string, kind: PlacedSticker['kind'], tone: string): void => {
  if (stickerOverlays.length >= 24) {
    showToast('That is 24 stickers. Clear them to add more.');
    return;
  }
  remember();
  const slot = stickerOverlays.length;
  const sticker: PlacedSticker = {
    id: stickerSerial,
    kind,
    glyph,
    x: 0.22 + (slot % 4) * 0.18,
    y: 0.2 + (Math.floor(slot / 4) % 4) * 0.16,
    scale: 1,
    rotation: 0,
    tone,
  };
  stickerSerial += 1;
  stickerOverlays.push(sticker);
  selectedStickerId = sticker.id;
  render();
};
stickerCatalog.forEach((group) => {
  if (!stickerGroups) return;
  const block = document.createElement('div');
  block.className = 'sticker-group';
  const title = document.createElement('p');
  title.textContent = group.title;
  const row = document.createElement('div');
  row.className = 'sticker-row';
  group.items.forEach((item, index) => {
    const tone = stickerTones[index % stickerTones.length];
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', group.kind === 'word' ? `${item} sticker` : `Add ${item} sticker`);
    if (group.kind === 'mark') {
      button.className = 'mark';
      const icon = document.createElement('canvas');
      icon.width = 36;
      icon.height = 36;
      const iconContext = icon.getContext('2d');
      if (iconContext) {
        iconContext.translate(18, 18);
        drawMark(iconContext, item, 28, tone);
      }
      button.append(icon);
    } else if (group.kind === 'word') {
      button.className = 'word';
      button.textContent = item;
      button.style.background = tone;
    } else button.textContent = item;
    button.addEventListener('click', () => addSticker(item, group.kind, tone));
    row.append(button);
  });
  block.append(title, row);
  stickerGroups.append(block);
});
byId<HTMLButtonElement>('clearOverlays')?.addEventListener('click', () => {
  if (!textOverlays.length && !stickerOverlays.length && !brushStrokes.length) return;
  remember();
  textOverlays.length = 0;
  stickerOverlays.length = 0;
  brushStrokes.length = 0;
  selectedStickerId = 0;
  render();
});
const stickerFrameEl = byId<HTMLElement>('stickerFrame');
stickerFrameEl?.addEventListener('pointerdown', (event) => {
  if (!(event.target instanceof HTMLElement) || event.target.closest('button')) return;
  beginStickerDrag('move', event);
  try { stickerFrameEl.setPointerCapture(event.pointerId); } catch { /* A real pointer owns capture. */ }
});
byId<HTMLButtonElement>('stickerRotate')?.addEventListener('pointerdown', (event) => {
  beginStickerDrag('rotate', event);
  if (event.currentTarget instanceof HTMLElement) {
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* A real pointer owns capture. */ }
  }
});
byId<HTMLButtonElement>('stickerScale')?.addEventListener('pointerdown', (event) => {
  beginStickerDrag('scale', event);
  if (event.currentTarget instanceof HTMLElement) {
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* A real pointer owns capture. */ }
  }
});
byId<HTMLButtonElement>('stickerDelete')?.addEventListener('click', (event) => {
  event.stopPropagation();
  const index = stickerOverlays.findIndex((item) => item.id === selectedStickerId);
  if (index < 0) return;
  remember();
  stickerOverlays.splice(index, 1);
  selectedStickerId = stickerOverlays[stickerOverlays.length - 1]?.id ?? 0;
  render();
});
window.addEventListener('pointermove', moveStickerDrag);
window.addEventListener('pointerup', endStickerDrag);
window.addEventListener('pointercancel', endStickerDrag);
window.addEventListener('resize', placeStickerFrame);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  if (!selectedStickerId) return;
  byId<HTMLButtonElement>('stickerDelete')?.click();
});
byId<HTMLButtonElement>('brushToggle')?.addEventListener('click', (event) => {
  brushEnabled = !brushEnabled;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(brushEnabled));
  button.textContent = brushEnabled
    ? (brushMode === 'heal' ? 'Disable remover' : 'Disable brush')
    : (brushMode === 'heal' ? 'Enable remover' : 'Enable brush');
  const help = byId<HTMLParagraphElement>('brushModeHelp');
  if (help) help.textContent = brushMode === 'heal'
    ? 'Paint over an area to replace it with nearby pixels.'
    : 'Brush marks use the selected color.';
  if (canvas) canvas.classList.toggle('brush-active', brushEnabled);
});

const brushPoint = (event: PointerEvent): { x: number; y: number } | null => {
  if (!canvas) return null;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
};

canvas?.addEventListener('pointerdown', (event: PointerEvent) => {
  if (!brushEnabled || !brushColor || !brushSize) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const stroke: BrushStroke = { color: brushColor.value, size: Number(brushSize.value), mode: brushMode, points: [] };
  currentBrush = stroke;
  brushStrokes.push(stroke);
  const point = brushPoint(event);
  if (point) stroke.points.push(point);
  render();
});
canvas?.addEventListener('pointermove', (event: PointerEvent) => {
  if (!currentBrush) return;
  const point = brushPoint(event);
  if (!point) return;
  currentBrush.points.push(point);
  scheduleRender();
});
const endBrush = (): void => {
  const wasDrawing = currentBrush !== null;
  currentBrush = null;
  if (wasDrawing) render();
};
canvas?.addEventListener('pointerup', endBrush);
canvas?.addEventListener('pointercancel', endBrush);
canvas?.addEventListener('pointerdown', (event: PointerEvent) => {
  if (brushEnabled || stickerDrag) return;
  const point = brushPoint(event);
  if (!point) return;
  const hit = hitSticker(point.x, point.y);
  if (!hit) {
    if (selectedStickerId) {
      selectedStickerId = 0;
      placeStickerFrame();
    }
    return;
  }
  selectedStickerId = hit.id;
  placeStickerFrame();
  beginStickerDrag('move', event);
  try { canvas.setPointerCapture(event.pointerId); } catch { /* A real pointer owns capture. */ }
});

const setCameraLook = (look: string): void => {
  if (photoFilter) photoFilter.value = look;
  if (creativeControls) creativeControls.hidden = false;
  if (look === 'timestamp') {
    if (timestampToggle) timestampToggle.checked = true;
    if (photoFilter) photoFilter.value = 'film';
  }
  syncFilterChips();
  if (!originalImage) {
    void openCamera();
    return;
  }
  render();
  byId<HTMLElement>('editorTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function parkCanvas(): void {
  const stage = byId<HTMLElement>('canvasStage');
  const loading = byId<HTMLElement>('aiLoading');
  if (!canvas || !stage) return;
  if (loading && loading.parentElement === stage) stage.insertBefore(canvas, loading);
  else stage.append(canvas);
}

function openPortrait(kind: 'retouch' | 'narrow'): void {
  closeTools();
  if (!originalImage) {
    pendingPortrait = kind;
    showToast('Choose a photo to start editing.');
    upload?.click();
    return;
  }
  pendingPortrait = null;
  portraitSnapshot = {
    smooth: smoothSlider?.value ?? '0',
    nose: noseSlider?.value ?? '0',
  };
  if (retouchScreen) retouchScreen.hidden = kind !== 'retouch';
  if (narrowScreen) narrowScreen.hidden = kind !== 'narrow';
  const stage = kind === 'retouch' ? retouchStage : narrowStage;
  const overlay = kind === 'retouch' ? brushRing : noseLandmarks;
  if (canvas && stage) {
    if (overlay) stage.insertBefore(canvas, overlay);
    else stage.append(canvas);
  }
  const smoothControl = byId<HTMLElement>('smoothControl');
  if (kind === 'retouch' && smoothControl) byId<HTMLElement>('smoothMount')?.append(smoothControl);
  render();
}

function closePortrait(apply: boolean): void {
  if (!apply) {
    if (smoothSlider) smoothSlider.value = portraitSnapshot.smooth;
    if (noseSlider) noseSlider.value = portraitSnapshot.nose;
    if (smoothValue) smoothValue.value = portraitSnapshot.smooth;
    if (noseValue) noseValue.value = portraitSnapshot.nose;
  }
  if (retouchScreen) retouchScreen.hidden = true;
  if (narrowScreen) narrowScreen.hidden = true;
  if (brushRing) brushRing.hidden = true;
  const smoothControl = byId<HTMLElement>('smoothControl');
  if (smoothControl) byId<HTMLElement>('smoothSlot')?.append(smoothControl);
  parkCanvas();
  if (!apply) render();
}

function updatePortraitGuides(): void {
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  const canvasBox = canvas.getBoundingClientRect();
  const parentBox = parent.getBoundingClientRect();
  const left = canvasBox.left - parentBox.left;
  const top = canvasBox.top - parentBox.top;
  if (brushRing && retouchScreen && !retouchScreen.hidden && canvasBox.width > 0) {
    const amount = Number(smoothSlider?.value ?? 0);
    const size = Math.max(36, canvasBox.width * (0.18 + amount / 280));
    brushRing.hidden = false;
    brushRing.style.width = `${size}px`;
    brushRing.style.height = `${size}px`;
    brushRing.style.left = `${left + canvasBox.width / 2 - size / 2}px`;
    brushRing.style.top = `${top + canvasBox.height * 0.42 - size / 2}px`;
    if (brushChip) brushChip.style.filter = `blur(${Math.min(1.5, amount / 50)}px)`;
  }
  if (!noseLandmarks || !narrowScreen || narrowScreen.hidden || canvasBox.width <= 0) return;
  noseLandmarks.style.left = `${left}px`;
  noseLandmarks.style.top = `${top}px`;
  noseLandmarks.style.width = `${canvasBox.width}px`;
  noseLandmarks.style.height = `${canvasBox.height}px`;
  const marks = portraitGuides.points && portraitGuides.points.length
    ? portraitGuides.points
    : [
      { x: portraitGuides.cx, y: portraitGuides.cy - portraitGuides.ry * 0.85 },
      { x: portraitGuides.cx, y: portraitGuides.cy },
      { x: portraitGuides.cx - portraitGuides.rx, y: portraitGuides.cy + portraitGuides.ry * 0.35 },
      { x: portraitGuides.cx + portraitGuides.rx, y: portraitGuides.cy + portraitGuides.ry * 0.35 },
    ];
  noseLandmarks.setAttribute('viewBox', '0 0 100 100');
  noseLandmarks.innerHTML = `<path d="M ${marks.map((point) => `${point.x * 100} ${point.y * 100}`).join(' L ')}"/>${marks.map((point) => `<circle cx="${point.x * 100}" cy="${point.y * 100}" r="1.35"/>`).join('')}`;
}

byId<HTMLButtonElement>('retouchBack')?.addEventListener('click', () => closePortrait(false));
byId<HTMLButtonElement>('retouchCancel')?.addEventListener('click', () => closePortrait(false));
byId<HTMLButtonElement>('retouchApply')?.addEventListener('click', () => closePortrait(true));
byId<HTMLButtonElement>('narrowBack')?.addEventListener('click', () => closePortrait(false));
byId<HTMLButtonElement>('narrowCancel')?.addEventListener('click', () => closePortrait(false));
byId<HTMLButtonElement>('narrowApply')?.addEventListener('click', () => closePortrait(true));

byId<HTMLButtonElement>('openTools')?.addEventListener('click', openTools);
byId<HTMLButtonElement>('moreBtn')?.addEventListener('click', openTools);
byId<HTMLButtonElement>('closeTools')?.addEventListener('click', closeTools);
byId<HTMLButtonElement>('sheetStart')?.addEventListener('click', () => {
  closeTools();
  setStudioTab('filters');
});
byId<HTMLButtonElement>('startEditing')?.addEventListener('click', () => {
  activeHomeEffect = null;
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = 'Filters';
  setStudioTab('filters');
  if (!originalImage) requestPhoto();
});
byId<HTMLButtonElement>('studioBack')?.addEventListener('click', closeStudio);
backdrop?.addEventListener('click', closeTools);
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (retouchScreen && !retouchScreen.hidden || narrowScreen && !narrowScreen.hidden) closePortrait(false);
    const cropScreen = byId<HTMLElement>('cropScreen');
    if (cropScreen && !cropScreen.hidden) {
      closeCrop(false);
      return;
    }
    if (editorPanel && !editorPanel.hidden) {
      closeStudio();
      return;
    }
    closeCamera();
    closeTools();
  }
});

const revealInSheet = (element: HTMLElement | null): void => {
  if (!element) return;
  const more = byId<HTMLDetailsElement>('moreTools');
  if (more?.contains(element)) more.open = true;
  const panel = element.closest('.sheet-panel');
  if (!(panel instanceof HTMLElement)) return;
  const top = element.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
  panel.scrollTo({ top: Math.max(0, top - 8), behavior: 'auto' });
};

document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
  button.addEventListener('click', () => {
    const tool = button.dataset.tool ?? 'Tool';
    noteTool(tool);
    if (tool === 'AI Duo' || tool === 'Carousel-temp') {
      closeTools();
      openGridStudio(tool === 'Carousel-temp' ? '2x2' : '2-up');
      return;
    }
    if (tool === 'AI video' || tool === 'Video Editing' || tool === 'Video Retouch' || tool === 'Video Screenshot') {
      closeTools();
      openVideoStudio(tool === 'Video Retouch' ? 'soft' : 'original');
      return;
    }
    const cameraLooks: Record<string, string> = {
      Photobooth: 'original',
      'Film Cam': 'film',
      'Apple Mode': 'warm',
      'Glow Cam': 'glow',
      'Timestamp Cam': 'timestamp',
    };
    if (tool in cameraLooks) {
      closeTools();
      setCameraLook(cameraLooks[tool]);
      return;
    }
    if (tool === 'Crop') {
      closeTools();
      setStudioTab('crop');
      return;
    }
    if (tool === 'Teeth') {
      closeTools();
      setStudioTab('filters');
      if (!originalImage) {
        pendingTeeth = '68';
        showToast('Choose a photo to whiten teeth.');
        requestPhoto();
        return;
      }
      if (Number(teethSlider?.value ?? 0) === 0) setTeethAmount(68);
      const title = byId<HTMLElement>('editorTitle');
      if (title) title.textContent = 'Teeth';
      revealInSheet(byId<HTMLElement>('teethControl'));
      return;
    }
    if (tool === 'Collage' || tool === 'Photo Grid' || tool === 'Photo Strip') {
      closeTools();
      openGridStudio(tool === 'Photo Strip' ? 'strip-vertical' : '2-up');
      return;
    }
    const photoTools = ['Photo Studio', 'Enhance', 'ID Photo', 'Cutout', 'Remover', 'Background', 'Background Expansion', 'Batch Edit', 'Filters', 'AI Filter', 'Brushes', 'Stickers', 'Text', 'ChatEdit', 'Fan Merch', 'Outfit', 'Body Tuner', 'Face Volume', 'Hair', 'Augmentation'];
    if (photoTools.includes(tool)) {
      closeTools();
      if (creativeControls) creativeControls.hidden = false;
      const adjustTools = ['Enhance', 'ID Photo', 'Cutout', 'Remover', 'Background', 'Background Expansion', 'Batch Edit', 'Brushes', 'Stickers', 'Text', 'ChatEdit', 'Fan Merch', 'Outfit', 'Body Tuner', 'Face Volume', 'Hair', 'Augmentation'];
      setStudioTab(adjustTools.includes(tool) ? 'adjust' : 'filters');
      if (adjustTools.includes(tool)) {
        const more = byId<HTMLDetailsElement>('moreTools');
        if (more) more.open = true;
      }
      if (tool === 'Enhance' && enhanceSlider) {
        aiEnhanceEnabled = true;
        const output = byId<HTMLOutputElement>('enhanceValue');
        if (output) output.value = '110%';
      }
      if (tool === 'ID Photo' && photoRatio) photoRatio.value = 'id';
      if (tool === 'Background Expansion' && photoRatio) photoRatio.value = 'expand-square';
      if (tool === 'Cutout' && cutoutTolerance) cutoutTolerance.value = '24';
      if (tool === 'AI Filter' && photoFilter) {
        photoFilter.value = 'vivid';
        syncFilterChips();
      }
      if (tool === 'Filters') setStudioTab('filters');
      if (tool === 'Outfit' && photoFilter) photoFilter.value = 'warm';
      if (tool === 'Augmentation' && faceVolumeSlider) faceVolumeSlider.value = '12';
      if (tool === 'ChatEdit') overlayText?.focus({ preventScroll: true });
      if (tool === 'Fan Merch') stickerChoice?.focus({ preventScroll: true });
      if (tool === 'Batch Edit') batchUpload?.click();
      if (tool === 'Photo Studio' && !originalImage) upload?.click();
      if (tool === 'Body Tuner') bodyTuneSlider?.focus({ preventScroll: true });
      if (tool === 'Face Volume') faceVolumeSlider?.focus({ preventScroll: true });
      if (tool === 'Hair') hairTint?.focus({ preventScroll: true });
      if (tool === 'Brushes' || tool === 'Remover') {
        brushMode = tool === 'Remover' ? 'heal' : 'paint';
        const brushButton = byId<HTMLButtonElement>('brushToggle');
        if (brushEnabled) {
          brushButton?.setAttribute('aria-pressed', 'true');
          if (brushButton) brushButton.textContent = brushMode === 'heal' ? 'Disable remover' : 'Disable brush';
          const help = byId<HTMLParagraphElement>('brushModeHelp');
          if (help) help.textContent = brushMode === 'heal' ? 'Paint over an area to replace it with nearby pixels.' : 'Brush marks use the selected color.';
        } else {
          brushButton?.click();
        }
      }
      setPhotoCanvasSize();
      render();
      if (!originalImage) {
        showToast('Choose a photo to use this tool.');
        upload?.click();
      }
      const title = byId<HTMLElement>('editorTitle');
      if (title) title.textContent = tool === 'Filters' || tool === 'AI Filter' ? 'Filters' : tool;
      const toolTarget: Record<string, string> = {
        Enhance: 'enhance',
        'ID Photo': 'photoRatio',
        Cutout: 'cutoutTolerance',
        Remover: 'brushToggle',
        Background: 'backgroundScenes',
        'Background Expansion': 'photoRatio',
        'Batch Edit': 'batchStatus',
        Brushes: 'brushToggle',
        Stickers: 'stickerChoice',
        Text: 'overlayText',
        ChatEdit: 'overlayText',
        'Fan Merch': 'stickerChoice',
        'Body Tuner': 'bodyTune',
        'Face Volume': 'faceVolume',
        Hair: 'hairTint',
        Augmentation: 'faceVolume',
      };
      if (toolTarget[tool]) revealInSheet(byId<HTMLElement>(toolTarget[tool]));
      if (tool === 'Cutout') showToast('Cutout is ready. Move the tolerance slider to remove a background color.');
      return;
    }
    if (tool === 'Retouch' || tool === 'Narrow') {
      openPortrait(tool === 'Retouch' ? 'retouch' : 'narrow');
      return;
    }
    showToast(`${tool} is listed in the tool catalog but is not implemented yet.`);
  });
});

const detectFaceMesh = async (image: HTMLImageElement): Promise<FacePoint[] | null> => {
  await ensureFaceMeshScript();
  const FaceMesh = (window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh;
  if (!FaceMesh) {
    if (faceDetectionStatus) faceDetectionStatus.textContent = 'Face Mesh is offline; Narrow will use a centered fallback region.';
    publishStillLandmarks(null);
    return null;
  }

  try {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    const resultsPromise = new Promise<FacePoint[] | null>((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), 10000);
      faceMesh.onResults((results) => {
        window.clearTimeout(timeout);
        resolve(results.multiFaceLandmarks?.[0] ?? null);
      });
    });
    await faceMesh.send({ image });
    const landmarks = await resultsPromise;
    faceMesh.close?.();
    if (faceDetectionStatus) faceDetectionStatus.textContent = landmarks
      ? 'Face detected locally. Narrow uses facial landmarks.'
      : 'No face found. Narrow uses a centered fallback region.';
    publishStillLandmarks(landmarks);
    return landmarks;
  } catch {
    if (faceDetectionStatus) faceDetectionStatus.textContent = 'Face Mesh could not load; Narrow uses a centered fallback region.';
    publishStillLandmarks(null);
    return null;
  }
};

const setPhotoCanvasSize = (): void => {
  if (!originalImage || !canvas) return;
  if (photoRatio?.value === 'id' || photoRatio?.value === 'expand-portrait') {
    canvas.width = 900;
    canvas.height = 1125;
  } else if (photoRatio?.value === 'square' || photoRatio?.value === 'expand-square') {
    canvas.width = 900;
    canvas.height = 900;
  } else if (photoRatio?.value === 'expand-story') {
    canvas.width = 900;
    canvas.height = 1600;
  } else {
    const scale = Math.min(1, maxDimension / Math.max(originalImage.naturalWidth, originalImage.naturalHeight));
    canvas.width = Math.max(1, Math.round(originalImage.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalImage.naturalHeight * scale));
  }
};

const backgroundScenes = {
  blank: { label: 'Blank', kind: 'blank' },
  blur: { label: 'Blur', kind: 'blur' },
  white: { label: 'White', kind: 'color', color: '#ffffff' },
  black: { label: 'Black', kind: 'color', color: '#111111' },
  gray: { label: 'Gray', kind: 'color', color: '#8e8e93' },
  cream: { label: 'Cream', kind: 'color', color: '#f4efe6' },
  red: { label: 'Red', kind: 'color', color: '#d7263d' },
  pink: { label: 'Pink', kind: 'color', color: '#ff8fb8' },
  blue: { label: 'Blue', kind: 'color', color: '#2f6fed' },
  navy: { label: 'Navy', kind: 'color', color: '#1b2a4a' },
  green: { label: 'Green', kind: 'color', color: '#1f8a4c' },
  teal: { label: 'Teal', kind: 'color', color: '#087e80' },
  yellow: { label: 'Yellow', kind: 'color', color: '#f5c518' },
  purple: { label: 'Purple', kind: 'color', color: '#7a4dff' },
  sunsetwash: { label: 'Sunset wash', kind: 'gradient', from: '#ff8a4c', to: '#6a4cff' },
  rose: { label: 'Rose', kind: 'gradient', from: '#ffd1dc', to: '#ff6b9a' },
  skywash: { label: 'Sky wash', kind: 'gradient', from: '#8ecbff', to: '#fff6df' },
  studiowash: { label: 'Studio wash', kind: 'gradient', from: '#f7f7f8', to: '#c8c8ce' },
  gold: { label: 'Gold', kind: 'gradient', from: '#ffe08a', to: '#e08a2c' },
  neon: { label: 'Neon', kind: 'gradient', from: '#7a4dff', to: '#ff2d78' },
  nightwash: { label: 'Night wash', kind: 'gradient', from: '#0b1026', to: '#3a4a8a' },
  mint: { label: 'Mint', kind: 'gradient', from: '#d9fff4', to: '#69ded0' },
  beach: { label: 'Beach', kind: 'photo', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80' },
  city: { label: 'City', kind: 'photo', url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=80' },
  studio: { label: 'Studio', kind: 'photo', url: 'https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?auto=format&fit=crop&w=1600&q=80' },
  garden: { label: 'Garden', kind: 'photo', url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1600&q=80' },
  sunset: { label: 'Sunset', kind: 'photo', url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1600&q=80' },
  mountains: { label: 'Mountains', kind: 'photo', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80' },
  forest: { label: 'Forest', kind: 'photo', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80' },
  night: { label: 'Night', kind: 'photo', url: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=80' },
  cafe: { label: 'Cafe', kind: 'photo', url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&q=80' },
  sky: { label: 'Sky', kind: 'photo', url: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1600&q=80' },
  flowers: { label: 'Flowers', kind: 'photo', url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80' },
  ocean: { label: 'Ocean', kind: 'photo', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1600&q=80' },
  office: { label: 'Office', kind: 'photo', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80' },
  snow: { label: 'Snow', kind: 'photo', url: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?auto=format&fit=crop&w=1600&q=80' },
  desert: { label: 'Desert', kind: 'photo', url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1600&q=80' },
  library: { label: 'Library', kind: 'photo', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1600&q=80' },
  room: { label: 'Room', kind: 'photo', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80' },
  brick: { label: 'Brick', kind: 'photo', url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80' },
  street: { label: 'Street', kind: 'photo', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=80' },
  autumn: { label: 'Autumn', kind: 'photo', url: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?auto=format&fit=crop&w=1600&q=80' },
  waterfall: { label: 'Waterfall', kind: 'photo', url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1600&q=80' },
  park: { label: 'Park', kind: 'photo', url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80' },
  rain: { label: 'Rain', kind: 'photo', url: 'https://images.unsplash.com/photo-1501691223387-dd0500403074?auto=format&fit=crop&w=1600&q=80' },
  space: { label: 'Space', kind: 'photo', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=80' },
} as const satisfies Record<string, SceneSpec>;
type BackgroundScene = keyof typeof backgroundScenes;
const sceneLabels: Record<BackgroundScene, string> = Object.fromEntries(
  Object.entries(backgroundScenes).map(([key, spec]) => [key, spec.label]),
) as Record<BackgroundScene, string>;
const bgSceneRow = byId<HTMLElement>('bgSceneRow');
(Object.keys(backgroundScenes) as BackgroundScene[]).forEach((scene) => {
  const spec = backgroundScenes[scene];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button';
  button.dataset.bgScene = scene;
  button.setAttribute('aria-pressed', 'false');
  const swatch = document.createElement('span');
  swatch.className = 'bg-swatch';
  swatch.setAttribute('aria-hidden', 'true');
  if (spec.kind === 'color' && spec.color) swatch.style.background = spec.color;
  else if (spec.kind === 'gradient' && spec.from && spec.to) swatch.style.background = `linear-gradient(135deg, ${spec.from}, ${spec.to})`;
  else if (spec.kind === 'blank') swatch.style.background = 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%)';
  else if (spec.kind === 'blur') swatch.style.background = 'linear-gradient(90deg, #bbb, #eee)';
  else swatch.style.background = '#d9f1ed';
  button.append(swatch, document.createTextNode(spec.label));
  bgSceneRow?.append(button);
});
const isBackgroundScene = (value: string): value is BackgroundScene => Object.prototype.hasOwnProperty.call(sceneLabels, value);
const sceneLoads = new Map<BackgroundScene, Promise<HTMLImageElement | null>>();
const loadedSceneImages = new Map<BackgroundScene, HTMLImageElement>();
let selfieSegmenterPromise: Promise<SelfieSegmentationInstance | null> | null = null;
let segmentQueue: Promise<void> = Promise.resolve();

const loadSceneImage = (scene: BackgroundScene): Promise<HTMLImageElement | null> => {
  const pending = sceneLoads.get(scene);
  if (pending) return pending;
  const load = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image.naturalWidth ? image : null);
    image.onerror = () => resolve(null);
    const spec = backgroundScenes[scene];
    if (spec.kind !== 'photo' || !spec.url) {
      resolve(null);
      return;
    }
    image.src = spec.url;
  });
  sceneLoads.set(scene, load);
  void load.then((image) => {
    if (!image) sceneLoads.delete(scene);
  });
  return load;
};

const drawCover = (
  target: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  target.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

const maskToAlpha = (mask: MaskSource): HTMLCanvasElement => {
  const width = Math.max(1, mask.width);
  const height = Math.max(1, mask.height);
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const maskContext = output.getContext('2d', { willReadFrequently: true });
  if (!maskContext) return output;
  maskContext.drawImage(mask, 0, 0, width, height);
  const pixels = maskContext.getImageData(0, 0, width, height);
  let transparent = 0;
  const step = Math.max(4, Math.floor(pixels.data.length / 4000) * 4);
  for (let index = 0; index < pixels.data.length; index += step) {
    if (pixels.data[index + 3] < 250) transparent += 1;
  }
  if (transparent < 4) {
    for (let index = 0; index < pixels.data.length; index += 4) {
      const confidence = Math.max(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
      pixels.data[index] = 255;
      pixels.data[index + 1] = 255;
      pixels.data[index + 2] = 255;
      pixels.data[index + 3] = confidence;
    }
    maskContext.putImageData(pixels, 0, 0);
  }
  return output;
};

const loadSelfieSegmenter = (): Promise<SelfieSegmentationInstance | null> => {
  if (selfieSegmenterPromise) return selfieSegmenterPromise;
  const pending = new Promise<SelfieSegmentationInstance | null>((resolve) => {
    const start = (Constructor: SelfieSegmentationConstructor | undefined): void => {
      if (!Constructor) {
        resolve(null);
        return;
      }
      try {
        const segmenter = new Constructor({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });
        segmenter.setOptions({ modelSelection: phoneDevice ? 0 : 1, selfieMode: false });
        resolve(segmenter);
      } catch {
        resolve(null);
      }
    };
    const existing = (window as Window & { SelfieSegmentation?: SelfieSegmentationConstructor }).SelfieSegmentation;
    if (existing) {
      start(existing);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => start((window as Window & { SelfieSegmentation?: SelfieSegmentationConstructor }).SelfieSegmentation);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  selfieSegmenterPromise = pending.then((segmenter) => {
    if (!segmenter) selfieSegmenterPromise = null;
    return segmenter;
  });
  return selfieSegmenterPromise;
};

const segmentationInput = async (image: HTMLImageElement): Promise<{ image: HTMLImageElement; release: () => void }> => {
  const releaseNothing = (): void => undefined;
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const limit = phoneDevice ? 480 : 640;
  if (!longest || longest <= limit) return { image, release: releaseNothing };
  const scale = limit / longest;
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(1, Math.round(image.naturalWidth * scale));
  scratch.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const scratchContext = scratch.getContext('2d');
  if (!scratchContext) return { image, release: releaseNothing };
  scratchContext.drawImage(image, 0, 0, scratch.width, scratch.height);
  const blob = await new Promise<Blob | null>((resolve) => scratch.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) return { image, release: releaseNothing };
  const url = URL.createObjectURL(blob);
  try {
    const small = new Image();
    await new Promise<void>((resolve, reject) => {
      small.onload = () => resolve();
      small.onerror = () => reject();
      small.src = url;
    });
    return { image: small, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return { image, release: releaseNothing };
  }
};

const segmentPerson = (image: HTMLImageElement, generation: number): Promise<HTMLCanvasElement | null> => {
  const run = segmentQueue.then(async () => {
    const segmenter = await loadSelfieSegmenter();
    if (!segmenter || generation !== imageGeneration) return null;
    const source = await segmentationInput(image);
    const readMask = (input: HTMLImageElement) => new Promise<HTMLCanvasElement | null>((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), phoneDevice ? 45000 : 20000);
      let settled = false;
      const finish = (mask: HTMLCanvasElement | null): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(mask);
      };
      segmenter.onResults((results) => {
        try {
          const mask = results.segmentationMask;
          finish(mask && generation === imageGeneration ? maskToAlpha(mask) : null);
        } catch {
          finish(null);
        }
      });
      void segmenter.send({ image: input }).catch(() => finish(null));
    });
    const mask = await readMask(source.image);
    source.release();
    if (mask || source.image === image) return mask;
    return readMask(image);
  });
  segmentQueue = run.then(() => undefined, () => undefined);
  return run;
};

const ensurePersonMask = (image: HTMLImageElement, generation: number): Promise<HTMLCanvasElement | null> => {
  if (personMask && maskPromiseGeneration === generation) return Promise.resolve(personMask);
  if (maskPromise && maskPromiseGeneration === generation) return maskPromise;
  maskPromiseGeneration = generation;
  maskPromise = segmentPerson(image, generation).then((mask) => {
    if (generation !== imageGeneration) return null;
    personMask = mask;
    return mask;
  });
  return maskPromise;
};

const setSceneButtons = (scene: BackgroundScene | null): void => {
  document.querySelectorAll<HTMLButtonElement>('[data-bg-scene]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.bgScene === scene));
  });
};

const drawSceneBehindPerson = (
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
): void => {
  if (!activeBackgroundScene || !personMask || !context || !canvas || !originalImage) {
    canvas?.classList.remove('is-blank');
    return;
  }
  const spec = backgroundScenes[activeBackgroundScene];
  const sceneImage = loadedSceneImages.get(activeBackgroundScene);
  if (spec.kind === 'photo' && !sceneImage?.naturalWidth) return;
  const width = canvas.width;
  const height = canvas.height;
  const snapshot = document.createElement('canvas');
  snapshot.width = width;
  snapshot.height = height;
  snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
  const personLayer = document.createElement('canvas');
  personLayer.width = width;
  personLayer.height = height;
  const personContext = personLayer.getContext('2d');
  if (!personContext) return;
  personContext.drawImage(snapshot, 0, 0);
  personContext.globalCompositeOperation = 'destination-in';
  personContext.filter = 'none';
  const feather = document.createElement('canvas');
  feather.width = personMask.width;
  feather.height = personMask.height;
  const featherContext = feather.getContext('2d', { willReadFrequently: true });
  const maskSource = featherContext ? feather : personMask;
  if (featherContext) {
    featherContext.drawImage(personMask, 0, 0);
    paintFilterPixels(featherContext, `blur(${Math.max(1, personMask.width * 0.004).toFixed(2)}px)`);
  }
  personContext.drawImage(
    maskSource,
    (sourceX / originalImage.naturalWidth) * personMask.width,
    (sourceY / originalImage.naturalHeight) * personMask.height,
    (sourceWidth / originalImage.naturalWidth) * personMask.width,
    (sourceHeight / originalImage.naturalHeight) * personMask.height,
    destX,
    destY,
    destWidth,
    destHeight,
  );
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.filter = 'none';
  context.clearRect(0, 0, width, height);
  canvas.classList.toggle('is-blank', spec.kind === 'blank');
  if (spec.kind === 'color' && spec.color) {
    context.fillStyle = spec.color;
    context.fillRect(0, 0, width, height);
  } else if (spec.kind === 'gradient' && spec.from && spec.to) {
    const wash = context.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, spec.from);
    wash.addColorStop(1, spec.to);
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);
  } else if (spec.kind === 'blur') {
    context.drawImage(snapshot, 0, 0);
    paintFilterPixels(context, `blur(${Math.max(10, width * 0.018).toFixed(1)}px)`);
  } else if (spec.kind === 'photo' && sceneImage) {
    drawCover(context, sceneImage, 0, 0, width, height);
  }
  context.drawImage(personLayer, 0, 0);
  context.restore();
};

const paintHomeEffect = (): void => {
  if (!activeHomeEffect || !context || !canvas) return;
  const width = canvas.width;
  const height = canvas.height;
  const effect = activeHomeEffect;
  const snapshot = (): HTMLCanvasElement => {
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    copy.getContext('2d')?.drawImage(canvas, 0, 0);
    return copy;
  };
  const blurBehindSubject = (amount: number, radiusX: number, radiusY: number): void => {
    const sharp = snapshot();
    const blurred = document.createElement('canvas');
    blurred.width = width;
    blurred.height = height;
    const blurredContext = blurred.getContext('2d');
    if (!blurredContext) return;
    blurredContext.filter = 'none';
    blurredContext.drawImage(sharp, 0, 0);
    paintFilterPixels(blurredContext, `blur(${amount}px)`);
    context.save();
    context.filter = 'none';
    context.drawImage(blurred, 0, 0);
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.46, width * radiusX, height * radiusY, 0, 0, Math.PI * 2);
    context.clip();
    context.drawImage(sharp, 0, 0);
    context.restore();
  };
  if (effect === 'smooth-skin') {
    const source = snapshot();
    drawFilteredSource(context, source, 'blur(0.8px) brightness(1.05)', 0, 0, width, height, 0, 0, width, height);
    return;
  }
  if (effect === 'eyelashes') {
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = 'rgba(8, 4, 6, 0.9)';
    context.beginPath();
    context.ellipse(width * 0.38, height * 0.4, width * 0.11, height * 0.028, -0.2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(width * 0.62, height * 0.4, width * 0.11, height * 0.028, 0.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  if (effect === 'acne' || effect === 'ai-retouch') {
    const soft = snapshot();
    const softContext = soft.getContext('2d');
    if (!softContext) return;
    softContext.clearRect(0, 0, width, height);
    softContext.filter = 'blur(14px)';
    softContext.drawImage(canvas, 0, 0);
    context.save();
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.46, width * 0.3, height * 0.34, 0, 0, Math.PI * 2);
    context.clip();
    context.globalAlpha = effect === 'ai-retouch' ? 0.78 : 0.72;
    context.drawImage(soft, 0, 0);
    context.restore();
    if (effect === 'acne') {
      context.save();
      context.beginPath();
      context.ellipse(width * 0.5, height * 0.46, width * 0.3, height * 0.34, 0, 0, Math.PI * 2);
      context.clip();
      context.globalCompositeOperation = 'soft-light';
      context.fillStyle = 'rgba(255, 214, 196, 0.7)';
      context.fillRect(0, 0, width, height);
      context.restore();
    }
    if (effect === 'ai-retouch') {
      context.save();
      context.globalCompositeOperation = 'soft-light';
      context.fillStyle = 'rgba(255, 228, 206, 0.35)';
      context.fillRect(0, 0, width, height);
      context.restore();
    }
    return;
  }
  if (effect === 'double-chin' || effect === 'body') {
    try {
      const source = context.getImageData(0, 0, width, height);
      const output = context.createImageData(width, height);
      output.data.set(source.data);
      const centerX = width * (effect === 'body' ? 0.5 : 0.5);
      const centerY = height * (effect === 'body' ? 0.62 : 0.74);
      const radiusX = width * (effect === 'body' ? 0.28 : 0.24);
      const radiusY = height * (effect === 'body' ? 0.16 : 0.1);
      const pull = height * (effect === 'body' ? 0.06 : 0.1);
      for (let y = Math.max(0, Math.floor(centerY - radiusY)); y < Math.min(height, Math.ceil(centerY + radiusY)); y += 1) {
        for (let x = Math.max(0, Math.floor(centerX - radiusX)); x < Math.min(width, Math.ceil(centerX + radiusX)); x += 1) {
          const nx = (x - centerX) / radiusX;
          const ny = (y - centerY) / radiusY;
          const distance = nx * nx + ny * ny;
          if (distance >= 1) continue;
          const sampleY = Math.max(0, Math.min(height - 1, Math.round(y + (1 - distance) * pull)));
          const from = (sampleY * width + x) * 4;
          const to = (y * width + x) * 4;
          output.data[to] = source.data[from];
          output.data[to + 1] = source.data[from + 1];
          output.data[to + 2] = source.data[from + 2];
          output.data[to + 3] = source.data[from + 3];
        }
      }
      context.putImageData(output, 0, 0);
    } catch {
      showToast('This photo could not be reshaped in the browser.');
    }
    return;
  }
  if (effect === 'remover' || effect === 'removal') {
    blurBehindSubject(18, effect === 'removal' ? 0.22 : 0.28, effect === 'removal' ? 0.32 : 0.38);
    return;
  }
  if (effect === 'slim') {
    const sharp = snapshot();
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f4f4f5';
    context.fillRect(0, 0, width, height);
    const drawnWidth = width * 0.88;
    context.drawImage(sharp, (width - drawnWidth) / 2, 0, drawnWidth, height);
    return;
  }
  if (effect === 'lipstick') {
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = 'rgba(176, 24, 48, 0.75)';
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.58, width * 0.07, height * 0.016, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  if (effect === 'red-light') {
    context.save();
    context.globalCompositeOperation = 'screen';
    const glow = context.createRadialGradient(width * 0.12, height * 0.35, width * 0.02, width * 0.2, height * 0.4, width * 0.55);
    glow.addColorStop(0, 'rgba(255, 36, 64, 0.55)');
    glow.addColorStop(1, 'rgba(255, 36, 64, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'soft-light';
    context.fillStyle = 'rgba(70, 130, 255, 0.28)';
    context.fillRect(width * 0.35, 0, width * 0.65, height);
    context.restore();
    return;
  }
  context.save();
  context.globalCompositeOperation = 'soft-light';
  const warm = context.createLinearGradient(0, 0, 0, height);
  warm.addColorStop(0, 'rgba(255, 186, 72, 0.55)');
  warm.addColorStop(1, 'rgba(214, 96, 32, 0.35)');
  context.fillStyle = warm;
  context.fillRect(0, 0, width, height);
  context.restore();
};

let holdCompare = false;

const render = (): void => {
  if (!originalImage || !context || !canvas) return;
  const sourceImage = originalImage;
  const width = canvas.width;
  const height = canvas.height;
  if (holdCompare) {
    context.save();
    context.filter = 'none';
    context.clearRect(0, 0, width, height);
    context.drawImage(sourceImage, 0, 0, width, height);
    context.restore();
    return;
  }
  const sourceRatio = originalImage.naturalWidth / originalImage.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = originalImage.naturalWidth;
  let sourceHeight = originalImage.naturalHeight;
  let destX = 0;
  let destY = 0;
  let destWidth = width;
  let destHeight = height;
  const enhancement = Number(enhanceSlider?.value ?? 100) / 100;
  const enhancementFilter = aiEnhanceEnabled
    ? 'brightness(1.1) contrast(1.15) saturate(1.2)'
    : `brightness(${enhancement}) contrast(${enhancement}) saturate(${enhancement})`;
  const selectedFilter = composeCanvasFilters(lookFilter(photoFilter?.value ?? 'original'), enhancementFilter);
  if (photoRatio?.value.startsWith('expand-')) {
    const scale = Math.min(width / originalImage.naturalWidth, height / originalImage.naturalHeight);
    sourceWidth = originalImage.naturalWidth;
    sourceHeight = originalImage.naturalHeight;
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    sourceX = 0;
    sourceY = 0;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    destX = drawX;
    destY = drawY;
    destWidth = drawWidth;
    destHeight = drawHeight;
    context.clearRect(0, 0, width, height);
    context.fillStyle = editBackground?.value ?? '#ffffff';
    context.fillRect(0, 0, width, height);
    drawFilteredSource(context, originalImage, selectedFilter, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
  } else {
    if (sourceRatio > targetRatio) {
      sourceWidth = originalImage.naturalHeight * targetRatio;
      sourceX = (originalImage.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = originalImage.naturalWidth / targetRatio;
      sourceY = (originalImage.naturalHeight - sourceHeight) / 2;
    }
    context.clearRect(0, 0, width, height);
    context.fillStyle = editBackground?.value ?? '#ffffff';
    context.fillRect(0, 0, width, height);
    drawFilteredSource(context, originalImage, selectedFilter, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  }
  context.filter = 'none';
  applyPhotoAdjustments(context, canvas);

  const tolerance = Number(cutoutTolerance?.value ?? 0) * 4.4;
  const hairAmount = Number(hairStrength?.value ?? 0) / 100;
  if (tolerance > 0 || hairAmount > 0) {
    try {
      const pixels = context.getImageData(0, 0, width, height);
      const color = cutoutColor?.value ?? '#ffffff';
      const cutout = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
      const tintColor = hairTint?.value ?? '#784b32';
      const tint = [1, 3, 5].map((offset) => Number.parseInt(tintColor.slice(offset, offset + 2), 16));
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const red = pixels.data[index];
          const green = pixels.data[index + 1];
          const blue = pixels.data[index + 2];
          if (tolerance > 0) {
            const distance = Math.hypot(red - cutout[0], green - cutout[1], blue - cutout[2]);
            if (distance < tolerance) pixels.data[index + 3] = 0;
          }
          if (hairAmount > 0 && y < height * 0.62 && red + green + blue < 440) {
            pixels.data[index] = red + (tint[0] - red) * hairAmount;
            pixels.data[index + 1] = green + (tint[1] - green) * hairAmount;
            pixels.data[index + 2] = blue + (tint[2] - blue) * hairAmount;
          }
        }
      }
      if (tolerance > 0) {
        const cutoutLayer = document.createElement('canvas');
        cutoutLayer.width = width;
        cutoutLayer.height = height;
        cutoutLayer.getContext('2d')?.putImageData(pixels, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = editBackground?.value ?? '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(cutoutLayer, 0, 0);
      } else {
        context.putImageData(pixels, 0, 0);
      }
    } catch {
      showToast('This photo is too large for these adjustments in the browser.');
    }
  }

  const warpRegion = (centerX: number, centerY: number, radiusXFactor: number, radiusYFactor: number, amount: number): void => {
    if (!amount) return;
    try {
      const frame = context.getImageData(0, 0, width, height);
      const source = new Uint8ClampedArray(frame.data);
      const pixelCenterX = width * centerX;
      const verticalCenter = height * centerY;
      const radiusX = Math.max(2, width * radiusXFactor);
      const radiusY = Math.max(2, height * radiusYFactor);
      const compression = 1 - amount;
      for (let y = Math.max(0, Math.floor(verticalCenter - radiusY)); y < Math.min(height, verticalCenter + radiusY); y += 1) {
        for (let x = Math.max(0, Math.floor(pixelCenterX - radiusX)); x < Math.min(width, pixelCenterX + radiusX); x += 1) {
          const dx = (x - pixelCenterX) / radiusX;
          const dy = (y - verticalCenter) / radiusY;
          const distance = dx * dx + dy * dy;
          if (distance >= 1) continue;
          const falloff = (1 - distance) ** 2;
          const sampleX = Math.max(0, Math.min(width - 1, pixelCenterX + (x - pixelCenterX) / (1 - (1 - compression) * falloff)));
          const x0 = Math.floor(sampleX);
          const x1 = Math.min(width - 1, x0 + 1);
          const blend = sampleX - x0;
          const target = (y * width + x) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            const left = source[(y * width + x0) * 4 + channel];
            const right = source[(y * width + x1) * 4 + channel];
            frame.data[target + channel] = left + (right - left) * blend;
          }
        }
      }
      context.putImageData(frame, 0, 0);
    } catch {
      showToast('This photo is too large for shape adjustments in the browser.');
    }
  };
  const mapFacePoint = (point: FacePoint): FacePoint => {
    if (photoRatio?.value.startsWith('expand-')) {
      const scale = Math.min(width / sourceImage.naturalWidth, height / sourceImage.naturalHeight);
      return {
        x: (width - sourceImage.naturalWidth * scale) / (2 * width) + point.x * sourceImage.naturalWidth * scale / width,
        y: (height - sourceImage.naturalHeight * scale) / (2 * height) + point.y * sourceImage.naturalHeight * scale / height,
      };
    }
    return {
      x: Math.max(0, Math.min(1, (point.x * sourceImage.naturalWidth - sourceX) / sourceWidth)),
      y: Math.max(0, Math.min(1, (point.y * sourceImage.naturalHeight - sourceY) / sourceHeight)),
    };
  };
  const smoothAmount = Number(smoothSlider?.value ?? 0);
  if (smoothAmount > 0 && context) {
    const faceLoop = (indices: number[]): FacePoint[] => {
      if (!faceMeshLandmarks) return [];
      return indices.map((index) => faceMeshLandmarks?.[index]).filter((point): point is FacePoint => !!point).map(mapFacePoint);
    };
    const oval = faceLoop(faceOval);
    const eyes = [faceLoop(leftEyeLoop), faceLoop(rightEyeLoop)].filter((loop) => loop.length >= 6);
    const mouth = faceLoop(lipOuter);
    smoothSkin(context, smoothAmount, oval.length >= 8 ? { oval, eyes, mouth } : null);
  }
  const teethAmount = Number(teethSlider?.value ?? 0);
  if (teethAmount > 0 && faceMeshLandmarks && context) {
    const mouth = mouthLoop.map((index) => faceMeshLandmarks?.[index]).filter((point): point is FacePoint => !!point).map(mapFacePoint);
    teethPixels = whitenTeeth(context, mouth, teethAmount);
  } else {
    teethPixels = 0;
  }
  const rawBridge = faceMeshLandmarks?.[168];
  const rawTip = faceMeshLandmarks?.[1];
  const rawLeftNostril = faceMeshLandmarks?.[98];
  const rawRightNostril = faceMeshLandmarks?.[327];
  const noseBridge = rawBridge ? mapFacePoint(rawBridge) : null;
  const noseTip = rawTip ? mapFacePoint(rawTip) : null;
  const leftNostril = rawLeftNostril ? mapFacePoint(rawLeftNostril) : null;
  const rightNostril = rawRightNostril ? mapFacePoint(rawRightNostril) : null;
  const hasNoseLandmarks = !!(noseBridge && noseTip && leftNostril && rightNostril);
  const noseCenterX = hasNoseLandmarks ? (leftNostril.x + rightNostril.x) / 2 : 0.5;
  const noseCenterY = hasNoseLandmarks ? (noseBridge.y + noseTip.y) / 2 : 0.53;
  const noseRadiusX = hasNoseLandmarks ? Math.max(0.025, Math.abs(rightNostril.x - leftNostril.x) * 0.75) : 0.085;
  const noseRadiusY = hasNoseLandmarks ? Math.max(0.035, Math.abs(noseTip.y - noseBridge.y) * 0.9) : 0.14;
  portraitGuides = {
    points: hasNoseLandmarks ? [noseBridge, noseTip, leftNostril, rightNostril] : null,
    cx: noseCenterX,
    cy: noseCenterY,
    rx: noseRadiusX,
    ry: noseRadiusY,
  };
  warpRegion(noseCenterX, noseCenterY, noseRadiusX, noseRadiusY, Number(noseSlider?.value ?? 0) / 100);
  warpRegion(0.5, 0.64, 0.22, 0.3, Number(bodyTuneSlider?.value ?? 0) / 30 * 0.2);
  warpRegion(0.5, 0.43, 0.16, 0.2, -Number(faceVolumeSlider?.value ?? 0) / 30 * 0.14);
  drawSceneBehindPerson(sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight);

  if (context && (textOverlays.length || timestampToggle?.checked)) {
    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgb(0 0 0 / 50%)';
    context.shadowBlur = Math.max(2, width * 0.004);
    const fontSize = Math.max(24, width * 0.055);
    context.font = `700 ${fontSize}px sans-serif`;
    context.fillStyle = '#ffffff';
    textOverlays.forEach((text, index) => context.fillText(text, width / 2, height * (0.78 - index * 0.07), width * 0.88));
    if (timestampToggle?.checked) {
      context.font = `600 ${Math.max(18, width * 0.026)}px sans-serif`;
      context.textAlign = 'left';
      context.fillText(new Date().toLocaleDateString(), width * 0.06, height * 0.93);
    }
    context.restore();
  }

  const brushSource = document.createElement('canvas');
  brushSource.width = width;
  brushSource.height = height;
  brushSource.getContext('2d')?.drawImage(canvas, 0, 0);
  brushStrokes.forEach((stroke) => {
    if (stroke.mode === 'heal') {
      const diameter = Math.max(8, stroke.size * width / 900);
      const radius = diameter / 2;
      stroke.points.forEach((point) => {
        const destinationX = point.x * width;
        const destinationY = point.y * height;
        const sourceOffset = Math.max(diameter * 3, width * 0.2);
        const sourceX = Math.max(0, Math.min(width - diameter, destinationX + sourceOffset));
        const sourceY = Math.max(0, Math.min(height - diameter, destinationY - radius));
        context.save();
        context.beginPath();
        context.arc(destinationX, destinationY, radius, 0, Math.PI * 2);
        context.clip();
        context.drawImage(brushSource, sourceX, sourceY, diameter, diameter, destinationX - radius, destinationY - radius, diameter, diameter);
        context.restore();
      });
      return;
    }
    if (stroke.points.length < 2) return;
    context.save();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size * width / 900;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    stroke.points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
    context.stroke();
    context.restore();
  });
  if (context) paintStickers(context, width, height);
  paintHomeEffect();
  updatePortraitGuides();
  placeStickerFrame();
};

const selectBackgroundScene = async (scene: BackgroundScene, scroll: boolean): Promise<void> => {
  if (originalImage && scene !== activeBackgroundScene) remember();
  activeBackgroundScene = scene;
  setSceneButtons(scene);
  if (creativeControls) creativeControls.hidden = false;
  if (scroll) {
    showEditor();
    byId<HTMLElement>('backgroundScenes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (!originalImage) {
    if (backgroundStatus) backgroundStatus.textContent = 'Choose a photo, then pick a scene.';
    showToast('Choose a photo to change the background.');
    upload?.click();
    return;
  }
  const generation = imageGeneration;
  const photo = originalImage;
  const loadingToken = showAiLoading();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
  if (generation !== imageGeneration || activeBackgroundScene !== scene) {
    hideAiLoading(loadingToken);
    return;
  }
  const spec = backgroundScenes[scene];
  const [sceneImage, mask] = await Promise.all([
    spec.kind === 'photo' ? loadSceneImage(scene) : Promise.resolve(null),
    ensurePersonMask(photo, generation),
  ]);
  if (generation !== imageGeneration || activeBackgroundScene !== scene) {
    hideAiLoading(loadingToken);
    return;
  }
  hideAiLoading(loadingToken);
  if (!mask || (spec.kind === 'photo' && !sceneImage)) {
    activeBackgroundScene = null;
    setSceneButtons(null);
    canvas?.classList.remove('is-blank');
    const offline = !navigator.onLine && spec.kind === 'photo';
    const reason = offline
      ? 'Background change needs a connection for the scene photo and the person cutout. Filters, Adjust, and crop still work offline.'
      : !mask
        ? 'The on-device model could not separate the person. Try another photo with one person.'
        : 'That scene photo did not load. Try the background again.';
    if (backgroundStatus) backgroundStatus.textContent = reason;
    showToast(offline ? 'Background needs a connection.' : 'AI background change could not finish.');
    render();
    return;
  }
  if (sceneImage) loadedSceneImages.set(scene, sceneImage);
  personMask = mask;
  render();
  if (backgroundStatus) backgroundStatus.textContent = `${sceneLabels[scene]} is behind the person.`;
};

let pendingSmooth: string | null = null;
let pendingTeeth: string | null = null;
let pendingApply: string | null = null;
let pendingGuideRequest: string | null = null;
let photoLoading = false;

const showYourPhoto = (src: string): void => {
  const thumb = byId<HTMLImageElement>('yourPhotoThumb');
  const status = byId<HTMLElement>('yourPhotoStatus');
  if (thumb) {
    thumb.hidden = false;
    thumb.src = src;
    thumb.alt = 'Your selected photo';
  }
  if (status) status.textContent = 'Your photo is selected. Tap a picture to apply that look.';
  const guideThumb = byId<HTMLImageElement>('guideThumb');
  const guideDropText = byId<HTMLElement>('guideDropText');
  if (guideThumb) {
    guideThumb.hidden = false;
    guideThumb.src = src;
    guideThumb.alt = 'Photo for the AI guide';
  }
  if (guideDropText) guideDropText.textContent = 'Photo ready. Tell me the edit, such as “beach background” or “smooth my skin”.';
};

const openPhoto = (src: string): void => {
  if (!canvas) return;
  photoLoading = true;
  closeCamera();
  if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
  imageUrl = src.startsWith('blob:') ? src : null;
  imageGeneration += 1;
  const generation = imageGeneration;
  personMask = null;
  maskPromise = null;
  const image = new Image();
  image.onload = () => {
    if (generation !== imageGeneration) return;
    originalImage = image;
    faceMeshLandmarks = null;
    aiEnhanceEnabled = false;
    textOverlays.length = 0;
    stickerOverlays.length = 0;
    brushStrokes.length = 0;
    currentBrush = null;
    selectedStickerId = 0;
    resetEditHistory();
    setPhotoCanvasSize();
    canvas.classList.add('has-image');
    if (emptyState) emptyState.hidden = true;
    if (downloadButton) downloadButton.disabled = false;
    const smoothAmount = pendingSmooth ?? '0';
    pendingSmooth = null;
    const teethAmount = pendingTeeth ?? '0';
    pendingTeeth = null;
    if (smoothSlider) smoothSlider.value = smoothAmount;
    if (teethSlider) teethSlider.value = teethAmount;
    if (noseSlider) noseSlider.value = '0';
    if (smoothValue) smoothValue.value = smoothAmount;
    if (teethValue) teethValue.value = teethAmount;
    if (smoothSlider) paintRange(smoothSlider);
    if (teethSlider) paintRange(teethSlider);
    byId<HTMLButtonElement>('teethToggle')?.setAttribute('aria-pressed', String(Number(teethAmount) > 0));
    if (noseValue) noseValue.value = '0';
    zeroAdjustControls();
    render();
    paintFilterPreviews();
    if (faceDetectionStatus) faceDetectionStatus.textContent = 'Detecting face landmarks on this device…';
    byId<HTMLElement>('canvasStage')?.classList.add('has-photo');
    showEditor();
    showYourPhoto(src);
    if (pendingCrop) {
      pendingCrop = false;
      openCrop();
    }
    const chosen = pendingApply;
    pendingApply = null;
    if (chosen) applyChosenLook(chosen);
    if (pendingPortrait) openPortrait(pendingPortrait);
    photoLoading = false;
    const queued = pendingGuideRequest;
    pendingGuideRequest = null;
    if (queued) answerGuide(queued);
    void detectFaceMesh(image).then((landmarks) => {
      if (generation !== imageGeneration) return;
      faceMeshLandmarks = landmarks;
      render();
      if (Number(teethSlider?.value ?? 0) <= 0) return;
      if (!landmarks) showToast('No face found, so teeth whitening is waiting. Your other edits still apply.');
      else if (teethPixels < 20) showToast('Use a photo where the teeth are showing.');
    });
    if (activeBackgroundScene) void selectBackgroundScene(activeBackgroundScene, false);
  };
  image.onerror = () => {
    photoLoading = false;
    showToast('That image could not be opened. Try another photo.');
  };
  if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
  image.src = src;
};

upload?.addEventListener('change', () => {
  const file = upload.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  openPhoto(URL.createObjectURL(file));
});

const cameraView = byId<HTMLElement>('cameraView');
const cameraVideo = byId<HTMLVideoElement>('cameraVideo');
const cameraFallback = byId<HTMLElement>('cameraFallback');
const cameraStatus = byId<HTMLElement>('cameraStatus');
const cameraShutter = byId<HTMLButtonElement>('cameraCapture');
type CameraMode = 'portrait' | 'live' | 'video';
let cameraMode: CameraMode = 'portrait';
let cameraStream: MediaStream | null = null;
let cameraFacing: 'user' | 'environment' = 'user';
let cameraSession = 0;
let cameraRecorder: MediaRecorder | null = null;
let cameraChunks: Blob[] = [];
let cameraRecording = false;
let liveStopTimer = 0;

const cameraModeLabel: Record<CameraMode, string> = {
  portrait: 'Portrait',
  live: 'Live',
  video: 'Video',
};

let suppressRecordingClose = false;

const stopCameraRecorder = (): void => {
  window.clearTimeout(liveStopTimer);
  if (cameraRecorder && cameraRecorder.state !== 'inactive') cameraRecorder.stop();
  cameraRecorder = null;
  cameraRecording = false;
  cameraShutter?.classList.remove('is-recording');
  if (cameraShutter) cameraShutter.setAttribute('aria-label', cameraMode === 'video' ? 'Record video' : 'Capture photo');
};

const stopCamera = (): void => {
  if (cameraRecorder && cameraRecorder.state === 'recording') suppressRecordingClose = true;
  stopCameraRecorder();
  stopLivePreview();
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (cameraVideo) cameraVideo.srcObject = null;
};

function closeCamera(): void {
  cameraSession += 1;
  stopCamera();
  if (cameraView) cameraView.hidden = true;
  if (cameraFallback) cameraFallback.hidden = true;
}

const setCameraMode = (mode: CameraMode): void => {
  const was = cameraMode;
  cameraMode = mode;
  document.querySelectorAll<HTMLButtonElement>('[data-camera-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.cameraMode === mode));
  });
  if (cameraStatus) cameraStatus.textContent = cameraModeLabel[mode];
  if (cameraShutter) cameraShutter.setAttribute('aria-label', mode === 'video' ? 'Record video' : 'Capture photo');
  if (was !== mode && cameraView && !cameraView.hidden) void openCamera();
};

const stillFromCamera = (): string | null => {
  const live = liveStill();
  if (live) return live;
  if (!cameraVideo?.videoWidth) return null;
  const shot = document.createElement('canvas');
  shot.width = cameraVideo.videoWidth;
  shot.height = cameraVideo.videoHeight;
  const shotContext = shot.getContext('2d');
  if (!shotContext) return null;
  shotContext.drawImage(cameraVideo, 0, 0);
  return shot.toDataURL('image/jpeg', 0.92);
};

const openCapturedVideo = (blob: Blob, note: string): void => {
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(blob);
  if (videoPreview) {
    videoPreview.src = videoUrl;
    videoPreview.load();
  }
  if (videoStudio) videoStudio.hidden = false;
  if (videoStatus) videoStatus.textContent = note;
  if (videoScreenshotButton) videoScreenshotButton.disabled = false;
  if (startVideoExportButton) startVideoExportButton.disabled = false;
};

const recorderMime = (): string => {
  const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) ?? '';
};

const startCameraRecording = (ms: number | null, onStop: (blob: Blob) => void): void => {
  const recorded = liveRecordStream(cameraStream) ?? cameraStream;
  if (!recorded || typeof MediaRecorder === 'undefined') {
    showToast('This phone cannot record video in the browser.');
    return;
  }
  cameraChunks = [];
  const mime = recorderMime();
  try {
    cameraRecorder = mime ? new MediaRecorder(recorded, { mimeType: mime }) : new MediaRecorder(recorded);
  } catch {
    showToast('This phone cannot record video in the browser.');
    return;
  }
  cameraRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) cameraChunks.push(event.data);
  };
  cameraRecorder.onstop = () => {
    const blob = new Blob(cameraChunks, { type: cameraRecorder?.mimeType || mime || 'video/webm' });
    const skipped = suppressRecordingClose;
    suppressRecordingClose = false;
    cameraRecording = false;
    cameraShutter?.classList.remove('is-recording');
    if (skipped) return;
    if (blob.size > 0) onStop(blob);
    else showToast('The recording was empty. Try again.');
  };
  cameraRecorder.start();
  cameraRecording = true;
  cameraShutter?.classList.add('is-recording');
  if (cameraStatus) cameraStatus.textContent = ms ? 'Live…' : 'Recording…';
  if (ms) liveStopTimer = window.setTimeout(() => stopCameraRecorder(), ms);
};

async function openCamera(): Promise<void> {
  noteTool('Camera');
  if (!cameraView || !cameraVideo) return;
  const session = cameraSession + 1;
  cameraSession = session;
  cameraView.hidden = false;
  if (cameraFallback) cameraFallback.hidden = true;
  stopCamera();
  if (cameraStatus) cameraStatus.textContent = cameraModeLabel[cameraMode];
  if (!navigator.mediaDevices?.getUserMedia) {
    if (cameraFallback) cameraFallback.hidden = false;
    return;
  }
  const phoneCamera = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
  const video = {
    facingMode: { ideal: cameraFacing },
    width: { ideal: phoneCamera ? 720 : 1280 },
    height: { ideal: phoneCamera ? 1280 : 720 },
    frameRate: { ideal: 30, max: 30 },
  };
  const withAudio = cameraMode !== 'portrait';
  try {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: withAudio });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraFacing } }, audio: false });
      }
    }
    if (session !== cameraSession) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cameraStream = stream;
    cameraVideo.srcObject = stream;
    cameraVideo.muted = true;
    cameraVideo.playsInline = true;
    await cameraVideo.play();
    if (session !== cameraSession) return;
    startLivePreview(cameraVideo, cameraFacing);
  } catch {
    if (session !== cameraSession) return;
    stopCamera();
    closeCamera();
    setStudioTab('filters');
    showToast('Camera permission is needed. Choose a photo instead.');
    if (!originalImage) requestPhoto();
  }
}

const captureCamera = (): void => {
  if (cameraMode === 'video') {
    if (cameraRecording) {
      const still = stillFromCamera();
      const mime = cameraRecorder?.mimeType || 'video/webm';
      if (cameraRecorder) {
        cameraRecorder.onstop = () => {
          const blob = new Blob(cameraChunks, { type: mime });
          cameraRecording = false;
          cameraShutter?.classList.remove('is-recording');
          closeCamera();
          if (blob.size > 0) openCapturedVideo(blob, 'Video recorded on this device. Pick a look, then export.');
          if (still) openPhoto(still);
          showToast('Video is in Video Studio. A still from it is open to edit.');
        };
      }
      stopCameraRecorder();
      return;
    }
    startCameraRecording(null, (blob) => {
      closeCamera();
      openCapturedVideo(blob, 'Video recorded on this device. Pick a look, then export.');
      showToast('Video is in Video Studio.');
    });
    return;
  }
  if (!cameraVideo || !cameraVideo.videoWidth) {
    showToast('The camera preview is not ready yet.');
    return;
  }
  if (cameraMode === 'live') {
    const still = stillFromCamera();
    const session = cameraSession;
    startCameraRecording(3000, (blob) => {
      openCapturedVideo(blob, 'Live clip recorded on this device, about 3 seconds.');
    });
    window.setTimeout(() => {
      if (session !== cameraSession) return;
      const baked = liveEffectsActive();
      closeCamera();
      if (still) {
        pendingSmooth = baked ? '0' : '48';
        openPhoto(still);
        setStudioTab('filters');
      }
      showToast('Live still is open. The short clip is in Video Studio.');
    }, 3200);
    return;
  }
  const still = stillFromCamera();
  if (!still) return;
  pendingSmooth = liveEffectsActive() ? '0' : '48';
  closeCamera();
  setStudioTab('filters');
  openPhoto(still);
};

byId<HTMLButtonElement>('navHome')?.addEventListener('click', () => {
  closeCamera();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
byId<HTMLButtonElement>('navCamera')?.addEventListener('click', () => {
  console.log('filter', 'camera');
  markDock('Camera');
  noteTool('Camera');
  void openCamera();
});
byId<HTMLButtonElement>('navTemplates')?.addEventListener('click', () => {
  const title = document.getElementById('templatesTitle');
  if (!title) return;
  document.querySelectorAll<HTMLElement>('.home-section').forEach((section) => {
    section.style.contentVisibility = 'visible';
  });
  const top = title.getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
});

const openNamedTool = (tool: string): void => {
  document.querySelector<HTMLButtonElement>(`[data-tool="${tool}"]`)?.click();
};

const applyAutoBeauty = (): void => {
  remember();
  activeHomeEffect = null;
  if (photoFilter) photoFilter.value = 'beauty';
  syncFilterChips();
  if (smoothSlider) {
    smoothSlider.value = '72';
    if (smoothValue) smoothValue.value = '72';
    paintRange(smoothSlider);
  }
  applyAutoAdjust(true);
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = 'Auto Beauty';
  markDock('Auto Beauty');
  noteTool('Retouch');
  noteEdit();
  if (!originalImage) {
    showToast('Choose a photo. Auto Beauty will apply to it.');
    requestPhoto();
    return;
  }
  showToast('Auto Beauty applied.');
};

const applyEffectLook = (): void => {
  activeHomeEffect = null;
  if (photoFilter) photoFilter.value = 'glow';
  syncFilterChips();
  setStudioTab('filters');
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = 'Effects';
  markDock('Effects');
  noteTool('Filters');
  if (originalImage) {
    render();
    showToast('Glow effect applied. Hold the photo to compare.');
    return;
  }
  showToast('Choose a photo for this effect.');
  requestPhoto();
};

document.querySelectorAll<HTMLButtonElement>('[data-dock]').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.dock ?? '';
    if (name === 'Camera') {
      console.log('filter', 'camera');
      markDock('Camera');
      noteTool('Camera');
      void openCamera();
      return;
    }
    if (name === 'Compare') return;
    if (name === 'More') {
      openTools();
      return;
    }
    if (name === 'Profile') {
      if (accountSheet instanceof HTMLDialogElement) accountSheet.showModal();
      return;
    }
    if (name === 'Auto Beauty') {
      applyAutoBeauty();
      return;
    }
    if (name === 'Effects') {
      applyEffectLook();
      return;
    }
    if (name === 'Filters' || name === 'Adjust') {
      activeHomeEffect = null;
      setStudioTab(name === 'Filters' ? 'filters' : 'adjust');
      if (!originalImage) requestPhoto();
      return;
    }
    if (name === 'Beauty') {
      markDock('Beauty');
      openPortrait('retouch');
      return;
    }
    markDock(name);
    openNamedTool(name);
  });
});

const compareControl = document.querySelector<HTMLButtonElement>('[data-dock="Compare"]');
const setCompare = (on: boolean): void => {
  if (!originalImage) return;
  holdCompare = on;
  compareControl?.setAttribute('aria-pressed', String(on));
  render();
};
const bindCompare = (element: HTMLElement | null): void => {
  if (!element) return;
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    setCompare(true);
  });
  const stop = (): void => setCompare(false);
  element.addEventListener('pointerup', stop);
  element.addEventListener('pointercancel', stop);
  element.addEventListener('pointerleave', stop);
};
canvas?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || brushEnabled || !originalImage) return;
  const point = brushPoint(event);
  if (point && hitSticker(point.x, point.y)) return;
  setCompare(true);
});
const stopCompare = (): void => setCompare(false);
canvas?.addEventListener('pointerup', stopCompare);
canvas?.addEventListener('pointercancel', stopCompare);
canvas?.addEventListener('pointerleave', stopCompare);
bindCompare(compareControl);

document.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!originalImage || !photoRatio || !downloadButton || downloadButton.disabled) {
      showToast('Choose a photo before exporting.');
      requestPhoto();
      return;
    }
    const preset = button.dataset.export;
    photoRatio.value = preset === 'post' ? 'id' : preset === 'story' ? 'expand-story' : 'free';
    photoRatio.dispatchEvent(new Event('change'));
    document.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    downloadButton.click();
  });
});

const accountKey = 'editsbeauty-account';
const looksKey = 'editsbeauty-saved-looks';
const accountSheet = document.getElementById('accountSheet');
const accountStatus = document.getElementById('accountStatus');
type LocalAccount = { email: string; name: string; photo: string; token: string; provider: 'email' | 'google' | 'x'; synced: boolean };
type SavedLook = { name: string; look: string; smooth: string };
type AccountPayload = { ok?: boolean; error?: string; email?: string; name?: string; photo?: string; looks?: SavedLook[]; token?: string };

const accountEndpoint = (): string => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === 'editsbeauty.vercel.app') return new URL('/api/account', window.location.origin).href;
  return 'https://editsbeauty.vercel.app/api/account';
};

const readAccount = (): LocalAccount | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(accountKey) ?? 'null') as LocalAccount | null;
    return parsed && typeof parsed.email === 'string' ? parsed : null;
  } catch {
    return null;
  }
};

const writeAccount = (account: LocalAccount): void => {
  localStorage.setItem(accountKey, JSON.stringify(account));
};

const readLooks = (): SavedLook[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(looksKey) ?? '[]') as SavedLook[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLooks = (looks: SavedLook[]): void => {
  localStorage.setItem(looksKey, JSON.stringify(looks.slice(0, 12)));
};

const paintAccount = (): void => {
  const account = readAccount();
  const preview = document.getElementById('profilePreview');
  if (preview instanceof HTMLImageElement) {
    preview.hidden = !account?.photo;
    preview.src = account?.photo ?? '';
  }
  const name = document.getElementById('profileName');
  const email = document.getElementById('profileEmail');
  if (name instanceof HTMLInputElement && account) name.value = account.name;
  if (email instanceof HTMLInputElement && account) email.value = account.email;
  if (accountStatus) {
    if (!account) accountStatus.textContent = 'Sign in with email and password to come back after the app is deleted. Editing photos are not uploaded. Google and X are not connected yet.';
    else if (account.synced) accountStatus.textContent = `Signed in as ${account.name || account.email}. The same email and password work again after the app is deleted. Editing photos stay on this device.`;
    else accountStatus.textContent = `Saved on this device as ${account.name || account.email}. The sign-in service is not connected, so deleting the app removes this password.`;
  }
  const list = document.getElementById('savedLooks');
  if (!list) return;
  list.replaceChildren();
  readLooks().forEach((look) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = look.name;
    button.addEventListener('click', () => {
      if (photoFilter) photoFilter.value = look.look;
      if (smoothSlider) smoothSlider.value = look.smooth;
      if (smoothValue) smoothValue.value = look.smooth;
      if (smoothSlider) paintRange(smoothSlider);
      syncFilterChips();
      showEditor();
      render();
      if (accountSheet instanceof HTMLDialogElement) accountSheet.close();
      showToast(`${look.name} applied.`);
    });
    list.append(button);
  });
};

const applyServerAccount = (payload: AccountPayload, fallbackName: string): void => {
  const account: LocalAccount = {
    email: payload.email ?? '',
    name: payload.name || fallbackName,
    photo: payload.photo ?? '',
    token: payload.token ?? '',
    provider: 'email',
    synced: true,
  };
  writeAccount(account);
  if (Array.isArray(payload.looks)) writeLooks(payload.looks);
  paintAccount();
};

const pushAccount = async (patch: { name?: string; photo?: string; looks?: SavedLook[] }): Promise<boolean> => {
  const account = readAccount();
  if (!account?.synced || !account.token) return false;
  try {
    const response = await fetch(accountEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` },
      body: JSON.stringify({ action: 'update', ...patch }),
    });
    const payload = await response.json() as AccountPayload;
    if (!response.ok || !payload.ok) return false;
    applyServerAccount(payload, account.name);
    return true;
  } catch {
    return false;
  }
};

document.getElementById('accountForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');
    const passwordInput = document.getElementById('profilePassword');
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : '';
    const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
    if (!email || password.length < 6) {
      if (accountStatus) accountStatus.textContent = 'Use an email and a password of at least 6 characters.';
      return;
    }
    if (accountStatus) accountStatus.textContent = 'Signing in…';
    try {
      const response = await fetch(accountEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign-in', email, password, name }),
      });
      const payload = await response.json() as AccountPayload;
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = '';
      if (response.ok && payload.ok && payload.token) {
        applyServerAccount(payload, name || email);
        showToast('Signed in. This password works again after the app is deleted.');
        return;
      }
      if (payload.error === 'password') {
        if (accountStatus) accountStatus.textContent = 'That password does not match this email.';
        return;
      }
      if (payload.error !== 'unconfigured') {
        if (accountStatus) accountStatus.textContent = 'Sign-in did not finish. Try again.';
        return;
      }
    } catch {
      // The service is unreachable. A saved sign-in is left as it is.
    }
    const existing = readAccount();
    if (existing?.synced) {
      if (accountStatus) accountStatus.textContent = 'Sign-in could not reach the server. Try again when you are online. This password is already saved for the next time.';
      return;
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${email.toLowerCase()}\n${password}`));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (existing && existing.email.toLowerCase() === email.toLowerCase() && existing.token && existing.token !== hash && !existing.synced) {
      if (accountStatus) accountStatus.textContent = 'That password does not match the one saved on this device.';
      return;
    }
    writeAccount({ email, name: name || existing?.name || email, photo: existing?.photo ?? '', token: hash, provider: 'email', synced: false });
    if (passwordInput instanceof HTMLInputElement) passwordInput.value = '';
    paintAccount();
  })();
});

document.getElementById('accountOut')?.addEventListener('click', () => {
  localStorage.removeItem(accountKey);
  paintAccount();
});
document.getElementById('accountClose')?.addEventListener('click', () => {
  if (accountSheet instanceof HTMLDialogElement) accountSheet.close();
});
document.getElementById('profilePhoto')?.addEventListener('change', () => {
  const input = document.getElementById('profilePhoto');
  const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
  const account = readAccount();
  if (!file || !account) {
    if (accountStatus && !account) accountStatus.textContent = 'Sign in before adding a profile photo.';
    return;
  }
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    const copy = document.createElement('canvas');
    copy.width = 96;
    copy.height = 96;
    const copyContext = copy.getContext('2d');
    if (!copyContext) return;
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    copyContext.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 96, 96);
    account.photo = copy.toDataURL('image/jpeg', 0.7);
    writeAccount(account);
    URL.revokeObjectURL(url);
    paintAccount();
    void pushAccount({ photo: account.photo });
  };
  image.src = url;
});
document.getElementById('accountLook')?.addEventListener('click', () => {
  if (!readAccount()) {
    if (accountStatus) accountStatus.textContent = 'Sign in before saving a Look.';
    return;
  }
  const look: SavedLook = {
    name: photoFilter?.value || 'Look',
    look: photoFilter?.value ?? 'original',
    smooth: smoothSlider?.value ?? '0',
  };
  const looks = readLooks().filter((item) => item.look !== look.look);
  looks.unshift(look);
  writeLooks(looks);
  paintAccount();
  void pushAccount({ looks: looks.slice(0, 12) }).then((saved) => {
    showToast(saved ? 'Look saved with your sign-in.' : 'Look saved on this device.');
  });
});
paintAccount();
document.querySelectorAll<HTMLButtonElement>('[data-camera-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.cameraMode;
    if (mode === 'portrait' || mode === 'live' || mode === 'video') setCameraMode(mode);
  });
});
byId<HTMLButtonElement>('cameraClose')?.addEventListener('click', closeCamera);
byId<HTMLButtonElement>('cameraFlip')?.addEventListener('click', () => {
  cameraFacing = cameraFacing === 'user' ? 'environment' : 'user';
  void openCamera();
});
byId<HTMLButtonElement>('cameraCapture')?.addEventListener('click', captureCamera);
document.querySelectorAll<HTMLButtonElement>('[data-open-tools]').forEach((button) => {
  button.addEventListener('click', openTools);
});
let lastLookTap = 0;
const selectLook = (chip: HTMLButtonElement): void => {
  const now = Date.now();
  if (now - lastLookTap < 350) return;
  lastLookTap = now;
  if (!chip.dataset.look || !photoFilter) return;
  noteTool('Filters');
  noteEdit();
  remember();
  activeHomeEffect = null;
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = 'Filters';
  photoFilter.value = chip.dataset.look;
  if (chip.dataset.look === 'beauty' && smoothSlider) {
    smoothSlider.value = '72';
    if (smoothValue) smoothValue.value = '72';
    paintRange(smoothSlider);
  }
  console.log('filter', chip.dataset.look);
  syncFilterChips();
  if (creativeControls) creativeControls.hidden = false;
  showEditor();
  if (originalImage) render();
  else {
    showToast('Choose your photo. This look will be applied to it.');
    requestPhoto();
  }
};
document.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((chip) => {
  let startX = 0;
  let startY = 0;
  chip.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
  });
  chip.addEventListener('pointerup', (event) => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 12) return;
    selectLook(chip);
  });
  chip.addEventListener('click', (event) => {
    event.preventDefault();
    selectLook(chip);
  });
});

let previewFrame = 0;
const scheduleRender = (): void => {
  if (previewFrame) return;
  previewFrame = window.requestAnimationFrame(() => {
    previewFrame = 0;
    render();
  });
};

const paintSmooth = (): void => {
  const amount = Number(smoothSlider?.value ?? 0);
  if (smoothValue) smoothValue.value = String(amount);
  if (smoothSlider) paintRange(smoothSlider);
  byId<HTMLButtonElement>('smoothToggle')?.setAttribute('aria-pressed', String(amount > 0));
  if (brushChip) brushChip.style.filter = `blur(${Math.min(1.5, amount / 50)}px)`;
  console.log('filter', 'smooth', amount);
  scheduleRender();
};
smoothSlider?.addEventListener('input', paintSmooth);
smoothSlider?.addEventListener('change', () => {
  paintSmooth();
  noteTool('Smooth');
  noteEdit();
});

const setTeethAmount = (amount: number): void => {
  const next = String(Math.max(0, Math.min(100, Math.round(amount))));
  if (teethSlider) teethSlider.value = next;
  if (teethValue) teethValue.value = next;
  if (teethSlider) paintRange(teethSlider);
  byId<HTMLButtonElement>('teethToggle')?.setAttribute('aria-pressed', String(Number(next) > 0));
  if (originalImage) {
    pendingTeeth = null;
    render();
  } else {
    pendingTeeth = next;
  }
};

const paintTeeth = (): void => {
  const amount = Number(teethSlider?.value ?? 0);
  if (teethValue) teethValue.value = String(amount);
  if (teethSlider) paintRange(teethSlider);
  byId<HTMLButtonElement>('teethToggle')?.setAttribute('aria-pressed', String(amount > 0));
  if (originalImage) scheduleRender();
  else pendingTeeth = String(amount);
};

teethSlider?.addEventListener('input', paintTeeth);
teethSlider?.addEventListener('change', () => {
  paintTeeth();
  noteTool('Teeth');
  noteEdit();
  if (originalImage) render();
  const amount = Number(teethSlider?.value ?? 0);
  if (amount <= 0) return;
  if (!originalImage) {
    showToast('Choose a photo to whiten teeth.');
    return;
  }
  if (!faceMeshLandmarks) showToast('Finding the smile…');
  else if (teethPixels < 20) showToast('Use a photo where the teeth are showing.');
  else showToast('Teeth whitened. Your other edits stay in place.');
});
byId<HTMLButtonElement>('teethToggle')?.addEventListener('click', () => {
  remember();
  setTeethAmount(Number(teethSlider?.value ?? 0) > 0 ? 0 : 68);
});
byId<HTMLButtonElement>('smoothToggle')?.addEventListener('click', () => {
  if (!smoothSlider) return;
  remember();
  console.log('filter', 'smooth');
  smoothSlider.value = Number(smoothSlider.value) > 0 ? '0' : '80';
  paintSmooth();
  render();
});
noseSlider?.addEventListener('input', () => {
  if (noseValue) noseValue.value = noseSlider.value;
  scheduleRender();
});

const paintRange = (input: HTMLInputElement): void => {
  const min = Number(input.min);
  const max = Number(input.max);
  const span = max - min;
  const pct = span === 0 ? 0 : ((Number(input.value) - min) / span) * 100;
  if (min < 0 && max > 0) {
    const zero = ((0 - min) / span) * 100;
    input.classList.add('from-center');
    input.style.setProperty('--fill-start', `${Math.min(zero, pct)}%`);
    input.style.setProperty('--fill-end', `${Math.max(zero, pct)}%`);
    return;
  }
  input.classList.remove('from-center');
  input.style.setProperty('--fill', `${pct}%`);
};

const formatAdjustValue = (id: string, value: string): string => {
  const amount = Number(value);
  if (id === 'adjustNoise') return String(amount);
  if (amount > 0) return `+${amount}`;
  return String(amount);
};

const adjustToolNames: Record<string, string> = {
  adjustAuto: 'AUTO',
  adjustExposure: 'EXPOSURE',
  adjustBrilliance: 'BRILLIANCE',
  adjustHighlights: 'HIGHLIGHTS',
  adjustShadows: 'SHADOWS',
  adjustContrast: 'CONTRAST',
  adjustBrightness: 'BRIGHTNESS',
  adjustBlackPoint: 'BLACK POINT',
  adjustSaturation: 'SATURATION',
  adjustVibrance: 'VIBRANCE',
  adjustWarmth: 'WARMTH',
  adjustTint: 'TINT',
  adjustSharpness: 'SHARPNESS',
  adjustDefinition: 'DEFINITION',
  adjustNoise: 'NOISE REDUCTION',
  adjustVignette: 'VIGNETTE',
};

let selectedAdjustTool = 'adjustExposure';

const autoRecipeActive = (): boolean => adjustControlIds.every((id) => Number(byId<HTMLInputElement>(id)?.value ?? 0) === autoAdjustRecipe[id]);

function syncAdjustBoard(): void {
  const board = byId<HTMLElement>('adjustBoard');
  const name = byId<HTMLElement>('adjustName');
  const live = byId<HTMLOutputElement>('adjustLive');
  if (name) name.textContent = adjustToolNames[selectedAdjustTool] ?? 'ADJUST';
  const selected = byId<HTMLInputElement>(selectedAdjustTool);
  if (live) live.value = selected ? formatAdjustValue(selectedAdjustTool, selected.value) : '';
  board?.classList.toggle('is-auto', selectedAdjustTool === 'adjustAuto');
  document.querySelectorAll<HTMLElement>('[data-adjust-slider]').forEach((label) => {
    label.classList.toggle('is-active', label.dataset.adjustSlider === selectedAdjustTool);
  });
  const auto = byId<HTMLButtonElement>('adjustAuto');
  if (auto && !applyingAuto) auto.setAttribute('aria-pressed', String(autoRecipeActive()));
  document.querySelectorAll<HTMLButtonElement>('[data-adjust-pick]').forEach((button) => {
    const id = button.dataset.adjustPick ?? '';
    button.classList.toggle('is-selected', id === selectedAdjustTool);
    if (id === 'adjustAuto') {
      button.classList.toggle('is-changed', button.getAttribute('aria-pressed') === 'true');
      return;
    }
    button.classList.toggle('is-changed', Number(byId<HTMLInputElement>(id)?.value ?? 0) !== 0);
  });
}

const selectAdjustTool = (id: string, scroll = false): void => {
  if (!adjustToolNames[id]) return;
  selectedAdjustTool = id;
  syncAdjustBoard();
  if (!scroll) return;
  const icons = byId<HTMLElement>('adjustIcons');
  const button = document.querySelector<HTMLButtonElement>(`[data-adjust-pick="${id}"]`);
  if (!icons || !button) return;
  icons.scrollTo({ left: button.offsetLeft - (icons.clientWidth - button.offsetWidth) / 2, behavior: 'smooth' });
};

let applyingAuto = false;
const paintAdjustControl = (input: HTMLInputElement, draw: boolean): void => {
  paintRange(input);
  const output = byId<HTMLOutputElement>(`${input.id}Val`);
  if (output) output.value = formatAdjustValue(input.id, input.value);
  if (!applyingAuto) syncAdjustBoard();
  if (draw) {
    console.log('filter', input.id, input.value);
    scheduleRender();
  }
};

adjustControlIds.forEach((id) => {
  const input = byId<HTMLInputElement>(id);
  if (!input) return;
  const paint = (): void => paintAdjustControl(input, true);
  input.addEventListener('input', paint);
  input.addEventListener('change', paint);
  paintAdjustControl(input, false);
});

const zeroAdjustControls = (): void => {
  applyingAuto = true;
  adjustControlIds.forEach((id) => setAdjustControl(id, 0, false));
  applyingAuto = false;
  byId<HTMLButtonElement>('adjustAuto')?.setAttribute('aria-pressed', 'false');
  syncAdjustBoard();
};

const setAdjustControl = (id: string, value: number, draw: boolean): void => {
  const input = byId<HTMLInputElement>(id);
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  input.value = String(Math.max(min, Math.min(max, Math.round(value))));
  paintAdjustControl(input, draw);
};

const applyAutoAdjust = (on: boolean): void => {
  remember();
  applyingAuto = true;
  adjustControlIds.forEach((id) => setAdjustControl(id, on ? autoAdjustRecipe[id] : 0, false));
  applyingAuto = false;
  syncAdjustBoard();
  showEditor();
  setStudioTab('adjust');
  render();
};

byId<HTMLButtonElement>('adjustAuto')?.addEventListener('click', () => {
  const button = byId<HTMLButtonElement>('adjustAuto');
  applyAutoAdjust(button?.getAttribute('aria-pressed') !== 'true');
  selectAdjustTool('adjustAuto', true);
});
document.querySelectorAll<HTMLButtonElement>('[data-adjust-pick]').forEach((button) => {
  if (button.id === 'adjustAuto') return;
  button.addEventListener('click', () => selectAdjustTool(button.dataset.adjustPick ?? 'adjustExposure', true));
});
selectAdjustTool('adjustExposure');

['filterIntensity'].forEach((id) => {
  const input = byId<HTMLInputElement>(id);
  const output = byId<HTMLOutputElement>(`${id}Val`);
  const paint = (): void => {
    if (!input) return;
    paintRange(input);
    if (output) output.value = `${input.value}%`;
    console.log('filter', id, input.value);
    scheduleRender();
  };
  input?.addEventListener('input', paint);
  input?.addEventListener('change', paint);
  if (input) paintRange(input);
});

byId<HTMLButtonElement>('resetBtn')?.addEventListener('click', () => {
  remember();
  if (smoothSlider) smoothSlider.value = '0';
  if (noseSlider) noseSlider.value = '0';
  if (smoothValue) smoothValue.value = '0';
  if (noseValue) noseValue.value = '0';
  render();
});

document.querySelectorAll<HTMLButtonElement>('[data-bg-scene]').forEach((button) => {
  button.addEventListener('click', () => {
    const scene = button.dataset.bgScene ?? '';
    if (isBackgroundScene(scene)) {
      noteTool('Background');
      noteEdit();
      void selectBackgroundScene(scene, true);
    }
  });
});

const photoFileName = (extension: string): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `EditsBeauty-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${extension}`;
};

const blobFromCanvas = (source: HTMLCanvasElement, mime: string, quality?: number): Blob | null => {
  try {
    const dataUrl = source.toDataURL(mime, quality);
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
};

const wantsPhotoLibrary = (): boolean => /Android/i.test(navigator.userAgent) || phoneDevice;

const savePhotoFile = async (blob: Blob, fileName: string, mime: string): Promise<void> => {
  const file = new File([blob], fileName, { type: mime, lastModified: Date.now() });
  if (wantsPhotoLibrary() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'EditsBeauty' });
      showToast('Saved to Photos');
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  downloadBlob(blob, fileName);
  showToast(wantsPhotoLibrary() ? 'Saved. Open Photos or Gallery to see it.' : `Saved ${fileName}`);
};

downloadButton?.addEventListener('click', () => {
  if (!canvas || !originalImage) return;
  noteEdit();
  const blankBackground = activeBackgroundScene === 'blank';
  const mime = blankBackground ? 'image/png' : 'image/jpeg';
  const fileName = photoFileName(blankBackground ? 'png' : 'jpg');
  const blob = blobFromCanvas(canvas, mime, blankBackground ? undefined : 0.95);
  if (blob) {
    void savePhotoFile(blob, fileName, mime);
    return;
  }
  canvas.toBlob((fallback) => {
    if (!fallback) {
      showToast('The edited photo could not be exported.');
      return;
    }
    void savePhotoFile(fallback, fileName, mime);
  }, mime, blankBackground ? undefined : 0.95);
});

const splash = byId<HTMLDivElement>('splash');
if (splash) window.setTimeout(() => splash.classList.add('dismissed'), 2000);

const banners = Array.from(document.querySelectorAll<HTMLElement>('[data-banner]'));
const bannerDots = Array.from(document.querySelectorAll<HTMLButtonElement>('.banner-dot'));
let activeBannerIndex = 0;

const showBanner = (index: number): void => {
  if (!banners.length) return;
  activeBannerIndex = (index + banners.length) % banners.length;
  banners.forEach((banner, bannerIndex) => banner.classList.toggle('active', bannerIndex === activeBannerIndex));
  bannerDots.forEach((dot, dotIndex) => {
    const active = dotIndex === activeBannerIndex;
    dot.classList.toggle('active', active);
    dot.setAttribute('aria-pressed', String(active));
  });
};

bannerDots.forEach((dot, index) => dot.addEventListener('click', () => showBanner(index)));
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && banners.length > 1) {
  window.setInterval(() => showBanner(activeBannerIndex + 1), 3000);
}

document.querySelectorAll<HTMLDivElement>('[data-auto-slider]').forEach((slider) => {
  let pauseAutoScrollUntil = 0;
  const pause = (): void => { pauseAutoScrollUntil = Date.now() + 5000; };
  slider.addEventListener('pointerdown', pause, { passive: true });
  slider.addEventListener('touchstart', pause, { passive: true });
  slider.querySelectorAll<HTMLButtonElement>('.vibe-card').forEach((card) => {
    card.addEventListener('click', () => {
      const effect = card.dataset.effect ?? '';
      if (isHomeEffect(effect)) {
        beginHomeEffect(effect);
        return;
      }
      if (card.dataset.tool) return;
      if (card.dataset.ai === 'retouch') {
        openPortrait('retouch');
        return;
      }
      if (card.dataset.ai === 'background') {
        if (creativeControls) creativeControls.hidden = false;
        showEditor();
        window.setTimeout(() => byId<HTMLElement>('backgroundScenes')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 280);
        if (!originalImage) {
          showToast('Choose a photo, then pick Beach, City, or Studio.');
          upload?.click();
        }
        return;
      }
      if (photoFilter && card.dataset.filter) photoFilter.value = card.dataset.filter;
      if (creativeControls) creativeControls.hidden = false;
      showEditor();
      if (originalImage) render();
      else {
        showToast('Choose a photo to preview this look.');
        upload?.click();
      }
    });
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const playInlineVideo = (video: HTMLVideoElement): void => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    if (reducedMotion) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  };
  slider.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    playInlineVideo(video);
    video.addEventListener('loadeddata', () => playInlineVideo(video));
    video.addEventListener('canplay', () => playInlineVideo(video));
    video.addEventListener('ended', () => {
      video.currentTime = 0;
      playInlineVideo(video);
    });
    if (!reducedMotion && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) playInlineVideo(video);
        });
      }, { threshold: 0.25 });
      observer.observe(video);
    }
  });
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.setInterval(() => {
      if (Date.now() < pauseAutoScrollUntil) return;
      const end = slider.scrollWidth - slider.clientWidth;
      if (end <= 0) return;
      if (slider.scrollLeft >= end - 8) slider.scrollTo({ left: 0, behavior: 'smooth' });
      else slider.scrollBy({ left: 160, behavior: 'smooth' });
    }, 3000);
  }
});

const unlockInlineVideos = (): void => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll<HTMLVideoElement>('.vibe-card video').forEach((video) => {
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => undefined);
  });
};
document.addEventListener('touchstart', unlockInlineVideos, { passive: true });
document.addEventListener('pointerdown', unlockInlineVideos, { passive: true });

type CropBox = { x: number; y: number; w: number; h: number };
type DialMode = 'straighten' | 'vertical' | 'horizontal';

const cropScreenEl = byId<HTMLElement>('cropScreen');
const cropCanvasEl = byId<HTMLCanvasElement>('cropCanvas');
const cropWrapEl = byId<HTMLElement>('cropWrap');
const cropFrameEl = byId<HTMLElement>('cropFrame');
const cropAngleEl = byId<HTMLInputElement>('cropAngle');
const cropAngleOutput = byId<HTMLOutputElement>('cropAngleVal');
let cropBox: CropBox = { x: 0, y: 0, w: 1, h: 1 };
let quarterTurns = 0;
let flipHorizontal = false;
let flipVertical = false;
let straightenAngle = 0;
let perspectiveVertical = 0;
let perspectiveHorizontal = 0;
let dialMode: DialMode = 'straighten';
let aspectLock: number | null = null;
let cropDrag: { handle: string; px: number; py: number; box: CropBox } | null = null;

const renderOriented = (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  turns: number,
  degrees: number,
  mirrorX: boolean,
  mirrorY: boolean,
  vertical: number,
  horizontal: number,
  maxSide: number,
): HTMLCanvasElement => {
  const swapped = turns % 2 === 1;
  const orientedWidth = swapped ? sourceHeight : sourceWidth;
  const orientedHeight = swapped ? sourceWidth : sourceHeight;
  const scale = Math.min(1, maxSide / Math.max(orientedWidth, orientedHeight, 1));
  const width = Math.max(1, Math.round(orientedWidth * scale));
  const height = Math.max(1, Math.round(orientedHeight * scale));
  const radians = degrees * Math.PI / 180;
  const sine = Math.abs(Math.sin(radians));
  const cosine = Math.abs(Math.cos(radians));
  const cover = Math.max((width * cosine + height * sine) / width, (width * sine + height * cosine) / height);
  const base = document.createElement('canvas');
  base.width = width;
  base.height = height;
  const baseContext = base.getContext('2d');
  if (!baseContext) return base;
  baseContext.translate(width / 2, height / 2);
  baseContext.rotate((turns * 90 * Math.PI) / 180 + radians);
  baseContext.scale((mirrorX ? -1 : 1) * cover, (mirrorY ? -1 : 1) * cover);
  baseContext.drawImage(source, 0, 0, sourceWidth, sourceHeight, -(sourceWidth * scale) / 2, -(sourceHeight * scale) / 2, sourceWidth * scale, sourceHeight * scale);
  if (Math.abs(vertical) < 0.4 && Math.abs(horizontal) < 0.4) return base;
  const strips = 28;
  const warp = (input: HTMLCanvasElement, axis: 'x' | 'y', amount: number): HTMLCanvasElement => {
    const output = document.createElement('canvas');
    output.width = input.width;
    output.height = input.height;
    const outputContext = output.getContext('2d');
    if (!outputContext) return input;
    const strength = amount / 20;
    for (let index = 0; index < strips; index += 1) {
      const start = index / strips;
      const end = (index + 1) / strips;
      const middle = (start + end) / 2;
      const sizeScale = 1 + strength * (middle - 0.5) * 0.85;
      if (axis === 'y') {
        const destWidth = input.width * sizeScale;
        outputContext.drawImage(input, 0, input.height * start, input.width, input.height / strips + 1, (input.width - destWidth) / 2, input.height * start, destWidth, input.height / strips + 1);
      } else {
        const destHeight = input.height * sizeScale;
        outputContext.drawImage(input, input.width * start, 0, input.width / strips + 1, input.height, input.width * start, (input.height - destHeight) / 2, input.width / strips + 1, destHeight);
      }
    }
    return output;
  };
  const verticalPass = Math.abs(vertical) >= 0.4 ? warp(base, 'y', vertical) : base;
  return Math.abs(horizontal) >= 0.4 ? warp(verticalPass, 'x', horizontal) : verticalPass;
};

const placeCropFrame = (): void => {
  if (!cropFrameEl) return;
  cropFrameEl.style.left = `${cropBox.x * 100}%`;
  cropFrameEl.style.top = `${cropBox.y * 100}%`;
  cropFrameEl.style.width = `${cropBox.w * 100}%`;
  cropFrameEl.style.height = `${cropBox.h * 100}%`;
};

const paintCropPreview = (): void => {
  if (!originalImage || !cropCanvasEl || !cropWrapEl) return;
  const bitmap = renderOriented(originalImage, originalImage.naturalWidth, originalImage.naturalHeight, quarterTurns, straightenAngle, flipHorizontal, flipVertical, perspectiveVertical, perspectiveHorizontal, 800);
  cropCanvasEl.width = bitmap.width;
  cropCanvasEl.height = bitmap.height;
  cropCanvasEl.getContext('2d')?.drawImage(bitmap, 0, 0);
  const stage = byId<HTMLElement>('cropStage')?.getBoundingClientRect();
  if (!stage || stage.width < 8 || stage.height < 8) return;
  const fit = Math.min((stage.width - 12) / bitmap.width, (stage.height - 12) / bitmap.height);
  cropWrapEl.style.width = `${Math.max(1, Math.round(bitmap.width * fit))}px`;
  cropWrapEl.style.height = `${Math.max(1, Math.round(bitmap.height * fit))}px`;
  placeCropFrame();
};

const syncDial = (): void => {
  const value = dialMode === 'straighten' ? straightenAngle : dialMode === 'vertical' ? perspectiveVertical : perspectiveHorizontal;
  if (!cropAngleEl) return;
  cropAngleEl.min = dialMode === 'straighten' ? '-5' : '-20';
  cropAngleEl.max = dialMode === 'straighten' ? '5' : '20';
  cropAngleEl.value = String(value);
  paintRange(cropAngleEl);
  if (cropAngleOutput) cropAngleOutput.value = `${value}°`;
};

const resetCropDraft = (): void => {
  cropBox = { x: 0, y: 0, w: 1, h: 1 };
  quarterTurns = 0;
  flipHorizontal = false;
  flipVertical = false;
  straightenAngle = 0;
  perspectiveVertical = 0;
  perspectiveHorizontal = 0;
  dialMode = 'straighten';
  aspectLock = null;
  syncDial();
};

function openCrop(): void {
  if (!cropScreenEl || !originalImage) return;
  resetCropDraft();
  cropScreenEl.hidden = false;
  document.body.classList.add('studio-open');
  byId<HTMLElement>('aspectMenu')?.setAttribute('hidden', '');
  byId<HTMLElement>('cropMoreMenu')?.setAttribute('hidden', '');
  document.querySelectorAll<HTMLButtonElement>('[data-studio-tab]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.studioTab === 'crop'));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-dial]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.dial === 'straighten'));
  });
  paintCropPreview();
  window.requestAnimationFrame(paintCropPreview);
}

const hideCropMenus = (): void => {
  const aspectMenu = byId<HTMLElement>('aspectMenu');
  const moreMenu = byId<HTMLElement>('cropMoreMenu');
  if (aspectMenu) aspectMenu.hidden = true;
  if (moreMenu) moreMenu.hidden = true;
};

function closeCrop(apply: boolean): void {
  if (apply && cropDraftChanged()) commitCrop();
  resetCropDraft();
  hideCropMenus();
  if (cropScreenEl) cropScreenEl.hidden = true;
  const filters = byId<HTMLElement>('panelFilters');
  const adjust = byId<HTMLElement>('panelAdjust');
  if (filters) filters.hidden = false;
  if (adjust) adjust.hidden = true;
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = 'Filters';
  document.querySelectorAll<HTMLButtonElement>('[data-studio-tab]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.studioTab === 'filters'));
  });
}

const snapshotSource = (): string => {
  if (!originalImage) return '';
  const shot = document.createElement('canvas');
  shot.width = originalImage.naturalWidth;
  shot.height = originalImage.naturalHeight;
  shot.getContext('2d')?.drawImage(originalImage, 0, 0);
  return shot.toDataURL('image/jpeg', 0.92);
};

const replaceOriginal = (src: string, message: string, done?: () => void): void => {
  const image = new Image();
  image.onload = () => {
    originalImage = image;
    personMask = null;
    maskPromise = null;
    faceMeshLandmarks = null;
    setPhotoCanvasSize();
    if (canvas) canvas.classList.add('has-image');
    render();
    paintFilterPreviews();
    if (!cropScreenEl?.hidden) paintCropPreview();
    if (message) showToast(message);
    void detectFaceMesh(image).then((landmarks) => {
      faceMeshLandmarks = landmarks;
      render();
    });
    done?.();
  };
  image.onerror = () => {
    if (message) showToast('That edit could not be restored.');
    done?.();
  };
  image.src = src;
};

function cropDraftChanged(): boolean {
  const fullFrame = cropBox.x <= 0.004 && cropBox.y <= 0.004 && cropBox.w >= 0.996 && cropBox.h >= 0.996;
  return !fullFrame || quarterTurns !== 0 || flipHorizontal || flipVertical || straightenAngle !== 0 || Math.abs(perspectiveVertical) >= 0.4 || Math.abs(perspectiveHorizontal) >= 0.4;
}

function keepCrop(): void {
  if (!cropScreenEl || cropScreenEl.hidden) return;
  if (cropDraftChanged()) commitCrop();
  resetCropDraft();
  hideCropMenus();
  cropScreenEl.hidden = true;
}

const commitCrop = (): void => {
  if (!originalImage) return;
  const full = renderOriented(
    originalImage,
    originalImage.naturalWidth,
    originalImage.naturalHeight,
    quarterTurns,
    straightenAngle,
    flipHorizontal,
    flipVertical,
    perspectiveVertical,
    perspectiveHorizontal,
    maxDimension,
  );
  const originX = Math.round(cropBox.x * full.width);
  const originY = Math.round(cropBox.y * full.height);
  const cropWidth = Math.max(1, Math.round(cropBox.w * full.width));
  const cropHeight = Math.max(1, Math.round(cropBox.h * full.height));
  const output = document.createElement('canvas');
  output.width = cropWidth;
  output.height = cropHeight;
  output.getContext('2d')?.drawImage(full, originX, originY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  remember(true);
  imageToken += 1;
  replaceOriginal(output.toDataURL('image/jpeg', 0.92), 'Crop applied.');
};

const fitAspect = (kind: string): void => {
  if (!cropCanvasEl) return;
  if (kind === 'free') {
    aspectLock = null;
    return;
  }
  const canvasRatio = cropCanvasEl.width / cropCanvasEl.height;
  const ratio = kind === 'original' ? canvasRatio : Number(kind);
  aspectLock = ratio;
  let width = 1;
  let height = 1;
  if (canvasRatio > ratio) width = ratio / canvasRatio;
  else height = canvasRatio / ratio;
  cropBox = { x: (1 - width) / 2, y: (1 - height) / 2, w: width, h: height };
  placeCropFrame();
};

document.querySelectorAll<HTMLButtonElement>('[data-studio-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.studioTab;
    if (tab === 'adjust' || tab === 'filters' || tab === 'crop') {
      noteTool(tab === 'adjust' ? 'Adjust' : tab === 'filters' ? 'Filters' : 'Crop');
      setStudioTab(tab);
    }
  });
});

byId<HTMLButtonElement>('cropCancel')?.addEventListener('click', () => closeCrop(false));
byId<HTMLButtonElement>('cropDone')?.addEventListener('click', () => closeCrop(true));
byId<HTMLButtonElement>('cropAuto')?.addEventListener('click', () => {
  straightenAngle = 0;
  perspectiveVertical = 0;
  perspectiveHorizontal = 0;
  syncDial();
  paintCropPreview();
  showToast('Straighten reset.');
});
byId<HTMLButtonElement>('cropStraightenIcon')?.addEventListener('click', () => {
  dialMode = 'straighten';
  straightenAngle = 0;
  syncDial();
  paintCropPreview();
});
byId<HTMLButtonElement>('cropRotate')?.addEventListener('click', () => {
  quarterTurns = (quarterTurns + 1) % 4;
  cropBox = { x: 0, y: 0, w: 1, h: 1 };
  aspectLock = null;
  paintCropPreview();
});
byId<HTMLButtonElement>('cropAspect')?.addEventListener('click', () => {
  const menu = byId<HTMLElement>('aspectMenu');
  const more = byId<HTMLElement>('cropMoreMenu');
  if (more) more.hidden = true;
  if (menu) menu.hidden = !menu.hidden;
});
byId<HTMLButtonElement>('cropMore')?.addEventListener('click', () => {
  const menu = byId<HTMLElement>('cropMoreMenu');
  const aspect = byId<HTMLElement>('aspectMenu');
  if (aspect) aspect.hidden = true;
  if (menu) menu.hidden = !menu.hidden;
});
document.querySelectorAll<HTMLButtonElement>('[data-aspect]').forEach((button) => {
  button.addEventListener('click', () => {
    fitAspect(button.dataset.aspect ?? 'free');
    const menu = byId<HTMLElement>('aspectMenu');
    if (menu) menu.hidden = true;
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-dial]').forEach((button) => {
  button.addEventListener('click', () => {
    const next = button.dataset.dial;
    if (next !== 'straighten' && next !== 'vertical' && next !== 'horizontal') return;
    dialMode = next;
    document.querySelectorAll<HTMLButtonElement>('[data-dial]').forEach((dial) => {
      dial.setAttribute('aria-pressed', String(dial === button));
    });
    syncDial();
  });
});
byId<HTMLButtonElement>('flipHorizontal')?.addEventListener('click', () => {
  flipHorizontal = !flipHorizontal;
  paintCropPreview();
  hideCropMenus();
});
byId<HTMLButtonElement>('flipVertical')?.addEventListener('click', () => {
  flipVertical = !flipVertical;
  paintCropPreview();
  hideCropMenus();
});
byId<HTMLButtonElement>('cropUndo')?.addEventListener('click', () => {
  hideCropMenus();
  undoEdit();
});
cropAngleEl?.addEventListener('input', () => {
  const value = Number(cropAngleEl.value);
  if (dialMode === 'straighten') straightenAngle = Math.max(-5, Math.min(5, value));
  else if (dialMode === 'vertical') perspectiveVertical = value;
  else perspectiveHorizontal = value;
  paintRange(cropAngleEl);
  if (cropAngleOutput) cropAngleOutput.value = `${value}°`;
  paintCropPreview();
});

cropWrapEl?.addEventListener('pointerdown', (event: PointerEvent) => {
  if (!cropWrapEl) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  const handle = target?.dataset.handle || (target && cropFrameEl?.contains(target) ? 'move' : '');
  if (!handle) return;
  try {
    cropWrapEl.setPointerCapture(event.pointerId);
  } catch {
    // Drag still tracks through the window move listener.
  }
  const rect = cropWrapEl.getBoundingClientRect();
  cropDrag = {
    handle,
    px: (event.clientX - rect.left) / rect.width,
    py: (event.clientY - rect.top) / rect.height,
    box: { ...cropBox },
  };
});
window.addEventListener('pointermove', (event: PointerEvent) => {
  if (!cropDrag || !cropWrapEl) return;
  const rect = cropWrapEl.getBoundingClientRect();
  const dx = (event.clientX - rect.left) / rect.width - cropDrag.px;
  const dy = (event.clientY - rect.top) / rect.height - cropDrag.py;
  const next = { ...cropDrag.box };
  const handle = cropDrag.handle;
  if (handle === 'move') {
    next.x += dx;
    next.y += dy;
  } else {
    if (handle.includes('w')) {
      next.x += dx;
      next.w -= dx;
    }
    if (handle.includes('e')) next.w += dx;
    if (handle.includes('n')) {
      next.y += dy;
      next.h -= dy;
    }
    if (handle.includes('s')) next.h += dy;
    if (aspectLock !== null && cropCanvasEl) {
      const ratio = aspectLock * (cropCanvasEl.height / cropCanvasEl.width);
      if (handle === 'n' || handle === 's') next.w = next.h * ratio;
      else next.h = next.w / ratio;
      if (handle.includes('w')) next.x = cropDrag.box.x + cropDrag.box.w - next.w;
      if (handle.includes('n')) next.y = cropDrag.box.y + cropDrag.box.h - next.h;
    }
  }
  next.w = Math.max(0.12, Math.min(1, next.w));
  next.h = Math.max(0.12, Math.min(1, next.h));
  next.x = Math.min(Math.max(0, next.x), 1 - next.w);
  next.y = Math.min(Math.max(0, next.y), 1 - next.h);
  cropBox = next;
  placeCropFrame();
});
const endCropDrag = (): void => {
  cropDrag = null;
};
window.addEventListener('pointerup', endCropDrag);
window.addEventListener('pointercancel', endCropDrag);
window.addEventListener('resize', () => {
  if (cropScreenEl && !cropScreenEl.hidden) paintCropPreview();
});

const guidePanel = byId<HTMLElement>('guidePanel');
const guideLog = byId<HTMLElement>('guideLog');
const guideForm = byId<HTMLFormElement>('guideForm');
const guideInput = byId<HTMLInputElement>('guideInput');

const guideLine = (role: 'you' | 'guide', text: string): void => {
  if (!guideLog) return;
  const line = document.createElement('p');
  line.className = role === 'you' ? 'guide-you' : 'guide-reply';
  line.textContent = text;
  guideLog.append(line);
  guideLog.scrollTop = guideLog.scrollHeight;
};

const guideResult = (text: string): void => {
  if (!guideLog) return;
  const block = document.createElement('div');
  block.className = 'guide-result';
  const line = document.createElement('p');
  line.className = 'guide-reply';
  line.textContent = text;
  block.append(line);
  if (canvas && originalImage && canvas.width > 0 && canvas.height > 0) {
    try {
      const picture = document.createElement('img');
      picture.className = 'guide-result-photo';
      picture.alt = 'Edited photo';
      picture.src = canvas.toDataURL('image/jpeg', 0.85);
      block.append(picture);
    } catch {
      // A photo from another site can block the copy. The editor still shows the edit.
    }
  }
  guideLog.append(block);
  guideLog.scrollTop = guideLog.scrollHeight;
};

const openGuide = (): void => {
  if (!guidePanel) return;
  guidePanel.hidden = false;
  if (guideLog && guideLog.childElementCount === 0) {
    guideLine('guide', 'Tell me the edit in your own words, such as “smooth my skin and whiten my teeth” or “brighten this and use a beach background.” I choose the controls already in the editor. I do not see the photo unless you turn on “Allow AI to see my photo (better results)” in Settings, and I do not create a new picture.');
  }
  guideInput?.focus();
};

const closeGuide = (): void => {
  if (guidePanel) guidePanel.hidden = true;
};

const openBackgroundTools = (): void => {
  if (creativeControls) creativeControls.hidden = false;
  showEditor();
  setStudioTab('adjust');
  const more = byId<HTMLDetailsElement>('moreTools');
  if (more) more.open = true;
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = 'AI BG Change';
};

const applyGuideLook = (look: string): void => {
  activeHomeEffect = null;
  if (photoFilter) photoFilter.value = look;
  syncFilterChips();
  console.log('filter', look);
  showEditor();
  setStudioTab('filters');
  const title = byId<HTMLElement>('editorTitle');
  if (title) title.textContent = 'Filters';
  if (originalImage) render();
  else {
    showToast('Choose a photo to preview this look.');
    upload?.click();
  }
};

const sceneFromRequest = (text: string): BackgroundScene | null => {
  const aliases: Array<[RegExp, BackgroundScene]> = [
    [/\b(blank|transparent|no background)\b/, 'blank'],
    [/\b(blurred background|portrait blur|blur background)\b/, 'blur'],
    [/\bwhite background\b|\bplain white\b/, 'white'],
    [/\bblack background\b/, 'black'],
    [/\bpink background\b/, 'pink'],
    [/\bblue background\b/, 'blue'],
    [/\bgreen background\b/, 'green'],
    [/\b(office|workplace)\b/, 'office'],
    [/\b(snow|winter)\b/, 'snow'],
    [/\b(desert|dunes)\b/, 'desert'],
    [/\b(library|books)\b/, 'library'],
    [/\b(bedroom|room background)\b/, 'room'],
    [/\b(waterfall|falls)\b/, 'waterfall'],
    [/\b(autumn|fall leaves)\b/, 'autumn'],
    [/\b(rain|rainy)\b/, 'rain'],
    [/\b(space|galaxy)\b/, 'space'],
    [/\b(ocean|sea|waves|shore)\b/, 'ocean'],
    [/\b(mountains?|hills?|alps)\b/, 'mountains'],
    [/\b(flowers?|floral|blossoms?)\b/, 'flowers'],
    [/\b(cafe|coffee shop|coffee)\b/, 'cafe'],
    [/\b(night|stars|midnight|city lights)\b/, 'night'],
    [/\b(park)\b/, 'park'],
    [/\b(garden|meadow)\b/, 'garden'],
    [/\b(sunset|dusk|golden sky)\b/, 'sunset'],
    [/\b(forest|woods|trees)\b/, 'forest'],
    [/\b(sky|clouds)\b/, 'sky'],
    [/\b(beach|sand|seaside)\b/, 'beach'],
    [/\b(city|downtown|skyline)\b/, 'city'],
    [/\bstudio\b/, 'studio'],
  ];
  const match = aliases.find(([pattern]) => pattern.test(text));
  return match ? match[1] : null;
};

const lookFromRequest = (text: string): string | null => {
  const aliases: Array<[RegExp, string]> = [
    [/\bvivid warm\b|\bvivid-warm\b/, 'vivid-warm'],
    [/\bvivid cool\b|\bvivid-cool\b/, 'vivid-cool'],
    [/\bdramatic warm\b|\bdramatic-warm\b/, 'dramatic-warm'],
    [/\bdramatic cool\b|\bdramatic-cool\b/, 'dramatic-cool'],
    [/\bsilver\b/, 'silvertone'],
    [/\bblack and white\b|\bb\/w\b|\bbw\b|\bmono\b|\bnoir\b/, 'mono'],
    [/\bvivid\b/, 'vivid'],
    [/\bdramatic\b/, 'dramatic'],
    [/\bbeauty\b/, 'beauty'],
    [/\bsoft\b/, 'soft'],
    [/\bpink\b(?!\s+background)/, 'pink'],
    [/\bvintage\b/, 'vintage'],
    [/\bpop\b/, 'pop'],
    [/\bmatte\b/, 'matte'],
    [/\bgolden\b(?!\s+sky)/, 'golden'],
    [/\bfilm\b/, 'film'],
    [/\bwarm\b/, 'warm'],
    [/\bglow\b/, 'glow'],
    [/\bcool\b/, 'cool'],
    [/\bfade\b/, 'fade'],
    [/\binstant\b/, 'instant'],
    [/\btransfer\b/, 'transfer'],
    [/\bchrome\b/, 'chrome'],
    [/\boriginal\b/, 'original'],
  ];
  const match = aliases.find(([pattern]) => pattern.test(text));
  return match && match[1] in lookRecipes ? match[1] : null;
};

type GuidePlan = {
  reply: string;
  smooth?: number;
  teeth?: number;
  look?: string;
  background?: string;
  effect?: string;
  crop?: string;
  auto?: boolean;
  reset?: boolean;
  save?: boolean;
} & Partial<Record<(typeof adjustControlIds)[number], number>>;

const guideEndpoint = (): string => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === 'editsbeauty.vercel.app') {
    return new URL('/api/guide', window.location.origin).href;
  }
  return 'https://editsbeauty.vercel.app/api/guide';
};

const guideHistory = (): string[] => {
  if (!guideLog) return [];
  return Array.from(guideLog.querySelectorAll<HTMLElement>('.guide-you, .guide-reply'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean)
    .slice(-6);
};

const guideState = (): Record<string, string | number | boolean | null> => ({
  hasPhoto: Boolean(originalImage),
  look: photoFilter?.value ?? 'original',
  smooth: Number(smoothSlider?.value ?? 0),
  teeth: Number(teethSlider?.value ?? 0),
  background: activeBackgroundScene,
  exposure: sliderNumber('adjustExposure'),
  brilliance: sliderNumber('adjustBrilliance'),
  highlights: sliderNumber('adjustHighlights'),
  shadows: sliderNumber('adjustShadows'),
  contrast: sliderNumber('adjustContrast'),
  brightness: sliderNumber('adjustBrightness'),
  blackPoint: sliderNumber('adjustBlackPoint'),
  saturation: sliderNumber('adjustSaturation'),
  vibrance: sliderNumber('adjustVibrance'),
  warmth: sliderNumber('adjustWarmth'),
  tint: sliderNumber('adjustTint'),
  sharpness: sliderNumber('adjustSharpness'),
  definition: sliderNumber('adjustDefinition'),
  noise: sliderNumber('adjustNoise'),
  vignette: sliderNumber('adjustVignette'),
});

const guidePreview = (): string => {
  try {
    if (localStorage.getItem('editsbeauty-ai-vision') !== 'on') return '';
  } catch {
    return '';
  }
  if (!originalImage?.naturalWidth || !originalImage.naturalHeight) return '';
  const longest = Math.max(originalImage.naturalWidth, originalImage.naturalHeight);
  let edge = Math.min(384, longest);
  const small = document.createElement('canvas');
  const context = small.getContext('2d');
  if (!context) return '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = edge / longest;
    small.width = Math.max(1, Math.round(originalImage.naturalWidth * scale));
    small.height = Math.max(1, Math.round(originalImage.naturalHeight * scale));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, small.width, small.height);
    context.drawImage(originalImage, 0, 0, small.width, small.height);
    const url = small.toDataURL('image/jpeg', attempt === 0 ? 0.55 : 0.4);
    if (url.startsWith('data:image/jpeg;base64,') && url.length <= 100000) return url;
    edge = Math.max(64, Math.round(edge * 0.7));
  }
  return '';
};

const requestGuidePlan = async (message: string, history: string[], preview = ''): Promise<GuidePlan | null> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), preview ? 25000 : 15000);
  try {
    const payload: { message: string; state: ReturnType<typeof guideState>; history: string[]; preview?: string } = {
      message,
      state: guideState(),
      history,
    };
    if (preview) payload.preview = preview;
    const response = await fetch(guideEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const plan = await response.json() as GuidePlan;
    if (!plan || typeof plan.reply !== 'string' || !plan.reply.trim()) return null;
    return plan;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
};

const applyPlannedLook = (look: string): void => {
  activeHomeEffect = null;
  if (!photoFilter || !(look in lookRecipes)) return;
  photoFilter.value = look;
  if (look === 'beauty') {
    if (smoothSlider) {
      smoothSlider.value = '72';
      if (smoothValue) smoothValue.value = '72';
      paintRange(smoothSlider);
    }
    pendingSmooth = '72';
  }
  syncFilterChips();
  showEditor();
  setStudioTab('filters');
};

const planChangesPhoto = (plan: GuidePlan): boolean => Boolean(
  plan.reset || plan.auto || plan.save || plan.smooth !== undefined || plan.teeth !== undefined
  || plan.look || plan.background || plan.effect || plan.crop
  || adjustControlIds.some((id) => plan[id] !== undefined),
);

const applyGuidePlan = async (plan: GuidePlan): Promise<void> => {
  const edits = planChangesPhoto(plan);
  if (edits) remember(Boolean(plan.crop && originalImage));
  historyLock += 1;
  try {
  if (plan.reset) {
    activeHomeEffect = null;
    applyingAuto = true;
    adjustControlIds.forEach((id) => setAdjustControl(id, 0, false));
    applyingAuto = false;
    byId<HTMLButtonElement>('adjustAuto')?.setAttribute('aria-pressed', 'false');
    if (photoFilter) photoFilter.value = 'original';
    syncFilterChips();
    pendingSmooth = '0';
    if (smoothSlider) {
      smoothSlider.value = '0';
      if (smoothValue) smoothValue.value = '0';
      paintRange(smoothSlider);
    }
    setTeethAmount(0);
    activeBackgroundScene = null;
    setSceneButtons(null);
  }
  if (plan.auto) applyAutoAdjust(true);
  adjustControlIds.forEach((id) => {
    if (plan[id] !== undefined) setAdjustControl(id, Number(plan[id]), false);
  });
  if (plan.look) applyPlannedLook(plan.look);
  if (plan.effect && isHomeEffect(plan.effect)) {
    if (originalImage) beginHomeEffect(plan.effect);
    else activeHomeEffect = plan.effect;
  }
  if (plan.smooth !== undefined && smoothSlider) {
    const amount = String(Math.max(0, Math.min(100, Math.round(plan.smooth))));
    pendingSmooth = amount;
    smoothSlider.value = amount;
    if (smoothValue) smoothValue.value = amount;
    paintRange(smoothSlider);
    byId<HTMLButtonElement>('smoothToggle')?.setAttribute('aria-pressed', String(Number(amount) > 0));
  }
  if (plan.teeth !== undefined) setTeethAmount(plan.teeth);
  if (plan.background && isBackgroundScene(plan.background)) {
    openBackgroundTools();
    try {
      await selectBackgroundScene(plan.background, false);
    } catch {
      showToast('That background could not be applied. The other controls still changed.');
    }
  }
  if (plan.crop && originalImage && ['original', '1', '0.8', '0.5625', '1.7778', '1.3333', '1.5', '1.25'].includes(plan.crop)) {
    setStudioTab('crop');
    fitAspect(plan.crop);
    closeCrop(true);
  }
  if (originalImage) render();
  if (!originalImage && edits) {
    guideLine('guide', `${plan.reply} Choose a photo first, and I will apply this when it opens.`);
    if (!plan.background) {
      showToast('Choose a photo, or tap an example portrait.');
      requestPhoto();
    }
    return;
  }
  if (plan.save && downloadButton && originalImage && !downloadButton.disabled) {
    window.setTimeout(() => downloadButton.click(), plan.crop ? 400 : 0);
  }
  if (originalImage) guideResult(plan.reply);
  else guideLine('guide', plan.reply);
  } finally {
    historyLock -= 1;
  }
};

const answerGuide = async (raw: string): Promise<void> => {
  const typed = raw.trim();
  if (!typed) return;
  noteGuide();
  if (!originalImage && photoLoading) {
    pendingGuideRequest = typed;
    guideLine('you', typed);
    guideLine('guide', 'The photo is opening. I will do that as soon as it is ready.');
    return;
  }
  const historyBefore = guideHistory();
  guideLine('you', typed);
  const waiting = guideLog ? document.createElement('p') : null;
  const preview = guidePreview();
  if (waiting && guideLog) {
    waiting.className = 'guide-reply';
    waiting.textContent = preview ? 'Looking at the photo…' : 'Choosing the controls…';
    guideLog.append(waiting);
    guideLog.scrollTop = guideLog.scrollHeight;
  }
  let plan = await requestGuidePlan(typed, historyBefore, preview);
  if (!plan && preview) plan = await requestGuidePlan(typed, historyBefore);
  if (plan) {
    try {
      await applyGuidePlan(plan);
      noteEdit();
    } finally {
      waiting?.remove();
    }
    return;
  }
  waiting?.remove();
  await answerGuideLocal(typed);
};

const answerGuideLocal = async (typed: string): Promise<void> => {
  const text = typed.toLowerCase().replace(/\s+/g, ' ');
  const asksHow = /^(how|what|where|why)\b/.test(text) || /\bhow do i\b/.test(text);
  if (asksHow && !/\b(please|can you|do it)\b/.test(text)) {
    guideLine('guide', 'Choose a photo with Start Editing, the camera, or an example portrait. Then ask me to edit it, or use the tools yourself. I can smooth skin, whiten teeth, apply a look, change the background, and set Adjust: Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. Save downloads editsbeauty-edit.jpg.');
    return;
  }
  if (/\b(save|download|export)\b/.test(text) && !/\b(edit|smooth|vivid|noir|background|bright|warm|exposure|teeth|tooth)\b/.test(text)) {
    if (downloadButton && originalImage && !downloadButton.disabled) downloadButton.click();
    else showToast('Choose a photo before saving.');
    const savedName = activeBackgroundScene === 'blank' ? 'editsbeauty-edit.png' : 'editsbeauty-edit.jpg';
    if (originalImage) guideResult(`I saved the photo as ${savedName}. Here is the edited picture. Save at the top right does the same thing.`);
    else guideLine('guide', 'Choose a photo first. After the edit, tap Save at the top right. The download is editsbeauty-edit.jpg, or a PNG when the background is blank.');
    return;
  }
  const done: string[] = [];
  const historyBeforeEdit = undoStack.length;
  remember(Boolean(originalImage && /\b(crop|square|story)\b/.test(text)));
  historyLock += 1;
  try {
  const needsPhoto = (): void => {
    if (originalImage) return;
    showToast('Choose a photo, or tap an example portrait.');
    requestPhoto();
  };
  if (/\b(reset|undo|start over)\b/.test(text) || /\bclear (the )?(edit|adjustments|filters|everything)\b/.test(text)) {
    activeHomeEffect = null;
    applyingAuto = true;
    adjustControlIds.forEach((id) => setAdjustControl(id, 0, false));
    applyingAuto = false;
    byId<HTMLButtonElement>('adjustAuto')?.setAttribute('aria-pressed', 'false');
    if (photoFilter) photoFilter.value = 'original';
    syncFilterChips();
    pendingSmooth = '0';
    if (smoothSlider) {
      smoothSlider.value = '0';
      if (smoothValue) smoothValue.value = '0';
      paintRange(smoothSlider);
    }
    activeBackgroundScene = null;
    setSceneButtons(null);
    if (backgroundStatus) backgroundStatus.textContent = 'Pick a scene. The person stays, and the photo behind them changes on this device.';
    setTeethAmount(0);
    done.push('cleared the previous edit');
  }
  const effectMatch: Array<[RegExp, HomeEffect]> = [
    [/\blipstick\b|\blips\b/, 'lipstick'],
    [/\beyelash/, 'eyelashes'],
    [/\bacne\b|\bpimple|\bblemishes\b/, 'acne'],
    [/\bdouble chin\b|\bjawline\b/, 'double-chin'],
    [/\bgolden hour\b/, 'golden-hour'],
    [/\bred (car )?light\b/, 'red-light'],
    [/\bslim(mer)?\b/, 'slim'],
    [/\bbody\b/, 'body'],
  ];
  const effect = effectMatch.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  const scene = sceneFromRequest(text);
  const wantsBackground = scene !== null || /\b(background|bg|behind)\b/.test(text);
  const look = lookFromRequest(text);
  const vagueEdit = /\b(edit|retouch|improve|beautify)\b/.test(text) && /\b(photo|picture|image|portrait|face|skin|me|my|this|it|person|people)\b/.test(text)
    || /\bmake (me|it|this|her|him|them) (look )?(better|beautiful|pretty|nicer)\b/.test(text);
  const adjustPlans: Array<[RegExp, string, string, number]> = [
    [/\bexposure\b/, 'adjustExposure', 'Exposure', 24],
    [/\bbrilliance\b/, 'adjustBrilliance', 'Brilliance', 20],
    [/\bhighlights?\b/, 'adjustHighlights', 'Highlights', -16],
    [/\bshadows?\b/, 'adjustShadows', 'Shadows', 22],
    [/\bcontrast\b/, 'adjustContrast', 'Contrast', 18],
    [/\bbrightness\b/, 'adjustBrightness', 'Brightness', 22],
    [/\bblack point\b/, 'adjustBlackPoint', 'Black Point', 12],
    [/\bvibrance\b|\bpop\b|\bcolorful\b/, 'adjustVibrance', 'Vibrance', 24],
    [/\bwarmth\b|\bwarmer\b/, 'adjustWarmth', 'Warmth', 22],
    [/\bcooler\b/, 'adjustWarmth', 'Warmth', -22],
    [/\btint\b/, 'adjustTint', 'Tint', 16],
    [/\bsharp(ness|er)?\b/, 'adjustSharpness', 'Sharpness', 28],
    [/\bdefinition\b|\bclarity\b/, 'adjustDefinition', 'Definition', 20],
    [/\bnoise\b/, 'adjustNoise', 'Noise Reduction', 40],
    [/\bvignette\b/, 'adjustVignette', 'Vignette', 24],
    [/\bsaturation\b|\bmore color\b/, 'adjustSaturation', 'Saturation', 20],
  ];
  const namedAdjust = adjustPlans.filter(([pattern]) => pattern.test(text));
  const lighting = /\b(lighting|light)\b/.test(text) && !/\bred (car )?light\b/.test(text);
  const wantsSmooth = /\b(smooth|softer skin|soft skin)\b/.test(text) || (vagueEdit && !look && namedAdjust.length === 0 && !effect);
  if (/\bauto\b/.test(text)) {
    applyAutoAdjust(true);
    done.push('Auto');
  } else if (vagueEdit && !look && namedAdjust.length === 0 && !effect && !wantsBackground) {
    activeHomeEffect = null;
    applyingAuto = true;
    setAdjustControl('adjustExposure', 8, false);
    setAdjustControl('adjustBrilliance', 16, false);
    setAdjustControl('adjustHighlights', -10, false);
    setAdjustControl('adjustShadows', 18, false);
    setAdjustControl('adjustContrast', 6, false);
    setAdjustControl('adjustVibrance', 12, false);
    setAdjustControl('adjustWarmth', 8, false);
    setAdjustControl('adjustSharpness', 14, false);
    setAdjustControl('adjustDefinition', 10, false);
    applyingAuto = false;
    showEditor();
    setStudioTab('adjust');
    done.push('a portrait edit with softer skin, warmer light, and clearer detail');
  } else if (lighting && namedAdjust.length === 0) {
    activeHomeEffect = null;
    applyingAuto = true;
    setAdjustControl('adjustExposure', 16, false);
    setAdjustControl('adjustShadows', 18, false);
    setAdjustControl('adjustBrilliance', 14, false);
    applyingAuto = false;
    showEditor();
    setStudioTab('adjust');
    done.push('brighter lighting');
  }
  namedAdjust.forEach(([pattern, id, label, fallback]) => {
    const at = text.search(pattern);
    const windowText = text.slice(Math.max(0, at - 16), at + 28);
    const numbered = windowText.match(/-?\d{1,3}/);
    let amount = numbered ? Number(numbered[0]) : fallback;
    if (!numbered && /\b(less|lower|decrease|reduce)\b/.test(windowText)) amount = -Math.abs(fallback);
    setAdjustControl(id, amount, false);
    done.push(`${label} ${amount > 0 ? `+${amount}` : amount}`);
  });
  if (/\b(brighter|brighten)\b/.test(text) && !lighting && !/\bbrightness\b/.test(text)) {
    setAdjustControl('adjustBrightness', 22, false);
    done.push('Brightness +22');
  }
  if (/\b(darker|too bright)\b/.test(text) && !/\bbrightness\b/.test(text)) {
    setAdjustControl('adjustBrightness', -22, false);
    done.push('Brightness -22');
  }
  if (look) {
    activeHomeEffect = null;
    if (photoFilter) photoFilter.value = look;
    syncFilterChips();
    done.push(`${look.replace(/-/g, ' ')} look`);
  }
  if (effect) {
    activeHomeEffect = effect;
    done.push(homeEffectLabel[effect]);
  }
  if (wantsSmooth && smoothSlider) {
    const named = text.match(/\bsmooth(?:\s+\w+){0,2}\s+(\d{1,3})\b/);
    const amount = named ? Math.max(0, Math.min(100, Number(named[1]))) : 72;
    pendingSmooth = String(amount);
    smoothSlider.value = String(amount);
    if (smoothValue) smoothValue.value = String(amount);
    paintRange(smoothSlider);
    byId<HTMLButtonElement>('smoothToggle')?.setAttribute('aria-pressed', 'true');
    done.push(`smooth ${amount}`);
  }
  const wantsTeeth = /\b(teeth|tooth)\b/.test(text);
  if (wantsTeeth) {
    const named = text.match(/\b(?:teeth|tooth)\D{0,16}(\d{1,3})\b/) ?? text.match(/(\d{1,3})\D{0,16}\b(?:teeth|tooth)\b/);
    const amount = named ? Math.max(0, Math.min(100, Number(named[1]))) : 68;
    setTeethAmount(amount);
    done.push(`teeth ${amount}`);
  } else if (vagueEdit && !look && namedAdjust.length === 0 && !effect && !wantsBackground) {
    setTeethAmount(42);
    done.push('teeth 42');
  }
  if (done.length === 0 && !wantsBackground) {
    guideLine('guide', 'Tell me the edit. For example: “edit my photo”, “whiten my teeth”, “smooth my skin and make it noir”, “brighten the lighting”, or “background beach”. The same controls stay on the page if you want to do it by hand.');
    return;
  }
  showEditor();
  if (wantsBackground || namedAdjust.length > 0 || lighting || (vagueEdit && !look && !wantsTeeth)) setStudioTab('adjust');
  else if (look || effect || wantsSmooth || wantsTeeth) setStudioTab('filters');
  if (done.some((item) => item !== 'cleared the previous edit') || wantsBackground) needsPhoto();
  if (originalImage) render();
  let backgroundReady = false;
  if (wantsBackground) {
    openBackgroundTools();
    if (scene) {
      await selectBackgroundScene(scene, false);
      backgroundReady = activeBackgroundScene === scene;
      if (backgroundReady) done.push(`${sceneLabels[scene]} background`);
    } else {
      done.push('opened the backgrounds');
    }
  }
  if (originalImage && !backgroundReady) render();
  if (/\b(save|download|export)\b/.test(text) && originalImage && !wantsBackground && downloadButton && !downloadButton.disabled) {
    downloadButton.click();
    done.push('saved editsbeauty-edit.jpg');
  }
  const summary = done.join(', ');
  const sceneList = 'Blank, blur, white, black, pink, blue, beach, city, office, snow, sunset, or another scene in Background.';
  const waitingForScene = wantsBackground && !scene && done.every((item) => item === 'opened the backgrounds');
  if (waitingForScene) {
    guideLine('guide', `Tell me which background you want. ${sceneList}`);
    return;
  }
  if (!originalImage) {
    guideLine('guide', `Choose a photo first. I will apply ${summary} when it opens.`);
    return;
  }
  const reply = backgroundReady && scene
    ? `Here is the edited picture. I put ${sceneLabels[scene]} behind the person: ${summary}.`
    : `Here is the edited picture: ${summary}. You can still change any slider, look, or background by hand. Save is at the top right.`;
  guideResult(reply);
  } finally {
    historyLock -= 1;
    if (done.length === 0 && undoStack.length > historyBeforeEdit) {
      undoStack.pop();
      syncHistoryButtons();
    }
  }
};

byId<HTMLButtonElement>('homeGuide')?.addEventListener('click', openGuide);
byId<HTMLButtonElement>('guideLaunch')?.addEventListener('click', openGuide);
byId<HTMLButtonElement>('guideClose')?.addEventListener('click', closeGuide);
guidePanel?.addEventListener('click', (event) => {
  if (event.target === guidePanel) closeGuide();
});
guideForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = guideInput?.value ?? '';
  if (guideInput) guideInput.value = '';
  answerGuide(value);
});

const takeGuidePhoto = (file: File | undefined): void => {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Drop a photo, then tell me the edit.');
    return;
  }
  openGuide();
  openPhoto(URL.createObjectURL(file));
  guideLine('guide', 'Photo added on this device. Tell me the task. You can name a background: blank, blur, white, beach, city, office, snow, sunset, or another scene in Background.');
};

const guideDrop = byId<HTMLElement>('guideDrop');
const guidePhoto = byId<HTMLInputElement>('guidePhoto');
guidePhoto?.addEventListener('change', () => {
  takeGuidePhoto(guidePhoto.files?.[0]);
  guidePhoto.value = '';
});
guideDrop?.addEventListener('dragover', (event) => {
  event.preventDefault();
  guideDrop.classList.add('is-over');
});
guideDrop?.addEventListener('dragleave', () => guideDrop.classList.remove('is-over'));
guideDrop?.addEventListener('drop', (event) => {
  event.preventDefault();
  guideDrop.classList.remove('is-over');
  takeGuidePhoto(event.dataTransfer?.files?.[0]);
});
guidePanel?.addEventListener('paste', (event) => {
  const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'));
  if (!file) return;
  event.preventDefault();
  takeGuidePhoto(file);
});
document.querySelectorAll<HTMLButtonElement>('[data-guide-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    answerGuide(button.dataset.guidePrompt ?? button.textContent ?? '');
  });
});

const sampleLooks: Array<{ kind: string; label: string }> = [
  { kind: 'smooth-skin', label: 'Smooth' },
  { kind: 'lipstick', label: 'Lipstick' },
  { kind: 'eyelashes', label: 'Lashes' },
  { kind: 'vivid', label: 'Vivid' },
  { kind: 'noir', label: 'Noir' },
  { kind: 'golden-hour', label: 'Golden' },
  { kind: 'warm', label: 'Warm' },
  { kind: 'glow', label: 'Glow' },
  { kind: 'acne', label: 'Clear skin' },
  { kind: 'film', label: 'Film' },
  { kind: 'dramatic', label: 'Dramatic' },
  { kind: 'cool', label: 'Cool' },
  { kind: 'double-chin', label: 'Jawline' },
  { kind: 'chrome', label: 'Chrome' },
  { kind: 'fade', label: 'Fade' },
  { kind: 'slim', label: 'Slim' },
  { kind: 'red-light', label: 'Red light' },
  { kind: 'instant', label: 'Instant' },
  { kind: 'silvertone', label: 'Silver' },
  { kind: 'mono', label: 'Mono' },
  { kind: 'vivid-warm', label: 'Vivid warm' },
  { kind: 'vivid-cool', label: 'Vivid cool' },
  { kind: 'dramatic-warm', label: 'Drama warm' },
  { kind: 'dramatic-cool', label: 'Drama cool' },
  { kind: 'transfer', label: 'Transfer' },
  { kind: 'smooth-skin', label: 'Smooth' },
  { kind: 'lipstick', label: 'Lipstick' },
  { kind: 'glow', label: 'Glow' },
  { kind: 'noir', label: 'Noir' },
  { kind: 'golden-hour', label: 'Golden' },
];

const applyChosenLook = (kind: string): void => {
  if (!originalImage) {
    pendingApply = kind;
    showToast('Choose your photo. This look will be applied to it.');
    requestPhoto();
    return;
  }
  if (isHomeEffect(kind)) {
    beginHomeEffect(kind);
    return;
  }
  if (!(kind in lookRecipes) || !photoFilter) return;
  activeHomeEffect = null;
  photoFilter.value = kind;
  syncFilterChips();
  showEditor();
  setStudioTab('filters');
  render();
  showToast('Applied to your photo.');
};

byId<HTMLButtonElement>('choosePhoto')?.addEventListener('click', requestPhoto);
byId<HTMLButtonElement>('guideClear')?.addEventListener('click', () => {
  guideLog?.replaceChildren();
  showToast('Chat deleted.');
});

document.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((button, index) => {
  const item = sampleLooks[index];
  if (!item) return;
  const span = button.querySelector('span');
  if (span) span.textContent = item.label;
  button.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((other) => {
      other.setAttribute('aria-pressed', 'false');
    });
    button.setAttribute('aria-pressed', 'true');
    applyChosenLook(item.kind);
  });
});

byId<HTMLFormElement>('feedbackForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const data = new FormData(form);
  const body = `Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message')}`;
  const status = byId<HTMLElement>('feedbackStatus');
  if (status) status.textContent = 'Opening your email app to send this to stisla2021@gmail.com.';
  window.location.href = `mailto:stisla2021@gmail.com?subject=${encodeURIComponent('EditsBeauty feedback')}&body=${encodeURIComponent(body)}`;
});