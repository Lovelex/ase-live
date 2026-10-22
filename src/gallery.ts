// Galeria (só no vite dev): <servidor>/__ase-live/ mostra todos os sprites de art/ com cada animação tocando,
// os quadros, os pontos e os avisos. Salvou no Aseprite, a galeria atualiza.
// Roda no navegador; o plugin serve este arquivo e o anim.js como estão em dist/.

import { frameAt } from './anim.js';
import type { Sprite, Tag } from './types.js';

type SpritesModule = typeof import('./sprites.js');

/** Uma animação a mostrar: uma tag, ou o arquivo inteiro quando ele não tem tags. */
export interface GalleryEntry {
  name: string;
  tag: string | null;
  frames: number[];
  /** duração de cada quadro, em ms, na ordem de `frames` */
  durations: number[];
  direction: Tag['direction'];
  repeat: number;
}

export function galleryEntries(sprite: Sprite): GalleryEntry[] {
  const make = (name: string, tag: string | null, t: Tag): GalleryEntry => {
    const frames: number[] = [];
    for (let f = t.from; f <= t.to; f++) frames.push(f);
    return { name, tag, frames, durations: frames.map((f) => sprite.frames[f]?.duration ?? 0), direction: t.direction, repeat: t.repeat };
  };
  const tags = Object.entries(sprite.tags);
  if (tags.length === 0) {
    return [make('(todos os quadros)', null, { from: 0, to: sprite.frames.length - 1, direction: 'forward', repeat: 0 })];
  }
  return tags.map(([name, t]) => make(name, name, t));
}

const DIRECTION_LABEL: Record<Tag['direction'], string> = {
  forward: '',
  reverse: 'ao contrário',
  pingpong: 'vai e volta',
  'pingpong-reverse': 'volta e vai',
};

/**
 * Texto curto de uma animação, com os quadros numerados como na linha do tempo do Aseprite (a partir de 1):
 * "quadro 14", "quadros 3 a 8, 83 ms", "quadros 1 a 4, 50 a 200 ms, vai e volta, toca 2x".
 */
export function describeEntry(e: GalleryEntry): string {
  const first = (e.frames[0] ?? 0) + 1;
  const last = (e.frames[e.frames.length - 1] ?? 0) + 1;
  const parts = [e.frames.length === 1 ? `quadro ${first}` : `quadros ${first} a ${last}`];
  if (e.frames.length > 1) {
    const min = Math.min(...e.durations);
    const max = Math.max(...e.durations);
    parts.push(min === max ? `${min} ms` : `${min} a ${max} ms`);
  }
  if (DIRECTION_LABEL[e.direction]) parts.push(DIRECTION_LABEL[e.direction]);
  if (e.repeat > 0) parts.push(`toca ${e.repeat}x`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------------------------------------------
// Página (só no navegador)

const POINT_COLORS = ['#3fd0ff', '#ff4fd8', '#ffd23f', '#7dff6a', '#ff8a3f'];
const BACKGROUNDS = { escuro: '#24222b', claro: '#e9e6dc', xadrez: 'checker' } as const;
type Background = keyof typeof BACKGROUNDS;

interface Settings {
  zoom: number;
  background: Background;
  points: boolean;
  frames: boolean;
  filter: string;
}

const SETTINGS_KEY = 'ase-live.gallery';

function loadSettings(): Settings {
  const base: Settings = { zoom: 4, background: 'escuro', points: false, frames: true, filter: '' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Settings>;
      if (typeof s.zoom === 'number' && s.zoom >= 1 && s.zoom <= 12) base.zoom = s.zoom;
      if (s.background && s.background in BACKGROUNDS) base.background = s.background;
      if (typeof s.points === 'boolean') base.points = s.points;
      if (typeof s.frames === 'boolean') base.frames = s.frames;
    }
  } catch {
    // sem localStorage (janela anônima, bloqueado): fica no padrão
  }
  return base;
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, filter: '' }));
  } catch {
    // idem
  }
}

