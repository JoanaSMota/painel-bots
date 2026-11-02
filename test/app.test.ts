import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { createApp } from "../src/server.js";
import { Store } from "../src/store.js";

const TOKEN = "teste-" + "x".repeat(40);
const SEGREDO_CLIENTE = "Cliente Fulano CPF 123.456.789-00";
let server: http.Server;
let base = "";
let dir = "";
const logs: string[] = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "painel-"));
  const store = await Store.open(dir);
  server = createApp({ token: TOKEN, store, log: (l) => logs.push(l) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
function ingest(body: unknown, headers: Record<string, string> = auth) {
  return fetch(`${base}/ingest`, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}
async function state() {
  const r = await fetch(`${base}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(r.status, 200);
  return (await r.json()) as any;
}

test("health é público e só retorna {ok:true}", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});

test("ingest sem chave, chave errada ou só cookie → 401", async () => {
  assert.equal((await ingest({ type: "roster", names: ["a"] }, { "Content-Type": "application/json" })).status, 401);
  assert.equal((await ingest({ type: "roster", names: ["a"] }, { ...auth, Authorization: "Bearer errada" })).status, 401);
  assert.equal((await ingest({ type: "roster", names: ["a"] }, { ...auth, Authorization: `Basic ${TOKEN}` })).status, 401);
});

test("status válido e step >80 é truncado", async () => {
  let r = await ingest({ type: "status", bot: "Donna", status: "working", step: SEGREDO_CLIENTE });
  assert.equal(r.status, 200);
  const longo = "a".repeat(200);
  r = await ingest({ type: "status", bot: "Grok Bot", status: "idle", step: longo });
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as any).step_truncated, true);
  const s = await state();
  assert.equal(Array.from(s.bots["Grok Bot"].step as string).length, 80);
  assert.equal(s.bots["Donna"].status, "working");
});

test("status inválido → 400", async () => {
  for (const body of [
    { type: "status", bot: "Donna", status: "dormindo" },
    { type: "status", status: "idle" },
    { type: "status", bot: "Donna", status: "idle", step: 5 },
    { type: "status", bot: "Donna", status: "idle", extra: 1 },
    { type: "status", bot: "x".repeat(61), status: "idle" },
  ]) {
    const r = await ingest(body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
    assert.ok(((await r.json()) as any).error);
  }
});

test("routines válido e inválido", async () => {
  let r = await ingest({ type: "routines", bot: "Donna", items: [{ name: "Briefing", schedule: "dias úteis 8h", next_run: "2026-11-03T08:00:00-03:00" }] });
  assert.equal(r.status, 200);
  assert.equal((await state()).bots["Donna"].routines[0].next_run, "2026-11-03T11:00:00.000Z");
  r = await ingest({ type: "routines", bot: "Donna", items: [{ name: "x", schedule: "y", next_run: "amanhã" }] });
  assert.equal(r.status, 400);
  r = await ingest({ type: "routines", bot: "Donna", items: "nada" });
  assert.equal(r.status, 400);
});

test("roster válido e inválido", async () => {
  assert.equal((await ingest({ type: "roster", names: ["Donna", "Grok Bot", "Donna"] })).status, 200);
  assert.deepEqual((await state()).roster, ["Donna", "Grok Bot"]);
  assert.equal((await ingest({ type: "roster", names: "Donna" })).status, 400);
  assert.equal((await ingest({ type: "roster", names: [""] })).status, 400);
});

test("looks válido e cor hex inválida", async () => {
  assert.equal((await ingest({ type: "looks", bots: { Donna: { shape: "star", color: "#FF8800", accessory: "óculos" } } })).status, 200);
  assert.equal((await state()).bots["Donna"].look.color, "#ff8800");
  assert.equal((await ingest({ type: "looks", bots: { Donna: { shape: "star", color: "laranja" } } })).status, 400);
  assert.equal((await ingest({ type: "looks", bots: { Donna: { shape: "<script>", color: "#fff" } } })).status, 400);
});

test("groups válido e inválido", async () => {
  assert.equal((await ingest({ type: "groups", bots: { Donna: "Operação", "Grok Bot": "Dev" } })).status, 200);
  assert.equal((await state()).bots["Grok Bot"].team, "Dev");
  assert.equal((await ingest({ type: "groups", bots: { Donna: 3 } })).status, 400);
  assert.equal((await ingest({ type: "groups", bots: {} })).status, 400);
});

test("chat valida prefixo grokbot://", async () => {
  assert.equal((await ingest({ type: "chat", bots: { Donna: "grokbot://app/v1/agent?id=69391a3f-5d47-42af-9e3b-f26f6912a082" } })).status, 200);
  assert.equal((await ingest({ type: "chat", bots: { Donna: "javascript:alert(1)" } })).status, 400);
  assert.equal((await ingest({ type: "chat", bots: { Donna: "grokbot://app/v1/agent?id=a&x=<b>" } })).status, 400);
});

test("usage válido e inválido", async () => {
  assert.equal((await ingest({ type: "usage", total_used_pct: 42.5, resets_at: "2026-11-09T00:00:00-03:00", bots: { Donna: 10, "Grok Bot": 30 } })).status, 200);
  assert.equal((await state()).usage.total_used_pct, 42.5);
  assert.equal((await ingest({ type: "usage", total_used_pct: 150, resets_at: "2026-11-09T00:00:00Z" })).status, 400);
  assert.equal((await ingest({ type: "usage", total_used_pct: "10", resets_at: "2026-11-09T00:00:00Z" })).status, 400);
  assert.equal((await ingest({ type: "usage", total_used_pct: 10, resets_at: "semana que vem" })).status, 400);
});

test("tipo desconhecido, JSON quebrado, content-type errado, corpo >64KB", async () => {
  assert.equal((await ingest({ type: "outro" })).status, 400);
  assert.equal((await ingest("{quebrado")).status, 400);
  assert.equal((await ingest({ type: "roster", names: [] }, { ...auth, "Content-Type": "text/plain" })).status, 415);
  const big = JSON.stringify({ type: "roster", names: ["a"], pad: "x".repeat(70 * 1024) });
  assert.equal((await ingest(big)).status, 413);
});

test("painel e /api/state sem chave não vazam dado", async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /chave de acesso/);
  for (const s of ["Donna", "Grok Bot", "CPF", SEGREDO_CLIENTE, "grokbot://", "Operação"]) assert.ok(!html.includes(s), `vazou ${s}`);
  const a = await fetch(`${base}/api/state`);
  assert.equal(a.status, 401);
  assert.ok(!(await a.text()).includes("Donna"));
  const c = await fetch(`${base}/api/state`, { headers: { Cookie: "painel_sess=falso" } });
  assert.equal(c.status, 401);
});

test("login por chave grava cookie seguro e libera o painel", async () => {
  const bad = await fetch(`${base}/login`, { method: "POST", body: new URLSearchParams({ chave: "errada" }), redirect: "manual" });
  assert.equal(bad.status, 401);
  const ok = await fetch(`${base}/login`, { method: "POST", body: new URLSearchParams({ chave: TOKEN }), redirect: "manual" });
  assert.equal(ok.status, 303);
  const sc = ok.headers.get("set-cookie") ?? "";
  for (const f of ["HttpOnly", "Secure", "SameSite=Strict"]) assert.ok(sc.includes(f), f);
  assert.ok(!sc.includes(TOKEN), "cookie não pode conter a chave");
  const cookie = sc.split(";")[0]!;
  const p = await fetch(`${base}/`, { headers: { Cookie: cookie } });
  assert.match(await p.text(), /\/api\/state/);
  const s = await fetch(`${base}/api/state`, { headers: { Cookie: cookie } });
  assert.equal(s.status, 200);
  // cookie não serve para /ingest
  assert.equal((await ingest({ type: "roster", names: ["a"] }, { "Content-Type": "application/json", Cookie: cookie })).status, 401);
});

test("persistência em arquivo e logs sem corpo/step/token", async () => {
  const saved = JSON.parse(await readFile(path.join(dir, "state.json"), "utf8"));
  assert.equal(saved.bots["Donna"].team, "Operação");
  const reaberto = await Store.open(dir);
  assert.equal(reaberto.state.bots["Donna"]?.status, "working");
  const all = logs.join("\n");
  for (const s of [TOKEN, SEGREDO_CLIENTE, "CPF", "aaaaaaaa"]) assert.ok(!all.includes(s), `log vazou ${s.slice(0, 10)}`);
  assert.ok(logs.every((l) => /^[A-Z]+ \S+ \d{3}$/.test(l)), "formato de log");
});

test("memória quando DATA_DIR não definido", async () => {
  const s = await Store.open(undefined);
  assert.equal(s.mode, "memória");
  await s.persist();
});
