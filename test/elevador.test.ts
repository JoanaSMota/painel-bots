// Elevador na passagem entre andares: direção da seta (sobe/desce) pela ordem dos andares,
// portas e painel de andar no desenho, portas que abrem na passagem para outro andar, e
// desempenho (nada com filtro nem animação CSS no elevador; só transform/opacity quadro a quadro).
import { test } from "node:test";
import assert from "node:assert/strict";
import { elevSeta } from "../src/elevador.js";
import { floorOrder } from "../src/floors.js";
import { panelPage } from "../src/page.js";

const html = panelPage("n");
const ORDEM = floorOrder(["Tech", "Ops", "ANA", "Research"], ["ANA", "Research", "Tech", "Ops"]);

test("ordem dos andares do painel: ANA=1, Research=2, Tech=3, Ops=4", () => {
  assert.deepEqual(ORDEM, ["ANA", "Research", "Tech", "Ops"]);
});

test("seta sobe quando o destino está acima, desce quando está abaixo", () => {
  assert.deepEqual(elevSeta("ANA", "Tech", ORDEM), { dir: "sobe", andar: 3 });
  assert.deepEqual(elevSeta("ANA", "Research", ORDEM), { dir: "sobe", andar: 2 });
  assert.deepEqual(elevSeta("Ops", "ANA", ORDEM), { dir: "desce", andar: 1 });
  assert.deepEqual(elevSeta("Tech", "Research", ORDEM), { dir: "desce", andar: 2 });
  // na volta a seta inverte
  assert.equal(elevSeta("Tech", "ANA", ORDEM).dir, "desce");
});

test("mesmo andar ou andar desconhecido: sem seta", () => {
  assert.deepEqual(elevSeta("Tech", "Tech", ORDEM), { dir: null, andar: 3 });
  assert.deepEqual(elevSeta("Tech", "Marte", ORDEM), { dir: null, andar: 0 });
  assert.deepEqual(elevSeta(null, "Ops", ORDEM), { dir: null, andar: 4 });
  assert.deepEqual(elevSeta("ANA", undefined, ORDEM), { dir: null, andar: 0 });
});

test("painel embute elevSeta e usa a mesma ordem dos andares", () => {
  assert.ok(html.includes("var elevSeta=function elevSeta("));
  assert.ok(html.includes("var ix=sai?elevSeta(andarSel,tm,ordem):elevSeta(tm,andarSel,ordem);"));
  assert.ok(html.includes("ordem=times().map(function(t){return t.nome;})"));
});

test("elevador tem portas recortadas no vão, cabine e painel com seta para cima e para baixo", () => {
  for (const s of ["id:'vaoElev'", "'clip-path':'url(#vaoElev)'", "class:'porta-elev'", "class:'painel-elev'", "class:'seta-sobe'", "class:'seta-desce'", "function elevPoe("])
    assert.ok(html.includes(s), "faltou " + s);
});

test("passagem para outro andar: a linha vai até o elevador, que abre e mostra seta e andar; sem passagem, portas fechadas", () => {
  const dh = html.slice(html.indexOf("function desenhaHandoffs("), html.indexOf("function linhaHo("));
  // um dos dois em outro andar: linha até o elevador (origem sai / destino chega) e marcador com seta + número do andar
  assert.match(dh, /var sai=!!a,aq=sai\?a:b/);
  assert.match(dh, /if\(sai\)linhaHo\(aq,[\s\S]*else linhaHo\(\{x:E\[0\]/);
  assert.ok(dh.includes("ix.dir==='sobe'?'▲':ix.dir==='desce'?'▼'"));
  // portas abertas com a direção/andar de destino; ao terminar, fechadas e painel apagado
  assert.ok(dh.includes("if(cross)elevPoe(1,cross.dir,cross.andar,true);else elevPoe(0,null,0,true);"));
});

test("desempenho: elevador sem filtro e sem animação CSS; portas só mudam transform", () => {
  const bloco = html.slice(html.indexOf("// elevador na parede da esquerda"), html.indexOf("// placas no piso"));
  assert.ok(bloco.length > 200);
  assert.ok(!bloco.includes("filter"), "elevador não pode ter filtro");
  assert.ok(!/class:'(?:brilho|tela|anel|pulo|halo|neon-pulso|fluxo)'/.test(bloco), "elevador não usa classes animadas");
  const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  assert.doesNotMatch(css, /(?:elevador|porta-elev|painel-elev|luz-elev|seta-sobe|seta-desce)/, "sem regra CSS (nem animação) no elevador");
  const poe = html.slice(html.indexOf("function elevPoe("), html.indexOf("function novasPassagens("));
  assert.ok(poe.length > 100 && !poe.includes("filter"));
  for (const attr of poe.match(/setAttribute\('([a-z-]+)'/g) ?? [])
    assert.ok(/'(transform|display|opacity)'/.test(attr), "elevPoe só mexe em transform/display/opacity: " + attr);
});

test("movimento reduzido: a linha da passagem fica parada (animação só em CSS, desligada pela regra geral)", () => {
  const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  assert.match(css, /\.fluxo\{animation:/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important/);
});
