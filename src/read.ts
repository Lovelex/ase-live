// Leitor do formato .aseprite/.ase (especificação oficial: docs/ase-file-specs.md
// no código do Aseprite). Só transforma bytes em dados; desenhar é com compose.ts.
// O zlib vem de fora (`inflate`), para o leitor rodar no Node ou no navegador.

export type Inflate = (data: Uint8Array) => Uint8Array;

export type ColorDepth = 32 | 16 | 8; // RGBA | tons de cinza | indexado

export interface AseLayer {
  index: number;
  name: string;
  /** 0 = imagem, 1 = grupo, 2 = tilemap */
  type: number;
  childLevel: number;
  /** índice do grupo-pai na lista de camadas, -1 = raiz */
  parent: number;
  visible: boolean;
  background: boolean;
  reference: boolean;
  blendMode: number;
  opacity: number;
  tileset: number;
}

export interface AseImageCel {
  kind: 'image';
  layer: number;
  frame: number;
  x: number;
  y: number;
  opacity: number;
  zIndex: number;
  width: number;
  height: number;
  /** pixels no formato do arquivo (4, 2 ou 1 byte por pixel) */
  data: Uint8Array;
}

export interface AseTilemapCel {
  kind: 'tilemap';
  layer: number;
  frame: number;
  x: number;
  y: number;
  opacity: number;
  zIndex: number;
  /** em peças */
  width: number;
  height: number;
  tiles: Uint32Array;
  idMask: number;
  xFlip: number;
  yFlip: number;
  dFlip: number;
}

export interface AseLinkedCel {
  kind: 'linked';
  layer: number;
  frame: number;
  x: number;
  y: number;
  opacity: number;
  zIndex: number;
  linkedFrame: number;
}

export type AseCel = AseImageCel | AseTilemapCel | AseLinkedCel;

export interface AseTag {
  name: string;
  from: number;
  to: number;
  /** 0 frente, 1 ao contrário, 2 vai e volta, 3 volta e vai */
  direction: number;
  repeat: number;
}

export interface AseTileset {
  id: number;
  name: string;
  count: number;
  tileWidth: number;
  tileHeight: number;
  /** peça 0 vazia (formato novo); senão a vazia é 0xffffffff */
  zeroIsEmpty: boolean;
  /** tileWidth × (tileHeight × count), no formato de pixel do arquivo; null = arquivo externo */
  data: Uint8Array | null;
}

export interface AseSlice {
  name: string;
  keys: { frame: number; x: number; y: number; width: number; height: number; pivot: { x: number; y: number } | null }[];
}

export interface AseFile {
  width: number;
  height: number;
  depth: ColorDepth;
  /** header: 1 = opacidade das camadas vale, 2 = grupos se compõem separados */
  flags: number;
  transparentIndex: number;
  frames: { duration: number }[];
  layers: AseLayer[];
  /** cels[frame] = cels desse quadro */
  cels: AseCel[][];
  tags: AseTag[];
  /** RGBA, 4 bytes por cor */
  palette: Uint8Array;
  tilesets: AseTileset[];
  slices: AseSlice[];
}

export class AseError extends Error {}

