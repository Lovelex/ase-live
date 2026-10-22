// Desenha os quadros de um AseFile em RGBA com a mesma conta do Aseprite
// (mistura "normal" de render/blend_funcs.cpp) e aplica a convenção do ase-live:
//   camada/grupo que começa com "_"  → não vai para o jogo (rascunho, guia)
//   camada que começa com "@"       → ponto: o pixel pintado em cada quadro vira coordenada
//   camada escondida ou de referência → não vai para o jogo

import type { AseCel, AseFile, AseLayer, AseTilemapCel } from './read.js';
import type { AnimDirection, Point, SliceKey } from './types.js';

export interface ComposedTag {
  from: number;
  to: number;
  direction: AnimDirection;
  repeat: number;
}

export interface ComposedTileset {
  name: string;
  tileWidth: number;
  tileHeight: number;
  count: number;
  /** RGBA, tileWidth × (tileHeight × count): uma peça embaixo da outra */
  pixels: Uint8Array;
}

export interface Composed {
  width: number;
  height: number;
  /** RGBA de cada quadro, width × height */
  frames: Uint8Array[];
  durations: number[];
  tags: Record<string, ComposedTag>;
  points: Record<string, (Point | null)[]>;
  slices: Record<string, SliceKey[]>;
  tilesets: ComposedTileset[];
  warnings: string[];
}

const DIRECTIONS: AnimDirection[] = ['forward', 'reverse', 'pingpong', 'pingpong-reverse'];

const mul = (a: number, b: number): number => {
  const t = a * b + 0x80;
  return ((t >> 8) + t) >> 8;
};

/** Mistura normal do Aseprite (rgba_blender_normal), pixel `i` do destino. */
function blend(dst: Uint8Array, i: number, r: number, g: number, b: number, a: number, opacity: number): void {
  const Ba = dst[i + 3]!;
  if (Ba === 0) {
    const Sa = mul(a, opacity);
    if (Sa === 0) return; // destino segue transparente e zerado (PNG menor)
    dst[i] = r; dst[i + 1] = g; dst[i + 2] = b; dst[i + 3] = Sa;
    return;
  }
  if (a === 0) return;
  const Sa = mul(a, opacity);
  const Ra = Sa + Ba - mul(Ba, Sa);
  dst[i] = dst[i]! + Math.trunc(((r - dst[i]!) * Sa) / Ra);
  dst[i + 1] = dst[i + 1]! + Math.trunc(((g - dst[i + 1]!) * Sa) / Ra);
  dst[i + 2] = dst[i + 2]! + Math.trunc(((b - dst[i + 2]!) * Sa) / Ra);
  dst[i + 3] = Ra;
}

const ignored = (layer: AseLayer): boolean => layer.name.startsWith('_') || layer.name.startsWith('@');

