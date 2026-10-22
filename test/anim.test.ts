import { describe, expect, it } from 'vitest';
import { frameAt, tagSequence } from '../src/anim.js';
import type { Sprite, Tag } from '../src/types.js';

const tag = (direction: Tag['direction'], repeat = 0, from = 0, to = 2): Tag => ({ from, to, direction, repeat });

describe('tagSequence', () => {
  it('para frente e ao contrário', () => {
    expect(tagSequence(tag('forward'))).toEqual([0, 1, 2]);
    expect(tagSequence(tag('reverse'))).toEqual([2, 1, 0]);
    expect(tagSequence(tag('forward', 2))).toEqual([0, 1, 2, 0, 1, 2]);
  });
  it('vai e volta sem repetir as pontas', () => {
    expect(tagSequence(tag('pingpong'))).toEqual([0, 1, 2, 1]);
    expect(tagSequence(tag('pingpong-reverse'))).toEqual([2, 1, 0, 1]);
    expect(tagSequence(tag('pingpong', 1))).toEqual([0, 1, 2]);
    expect(tagSequence(tag('pingpong', 2))).toEqual([0, 1, 2, 1, 0]);
    expect(tagSequence(tag('pingpong', 3))).toEqual([0, 1, 2, 1, 0, 1, 2]);
    expect(tagSequence(tag('pingpong', 0, 0, 1))).toEqual([0, 1]);
    expect(tagSequence(tag('pingpong', 0, 4, 4))).toEqual([4]);
  });
});

describe('frameAt', () => {
  const sprite = {
    frames: [100, 200, 300].map((duration) => ({ x: 0, y: 0, w: 1, h: 1, duration })),
    tags: { walk: tag('forward'), once: tag('forward', 1) },
  } as unknown as Sprite;

  it('segue a duração de cada quadro e repete', () => {
    expect(frameAt(sprite, 'walk', 0).frame).toBe(0);
    expect(frameAt(sprite, 'walk', 99).frame).toBe(0);
    expect(frameAt(sprite, 'walk', 100).frame).toBe(1);
    expect(frameAt(sprite, 'walk', 300).frame).toBe(2);
    expect(frameAt(sprite, 'walk', 600).frame).toBe(0);
  });
  it('tag com fim para no último quadro', () => {
    expect(frameAt(sprite, 'once', 599)).toEqual({ frame: 2, done: false });
    expect(frameAt(sprite, 'once', 600)).toEqual({ frame: 2, done: true });
  });
  it('tag que não existe toca o arquivo todo', () => {
    expect(frameAt(sprite, 'nada', 350).frame).toBe(2);
    expect(frameAt(sprite, null, 150).frame).toBe(1);
  });
});
