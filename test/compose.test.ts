import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compose } from '../src/compose.js';
import { AseError, readAse } from '../src/read.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const inflate = (d: Uint8Array) => new Uint8Array(inflateSync(d));
const open = (name: string) => compose(readAse(readFileSync(join(FIXTURES, `${name}.aseprite`)), inflate));

// Pixel transparente: a cor não importa (o Aseprite guarda lixo, nós zeramos).
function normalized(rgba: Uint8Array): number[] {
  const out = Array.from(rgba);
  for (let i = 0; i < out.length; i += 4) if (out[i + 3] === 0) out[i] = out[i + 1] = out[i + 2] = 0;
  return out;
}

describe('desenho igual ao do Aseprite', () => {
  const references = readdirSync(FIXTURES).filter((f) => f.endsWith('.rgba'));
  it('há referências (npm run fixtures)', () => expect(references.length).toBeGreaterThan(0));
  for (const ref of references) {
    const [name, frame] = ref.split('.');
    it(`${name}, quadro ${frame}`, () => {
      const composed = open(name!);
      expect(normalized(composed.frames[Number(frame)]!)).toEqual(normalized(readFileSync(join(FIXTURES, ref))));
    });
  }
});

describe('rgba.aseprite', () => {
  const s = open('rgba');

  it('durações dos quadros', () => expect(s.durations).toEqual([100, 150, 200, 250]));

  it('tags viram animações', () => {
    expect(s.tags).toEqual({
      idle: { from: 0, to: 1, direction: 'forward', repeat: 0 },
      run: { from: 2, to: 3, direction: 'pingpong', repeat: 2 },
    });
  });

  it('camada @pe vira ponto por quadro', () => {
    expect(s.points).toEqual({ pe: [{ x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, null] });
  });

  it('_rascunho, @pe e camada escondida não aparecem', () => {
    const verde = s.frames[0]!.some((_, i, a) => i % 4 === 0 && a[i] === 0 && a[i + 1] === 255);
    const magenta = s.frames[0]!.some((_, i, a) => i % 4 === 0 && a[i] === 255 && a[i + 1] === 0 && a[i + 2] === 255);
    expect(verde).toBe(false);
    expect(magenta).toBe(false);
  });

  it('sem avisos', () => expect(s.warnings).toEqual([]));
});

describe('tiles.aseprite', () => {
  const s = open('tiles');
  it('tileset em RGBA, peça vazia + 2 peças', () => {
    expect(s.tilesets).toHaveLength(1);
    expect(s.tilesets[0]).toMatchObject({ name: 'rocha', tileWidth: 4, tileHeight: 4, count: 3 });
    const px = (tile: number, x: number, y: number) => Array.from(s.tilesets[0]!.pixels.subarray(((tile * 4 + y) * 4 + x) * 4, ((tile * 4 + y) * 4 + x) * 4 + 4));
    expect(px(0, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(px(1, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(2, 3, 3)).toEqual([0, 180, 0, 255]);
  });
});

describe('arquivo inválido', () => {
  it('não é .aseprite', () => {
    expect(() => readAse(new Uint8Array(200), inflate)).toThrow(AseError);
  });
  it('cortado no meio', () => {
    const bytes = readFileSync(join(FIXTURES, 'rgba.aseprite'));
    expect(() => readAse(bytes.subarray(0, bytes.length - 40), inflate)).toThrow(AseError);
  });
});
