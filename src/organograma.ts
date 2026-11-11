// Organograma do painel: lê a hierarquia do Notion NO SERVIDOR (o token nunca vai ao navegador),
// guarda em cache (memória 10 min + arquivo) e, sem Notion e sem cache, usa o snapshot embutido.
// As funções puras (orgArvore, orgCasa, cargoCurto, nomeCurto, orgNovo) também rodam no navegador:
// o painel as embute com .toString(), por isso cada uma é autocontida (sem usar nada de fora).
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";

export interface OrgLinha {
  nome: string;
  /** "Reporta a": nomes dos pais (o primeiro manda na árvore). */
  reporta: string[];
  cargo?: string;
  /** "ID do bot" no Notion: é o id que aparece no chat do bot (…agent?id=<id>). */
  id?: string;
  /** createdTime da linha no Notion (ISO). */
  criado?: string;
}

export interface OrgNo {
  nome: string;
  filhos: OrgNo[];
  /** Bot do painel que não aparece em nenhuma linha do Notion. */
  fora?: boolean;
}
export interface OrgBloco {
  titulo: string;
  itens: OrgNo[];
}
export interface OrgArvore {
  raiz: string;
  ceo: string | null;
  dirs: OrgNo[];
  apoio: OrgBloco[];
  /** nome -> quem ele reporta (na árvore desenhada) */
  pai: Record<string, string>;
  /** CEO + diretores + times + faixa de apoio (sem o Lucas) */
  total: number;
  foraNotion: string[];
}

export type OrgFonte = "notion" | "cache" | "snapshot";
export interface OrgPayload {
  fonte: OrgFonte;
  /** Quando os dados vieram do Notion (ou, no snapshot, quando foi gerado). */
  em: string;
  linhas: OrgLinha[];
}

/** Ordem preferida dentro de cada grupo (só a ordem; quem chega depois vem ao fim, em ordem alfabética). */
export function orgArvore(linhas: OrgLinha[], roster: string[], casa: Record<string, string | null>): OrgArvore {
  const LUCAS = "Lucas Braga";
  const CEO = "CEO ANA";
  const ORDEM = [
    "DM ANA", "COO ANA", "DV ANA", "CFO ANA", "CS ANA",
    "Tráfego ANA", "SEO & AEO ANA", "Design ANA", "Editor Vídeo ANA", "Copy Max Peters", "Stalk Bot", "Radar IA Jurídica", "Social Selling ANA",
    "RH ANA", "Formações ANA", "Eventos ANA", "Produto ANA", "Plataforma ANA", "Processos ANA",
    "Caçador de Vendas ANA", "Comprador", "Integra", "Backup Bots", "PromptGenius", "Dust Expert",
  ];
  const BLOCOS: [string, string[]][] = [
    ["ASSISTÊNCIA", ["Donna Secretária · administrativo"]],
    ["INFRA DE BOTS", ["Diretor Agentes"]],
    ["PESSOAL", ["Guru Financeiro", "Saúde Lucas", "Isadora", "Professor de Canto"]],
    ["TECH · RESEARCH", ["Programador", "Obsidian", "Pesquisador", "Engenheiro de Fluxo"]],
    ["GERAL · OPS", ["Grok Bot", "Teste de Produto", "Assinaturas"]],
  ];
  const porNome: Record<string, OrgLinha> = {};
  for (const l of linhas) porNome[l.nome] = l;
  const filhosDe: Record<string, string[]> = {};
  for (const l of linhas) {
    const p = (l.reporta || [])[0];
    if (p === undefined || p === l.nome || l.nome === LUCAS) continue;
    (filhosDe[p] = filhosDe[p] || []).push(l.nome);
  }
  const rank = (n: string) => {
    const i = ORDEM.indexOf(n);
    return i < 0 ? 1000 : i;
  };
  const ordena = (a: string[]) => a.slice().sort((x, y) => rank(x) - rank(y) || x.localeCompare(y, "pt-BR"));
  const pai: Record<string, string> = {};
  const visto: Record<string, boolean> = { [LUCAS]: true };
  let total = 0;
  const monta = (nome: string, de: string): OrgNo => {
    visto[nome] = true;
    pai[nome] = de;
    total++;
    return { nome, filhos: ordena(filhosDe[nome] || []).filter((k) => !visto[k]).map((k) => monta(k, nome)) };
  };
  const doLucas = ordena(filhosDe[LUCAS] || []);
  const temCeo = doLucas.indexOf(CEO) >= 0 && !!porNome[CEO];
  let dirs: OrgNo[] = [];
  let ceo: string | null = null;
  if (temCeo) {
    ceo = CEO;
    visto[CEO] = true;
    pai[CEO] = LUCAS;
    total++;
    dirs = ordena(filhosDe[CEO] || []).filter((k) => !visto[k]).map((k) => monta(k, CEO));
  }
  const casados: Record<string, boolean> = {};
  for (const k of Object.keys(casa)) {
    const v = casa[k];
    if (v) casados[v] = true;
  }
  const foraNotion = roster.filter((n) => !casados[n] && !porNome[n]);
  const disponiveis: Record<string, OrgNo> = {};
  for (const n of doLucas) if (n !== CEO && !visto[n]) disponiveis[n] = monta(n, LUCAS);
  for (const n of foraNotion) {
    if (disponiveis[n] || visto[n]) continue;
    visto[n] = true;
    pai[n] = "fora do Notion";
    total++;
    disponiveis[n] = { nome: n, filhos: [], fora: true };
  }
  const apoio: OrgBloco[] = [];
  const usados: Record<string, boolean> = {};
  for (const [titulo, nomes] of BLOCOS) {
    const itens = nomes.filter((n) => disponiveis[n]).map((n) => ((usados[n] = true), disponiveis[n] as OrgNo));
    if (itens.length) apoio.push({ titulo, itens });
  }
  const sobras = Object.keys(disponiveis)
    .filter((n) => !usados[n])
    .sort((x, y) => x.localeCompare(y, "pt-BR"));
  if (sobras.length) apoio.push({ titulo: "OUTROS", itens: sobras.map((n) => disponiveis[n] as OrgNo) });
  return { raiz: LUCAS, ceo, dirs, apoio, pai, total, foraNotion };
}

