// Lógica pura do painel (visual ANA): quem está parado há muito tempo e onde cada bot fica no mapa.
// Usada nos testes e embutida no JS do painel (por isso cada função é autossuficiente e sem dependências).

/**
 * "Parado há +12h": bots em waiting_user há MAIS que `limiteH` horas (estritamente).
 * Do mais antigo ao mais novo. `label` no formato "17h53"; `pct` é a barra, relativa ao mais antigo (mín. 6).
 */
export function parados(
  bots: { nome: string; status?: string | null; status_at?: string | null }[],
  agora: number,
  limiteH: number,
): { nome: string; ms: number; label: string; pct: number }[] {
  var lim = limiteH * 3600000;
  var out: { nome: string; ms: number; label: string; pct: number }[] = [];
  bots.forEach(function (b) {
    if (!b || b.status !== "waiting_user") return;
    var t = b.status_at ? Date.parse(b.status_at) : NaN;
    if (isNaN(t)) return;
    var ms = Math.max(0, agora - t);
    if (ms <= lim) return;
    var min = Math.floor(ms / 60000);
    var mm = min % 60;
    out.push({ nome: b.nome, ms: ms, label: Math.floor(min / 60) + "h" + (mm < 10 ? "0" : "") + mm, pct: 100 });
  });
  out.sort(function (a, b) {
    return b.ms - a.ms || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0);
  });
  var max = out.length ? out[0]!.ms : 1;
  out.forEach(function (o) {
    o.pct = Math.max(6, Math.round((o.ms / max) * 100));
  });
  return out;
}

/** Quem trabalha, espera por você ou está com erro senta à mesa; o resto descansa na copa. */
export function sentaNaMesa(status: string | null | undefined): boolean {
  return status === "working" || status === "waiting_user" || status === "error";
}

/**
 * Lugar de cada bot que descansa na copa (índice do lugar, 0 = o mais confortável).
 * Estável: quem já tinha lugar (`atuais`) continua nele; quem chega pega o menor lugar livre
 * (em ordem de nome). Passando de `total`, os excedentes ganham índices acima de `total` (lugar em pé).
 */
export function distribuiCopa(
  nomes: string[],
  atuais: Record<string, number> | null | undefined,
  total: number,
): Record<string, number> {
  var out: Record<string, number> = {};
  var usado: Record<number, boolean> = {};
  var at = atuais || {};
  nomes.forEach(function (n) {
    var s = at[n];
    if (typeof s === "number" && s >= 0 && !usado[s]) {
      out[n] = s;
      usado[s] = true;
    }
  });
  nomes
    .filter(function (n) {
      return out[n] === undefined;
    })
    .sort(function (a, b) {
      return a.localeCompare(b, "pt-BR");
    })
    .forEach(function (n) {
      var i = 0;
      while (usado[i]) i++;
      out[n] = i;
      usado[i] = true;
    });
  return out;
}
