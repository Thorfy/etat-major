// Unités en 3D pour les sprites de la carte, avec le ComfyUI local :
//   1. une image de référence (Qwen Image), l'unité seule en vue de trois quarts, sur un vert uni
//      retiré ensuite (ffmpeg) ;
//   2. un modèle 3D texturé (TRELLIS.2) tiré de cette image, enregistré en GLB.
// Les planches de sprites se tirent ensuite de ces modèles (tools/sprite-baker.html).
//   node tools/units3d.ts                 ce qui manque
//   node tools/units3d.ts --only camion   une unité
//   node tools/units3d.ts --force         tout refaire
//   node tools/units3d.ts --ref           les images de référence seulement
// Les fichiers vont dans assets3d/ (hors du dépôt : ils sont lourds).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.COMFYUI ?? 'http://127.0.0.1:8188';
const out = join(root, 'assets3d');
const ffmpeg = process.env.FFMPEG ?? (existsSync('D:/Labs/ffmpeg/bin/ffmpeg.exe') ? 'D:/Labs/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg');

/** Les unités : un identifiant (le nom du sprite) et ce que l'image montre. */
export const UNITS: { id: string; subject: string; retry?: number }[] = [
  { id: 'camion', subject: 'a military cargo truck with a canvas-covered back, six wheels' },
  { id: 'navire', subject: 'a small cargo ship with a dark navy hull, a white bridge at the stern and orange containers, floating on nothing', retry: 1 },
  { id: 'avion', subject: 'a twin-engine propeller cargo airplane' },
  { id: 'blinde', subject: 'a battle tank with a long gun and tracks, floating on nothing, no ground and no shadow under it', retry: 1 },
  { id: 'infanterie', subject: 'a single infantry soldier in a helmet and greatcoat holding a rifle, standing' },
  { id: 'navire-guerre', subject: 'a grey destroyer warship with two gun turrets and a mast' },
];

const STYLE =
  'A clean 3D render of a toy-like miniature model, simple chunky readable shapes, matte painted colors ' +
  '(dark teal, ochre, off-white, dark grey), soft even studio lighting.';
const RULES =
  'The whole object is visible in a three-quarter view from slightly above, centered, filling about two thirds of the frame, ' +
  'on a plain flat pure bright green background (#00FF00), no ground, no shadow, no text, no letters, no logos, no flags.';

function seedOf(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return hash;
}

