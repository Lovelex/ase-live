// O que o jogo importa: `import { sprites } from 'ase-live/sprites'`.
// Com o plugin no vite.config, este módulo é trocado pelos arquivos de art/.
// Sem o plugin, este arquivo de verdade é o que carrega, e avisa.

import type { Sprite } from './types.js';

export type { AnimDirection, Frame, Point, SliceKey, Sprite, Tag, Tileset } from './types.js';

/** Todos os arquivos de art/, pelo nome (caminho sem extensão: "herois/ninja"). */
export const sprites: Record<string, Sprite> = {};

/** Problemas encontrados nos arquivos (os mesmos de cada `Sprite.warnings`, com o nome do arquivo). */
export const warnings: string[] = [
  'ase-live: o plugin não está no vite.config (adicione aseLive() em plugins)',
];

/** Chama `fn` agora e de novo sempre que um arquivo de art/ mudar (só no `vite dev`). */
export function watchSprites(fn: (all: Record<string, Sprite>) => void): void {
  fn(sprites);
}