/** Casa cada linha do Notion com um bot do painel: 1º pelo "ID do bot" (está no chat do bot), 2º pelo nome exato. */
export function orgCasa(
  linhas: OrgLinha[],
  bots: Record<string, { chat?: string } | undefined>,
): Record<string, string | null> {
  const porId: Record<string, string> = {};
  for (const n of Object.keys(bots)) {
    const c = bots[n]?.chat;
    if (typeof c !== "string") continue;
    const m = /[?&]id=([0-9a-zA-Z-]{4,})/.exec(c);
    if (m && m[1]) porId[m[1].toLowerCase()] = n;
  }
  const out: Record<string, string | null> = {};
  for (const l of linhas) {
    const viaId = l.id ? porId[String(l.id).toLowerCase()] : undefined;
    out[l.nome] = viaId ?? (Object.prototype.hasOwnProperty.call(bots, l.nome) ? l.nome : null);
  }
  return out;
}

/** Cargo curto do cartão. Fora da tabela: o Cargo do Notion sem o trecho entre parênteses. */
export function cargoCurto(nome: string, cargoNotion?: string): string {
  const T: Record<string, string> = {
    "CEO ANA": "CEO / co-piloto executivo da ANA",
    "DM ANA": "Diretor de Marketing", "COO ANA": "Diretor de Operações", "DV ANA": "Diretor de Vendas",
    "CFO ANA": "Dir. Financeiro", "CS ANA": "Sucesso Cliente",
    "Tráfego ANA": "Media Buyer Sênior", "SEO & AEO ANA": "Especialista SEO&AEO", "Design ANA": "Diretor de Arte",
    "Editor Vídeo ANA": "Editor de Vídeo", "Copy Max Peters": "Copywriter Max Peters", "Stalk Bot": "Intel. Competitiva",
    "Radar IA Jurídica": "Editor de Notícias", "Social Selling ANA": "Social Seller no IG",
    "RH ANA": "Diretora de Pessoas", "Formações ANA": "Designer Instrucional", "Eventos ANA": "Eventos Presenciais",
    "Produto ANA": "Dono de Produto", "Plataforma ANA": "Eng. Lovable · Aluno", "Processos ANA": "Dono de Processos",
    "Caçador de Vendas ANA": "SDR de Outbound",
    "Donna Secretária · administrativo": "Secretária Executiva", "Comprador": "Consultor Compras",
    "Diretor Agentes": "Designer de Bots", "Integra": "Eng. Integrações", "Backup Bots": "Backups dos Bots",
    "PromptGenius": "Meta-eng. Prompts", "Dust Expert": "Orquestrador Dust", "Guru Financeiro": "Finanças Pessoais",
    "Saúde Lucas": "Saúde Pessoal", "Isadora": "Paternidade", "Professor de Canto": "Prof. Particular",
    "Programador": "Líder de Engenharia", "Obsidian": "Cofre Obsidian", "Pesquisador": "Investigador Digital",
    "Grok Bot": "Porta de Entrada", "Teste de Produto": "Decisão de Ideias", "Assinaturas": "Auditor Assinaturas",
    "Engenheiro de Fluxo": "fora do Notion",
  };
  if (Object.prototype.hasOwnProperty.call(T, nome)) return T[nome] as string;
  return String(cargoNotion || "").replace(/\s*\([^)]*\)/g, "").trim();
}

