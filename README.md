# ase-live

Arquivos do Aseprite direto no jogo. Você salva no Aseprite e o jogo aberto no navegador mostra a mudança na hora, sem exportar PNG, sem arquivo de configuração e sem recarregar a página.

É um plugin do [Vite](https://vite.dev) para jogos 2D de navegador. Funciona com qualquer engine (Phaser, PixiJS, Kaplay, canvas puro), porque entrega dados simples: a imagem, os quadros, as animações e os pontos de cada arquivo.

---

## Sumário

1. [Para que serve](#para-que-serve)
2. [Instalação](#instalação)
3. [Usando no jogo](#usando-no-jogo)
4. [Galeria](#galeria)
5. [Como organizar o arquivo no Aseprite](#como-organizar-o-arquivo-no-aseprite)
6. [Referência](#referência)
7. [Erros e avisos](#erros-e-avisos)
8. [Limitações](#limitações)
9. [Desenvolvimento do pacote](#desenvolvimento-do-pacote)
10. [Licença](#licença)

---

## Para que serve

O caminho comum para levar pixel art do Aseprite para um jogo é:

1. desenhar;
2. exportar a folha de sprites em PNG;
3. exportar um JSON com os quadros e as animações;
4. copiar tudo para a pasta do jogo;
5. recarregar o jogo.

Isso a cada ajuste. Com o ase-live, o caminho vira:

1. desenhar;
2. salvar.

O plugin lê o arquivo `.aseprite` sozinho e desenha cada quadro com a mesma conta de mistura de cores do Aseprite, conferida pixel a pixel nos testes do pacote. O jogo publicado e quem só joga **não precisam do Aseprite instalado**. Só quem desenha precisa.

---

## Instalação

### Requisitos

- Node.js 20 ou mais novo
- Vite 6 ou mais novo
- Aseprite (só para desenhar; também abre arquivos do LibreSprite)

### 1. Instale o pacote

```bash
npm install -D github:Lovelex/ase-live
```

O npm baixa o código e compila na hora da instalação.

### 2. Ligue o plugin no Vite

```js
// vite.config.js
import { defineConfig } from 'vite';
import aseLive from 'ase-live';

export default defineConfig({
  plugins: [aseLive()],
});
```

### 3. Crie a pasta `art/`

Na raiz do projeto, ao lado do `vite.config.js`. Todo arquivo `.aseprite` ou `.ase` dentro dela (inclusive em subpastas) passa a existir no jogo.

```
meu-jogo/
  art/
    heroi.aseprite
    inimigos/
      slime.aseprite
  src/
  vite.config.js
```

Pronto. Não há mais nada para configurar: os tipos do TypeScript já vêm com o pacote.

---

## Usando no jogo

### Importando

```ts
import { sprites } from 'ase-live/sprites';

const heroi = sprites['heroi'];           // art/heroi.aseprite
const slime = sprites['inimigos/slime'];  // art/inimigos/slime.aseprite
```

O nome é o caminho dentro de `art/`, sem a extensão e sempre com `/`.

### Desenhando um quadro

Cada sprite tem **uma imagem só** com todos os quadros (`image`, uma URL) e a lista de quadros (`frames`), com o retângulo de cada um dentro dessa imagem.

```ts
const img = new Image();
img.src = heroi.image;
await img.decode();

const f = heroi.frames[0];
ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
```

### Tocando uma animação

As tags da linha do tempo do Aseprite viram animações. A função `frameAt` diz qual quadro mostrar depois de um tempo tocando, respeitando a duração de cada quadro, a direção e as repetições definidas no Aseprite.

```ts
import { frameAt } from 'ase-live/anim';

// ms = milissegundos desde que a animação começou
const { frame, done } = frameAt(heroi, 'correr', ms);
const f = heroi.frames[frame];
ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);

// done = true quando uma tag com repetição definida (ex.: tocar 1 vez) terminou
```

### Atualizando ao salvar

Durante o `vite dev`, salvar um arquivo no Aseprite atualiza o objeto `sprites` sem recarregar a página. Quem lê `sprites['heroi']` a cada quadro já vê a versão nova.

Se o jogo cria texturas a partir das imagens (como quase toda engine faz), use `watchSprites` para recriá-las:

```ts
import { watchSprites } from 'ase-live/sprites';

watchSprites((todos) => {
  // chamado agora e de novo a cada arquivo salvo, criado ou apagado em art/
  recriarTexturas(todos);
});
```

No build de produção, `watchSprites` chama a função uma vez só.

### Exemplo com Phaser

```ts
import { sprites, watchSprites } from 'ase-live/sprites';

function carregar(scene: Phaser.Scene, nome: string): Promise<void> {
  const sprite = sprites[nome];
  if (!sprite) return Promise.resolve();
  const img = new Image();
  img.src = sprite.image;
  return img.decode().then(() => {
    if (scene.textures.exists(nome)) scene.textures.remove(nome);
    const tex = scene.textures.addImage(nome, img);
    sprite.frames.forEach((f, i) => tex?.add(i, 0, f.x, f.y, f.w, f.h));
  });
}

// na cena:
watchSprites(() => carregar(this, 'heroi'));
```

---

## Galeria

Com o `vite dev` rodando, abra **`http://localhost:5173/__ase-live/`** (troque a porta se o seu projeto usa outra; o endereço aparece no terminal, logo abaixo do endereço do jogo).

A galeria mostra todos os arquivos de `art/` de uma vez:

- **cada animação tocando**, com o nome da tag, os números dos quadros (os mesmos da linha do tempo do Aseprite), a duração e a direção;
- **a tira de quadros** de cada animação, numerados como na linha do tempo do Aseprite;
- **os pontos** das camadas `@`, marcados em cores, quando a opção "pontos" está ligada;
- **os tilesets**, com todas as peças;
- **os avisos** de cada arquivo, no topo da página.

No cabeçalho dá para filtrar as animações pelo nome, mudar o zoom e trocar o fundo (escuro, claro ou xadrez). A galeria atualiza sozinha quando você salva no Aseprite, então dá para deixar aberta ao lado do programa enquanto desenha.

Ela só existe durante o desenvolvimento: não vai para o build do jogo.

---

## Como organizar o arquivo no Aseprite

Tudo o que o jogo precisa vem do próprio arquivo. A tabela resume; os detalhes estão logo abaixo.

| No Aseprite | No jogo |
|---|---|
| `art/heroi.aseprite` | `sprites['heroi']` |
| tags da linha do tempo | `tags` (animações) |
| duração de cada quadro | `frames[i].duration`, em milissegundos |
| camada `@pe` com 1 pixel pintado | `points.pe[i]`, a posição desse pixel em cada quadro |
| camada ou grupo começando com `_` | não vai para o jogo |
| camada escondida ou de referência | não vai para o jogo |
| camada de tilemap | desenhada no quadro, e o tileset vira imagem |
| slices | `slices` |

### Animações: tags

Cada tag da linha do tempo vira uma animação com o mesmo nome. Use nomes simples, sem espaço e sem acento, para escrever fácil no código: `parado`, `correr`, `pular`.

O que a tag guarda e o jogo respeita:

- **Quadros:** do primeiro ao último da tag.
- **Direção:** para frente, ao contrário, vai e volta, ou volta e vai.
- **Repetições:** em branco, a animação repete para sempre; com um número, toca essa quantidade de vezes e para no último quadro.
- **Duração de cada quadro:** definida no Aseprite (clique duplo no número do quadro). Quadros com durações diferentes dão peso ao movimento.

Um arquivo sem nenhuma tag continua funcionando: `frameAt(sprite, null, ms)` toca todos os quadros em sequência.

### Pontos: camadas `@`

Para o jogo saber onde fica o pé, a mão ou a boca do personagem, crie uma camada com nome começando por `@` e pinte **um pixel** em cada quadro, na posição desejada.

| Camada | No jogo |
|---|---|
| `@pe` | `sprite.points.pe[quadro]` = `{ x, y }` |
| `@mao` | `sprite.points.mao[quadro]` = `{ x, y }` |

- O ponto pode mudar de lugar de um quadro para o outro (a mão que acompanha o soco, por exemplo).
- Quadro sem pixel na camada dá `null`.
- A cor do pixel não importa e a camada pode ficar escondida no Aseprite: o ponto é lido do mesmo jeito.
- As camadas `@` nunca aparecem na imagem do jogo.

### Camadas que não vão para o jogo

Comece o nome com `_` para tudo o que é só de trabalho: rascunho, guia de proporção, referência. Vale para camadas e para grupos inteiros.

```
_rascunho     não vai
_guias        não vai (e tudo dentro do grupo)
corpo         vai
roupa         vai
@pe           vira ponto
```

Camadas com o olho fechado e camadas de referência também ficam de fora, como no próprio Aseprite.

### Tilesets

Camadas de tilemap são desenhadas normalmente nos quadros. Além disso, cada tileset do arquivo aparece em `sprite.tilesets`, com uma imagem das peças uma embaixo da outra: a peça `n` começa em `y = n × tileHeight`. A peça 0 é sempre a vazia.

### Slices

Os slices do Aseprite (caixas desenhadas com a ferramenta de slice) aparecem em `sprite.slices`, pelo nome. Servem para caixa de colisão, área de acerto, nove-partes de interface ou pivô.

---

## Referência

### Módulos

| Importar de | O que tem |
|---|---|
| `ase-live` | o plugin do Vite (`aseLive`) e os tipos |
| `ase-live/sprites` | `sprites`, `warnings`, `watchSprites` |
| `ase-live/anim` | `frameAt`, `tagSequence` |
| `ase-live/read` | o leitor do formato, para quem quiser usar fora do Vite |

### Opções do plugin

```js
aseLive({
  dir: 'art', // pasta dos arquivos, a partir da raiz do projeto
});
```

### `Sprite`

| Campo | Tipo | O que é |
|---|---|---|
| `name` | `string` | caminho dentro de `art/`, sem extensão |
| `width`, `height` | `number` | tamanho da tela do Aseprite; todo quadro tem esse tamanho |
| `image` | `string` | URL da imagem com todos os quadros |
| `frames` | `Frame[]` | os quadros, na ordem da linha do tempo |
| `tags` | `Record<string, Tag>` | animações, pelo nome |
| `points` | `Record<string, (Point \| null)[]>` | pontos das camadas `@`, um por quadro |
| `slices` | `Record<string, SliceKey[]>` | slices, pelo nome |
| `tilesets` | `Tileset[]` | tilesets do arquivo |
| `warnings` | `string[]` | problemas encontrados no arquivo |

### `Frame`

| Campo | O que é |
|---|---|
| `x`, `y`, `w`, `h` | retângulo do quadro dentro de `image` |
| `duration` | duração em milissegundos |

Quadros idênticos (como os de cels ligados) apontam para o mesmo lugar da imagem, que fica menor.

### `Tag`

| Campo | O que é |
|---|---|
| `from`, `to` | primeiro e último quadro, inclusive |
| `direction` | `'forward'`, `'reverse'`, `'pingpong'` ou `'pingpong-reverse'` |
| `repeat` | `0` repete sempre; `n` toca `n` vezes |

### `Tileset`

| Campo | O que é |
|---|---|
| `name` | nome do tileset no Aseprite |
| `tileWidth`, `tileHeight` | tamanho de cada peça |
| `count` | quantidade de peças, contando a vazia |
| `image` | URL da imagem com as peças em coluna |

### Funções

**`watchSprites(fn)`**
Chama `fn(sprites)` agora e de novo sempre que um arquivo de `art/` mudar. No build, só uma vez.

**`frameAt(sprite, tag, ms)`**
Devolve `{ frame, done }`: o índice do quadro em `sprite.frames` depois de `ms` milissegundos tocando a tag. Com `tag` igual a `null`, ou com uma tag que não existe, toca o arquivo inteiro.

**`tagSequence(tag)`**
Devolve a lista de quadros de uma passada completa da tag, já com direção e repetições. Útil para quem controla o tempo por conta própria.

---

## Erros e avisos

**Arquivo que não abre** (corrompido, ou lido no meio do salvamento): os outros arquivos continuam funcionando. O erro aparece na tela do jogo, por cima de tudo, e no terminal do Vite. Ao salvar de novo, o aviso some.

**Avisos** aparecem no terminal do Vite, no console do navegador e em `warnings`:

- ponto `@` com mais de um pixel no mesmo quadro (vale o primeiro, de cima para baixo e da esquerda para a direita);
- duas camadas para o mesmo ponto;
- tag repetida;
- camada com modo de mistura diferente de Normal;
- pasta `art/` que não existe.

---

## Limitações

- **Modos de mistura:** só o Normal. Camadas em Multiplicar, Sobrepor e os outros são desenhadas como Normal, com aviso.
- **Tilesets externos:** tilesets guardados em outro arquivo não são lidos; as peças ficam vazias, com aviso.
- **Imagens no `vite dev`:** vão embutidas no código (data URL). No build viram arquivos PNG normais, com nome versionado.

---

## Desenvolvimento do pacote

```bash
npm install
npm run check      # tipos, lint e testes
npm run example    # exemplo em http://localhost:5199
npm run fixtures   # regera os arquivos de teste (precisa do aseprite no PATH)
```

No exemplo, abra `example/art/boneco.aseprite` no Aseprite, mude algo e salve.

**Como os testes funcionam:** `tools/fixtures.lua` cria arquivos de teste com o próprio Aseprite (camadas, grupos, opacidade, paleta indexada, tons de cinza, tilemaps espelhados), e `tools/references.lua` exporta como o Aseprite desenha cada quadro. Os testes comparam o desenho do ase-live com essas referências, pixel a pixel.

---

## Licença

MIT. Use como quiser, inclusive em jogos comerciais.
