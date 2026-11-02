// Testes das adições do visual "escritório": looks do app, floors, histórico, /avatar.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { createApp } from "../src/server.js";
import { Store, RECENT_MAX, FEED_MAX } from "../src/store.js";
import { floorOrder } from "../src/floors.js";

const TOKEN = "teste-" + "y".repeat(40);
let server: http.Server;
let base = "";
let dir = "";
const logs: string[] = [];
// PNG 1x1 válido
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082",
  "hex",
);

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "painel-novo-"));
  server = createApp({ token: TOKEN, store: await Store.open(dir), log: (l) => logs.push(l) });
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
async function cookie() {
  const ok = await fetch(`${base}/login`, { method: "POST", body: new URLSearchParams({ chave: TOKEN }), redirect: "manual" });
  return (ok.headers.get("set-cookie") ?? "").split(";")[0]!;
}

test("looks aceita formas e cores nomeadas do app, e os formatos antigos", async () => {
  const shapes = ["blob", "squircle", "tablet", "pebble", "hex", "star", "flower", "house", "cloud", "pill", "circle", "hexagon"];
  const colors = ["violet", "blue", "cyan", "green", "orange", "red", "black", "gray", "#123456", "#abc"];
  const bots: Record<string, unknown> = {};
  shapes.forEach((s, i) => (bots[`B${i}`] = { shape: s, color: colors[i % colors.length], accessory: "none" }));
  assert.equal((await ingest({ type: "looks", bots })).status, 200);
  assert.equal((await ingest({ type: "looks", bots: { Cinza: { shape: "blob", color: "GREY" } } })).status, 200);
  const s = await state();
  assert.equal(s.bots["B2"].look.shape, "tablet");
  assert.equal(s.bots["B0"].look.color, "violet");
  assert.equal(s.bots["Cinza"].look.color, "gray");
  assert.equal(s.bots["B8"].look.color, "#123456");
  for (const color of ["laranja", "purple", "#12", "url(x)"])
    assert.equal((await ingest({ type: "looks", bots: { X: { shape: "blob", color } } })).status, 400, color);
});

test("groups com floors opcional; sem floors continua igual", async () => {
  assert.equal((await ingest({ type: "groups", bots: { A1: "ANA", P1: "Personal" } })).status, 200);
  assert.equal((await state()).floors, null);
  const r = await ingest({ type: "groups", bots: { A1: "ANA", P1: "Personal" }, floors: ["ANA", "Personal", "Research", "Tech", "Ops"] });
  assert.equal(r.status, 200);
  assert.deepEqual((await state()).floors, ["ANA", "Personal", "Research", "Tech", "Ops"]);
  for (const floors of ["ANA", [1], [""], Array.from({ length: 51 }, (_, i) => `T${i}`)])
    assert.equal((await ingest({ type: "groups", bots: { A1: "ANA" }, floors })).status, 400, JSON.stringify(floors).slice(0, 30));
});

test("ordem dos andares: compatível sem floors; com floors segue a lista, outros depois, 'Sem time' por último", () => {
  const teams = ["Tech", "Sem time", "ANA", "Ops", "Personal", "Zeta", "Alfa"];
  assert.deepEqual(floorOrder(teams, null), ["Alfa", "ANA", "Ops", "Personal", "Tech", "Zeta", "Sem time"]);
  assert.deepEqual(floorOrder(teams, undefined), floorOrder(teams, []));
  assert.deepEqual(floorOrder(teams, ["ANA", "Personal", "Research", "Tech", "Ops", "Sem time"]), [
    "ANA", "Personal", "Tech", "Ops", "Alfa", "Zeta", "Sem time",
  ]);
});

test("histórico: últimos 10 passos por bot e feed global de 50, sem mudar o post", async () => {
  for (let i = 0; i < 12; i++) {
    const r = await ingest({ type: "status", bot: "Hist", status: i === 11 ? "done" : "working", step: `passo ${i}` });
    assert.deepEqual(await r.json(), { ok: true, type: "status" });
  }
  await ingest({ type: "status", bot: "Hist", status: "done", step: "passo 11" }); // repetido não duplica
  let s = await state();
  assert.equal(s.bots["Hist"].recent.length, RECENT_MAX);
  assert.equal(s.bots["Hist"].recent[0].step, "passo 11");
  assert.equal(s.bots["Hist"].recent[0].status, "done");
  assert.equal(s.feed[0].bot, "Hist");
  for (let i = 0; i < 60; i++) await ingest({ type: "status", bot: `F${i % 7}`, status: "idle", step: `f ${i}` });
  s = await state();
  assert.equal(s.feed.length, FEED_MAX);
  assert.equal(s.feed[0].step, "f 59");
});

