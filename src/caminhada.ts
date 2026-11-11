// Caminhada dos bonecos no mapa isométrico: rota pelos corredores do escritório, trajeto com
// distância percorrida e detecção de quem trocou de mesa para copa (ou o contrário).
// As três funções também rodam no navegador: o painel as embute com .toString(), por isso cada uma
// é autocontida (só usa os próprios argumentos e variáveis locais).

/** Lugar de um bot no piso. k "a": sentado numa fileira de mesas (ay = corredor atrás da fileira).
 *  k "n": em lugar que só se alcança por um corredor lateral (nc = x desse corredor): a copa e a porta do elevador. */
export interface Lugar {
  k: "a" | "n";
  x: number;
  y: number;
  ay?: number;
  nc?: number;
}

/**
 * Caminho em linhas retas (só horizontais e verticais) de um lugar a outro, pelos corredores:
 * `ais` são os y dos corredores de trás de cada fileira, `cl` e `cr` os x dos corredores esquerdo (elevador) e direito (copa).
 * Na mesma fileira vai direto pelo corredor dela; senão escolhe o corredor lateral que dá o caminho mais curto.
 */
export function rotaEscritorio(A: Lugar, B: Lugar, ais: number[], cl: number, cr: number): number[][] {
  function limpa(p: number[][]): number[][] {
    var o: number[][] = [];
    for (var i = 0; i < p.length; i++) {
      var q = p[i] as number[];
      var u = o[o.length - 1];
      if (!u || Math.abs(u[0]! - q[0]!) + Math.abs(u[1]! - q[1]!) > 1e-6) o.push([q[0]!, q[1]!]);
    }
    return o;
  }
  function comp(p: number[][]): number {
    var d = 0;
    for (var i = 1; i < p.length; i++) d += Math.abs(p[i]![0]! - p[i - 1]![0]!) + Math.abs(p[i]![1]! - p[i - 1]![1]!);
    return d;
  }
  function perna(L: Lugar, cc: number): { p: number[][]; yc: number } {
    if (L.k === "a") {
      var ay = L.ay as number;
      return { p: [[L.x, L.y], [L.x, ay], [cc, ay]], yc: ay };
    }
    if (L.nc === cc) return { p: [[L.x, L.y], [cc, L.y]], yc: L.y };
    var an = ais[0] as number;
    for (var i = 0; i < ais.length; i++) if (Math.abs((ais[i] as number) - L.y) < Math.abs(an - L.y)) an = ais[i] as number;
    return { p: [[L.x, L.y], [L.nc as number, L.y], [L.nc as number, an], [cc, an]], yc: an };
  }
  if (A.k === "a" && B.k === "a" && A.ay === B.ay) return limpa([[A.x, A.y], [A.x, A.ay as number], [B.x, A.ay as number], [B.x, B.y]]);
  var melhor: number[][] | null = null;
  [cl, cr].forEach(function (cc) {
    var pa = perna(A, cc);
    var pb = perna(B, cc);
    var p = limpa(pa.p.concat([[cc, pb.yc]]).concat(pb.p.slice().reverse()));
    if (!melhor || comp(p) < comp(melhor)) melhor = p;
  });
  return melhor || limpa([[A.x, A.y], [B.x, B.y]]);
}

/** Trajeto por pontos: comprimento total e `at(d)` = ponto a d unidades do começo (d é limitado ao trajeto). */
export function trajeto(pts: number[][]): { pts: number[][]; len: number; at: (d: number) => number[] } {
  var c = [0];
  for (var i = 1; i < pts.length; i++) c.push((c[i - 1] as number) + Math.hypot(pts[i]![0]! - pts[i - 1]![0]!, pts[i]![1]! - pts[i - 1]![1]!));
  var len = c[c.length - 1] as number;
  return {
    pts: pts,
    len: len,
    at: function (d: number) {
      d = Math.max(0, Math.min(len, d));
      for (var j = 1; j < pts.length; j++) {
        if (d <= (c[j] as number) || j === pts.length - 1) {
          var u = (c[j] as number) > (c[j - 1] as number) ? (d - (c[j - 1] as number)) / ((c[j] as number) - (c[j - 1] as number)) : 1;
          return [pts[j - 1]![0]! + (pts[j]![0]! - pts[j - 1]![0]!) * u, pts[j - 1]![1]! + (pts[j]![1]! - pts[j - 1]![1]!) * u];
        }
      }
      return pts[0] as number[];
    },
  };
}

/**
 * Quem mudou de lugar entre duas fotos do estado: `ant` e `agora` dizem, por bot, se ele senta à mesa (true) ou descansa na copa (false).
 * Primeira foto (ant nulo): ninguém caminha. Bot que só existe numa das fotos também não.
 */
export function mudouSentado(ant: Record<string, boolean> | null, agora: Record<string, boolean>): { nome: string; para: "mesa" | "copa" }[] {
  var out: { nome: string; para: "mesa" | "copa" }[] = [];
  if (!ant) return out;
  Object.keys(agora).forEach(function (n) {
    if (ant[n] !== undefined && ant[n] !== agora[n]) out.push({ nome: n, para: agora[n] ? "mesa" : "copa" });
  });
  return out;
}
