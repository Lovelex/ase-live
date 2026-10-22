import { describe, expect, it } from 'vitest';
import { describeEntry, galleryEntries } from '../src/gallery.js';
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
  it('textos curtos', () => {
    expect(describeEntry(entry({ from: 2, to: 2, direction: 'forward', repeat: 0 }))).toBe('1 quadro');
    expect(describeEntry(entry({ from: 0, to: 1, direction: 'forward', repeat: 0 }))).toBe('2 quadros, 100 ms');
    expect(describeEntry(entry({ from: 0, to: 2, direction: 'pingpong', repeat: 2 }))).toBe('3 quadros, 100 a 200 ms, vai e volta, toca 2x');
  });
});
