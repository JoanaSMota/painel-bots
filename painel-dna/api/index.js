"use strict";
const crypto = require("crypto");
const { URL } = require("url");

const TOKEN = String(process.env.PAINEL_TOKEN || "").trim();
const LOGIN = String(process.env.PAINEL_LOGIN || "").trim(); // senha do formulário (pode diferir do Bearer)
const DB_SECRET = String(process.env.PAINEL_DB_SECRET || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_KEY = String(process.env.SUPABASE_KEY || "").trim();
const TZ = process.env.TZ_PAINEL || "America/Recife";
const COOKIE = "painel_sess";
const MIN_LEN = 32;
const BODY_LIMIT = 64 * 1024;
const STYLE = require("./style.js");
const CLIENT = require("./client.js");

function sha256hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}
function safeEqual(a, b) {
  const x = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const y = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(x, y);
}
const SESSION_LABELS = ["painel-bots/sessao/v1", "painel-dna/sessao/v1", "painel/sessao/v1"];
function sessionValue(token, label = SESSION_LABELS[0]) {
  return crypto.createHmac("sha256", token).update(label).digest("base64url");
}
function sessionMatches(cookieVal, token) {
  if (!cookieVal) return false;
  return SESSION_LABELS.some((label) => safeEqual(cookieVal, sessionValue(token, label)));
}
function bearer(h) {
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? m[1].trim() : null;
}
function readCookie(header, name) {
  if (!header) return null;
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "?";
}
function nonce() {
  return crypto.randomBytes(16).toString("base64");
}

async function rpc(fn, args) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("supabase não configurado");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const err = new Error(typeof data === "object" && data?.message ? data.message : `rpc ${fn} ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getState() {
  const row = await rpc("painel_get_state", { p_secret: DB_SECRET });
  const v = row && typeof row === "object" ? row.v : null;
  return v && typeof v === "object" ? v : { bots: {}, roster: [], floors: [], groups: {}, feed: [], metrics: {}, chat: {}, looks: {}, routines: {}, usage: null };
}

async function putState(v, version) {
  return rpc("painel_put_state", { p_secret: DB_SECRET, p_v: v, p_version: version });
}

function loginPage(n, err) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Painel DNA</title><style nonce="${n}">${STYLE}</style></head>
<body><div class="login"><form method="post" action="/login"><h1>Painel DNA</h1><span class="sec">Acesso restrito. Entre com a chave.</span>
${err ? `<div class="err">${err}</div>` : ""}
<label for="chave">Chave</label><input id="chave" name="chave" type="password" autocomplete="current-password" required autofocus>
<button class="pri" type="submit">Entrar</button></form></div></body></html>`;
}

function panelPage(n) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Painel DNA</title><style nonce="${n}">${STYLE}</style></head>
<body>
<header>
  <h1>Painel DNA</h1>
  <div class="live"><i id="livedot" class="dot wait"></i><span id="vivotxt">conectando...</span></div>
  <div class="counts">
    <span class="chip"><i class="dot ok"></i>trabalhando agora <b id="cWork">0</b></span>
    <span class="chip"><i class="dot wait"></i>esperando <b id="cWait">0</b></span>
    <span class="chip"><i class="dot bad"></i>erros <b id="cErr">0</b></span>
    <span class="chip"><i class="dot"></i>descansando <b id="cIdle">0</b></span>
  </div>
  <form method="post" action="/logout"><button class="sair" type="submit">Sair</button></form>
</header>
<div class="legend">Como ler:
  <span class="bdg l">HEAD</span> <span class="bdg l">GER</span> <span class="bdg l">LÍDER</span>
  <span class="bdg e">ESP</span> <span class="bdg e">ANALISTA</span> <span class="bdg e">OPER</span>
  <span class="bdg c">COORD</span>
  <span class="jm">j</span> fala direto com a Joana
  <span class="jm ja">J</span> agenda/apoio executivo
  <span class="ln"></span> equipe do líder
  <span class="sec">· Joana fala com os líderes; cada líder exige, cobra e responde pelo resultado da equipe.</span>
</div>
<main>
  <div class="col">
    <details open><summary>Andares</summary><div class="list" id="floorsList"></div></details>
    <details open><summary>Esperando por mim</summary><div class="list" id="waitList"></div></details>
  </div>
  <div class="col stage"><div class="floorsWrap" id="floorsWrap"></div></div>
  <div class="col"><details open><summary>Decisão rápida</summary><div class="list" id="detail"></div></details></div>
