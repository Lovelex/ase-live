// Junta os quadros desenhados numa imagem só (grade quase quadrada; quadros
// iguais, como os de cel ligado, ocupam um lugar só) e monta o Sprite.

import { compose } from './compose.js';
import { encodePng, type Deflate } from './png.js';
import { readAse, type Inflate } from './read.js';
import type { Frame, Sprite } from './types.js';

export interface SheetLayout {
  width: number;
  height: number;
  pixels: Uint8Array;
  frames: Omit<Frame, 'duration'>[];
}

export function packFrames(frameW: number, frameH: number, frames: Uint8Array[]): SheetLayout {
  const unique: Uint8Array[] = [];
  const slotOf = new Map<string, number>();
  const slots = frames.map((pixels) => {
    const key = hashKey(pixels);
    let slot = slotOf.get(key);
    if (slot === undefined || !same(unique[slot]!, pixels)) {
      slot = unique.length;
      unique.push(pixels);
      slotOf.set(key, slot);
    }
    return slot;
  });
  const columns = Math.max(1, Math.ceil(Math.sqrt(unique.length)));
  const rows = Math.max(1, Math.ceil(unique.length / columns));
  const width = columns * frameW;
  const height = rows * frameH;
  const pixels = new Uint8Array(width * height * 4);
  unique.forEach((frame, slot) => {
    const ox = (slot % columns) * frameW;
    const oy = Math.floor(slot / columns) * frameH;
    for (let y = 0; y < frameH; y++) {
      pixels.set(frame.subarray(y * frameW * 4, (y + 1) * frameW * 4), ((oy + y) * width + ox) * 4);
    }
  });
  return {
    width, height, pixels,
    frames: slots.map((slot) => ({ x: (slot % columns) * frameW, y: Math.floor(slot / columns) * frameH, w: frameW, h: frameH })),
  };
}

function hashKey(bytes: Uint8Array): string {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 16777619);
  return `${bytes.length}:${h >>> 0}`;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export interface BuiltSprite {
  /** Sprite com `image` e `tilesets[].image` ainda vazios: quem chama decide a URL */
  sprite: Sprite;
  sheet: Uint8Array;
  tilesets: Uint8Array[];
}

export function buildSprite(name: string, bytes: Uint8Array, zlib: { inflate: Inflate; deflate: Deflate }): BuiltSprite {
  const composed = compose(readAse(bytes, zlib.inflate));
  const layout = packFrames(composed.width, composed.height, composed.frames);
  return {
    sprite: {
      name,
      width: composed.width,
      height: composed.height,
      image: '',
      frames: layout.frames.map((f, i) => ({ ...f, duration: composed.durations[i]! })),
      tags: composed.tags,
      points: composed.points,
      slices: composed.slices,
      tilesets: composed.tilesets.map((t) => ({ name: t.name, tileWidth: t.tileWidth, tileHeight: t.tileHeight, count: t.count, image: '' })),
      warnings: composed.warnings,
    },
    sheet: encodePng(layout.width, layout.height, layout.pixels, zlib.deflate),
    tilesets: composed.tilesets.map((t) => encodePng(t.tileWidth, t.tileHeight * t.count, t.pixels, zlib.deflate)),
  };
}
