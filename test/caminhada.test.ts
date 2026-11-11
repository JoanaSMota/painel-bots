// Caminhada dos bonecos no mapa isométrico: rotas pelos corredores, trajeto, quem trocou de lugar e as regras
// de desempenho/movimento reduzido da animação (a animação em si roda no navegador).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mudouSentado, rotaEscritorio, trajeto, type Lugar } from "../src/caminhada.js";
import { panelPage } from "../src/page.js";

const html = panelPage("n");
// mesmas medidas do mapa: corredores de trás das fileiras (ty-1.75), corredor esquerdo (elevador) e direito (copa)
const AIS = [0.85, 4.35, 7.85];
const CL = 0.45;
const CR = 13.2;
const seat = (x: number, row: number): Lugar => ({ k: "a", x, y: AIS[row]! + 0.9, ay: AIS[row]! });
const copa = (x: number, y: number): Lugar => ({ k: "n", nc: CR, x, y });
const frente: Lugar = { k: "n", nc: CL, x: CL, y: 7.2 };

function ortogonal(p: number[][]) {
  for (let i = 1; i < p.length; i++) {
    const dx = Math.abs(p[i]![0]! - p[i - 1]![0]!);
    const dy = Math.abs(p[i]![1]! - p[i - 1]![1]!);
    assert.ok(dx < 1e-9 || dy < 1e-9, `trecho torto: ${JSON.stringify(p[i - 1])} → ${JSON.stringify(p[i])}`);
  }
}

test("rota copa → mesa: sai da copa, desce pelo corredor da direita, entra pelo corredor de trás da fileira e senta", () => {
  const a = copa(18, 8.8);
  const b = seat(6.6, 1);
  const r = rotaEscritorio(a, b, AIS, CL, CR);
  assert.deepEqual(r[0], [18, 8.8]);
  assert.deepEqual(r[r.length - 1], [6.6, b.y]);
  ortogonal(r);
  assert.deepEqual(r, [[18, 8.8], [CR, 8.8], [CR, 4.35], [6.6, 4.35], [6.6, b.y]]);
  // o caminho de volta (mesa → copa) é o mesmo, ao contrário
  assert.deepEqual(rotaEscritorio(b, a, AIS, CL, CR), r.slice().reverse());
});

test("rota entre mesas: mesma fileira vai direto pelo corredor dela; fileiras diferentes usam um corredor lateral", () => {
  const mesma = rotaEscritorio(seat(2, 0), seat(8.9, 0), AIS, CL, CR);
  assert.deepEqual(mesma, [[2, 0.85 + 0.9], [2, 0.85], [8.9, 0.85], [8.9, 0.85 + 0.9]]);
  const outra = rotaEscritorio(seat(2, 0), seat(4.3, 2), AIS, CL, CR);
  ortogonal(outra);
  assert.ok(outra.some((p) => p[0] === CL), "quem está à esquerda usa o corredor da esquerda (mais curto)");
  const longe = rotaEscritorio(seat(11.2, 0), seat(11.2, 2), AIS, CL, CR);
  assert.ok(longe.some((p) => p[0] === CR), "quem está à direita usa o corredor da direita");
  // nunca atravessa o meio das mesas fora dos corredores de trás: todo trecho horizontal fica num corredor de fileira ou numa linha de lugar
  for (const p of outra) assert.ok(p[0]! >= CL && p[0]! <= CR);
});

test("rota até o elevador: termina na frente da porta, no corredor da esquerda; da copa passa por um corredor de fileira", () => {
  const dMesa = rotaEscritorio(seat(6.6, 1), frente, AIS, CL, CR);
  assert.deepEqual(dMesa[dMesa.length - 1], [CL, 7.2]);
  ortogonal(dMesa);
  const dCopa = rotaEscritorio(copa(18, 8.8), frente, AIS, CL, CR);
  assert.deepEqual(dCopa[dCopa.length - 1], [CL, 7.2]);
  ortogonal(dCopa);
  assert.ok(dCopa.some((p) => p[0] === CR) && dCopa.some((p) => AIS.includes(p[1]!) && p[0] === CL));
  // elevador → mesa é o inverso
  assert.deepEqual(rotaEscritorio(frente, seat(6.6, 1), AIS, CL, CR), dMesa.slice().reverse());
});

