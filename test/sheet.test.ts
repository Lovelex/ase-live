import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildSprite, packFrames } from '../src/sheet.js';

const zlib = {
  inflate: (d: Uint8Array) => new Uint8Array(inflateSync(d)),
  deflate: (d: Uint8Array) => new Uint8Array(deflateSync(d)),
};

/** Lê de volta um PNG gravado por png.ts (RGBA, sem filtro). */
function decodePng(png: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (pos < png.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
    }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (width * 4 + 1)]).toBe(0);
    rgba.set(raw.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1)), y * width * 4);
  }
  return { width, height, rgba };
}

describe('packFrames', () => {
  it('quadros iguais ocupam um lugar só', () => {
    const a = new Uint8Array(4 * 4).fill(1);
    const b = new Uint8Array(4 * 4).fill(2);
    const sheet = packFrames(2, 2, [a, b, a, a]);
    expect(sheet.frames.map((f) => [f.x, f.y])).toEqual([[0, 0], [2, 0], [0, 0], [0, 0]]);
    expect([sheet.width, sheet.height]).toEqual([4, 2]);
  });
  it('grade quase quadrada', () => {
    const frames = Array.from({ length: 5 }, (_, i) => new Uint8Array(4).fill(i));
    const sheet = packFrames(1, 1, frames);
    expect([sheet.width, sheet.height]).toEqual([3, 2]);
  });
});

describe('buildSprite', () => {
  const bytes = readFileSync(join(import.meta.dirname, 'fixtures', 'rgba.aseprite'));
  const built = buildSprite('herois/ninja', bytes, zlib);

  it('quadros apontam para a imagem certa', () => {
    const sheet = decodePng(built.sheet);
    built.sprite.frames.forEach((f, i) => {
      const ref = readFileSync(join(import.meta.dirname, 'fixtures', `rgba.${i}.rgba`));
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const s = ((f.y + y) * sheet.width + f.x + x) * 4;
          const r = (y * f.w + x) * 4;
          if (ref[r + 3] === 0) expect(sheet.rgba[s + 3]).toBe(0);
          else expect(Array.from(sheet.rgba.subarray(s, s + 4))).toEqual(Array.from(ref.subarray(r, r + 4)));
        }
      }
    });
  });

  it('dados do sprite', () => {
    expect(built.sprite).toMatchObject({ name: 'herois/ninja', width: 8, height: 6 });
    expect(built.sprite.frames.map((f) => f.duration)).toEqual([100, 150, 200, 250]);
  });

  it('tileset vira PNG de uma coluna', () => {
    const tiles = buildSprite('t', readFileSync(join(import.meta.dirname, 'fixtures', 'tiles.aseprite')), zlib);
    const png = decodePng(tiles.tilesets[0]!);
    expect([png.width, png.height]).toEqual([4, 12]);
  });
});
