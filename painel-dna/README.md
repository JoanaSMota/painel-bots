# Painel DNA (recuperação)

App serverless do Painel DNA (Vercel + Supabase).

Este diretório reconstrói o painel depois que o fonte original (só no box `/workspace/painel/app`) ficou inacessível e a UI travava em **conectando...**.

## O que mudou nesta recuperação

- `load()` nunca fica preso: timeout de 12s, `catch` e status **ao vivo** / **sem conexão**
- Node 24.x (Hobby não aceita 20.x; 26.x estava no projeto anterior)
- Layout listado por andares/times (estado real do Supabase), com a mesma identidade visual escura e a legenda de hierarquia
- Auth, `/api/state`, `/ingest`, login/logout e health preservados (envs herdadas do projeto `painel-dna`)
- Formulário aceita `PAINEL_LOGIN` (senha web) **ou** `PAINEL_TOKEN`; ingest/Bearer continua só com `PAINEL_TOKEN`

## Deploy

Arquivos: `api/index.js`, `api/style.js`, `api/client.js`, `vercel.json`, `package.json` → projeto Vercel `painel-dna`.
