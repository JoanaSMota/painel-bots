# Painel DNA (Vercel + Supabase)

Produção: https://painel-dna-joanasmotas-projects.vercel.app

O visual ativo é o redesign **ANA** do [lucasdbb/painel-bots](https://github.com/lucasdbb/painel-bots) (MAPA | LISTA | ORGANOGRAMA), servido pelo entry `api/index.js` na raiz do repo com estado no Supabase.

## Envs (projeto Vercel `painel-dna`)

| Variável | Uso |
| --- | --- |
| `PAINEL_TOKEN` | Bearer/ingest (mín. 32) |
| `PAINEL_LOGIN` | Senha do formulário web (opcional, mín. 8) |
| `PAINEL_DB_SECRET` | RPC Supabase |
| `SUPABASE_URL` / `SUPABASE_KEY` | Backend |
| `NOTION_TOKEN` | Opcional — sem ele a aba ORGANOGRAMA fica oculta no DNA |
| `TZ_PAINEL` | America/Recife |

## Deploy

`vercel.json` na raiz: `npm run build` + rewrite `/(.*) → /api`.
