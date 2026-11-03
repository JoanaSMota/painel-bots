// Neon no bot em foco ("falar"): filtro SVG, halo, anel no chão, rótulo com borda neon,
// estado de foco ligado no clique e desligado ao soltar; pulso some com movimento reduzido.
import { test } from "node:test";
import assert from "node:assert/strict";
import { panelPage } from "../src/page.js";

const html = panelPage("n");

test("painel tem o filtro neon (contorno + brilho) e as peças do efeito", () => {
  for (const s of ["id:'neon'", "feMorphology", "feGaussianBlur", "feMerge", "function neonHalo", "function neonAnel", "url(#neon)"])
    assert.ok(html.includes(s), "faltou " + s);
});

test("clique liga o neon e soltar (clique fora / Esc) desliga", () => {
  assert.match(html, /function focar\(nome\)\{botSel=nome;neon=nome;/);
  assert.match(html, /function soltar\(\)\{if\(zoom\|\|neon\)\{[^}]*neon=null;/);
  // trocar de andar também desliga
  assert.match(html, /zoom=null;neon=null;cam0=/);
});

test("bot em foco ganha classe neon no corpo e no rótulo; os outros esmaecem", () => {
  for (const s of ["(emNeon?' neon':'')", "b.nome===neon?' neon':''", "toggle('com-neon',!!neon)", ".cam.com-neon .bot-g:not(.neon)", ".balao.neon .borda"])
    assert.ok(html.includes(s), "faltou " + s);
});

test("neon também no boneco que está andando", () => {
  assert.ok(html.includes("p.wkNeon=neonHalo("));
  assert.ok(html.includes("neon===h.from?'inline':'none'"));
});

test("pulso é animação CSS, desligada por prefers-reduced-motion", () => {
  assert.match(html, /\.neon-halo\{animation:neon /);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important/);
});