test("trajeto: comprimento somado e posição pela distância percorrida (limitada às pontas)", () => {
  const t = trajeto([[0, 0], [4, 0], [4, 3]]);
  assert.equal(t.len, 7);
  assert.deepEqual(t.at(0), [0, 0]);
  assert.deepEqual(t.at(2), [2, 0]);
  assert.deepEqual(t.at(5.5), [4, 1.5]);
  assert.deepEqual(t.at(99), [4, 3]);
  assert.deepEqual(t.at(-5), [0, 0]);
  assert.equal(trajeto([[1, 1], [1, 1]]).len, 0);
});

test("mudouSentado: só quem trocou entre mesa e copa; primeira foto e bots novos não andam", () => {
  const ant = { A: false, B: true, C: true, D: false };
  const agora = { A: true, B: false, C: true, D: false, E: true };
  assert.deepEqual(mudouSentado(ant, agora), [{ nome: "A", para: "mesa" }, { nome: "B", para: "copa" }]);
  assert.deepEqual(mudouSentado(null, agora), []);
  assert.deepEqual(mudouSentado(ant, {}), []);
});

test("painel embute as funções puras da caminhada e usa a mesma regra de quem senta", () => {
  for (const s of ["var rotaEscritorio=function rotaEscritorio(", "var trajeto=function trajeto(", "var mudouSentado=function mudouSentado(", "sentaNaMesa(stt(n))"])
    assert.ok(html.includes(s), "faltou " + s);
});

const bloco = html.slice(html.indexOf("// ---- caminhada:"), html.indexOf("// ---- painéis ----"));

test("1 · mudança de status: quem sai da copa vai andando até a cadeira (e volta); o bot de verdade some enquanto o boneco anda", () => {
  assert.ok(bloco.length > 3000);
  for (const s of [
    "function marcaMov(",
    "function iniciaMov(",
    "geo.copaP[m.nome]:geo.seat[m.nome]", // origem: copa→mesa usa o lugar da copa; mesa→copa usa a cadeira
    "geo.seat[m.nome]:geo.copaP[m.nome]", // destino
    "ocultos:[m.nome]",
    "mudouSentado(sentAnt,agora)",
  ])
    assert.ok(bloco.includes(s), "faltou " + s);
  // a cena guarda as cadeiras (mesa) e os lugares da copa de cada bot, e a camada onde o boneco anda fica abaixo dos rótulos
  assert.ok(html.includes("seat[nome]={x:x,y:sy+.05,ay:sy-.85,z:.7}"));
  assert.ok(html.includes("copaP[nn]={x:x,y:y,z:COPA_Z[L[0]]}"));
  assert.ok(html.indexOf("var wl=sv('g',{class:'passante'},mov),bl=sv('g',null,mov)") > 0);
  // sem animar a 1ª carga nem trocas de andar
  assert.ok(html.includes("if(sentAnt&&geo&&aba==='mapa'&&!RM.matches)"));
  assert.ok(html.includes("if(velho)pendMov=[];else iniciaMov();"));
  assert.ok(html.includes("marcaMov();var a=assinatura(s);"));
});

test("2 · passagem no mesmo andar: anda até o lado de quem recebe, entrega e volta; a linha com a tarefa continua", () => {
  assert.ok(bloco.includes("if(A&&B){var S=ladoDe(B,A.x>B.x?1:-1)"));
  assert.ok(bloco.includes("anda(reverso(ida),{zS:0,zE:A.z})"));
  assert.ok(bloco.includes("papel:1"));
  // a linha animada (linhaHo) continua sendo desenhada e fica na tela enquanto o boneco anda
  assert.ok(html.includes("function linhaHo(") && html.includes("class:'fluxo'"));
  assert.ok(bloco.includes("a.ate=Math.max(a.ate,Date.now()+total+800)"));
  assert.ok(html.includes("filaPass.push({h:h,t:Date.now()})"));
});

