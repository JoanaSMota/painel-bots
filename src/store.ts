// Estado do painel: arquivo JSON em DATA_DIR (volume do Railway) com escrita atômica,
// ou só memória quando DATA_DIR não está definido/gravável.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Msg, Status } from "./validate.js";

export interface BotState {
  status?: Status;
  step?: string;
  status_at?: string;
  routines?: { name: string; schedule: string; next_run: string | null }[];
  routines_at?: string;
  look?: { shape: string; color: string; accessory: string };
  team?: string;
  chat?: string;
}

export interface State {
  version: 1;
  bots: Record<string, BotState>;
  roster: string[] | null;
  usage: { total_used_pct: number; resets_at: string; bots: Record<string, number>; at: string } | null;
  updated_at: string | null;
}

export function emptyState(): State {
  return { version: 1, bots: Object.create(null), roster: null, usage: null, updated_at: null };
}

export class Store {
  state: State = emptyState();
  private file: string | null = null;
  private chain: Promise<void> = Promise.resolve();
  mode: "arquivo" | "memória" = "memória";

  static async open(dataDir: string | undefined): Promise<Store> {
    const s = new Store();
    if (!dataDir) return s;
    try {
      await fs.mkdir(dataDir, { recursive: true });
      const file = path.join(dataDir, "state.json");
      // testa se dá pra gravar
      const probe = path.join(dataDir, `.probe-${process.pid}`);
      await fs.writeFile(probe, "");
      await fs.rm(probe);
      s.file = file;
      s.mode = "arquivo";
      try {
        const raw = await fs.readFile(file, "utf8");
        const parsed = JSON.parse(raw) as State;
        if (parsed && parsed.version === 1 && typeof parsed.bots === "object") {
          s.state = { ...emptyState(), ...parsed, bots: Object.assign(Object.create(null), parsed.bots) };
        } else throw new Error("formato");
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
          await fs.rename(file, `${file}.corrompido-${Date.now()}`).catch(() => {});
          console.warn("estado salvo ilegível; iniciando vazio (arquivo antigo renomeado)");
        }
      }
    } catch {
      console.warn("DATA_DIR não gravável; usando só memória");
      s.file = null;
      s.mode = "memória";
    }
    return s;
  }

  private bot(name: string): BotState {
    let b = this.state.bots[name];
    if (!b) {
      b = {};
      this.state.bots[name] = b;
    }
    return b;
  }

  apply(m: Msg, now = new Date()): void {
    const at = now.toISOString();
    switch (m.type) {
      case "status": {
        const b = this.bot(m.bot);
        b.status = m.status;
        b.step = m.step;
        b.status_at = at;
        break;
      }
      case "routines": {
        const b = this.bot(m.bot);
        b.routines = m.items;
        b.routines_at = at;
        break;
      }
      case "roster":
        this.state.roster = m.names;
        break;
      case "looks":
        for (const [n, look] of Object.entries(m.bots)) this.bot(n).look = look;
        break;
      case "groups":
        for (const [n, team] of Object.entries(m.bots)) this.bot(n).team = team;
        break;
      case "chat":
        for (const [n, link] of Object.entries(m.bots)) this.bot(n).chat = link;
        break;
      case "usage":
        this.state.usage = { total_used_pct: m.total_used_pct, resets_at: m.resets_at, bots: m.bots, at };
        break;
    }
    this.state.updated_at = at;
  }

  /** Grava de forma atômica (tmp + fsync + rename), serializando as escritas. */
  persist(): Promise<void> {
    const file = this.file;
    if (!file) return Promise.resolve();
    const data = JSON.stringify(this.state);
    const next = this.chain.then(async () => {
      const tmp = `${file}.tmp-${process.pid}`;
      const fh = await fs.open(tmp, "w", 0o600);
      try {
        await fh.writeFile(data, "utf8");
        await fh.sync();
      } finally {
        await fh.close();
      }
      await fs.rename(tmp, file);
    });
    this.chain = next.catch(() => {});
    return next;
  }
}
