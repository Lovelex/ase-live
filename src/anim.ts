// Ajudante de animação para o jogo: qual quadro mostrar depois de `ms`
// milissegundos tocando uma tag, respeitando a duração de cada quadro, a
// direção e as repetições definidas no Aseprite.

import type { Sprite, Tag } from './types.js';

/** Sequência de quadros de uma passada completa da tag (com as repetições). */
export function tagSequence(tag: Tag): number[] {
  const forward: number[] = [];
  for (let f = tag.from; f <= tag.to; f++) forward.push(f);
  const backward = [...forward].reverse();
  const pingpong = tag.direction === 'pingpong' || tag.direction === 'pingpong-reverse';
  const first = tag.direction === 'reverse' || tag.direction === 'pingpong-reverse' ? backward : forward;
  if (tag.repeat === 0) {
    // repetindo sempre: o vai e volta é ida + volta sem repetir as pontas (a b c b | a b c b …)
    return pingpong ? [...first, ...first.slice(1, -1).reverse()] : first;
  }
  const seq: number[] = [];
  for (let i = 0; i < tag.repeat; i++) {
    const pass = pingpong && i % 2 === 1 ? [...first].reverse() : first;
    // na virada do vai e volta, o quadro da ponta não toca duas vezes
    seq.push(...(pingpong && i > 0 ? pass.slice(1) : pass));
  }
  return seq;
}

export interface Playback {
  /** índice em `sprite.frames` */
  frame: number;
  /** a tag tem fim (repeat > 0) e já acabou: fica no último quadro */
  done: boolean;
}

/**
 * Quadro da tag `tagName` depois de `ms` milissegundos tocando.
 * Sem a tag, toca o arquivo inteiro como "para frente, sempre".
 */
export function frameAt(sprite: Sprite, tagName: string | null, ms: number): Playback {
  const tag: Tag = (tagName !== null ? sprite.tags[tagName] : undefined)
    ?? { from: 0, to: sprite.frames.length - 1, direction: 'forward', repeat: 0 };
  const seq = tagSequence(tag);
  const total = seq.reduce((sum, f) => sum + sprite.frames[f]!.duration, 0);
  if (total <= 0) return { frame: seq[0]!, done: false };
  if (tag.repeat > 0 && ms >= total) return { frame: seq[seq.length - 1]!, done: true };
  let t = ((ms % total) + total) % total;
  for (const f of seq) {
    const d = sprite.frames[f]!.duration;
    if (t < d) return { frame: f, done: false };
    t -= d;
  }
  return { frame: seq[seq.length - 1]!, done: false };
}
