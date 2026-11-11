import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
  COOKIE_NAME,
  LoginLimiter,
  bearer,
  chaveOk,
  readCookie,
  safeEqual,
  sessionMatches,
  sessionValue,
} from "./auth.js";
import { OrgSource } from "./organograma.js";
import { loginPage, panelPage, type PainelBrand } from "./page.js";
import { AVATAR_MAX, Store } from "./store.js";
import { ValidationError, botName, parseMessage } from "./validate.js";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const BODY_LIMIT = 64 * 1024;

// Fontes do visual ANA (Orbitron, Inter, JetBrains Mono; licença OFL, subconjunto latino). Servidas pelo próprio
// serviço (a CSP não aceita CDN), lidas uma vez ao subir. Não carregam dado nenhum, por isso não exigem login.
const FONT_FILES = ["orbitron", "inter", "jetbrains-mono"] as const;
const FONTS = new Map<string, Buffer>();
const here = path.dirname(fileURLToPath(import.meta.url));
const fontDirs = [
  path.resolve(here, "../../assets/fonts"),
  path.resolve(process.cwd(), "assets/fonts"),
  path.resolve(process.cwd(), "painel-dna/fonts"),
];
for (const f of FONT_FILES) {
  let loaded = false;
  for (const dir of fontDirs) {
    const fp = path.join(dir, `${f}.woff2`);
    if (!existsSync(fp)) continue;
    try {
      FONTS.set(`/fonts/${f}.woff2`, readFileSync(fp));
      loaded = true;
      break;
    } catch {
      /* tenta o próximo */
    }
  }
  void loaded;
}

export interface AppOptions {
  token: string;
  store: Store;
  /** Organograma (Notion no servidor + cache + snapshot). Sem isso, só o snapshot embutido. */
  org?: OrgSource;
  log?: (line: string) => void;
  /** Senha alternativa só do formulário web (PAINEL_LOGIN). Bearer/ingest continua com token. */
  login?: string;
  /** Marca do painel (DNA vs bots). */
  brand?: PainelBrand;
}

class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

async function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return (await readRaw(req, limit)).toString("utf8");
}

function readRaw(req: http.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? "0");
    if (declared > limit) {
      reject(new HttpError(413, `corpo maior que ${limit / 1024} KB`));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    req.on("data", (c: Buffer) => {
      if (done) return;
      size += c.length;
      if (size > limit) {
        done = true;
        reject(new HttpError(413, `corpo maior que ${limit / 1024} KB`));
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!done) {
        done = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", () => {
      if (!done) {
        done = true;
        reject(new HttpError(400, "falha ao ler o corpo"));
      }
    });
  });
}

/** Origin do pedido igual ao Host (ou X-Forwarded-Host do proxy). Sem Origin: recusa. */
function sameOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin === "null") return false;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const xfh = req.headers["x-forwarded-host"];
  const hosts = [req.headers.host, (Array.isArray(xfh) ? xfh[0] : xfh)?.split(",")[0]?.trim()];
  return hosts.some((h) => typeof h === "string" && h.toLowerCase() === host);
}

function clientIp(req: http.IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "?";
}

