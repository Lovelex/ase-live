// Exemplo: cada arquivo de art/ animado pela primeira tag, atualizando ao salvar.
import { watchSprites, warnings } from 'ase-live/sprites';
import { frameAt } from '../dist/anim.js';

const list = document.getElementById('list');
let shown = [];
window.__updates = 0;

watchSprites(async (all) => {
  window.__updates++;
  list.replaceChildren();
  shown = await Promise.all(Object.values(all).map(async (sprite) => {
    const img = new Image();
    img.src = sprite.image;
    await img.decode();
    const title = document.createElement('div');
    title.textContent = `${sprite.name} — tags: ${Object.keys(sprite.tags).join(', ') || '(nenhuma)'}`;
    const canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    list.append(title, canvas);
    return { sprite, img, ctx: canvas.getContext('2d'), tag: Object.keys(sprite.tags)[0] ?? null };
  }));
  for (const w of warnings) {
    const p = document.createElement('div');
    p.textContent = `⚠ ${w}`;
    list.append(p);
  }
});

const start = performance.now();
function draw(now) {
  for (const { sprite, img, ctx, tag } of shown) {
    const f = sprite.frames[frameAt(sprite, tag, now - start).frame];
    ctx.clearRect(0, 0, sprite.width, sprite.height);
    ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
