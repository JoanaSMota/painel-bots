// Passagem de tarefa entre bots (type "handoff"): validação, lista curta que expira,
// aparece no /api/state, não vai para o arquivo e não muda os tipos antigos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { createApp } from "../src/server.js";
import { Store, HANDOFF_MAX, HANDOFF_TTL_MS } from "../src/store.js";
import { parseMessage, ValidationError } from "../src/validate.js";
import { panelPage } from "../src/page.js";

const TOKEN = "teste-" + "h".repeat(40);
let server: http.Server;
let base = "";
let dir = "";

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "painel-handoff-"));
  server = createApp({ token: TOKEN, store: await Store.open(dir), log: () => {} });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const ingest = (body: unknown) => fetch(`${base}/ingest`, { method: "POST", headers: auth, body: JSON.stringify(body) });
async function state() {
  const r = await fetch(`${base}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(r.status, 200);
  return (await r.json()) as any;
}

test("handoff válido: 200 com id, aparece no /api/state (mais novo primeiro)", async () => {
  let r = await ingest({ type: "handoff", from: "CEO ANA", to: "COO ANA", task: "Revisar a proposta do cliente" });
  assert.equal(r.status, 200);
  const j1 = (await r.json()) as any;
  assert.equal(j1.ok, true);
  assert.equal(j1.type, "handoff");
  assert.match(j1.id, /^[0-9a-f-]{36}$/);
  r = await ingest({ type: "handoff", from: "COO ANA", to: "Donna" });
  assert.equal(r.status, 200);
  const j2 = (await r.json()) as any;
  assert.notEqual(j2.id, j1.id);
  const s = await state();
  assert.equal(s.handoffs.length, 2);
  assert.deepEqual(
    { from: s.handoffs[0].from, to: s.handoffs[0].to, task: s.handoffs[0].task, id: s.handoffs[0].id },
    { from: "COO ANA", to: "Donna", task: "", id: j2.id },
  );
  assert.equal(s.handoffs[1].task, "Revisar a proposta do cliente");
  assert.ok(!Number.isNaN(Date.parse(s.handoffs[1].at)));
});

test("handoff: task >80 é cortada e avisada; controles viram espaço", async () => {
  const r = await ingest({ type: "handoff", from: "A", to: "B", task: "linha\n" + "x".repeat(200) });
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as any).task_truncated, true);
  const t = (await state()).handoffs[0].task as string;
  assert.equal(Array.from(t).length, 80);
  assert.ok(t.startsWith("linha x"));
  assert.ok(t.endsWith("…"));
});

test("handoff inválido → 400 com mensagem", async () => {
  for (const body of [
    { type: "handoff", to: "B", task: "t" },
    { type: "handoff", from: "A", task: "t" },
    { type: "handoff", from: "", to: "B" },
    { type: "handoff", from: "A", to: "A" },
    { type: "handoff", from: " A ", to: "A" },
    { type: "handoff", from: 3, to: "B" },
    { type: "handoff", from: "A", to: "B", task: 5 },
    { type: "handoff", from: "A", to: "B", extra: 1 },
    { type: "handoff", from: "x".repeat(61), to: "B" },
    { type: "handoff", from: "A\u0007", to: "B" },
    { type: "passagem", from: "A", to: "B" },
  ]) {
    const r = await ingest(body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
    assert.ok(((await r.json()) as any).error);
  }
  assert.throws(() => parseMessage({ type: "handoff", from: "A", to: "A" }), ValidationError);
});

test("handoff não cria bot nem mexe em status, feed ou roster", async () => {
  const s = await state();
  assert.equal(s.bots["CEO ANA"], undefined);
  assert.equal(s.bots["Donna"], undefined);
  assert.deepEqual(s.feed, []);
  assert.equal(s.roster, null);
});

test("store guarda no máximo HANDOFF_MAX e expira depois de HANDOFF_TTL_MS", () => {
  const st = new Store();
  const t0 = new Date("2026-11-03T12:00:00Z");
  for (let i = 0; i < HANDOFF_MAX + 5; i++)
    st.apply({ type: "handoff", from: "A", to: "B", task: `t${i}`, task_truncated: false }, new Date(t0.getTime() + i * 1000));
  assert.equal(st.state.handoffs.length, HANDOFF_MAX);
  assert.equal(st.state.handoffs[0]!.task, `t${HANDOFF_MAX + 4}`);
  assert.equal(new Set(st.state.handoffs.map((h) => h.id)).size, HANDOFF_MAX);
  // 1 s antes de expirar a mais nova: só ela fica (as outras são mais velhas)
  st.pruneHandoffs(new Date(t0.getTime() + (HANDOFF_MAX + 4) * 1000 + HANDOFF_TTL_MS - 500));
  assert.equal(st.state.handoffs.length, 1);
  st.pruneHandoffs(new Date(t0.getTime() + (HANDOFF_MAX + 4) * 1000 + HANDOFF_TTL_MS + 1));
  assert.equal(st.state.handoffs.length, 0);
  // passagem nova também limpa as vencidas
  st.apply({ type: "handoff", from: "A", to: "B", task: "velha", task_truncated: false }, t0);
  st.apply({ type: "handoff", from: "A", to: "B", task: "nova", task_truncated: false }, new Date(t0.getTime() + HANDOFF_TTL_MS + 1000));
  assert.deepEqual(st.state.handoffs.map((h) => h.task), ["nova"]);
});

test("passagens não vão para o arquivo; arquivo antigo (sem handoffs) abre normal", async () => {
  const saved = JSON.parse(await readFile(path.join(dir, "state.json"), "utf8"));
  assert.deepEqual(saved.handoffs, []);
  const reaberto = await Store.open(dir);
  assert.deepEqual(reaberto.state.handoffs, []);
  const d2 = await mkdtemp(path.join(tmpdir(), "painel-antigo-"));
  try {
    await writeFile(
      path.join(d2, "state.json"),
      JSON.stringify({ version: 1, bots: { Donna: { status: "idle" } }, roster: null, usage: null, updated_at: null, feed: [], avatars: {} }),
    );
    const antigo = await Store.open(d2);
    assert.equal(antigo.state.bots["Donna"]?.status, "idle");
    assert.deepEqual(antigo.state.handoffs, []);
    antigo.apply({ type: "handoff", from: "Donna", to: "CFO", task: "x", task_truncated: false });
    assert.equal(antigo.state.handoffs.length, 1);
  } finally {
    await rm(d2, { recursive: true, force: true });
  }
});

test("status continua igual (step cortado em 80 com …)", () => {
  const m = parseMessage({ type: "status", bot: "Donna", status: "working", step: "a\tb" + "c".repeat(100) });
  assert.equal(m.type, "status");
  if (m.type !== "status") return;
  assert.equal(m.step_truncated, true);
  assert.equal(Array.from(m.step).length, 80);
  assert.ok(m.step.startsWith("a b"));
  const m2 = parseMessage({ type: "status", bot: "Donna", status: "idle" });
  assert.deepEqual(m2, { type: "status", bot: "Donna", status: "idle", step: "", step_truncated: false });
});

test("painel tem a animação de passagem (fila, elevador, movimento reduzido) e não anima as antigas", () => {
  const html = panelPage("n");
  for (const s of ["handoffs", "filaPass", "elevador", "vistos", "RM.matches"]) assert.ok(html.includes(s), "faltou " + s);
});