const CSS = `
:root { color-scheme: dark; --bg: #18171d; --panel: #222029; --line: #34313d; --text: #e4e1d8; --dim: #9a96a6; --accent: #e4b84b; --warn: #f0a04b; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
header h1 { margin: 0; font-size: 16px; color: var(--accent); }
header .count { color: var(--dim); }
header label { display: flex; gap: 6px; align-items: center; color: var(--dim); }
header input[type=search] { width: 180px; }
input, select { background: var(--bg); color: var(--text); border: 1px solid var(--line); padding: 3px 6px; font: inherit; }
main { padding: 8px 16px 40px; }
.warnings { margin: 12px 0; padding: 8px 12px; border-left: 3px solid var(--warn); background: #2a2420; color: var(--warn); white-space: pre-wrap; }
section.sprite { margin-top: 22px; }
section.sprite h2 { margin: 0 0 2px; font-size: 18px; }
section.sprite .meta { color: var(--dim); margin-bottom: 10px; }
.cards { display: flex; flex-wrap: wrap; gap: 12px; }
.card { background: var(--panel); border: 1px solid var(--line); padding: 8px; max-width: 100%; }
.card .name { font-weight: bold; margin-top: 6px; }
.card .info { color: var(--dim); font-size: 12px; }
.card canvas.anim { display: block; image-rendering: pixelated; }
.strip { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; max-width: 420px; }
.strip figure { margin: 0; text-align: center; font-size: 10px; color: var(--dim); }
.strip canvas { display: block; image-rendering: pixelated; border: 1px solid var(--line); }
.legend { display: flex; gap: 12px; color: var(--dim); margin-bottom: 8px; }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; margin-right: 4px; vertical-align: -1px; border: 2px solid var(--c); }
.tileset { margin-top: 12px; }
.tileset canvas { image-rendering: pixelated; border: 1px solid var(--line); }
.empty { color: var(--dim); margin-top: 40px; }
`;

interface Card {
  sprite: Sprite;
  entry: GalleryEntry;
  img: HTMLImageElement;
  ctx: CanvasRenderingContext2D;
  start: number;
  /** quando a tag com fim terminou (para recomeçar depois de uma pausa) */
  doneAt: number | null;
  shown: number;
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Background, cell: number): void {
  const value = BACKGROUNDS[bg];
  if (value !== 'checker') {
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((x + y) / cell) % 2 === 0 ? '#3a3844' : '#2c2a34';
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, sprite: Sprite, img: HTMLImageElement, frame: number, zoom: number, s: Settings): void {
  const f = sprite.frames[frame];
  const w = sprite.width * zoom;
  const h = sprite.height * zoom;
  paintBackground(ctx, w, h, s.background, Math.max(4, zoom * 4));
  if (!f) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, w, h);
  if (!s.points) return;
  Object.values(sprite.points).forEach((list, i) => {
    const p = list[frame];
    if (!p) return;
    ctx.strokeStyle = POINT_COLORS[i % POINT_COLORS.length]!;
    ctx.lineWidth = Math.max(1, Math.floor(zoom / 3));
    ctx.strokeRect(p.x * zoom + ctx.lineWidth / 2, p.y * zoom + ctx.lineWidth / 2, zoom - ctx.lineWidth, zoom - ctx.lineWidth);
  });
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img);
}

