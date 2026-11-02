import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "painel_sess";
export const MIN_TOKEN_LEN = 32;

function sha(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/** Comparação em tempo constante (hash antes para igualar tamanhos). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha(a), sha(b));
}

/** Valor do cookie de sessão: HMAC da chave; nunca a chave em si. */
export function sessionValue(token: string): string {
  return createHmac("sha256", token).update("painel-bots/sessao/v1").digest("base64url");
}

export function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1] ? m[1].trim() : null;
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Tentativas de login por IP: 10 erros em 15 min bloqueiam aquele IP por 15 min. */
export class LoginLimiter {
  private hits = new Map<string, { n: number; since: number }>();
  constructor(private max = 10, private windowMs = 15 * 60_000) {}
  blocked(ip: string, now = Date.now()): boolean {
    const h = this.hits.get(ip);
    if (!h) return false;
    if (now - h.since > this.windowMs) {
      this.hits.delete(ip);
      return false;
    }
    return h.n >= this.max;
  }
  fail(ip: string, now = Date.now()): void {
    const h = this.hits.get(ip);
    if (!h || now - h.since > this.windowMs) this.hits.set(ip, { n: 1, since: now });
    else h.n++;
    if (this.hits.size > 10_000) this.hits.clear();
  }
  ok(ip: string): void {
    this.hits.delete(ip);
  }
}