</main>
<script nonce="${n}">${CLIENT}</script>
</body></html>`;
}

function send(res, status, body, headers = {}) {
  const h = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    ...headers,
  };
  res.statusCode = status;
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    if (req.body != null) {
      if (Buffer.isBuffer(req.body)) return resolve(req.body);
      if (typeof req.body === "string") return resolve(Buffer.from(req.body));
      if (typeof req.body === "object") return resolve(Buffer.from(new URLSearchParams(req.body).toString()));
    }
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > limit) { reject(Object.assign(new Error("grande"), { status: 413 })); req.resume(); return; }
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks));
    };
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("grande"), { status: 413 })); req.resume(); return; }
      chunks.push(c);
    });
    req.on("end", finish);
    req.on("error", () => reject(Object.assign(new Error("corpo"), { status: 400 })));
    // Some runtimes already finished the stream before we subscribe.
    if (req.readableEnded || req.complete) finish();
  });
}

function configured() {
  return TOKEN.length >= MIN_LEN && DB_SECRET && SUPABASE_URL && SUPABASE_KEY;
}
function chaveOk(chave) {
  if (!chave) return false;
  if (safeEqual(chave, TOKEN)) return true;
  if (LOGIN && LOGIN.length >= 8 && safeEqual(chave, LOGIN)) return true;
  return false;
}

function authed(req) {
  if (!configured()) return false;
  const b = bearer(req.headers.authorization);
  if (b !== null) return safeEqual(b.trim(), TOKEN);
  const c = readCookie(req.headers.cookie, COOKIE);
  return c !== null && sessionMatches(c, TOKEN);
}

function pathOf(req) {
  try { return new URL(req.url || "/", "http://x").pathname; } catch { return "/"; }
}

module.exports = async function handler(req, res) {
  const method = req.method || "GET";
  const route = pathOf(req);
  const n = nonce();
  const csp = `default-src 'none'; script-src 'nonce-${n}'; style-src 'nonce-${n}'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;
  res.setHeader("Content-Security-Policy", csp);

  try {
    if (!configured()) {
      if (route === "/health") return send(res, 200, JSON.stringify({ ok: false, reason: "env" }), { "Content-Type": "application/json; charset=utf-8" });
      return send(res, 500, "configuração incompleta", { "Content-Type": "text/plain; charset=utf-8" });
    }

    if (route === "/health") {
      return send(res, 200, JSON.stringify({ ok: true, login: Boolean(LOGIN && LOGIN.length >= 8) }), { "Content-Type": "application/json; charset=utf-8" });
    }

    if (route === "/logout" && method === "POST") {
      return send(res, 303, "", { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
    }

    if (route === "/login" && method === "POST") {
      const ip = clientIp(req);
      try {
        const blocked = await rpc("painel_login_blocked", { p_secret: DB_SECRET, p_ip: ip });
        if (blocked === true || blocked === "true") {
          return send(res, 429, loginPage(n, "muitos erros — tente em 15 min"), { "Content-Type": "text/html; charset=utf-8" });
        }
      } catch {}
      const raw = await readBody(req, 8 * 1024);
      const params = new URLSearchParams(raw.toString("utf8"));
      const chave = (params.get("chave") || "").trim();
      if (chaveOk(chave)) {
        try { await rpc("painel_login_ok", { p_secret: DB_SECRET, p_ip: ip }); } catch {}
        const sess = sessionValue(TOKEN);
        return send(res, 303, "", {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${sess}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
        });
      }
      try { await rpc("painel_login_fail", { p_secret: DB_SECRET, p_ip: ip }); } catch {}
      return send(res, 401, loginPage(n, "Chave incorreta."), { "Content-Type": "text/html; charset=utf-8" });
    }

    if (route === "/api/state" && method === "GET") {
      if (!authed(req)) return send(res, 401, JSON.stringify({ error: "não autorizado" }), { "Content-Type": "application/json; charset=utf-8" });
      const state = await getState();
      return send(res, 200, JSON.stringify(state), { "Content-Type": "application/json; charset=utf-8" });
    }

    if (route === "/ingest" && method === "POST") {
      const b = bearer(req.headers.authorization);
      if (b === null || !safeEqual(b, TOKEN)) return send(res, 401, JSON.stringify({ error: "não autorizado" }), { "Content-Type": "application/json; charset=utf-8" });
      const raw = await readBody(req, BODY_LIMIT);
      let msg;
      try { msg = JSON.parse(raw.toString("utf8")); } catch {
        return send(res, 400, JSON.stringify({ error: "JSON inválido" }), { "Content-Type": "application/json; charset=utf-8" });
      }
      // Apply limited mutations: status, metric, routines, roster, looks, groups, chat, usage
      const row = await rpc("painel_get_state", { p_secret: DB_SECRET });
      const version = row && typeof row === "object" ? Number(row.version || 0) : 0;
      const state = (row && row.v && typeof row.v === "object") ? row.v : { bots: {}, roster: [], floors: [], groups: {}, feed: [], metrics: {}, chat: {}, looks: {}, routines: {}, usage: null };
      state.bots = state.bots || {};
      state.feed = Array.isArray(state.feed) ? state.feed : [];
      state.metrics = state.metrics || {};
      state.routines = state.routines || {};
      state.chat = state.chat || {};
      state.looks = state.looks || {};
      state.groups = state.groups || {};

      const type = msg && msg.type;
      const now = new Date().toISOString();
      if (type === "status") {
        const name = String(msg.bot || "").trim();
        const status = String(msg.status || "");
        if (!name || !["working","idle","waiting_user","error","done"].includes(status)) {
          return send(res, 400, JSON.stringify({ error: "status inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        }
        let step = typeof msg.step === "string" ? msg.step.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() : "";
        if ([...step].length > 80) step = [...step].slice(0, 79).join("") + "…";
        const prev = state.bots[name] || {};
        const same = prev.status === status && (prev.step || "") === step;
        const entry = {
          status,
          step,
          at: now,
          since: same && prev.since ? prev.since : now,
          stepAt: (!same || prev.step !== step) ? now : (prev.stepAt || now),
          steps: Array.isArray(prev.steps) ? prev.steps.slice() : [],
        };
        if (!same && status !== "idle") {
          entry.steps.unshift({ at: now, step, status });
          entry.steps = entry.steps.slice(0, 10);
          state.feed.unshift({ at: now, bot: name, step, status });
          state.feed = state.feed.slice(0, 50);
        }
        state.bots[name] = entry;
      } else if (type === "metric") {
        const agent = String(msg.agent || "").trim();
        const metric = String(msg.metric || "").trim();
        if (!agent || !metric) return send(res, 400, JSON.stringify({ error: "metric inválida" }), { "Content-Type": "application/json; charset=utf-8" });
        const list = Array.isArray(state.metrics[agent]) ? state.metrics[agent].slice() : [];
        if (msg.remove) {
          state.metrics[agent] = list.filter((m) => m.metric !== metric);
        } else {
          const item = { metric, value: msg.value != null ? String(msg.value).slice(0, 60) : "", target: msg.target != null ? String(msg.target).slice(0, 60) : "", status: String(msg.status || "sem_medicao"), at: now };
          const i = list.findIndex((m) => m.metric === metric);
          if (i >= 0) list[i] = item; else list.push(item);
          state.metrics[agent] = list;
        }
      } else if (type === "routines") {
        const name = String(msg.bot || "").trim();
        if (!name || !Array.isArray(msg.items)) return send(res, 400, JSON.stringify({ error: "routines inválidas" }), { "Content-Type": "application/json; charset=utf-8" });
        state.routines[name] = msg.items.slice(0, 50);
        state.routines_at = now;
      } else if (type === "roster") {
        if (!Array.isArray(msg.names)) return send(res, 400, JSON.stringify({ error: "roster inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.roster = msg.names.map(String).slice(0, 200);
      } else if (type === "groups") {
        if (!msg.bots || typeof msg.bots !== "object") return send(res, 400, JSON.stringify({ error: "groups inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.groups = msg.bots;
        if (Array.isArray(msg.floors)) state.floors = msg.floors.map(String).slice(0, 50);
      } else if (type === "looks") {
        if (!msg.bots || typeof msg.bots !== "object") return send(res, 400, JSON.stringify({ error: "looks inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.looks = Object.assign({}, state.looks, msg.bots);
      } else if (type === "chat") {
        if (!msg.bots || typeof msg.bots !== "object") return send(res, 400, JSON.stringify({ error: "chat inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.chat = Object.assign({}, state.chat, msg.bots);
      } else if (type === "usage") {
        state.usage = { total_used_pct: msg.total_used_pct, resets_at: msg.resets_at, bots: msg.bots || {}, at: now };
      } else {
        return send(res, 400, JSON.stringify({ error: "type desconhecido" }), { "Content-Type": "application/json; charset=utf-8" });
      }

      await putState(state, version);
      return send(res, 200, JSON.stringify({ ok: true, type }), { "Content-Type": "application/json; charset=utf-8" });
    }

    if (route === "/" && method === "GET") {
      if (!authed(req)) return send(res, 200, loginPage(n), { "Content-Type": "text/html; charset=utf-8" });
      return send(res, 200, panelPage(n), { "Content-Type": "text/html; charset=utf-8" });
    }

    return send(res, 404, "não encontrado", { "Content-Type": "text/plain; charset=utf-8" });
  } catch (e) {
    console.error("painel-dna", e && e.message ? e.message : e);
    return send(res, e && e.status === 413 ? 413 : 500, JSON.stringify({ error: "falha interna" }), { "Content-Type": "application/json; charset=utf-8" });
  }
};