class Reader {
  pos = 0;
  private view: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  need(n: number): void {
    if (this.pos + n > this.bytes.length) throw new AseError('arquivo cortado (acabou antes do esperado)');
  }
  byte(): number { this.need(1); return this.view.getUint8(this.pos++); }
  word(): number { this.need(2); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  short(): number { this.need(2); const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  dword(): number { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  long(): number { this.need(4); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  skip(n: number): void { this.need(n); this.pos += n; }
  slice(n: number): Uint8Array { this.need(n); const s = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return s; }
  string(): string { return new TextDecoder().decode(this.slice(this.word())); }
}

const FRAME_MAGIC = 0xf1fa;
// Limites para um arquivo estragado não pedir gigabytes de memória.
const MAX_PALETTE = 65536;
const MAX_SIDE = 16384;
const FILE_MAGIC = 0xa5e0;

export function readAse(bytes: Uint8Array, inflate: Inflate): AseFile {
  const r = new Reader(bytes);
  if (bytes.length < 128) throw new AseError('não é um arquivo do Aseprite (pequeno demais)');
  r.dword();
  if (r.word() !== FILE_MAGIC) throw new AseError('não é um arquivo do Aseprite (assinatura errada)');
  const frameCount = r.word();
  const width = r.word();
  const height = r.word();
  const depth = r.word();
  if (depth !== 32 && depth !== 16 && depth !== 8) throw new AseError(`modo de cor desconhecido (${depth} bits)`);
  if (width > MAX_SIDE || height > MAX_SIDE) throw new AseError(`imagem grande demais (${width}×${height})`);
  const flags = r.dword();
  const speed = r.word();
  r.skip(8);
  const transparentIndex = r.byte();
  r.skip(3);
  const colorCount = r.word() || 256;
  r.pos = 128;

  const file: AseFile = {
    width, height, depth, flags, transparentIndex,
    frames: [], layers: [], cels: [], tags: [], tilesets: [], slices: [],
    palette: new Uint8Array(colorCount * 4),
  };
  const pixelSize = depth / 8;
  let newPalette = false;
  const groupStack: number[] = [];

  for (let f = 0; f < frameCount; f++) {
    const start = r.pos;
    const size = r.dword();
    if (r.word() !== FRAME_MAGIC) throw new AseError(`quadro ${f + 1} corrompido`);
    const oldChunks = r.word();
    const duration = r.word();
    r.skip(2);
    const newChunks = r.dword();
    const chunks = newChunks || oldChunks;
    file.frames.push({ duration: duration || speed || 100 });
    const cels: AseCel[] = [];
    file.cels.push(cels);

    for (let c = 0; c < chunks; c++) {
      const chunkStart = r.pos;
      const chunkSize = r.dword();
      const type = r.word();
      if (chunkSize < 6) throw new AseError(`bloco de dados inválido no quadro ${f + 1}`);
      const end = chunkStart + chunkSize;
      r.need(chunkSize - 6);
      switch (type) {
        case 0x2004: readLayer(r, file, groupStack); break;
        case 0x2005: {
          const cel = readCel(r, f, end, pixelSize, inflate);
          if (cel) cels.push(cel);
          break;
        }
        case 0x2018: readTags(r, file); break;
        case 0x2019: readPalette(r, file); newPalette = true; break;
        case 0x0004: if (!newPalette) readOldPalette(r, file); break;
        case 0x2022: readSlice(r, file); break;
        case 0x2023: readTileset(r, file, pixelSize, inflate); break;
        default: break; // perfil de cor, dados de usuário, extras: não precisam para desenhar
      }
      r.pos = end;
    }
    r.pos = start + size;
  }
  return file;
}

function readLayer(r: Reader, file: AseFile, groupStack: number[]): void {
  const flags = r.word();
  const type = r.word();
  const childLevel = r.word();
  r.skip(4);
  const blendMode = r.word();
  const opacity = r.byte();
  r.skip(3);
  const name = r.string();
  const tileset = type === 2 ? r.dword() : -1;
  const index = file.layers.length;
  // Sem a flag "grupos compostos à parte", grupo não guarda opacidade nem mistura.
  const blendInfo = type !== 1 || (file.flags & 2) !== 0;
  groupStack.length = childLevel;
  const parent = childLevel > 0 ? groupStack[childLevel - 1] ?? -1 : -1;
  file.layers.push({
    index, name, type, childLevel, parent,
    visible: (flags & 1) !== 0,
    background: (flags & 8) !== 0,
    reference: (flags & 64) !== 0,
    blendMode: blendInfo ? blendMode : 0,
    opacity: blendInfo && (file.flags & 1) !== 0 ? opacity : 255,
    tileset,
  });
  groupStack[childLevel] = index;
}

function readCel(r: Reader, frame: number, end: number, pixelSize: number, inflate: Inflate): AseCel | null {
  const layer = r.word();
  const x = r.short();
  const y = r.short();
  const opacity = r.byte();
  const type = r.word();
  const zIndex = r.short();
  r.skip(5);
  const base = { layer, frame, x, y, opacity, zIndex };
  if (type === 1) return { kind: 'linked', ...base, linkedFrame: r.word() };
  if (type === 0 || type === 2) {
    const width = r.word();
    const height = r.word();
    const raw = r.slice(end - r.pos);
    const data = type === 2 ? unzip(raw, inflate) : raw;
    if (data.length < width * height * pixelSize) throw new AseError(`imagem incompleta na camada ${layer}, quadro ${frame + 1}`);
    return { kind: 'image', ...base, width, height, data };
  }
  if (type === 3) {
    const width = r.word();
    const height = r.word();
    const bits = r.word();
    const idMask = r.dword();
    const xFlip = r.dword();
    const yFlip = r.dword();
    const dFlip = r.dword();
    r.skip(10);
    const data = unzip(r.slice(end - r.pos), inflate);
    const size = bits / 8;
    if (size !== 1 && size !== 2 && size !== 4) throw new AseError(`peças de ${bits} bits não são suportadas`);
    if (data.length < width * height * size) throw new AseError(`tilemap incompleto na camada ${layer}, quadro ${frame + 1}`);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const tiles = new Uint32Array(width * height);
    for (let i = 0; i < tiles.length; i++) {
      tiles[i] = size === 4 ? view.getUint32(i * 4, true) : size === 2 ? view.getUint16(i * 2, true) : view.getUint8(i);
    }
    return { kind: 'tilemap', ...base, width, height, tiles, idMask, xFlip, yFlip, dFlip };
  }
  return null; // tipo novo de cel: ignora em vez de quebrar
}

function readTags(r: Reader, file: AseFile): void {
  const count = r.word();
  r.skip(8);
  for (let i = 0; i < count; i++) {
    const from = r.word();
    const to = r.word();
    const direction = r.byte();
    const repeat = r.word();
    r.skip(6 + 3 + 1);
    file.tags.push({ name: r.string(), from, to, direction, repeat });
  }
}

function readPalette(r: Reader, file: AseFile): void {
  const size = r.dword();
  const first = r.dword();
  const last = r.dword();
  r.skip(8);
  if (size > MAX_PALETTE) throw new AseError(`paleta grande demais (${size} cores)`);
  if (file.palette.length < size * 4) {
    const grown = new Uint8Array(size * 4);
    grown.set(file.palette);
    file.palette = grown;
  }
  for (let i = first; i <= last; i++) {
    const flags = r.word();
    const rgba = r.slice(4);
    if (i * 4 + 4 <= file.palette.length) file.palette.set(rgba, i * 4);
    if (flags & 1) r.string();
  }
}

function readOldPalette(r: Reader, file: AseFile): void {
  const packets = r.word();
  let index = 0;
  for (let p = 0; p < packets; p++) {
    index += r.byte();
    const count = r.byte() || 256;
    for (let i = 0; i < count; i++, index++) {
      const rgb = r.slice(3);
      if (index * 4 + 4 <= file.palette.length) {
        file.palette.set(rgb, index * 4);
        file.palette[index * 4 + 3] = 255;
      }
    }
  }
}

function readSlice(r: Reader, file: AseFile): void {
  const count = r.dword();
  const flags = r.dword();
  r.dword();
  const name = r.string();
  const keys: AseSlice['keys'] = [];
  for (let i = 0; i < count; i++) {
    const frame = r.dword();
    const x = r.long();
    const y = r.long();
    const width = r.dword();
    const height = r.dword();
    if (flags & 1) r.skip(16);
    const pivot = flags & 2 ? { x: r.long(), y: r.long() } : null;
    keys.push({ frame, x, y, width, height, pivot });
  }
  file.slices.push({ name, keys });
}

function readTileset(r: Reader, file: AseFile, pixelSize: number, inflate: Inflate): void {
  const id = r.dword();
  const flags = r.dword();
  const count = r.dword();
  const tileWidth = r.word();
  const tileHeight = r.word();
  r.short();
  r.skip(14);
  const name = r.string();
  if (flags & 1) r.skip(8);
  let data: Uint8Array | null = null;
  if (flags & 2) {
    data = unzip(r.slice(r.dword()), inflate);
    if (data.length < tileWidth * tileHeight * count * pixelSize) throw new AseError(`tileset "${name}" incompleto`);
  }
  file.tilesets.push({ id, name, count, tileWidth, tileHeight, zeroIsEmpty: (flags & 4) !== 0, data });
}

function unzip(data: Uint8Array, inflate: Inflate): Uint8Array {
  try {
    return inflate(data);
  } catch {
    throw new AseError('imagem compactada corrompida');
  }
}
