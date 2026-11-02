// Frescor do status: há quanto tempo o bot atualizou o status pela última vez.
// Usada nos testes e embutida no JS do painel (por isso sem dependências externas).
// Status "waiting_user" há mais de 30 min recebe o selo "pode estar desatualizado".
export function frescor(
  statusAt: string | null | undefined,
  status: string | null | undefined,
  agora: number,
): { texto: string; velho: boolean; min: number | null } {
  var LIMITE_MIN = 30;
  var t = statusAt ? Date.parse(statusAt) : NaN;
  if (isNaN(t)) return { texto: "sem atualização registrada", velho: false, min: null };
  var s = Math.max(0, Math.round((agora - t) / 1000));
  var m = Math.floor(s / 60);
  var texto;
  if (s < 60) texto = "atualizado agora";
  else if (m < 60) texto = "atualizado há " + m + " min";
  else if (m < 48 * 60) texto = "atualizado há " + Math.floor(m / 60) + " h";
  else {
    var d = Math.floor(m / 1440);
    texto = "atualizado há " + d + (d === 1 ? " dia" : " dias");
  }
  return { texto: texto, velho: status === "waiting_user" && m > LIMITE_MIN, min: m };
}