export function compose(file: AseFile): Composed {
  const warnings: string[] = [];
  const { width, height } = file;
  const warnedBlend = new Set<number>();

  // Cor de um pixel no formato do arquivo → RGBA (na saída `out`).
  const out = new Uint8Array(4);
  const color = (data: Uint8Array, p: number, opaqueIndex: boolean): void => {
    if (file.depth === 32) {
      out[0] = data[p * 4]!; out[1] = data[p * 4 + 1]!; out[2] = data[p * 4 + 2]!; out[3] = data[p * 4 + 3]!;
    } else if (file.depth === 16) {
      const v = data[p * 2]!;
      out[0] = v; out[1] = v; out[2] = v; out[3] = data[p * 2 + 1]!;
    } else {
      const idx = data[p]!;
      if (!opaqueIndex && idx === file.transparentIndex) {
        out[0] = out[1] = out[2] = out[3] = 0;
      } else {
        out[0] = file.palette[idx * 4] ?? 0; out[1] = file.palette[idx * 4 + 1] ?? 0;
        out[2] = file.palette[idx * 4 + 2] ?? 0; out[3] = file.palette[idx * 4 + 3] ?? 0;
      }
    }
  };

  const celAt = (layer: number, frame: number): AseCel | undefined => {
    const cel = file.cels[frame]?.find((c) => c.layer === layer);
    if (cel?.kind === 'linked') {
      const target = file.cels[cel.linkedFrame]?.find((c) => c.layer === layer);
      return target && target.kind !== 'linked' ? { ...target, x: cel.x, y: cel.y, opacity: cel.opacity, zIndex: cel.zIndex } : undefined;
    }
    return cel;
  };

  const children = new Map<number, AseLayer[]>();
  for (const layer of file.layers) {
    const list = children.get(layer.parent) ?? [];
    list.push(layer);
    children.set(layer.parent, list);
  }

  // Peças dos tilesets já em RGBA.
  const tilesets: ComposedTileset[] = file.tilesets.map((ts) => {
    const pixels = new Uint8Array(ts.tileWidth * ts.tileHeight * ts.count * 4);
    if (ts.data) {
      for (let p = 0; p < pixels.length / 4; p++) {
        color(ts.data, p, false);
        if (out[3]) pixels.set(out, p * 4);
      }
    } else {
      warnings.push(`tileset "${ts.name}" está num arquivo externo: não é suportado, as peças ficam vazias`);
    }
    return { name: ts.name, tileWidth: ts.tileWidth, tileHeight: ts.tileHeight, count: ts.count, pixels };
  });

  const drawTilemap = (dst: Uint8Array, layer: AseLayer, cel: AseTilemapCel, opacity: number): void => {
    const ts = file.tilesets.find((t) => t.id === layer.tileset);
    const rgba = ts && tilesets[file.tilesets.indexOf(ts)];
    if (!ts || !rgba) return;
    const tw = ts.tileWidth;
    const th = ts.tileHeight;
    for (let ty = 0; ty < cel.height; ty++) {
      for (let tx = 0; tx < cel.width; tx++) {
        const value = cel.tiles[ty * cel.width + tx]!;
        const id = (value & cel.idMask) >>> 0;
        if (ts.zeroIsEmpty ? id === 0 : id === cel.idMask >>> 0) continue;
        if (id >= ts.count) continue;
        const xf = (value & cel.xFlip) !== 0;
        const yf = (value & cel.yFlip) !== 0;
        const df = (value & cel.dFlip) !== 0;
        for (let py = 0; py < th; py++) {
          const y = cel.y + ty * th + py;
          if (y < 0 || y >= height) continue;
          for (let px = 0; px < tw; px++) {
            const x = cel.x + tx * tw + px;
            if (x < 0 || x >= width) continue;
            let sx = xf ? tw - 1 - px : px;
            let sy = yf ? th - 1 - py : py;
            if (df) [sx, sy] = [sy, sx];
            if (sx >= tw || sy >= th) continue;
            const s = ((id * th + sy) * tw + sx) * 4;
            blend(dst, (y * width + x) * 4, rgba.pixels[s]!, rgba.pixels[s + 1]!, rgba.pixels[s + 2]!, rgba.pixels[s + 3]!, opacity);
          }
        }
      }
    }
  };

  const drawLayers = (dst: Uint8Array, parent: number, frame: number): void => {
    const list = (children.get(parent) ?? []).map((layer, pos) => {
      const z = celAt(layer.index, frame)?.zIndex ?? 0;
      return { layer, order: pos + z, z };
    });
    list.sort((a, b) => a.order - b.order || a.z - b.z);
    for (const { layer } of list) {
      if (!layer.visible || layer.reference || ignored(layer)) continue;
      if (layer.blendMode !== 0 && !warnedBlend.has(layer.index)) {
        warnedBlend.add(layer.index);
        warnings.push(`camada "${layer.name}": modo de mistura diferente de Normal, desenhada como Normal`);
      }
      if (layer.type === 1) {
        if (file.flags & 2) {
          const group = new Uint8Array(width * height * 4);
          drawLayers(group, layer.index, frame);
          for (let i = 0; i < group.length; i += 4) {
            blend(dst, i, group[i]!, group[i + 1]!, group[i + 2]!, group[i + 3]!, layer.opacity);
          }
        } else {
          drawLayers(dst, layer.index, frame);
        }
        continue;
      }
      const cel = celAt(layer.index, frame);
      if (!cel || cel.kind === 'linked') continue;
      const opacity = mul(cel.opacity, layer.opacity);
      if (cel.kind === 'tilemap') {
        drawTilemap(dst, layer, cel, opacity);
        continue;
      }
      for (let cy = 0; cy < cel.height; cy++) {
        const y = cel.y + cy;
        if (y < 0 || y >= height) continue;
        for (let cx = 0; cx < cel.width; cx++) {
          const x = cel.x + cx;
          if (x < 0 || x >= width) continue;
          color(cel.data, cy * cel.width + cx, layer.background);
          blend(dst, (y * width + x) * 4, out[0]!, out[1]!, out[2]!, out[3]!, opacity);
        }
      }
    }
  };

  const frames = file.frames.map((_, f) => {
    const dst = new Uint8Array(width * height * 4);
    drawLayers(dst, -1, f);
    return dst;
  });

  // Pontos: camadas "@nome" (podem estar escondidas no Aseprite).
  const points: Record<string, (Point | null)[]> = {};
  for (const layer of file.layers) {
    if (!layer.name.startsWith('@') || layer.type !== 0) continue;
    const name = layer.name.slice(1);
    if (!name) {
      warnings.push('camada "@" sem nome: o ponto precisa de um nome, como "@pe"');
      continue;
    }
    if (points[name]) {
      warnings.push(`ponto "${name}" aparece em mais de uma camada: valeu a primeira`);
      continue;
    }
    points[name] = file.frames.map((_, f) => {
      const cel = celAt(layer.index, f);
      if (!cel || cel.kind !== 'image') return null;
      const found: Point[] = [];
      for (let p = 0; p < cel.width * cel.height; p++) {
        color(cel.data, p, false);
        if (out[3]) found.push({ x: cel.x + (p % cel.width), y: cel.y + Math.floor(p / cel.width) });
      }
      if (found.length > 1) {
        warnings.push(`ponto "${name}" tem ${found.length} pixels pintados no quadro ${f + 1}: valeu o primeiro (de cima, da esquerda)`);
      }
      return found[0] ?? null;
    });
  }

  const tags: Record<string, ComposedTag> = {};
  for (const tag of file.tags) {
    if (tags[tag.name]) {
      warnings.push(`tag "${tag.name}" repetida: valeu a primeira`);
      continue;
    }
    if (tag.to >= file.frames.length || tag.from > tag.to) {
      warnings.push(`tag "${tag.name}" aponta para quadros que não existem`);
      continue;
    }
    tags[tag.name] = { from: tag.from, to: tag.to, direction: DIRECTIONS[tag.direction] ?? 'forward', repeat: tag.repeat };
  }

  const slices: Record<string, SliceKey[]> = {};
  for (const slice of file.slices) slices[slice.name] = slice.keys;

  return {
    width, height, frames, tags, points, slices, tilesets, warnings,
    durations: file.frames.map((f) => f.duration),
  };
}