test("POST /avatar: só Bearer, só PNG, até 512 KB, nome do bot em ?bot= ou X-Bot", async () => {
  const post = (q: string, headers: Record<string, string>, body: Buffer = PNG) =>
    fetch(`${base}/avatar${q}`, { method: "POST", headers, body: new Uint8Array(body) });
  const png = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "image/png" };
  assert.equal((await post("?bot=Donna", { "Content-Type": "image/png" })).status, 401);
  assert.equal((await post("?bot=Donna", { "Content-Type": "image/png", Cookie: await cookie() })).status, 401);
  assert.equal((await post("?bot=Donna", { ...png, Authorization: "Bearer errada" })).status, 401);
  assert.equal((await post("?bot=Donna", { ...png, "Content-Type": "image/jpeg" })).status, 415);
  assert.equal((await post("?bot=Donna", png, Buffer.from("não é png"))).status, 400);
  assert.equal((await post("", png)).status, 400);
  assert.equal((await post("?bot=" + "x".repeat(61), png)).status, 400);
  const grande = Buffer.concat([PNG, Buffer.alloc(512 * 1024)]);
  assert.equal((await post("?bot=Donna", png, grande)).status, 413);
  let r = await post("?bot=" + encodeURIComponent("Donna Secretária · administrativo"), png);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, bot: "Donna Secretária · administrativo", bytes: PNG.length });
  r = await post("", { ...png, "X-Bot": encodeURIComponent("Saúde Lucas") });
  assert.equal(r.status, 200);
  const s = await state();
  assert.ok(s.avatars["Saúde Lucas"]);
  assert.equal((await readdir(path.join(dir, "avatars"))).filter((f) => f.endsWith(".png")).length, 2);
});

test("GET /avatar/<bot>: protegido por cookie ou Bearer, nada público", async () => {
  const url = `${base}/avatar/${encodeURIComponent("Saúde Lucas")}`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: "Bearer errada" } })).status, 401);
  let r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.ok(Buffer.from(await r.arrayBuffer()).equals(PNG));
  r = await fetch(url, { headers: { Cookie: await cookie() } });
  assert.equal(r.status, 200);
  assert.equal((await fetch(`${base}/avatar/Ninguem`, { headers: { Authorization: `Bearer ${TOKEN}` } })).status, 404);
  assert.equal((await fetch(`${base}/avatar/%E0%A4%A`, { headers: { Authorization: `Bearer ${TOKEN}` } })).status, 404);
  // foto sobrevive a reabrir o store
  const reaberto = await Store.open(dir);
  assert.ok((await reaberto.getAvatar("Saúde Lucas"))?.equals(PNG));
});

test("avatar em memória quando DATA_DIR não definido", async () => {
  const s = await Store.open(undefined);
  await s.putAvatar("Mem", PNG);
  assert.ok((await s.getAvatar("Mem"))?.equals(PNG));
  assert.equal(await s.getAvatar("Outro"), null);
});

test("CSP libera só imagens do próprio site; logs não levam nome do bot", async () => {
  const r = await fetch(`${base}/`, { headers: { Cookie: await cookie() } });
  const csp = r.headers.get("content-security-policy") ?? "";
  assert.match(csp, /img-src 'self'/);
  assert.match(csp, /default-src 'none'/);
  const html = await r.text();
  assert.match(html, /floorOrder/);
  assert.ok(!html.includes("Saúde Lucas"), "HTML não embute dado de bot");
  const all = logs.join("\n");
  assert.ok(!all.includes("Sa%C3%BAde") && !all.includes("Saúde"), "log com nome do bot");
  assert.ok(all.includes("GET /avatar/:bot 200"));
  assert.ok(logs.every((l) => /^[A-Z]+ \S+ \d{3}$/.test(l)), "formato de log");
});
