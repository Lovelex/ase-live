-- Gera os arquivos de teste em test/fixtures com o próprio Aseprite:
--   aseprite -b --script tools/fixtures.lua
-- Cada arquivo exercita uma parte do formato; test/reference.sh exporta o
-- que o Aseprite desenha, para os testes compararem pixel a pixel.

local dir = app.fs.joinPath(app.fs.currentPath, "test", "fixtures")
app.fs.makeAllDirectories(dir)

local function rgba(r, g, b, a) return app.pixelColor.rgba(r, g, b, a or 255) end

local function fill(img, x0, y0, x1, y1, c)
  for y = y0, y1 do
    for x = x0, x1 do img:drawPixel(x, y, c) end
  end
end

-- rgba: camadas, grupo, opacidade, camadas ignoradas, pontos, cel ligado, tags, durações
do
  local s = Sprite(8, 6, ColorMode.RGB)
  local fundo = s.layers[1]
  fundo.name = "fundo"
  fundo.isContinuous = true -- quadros novos ligam o cel ao anterior

  local img = Image(8, 6, ColorMode.RGB)
  fill(img, 0, 0, 7, 5, rgba(40, 60, 80))
  s.cels[1].image = img

  for _ = 2, 4 do s:newFrame() end -- camada contínua: cels 2–4 ligados ao 1

  local grupo = s:newGroup()
  grupo.name = "grupo"
  grupo.opacity = 200
  local braco = s:newLayer()
  braco.name = "braco"
  braco.parent = grupo
  for f = 1, 4 do
    local b = Image(2, 2, ColorMode.RGB)
    fill(b, 0, 0, 1, 1, rgba(200, 30, 30))
    s:newCel(braco, f, b, Point(f, 1)) -- anda 1 px por quadro
  end

  local meia = s:newLayer()
  meia.name = "meia"
  meia.opacity = 128
  local m = Image(3, 1, ColorMode.RGB)
  fill(m, 0, 0, 2, 0, rgba(250, 250, 250, 180))
  local cel = s:newCel(meia, 2, m, Point(0, 4))
  cel.opacity = 100

  local rascunho = s:newLayer()
  rascunho.name = "_rascunho"
  local r = Image(8, 6, ColorMode.RGB)
  fill(r, 0, 0, 7, 5, rgba(0, 255, 0))
  s:newCel(rascunho, 1, r)

  local escondida = s:newLayer()
  escondida.name = "escondida"
  escondida.isVisible = false
  s:newCel(escondida, 1, r)

  local pe = s:newLayer()
  pe.name = "@pe"
  for f = 1, 3 do -- quadro 4 sem ponto
    local p = Image(1, 1, ColorMode.RGB)
    p:drawPixel(0, 0, rgba(255, 0, 255))
    s:newCel(pe, f, p, Point(3 + f, 5))
  end

  s.frames[1].duration = 0.1
  s.frames[2].duration = 0.15
  s.frames[3].duration = 0.2
  s.frames[4].duration = 0.25

  local idle = s:newTag(1, 2)
  idle.name = "idle"
  local run = s:newTag(3, 4)
  run.name = "run"
  run.aniDir = AniDir.PING_PONG
  run.repeats = 2

  s:saveAs(app.fs.joinPath(dir, "rgba.aseprite"))
  s:close()
end

-- indexed: paleta, índice transparente, camada de fundo
do
  local s = Sprite(4, 3, ColorMode.INDEXED)
  local pal = Palette(4)
  pal:setColor(0, Color { r = 0, g = 0, b = 0, a = 0 })
  pal:setColor(1, Color { r = 255, g = 0, b = 0 })
  pal:setColor(2, Color { r = 0, g = 255, b = 0 })
  pal:setColor(3, Color { r = 0, g = 0, b = 255 })
  s:setPalette(pal)

  local bg = s.layers[1]
  local i = Image(4, 3, ColorMode.INDEXED)
  i:clear(3)
  s.cels[1].image = i
  app.command.BackgroundFromLayer()

  local top = s:newLayer()
  top.name = "top"
  local t = Image(4, 3, ColorMode.INDEXED)
  t:clear(0)
  t:drawPixel(1, 1, 1)
  t:drawPixel(2, 1, 2)
  s:newCel(top, 1, t)

  s:saveAs(app.fs.joinPath(dir, "indexed.aseprite"))
  s:close()
end

-- gray: tons de cinza com alfa
do
  local s = Sprite(2, 2, ColorMode.GRAYSCALE)
  local g = Image(2, 2, ColorMode.GRAYSCALE)
  g:drawPixel(0, 0, app.pixelColor.graya(10, 255))
  g:drawPixel(1, 0, app.pixelColor.graya(128, 255))
  g:drawPixel(0, 1, app.pixelColor.graya(250, 64))
  s.cels[1].image = g
  s:saveAs(app.fs.joinPath(dir, "gray.aseprite"))
  s:close()
end

-- tiles: camada de tilemap com espelhamentos
do
  local s = Sprite(8, 8, ColorMode.RGB)
  s.gridBounds = Rectangle(0, 0, 4, 4)
  app.command.NewLayer { tilemap = true, name = "chao" }
  local layer = app.layer
  local ts = layer.tileset
  ts.name = "rocha"

  -- peça 1: canto de cima à esquerda vermelho, resto azul (mostra o giro)
  local t1 = s:newTile(ts)
  local a = Image(4, 4, ColorMode.RGB)
  fill(a, 0, 0, 3, 3, rgba(0, 0, 200))
  a:drawPixel(0, 0, rgba(255, 0, 0))
  a:drawPixel(1, 0, rgba(255, 128, 0))
  t1.image = a
  -- peça 2: verde
  local t2 = s:newTile(ts)
  local b = Image(4, 4, ColorMode.RGB)
  fill(b, 0, 0, 3, 3, rgba(0, 180, 0))
  t2.image = b

  local pc = app.pixelColor
  local map = Image(2, 2, ColorMode.TILEMAP)
  map:drawPixel(0, 0, pc.tile(1, 0))
  map:drawPixel(1, 0, pc.tile(1, 0x80000000)) -- espelho X
  map:drawPixel(0, 1, pc.tile(1, 0x20000000)) -- diagonal
  map:drawPixel(1, 1, pc.tile(0, 0)) -- vazio
  s:newCel(layer, 1, map)

  s:deleteLayer(s.layers[1])
  s:saveAs(app.fs.joinPath(dir, "tiles.aseprite"))
  s:close()
end

-- groups: grupo com opacidade própria, composto à parte (opção experimental do Aseprite)
do
  local before = app.preferences.experimental.compose_groups
  app.preferences.experimental.compose_groups = true
  local s = Sprite(4, 2, ColorMode.RGB)
  local base = Image(4, 2, ColorMode.RGB)
  fill(base, 0, 0, 3, 1, rgba(20, 40, 60))
  s.cels[1].image = base
  local grupo = s:newGroup()
  grupo.name = "grupo"
  grupo.opacity = 128
  local a = s:newLayer()
  a.parent = grupo
  local ia = Image(3, 2, ColorMode.RGB)
  fill(ia, 0, 0, 2, 1, rgba(255, 0, 0))
  s:newCel(a, 1, ia)
  local b = s:newLayer()
  b.parent = grupo
  b.opacity = 160
  local ib = Image(3, 2, ColorMode.RGB)
  fill(ib, 0, 0, 2, 1, rgba(0, 0, 255, 200))
  s:newCel(b, 1, ib, Point(1, 0))
  s:saveAs(app.fs.joinPath(dir, "groups.aseprite"))
  s:close()
  app.preferences.experimental.compose_groups = before
end
