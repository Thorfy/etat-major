// Génère les illustrations du jeu avec le ComfyUI local (Qwen Image 2.1 turbo), d'après
// data/illustrations.json, plus un blason par pays. Les images arrivent en WebP sous public/art/.
//   node tools/illustrate.ts              ce qui manque
//   node tools/illustrate.ts --list       le catalogue, sans rien générer
//   node tools/illustrate.ts --only ecrans/accueil,blasons/FRA --force   régénère ces images
// Le ComfyUI doit tourner sur http://127.0.0.1:8188 (ou COMFYUI=http://hôte:port).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Format {
  width: number;
  height: number;
  outWidth: number;
  outHeight: number;
  rules: string;
}

interface Entry {
  id: string;
  format: string;
  subject: string;
}

interface Catalog {
  style: string;
  formats: Record<string, Format>;
  images: Entry[];
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.COMFYUI ?? 'http://127.0.0.1:8188';
const catalog: Catalog = JSON.parse(readFileSync(join(root, 'data/illustrations.json'), 'utf8'));
const world = JSON.parse(readFileSync(join(root, 'public/map/world.json'), 'utf8')) as {
  nations: { code: string; name: string; continent: string; color: string }[];
};

/** Nom anglais approché d'une couleur, pour la consigne. */
function colorName(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.08) return max > 0.6 ? 'light grey' : 'slate grey';
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  const names: [number, string][] = [
    [15, 'brick red'],
    [40, 'burnt orange'],
    [60, 'mustard yellow'],
    [90, 'olive green'],
    [160, 'green'],
    [200, 'teal blue'],
    [250, 'cobalt blue'],
    [290, 'purple'],
    [335, 'plum'],
    [360, 'brick red'],
  ];
  return names.find(([limit]) => hue < limit)![1];
}

/** Blasons inventés, un par pays, dans l'esprit du pays mais sans copier ses armoiries. */
const charges: Record<string, string> = JSON.parse(readFileSync(join(root, 'data/blasons.json'), 'utf8')).charges;
const blasons: Entry[] = world.nations.map((nation) => ({
  id: `blasons/${nation.code}`,
  format: 'blason',
  subject:
    `Heraldic shield, undivided, with one large bold charge: ${charges[nation.code] ?? 'a lion rampant'}, drawn simply and filling the shield. ` +
    `Inks: dark teal, off-white and ${colorName(nation.color)}.`,
}));
const uncharged = world.nations.filter((nation) => !charges[nation.code]).map((nation) => nation.code);
if (uncharged.length > 0) console.warn(`Sans motif dans data/blasons.json : ${uncharged.join(', ')}`);

const entries = [...catalog.images, ...blasons];

/** Graine stable tirée de l'identifiant : régénérer une image la redonne à l'identique. */
function seedOf(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return hash;
}

function graph(entry: Entry, format: Format) {
  const prompt = `${catalog.style} ${entry.subject} ${format.rules}`;
  return {
    12: { class_type: 'UNETLoader', inputs: { unet_name: 'qwen_image_2.1_turbo_int8_convrot.safetensors', weight_dtype: 'default' } },
    13: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_8b_int8_convrot.safetensors', type: 'qwen_image', device: 'default' } },
    14: { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' } },
    15: { class_type: 'QwenImage21Cache', inputs: { model: ['12', 0], device: 'auto', dtype: 'default' } },
    16: { class_type: 'TextEncodeQwenImage21', inputs: { clip: ['13', 0], prompt, negative_prompt: '', resolution: 1024 } },
    17: { class_type: 'CFGGuider', inputs: { model: ['15', 0], positive: ['16', 0], negative: ['16', 1], cfg: 1 } },
    18: { class_type: 'RandomNoise', inputs: { noise_seed: seedOf(entry.id) } },
    19: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    20: { class_type: 'ManualSigmas', inputs: { sigmas: '1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0' } },
    11: { class_type: 'EmptyLatentImage', inputs: { width: format.width, height: format.height, batch_size: 1 } },
    21: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['18', 0], guider: ['17', 0], sampler: ['19', 0], sigmas: ['20', 0], latent_image: ['11', 0] } },
    22: { class_type: 'VAEDecode', inputs: { samples: ['21', 0], vae: ['14', 0] } },
    24: { class_type: 'ImageScale', inputs: { image: ['22', 0], upscale_method: 'lanczos', width: format.outWidth, height: format.outHeight, crop: 'center' } },
    23: {
      class_type: 'SaveAnimatedWEBP',
      inputs: { images: ['24', 0], filename_prefix: `etat-major/${entry.id.replace('/', '-')}`, fps: 1, lossless: false, quality: 80, method: 'default' },
    },
  };
}

async function generate(entry: Entry): Promise<number> {
  const format = catalog.formats[entry.format];
  if (!format) throw new Error(`${entry.id} : format inconnu « ${entry.format} »`);
  const response = await fetch(`${host}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph(entry, format), client_id: 'etat-major' }),
  });
  const queued = (await response.json()) as { prompt_id?: string };
  if (!queued.prompt_id) throw new Error(`${entry.id} : refusé par ComfyUI : ${JSON.stringify(queued).slice(0, 500)}`);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const history = (await (await fetch(`${host}/history/${queued.prompt_id}`)).json()) as Record<string, any>;
    const done = history[queued.prompt_id];
    if (!done) continue;
    if (done.status?.status_str === 'error') throw new Error(`${entry.id} : erreur ComfyUI : ${JSON.stringify(done.status).slice(0, 500)}`);
    const image = Object.values(done.outputs ?? {}).flatMap((output: any) => output.images ?? [])[0] as
      | { filename: string; subfolder: string; type: string }
      | undefined;
    if (!image) continue;
    const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
    const bytes = Buffer.from(await (await fetch(`${host}/view?${query}`)).arrayBuffer());
    const path = join(root, 'public/art', `${entry.id}.webp`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    return bytes.length;
  }
}

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const force = args.includes('--force');
const wanted = entries.filter((entry) => !only || only.has(entry.id));
if (args.includes('--list')) {
  for (const entry of wanted) console.log(`${entry.id} [${entry.format}] ${entry.subject}`);
  console.log(`${wanted.length} images`);
  process.exit(0);
}
const missing = wanted.filter((entry) => force || !existsSync(join(root, 'public/art', `${entry.id}.webp`)));
console.log(`${missing.length} images à générer sur ${wanted.length}`);
const started = Date.now();
let total = 0;
let failures = 0;
for (const [index, entry] of missing.entries()) {
  try {
    const bytes = await generate(entry);
    total += bytes;
    const elapsed = (Date.now() - started) / 1000;
    const left = (elapsed / (index + 1)) * (missing.length - index - 1);
    console.log(`${index + 1}/${missing.length} ${entry.id} : ${(bytes / 1024).toFixed(0)} Ko · reste ~${Math.ceil(left / 60)} min`);
  } catch (error) {
    failures++;
    console.error(String(error));
  }
}
let size = 0;
for (const entry of entries) {
  const path = join(root, 'public/art', `${entry.id}.webp`);
  if (existsSync(path)) size += statSync(path).size;
}
console.log(`Terminé en ${((Date.now() - started) / 60000).toFixed(1)} min, ${failures} échecs ; public/art pèse ${(size / 1024 / 1024).toFixed(1)} Mo.`);
