# CLAUDE.md — ase-live

Plugin do Vite que lê `.aseprite`/`.ase` de `art/` e entrega ao jogo como
`import { sprites } from 'ase-live/sprites'`, atualizando ao salvar (sem F5).
Pacote reaproveitado por todos os jogos do usuário; o primeiro é o Kage Arena
(`../KageArena`). Convenção para o usuário no README.md. Público (MIT) em
github.com/Lovelex/ase-live; os jogos instalam por tag (`github:Lovelex/ase-live#vX.Y.Z`,
o `prepare` compila o `dist/`). Versão nova = commit + `git tag vX.Y.Z` + push da tag.
README para o público: português, sem emoji e sem travessão.

## Estrutura
- `src/read.ts` — leitor do formato (puro, zlib injetado). Especificação: `~/.local/src/aseprite/docs/ase-file-specs.md`.
- `src/compose.ts` — desenha os quadros com a conta do Aseprite (`rgba_blender_normal`, `MUL_UN8`, divisão truncada) e aplica a convenção: `_` ignora, `@nome` = ponto, escondida/referência fora.
- `src/gallery.ts` — galeria do dev (`/__ase-live/`): roda no navegador; o plugin serve a página e só `gallery.js`/`anim.js` (+ .map) de `dist/` por lista fixa. Importa o virtual pela URL canônica `/@id/__x00__ase-live:sprites` (outra URL = outro módulo, e o HMR não chega). Partes puras testadas (`galleryEntries`, `describeEntry`). `npm run check` compila antes dos testes (a galeria servida vem de `dist/`).
- `src/sheet.ts` (grade + quadros iguais deduplicados), `src/png.ts` (gravador mínimo), `src/anim.ts` (`frameAt`, `tagSequence`), `src/plugin.ts`.
- `src/sprites.ts` é o módulo de verdade de `ase-live/sprites` (tipos + aviso "plugin ausente"); com o plugin, `resolveId` troca pelo virtual `\0ase-live:sprites`. Assim o jogo não precisa configurar tipos.
- O jogo importa de `dist/` (o Vite carrega o plugin pelo Node): mudou `src/`, `npm run build`, e reinicie o servidor de exemplo/jogo.

## Comandos
`npm run check` (tsc + eslint + vitest) · `npm run build` · `npm run example` (porta 5199, edite `example/art/`) · `npm run fixtures` (precisa do `aseprite` no PATH).
RTK engole a saída: `rtk proxy ./node_modules/.bin/vitest run`.

## Testes contra o Aseprite
- `tools/fixtures.lua` cria `test/fixtures/*.aseprite`; `tools/composite-groups.mjs` liga a flag de grupos compostos em `groups.aseprite`; `tools/references.lua` grava `<nome>.<quadro>.rgba` = desenho do próprio Aseprite (com as camadas `_`/`@` escondidas). `compose.test.ts` compara pixel a pixel (alfa 0 = cor indiferente). Recurso novo do formato = cena nova no fixtures.lua + regerar.
- A flag 2 do header (grupos compostos à parte, opção experimental `compose_groups`) só é gravada pelo Aseprite com interface (`ui::is_ui_thread`); no `-b` não. Sem ela, grupo não guarda opacidade/mistura no arquivo (o leitor usa 255/Normal).

## Armadilhas do HMR (verificadas no navegador)
- O código gerado tem de conter literalmente `import.meta.hot.accept(`: o Vite detecta auto-aceite por texto; guardar `import.meta.hot` numa variável fazia recarregar a página.
- No dev, nada de `this.addWatchFile` para os arquivos de art/: o Vite também recarregava a página. Quem vigia é o `configureServer` (`watcher` + `reloadModule` com espera de 60 ms). No build o `addWatchFile` fica.
- `sprites`/`warnings`/ouvintes ficam em `import.meta.hot.data`: o mesmo objeto entre recargas.
- Teste de ponta a ponta: puppeteer (ver CLAUDE.md do Kage Arena → "Verificação visual"), salvar via `aseprite -b --script` e conferir que um marcador em `window` sobreviveu.

## Aseprite local
Compilado do código (uso pessoal, a licença proíbe redistribuir): `~/.local/opt/aseprite` (`aseprite` no PATH via `~/.local/bin`). Atualizar: `~/.local/src/aseprite-update.sh [tag]`.
