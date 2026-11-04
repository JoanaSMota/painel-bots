// Elevador na passagem entre andares: direção da seta (sobe/desce) pela ordem dos andares,
// portas e painel de andar no desenho, sequência porta abre → entra → fecha → seta, e
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
  assert.ok(html.includes("p.vai=elevSeta(aqui,outro,ordem);p.vem=elevSeta(outro,aqui,ordem);"));
  assert.ok(html.includes("ordem=times().map(function(t){return t.nome;})"));
});

test("elevador tem portas recortadas no vão, cabine e painel com seta para cima e para baixo", () => {
  for (const s of ["id:'vaoElev'", "'clip-path':'url(#vaoElev)'", "class:'porta-elev'", "class:'painel-elev'", "class:'seta-sobe'", "class:'seta-desce'", "function elevPoe("])
    assert.ok(html.includes(s), "faltou " + s);
});

test("sequência: chama, portas abrem, bot entra e some, portas fecham, seta pisca; e o contrário na chegada", () => {
  const emb = html.slice(html.indexOf("var embarca="), html.indexOf("var desembarca="));
  const ordem = ["ind:'vai'", "porta0:0,porta1:1", "op0:1,op1:0,porta:1", "porta0:1,porta1:0", "pisca:1"].map((s) => emb.indexOf(s));
  assert.ok(ordem.every((i) => i >= 0), "faltou peça do embarque");
  assert.deepEqual(ordem, ordem.slice().sort((a, b) => a - b), "embarque fora de ordem");
  const des = html.slice(html.indexOf("var desembarca="), html.indexOf("if(a){p.modo='sai'"));
  const o2 = ["ind:'vem',pisca:1", "porta0:0,porta1:1", "op0:0,op1:1,porta:1", "porta0:1,porta1:0"].map((s) => des.indexOf(s));
  assert.ok(o2.every((i) => i >= 0), "faltou peça do desembarque");
  assert.deepEqual(o2, o2.slice().sort((a, b) => a - b), "desembarque fora de ordem");
  // origem: anda até o elevador e embarca; destino: desembarca, entrega, volta e embarca
  const sai = html.slice(html.indexOf("p.modo='sai'"), html.indexOf("p.modo='entra'"));
  assert.match(sai, /anda\(ida2,1,0,[\s\S]*;embarca\(\{[\s\S]*;desembarca\(\{/);
  const entra = html.slice(html.indexOf("p.modo='entra'"), html.indexOf("function planejaCafe("));
  assert.match(entra, /desembarca\(\{espera:1300,papel:1\}\);anda\(ida3[\s\S]*recebe:1[\s\S]*embarca\(\{viagem:1400\}\)/);
  // ao terminar, portas fechadas e painel apagado
  assert.ok(html.includes("if(p.vai)elevPoe(0,null,0,true);"));
});

test("desempenho: elevador sem filtro e sem animação CSS; portas só mudam transform", () => {
  const bloco = html.slice(html.indexOf("// elevador na parede da esquerda"), html.indexOf("// café: sofá e poltrona"));
  assert.ok(bloco.length > 200);
  assert.ok(!bloco.includes("filter"), "elevador não pode ter filtro");
  assert.ok(!/class:'(?:brilho|tela|anel|pulo|halo|neon-pulso)'/.test(bloco), "elevador não usa classes animadas");
  const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  assert.doesNotMatch(css, /(?:elevador|porta-elev|painel-elev|luz-elev|seta-sobe|seta-desce)/, "sem regra CSS (nem animação) no elevador");
  const poe = html.slice(html.indexOf("function elevPoe("), html.indexOf("function balaoPass("));
  assert.ok(!poe.includes("filter"));
  for (const attr of poe.match(/setAttribute\('([a-z-]+)'/g) ?? [])
    assert.ok(/'(transform|display|opacity)'/.test(attr), "elevPoe só mexe em transform/display/opacity: " + attr);
});

test("movimento reduzido: portas paradas, só a seta acesa fixa", () => {
  const rm = html.slice(html.indexOf("function desenhaRM("), html.indexOf("function encerra("));
  assert.ok(rm.includes("var ix=a?p.vai:p.vem;if(ix)elevPoe(0,ix.dir,ix.andar,true);"));
  assert.match(html, /p\.modo='rm';[^\n]*p\.vai=elevSeta\(/);
});