test("3 · passagem para outro andar: anda até o elevador, portas abrem, entra, portas fecham; ▲/▼ e o andar continuam acesos", () => {
  // saída: caminha até a frente da porta com as portas abrindo no fim, entra (some), portas fecham
  assert.ok(bloco.includes("anda(r1,{zS:A.z,zE:0,papel:1,po:[0,1,.55,1]})"));
  assert.ok(bloco.includes("po:[1,0]"), "portas fecham");
  // chegada no outro andar: sai do elevador, vai até quem recebe e volta ao elevador
  assert.ok(bloco.includes("var S2=ladoDe(B,B.x>2.6?-1:1)"));
  assert.ok(bloco.includes("anda(reverso(r2),{zS:0,zE:0,po:[0,1,.55,1]})"));
  // seta e número do andar: o planejador usa o mesmo elevSeta e cada quadro acende o painel
  assert.ok(bloco.includes("elevSeta(andarSel,bot(h.to).team||SEM,ordem)") && bloco.includes("elevSeta(bot(h.from).team||SEM,andarSel,ordem)"));
  assert.ok(bloco.includes("elevPoe(elevCtl,a.ix.dir,a.ix.andar,true)"));
  // depois do fim da caminhada as portas ficam fechadas e a seta segue acesa até a linha sumir
  assert.ok(bloco.includes("if(a.ix){elevCtl=0;if(geo)desenhaHandoffs();}"));
  assert.ok(html.includes("if(!ativos.length&&!atores.some(function(x){return x.ix;}))elevCtl=null;"));
  // enquanto a caminhada não chega, as portas ficam fechadas (a seta já está acesa); com movimento reduzido tudo segue como antes
  assert.ok(html.includes("if(cross&&!RM.matches&&elevCtl===null)elevCtl=0;"));
  // elevPoe respeita o valor das portas vindo da caminhada
  const poe = html.slice(html.indexOf("function elevPoe("), html.indexOf("function novasPassagens("));
  assert.ok(poe.includes("if(elevCtl!==null)o=elevCtl;"));
  // o desenho da passagem para outro andar segue igual (elevador.test.ts)
  assert.ok(html.includes("if(cross)elevPoe(1,cross.dir,cross.andar,true);else elevPoe(0,null,0,true);"));
});

test("desempenho: a caminhada só mexe em transform/opacity, com requestAnimationFrame, sem filtro e sem animação CSS", () => {
  assert.ok(bloco.includes("requestAnimationFrame(quadro)"));
  assert.ok(!/'filter'|filter:|url\(#|drop-shadow/.test(bloco), "nada de filtro SVG/CSS na caminhada (Array.filter não conta)");
  assert.ok(!/\.animate\(|@keyframes|animation/.test(bloco), "nada de animação CSS/WAAPI na caminhada");
  const des = bloco.slice(bloco.indexOf("function desenhaAtor("), bloco.indexOf("function limpaAtor("));
  assert.ok(des.length > 800);
  for (const m of des.match(/setAttribute\('([a-z-]+)'/g) ?? []) assert.ok(/'(transform|opacity|display|x|y)'/.test(m), "atributo fora da regra: " + m);
  // sombra do boneco anda por transform (não por cy) e o boneco de verdade some só por opacity
  assert.ok(des.includes("a.sh.setAttribute('transform','translate(0 '"));
  assert.ok(des.includes("e.style.transition='none';e.style.opacity="));
  // o elevador continua sem CSS próprio
  const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  assert.doesNotMatch(css, /(?:elevador|porta-elev|painel-elev|luz-elev|seta-sobe|seta-desce|walker|passante\{[^}]*animation)/);
});

test("movimento reduzido: ninguém caminha (nem troca de status nem passagem) e o rAF não roda à toa", () => {
  assert.ok(bloco.includes("function planejarPass(h){if(RM.matches||!geo)return null;"));
  assert.ok(bloco.includes("function iniciaMov(){var pm=pendMov;pendMov=[];if(RM.matches||!geo)return;"));
  assert.ok(html.includes("if(novas.length&&!RM.matches)agenda();"));
  assert.ok(bloco.includes("if(atores.length||filaPass.length)agenda();"), "o laço para quando não há ninguém andando");
  // trocar de andar ou de aba cancela quem está andando e devolve o bot de verdade
  assert.ok(bloco.includes("if(!geo||aba!=='mapa'||geo.andar!==a.andar){limpaAtor(a);return false;}"));
  assert.ok(bloco.includes("e.style.opacity='';e.style.transition='';"));
});
