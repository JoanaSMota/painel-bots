// Persistência do Painel DNA via RPCs do Supabase (painel_get_state / painel_put_state).
// Normaliza o JSON do DNA (looks/chat/groups/routines separados) para o State do painel ANA.
import { Store, emptyState, type BotState, type State, type StepEntry } from "./store.js";

export interface SupabaseOpts {
  url: string;
  key: string;
  secret: string;
}

type DnaRow = {
  version?: number;
  v?: Record<string, unknown>;
};

function floorOf(team: string): string {
  const i = team.indexOf(" / ");
  return i >= 0 ? team.slice(0, i) : team;
}

/** Converte o payload DNA → State consumido pelo page.ts (ANA). */
export function dnaToState(raw: Record<string, unknown> | null | undefined): State {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;

  const botsIn = (raw.bots && typeof raw.bots === "object" ? raw.bots : {}) as Record<string, Record<string, unknown>>;
  const groups = (raw.groups && typeof raw.groups === "object" ? raw.groups : {}) as Record<string, string>;
  const looks = (raw.looks && typeof raw.looks === "object" ? raw.looks : {}) as Record<string, BotState["look"]>;
  const chat = (raw.chat && typeof raw.chat === "object" ? raw.chat : {}) as Record<string, string>;
  const routines = (raw.routines && typeof raw.routines === "object" ? raw.routines : {}) as Record<
    string,
    BotState["routines"]
  >;
  const avatars = (raw.avatars && typeof raw.avatars === "object" ? raw.avatars : {}) as Record<string, string>;

  const bots: Record<string, BotState> = Object.create(null);
  const names = new Set<string>([
    ...Object.keys(botsIn),
    ...Object.keys(groups),
    ...Object.keys(looks),
    ...Object.keys(chat),
    ...Object.keys(routines),
  ]);
  for (const name of names) {
    const src = botsIn[name] || {};
    const recent: StepEntry[] = Array.isArray(src.steps)
      ? (src.steps as StepEntry[]).slice(0, 10).map((s) => ({
          at: String(s.at || ""),
          status: s.status,
          step: String(s.step || ""),
        }))
      : Array.isArray(src.recent)
        ? (src.recent as StepEntry[])
        : [];
    const status = (src.status as BotState["status"]) || recent[0]?.status;
    const step = typeof src.step === "string" ? src.step : recent[0]?.step;
    const status_at =
      typeof src.status_at === "string"
        ? src.status_at
        : typeof src.since === "string"
          ? src.since
          : typeof src.at === "string"
            ? src.at
            : recent[0]?.at;
    const teamRaw = groups[name];
    bots[name] = {
      status,
      step,
      status_at,
      recent,
      look: looks[name] || (src.look as BotState["look"]),
      chat: chat[name] || (typeof src.chat === "string" ? src.chat : undefined),
      team: teamRaw ? floorOf(teamRaw) : typeof src.team === "string" ? floorOf(src.team) : undefined,
      routines: routines[name] || (src.routines as BotState["routines"]),
      routines_at: typeof src.routines_at === "string" ? src.routines_at : undefined,
    };
  }

  const floors = Array.isArray(raw.floors) ? (raw.floors as string[]).map(String) : null;
  const roster = Array.isArray(raw.roster) ? (raw.roster as string[]).map(String) : null;
  const feed = Array.isArray(raw.feed)
    ? (raw.feed as (StepEntry & { bot: string })[]).slice(0, 50)
    : [];
  const usage =
    raw.usage && typeof raw.usage === "object"
      ? (raw.usage as State["usage"])
      : null;

  return {
    ...base,
    bots,
    roster,
    floors,
    feed,
    avatars: Object.assign(Object.create(null), avatars),
    usage,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    handoffs: [],
  };
}

/** Converte State ANA → payload DNA (mantém looks/chat/groups/routines no formato antigo). */
export function stateToDna(state: State, prev?: Record<string, unknown> | null): Record<string, unknown> {
  const prevObj = prev && typeof prev === "object" ? prev : {};
  const looks: Record<string, unknown> = {};
  const chat: Record<string, string> = {};
  const groups: Record<string, string> = { ...((prevObj.groups as Record<string, string>) || {}) };
  const routines: Record<string, unknown> = {};
  const bots: Record<string, unknown> = {};

  for (const [name, b] of Object.entries(state.bots)) {
    bots[name] = {
      status: b.status,
      step: b.step,
      at: b.status_at,
      since: b.status_at,
      steps: b.recent || [],
      status_at: b.status_at,
    };
    if (b.look) looks[name] = b.look;
    if (b.chat) chat[name] = b.chat;
    if (b.team) {
      const prevTeam = groups[name];
      // preserva subtime "Floor / Team" se o floor bater
      if (typeof prevTeam === "string" && prevTeam.startsWith(b.team)) groups[name] = prevTeam;
      else groups[name] = b.team;
    }
    if (b.routines) routines[name] = b.routines;
  }

  return {
    ...prevObj,
    bots,
    roster: state.roster,
    floors: state.floors,
    feed: state.feed,
    usage: state.usage,
    avatars: state.avatars,
    looks: { ...((prevObj.looks as object) || {}), ...looks },
    chat: { ...((prevObj.chat as object) || {}), ...chat },
    groups,
    routines: { ...((prevObj.routines as object) || {}), ...routines },
    updated_at: state.updated_at,
  };
}

export class SupabaseStore extends Store {
  private opts: SupabaseOpts;
  private version = 0;
  private raw: Record<string, unknown> | null = null;
  override mode: "arquivo" | "memória" = "arquivo";

  private constructor(opts: SupabaseOpts) {
    super();
    this.opts = opts;
  }

  /** Nome distinto de Store.open (assinatura incompatível). */
  static async connect(opts: SupabaseOpts): Promise<SupabaseStore> {
    const s = new SupabaseStore(opts);
    await s.refresh();
    return s;
  }

  private async rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const url = this.opts.url.replace(/\/$/, "");
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: this.opts.key,
        Authorization: `Bearer ${this.opts.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(args),
    });
    const text = await r.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!r.ok) {
      const msg =
        typeof data === "object" && data && "message" in data
          ? String((data as { message: unknown }).message)
          : `rpc ${fn} ${r.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async refresh(): Promise<void> {
    const row = (await this.rpc("painel_get_state", { p_secret: this.opts.secret })) as DnaRow;
    this.version = Number(row?.version || 0);
    this.raw = row?.v && typeof row.v === "object" ? (row.v as Record<string, unknown>) : {};
    this.state = dnaToState(this.raw);
  }

  override async persist(): Promise<void> {
    // Re-lê versão se outro writer avançou; em conflito, tenta de novo uma vez.
    const payload = stateToDna(this.state, this.raw);
    try {
      await this.rpc("painel_put_state", {
        p_secret: this.opts.secret,
        p_v: payload,
        p_version: this.version,
      });
      this.raw = payload;
      this.version += 1;
    } catch (e) {
      await this.refresh();
      const again = stateToDna(this.state, this.raw);
      await this.rpc("painel_put_state", {
        p_secret: this.opts.secret,
        p_v: again,
        p_version: this.version,
      });
      this.raw = again;
      this.version += 1;
      void e;
    }
  }
}
