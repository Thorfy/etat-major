// Récepteur des planches de l'atelier des sprites (tools/sprite-baker.html) : la page lui envoie
// chaque planche en PNG, il l'enregistre en WebP détouré dans public/art/unites/.
//   node tools/sprite-sink.ts      écoute sur http://127.0.0.1:5199
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public/art/unites');
const preview = join(root, 'assets3d/preview');
const ffmpeg = process.env.FFMPEG ?? (existsSync('D:/Labs/ffmpeg/bin/ffmpeg.exe') ? 'D:/Labs/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg');
mkdirSync(dir, { recursive: true });
mkdirSync(preview, { recursive: true });

createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') return void response.end();
  const url = new URL(request.url ?? '/', 'http://localhost');
  const name = (url.searchParams.get('name') ?? '').replace(/[^a-z0-9-]/g, '');
  const keep = url.searchParams.get('preview') === '1';
  if (request.method !== 'POST' || !name) {
    response.statusCode = 400;
    return void response.end('nom manquant');
  }
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => {
    const base64 = Buffer.concat(chunks).toString('utf8').replace(/^data:image\/png;base64,/, '');
    const png = join(keep ? preview : dir, `${name}.png`);
    writeFileSync(png, Buffer.from(base64, 'base64'));
    if (!keep) {
      // En jeu : WebP avec transparence, plus léger.
      execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '88', '-pix_fmt', 'yuva420p', join(dir, `${name}.webp`)]);
      rmSync(png);
    }
    console.log(`${name} enregistré${keep ? ' (aperçu)' : ''}`);
    response.end('ok');
  });
}).listen(5199, '127.0.0.1', () => console.log('Récepteur des planches sur http://127.0.0.1:5199'));
