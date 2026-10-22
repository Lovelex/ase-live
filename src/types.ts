// Formato que o jogo recebe de `import { sprites } from 'ase-live/sprites'`.

export interface Point {
  x: number;
  y: number;
}

export type AnimDirection = 'forward' | 'reverse' | 'pingpong' | 'pingpong-reverse';

export interface Frame {
  /** retângulo do quadro dentro da imagem (`Sprite.image`) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** em milissegundos, como no Aseprite */
  duration: number;
}

export interface Tag {
  /** quadros de `from` a `to`, inclusive (índices de `Sprite.frames`) */
  from: number;
  to: number;
  direction: AnimDirection;
  /** 0 = repete sempre; n = toca n vezes */
  repeat: number;
}

export interface SliceKey {
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pivot: Point | null;
}

export interface Tileset {
  name: string;
  tileWidth: number;
  tileHeight: number;
  count: number;
  /** URL de um PNG com as peças uma embaixo da outra (peça n em y = n × tileHeight) */
  image: string;
}

export interface Sprite {
  /** caminho dentro de art/ sem a extensão: art/herois/ninja.aseprite → "herois/ninja" */
  name: string;
  /** tamanho da tela do Aseprite (todo quadro tem esse tamanho) */
  width: number;
  height: number;
  /** URL do PNG com todos os quadros */
  image: string;
  frames: Frame[];
  /** tags da linha do tempo = animações */
  tags: Record<string, Tag>;
  /** camadas "@nome": posição do pixel pintado em cada quadro (null = sem pixel nesse quadro) */
  points: Record<string, (Point | null)[]>;
  /** slices do Aseprite (caixas de colisão, nove-partes etc.) */
  slices: Record<string, SliceKey[]>;
  tilesets: Tileset[];
  /** problemas encontrados no arquivo (também aparecem no terminal e na tela do jogo) */
  warnings: string[];
}
