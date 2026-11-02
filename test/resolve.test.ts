// Testes do botão "Resolvido": POST /api/resolve só com cookie e mesma origem.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { createApp } from "../src/server.js";
import { RESOLVED_STEP, Store } from "../src/store.js";
import { panelPage } from "../src/page.js";

const TOKEN = "teste-" + "z".repeat(40);
let server: http.Server;
let base = "";
let dir = "";
let cookie = "";
const logs: string[] = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "painel-resolve-"));
  server = createApp({ token: TOKEN, store: await Store.open(dir), log: (l) => logs.push(l) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const ok = await fetch(`${base}/login`, { method: "POST", body: new URLSearchParams({ chave: TOKEN }), redirect: "manual" });
  cookie = (ok.headers.get("set-cookie") ?? "").split(";")[0]!;
  const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  for (const [bot, status] of [["Grok Bot", "waiting_user"], ["Donna", "working"]])
    await fetch(`${base}/ingest`, { method: "POST", headers: auth, body: JSON.stringify({ type: "status", bot, status, step: "Aguardando Lucas: aprovar cortes" }) });
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

function resolve(body: unknown, headers: Record<string, string>) {
  return fetch(`${base}/api/resolve`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}
const ok = () => ({ Cookie: cookie, Origin: base });
async function state() {
  const r = await fetch(`${base}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return (await r.json()) as any;
}

test("sem cookie, cookie falso ou só Bearer → 401 e nada muda", async () => {
  assert.equal((await resolve({ bot: "Grok Bot" }, { Origin: base })).status, 401);
  assert.equal((await resolve({ bot: "Grok Bot" }, { Origin: base, Cookie: "painel_sess=falso" })).status, 401);
  assert.equal((await resolve({ bot: "Grok Bot" }, { Origin: base, Authorization: `Bearer ${TOKEN}` })).status, 401);
  assert.equal((await state()).bots["Grok Bot"].status, "waiting_user");
});

test("origem errada ou ausente → 403 e nada muda", async () => {
  for (const o of ["https://evil.example", "http://127.0.0.1:1", "null"])
    assert.equal((await resolve({ bot: "Grok Bot" }, { Cookie: cookie, Origin: o })).status, 403, o);
  assert.equal((await resolve({ bot: "Grok Bot" }, { Cookie: cookie })).status, 403, "sem Origin");
  assert.equal((await state()).bots["Grok Bot"].status, "waiting_user");
});

test("bot desconhecido → 404; corpo inválido → 400/415; GET → 405", async () => {
  assert.equal((await resolve({ bot: "Ninguém" }, ok())).status, 404);
  assert.equal((await resolve({ bot: "" }, ok())).status, 400);
  assert.equal((await resolve({ bot: "Grok Bot", status: "done" }, ok())).status, 400);
  assert.equal((await resolve(["Grok Bot"], ok())).status, 400);
  const tp = await fetch(`${base}/api/resolve`, { method: "POST", headers: { ...ok(), "Content-Type": "text/plain" }, body: "{}" });
  assert.equal(tp.status, 415);
  assert.equal((await fetch(`${base}/api/resolve`, { headers: ok() })).status, 405);
});

test("bot que não está esperando → 409 e status preservado", async () => {
  assert.equal((await resolve({ bot: "Donna" }, ok())).status, 409);
  assert.equal((await state()).bots["Donna"].status, "working");
});

test("200: resolve, põe em idle, registra na Atividade e persiste", async () => {
  const r = await resolve({ bot: "Grok Bot" }, ok());
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, bot: "Grok Bot", status: "idle" });
  const s = await state();
  assert.equal(s.bots["Grok Bot"].status, "idle");
  assert.equal(s.bots["Grok Bot"].step, RESOLVED_STEP);
  assert.equal(s.bots["Grok Bot"].recent[0].step, "Resolvido pelo Lucas no painel");
  assert.deepEqual({ bot: s.feed[0].bot, status: s.feed[0].status, step: s.feed[0].step }, { bot: "Grok Bot", status: "idle", step: RESOLVED_STEP });
  const saved = JSON.parse(await readFile(path.join(dir, "state.json"), "utf8"));
  assert.equal(saved.bots["Grok Bot"].status, "idle");
  // segunda vez: já não está esperando
  assert.equal((await resolve({ bot: "Grok Bot" }, ok())).status, 409);
});

test("X-Forwarded-Host do proxy vale como origem; logs sem nome do bot", async () => {
  await fetch(`${base}/ingest`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "status", bot: "Donna", status: "waiting_user" }) });
  const r = await resolve({ bot: "Donna" }, { Cookie: cookie, Origin: "https://painel.exemplo", "X-Forwarded-Host": "painel.exemplo" });
  assert.equal(r.status, 200);
  assert.ok(logs.includes("POST /api/resolve 200"));
  assert.ok(!logs.join("\n").includes("Donna"));
});

test("painel tem o botão Resolvido só para waiting_user", () => {
  const html = panelPage("n");
  assert.ok(html.includes("'/api/resolve'"));
  assert.ok(html.includes("if(s==='waiting_user')cab.appendChild(botaoResolver(botSel))"));
  assert.ok(html.includes("✓ Resolvido"));
});