async function run(graph: Record<string, unknown>, label: string): Promise<any> {
  const response = await fetch(`${host}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: 'etat-major-3d' }),
  });
  const queued = (await response.json()) as { prompt_id?: string };
  if (!queued.prompt_id) throw new Error(`${label} : refusé par ComfyUI : ${JSON.stringify(queued).slice(0, 800)}`);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const history = (await (await fetch(`${host}/history/${queued.prompt_id}`)).json()) as Record<string, any>;
    const done = history[queued.prompt_id];
    if (!done) continue;
    if (done.status?.status_str === 'error') throw new Error(`${label} : erreur ComfyUI : ${JSON.stringify(done.status).slice(0, 1500)}`);
    if (done.status?.completed) return done;
  }
}

async function download(file: { filename: string; subfolder: string; type: string }): Promise<Buffer> {
  const query = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder, type: file.type });
  return Buffer.from(await (await fetch(`${host}/view?${query}`)).arrayBuffer());
}

/** L'image de référence : Qwen, puis le vert retiré (PNG avec transparence). */
async function reference(unit: { id: string; subject: string; retry?: number }): Promise<string> {
  const prompt = `${STYLE} ${unit.subject}. ${RULES}`;
  const graph = {
    12: { class_type: 'UNETLoader', inputs: { unet_name: 'qwen_image_2.1_turbo_int8_convrot.safetensors', weight_dtype: 'default' } },
    13: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_8b_int8_convrot.safetensors', type: 'qwen_image', device: 'default' } },
    14: { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' } },
    15: { class_type: 'QwenImage21Cache', inputs: { model: ['12', 0], device: 'auto', dtype: 'default' } },
    16: { class_type: 'TextEncodeQwenImage21', inputs: { clip: ['13', 0], prompt, negative_prompt: '', resolution: 1024 } },
    17: { class_type: 'CFGGuider', inputs: { model: ['15', 0], positive: ['16', 0], negative: ['16', 1], cfg: 1 } },
    // Un nouvel essai change de graine.
    18: { class_type: 'RandomNoise', inputs: { noise_seed: seedOf(`3d-${unit.id}${unit.retry ? `-${unit.retry}` : ''}`) } },
    19: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    20: { class_type: 'ManualSigmas', inputs: { sigmas: '1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0' } },
    11: { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    21: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['18', 0], guider: ['17', 0], sampler: ['19', 0], sigmas: ['20', 0], latent_image: ['11', 0] } },
    22: { class_type: 'VAEDecode', inputs: { samples: ['21', 0], vae: ['14', 0] } },
    23: { class_type: 'SaveImage', inputs: { images: ['22', 0], filename_prefix: `etat-major-3d/ref-${unit.id}` } },
  };
  const done = await run(graph, `${unit.id} (référence)`);
  const image = Object.values(done.outputs ?? {}).flatMap((output: any) => output.images ?? [])[0];
  const raw = join(out, 'ref', `${unit.id}.raw.png`);
  const keyed = join(out, 'ref', `${unit.id}.png`);
  mkdirSync(dirname(raw), { recursive: true });
  writeFileSync(raw, await download(image));
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', raw, '-vf', 'colorkey=0x00FF00:0.32:0.12,despill=type=green,format=rgba', keyed]);
  rmSync(raw);
  return keyed;
}

/** Le modèle 3D : TRELLIS.2, d'après le graphe de démonstration de ComfyUI, sans le recalcul du maillage. */
async function model(unit: { id: string }, reference: string): Promise<string> {
  // L'image de référence va dans le dossier d'entrée de ComfyUI.
  const form = new FormData();
  form.append('image', new Blob([readFileSync(reference)], { type: 'image/png' }), `etat-major-3d-${unit.id}.png`);
  form.append('overwrite', 'true');
  const uploaded = (await (await fetch(`${host}/upload/image`, { method: 'POST', body: form })).json()) as { name: string };
  const seed = seedOf(unit.id) % 1_000_000;
  const graph = {
    122: { class_type: 'LoadImage', inputs: { image: uploaded.name } },
    130: { class_type: 'InvertMask', inputs: { mask: ['122', 1] } },
    312: { class_type: 'ImageCropToMask', inputs: { images: ['122', 0], masks: ['130', 0], width: 1024, height: 1024, pad_factor: 1.1, grow_mask: 0, background: '#000000' } },
    15: { class_type: 'CLIPVisionLoader', inputs: { clip_name: 'dino_v3_vit_l.safetensors' } },
    299: { class_type: 'Trellis2Conditioning', inputs: { clip_vision_model: ['15', 0], image: ['312', 0] } },
    40: { class_type: 'UNETLoader', inputs: { unet_name: 'trellis_2_int8_convrot.safetensors', weight_dtype: 'default' } },
    117: { class_type: 'VAELoader', inputs: { vae_name: 'trellis_2_shape_vae_bf16.safetensors' } },
    118: { class_type: 'VAELoader', inputs: { vae_name: 'trellis_2_texture_vae_bf16.safetensors' } },
    // Structure.
    199: { class_type: 'CFGOverride', inputs: { model: ['40', 0], cfg: 1, start_percent: 0.667, end_percent: 1 } },
    125: { class_type: 'RescaleCFG', inputs: { model: ['199', 0], multiplier: 0.7 } },
    108: { class_type: 'ModelSamplingSD3', inputs: { model: ['125', 0], shift: 5 } },
    87: { class_type: 'EmptyTrellis2LatentStructure', inputs: { batch_size: 1 } },
    3: { class_type: 'KSampler', inputs: { model: ['108', 0], seed, steps: 12, cfg: 7.5, sampler_name: 'euler', scheduler: 'normal', denoise: 1, positive: ['299', 0], negative: ['299', 1], latent_image: ['87', 0] } },
    119: { class_type: 'VaeDecodeStructureTrellis2', inputs: { samples: ['3', 0], vae: ['117', 0], resolution: '32' } },
    // Forme, puis forme affinée.
    91: { class_type: 'Trellis2ShapeStage', inputs: { positive: ['299', 0], negative: ['299', 1], voxel: ['119', 0] } },
    279: { class_type: 'CFGOverride', inputs: { model: ['40', 0], cfg: 1, start_percent: 0.769, end_percent: 1 } },
    126: { class_type: 'RescaleCFG', inputs: { model: ['279', 0], multiplier: 0.5 } },
    18: { class_type: 'KSampler', inputs: { model: ['126', 0], seed, steps: 20, cfg: 7.5, sampler_name: 'euler', scheduler: 'normal', denoise: 1, positive: ['91', 0], negative: ['91', 1], latent_image: ['91', 2] } },
    94: { class_type: 'Trellis2UpsampleStage', inputs: { positive: ['91', 0], negative: ['91', 1], shape_latent: ['18', 0], vae: ['117', 0], target_resolution: 1024 } },
    23: { class_type: 'KSampler', inputs: { model: ['126', 0], seed, steps: 12, cfg: 7.5, sampler_name: 'euler', scheduler: 'simple', denoise: 1, positive: ['94', 0], negative: ['94', 1], latent_image: ['94', 2] } },
    92: { class_type: 'VaeDecodeShapeTrellis', inputs: { samples: ['23', 0], vae: ['117', 0] } },
    // Couleurs.
    98: { class_type: 'Trellis2TextureStage', inputs: { positive: ['94', 0], negative: ['94', 1], shape_latent: ['23', 0] } },
    12: { class_type: 'KSampler', inputs: { model: ['40', 0], seed: seed + 1, steps: 12, cfg: 1, sampler_name: 'euler', scheduler: 'normal', denoise: 1, positive: ['98', 0], negative: ['98', 1], latent_image: ['98', 2] } },
    93: { class_type: 'VaeDecodeTextureTrellis', inputs: { samples: ['12', 0], vae: ['118', 0], shape_subdivides: ['92', 1] } },
    // Un maillage propre : refait en un seul solide fermé (plus de trous), réduit, puis texturé par une
    // vraie texture cuite depuis les couleurs du modèle (plus nette que des couleurs par sommet).
    241: {
      class_type: 'RemeshMesh',
      inputs: {
        mesh: ['92', 0],
        resolution: 512,
        sign_mode: 'solid',
        'sign_mode.fill': 20,
        'sign_mode.qef': false,
        band: 1,
        project_back: 0,
        fix_poles: false,
        smooth_iters: 20,
        drop_small_components: 0.01,
        precluster_max_verts: 20000000,
      },
    },
    186: { class_type: 'DecimateMesh', inputs: { mesh: ['241', 0], target_face_count: 120000, placement_mode: 'midpoint' } },
    238: { class_type: 'MeshSmoothNormals', inputs: { mesh: ['186', 0], crease_angle: 180 } },
    196: { class_type: 'UnwrapMesh', inputs: { mesh: ['238', 0], segmenter: 'pec', resolution: 2048, padding: 2, weld_distance: 0.0002 } },
    147: { class_type: 'BakeTextureFromVoxel', inputs: { mesh: ['196', 0], voxel_colors: ['93', 0], reference_mesh: ['92', 0], texture_size: 2048 } },
    210: { class_type: 'ApplyTextureToMesh', inputs: { mesh: ['196', 0], base_color: ['147', 0] } },
    260: { class_type: 'MeshSmoothNormals', inputs: { mesh: ['210', 0], crease_angle: 180 } },
    282: { class_type: 'MeshToFile3D', inputs: { mesh: ['260', 0] } },
    300: { class_type: 'SaveGLB', inputs: { mesh: ['282', 0], filename_prefix: `etat-major-3d/${unit.id}` } },
  };
  const done = await run(graph, `${unit.id} (3D)`);
  const files = Object.values(done.outputs ?? {}).flatMap((output: any) => [...(output['3d'] ?? []), ...(output.images ?? []), ...(output.result ?? [])]);
  const glb = files.find((file: any) => typeof file?.filename === 'string' && file.filename.endsWith('.glb'));
  if (!glb) throw new Error(`${unit.id} : pas de GLB en sortie : ${JSON.stringify(done.outputs).slice(0, 800)}`);
  const path = join(out, `${unit.id}.glb`);
  writeFileSync(path, await download(glb));
  return path;
}

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const force = args.includes('--force');
const refOnly = args.includes('--ref');
mkdirSync(out, { recursive: true });
for (const unit of UNITS.filter((entry) => !only || only.has(entry.id))) {
  const begin = Date.now();
  const refPath = join(out, 'ref', `${unit.id}.png`);
  const ref = !force && existsSync(refPath) ? refPath : await reference(unit);
  if (refOnly) {
    console.log(`${unit.id} : référence en ${((Date.now() - begin) / 1000).toFixed(0)} s`);
    continue;
  }
  const glbPath = join(out, `${unit.id}.glb`);
  if (!force && existsSync(glbPath)) continue;
  const glb = await model(unit, ref);
  console.log(`${unit.id} : ${glb} en ${((Date.now() - begin) / 1000).toFixed(0)} s`);
}
