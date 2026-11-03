import { createHash } from 'node:crypto';

const CITY_THEMES = ['nairobi', 'tokyo', 'new-york', 'london', 'moscow'];
const ROUTE_IDS = ['downtown', 'avenue', 'skyway'];
const VEHICLE_ID = 'matrix-street-default-v1';
const RULES_ID = 'native-checkpoint-sprint';
const PRESENTATION_STYLES = ['motorsport', 'street'];

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function invalid(message, code = 'INVALID_EXPERIENCE') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function object(value, allowed, required, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(`${name} must be a JSON object.`);
  const keys = Object.keys(value);
  if (keys.some(key => !allowed.includes(key))) invalid(`${name} contains unsupported fields. Physics, map geometry and scripts cannot be supplied by a manifest.`);
  if (required.some(key => !Object.hasOwn(value, key))) invalid(`${name} is missing a required field.`);
}

function text(value, maximum, name, minimum = 1) {
  if (typeof value !== 'string') invalid(`${name} must be text.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) invalid(`${name} must contain ${minimum}–${maximum} text characters.`);
  return normalized;
}

function choice(value, allowed, name) {
  if (!allowed.includes(value)) invalid(`Unsupported ${name}. Supported values: ${allowed.join(', ')}.`, 'UNSUPPORTED_EXPERIENCE');
  return value;
}

export const EXPERIENCE_CAPABILITIES = freeze({
  schemaVersion: 1,
  cityThemes: CITY_THEMES,
  routeIds: ROUTE_IDS,
  vehiclePresets: [{ id: VEHICLE_ID, name: 'Matrix standard road car', implemented: true }],
  rulesPresets: [{ id: RULES_ID, name: 'Native ordered-checkpoint sprint', implemented: true }],
  presentationStyles: PRESENTATION_STYLES,
  limits: { id: 64, title: 100, briefing: 400, radioLine: 160, requestedStyle: 80 },
  nativeGeometryId: 'matrix-city-v1',
  generatedPhysics: false,
  generatedMaps: false,
  liveAiRenderingVerified: false,
  notes: [
    'City themes change briefing and presentation on the existing Matrix city; they do not load geographic city maps.',
    'Motorsport presentation does not enable Formula vehicle geometry, physics, laps, tyre strategy or pit stops.',
    'An imported manifest is untrusted configuration, not proof that ComfyUI generated or executed it.',
  ],
});

/** Exact allowlist: generated/imported text cannot introduce engine code or unsupported capabilities. */
export function validateExperienceManifest(input) {
  const required = ['schemaVersion', 'id', 'title', 'cityTheme', 'routeId', 'vehiclePresetId', 'rulesPresetId', 'presentation', 'briefing', 'radio'];
  object(input, [...required, 'requestedStyle'], required, 'Experience');
  if (input.schemaVersion !== 1) invalid('Only experience schemaVersion 1 is supported.');
  const id = text(input.id, 64, 'id');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) invalid('id must use lowercase letters, numbers and hyphens.');
  object(input.presentation, ['style', 'accent'], ['style', 'accent'], 'presentation');
  object(input.radio, ['start', 'checkpoint', 'finish'], ['start', 'checkpoint', 'finish'], 'radio');
  const accent = text(input.presentation.accent, 7, 'presentation.accent');
  if (!/^#[0-9a-f]{6}$/i.test(accent)) invalid('presentation.accent must be a six-digit hex colour.');
  const manifest = {
    schemaVersion: 1,
    id,
    title: text(input.title, 100, 'title'),
    cityTheme: choice(input.cityTheme, CITY_THEMES, 'city theme'),
    routeId: choice(input.routeId, ROUTE_IDS, 'route'),
    vehiclePresetId: choice(input.vehiclePresetId, [VEHICLE_ID], 'vehicle preset'),
    rulesPresetId: choice(input.rulesPresetId, [RULES_ID], 'rules preset'),
    presentation: { style: choice(input.presentation.style, PRESENTATION_STYLES, 'presentation style'), accent: accent.toUpperCase() },
    briefing: text(input.briefing, 400, 'briefing'),
    radio: {
      start: text(input.radio.start, 160, 'radio.start', 0),
      checkpoint: text(input.radio.checkpoint, 160, 'radio.checkpoint', 0),
      finish: text(input.radio.finish, 160, 'radio.finish', 0),
    },
  };
  if (Object.hasOwn(input, 'requestedStyle')) manifest.requestedStyle = text(input.requestedStyle, 80, 'requestedStyle');
  return freeze(manifest);
}

export function experienceRecord(input) {
  const manifest = validateExperienceManifest(input);
  const warnings = [
    'City theme is narrative/presentation only; native geometry remains the existing Matrix city.',
    'Radio lines are text cues; generated or spoken audio is not supplied by this manifest.',
  ];
  if (manifest.presentation.style === 'motorsport' || /\b(?:f1|formula|open[ -]?wheel)\b/i.test(`${manifest.requestedStyle || ''} ${manifest.title}`)) {
    warnings.push('Motorsport presentation only: the actual vehicle remains the standard Matrix road car, without Formula physics, tyre or pit simulation.');
  }
  if (manifest.requestedStyle && !['street', 'motorsport'].includes(manifest.requestedStyle.toLowerCase())) {
    warnings.push(`Requested style "${manifest.requestedStyle}" is descriptive only; it does not enable a new native vehicle or handling preset.`);
  }
  return freeze({ ...manifest, source: 'imported workflow manifest', sha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'), warnings });
}
