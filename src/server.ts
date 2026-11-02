import http from "node:http";
import { randomBytes } from "node:crypto";
import { COOKIE_NAME, LoginLimiter, bearer, readCookie, safeEqual, sessionValue } from "./auth.js";
import { loginPage, panelPage } from "./page.js";
import { Store } from "./store.js";
import { ValidationError, parseMessage } from "./validate.js";

export const BODY_LIMIT = 64 * 1024;

export interface AppOptions {
  token: string;
  store: Store;
  log?: (line: string) => void;
}

class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
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
        resolve(Buffer.concat(chunks).toString("utf8"));
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

function clientIp(req: http.IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "?";
}

export function createApp(opts: AppOptions): http.Server {
  const { token, store } = opts;
  const log = opts.log ?? ((l: string) => console.log(l));
  const session = sessionValue(token);
  const limiter = new LoginLimiter();

  function authed(req: http.IncomingMessage): boolean {
    const b = bearer(req.headers.authorization);
    if (b !== null) return safeEqual(b, token);
    const c = readCookie(req.headers.cookie, COOKIE_NAME);
    return c !== null && safeEqual(c, session);
  }

  return http.createServer(async (req, res) => {
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
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    );
    // Log mínimo: método, rota (sem query), status. Nunca corpo, step ou token.
    res.on("finish", () => log(`${method} ${route.slice(0, 64)} ${res.statusCode}`));

    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    const html = (status: number, body: string, extra: Record<string, string | string[]> = {}) => {
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...extra });
      res.end(body);
    };

    try {
      if (route === "/health" && (method === "GET" || method === "HEAD")) return json(200, { ok: true });

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
        return json(200, out);
      }

      if (route === "/api/state") {
        if (method !== "GET") return json(405, { error: "use GET" });
        if (!authed(req)) return json(401, { error: "não autorizado" });
        return json(200, store.state);
      }

      if (route === "/login") {
        if (method !== "POST") return json(405, { error: "use POST" });
        const ip = clientIp(req);
        if (limiter.blocked(ip)) {
          req.resume();
          return html(429, loginPage(nonce, "Muitas tentativas. Tente de novo em 15 minutos."));
        }
        const raw = await readBody(req, 4096);
        const chave = new URLSearchParams(raw).get("chave") ?? "";
        if (!safeEqual(chave, token)) {
          limiter.fail(ip);
          return html(401, loginPage(nonce, "Chave incorreta."));
        }
        limiter.ok(ip);
        res.writeHead(303, {
          Location: "/",
          "Set-Cookie": `${COOKIE_NAME}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`,
        });
        return res.end();
      }

      if (route === "/logout") {
        if (method !== "POST") return json(405, { error: "use POST" });
        req.resume();
        res.writeHead(303, {
          Location: "/",
          "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
        });
        return res.end();
      }

      if (route === "/") {
        if (method !== "GET" && method !== "HEAD") return json(405, { error: "use GET" });
        if (!authed(req)) return html(200, loginPage(nonce));
        return html(200, panelPage(nonce));
      }

      return json(404, { error: "não encontrado" });
    } catch (e) {
      if (e instanceof ValidationError) return json(400, { error: e.message });
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      return json(500, { error: "erro interno" });
    }
  });
}