/** Nome mostrado no cartão (só dois ajustes de espaço). */
export function nomeCurto(nome: string): string {
  if (nome === "Donna Secretária · administrativo") return "Donna Secretária";
  if (nome === "Engenheiro de Fluxo") return "Eng. de Fluxo";
  return nome;
}

/** Selo NOVO: linha do Notion criada há menos de 14 dias. */
export function orgNovo(criado: string | undefined, agora: number): boolean {
  if (!criado) return false;
  const t = Date.parse(String(criado).replace(" ", "T"));
  return !isNaN(t) && agora - t >= 0 && agora - t < 14 * 86400000;
}

// ---------------------------------------------------------------- servidor

const NOTION_VERSION = "2022-06-28";
const NOTION_DB = "7c6ab94d-9f4e-4dc1-b541-c8ee6df911c3";
export const ORG_TTL_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const CACHE_FILE = "organograma-cache.json";

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface OrgOptions {
  /** NOTION_TOKEN (lido do ambiente pelo index.ts; nunca vai ao navegador nem ao log). */
  token?: string;
  /** DATA_DIR: onde espelhar organograma-cache.json. */
  dir?: string;
  fetchFn?: FetchFn;
  now?: () => number;
  database?: string;
}

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

function textoProp(p: unknown): string | undefined {
  const o = p as { title?: { plain_text?: string }[]; rich_text?: { plain_text?: string }[] } | undefined;
  const arr = o?.title ?? o?.rich_text;
  if (!Array.isArray(arr)) return undefined;
  return str(arr.map((x) => x?.plain_text ?? "").join(""), 200);
}

/** Converte as páginas do Notion (API 2022-06-28) em linhas; "Reporta a" vira nomes pelas páginas da própria database. */
export function linhasDoNotion(paginas: unknown[]): OrgLinha[] {
  const nomes: Record<string, string> = {};
  const brutas: { nome: string; pais: string[]; cargo?: string; id?: string; criado?: string }[] = [];
  for (const raw of paginas) {
    const pg = raw as { id?: string; created_time?: string; properties?: Record<string, unknown> };
    const pr = pg.properties ?? {};
    const nome = textoProp(pr["Agente"]);
    if (!nome || typeof pg.id !== "string") continue;
    nomes[pg.id.replace(/-/g, "")] = nome;
    const rel = (pr["Reporta a"] as { relation?: { id?: string }[] } | undefined)?.relation;
    brutas.push({
      nome,
      pais: Array.isArray(rel) ? rel.map((r) => String(r?.id ?? "").replace(/-/g, "")) : [],
      cargo: textoProp(pr["Cargo"]),
      id: textoProp(pr["ID do bot"]),
      criado: str(pg.created_time, 40),
    });
  }
  return brutas.map((b) => {
    const l: OrgLinha = { nome: b.nome, reporta: b.pais.map((i) => nomes[i]).filter((x): x is string => !!x) };
    if (b.cargo) l.cargo = b.cargo;
    if (b.id) l.id = b.id;
    if (b.criado) l.criado = b.criado;
    return l;
  });
}

/** Valida linhas vindas do cache em disco (arquivo editável por fora: não confiar). */
export function linhasValidas(v: unknown): OrgLinha[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 500) return null;
  const out: OrgLinha[] = [];
  for (const x of v) {
    const o = x as Record<string, unknown>;
    const nome = str(o?.["nome"], 120);
    if (!nome) return null;
    const reporta = Array.isArray(o["reporta"]) ? (o["reporta"] as unknown[]).map((r) => str(r, 120)).filter((r): r is string => !!r).slice(0, 5) : [];
    const l: OrgLinha = { nome, reporta };
    const cargo = str(o["cargo"], 200);
    const id = str(o["id"], 80);
    const criado = str(o["criado"], 40);
    if (cargo) l.cargo = cargo;
    if (id) l.id = id;
    if (criado) l.criado = criado;
    out.push(l);
  }
  return out;
}

