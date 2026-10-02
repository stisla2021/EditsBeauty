// Copyright (c) StISLA2021
// Turns a typed editing request into editor controls.
// A preview is used only when the person turned vision on. It is not stored.

const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-11b-vision-preview',
];

const LOOKS = [
  'original', 'vivid', 'vivid-warm', 'vivid-cool', 'dramatic', 'dramatic-warm', 'dramatic-cool',
  'silvertone', 'mono', 'fade', 'instant', 'transfer', 'chrome', 'film', 'warm', 'glow', 'cool',
  'soft', 'pink', 'vintage', 'pop', 'matte', 'golden', 'beauty',
];

const BACKGROUNDS = [
  'blank', 'blur', 'white', 'black', 'gray', 'cream', 'red', 'pink', 'blue', 'navy', 'green', 'teal',
  'yellow', 'purple', 'sunsetwash', 'rose', 'skywash', 'studiowash', 'gold', 'neon', 'nightwash', 'mint',
  'beach', 'city', 'studio', 'garden', 'sunset', 'mountains', 'forest', 'night', 'cafe', 'sky', 'flowers',
  'ocean', 'office', 'snow', 'desert', 'library', 'room', 'brick', 'street', 'autumn', 'waterfall', 'park',
  'rain', 'space',
];

const EFFECTS = ['lipstick', 'eyelashes', 'double-chin', 'acne', 'golden-hour', 'red-light', 'slim', 'body', 'smooth-skin'];

const CROPS = {
  original: 'original',
  square: '1',
  portrait: '0.8',
  story: '0.5625',
  landscape: '1.7778',
  'four-three': '1.3333',
  'three-two': '1.5',
};

const ADJUST = {
  exposure: 'adjustExposure',
  brilliance: 'adjustBrilliance',
  highlights: 'adjustHighlights',
  shadows: 'adjustShadows',
  contrast: 'adjustContrast',
  brightness: 'adjustBrightness',
  blackPoint: 'adjustBlackPoint',
  saturation: 'adjustSaturation',
  vibrance: 'adjustVibrance',
  warmth: 'adjustWarmth',
  tint: 'adjustTint',
  sharpness: 'adjustSharpness',
  definition: 'adjustDefinition',
  noise: 'adjustNoise',
  vignette: 'adjustVignette',
};

const SYSTEM = `You are the EditsBeauty guide. You do not create a photograph. You only choose controls that already exist in the editor by calling edit_photo once.

Rules:
- Omit every control the person did not ask to change. Do not send zeros unless they asked to turn that control off.
- Use a number they give. "A little" is small: brightness 12, smooth 40, teeth 35, warmth 10. A normal request uses smooth 72, teeth 68, brightness 24.
- Smoother skin is smooth. Whiten teeth is teeth. Soft glow is look "glow". Brighten, when they do not name another control, is brightness. Better lighting can set exposure 16, shadows 18, and brilliance 14 together.
- Black and white or noir is look "mono". A beauty look is look "beauty".
- Background must be an allowed id. Beach is beach. No background or transparent is blank. A blurred background is blur.
- Crop names: square, portrait, story, landscape, four-three, three-two, original.
- save is true only when they ask to save, download, or export now.
- reset is true only when they want the current edit cleared.
- auto is true only for auto adjust.
- reply is one or two plain sentences naming what changed. Say they can still move the sliders. Do not mention models, APIs, or servers, and do not say you generated a new picture.
- If they only ask how to do something, call edit_photo with reply alone and name the control.`;

const VISION_SYSTEM = `${SYSTEM}

A small temporary JPEG preview is attached for this request only. EditsBeauty does not store it. Look at skin, lighting, teeth, the background, and the face, then choose controls that fit what you see and what they asked. Do not identify the person, and do not describe the file.`;

const tool = {
  type: 'function',
  function: {
    name: 'edit_photo',
    description: 'Choose the existing editor controls for this request. Omit controls that should stay as they are.',
    parameters: {
      type: 'object',
      properties: {
        reply: { type: 'string', description: 'Short explanation of the controls you chose.' },
        smooth: { type: 'integer', minimum: 0, maximum: 100 },
        teeth: { type: 'integer', minimum: 0, maximum: 100 },
        look: { type: 'string', enum: LOOKS },
        background: { type: 'string', enum: BACKGROUNDS },
        effect: { type: 'string', enum: EFFECTS },
        crop: { type: 'string', enum: Object.keys(CROPS) },
        auto: { type: 'boolean' },
        reset: { type: 'boolean' },
        save: { type: 'boolean' },
        exposure: { type: 'integer', minimum: -100, maximum: 100 },
        brilliance: { type: 'integer', minimum: -100, maximum: 100 },
        highlights: { type: 'integer', minimum: -100, maximum: 100 },
        shadows: { type: 'integer', minimum: -100, maximum: 100 },
        contrast: { type: 'integer', minimum: -100, maximum: 100 },
        brightness: { type: 'integer', minimum: -100, maximum: 100 },
        blackPoint: { type: 'integer', minimum: -100, maximum: 100 },
        saturation: { type: 'integer', minimum: -100, maximum: 100 },
        vibrance: { type: 'integer', minimum: -100, maximum: 100 },
        warmth: { type: 'integer', minimum: -100, maximum: 100 },
        tint: { type: 'integer', minimum: -100, maximum: 100 },
        sharpness: { type: 'integer', minimum: -100, maximum: 100 },
        definition: { type: 'integer', minimum: -100, maximum: 100 },
        noise: { type: 'integer', minimum: 0, maximum: 100 },
        vignette: { type: 'integer', minimum: -100, maximum: 100 },
      },
      required: ['reply'],
    },
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value))));

const asNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
};

export const normalizePlan = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const plan = {
    reply: typeof raw.reply === 'string' ? raw.reply.replace(/\s+/g, ' ').trim().slice(0, 400) : '',
  };
  if (!plan.reply) plan.reply = 'I updated the controls you asked for. You can still move any slider by hand.';
  const smooth = asNumber(raw.smooth);
  const teeth = asNumber(raw.teeth);
  if (smooth !== null) plan.smooth = clamp(smooth, 0, 100);
  if (teeth !== null) plan.teeth = clamp(teeth, 0, 100);
  if (typeof raw.look === 'string' && LOOKS.includes(raw.look)) plan.look = raw.look;
  if (typeof raw.background === 'string' && BACKGROUNDS.includes(raw.background)) plan.background = raw.background;
  if (typeof raw.effect === 'string' && EFFECTS.includes(raw.effect)) plan.effect = raw.effect;
  if (typeof raw.crop === 'string' && Object.prototype.hasOwnProperty.call(CROPS, raw.crop)) plan.crop = CROPS[raw.crop];
  if (raw.auto === true) plan.auto = true;
  if (raw.reset === true) plan.reset = true;
  if (raw.save === true) plan.save = true;
  Object.entries(ADJUST).forEach(([key, id]) => {
    const value = asNumber(raw[key]);
    if (value === null) return;
    plan[id] = clamp(value, key === 'noise' ? 0 : -100, 100);
  });
  return plan;
};

const argumentsFromMessage = (message) => {
  const calls = message?.tool_calls;
  if (Array.isArray(calls)) {
    const match = calls.find((call) => call?.function?.name === 'edit_photo') ?? calls[0];
    const args = match?.function?.arguments;
    if (typeof args === 'string') return JSON.parse(args);
    if (args && typeof args === 'object') return args;
  }
  const content = typeof message?.content === 'string' ? message.content : '';
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
  return null;
};

const cleanList = (value, limit) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 180))
    .filter((item) => item && !/data:image/i.test(item))
    .slice(-limit);
};

const acceptPreview = (preview) => {
  if (preview == null || preview === '') return '';
  if (typeof preview !== 'string') return null;
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(preview)) return null;
  if (preview.length > 120000) return null;
  return preview;
};

const userText = (message, state, history) => `Earlier lines:\n${cleanList(history, 6).join('\n') || '(none)'}\nCurrent controls: ${JSON.stringify(state ?? {})}\nRequest: ${message}`;

const askModel = async (key, model, messages) => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 500,
      parallel_tool_calls: false,
      tool_choice: { type: 'function', function: { name: 'edit_photo' } },
      tools: [tool],
      messages,
    }),
  });
  if (!response.ok) {
    const error = new Error('guide');
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const plan = normalizePlan(argumentsFromMessage(payload?.choices?.[0]?.message));
  if (!plan) {
    const error = new Error('plan');
    error.status = 502;
    throw error;
  }
  return plan;
};

const visionCanRetry = (status) => [400, 404, 408, 413, 422, 429, 500, 502, 503].includes(status);

export const planEdit = async ({ message, state, history, apiKey, preview, ...extra }) => {
  if (Object.keys(extra).length || /data:image/i.test(JSON.stringify(state ?? {}))) {
    const error = new Error('photo');
    error.status = 400;
    throw error;
  }
  const text = String(message ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!text || /data:image|base64,/i.test(text)) {
    const error = new Error('empty');
    error.status = 400;
    throw error;
  }
  const image = acceptPreview(preview);
  if (image === null) {
    const error = new Error('photo');
    error.status = 400;
    throw error;
  }
  const key = apiKey || process.env.GROQ_API_KEY || '';
  if (!key) {
    const error = new Error('unconfigured');
    error.status = 503;
    throw error;
  }
  const words = userText(text, state, history);
  if (image) {
    const messages = [
      { role: 'system', content: VISION_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: words },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ];
    for (const model of VISION_MODELS) {
      try {
        return await askModel(key, model, messages);
      } catch (error) {
        if (!visionCanRetry(error?.status)) throw error;
      }
    }
  }
  try {
    return await askModel(key, TEXT_MODEL, [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: words },
    ]);
  } catch (error) {
    if (error?.status === 429) throw error;
    if (error?.status === 401 || error?.status === 403) {
      error.status = 503;
    } else if (error?.status !== 503) {
      error.status = 502;
    }
    throw error;
  }
};
