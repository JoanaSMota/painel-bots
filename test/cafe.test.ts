// Café no sofá: quem vai (só idle há 10 min ou mais), limite de assentos, ordem por
// tempo ocioso, assento estável e exclusão de waiting_user/error. Mais o painel embutir a lógica.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sofaLugares } from "../src/cafe.js";
import { panelPage } from "../src/page.js";

const AGORA = Date.parse("2026-11-03T15:00:00Z");
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();
const b = (nome: string, status: string, min: number) => ({ nome, status, status_at: ha(min) });

test("limiar de 10 min: 9 min fica na mesa, 10 min vai pro sofá", () => {
  assert.deepEqual(sofaLugares([b("A", "idle", 9.9)], AGORA, 4, null), {});
  assert.deepEqual(sofaLugares([b("A", "idle", 10)], AGORA, 4, null), { A: 0 });
  assert.deepEqual(sofaLugares([b("A", "idle", 90)], AGORA, 4, {}), { A: 0 });
});

test("waiting_user, error, working, done e sem status nunca vão pro sofá", () => {
  const bots = [b("W", "waiting_user", 120), b("E", "error", 120), b("T", "working", 120), b("D", "done", 120), { nome: "N" }];
  assert.deepEqual(sofaLugares(bots, AGORA, 4, null), {});
  // mesmo que já estivessem sentados antes
  assert.deepEqual(sofaLugares(bots, AGORA, 4, { W: 0, E: 1, T: 2 }), {});
});

test("sem status_at ou data inválida: fica na mesa", () => {
  assert.deepEqual(sofaLugares([{ nome: "A", status: "idle" }, { nome: "B", status: "idle", status_at: "ontem" }], AGORA, 4, null), {});
});

test("assentos limitados: ficam os ociosos há mais tempo", () => {
  const bots = [b("A", "idle", 15), b("B", "idle", 60), b("C", "idle", 30), b("D", "idle", 45), b("E", "idle", 11), b("F", "idle", 200)];
  const r = sofaLugares(bots, AGORA, 4, null);
  assert.deepEqual(Object.keys(r).sort(), ["B", "C", "D", "F"]);
  // ordem de chegada = ordem dos assentos (mais antigo pega o 1º)
  assert.deepEqual(r, { F: 0, B: 1, D: 2, C: 3 });
  assert.deepEqual(sofaLugares(bots, AGORA, 0, null), {});
  assert.deepEqual(Object.keys(sofaLugares(bots, AGORA, 2, null)).sort(), ["B", "F"]);
});

test("quem já está sentado mantém o assento; quem chega pega o menor livre", () => {
  const r = sofaLugares([b("A", "idle", 20), b("B", "idle", 30), b("C", "idle", 40)], AGORA, 4, { A: 3, B: 0 });
  assert.deepEqual(r, { A: 3, B: 0, C: 1 });
  // assento repetido ou fora do limite é corrigido
  const r2 = sofaLugares([b("A", "idle", 20), b("B", "idle", 30)], AGORA, 2, { A: 1, B: 1 });
  assert.deepEqual(r2, { B: 1, A: 0 });
  assert.deepEqual(sofaLugares([b("A", "idle", 20)], AGORA, 2, { A: 7 }), { A: 0 });
});

test("quem sai de idle libera o lugar para o próximo da fila", () => {
  const antes = sofaLugares([b("A", "idle", 50), b("B", "idle", 40), b("C", "idle", 30)], AGORA, 2, null);
  assert.deepEqual(antes, { A: 0, B: 1 });
  const depois = sofaLugares([b("A", "working", 0), b("B", "idle", 40), b("C", "idle", 30)], AGORA, 2, antes);
  assert.deepEqual(depois, { B: 1, C: 0 });
});

test("empate no tempo ocioso: ordem pelo nome (estável)", () => {
  assert.deepEqual(sofaLugares([b("Zé", "idle", 20), b("Ana", "idle", 20)], AGORA, 1, null), { Ana: 0 });
});

test("painel embute a lógica do café (sofá, xícara com vapor, fila compartilhada com as passagens)", () => {
  const html = panelPage("n");
  for (const s of ["var sofaLugares=function sofaLugares", "atualizaCafe", "noSofa", "caneca", ".vapor", "pausa pro café", "planejaCafe", "filaPass"])
    assert.ok(html.includes(s), "faltou " + s);
});
