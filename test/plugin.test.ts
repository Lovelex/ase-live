import { copyFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer, type Rolldown, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import aseLive from '../src/plugin.js';
import type { Sprite } from '../src/types.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'ase-live-'));
  mkdirSync(join(root, 'art', 'herois'), { recursive: true });
  copyFileSync(join(FIXTURES, 'rgba.aseprite'), join(root, 'art', 'herois', 'ninja.aseprite'));
  copyFileSync(join(FIXTURES, 'tiles.aseprite'), join(root, 'art', 'chao.aseprite'));
  writeFileSync(join(root, 'art', 'quebrado.aseprite'), 'isto não é um arquivo do Aseprite');
  writeFileSync(join(root, 'main.js'), "import { sprites } from 'ase-live/sprites';\nconsole.log(sprites);\n");
  return root;
}

describe('no vite dev', () => {
  let root: string;
  let server: ViteDevServer;
  type Mod = { sprites: Record<string, Sprite>; warnings: string[] };
  const loadMod = () => server.ssrLoadModule('ase-live/sprites') as Promise<Mod>;

  beforeAll(async () => {
    root = project();
    server = await createServer({ root, logLevel: 'silent', configFile: false, plugins: [aseLive()], server: { middlewareMode: true, ws: false } });
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('todo arquivo de art/ vira sprite pelo caminho', async () => {
    const mod = await loadMod();
    expect(Object.keys(mod.sprites).sort()).toEqual(['chao', 'herois/ninja']);
    const ninja = mod.sprites['herois/ninja']!;
    expect(ninja.image).toMatch(/^data:image\/png;base64,/);
    expect(Object.keys(ninja.tags)).toEqual(['idle', 'run']);
    expect(ninja.points.pe![0]).toEqual({ x: 4, y: 5 });
    expect(mod.sprites.chao!.tilesets[0]!.image).toMatch(/^data:image\/png;base64,/);
  });

  it('arquivo que não abre vira aviso, sem derrubar os outros', async () => {
    const mod = await loadMod();
    expect(mod.warnings.some((w) => w.startsWith('quebrado:'))).toBe(true);
  });

  it('arquivo trocado é relido', async () => {
    const file = join(root, 'art', 'herois', 'ninja.aseprite');
    copyFileSync(join(FIXTURES, 'gray.aseprite'), file);
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
    const mod = server.moduleGraph.getModuleById('\0ase-live:sprites');
    if (mod) server.moduleGraph.invalidateModule(mod);
    const fresh = await loadMod();
    expect(fresh.sprites['herois/ninja']).toMatchObject({ width: 2, height: 2 });
  });
});

describe('no vite build', () => {
  it('imagens viram arquivos', async () => {
    const root = project();
    try {
      const result = await build({
        root, logLevel: 'silent', configFile: false, plugins: [aseLive()],
        build: { write: false, rollupOptions: { input: join(root, 'main.js') } },
      });
      const output = (Array.isArray(result) ? result[0] : result) as Rolldown.RolldownOutput;
      const assets = output.output.filter((o) => o.type === 'asset').map((o) => o.fileName);
      expect(assets.some((f) => /herois-ninja-.*\.png$/.test(f))).toBe(true);
      expect(assets.some((f) => /chao-rocha-.*\.png$/.test(f))).toBe(true);
      const code = output.output.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n');
      expect(code).not.toContain('data:image/png');
      expect(code).toMatch(/herois-ninja-.*\.png/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