interface FallbackFile {
  geradoEm: string;
  linhas: Record<string, { rep: string[]; sub?: string[]; cargo?: string; id?: string; criado?: string }>;
}

export function carregaSnapshot(): OrgPayload {
  const f = JSON.parse(readFileSync(new URL("../../src/organograma-fallback.json", import.meta.url), "utf8")) as FallbackFile;
  const linhas: OrgLinha[] = Object.keys(f.linhas).map((nome) => {
    const r = f.linhas[nome] as FallbackFile["linhas"][string];
    const l: OrgLinha = { nome, reporta: r.rep };
    if (r.cargo) l.cargo = r.cargo;
    if (r.id) l.id = r.id;
    if (r.criado) l.criado = r.criado;
    return l;
  });
  return { fonte: "snapshot", em: f.geradoEm, linhas };
}

export class OrgSource {
  private mem: { em: number; linhas: OrgLinha[] } | null = null;
  private emVoo: Promise<void> | null = null;
  private proxima = 0;
  private diskLido = false;
  private readonly token: string;
  private readonly now: () => number;
  private readonly fetchFn: FetchFn;
  private readonly db: string;

  constructor(private readonly o: OrgOptions = {}) {
    this.token = (o.token ?? "").trim();
    this.now = o.now ?? Date.now;
    this.fetchFn = o.fetchFn ?? (fetch as unknown as FetchFn);
    this.db = o.database ?? NOTION_DB;
  }

  get temToken(): boolean {
    return this.token.length > 0;
  }

  private async lerDisco(): Promise<void> {
    if (this.diskLido) return;
    this.diskLido = true;
    if (!this.o.dir) return;
    try {
      const j = JSON.parse(await fs.readFile(path.join(this.o.dir, CACHE_FILE), "utf8")) as { em?: unknown; linhas?: unknown };
      const linhas = linhasValidas(j.linhas);
      const em = typeof j.em === "string" ? Date.parse(j.em) : NaN;
      if (linhas && !isNaN(em)) this.mem = { em, linhas };
    } catch {
      // sem arquivo ou arquivo ruim: segue sem cache em disco
    }
  }

  private async gravaDisco(): Promise<void> {
    if (!this.o.dir || !this.mem) return;
    try {
      const alvo = path.join(this.o.dir, CACHE_FILE);
      const tmp = `${alvo}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ em: new Date(this.mem.em).toISOString(), linhas: this.mem.linhas }), { mode: 0o600 });
      await fs.rename(tmp, alvo);
    } catch {
      // volume indisponível: o cache em memória continua valendo
    }
  }

  private async buscaNotion(): Promise<OrgLinha[]> {
    const paginas: unknown[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const r = await this.fetchFn(`https://api.notion.com/v1/databases/${this.db}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
        body: JSON.stringify(cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`Notion respondeu ${r.status}`);
      const j = (await r.json()) as { results?: unknown[]; has_more?: boolean; next_cursor?: string | null };
      paginas.push(...(j.results ?? []));
      if (!j.has_more || !j.next_cursor) break;
      cursor = j.next_cursor;
    }
    const linhas = linhasDoNotion(paginas);
    if (linhas.length < 2) throw new Error("Notion devolveu um organograma vazio");
    return linhas;
  }

  private async atualiza(): Promise<void> {
    try {
      const linhas = await this.buscaNotion();
      this.mem = { em: this.now(), linhas };
      this.proxima = 0;
      await this.gravaDisco();
    } catch {
      // nunca derruba o painel: tenta de novo daqui a 1 min e, até lá, serve o cache/snapshot
      this.proxima = this.now() + RETRY_MS;
    }
  }

  async get(): Promise<OrgPayload> {
    await this.lerDisco();
    const agora = this.now();
    const fresco = this.mem !== null && agora - this.mem.em < ORG_TTL_MS;
    if (!fresco && this.temToken && agora >= this.proxima) {
      this.emVoo = this.emVoo ?? this.atualiza().finally(() => (this.emVoo = null));
      await this.emVoo;
    } else if (this.emVoo) {
      await this.emVoo;
    }
    const m = this.mem;
    if (m) {
      const ok = this.now() - m.em < ORG_TTL_MS;
      return { fonte: ok && this.proxima === 0 ? "notion" : "cache", em: new Date(m.em).toISOString(), linhas: m.linhas };
    }
    return carregaSnapshot();
  }
}
