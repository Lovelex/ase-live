# ase-live

Salvou no Aseprite, o jogo atualiza. Plugin do Vite que lê os arquivos
`.aseprite`/`.ase` direto (sem exportar PNG nem JSON) e entrega ao jogo
imagens, animações, pontos e tilesets.

## Em um jogo novo

```bash
npm install -D ../ase-live      # (ou o caminho/URL do repositório)
```

```js
// vite.config.js
import { defineConfig } from 'vite';
import aseLive from 'ase-live';

export default defineConfig({ plugins: [aseLive()] });
```

Pronto: tudo o que estiver em `art/` (na raiz do projeto, com subpastas)
aparece no jogo.

```ts
import { sprites, watchSprites } from 'ase-live/sprites';
import { frameAt } from 'ase-live/anim';

const ninja = sprites['herois/ninja'];        // art/herois/ninja.aseprite
const { frame } = frameAt(ninja, 'run', ms);  // quadro da tag "run" depois de ms
const f = ninja.frames[frame];                // { x, y, w, h, duration } dentro de ninja.image
ctx.drawImage(img, f.x, f.y, f.w, f.h, px, py, f.w, f.h);

// refaz as texturas quando um arquivo muda (no `vite dev`; no build roda uma vez)
watchSprites((all) => recriarTexturas(all));
```

`sprites` é sempre o mesmo objeto: quem lê `sprites.ninja` a cada quadro já
vê a versão nova sem fazer nada. As imagens (`image`) são URLs; para usar,
carregue com `new Image()`, `fetch` ou o carregador da engine.

## A convenção (tudo vem do arquivo do Aseprite)

| No Aseprite | No jogo |
|---|---|
| `art/herois/ninja.aseprite` | `sprites['herois/ninja']` |
| tags da linha do tempo | `tags` (animações: quadros, direção, repetições) |
| duração de cada quadro | `frames[i].duration` (ms) |
| camada `@pe`, `@mao`… com **1 pixel** pintado por quadro | `points.pe[i]` = `{ x, y }` (null no quadro sem pixel) |
| camada ou grupo começando com `_` | não vai para o jogo (rascunho, guias) |
| camada escondida (olho fechado) ou de referência | não vai para o jogo |
| camada de tilemap | desenhada no quadro; o tileset vira `tilesets[i].image` (peças uma embaixo da outra) |
| slices | `slices` (caixas de colisão, nove-partes, pivô) |

As camadas `@` podem ficar escondidas no Aseprite: os pontos são lidos do
mesmo jeito. Use nomes sem acento (`@pe`, não `@pé`) para escrever fácil no código.

O desenho de cada quadro é o mesmo do Aseprite (a mesma conta de mistura de
cores, conferida pixel a pixel nos testes). Modos de mistura diferentes de
Normal são desenhados como Normal, com aviso.

## Quando algo dá errado

- Arquivo que não abre (corrompido, salvo pela metade): os outros continuam
  funcionando; o erro aparece na tela do jogo e no terminal do Vite.
- Avisos (ponto com mais de um pixel, tag repetida, modo de mistura): no
  terminal, no console do navegador e em `warnings`.

## Sem precisar do Aseprite instalado

O plugin lê o formato do arquivo sozinho: o build e quem só joga não precisam
do Aseprite. Só quem desenha precisa dele.

## Desenvolvimento

```bash
npm install
npm run check        # tipos + lint + testes
npm run example      # exemplo em http://localhost:5199 (edite example/art/ no Aseprite)
npm run fixtures     # regera os arquivos de teste (precisa do aseprite no PATH)
```

Os testes comparam o desenho com o do próprio Aseprite: `tools/fixtures.lua`
cria os arquivos de teste e `tools/references.lua` exporta como o Aseprite
desenha cada quadro.
