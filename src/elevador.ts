// Elevador: para onde aponta a seta do painel de andar quando um bot viaja de um andar a outro.
// Usada nos testes e embutida no JS do painel (por isso sem dependências externas).
// `ordem` é a ordem dos andares do painel (floorOrder): o 1º é o andar 1 (embaixo), o 2º o andar 2...
// Devolve a direção da viagem ("sobe" se o destino está acima, "desce" se está abaixo) e o
// número do andar de destino (1, 2, ...). Mesmo andar ou andar desconhecido: dir null, andar 0
// se o destino não está na ordem.
export function elevSeta(
  de: string | null | undefined,
  para: string | null | undefined,
  ordem: string[],
): { dir: "sobe" | "desce" | null; andar: number } {
  var i = de == null ? -1 : ordem.indexOf(de);
  var j = para == null ? -1 : ordem.indexOf(para);
  var andar = j >= 0 ? j + 1 : 0;
  if (i < 0 || j < 0 || i === j) return { dir: null, andar: andar };
  return { dir: j > i ? "sobe" : "desce", andar: andar };
}