export async function startGallery(): Promise<void> {
  const url = document.querySelector<HTMLMetaElement>('meta[name="ase-live-sprites"]')?.content;
  if (!url) throw new Error('galeria sem o endereço dos sprites');
  const mod = (await import(/* @vite-ignore */ url)) as SpritesModule;

  document.head.append(el('style', { textContent: CSS }));
  const settings = loadSettings();
  let cards: Card[] = [];
  let latest: Record<string, Sprite> = {};
  let renders = 0;

  const count = el('span', { className: 'count' });
  const search = el('input', { type: 'search', placeholder: 'filtrar animação', value: settings.filter });
  const zoom = el('select');
  for (const z of [1, 2, 3, 4, 6, 8, 12]) zoom.append(el('option', { value: String(z), textContent: `${z}x`, selected: z === settings.zoom }));
  const background = el('select');
  for (const b of Object.keys(BACKGROUNDS)) background.append(el('option', { value: b, textContent: b, selected: b === settings.background }));
  const points = el('input', { type: 'checkbox', checked: settings.points });
  const frames = el('input', { type: 'checkbox', checked: settings.frames });
  const main = el('main');

  document.body.replaceChildren(
    el('header', {},
      el('h1', { textContent: 'ase-live' }),
      count,
      el('label', {}, 'filtro', search),
      el('label', {}, 'zoom', zoom),
      el('label', {}, 'fundo', background),
      el('label', {}, points, 'pontos'),
      el('label', {}, frames, 'quadros'),
    ),
    main,
  );

  const render = async (all: Record<string, Sprite>): Promise<void> => {
    latest = all;
    const run = ++renders;
    const list = Object.values(all).sort((a, b) => a.name.localeCompare(b.name));
    const filter = settings.filter.trim().toLowerCase();
    const images = new Map(await Promise.all(list.map(async (s) => [s.name, await loadImage(s.image)] as const)));
    const tilesetImages = new Map(await Promise.all(
      list.flatMap((s) => s.tilesets.map(async (t, i) => [`${s.name}#${i}`, await loadImage(t.image)] as const)),
    ));
    if (run !== renders) return; // chegou atualização mais nova enquanto carregava

    const nodes: Node[] = [];
    if (mod.warnings.length) nodes.push(el('div', { className: 'warnings', textContent: mod.warnings.join('\n') }));
    if (list.length === 0) nodes.push(el('p', { className: 'empty', textContent: 'Nenhum arquivo em art/ ainda. Salve um .aseprite lá e ele aparece aqui.' }));

    const fresh: Card[] = [];
    let shownEntries = 0;
    for (const sprite of list) {
      const img = images.get(sprite.name)!;
      const entries = galleryEntries(sprite).filter((e) => !filter || e.name.toLowerCase().includes(filter));
      if (filter && entries.length === 0) continue;
      shownEntries += entries.length;
      const pointNames = Object.keys(sprite.points);
      const section = el('section', { className: 'sprite' },
        el('h2', { textContent: sprite.name }),
        el('div', {
          className: 'meta',
          textContent: `${sprite.width}x${sprite.height} px, ${sprite.frames.length} quadros, ${Object.keys(sprite.tags).length} animações`,
        }),
      );
      if (settings.points && pointNames.length) {
        section.append(el('div', { className: 'legend' },
          ...pointNames.map((n, i) => {
            const span = el('span', { textContent: `@${n}` });
            span.style.setProperty('--c', POINT_COLORS[i % POINT_COLORS.length]!);
            return span;
          }),
        ));
      }
      const cardsBox = el('div', { className: 'cards' });
      for (const entry of entries) {
        const canvas = el('canvas', { className: 'anim', width: sprite.width * settings.zoom, height: sprite.height * settings.zoom });
        const ctx = canvas.getContext('2d')!;
        const card = el('div', { className: 'card', title: entry.tag ?? '' },
          canvas,
          el('div', { className: 'name', textContent: entry.name }),
          el('div', { className: 'info', textContent: describeEntry(entry) }),
        );
        if (settings.frames && entry.frames.length > 1) {
          const small = Math.max(1, Math.round(settings.zoom / 2));
          const strip = el('div', { className: 'strip' });
          for (const f of entry.frames) {
            const c = el('canvas', { width: sprite.width * small, height: sprite.height * small });
            drawFrame(c.getContext('2d')!, sprite, img, f, small, settings);
            strip.append(el('figure', {}, c, String(f + 1)));
          }
          card.append(strip);
        }
        cardsBox.append(card);
        fresh.push({ sprite, entry, img, ctx, start: performance.now(), doneAt: null, shown: -1 });
      }
      section.append(cardsBox);
      sprite.tilesets.forEach((t, i) => {
        const timg = tilesetImages.get(`${sprite.name}#${i}`)!;
        const c = el('canvas', { width: timg.width * settings.zoom, height: timg.height * settings.zoom });
        const tctx = c.getContext('2d')!;
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(timg, 0, 0, c.width, c.height);
        section.append(el('div', { className: 'tileset' },
          el('div', { className: 'name', textContent: `tileset ${t.name || i}: ${t.count - 1} peças de ${t.tileWidth}x${t.tileHeight}` }),
          c,
        ));
      });
      nodes.push(section);
    }
    count.textContent = `${list.length} ${list.length === 1 ? 'sprite' : 'sprites'}, ${shownEntries} animações`;
    main.replaceChildren(...nodes);
    cards = fresh;
  };

  const rerender = (): void => {
    saveSettings(settings);
    void render(latest);
  };
  search.addEventListener('input', () => { settings.filter = search.value; rerender(); });
  zoom.addEventListener('change', () => { settings.zoom = Number(zoom.value); rerender(); });
  background.addEventListener('change', () => { settings.background = background.value as Background; rerender(); });
  points.addEventListener('change', () => { settings.points = points.checked; rerender(); });
  frames.addEventListener('change', () => { settings.frames = frames.checked; rerender(); });

  // Tag que toca N vezes: para no último quadro e recomeça depois de uma pausa.
  const PAUSE = 700;
  const tick = (now: number): void => {
    for (const card of cards) {
      const play = frameAt(card.sprite, card.entry.tag, now - card.start);
      let frame = play.frame;
      if (play.done) {
        card.doneAt ??= now;
        if (now - card.doneAt > PAUSE) {
          card.start = now;
          card.doneAt = null;
          frame = frameAt(card.sprite, card.entry.tag, 0).frame;
        }
      }
      if (frame !== card.shown) {
        card.shown = frame;
        drawFrame(card.ctx, card.sprite, card.img, frame, settings.zoom, settings);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  mod.watchSprites((all) => { void render(all); });
}

if (typeof document !== 'undefined' && document.querySelector('meta[name="ase-live-sprites"]')) {
  void startGallery().catch((e: unknown) => {
    document.body.textContent = `ase-live: a galeria não abriu (${e instanceof Error ? e.message : String(e)})`;
  });
}
