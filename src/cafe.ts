// Café no sofá: quais bots ociosos de um andar vão para o sofá/poltrona e em qual assento.
// Usada nos testes e embutida no JS do painel (por isso sem dependências externas).
// Regras: só status "idle" há pelo menos LIMITE_MIN minutos (pelo status_at que o
// /api/state já expõe); waiting_user, error e os outros nunca vão. Se houver mais
// candidatos que assentos, ficam os ociosos há mais tempo. Quem já está sentado
// continua no mesmo assento; quem chega pega o menor assento livre.
export function sofaLugares(
  bots: { nome: string; status?: string | null; status_at?: string | null }[],
  agora: number,
  assentos: number,
  atuais: Record<string, number> | null | undefined,
): Record<string, number> {
  var LIMITE_MIN = 10;
  var cand: { nome: string; t: number }[] = [];
  bots.forEach(function (b) {
    if (!b || b.status !== "idle") return;
    var t = b.status_at ? Date.parse(b.status_at) : NaN;
    if (isNaN(t) || agora - t < LIMITE_MIN * 60000) return;
    cand.push({ nome: b.nome, t: t });
  });
  cand.sort(function (a, b) {
    return a.t - b.t || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0);
  });
  var vao = cand.slice(0, Math.max(0, assentos)).map(function (c) {
    return c.nome;
  });
  var out: Record<string, number> = {};
  var usado: Record<number, boolean> = {};
  var at = atuais || {};
  vao.forEach(function (n) {
    var s = at[n];
    if (typeof s === "number" && s >= 0 && s < assentos && !usado[s]) {
      out[n] = s;
      usado[s] = true;
    }
  });
  vao.forEach(function (n) {
    if (out[n] !== undefined) return;
    for (var i = 0; i < assentos; i++)
      if (!usado[i]) {
        out[n] = i;
        usado[i] = true;
        return;
      }
  });
  return out;
}