export function createHandler(opts: AppOptions): http.RequestListener {
  const { token, store } = opts;
  const org = opts.org ?? new OrgSource();
  const log = opts.log ?? ((l: string) => console.log(l));
  const login = (opts.login ?? "").trim();
  const brand = opts.brand;
  const session = sessionValue(token);
  const limiter = new LoginLimiter();

  function authed(req: http.IncomingMessage): boolean {
    const b = bearer(req.headers.authorization);
    if (b !== null) return safeEqual(b.trim(), token);
    const c = readCookie(req.headers.cookie, COOKIE_NAME);
    return sessionMatches(c, token);
  }

  return async (req, res) => {
    const method = req.method ?? "GET";
    let route = "/";
    try {
      route = new URL(req.url ?? "/", "http://x").pathname;
    } catch {
      route = "?";
    }
    const nonce = randomBytes(16).toString("base64");
    // Cabeçalhos de privacidade em TODAS as respostas.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    );
    // Log mínimo: método, rota (sem query), status. Nunca corpo, step ou token.
    // Em /avatar/<bot> loga só o padrão da rota, não o nome do bot.
    const logRoute = route.startsWith("/avatar/") ? "/avatar/:bot" : route.slice(0, 64);
    res.on("finish", () => log(`${method} ${logRoute} ${res.statusCode}`));

    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    const html = (status: number, body: string, extra: Record<string, string | string[]> = {}) => {
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...extra });
      res.end(body);
    };

    try {
      if (route === "/health" && (method === "GET" || method === "HEAD")) {
        // Campo extra `login` só quando PAINEL_LOGIN está ativo (não quebra clientes antigos).
        if (login && login.length >= 8) return json(200, { ok: true, login: true });
        return json(200, { ok: true });
      }

      const fonte = FONTS.get(route);
      if (fonte && (method === "GET" || method === "HEAD")) {
        res.writeHead(200, {
          "Content-Type": "font/woff2",
          "Content-Length": String(fonte.length),
          "Cache-Control": "public, max-age=604800, immutable",
        });
        return res.end(method === "HEAD" ? undefined : fonte);
      }

      if (route === "/robots.txt" && method === "GET") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("User-agent: *\nDisallow: /\n");
      }

      if (route === "/ingest") {
        if (method !== "POST") return json(405, { error: "use POST" });
        // /ingest aceita só Bearer (cookie não vale aqui, evita CSRF).
        const b = bearer(req.headers.authorization);
        if (b === null || !safeEqual(b, token)) {
          req.resume();
          return json(401, { error: "não autorizado" });
        }
        const ct = String(req.headers["content-type"] ?? "");
        if (!/^application\/json\b/i.test(ct)) {
          req.resume();
          return json(415, { error: "Content-Type deve ser application/json" });
        }
        const raw = await readBody(req, BODY_LIMIT);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return json(400, { error: "JSON inválido" });
        }
        const msg = parseMessage(parsed);
        store.apply(msg);
        try {
          await store.persist();
        } catch {
          return json(500, { error: "falha ao salvar o estado" });
        }
        const out: Record<string, unknown> = { ok: true, type: msg.type };
        if (msg.type === "status" && msg.step_truncated) out.step_truncated = true;
        if (msg.type === "handoff") {
          out.id = store.state.handoffs[0]?.id;
          if (msg.task_truncated) out.task_truncated = true;
        }
        return json(200, out);
      }

      if (route === "/avatar") {
        if (method !== "POST") return json(405, { error: "use POST" });
        // Como /ingest: só Bearer.
        const b = bearer(req.headers.authorization);
        if (b === null || !safeEqual(b, token)) {
          req.resume();
          return json(401, { error: "não autorizado" });
        }
        const ct = String(req.headers["content-type"] ?? "");
        if (!/^image\/png\b/i.test(ct)) {
          req.resume();
          return json(415, { error: "Content-Type deve ser image/png" });
        }
        const q = new URL(req.url ?? "/", "http://x").searchParams.get("bot");
        const h = req.headers["x-bot"];
        let rawName: unknown = q;
        if (rawName === null && typeof h === "string") {
          try {
            rawName = decodeURIComponent(h);
          } catch {
            req.resume();
            return json(400, { error: "X-Bot: use o nome em UTF-8 com encodeURIComponent" });
          }
        }
        if (rawName === null || rawName === undefined) {
          req.resume();
          return json(400, { error: "informe o bot em ?bot= ou no cabeçalho X-Bot" });
        }
        const name = botName(rawName, "bot");
        const png = await readRaw(req, AVATAR_MAX);
        if (png.length < PNG_SIG.length || !png.subarray(0, 8).equals(PNG_SIG))
          return json(400, { error: "o corpo não é um PNG" });
        try {
          await store.putAvatar(name, png);
        } catch {
          return json(500, { error: "falha ao salvar a foto" });
        }
        return json(200, { ok: true, bot: name, bytes: png.length });
      }

      if (route.startsWith("/avatar/")) {
        if (method !== "GET" && method !== "HEAD") return json(405, { error: "use GET" });
        if (!authed(req)) return json(401, { error: "não autorizado" });
        let name: string;
        try {
          name = decodeURIComponent(route.slice("/avatar/".length));
        } catch {
          return json(404, { error: "não encontrado" });
        }
        const png = await store.getAvatar(name);
        if (!png) return json(404, { error: "não encontrado" });
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": String(png.length) });
        return res.end(method === "HEAD" ? undefined : png);
      }

      if (route === "/api/state") {
        if (method !== "GET") return json(405, { error: "use GET" });
        if (!authed(req)) return json(401, { error: "não autorizado" });
        const refresh = (store as { refresh?: () => Promise<void> }).refresh;
        if (typeof refresh === "function") await refresh.call(store);
        store.pruneHandoffs();
        return json(200, store.state);
      }

      if (route === "/api/organograma") {
        if (method !== "GET") return json(405, { error: "use GET" });
        if (!authed(req)) return json(401, { error: "não autorizado" });
        return json(200, await org.get());
      }

      if (route === "/api/resolve") {
        if (method !== "POST") return json(405, { error: "use POST" });
        // Ação humana do painel: só o cookie de login vale (Bearer não), e só da mesma origem.
        const c = readCookie(req.headers.cookie, COOKIE_NAME);
        if (!sessionMatches(c, token)) {
          req.resume();
          return json(401, { error: "não autorizado" });
        }
        if (!sameOrigin(req)) {
          req.resume();
          return json(403, { error: "origem não permitida" });
        }
        const ct = String(req.headers["content-type"] ?? "");
        if (!/^application\/json\b/i.test(ct)) {
          req.resume();
          return json(415, { error: "Content-Type deve ser application/json" });
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(await readBody(req, 4096));
        } catch (e) {
          if (e instanceof HttpError) throw e;
          return json(400, { error: "JSON inválido" });
        }
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
          return json(400, { error: "envie {\"bot\": \"nome\"}" });
        const keys = Object.keys(parsed);
        if (keys.length !== 1 || keys[0] !== "bot") return json(400, { error: "envie só o campo bot" });
        const name = botName((parsed as { bot: unknown }).bot, "bot");
        const r = store.resolve(name);
        if (r === "desconhecido") return json(404, { error: "bot não encontrado" });
        if (r === "nao_esperando") return json(409, { error: "o bot não está esperando por você" });
        try {
          await store.persist();
        } catch {
          return json(500, { error: "falha ao salvar o estado" });
        }
        return json(200, { ok: true, bot: name, status: "idle" });
      }

      if (route === "/login") {
        if (method !== "POST") return json(405, { error: "use POST" });
        const ip = clientIp(req);
        if (limiter.blocked(ip)) {
          req.resume();
          return html(429, loginPage(nonce, "Muitas tentativas. Tente de novo em 15 minutos.", brand));
        }
        const raw = await readBody(req, 4096);
        const chave = (new URLSearchParams(raw).get("chave") ?? "").trim();
        if (!chaveOk(chave, token, login)) {
          limiter.fail(ip);
          return html(401, loginPage(nonce, "Chave incorreta.", brand));
        }
        limiter.ok(ip);
        res.writeHead(303, {
          Location: "/",
          "Set-Cookie": `${COOKIE_NAME}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
        });
        return res.end();
      }

      if (route === "/logout") {
        if (method !== "POST") return json(405, { error: "use POST" });
        req.resume();
        res.writeHead(303, {
          Location: "/",
          "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
        });
        return res.end();
      }

      if (route === "/") {
        if (method !== "GET" && method !== "HEAD") return json(405, { error: "use GET" });
        if (!authed(req)) return html(200, loginPage(nonce, undefined, brand));
        return html(200, panelPage(nonce, brand));
      }

      return json(404, { error: "não encontrado" });
    } catch (e) {
      if (e instanceof ValidationError) return json(400, { error: e.message });
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      return json(500, { error: "erro interno" });
    }
  };
}

export function createApp(opts: AppOptions): http.Server {
  return http.createServer(createHandler(opts));
}
