// Plugin do Vite: lê os .aseprite/.ase de art/ e entrega ao jogo como
// `import { sprites } from 'ase-live/sprites'`. No `vite dev`, salvar no
// Aseprite atualiza o jogo aberto sem recarregar a página.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import { buildSprite, type BuiltSprite } from './sheet.js';
import type { Sprite } from './types.js';

export interface AseLiveOptions {
  /** pasta dos arquivos do Aseprite, a partir da raiz do projeto (padrão: "art") */
  dir?: string;
}

const PUBLIC_ID = 'ase-live/sprites';
const RESOLVED_ID = '\0ase-live:sprites';
const EXTENSIONS = ['.aseprite', '.ase'];

// Galeria (só no dev): página + os dois scripts compilados, servidos de dist/ como estão.
const GALLERY_FILES = new Set(['gallery.js', 'gallery.js.map', 'anim.js', 'anim.js.map']);
const here = path.dirname(fileURLToPath(import.meta.url));
// rodando de src/ (testes do pacote), os scripts estão em dist/
const galleryDir = existsSync(path.join(here, 'gallery.js')) ? here : path.join(here, '..', 'dist');

function galleryPage(base: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ase-live: galeria</title>
<meta name="ase-live-sprites" content="${base}@id/__x00__ase-live:sprites">
</head>
<body>
<script type="module" src="${base}__ase-live/gallery.js"></script>
</body>
</html>
`;
}

const zlib = {
  inflate: (data: Uint8Array) => new Uint8Array(inflateSync(data)),
  deflate: (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 9 })),
};

interface CacheEntry {
  mtimeMs: number;
  size: number;
  built: BuiltSprite | null;
  error: string | null;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out.sort();
}

const isArtFile = (file: string, dir: string): boolean =>
  EXTENSIONS.includes(path.extname(file).toLowerCase()) && !path.relative(dir, file).startsWith('..');

export default function aseLive(options: AseLiveOptions = {}): Plugin {
  let config: ResolvedConfig;
  let dir = '';
  let server: ViteDevServer | null = null;
  const cache = new Map<string, CacheEntry>();
  const reported = new Set<string>();

  const spriteName = (file: string): string => {
    const rel = path.relative(dir, file).split(path.sep).join('/');
    return rel.slice(0, rel.length - path.extname(rel).length);
  };

  const load = (file: string): CacheEntry => {
    const stat = statSync(file);
    const hit = cache.get(file);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit;
    let entry: CacheEntry;
    try {
      entry = { mtimeMs: stat.mtimeMs, size: stat.size, built: buildSprite(spriteName(file), readFileSync(file), zlib), error: null };
    } catch (e) {
      entry = { mtimeMs: stat.mtimeMs, size: stat.size, built: null, error: e instanceof Error ? e.message : String(e) };
    }
    cache.set(file, entry);
    return entry;
  };

  const report = (lines: string[]): void => {
    for (const line of lines) {
      if (reported.has(line)) continue;
      reported.add(line);
      config.logger.warn(`[ase-live] ${line}`, { timestamp: true });
    }
  };

  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleReload = (): void => {
    if (!server) return;
    // o Aseprite pode gravar o arquivo em mais de um pedaço: espera assentar
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      const env = server?.environments.client;
      const mod = env?.moduleGraph.getModuleById(RESOLVED_ID);
      if (env && mod) void env.reloadModule(mod);
    }, 60);
  };

  return {
    name: 'ase-live',
    enforce: 'pre',

    configResolved(resolved) {
      config = resolved;
      dir = path.resolve(config.root, options.dir ?? 'art');
    },

    configureServer(devServer) {
      server = devServer;
      const base = config.base.startsWith('/') ? config.base : '/';
      devServer.middlewares.use(`${base}__ase-live`, (req, res) => {
        const file = (req.url ?? '/').split('?')[0]!.replace(/^\/+/, '');
        if (file === '') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(galleryPage(base));
          return;
        }
        const full = path.join(galleryDir, file);
        if (!GALLERY_FILES.has(file) || !existsSync(full)) {
          res.statusCode = 404;
          res.end('não encontrado');
          return;
        }
        res.setHeader('Content-Type', file.endsWith('.map') ? 'application/json' : 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(full));
      });
      devServer.httpServer?.once('listening', () => {
        // depois das URLs do próprio Vite
        setTimeout(() => {
          const local = devServer.resolvedUrls?.local[0];
          if (local) config.logger.info(`  \x1b[32m➜\x1b[0m  Galeria: ${new URL('__ase-live/', local).href}`);
        }, 50);
      });
      devServer.watcher.add(dir);
      const onFile = (file: string): void => {
        if (!isArtFile(file, dir)) return;
        cache.delete(file);
        scheduleReload();
      };
      devServer.watcher.on('add', onFile);
      devServer.watcher.on('change', onFile);
      devServer.watcher.on('unlink', onFile);
      devServer.watcher.on('addDir', () => scheduleReload());
    },

    resolveId(id) {
      return id === PUBLIC_ID ? RESOLVED_ID : null;
    },

    load(id) {
      if (id !== RESOLVED_ID) return null;
      const build = config.command === 'build';
      const files = listFiles(dir);
      for (const file of cache.keys()) if (!files.includes(file)) cache.delete(file);

      const entries: string[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      if (!existsSync(dir)) warnings.push(`pasta ${path.relative(config.root, dir) || '.'}/ não existe: crie e salve os arquivos do Aseprite nela`);

      // imagem → expressão JS (data URL no dev, arquivo no build)
      const imageExpr = (png: Uint8Array, fileName: string): string => {
        if (!build) return JSON.stringify(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
        const ref = this.emitFile({ type: 'asset', name: fileName, source: png });
        return `import.meta.ROLLUP_FILE_URL_${ref}`;
      };

      for (const file of files) {
        // no dev quem vigia é o configureServer (recarga sem F5); o Vite vigiando também recarregava a página
        if (build) this.addWatchFile(file);
        const name = spriteName(file);
        const entry = load(file);
        if (!entry.built) {
          errors.push(`${name}: ${entry.error}`);
          continue;
        }
        const { sprite, sheet, tilesets } = entry.built;
        warnings.push(...sprite.warnings.map((w) => `${name}: ${w}`));
        // nome de arquivo do build só com caracteres seguros (nome de tileset vem de dentro do arquivo)
        const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, '-');
        const base = safe(name);
        const tilesetCode = sprite.tilesets
          .map((t, i) => `{ ...${JSON.stringify(t)}, image: ${imageExpr(tilesets[i]!, `${base}-${safe(t.name) || i}.png`)} }`)
          .join(', ');
        const rest: Omit<Sprite, 'image' | 'tilesets'> & { image?: string; tilesets?: unknown } = { ...sprite };
        delete rest.image;
        delete rest.tilesets;
        entries.push(`  ${JSON.stringify(name)}: { ...${JSON.stringify(rest)}, image: ${imageExpr(sheet, `${base}.png`)}, tilesets: [${tilesetCode}] }`);
      }

      report([...warnings, ...errors]);
      if (server && errors.length) {
        server.ws.send({
          type: 'error',
          err: { message: `ase-live: não deu para ler\n${errors.join('\n')}`, stack: '', plugin: 'ase-live' },
        });
      }

      const all = [...errors, ...warnings];
      return [
        `const data = {\n${entries.join(',\n')}\n};`,
        `const list = ${JSON.stringify(all)};`,
        // Um objeto só entre as recargas: quem guardou `sprites` vê os dados novos.
        // (`import.meta.hot.accept(` tem de aparecer escrito assim: o Vite procura o texto.)
        `export const sprites = import.meta.hot?.data.sprites ?? {};`,
        `export const warnings = import.meta.hot?.data.warnings ?? [];`,
        `const listeners = import.meta.hot?.data.listeners ?? new Set();`,
        `for (const k of Object.keys(sprites)) delete sprites[k];`,
        `Object.assign(sprites, data);`,
        `warnings.splice(0, warnings.length, ...list);`,
        `for (const w of list) console.warn('[ase-live] ' + w);`,
        `export function watchSprites(fn) { listeners.add(fn); fn(sprites); }`,
        `if (import.meta.hot) {`,
        `  import.meta.hot.data.sprites = sprites;`,
        `  import.meta.hot.data.warnings = warnings;`,
        `  import.meta.hot.data.listeners = listeners;`,
        `  import.meta.hot.accept();`,
        `  if (import.meta.hot.data.loaded) for (const fn of listeners) fn(sprites);`,
        `  import.meta.hot.data.loaded = true;`,
        `}`,
      ].join('\n');
    },
  };
}
