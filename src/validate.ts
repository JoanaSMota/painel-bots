// Validação estrita das mensagens recebidas em POST /ingest.
// Nenhuma função aqui loga dados: os erros descrevem o campo, nunca o valor.

export const STATUSES = ["working", "idle", "waiting_user", "error", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const STEP_MAX = 80;
export const NAME_MAX = 60;
export const MAX_BOTS_PER_MSG = 200;
export const MAX_ROUTINES = 50;
export const CHAT_PREFIX = "grokbot://app/v1/agent?id=";
const CHAT_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SHAPE_RE = /^[a-z][a-z0-9_-]{0,19}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export type Msg =
  | { type: "status"; bot: string; status: Status; step: string; step_truncated: boolean }
  | { type: "routines"; bot: string; items: { name: string; schedule: string; next_run: string | null }[] }
  | { type: "roster"; names: string[] }
  | { type: "looks"; bots: Record<string, { shape: string; color: string; accessory: string }> }
  | { type: "groups"; bots: Record<string, string> }
  | { type: "chat"; bots: Record<string, string> }
  | { type: "usage"; total_used_pct: number; resets_at: string; bots: Record<string, number> };

export class ValidationError extends Error {}

function fail(msg: string): never {
  throw new ValidationError(msg);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function onlyKeys(o: Record<string, unknown>, allowed: string[], where: string): void {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) fail(`${where}: campo desconhecido "${k.slice(0, 40)}"`);
  }
}

function str(v: unknown, field: string, min: number, max: number): string {
  if (typeof v !== "string") fail(`${field}: deve ser texto`);
  const s = v.trim();
  if (s.length < min) fail(`${field}: obrigatório`);
  if (s.length > max) fail(`${field}: máximo de ${max} caracteres`);
  if (CONTROL_RE.test(s)) fail(`${field}: caracteres de controle não são permitidos`);
  return s;
}

function botName(v: unknown, field: string): string {
  return str(v, field, 1, NAME_MAX);
}

function isoDate(v: unknown, field: string): string {
  const s = str(v, field, 1, 40);
  const t = Date.parse(s);
  if (Number.isNaN(t) || !/^\d{4}-\d{2}-\d{2}T/.test(s)) fail(`${field}: data ISO 8601 inválida (ex.: 2026-11-02T09:00:00-03:00)`);
  return new Date(t).toISOString();
}

function pct(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${field}: deve ser número`);
  if (v < 0 || v > 100) fail(`${field}: deve estar entre 0 e 100`);
  return Math.round(v * 100) / 100;
}

function botMap<T>(v: unknown, field: string, each: (val: unknown, f: string) => T): Record<string, T> {
  if (!isObj(v)) fail(`${field}: deve ser objeto {nome: valor}`);
  const keys = Object.keys(v);
  if (keys.length === 0) fail(`${field}: vazio`);
  if (keys.length > MAX_BOTS_PER_MSG) fail(`${field}: máximo de ${MAX_BOTS_PER_MSG} bots`);
  const out: Record<string, T> = Object.create(null);
  for (const k of keys) {
    const name = botName(k, `${field} (nome do bot)`);
    out[name] = each(v[k], `${field}.${name}`);
  }
  return out;
}

export function parseMessage(raw: unknown): Msg {
  if (!isObj(raw)) fail("corpo deve ser um objeto JSON");
  const type = raw.type;
  switch (type) {
    case "status": {
      onlyKeys(raw, ["type", "bot", "status", "step"], "status");
      const bot = botName(raw.bot, "bot");
      if (typeof raw.status !== "string" || !(STATUSES as readonly string[]).includes(raw.status))
        fail(`status: use um de ${STATUSES.join("|")}`);
      let step = "";
      let truncated = false;
      if (raw.step !== undefined) {
        if (typeof raw.step !== "string") fail("step: deve ser texto");
        step = raw.step.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
        const chars = Array.from(step);
        if (chars.length > STEP_MAX) {
          step = chars.slice(0, STEP_MAX - 1).join("") + "…";
          truncated = true;
        }
      }
      return { type, bot, status: raw.status as Status, step, step_truncated: truncated };
    }
    case "routines": {
      onlyKeys(raw, ["type", "bot", "items"], "routines");
      const bot = botName(raw.bot, "bot");
      if (!Array.isArray(raw.items)) fail("items: deve ser lista");
      if (raw.items.length > MAX_ROUTINES) fail(`items: máximo de ${MAX_ROUTINES}`);
      const items = raw.items.map((it, i) => {
        if (!isObj(it)) fail(`items[${i}]: deve ser objeto`);
        onlyKeys(it, ["name", "schedule", "next_run"], `items[${i}]`);
        return {
          name: str(it.name, `items[${i}].name`, 1, 100),
          schedule: str(it.schedule, `items[${i}].schedule`, 1, 100),
          next_run: it.next_run === null || it.next_run === undefined ? null : isoDate(it.next_run, `items[${i}].next_run`),
        };
      });
      return { type, bot, items };
    }
    case "roster": {
      onlyKeys(raw, ["type", "names"], "roster");
      if (!Array.isArray(raw.names)) fail("names: deve ser lista");
      if (raw.names.length > MAX_BOTS_PER_MSG) fail(`names: máximo de ${MAX_BOTS_PER_MSG}`);
      const names = [...new Set(raw.names.map((n, i) => botName(n, `names[${i}]`)))];
      return { type, names };
    }
    case "looks": {
      onlyKeys(raw, ["type", "bots"], "looks");
      const bots = botMap(raw.bots, "bots", (v, f) => {
        if (!isObj(v)) fail(`${f}: deve ser objeto {shape, color, accessory}`);
        onlyKeys(v, ["shape", "color", "accessory"], f);
        const shape = str(v.shape, `${f}.shape`, 1, 20).toLowerCase();
        if (!SHAPE_RE.test(shape)) fail(`${f}.shape: use letras minúsculas, números, - ou _`);
        const color = str(v.color, `${f}.color`, 4, 7);
        if (!HEX_RE.test(color)) fail(`${f}.color: cor hex inválida (ex.: #3366ff)`);
        const accessory = v.accessory === undefined ? "" : str(v.accessory, `${f}.accessory`, 0, 40);
        return { shape, color: color.toLowerCase(), accessory };
      });
      return { type, bots };
    }
    case "groups": {
      onlyKeys(raw, ["type", "bots"], "groups");
      return { type, bots: botMap(raw.bots, "bots", (v, f) => str(v, f, 1, NAME_MAX)) };
    }
    case "chat": {
      onlyKeys(raw, ["type", "bots"], "chat");
      const bots = botMap(raw.bots, "bots", (v, f) => {
        const link = str(v, f, 1, 200);
        if (!link.startsWith(CHAT_PREFIX)) fail(`${f}: link deve começar com ${CHAT_PREFIX}`);
        if (!CHAT_ID_RE.test(link.slice(CHAT_PREFIX.length))) fail(`${f}: id inválido no link`);
        return link;
      });
      return { type, bots };
    }
    case "usage": {
      onlyKeys(raw, ["type", "total_used_pct", "resets_at", "bots"], "usage");
      const total = pct(raw.total_used_pct, "total_used_pct");
      const resets_at = isoDate(raw.resets_at, "resets_at");
      const bots = raw.bots === undefined || (isObj(raw.bots) && Object.keys(raw.bots).length === 0) ? {} : botMap(raw.bots, "bots", (v, f) => pct(v, f));
      return { type, total_used_pct: total, resets_at, bots };
    }
    default:
      fail("type: use status|routines|roster|looks|groups|chat|usage");
  }
}
