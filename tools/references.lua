-- Exporta o desenho do próprio Aseprite de cada quadro dos arquivos de teste
-- (RGBA cru, <nome>.<quadro>.rgba), escondendo as camadas que o ase-live
-- ignora (nome com _ ou @):
--   aseprite -b --script tools/references.lua

local dir = app.fs.joinPath(app.fs.currentPath, "test", "fixtures")

local function hideIgnored(layers)
  for _, layer in ipairs(layers) do
    local first = layer.name:sub(1, 1)
    if first == "_" or first == "@" then layer.isVisible = false end
    if layer.isGroup then hideIgnored(layer.layers) end
  end
end

-- grupos compostos à parte só desenham assim com a opção ligada
app.preferences.experimental.compose_groups = true

for _, file in ipairs(app.fs.listFiles(dir)) do
  if file:match("%.aseprite$") then
    local s = app.open(app.fs.joinPath(dir, file))
    hideIgnored(s.layers)
    local base = file:gsub("%.aseprite$", "")
    for i, frame in ipairs(s.frames) do
      local img = Image(s.width, s.height, ColorMode.RGB)
      img:drawSprite(s, frame)
      local out = io.open(app.fs.joinPath(dir, base .. "." .. (i - 1) .. ".rgba"), "wb")
      out:write(img.bytes)
      out:close()
    end
    s:close()
  end
end
