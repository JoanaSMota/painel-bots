// Testes do frescor do status: "atualizado há X" e selo "pode estar desatualizado".
import { test } from "node:test";
import assert from "node:assert/strict";
import { frescor } from "../src/frescor.js";
import { panelPage } from "../src/page.js";

const AGORA = Date.parse("2026-11-02T18:00:00Z");
const antes = (min: number) => new Date(AGORA - min * 60_000).toISOString();

test("texto em minutos, horas e dias", () => {
  assert.equal(frescor(antes(0.5), "working", AGORA).texto, "atualizado agora");
  assert.equal(frescor(antes(5), "working", AGORA).texto, "atualizado há 5 min");
  assert.equal(frescor(antes(59), "idle", AGORA).texto, "atualizado há 59 min");
  assert.equal(frescor(antes(61), "idle", AGORA).texto, "atualizado há 1 h");
  assert.equal(frescor(antes(47 * 60), "done", AGORA).texto, "atualizado há 47 h");
  assert.equal(frescor(antes(72 * 60), "done", AGORA).texto, "atualizado há 3 dias");
  // relógio do cliente atrasado não gera tempo negativo
  assert.equal(frescor(antes(-3), "working", AGORA).texto, "atualizado agora");
});

test("sem timestamp ou timestamp inválido", () => {
  for (const v of [undefined, null, "", "ontem"]) {
    const f = frescor(v as string | undefined, "waiting_user", AGORA);
    assert.equal(f.texto, "sem atualização registrada");
    assert.equal(f.velho, false);
  }
});

test("selo só para waiting_user há mais de 30 min", () => {
  assert.equal(frescor(antes(30), "waiting_user", AGORA).velho, false);
  assert.equal(frescor(antes(31), "waiting_user", AGORA).velho, true);
  assert.equal(frescor(antes(300), "waiting_user", AGORA).velho, true);
  for (const s of ["working", "idle", "done", "error", undefined]) assert.equal(frescor(antes(300), s, AGORA).velho, false);
});

test("painel embute o frescor e o selo", () => {
  const html = panelPage("n");
  assert.match(html, /var frescor=function frescor\(/);
  assert.ok(html.includes("pode estar desatualizado"));
  assert.ok(html.includes(".selo-velho"));
  assert.ok(html.includes("'fresco'"));
});
