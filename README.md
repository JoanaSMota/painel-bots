# painel-bots

Painel de status dos bots do Lucas. Um único serviço Node 20 + TypeScript (só `node:http`, sem framework),
pronto para o Railway. Recebe atualizações em `POST /ingest` e mostra o painel em `GET /`, tudo protegido por chave.

## Variáveis

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `PAINEL_TOKEN` | sim (mín. 32 caracteres) | Chave de acesso. Sem ela o serviço não sobe. |
| `DATA_DIR` | não | Pasta do `state.json` (no Railway: o volume, ex. `/data`). Sem ela, só memória. |
| `PORT` | não (padrão 3000) | O Railway define sozinho. |

## Rotas

- `POST /ingest`: só `Authorization: Bearer <PAINEL_TOKEN>` (cookie não vale), `Content-Type: application/json`, corpo até 64 KB. Retorna 401 sem chave, 400 com o erro do campo, 413 se for grande demais.
- `GET /`: tela de login (nenhum dado) ou o painel. O login grava um cookie `HttpOnly; Secure; SameSite=Strict` com um HMAC da chave, nunca a chave. Também aceita Bearer.
- `GET /api/state`: estado em JSON, protegido. O painel atualiza a cada 30 s.
- `GET /health`: público, retorna só `{"ok":true}`.

O painel separa os bots por time ("andares"). Quem não tem time fica em "Sem time". Horários aparecem em America/Recife.
Quando existe `roster`, só os bots da lista aparecem.

## Privacidade

O log registra só método, rota e status. Corpo, `step` e token nunca vão para o log.
Todas as respostas levam `Cache-Control: no-store`, `X-Robots-Tag: noindex` e uma CSP com nonce.
Não há CORS. O `/login` bloqueia o IP por 15 min depois de 10 erros.

## Chave no box (caminho proposto, ainda não criado)

`/home/box/.secrets/painel-bots-token`, com permissão 600. Para criar no dia do deploy:
`mkdir -p /home/box/.secrets && (umask 077; openssl rand -hex 32 > /home/box/.secrets/painel-bots-token)`.

## Exemplos (um por tipo)

```bash
URL=https://SEU-DOMINIO.up.railway.app
K="$(cat /home/box/.secrets/painel-bots-token)"
H=(-H "Authorization: Bearer $K" -H "Content-Type: application/json")

# status: working|idle|waiting_user|error|done; step com até 80 caracteres (o excedente é cortado)
curl -sS "${H[@]}" -X POST "$URL/ingest" -d '{"type":"status","bot":"Donna","status":"working","step":"Montando o briefing das 8h"}'

# routines: substitui a lista daquele bot; next_run em ISO 8601 ou null
curl -sS "${H[@]}" -X POST "$URL/ingest" -d '{"type":"routines","bot":"Donna","items":[{"name":"Briefing","schedule":"dias úteis 8h","next_run":"2026-11-03T08:00:00-03:00"}]}'

# roster: lista de bots exibidos
curl -sS "${H[@]}" -X POST "$URL/ingest" -d '{"type":"roster","names":["Donna","Grok Bot","Diretor Agentes"]}'

# looks: shape (circle|square|rounded|triangle|diamond|hexagon|star), color em hex, accessory
curl -sS "${H[@]}" -X POST "$URL/ingest" -d '{"type":"looks","bots":{"Donna":{"shape":"star","color":"#ff8800","accessory":"fone"}}}'

# groups: time de cada bot (cada time vira um andar)
curl -sS "${H[@]}" -X POST "$URL/ingest" -d '{"type":"groups","bots":{"Donna":"Operação","Grok Bot":"Dev"}}'

# chat: link precisa começar com grokbot://app/v1/agent?id=
curl -sS "${H[@]}" -X POST "$URL/ingest" -d '{"type":"chat","bots":{"Donna":"grokbot://app/v1/agent?id=SEU-ID"}}'

# usage: percentuais de 0 a 100, resets_at em ISO 8601
curl -sS "${H[@]}" -X POST "$URL/ingest" -d '{"type":"usage","total_used_pct":42.5,"resets_at":"2026-11-09T00:00:00-03:00","bots":{"Donna":10,"Grok Bot":30}}'
```

## Desenvolvimento

```bash
npm install
npm test          # build + testes (node:test)
npm run typecheck
PAINEL_TOKEN=$(openssl rand -hex 32) DATA_DIR=./data npm start
```
