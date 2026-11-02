// Ordem dos andares. Usada no servidor (testes) e embutida no JS do painel.
// Sem `floors`: ordem alfabética, "Sem time" por último (comportamento antigo).
// Com `floors`: os times listados primeiro, na ordem dada; os outros depois
// (alfabético); "Sem time" sempre por último. Times listados sem bots são omitidos.
export function floorOrder(teams: string[], floors: string[] | null | undefined): string[] {
  var SEM = "Sem time";
  var uniq: string[] = [];
  teams.forEach(function (t) {
    if (uniq.indexOf(t) < 0) uniq.push(t);
  });
  var out: string[] = [];
  (floors || []).forEach(function (t) {
    if (t !== SEM && uniq.indexOf(t) >= 0 && out.indexOf(t) < 0) out.push(t);
  });
  uniq
    .filter(function (t) {
      return t !== SEM && out.indexOf(t) < 0;
    })
    .sort(function (a, b) {
      return a.localeCompare(b, "pt-BR");
    })
    .forEach(function (t) {
      out.push(t);
    });
  if (uniq.indexOf(SEM) >= 0) out.push(SEM);
  return out;
}
