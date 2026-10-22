// Liga a flag "grupos compostos à parte" em test/fixtures/groups.aseprite e
// grava a opacidade 128 no grupo. O Aseprite só grava essa flag com a janela
// aberta (no modo de linha de comando, não), então o arquivo de teste é
// ajustado aqui, entre tools/fixtures.lua e tools/references.lua.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../test/fixtures/groups.aseprite', import.meta.url);
const bytes = readFileSync(file);
bytes.writeUInt32LE(bytes.readUInt32LE(14) | 2, 14);

let pos = 128 + 16; // primeiro bloco do primeiro quadro
let found = false;
while (pos < bytes.length && !found) {
  const size = bytes.readUInt32LE(pos);
  const type = bytes.readUInt16LE(pos + 4);
  if (type === 0x2004 && bytes.readUInt16LE(pos + 8) === 1) {
    bytes.writeUInt8(128, pos + 6 + 12); // opacidade da camada de grupo
    found = true;
  }
  pos += size;
}
if (!found) throw new Error('grupo não encontrado em groups.aseprite');
writeFileSync(file, bytes);
