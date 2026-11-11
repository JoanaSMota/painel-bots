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
  assert.match(html, /function focar\(nome\)\{botSel=nome;orgSelFora=null;neon=nome;/);
  assert.match(html, /function soltar\(\)\{if\(zoom\|\|neon\)\{[^}]*neon=null;/);
  // trocar de andar também desliga
  assert.match(html, /zoom=null;neon=null;cam0=/);
});

test("bot em foco ganha classe neon no corpo e no rótulo; os outros esmaecem", () => {
  for (const s of ["(emNeon?' neon':'')", "b.nome===neon?' neon':''", "toggle('com-neon',!!neon)", ".cam.com-neon .bot-g:not(.neon)", ".balao.neon .borda"])
    assert.ok(html.includes(s), "faltou " + s);
});

test("a camada da passagem (linha/dica) não captura o mouse, então o clique no bot continua ligando o neon", () => {
  assert.match(html, /\.passante\{pointer-events:none\}/);
  assert.ok(html.includes("hl=sv('g',{class:'passante'},mov),tl=sv('g',{class:'passante'},mov)"));
});

test("pulso é animação CSS, desligada por prefers-reduced-motion", () => {
  assert.match(html, /\.neon-pulso\{animation:neon /);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important/);
});

// Desempenho: nada com filtro (url(#neon), blur, drop-shadow) pode ser animado nem ficar dentro
// de um grupo animado; senão o navegador refaz o filtro a cada quadro e a tela trava.
test("neon leve: filtros ficam parados, só peças sem filtro pulsam", () => {
  const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  assert.doesNotMatch(css, /\.neon-halo\{[^}]*animation/, "halo filtrado não pode animar");
  assert.doesNotMatch(css, /\.neon-chao\{[^}]*animation/, "anel filtrado não pode animar");
  assert.doesNotMatch(css, /@keyframes neon-chao/);
  assert.match(css, /\.balao\.neon \.borda\{[^}]*filter:drop-shadow/);
  assert.doesNotMatch(css, /\.balao\.neon \.borda\{[^}]*animation/, "borda com drop-shadow não pode animar");
  // halo fica fora do .respira (que anima transform sem parar)
  assert.ok(html.includes("hv.insertBefore(neonHalo(null,"));
  assert.ok(!html.includes("neonHalo(rs,"));
  // peças que pulsam não carregam filtro
  const pulsos = html.match(/sv\('(?:ellipse|rect)',\{[^}]*class:'neon-pulso'\}/g) ?? [];
  assert.equal(pulsos.length, 2, "anel e rótulo têm uma peça pulsante cada");
  for (const p of pulsos) assert.ok(!p.includes("filter"), "peça pulsante com filtro: " + p);
});
