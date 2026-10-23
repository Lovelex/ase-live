import { describe, expect, it } from 'vitest';
import { describeEntry, galleryEntries, isPieceSheet, pieceGroups } from '../src/gallery.js';
import type { Sprite } from '../src/types.js';

const sprite = (tags: Sprite['tags'], durations = [100, 100, 200]): Sprite => ({
  name: 's', width: 2, height: 2, image: '',
  frames: durations.map((duration) => ({ x: 0, y: 0, w: 2, h: 2, duration })),
  tags, points: {}, slices: {}, tilesets: [], warnings: [],
});

describe('galleryEntries', () => {
  it('uma entrada por tag, com os quadros dela', () => {
    const e = galleryEntries(sprite({ a: { from: 0, to: 1, direction: 'forward', repeat: 0 }, b: { from: 2, to: 2, direction: 'forward', repeat: 0 } }));
    expect(e.map((x) => [x.name, x.frames])).toEqual([['a', [0, 1]], ['b', [2]]]);
  });
  it('sem tags: o arquivo inteiro', () => {
    const [e] = galleryEntries(sprite({}));
    expect(e).toMatchObject({ tag: null, frames: [0, 1, 2], durations: [100, 100, 200] });
  });
});

describe('describeEntry', () => {
  const entry = (tag: Sprite['tags'][string]) => galleryEntries(sprite({ t: tag }))[0]!;
  it('textos curtos, com os quadros numerados como no Aseprite', () => {
    expect(describeEntry(entry({ from: 2, to: 2, direction: 'forward', repeat: 0 }))).toBe('quadro 3');
    expect(describeEntry(entry({ from: 0, to: 1, direction: 'forward', repeat: 0 }))).toBe('quadros 1 a 2, 100 ms');
    expect(describeEntry(entry({ from: 0, to: 2, direction: 'pingpong', repeat: 2 }))).toBe('quadros 1 a 3, 100 a 200 ms, vai e volta, toca 2x');
  });
});

describe('peças', () => {
  it('arquivo de peças pelo nome', () => {
    expect(isPieceSheet({ name: 'bambuzal-tiles' })).toBe(true);
    expect(isPieceSheet({ name: 'tiles/floresta' })).toBe(true);
    expect(isPieceSheet({ name: 'mundo/tiles/agua' })).toBe(true);
    expect(isPieceSheet({ name: 'ninja' })).toBe(false);
    expect(isPieceSheet({ name: 'tilesheet' })).toBe(false);
  });
  it('agrupa pelos pontos do nome, na ordem do arquivo', () => {
    const t = { direction: 'forward', repeat: 0 } as const;
    const e = galleryEntries(sprite({
      'terra.miolo': { from: 0, to: 2, ...t },
      'terra.borda.c': { from: 0, to: 1, ...t },
      'terra.borda.c-be': { from: 1, to: 1, ...t },
      'pedra.quina.c-e': { from: 2, to: 2, ...t },
      solto: { from: 0, to: 0, ...t },
    }));
    expect(pieceGroups(e).map((g) => [g.path.join('>'), g.entries.map((x) => x.label)])).toEqual([
      ['terra', ['miolo']],
      ['terra>borda', ['c', 'c-be']],
      ['pedra>quina', ['c-e']],
      ['', ['solto']],
    ]);
  });
});
