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

/**
 * Onde pôr o rótulo fixo de um bot no mapa. (bx, by) = centro e topo do boneco; w×h = tamanho do rótulo;
 * `postos` = rótulos já colocados; `obst` = caixas de TODOS os bonecos do andar (inclusive o dono do rótulo)
 * e dos textos do mapa (letreiro COPA etc.); `vb` = área visível. Tenta posições candidatas, das mais próximas
 * (acima, depois lados, depois abaixo, depois mais longe) e fica com a primeira sem sobreposição com rótulos nem
 * bonecos. Se nada cabe, aceita sobrepor bonecos (nunca outros rótulos, se der). `livre` diz se achou lugar limpo.
 */
export function posicionaRotulo(
  bx: number,
  by: number,
  w: number,
  h: number,
  postos: { x: number; y: number; w: number; h: number }[],
  obst: { x: number; y: number; w: number; h: number }[],
  vb: { x0: number; y0: number; x1: number; y1: number },
): { x: number; y: number; livre: boolean } {
  var x0 = bx - w / 2;
  var y0 = by - h - 26;
  function colide(x: number, y: number, lista: { x: number; y: number; w: number; h: number }[]) {
    return lista.some(function (p) {
      return x < p.x + p.w + 4 && x + w + 4 > p.x && y < p.y + p.h + 3 && y + h + 3 > p.y;
    });
  }
  function dentro(x: number, y: number) {
    return x >= vb.x0 + 4 && x + w <= vb.x1 - 4 && y >= vb.y0 + 4 && y + h <= vb.y1 - 30;
  }
  var tent: number[][] = [];
  [0, -1, 1, -2, 2, -3, 3, -4, 4].forEach(function (dy) {
    [0, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2, -3, 3].forEach(function (dx) {
      tent.push([dx * (w + 8), dy * (h + 8) - (dx ? 6 : 0)]);
    });
  });
  tent.sort(function (p, q) {
    return Math.abs(p[0]!) / 2 + Math.abs(p[1]!) * 1.5 + (p[1]! > 0 ? 60 : 0) - (Math.abs(q[0]!) / 2 + Math.abs(q[1]!) * 1.5 + (q[1]! > 0 ? 60 : 0));
  });
  var ok: number[] | null = null;
  var livre = false;
  var i: number;
  for (i = 0; i < tent.length && !ok; i++) {
    var xx = x0 + tent[i]![0]!,
      yy = y0 + tent[i]![1]!;
    if (dentro(xx, yy) && !colide(xx, yy, postos) && !colide(xx, yy, obst)) {
      ok = tent[i]!;
      livre = true;
    }
  }
  for (i = 0; i < tent.length && !ok; i++) {
    var x3 = x0 + tent[i]![0]!,
      y3 = y0 + tent[i]![1]!;
    if (dentro(x3, y3) && !colide(x3, y3, postos)) ok = tent[i]!;
  }
  var d = ok || [0, 0];
  return {
    x: Math.max(vb.x0 + 4, Math.min(vb.x1 - 4 - w, x0 + d[0]!)),
    y: Math.max(vb.y0 + 4, Math.min(vb.y1 - 30 - h, y0 + d[1]!)),
    livre: livre,
  };
}
